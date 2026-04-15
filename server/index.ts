import "dotenv/config";
import cors from "cors";
import cookieParser from "cookie-parser";
import dayjs from "dayjs";
import express, { type NextFunction, type Request, type Response } from "express";
import session from "express-session";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { Server } from "socket.io";
import {
  addMessage,
  createAutomation,
  createCampaign,
  createChannel,
  createSegment,
  createTemplate,
  createUser,
  enqueueAutomationJob,
  getAutomation,
  findChannel,
  findChannelByNumber,
  findContact,
  findContactByPhone,
  findTemplate,
  getBootstrapData,
  getUserForSession,
  initDb,
  importContacts,
  listAutomations,
  listCampaigns,
  listChannels,
  listDueAutomationJobs,
  markAutomationJob,
  openConversation,
  resolveCampaignRecipients,
  updateCampaignStatus,
  updateMessageStatus,
  updateTemplateTwilioSid,
  upsertContact,
  verifyPassword
} from "./db.js";
import { buildContentVariables, renderTemplate, sendWhatsAppMessage, syncTemplateToTwilioContent } from "./twilio.js";

type SessionRequest = Request & {
  session: session.Session &
    Partial<session.SessionData> & {
      userId?: string;
    };
};

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true
  }
});

const upload = multer({ storage: multer.memoryStorage() });
const port = Number(process.env.PORT ?? 3001);
const isProduction = process.env.NODE_ENV === "production";

initDb();

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET ?? "local-dev-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false
  }
});

app.use(
  cors({
    origin: true,
    credentials: true
  })
);
app.use(express.json({ limit: "4mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(sessionMiddleware);

io.engine.use(sessionMiddleware as any);

io.on("connection", (socket) => {
  socket.emit("connected", { ok: true, timestamp: new Date().toISOString() });
});

function requireAuth(req: SessionRequest, res: Response, next: NextFunction) {
  const user = req.session.userId ? getUserForSession(req.session.userId) : null;
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.session.userId = user.id;
  next();
}

function refreshClients(type: string, payload?: Record<string, unknown>) {
  io.emit("data:refresh", { type, ...payload, timestamp: new Date().toISOString() });
}

async function sendTemplateMessage(input: {
  contactId: string;
  channelId: string;
  templateId: string;
  conversationId?: string;
  source?: string;
}) {
  const contact = findContact(input.contactId);
  const channel = findChannel(input.channelId);
  const template = findTemplate(input.templateId);

  if (!contact || !channel || !template) {
    throw new Error("Message dependencies are missing");
  }

  const conversationId = input.conversationId ?? openConversation(contact.id, channel.id);
  const renderedBody = renderTemplate(template, contact);
  const result = await sendWhatsAppMessage({
    channel,
    contact,
    body: renderedBody,
    mediaUrl: template.mediaUrl,
    contentSid: template.twilioContentSid ?? null,
    contentVariables: template.twilioContentSid ? buildContentVariables(template, contact) : null
  });

  const message = addMessage({
    conversationId,
    channelId: channel.id,
    direction: "outbound",
    body: renderedBody,
    mediaUrl: template.mediaUrl,
    status: result.status,
    templateId: template.id,
    twilioMessageSid: result.sid,
    twilioContentSid: template.twilioContentSid,
    metadata: {
      source: input.source ?? "manual",
      ctaLabel: template.ctaLabel,
      ctaUrl: template.ctaUrl
    }
  });

  io.emit("conversation:message", { conversationId, message });
  refreshClients("message", { conversationId });
  return { conversationId, message };
}

async function sendManualMessage(input: {
  contactId: string;
  channelId: string;
  body: string;
  mediaUrl?: string | null;
  conversationId?: string;
}) {
  const contact = findContact(input.contactId);
  const channel = findChannel(input.channelId);

  if (!contact || !channel) {
    throw new Error("Missing channel or contact");
  }

  const conversationId = input.conversationId ?? openConversation(contact.id, channel.id);
  const result = await sendWhatsAppMessage({
    channel,
    contact,
    body: input.body,
    mediaUrl: input.mediaUrl ?? null
  });

  const message = addMessage({
    conversationId,
    channelId: channel.id,
    direction: "outbound",
    body: input.body,
    mediaUrl: input.mediaUrl ?? null,
    status: result.status,
    twilioMessageSid: result.sid,
    metadata: {
      source: "manual-reply"
    }
  });

  io.emit("conversation:message", { conversationId, message });
  refreshClients("message", { conversationId });
  return { conversationId, message };
}

function queueAutomationIfNeeded(input: {
  eventType: "incoming_keyword" | "new_contact" | "segment_joined";
  contactId: string;
  channelId: string;
  body?: string;
  segmentIds?: string[];
}) {
  const automations = listAutomations().filter((automation) => automation.isActive && automation.triggerType === input.eventType);

  for (const automation of automations) {
    if (automation.triggerType === "incoming_keyword") {
      const keyword = (automation.triggerValue ?? "").toLowerCase().trim();
      if (!keyword || !input.body?.toLowerCase().includes(keyword)) {
        continue;
      }
    }

    if (automation.triggerType === "segment_joined") {
      if (!automation.segmentId || !input.segmentIds?.includes(automation.segmentId)) {
        continue;
      }
    }

    const runAt = dayjs().add(automation.delayMinutes, "minute").toISOString();
    enqueueAutomationJob({
      automationId: automation.id,
      contactId: input.contactId,
      channelId: automation.channelId || input.channelId,
      runAt,
      payload: {
        triggerBody: input.body ?? null
      }
    });
  }
}

async function processAutomationJobs() {
  const jobs = listDueAutomationJobs();
  for (const job of jobs) {
    try {
      markAutomationJob(job.id, "processing");
      const automation = getAutomation(job.automation_id);
      if (!automation) {
        markAutomationJob(job.id, "cancelled");
        continue;
      }
      await sendTemplateMessage({
        contactId: job.contact_id,
        channelId: job.channel_id,
        templateId: automation.templateId,
        source: `automation:${automation.triggerType}`
      });
      markAutomationJob(job.id, "sent");
    } catch (error) {
      console.error("Automation job failed", error);
      markAutomationJob(job.id, "failed");
    }
  }
}

async function processQueuedCampaigns() {
  const dueCampaigns = listCampaigns().filter(
    (campaign) =>
      campaign.status === "queued" &&
      Boolean(campaign.scheduledAt) &&
      dayjs(campaign.scheduledAt).isBefore(dayjs().add(1, "second"))
  );

  for (const campaign of dueCampaigns) {
    const recipients = resolveCampaignRecipients(campaign);
    const stats = {
      attempted: 0,
      delivered: 0,
      failed: 0
    };

    for (const recipient of recipients) {
      stats.attempted += 1;
      try {
        await sendTemplateMessage({
          contactId: recipient.id,
          channelId: campaign.channelId,
          templateId: campaign.templateId,
          source: `campaign:${campaign.name}`
        });
        stats.delivered += 1;
      } catch (error) {
        console.error("Queued campaign send failed", error);
        stats.failed += 1;
      }
    }

    updateCampaignStatus(campaign.id, "sent", stats);
    refreshClients("campaign", { campaignId: campaign.id });
  }
}

setInterval(() => {
  void processAutomationJobs();
  void processQueuedCampaigns();
}, 5000);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    twilioConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
  });
});

app.post("/api/auth/login", (req: SessionRequest, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user = verifyPassword(email, password);
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  req.session.userId = user.id;
  return res.json({ user });
});

app.post("/api/auth/logout", (req: SessionRequest, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get("/api/bootstrap", requireAuth, (req: SessionRequest, res) => {
  res.json(getBootstrapData(req.session.userId!));
});

app.post("/api/contacts", requireAuth, async (req: SessionRequest, res) => {
  const before = req.body.phone ? findContactByPhone(req.body.phone) : null;
  const contact = upsertContact({
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    phone: req.body.phone,
    email: req.body.email,
    company: req.body.company,
    labels: Array.isArray(req.body.labels) ? req.body.labels : [],
    customFields: req.body.customFields ?? {},
    segmentIds: Array.isArray(req.body.segmentIds) ? req.body.segmentIds : [],
    segmentMode: req.body.segmentMode ?? "replace"
  });

  if (!before && contact) {
    const fallbackChannel = listChannels()[0];
    if (fallbackChannel) {
      queueAutomationIfNeeded({
        eventType: "new_contact",
        contactId: contact.id,
        channelId: fallbackChannel.id
      });
    }
  }

  if (contact && req.body.segmentIds?.length) {
    const fallbackChannel = listChannels()[0];
    if (fallbackChannel) {
      queueAutomationIfNeeded({
        eventType: "segment_joined",
        contactId: contact.id,
        channelId: fallbackChannel.id,
        segmentIds: Array.isArray(req.body.segmentIds) ? req.body.segmentIds : []
      });
    }
  }

  refreshClients("contacts");
  res.json({ contact });
});

app.post("/api/contacts/import", requireAuth, upload.single("file"), (req: SessionRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "CSV file is required" });
  }

  const records = parse(req.file.buffer.toString("utf-8"), {
    columns: true,
    skip_empty_lines: true
  }) as Record<string, string>[];

  const parsedContacts = records.map((row) => {
    const knownKeys = new Set(["firstName", "lastName", "phone", "email", "company", "labels"]);
    const customFields = Object.fromEntries(
      Object.entries(row).filter(([key]) => !knownKeys.has(key) && row[key as keyof typeof row])
    );
    return {
      firstName: row.firstName ?? "",
      lastName: row.lastName ?? "",
      phone: row.phone ?? "",
      email: row.email ?? "",
      company: row.company ?? "",
      labels: row.labels ? row.labels.split("|").map((label) => label.trim()).filter(Boolean) : [],
      customFields
    };
  });

  const segmentIds = typeof req.body.segmentIds === "string" ? req.body.segmentIds.split(",").filter(Boolean) : [];
  const imported = importContacts(parsedContacts, segmentIds, req.body.segmentMode ?? "add");

  const fallbackChannel = listChannels()[0];
  if (fallbackChannel) {
    for (const contact of imported) {
      queueAutomationIfNeeded({
        eventType: "new_contact",
        contactId: contact.id,
        channelId: fallbackChannel.id
      });
    }
  }

  refreshClients("contacts");
  return res.json({ importedCount: imported.length });
});

app.post("/api/conversations/open", requireAuth, async (req: SessionRequest, res) => {
  const { contactId, channelId, templateId } = req.body as {
    contactId?: string;
    channelId?: string;
    templateId?: string;
  };
  if (!contactId || !channelId) {
    return res.status(400).json({ error: "contactId and channelId are required" });
  }

  const conversationId = openConversation(contactId, channelId);
  if (templateId) {
    await sendTemplateMessage({ contactId, channelId, templateId, conversationId, source: "open-conversation" });
  }
  refreshClients("conversation", { conversationId });
  return res.json({ conversationId });
});

app.post("/api/messages/send", requireAuth, async (req: SessionRequest, res) => {
  const { conversationId, contactId, channelId, body, mediaUrl, templateId } = req.body as {
    conversationId?: string;
    contactId?: string;
    channelId?: string;
    body?: string;
    mediaUrl?: string;
    templateId?: string;
  };

  if (!contactId || !channelId) {
    return res.status(400).json({ error: "contactId and channelId are required" });
  }

  if (templateId) {
    const result = await sendTemplateMessage({ contactId, channelId, templateId, conversationId });
    return res.json(result);
  }

  if (!body?.trim()) {
    return res.status(400).json({ error: "Message body is required" });
  }

  const result = await sendManualMessage({
    contactId,
    channelId,
    body,
    mediaUrl: mediaUrl ?? null,
    conversationId
  });
  return res.json(result);
});

app.post("/api/templates", requireAuth, (req: SessionRequest, res) => {
  const template = createTemplate({
    name: req.body.name,
    category: req.body.category,
    body: req.body.body,
    placeholders: Array.isArray(req.body.placeholders) ? req.body.placeholders : [],
    mediaUrl: req.body.mediaUrl,
    ctaLabel: req.body.ctaLabel,
    ctaUrl: req.body.ctaUrl
  });
  refreshClients("templates");
  res.json({ template });
});

app.post("/api/templates/:id/sync", requireAuth, async (req: SessionRequest, res) => {
  const templateId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const template = findTemplate(templateId);
  if (!template) {
    return res.status(404).json({ error: "Template not found" });
  }
  const result = await syncTemplateToTwilioContent(template);
  if (result.sid) {
    updateTemplateTwilioSid(template.id, result.sid);
    refreshClients("templates");
  }
  return res.json(result);
});

app.post("/api/campaigns/send", requireAuth, async (req: SessionRequest, res) => {
  const campaign = createCampaign({
    name: req.body.name,
    templateId: req.body.templateId,
    channelId: req.body.channelId,
    recipientMode: req.body.recipientMode,
    recipientIds: Array.isArray(req.body.recipientIds) ? req.body.recipientIds : [],
    scheduledAt: req.body.scheduledAt ?? null,
    status: req.body.scheduledAt ? "queued" : "sending"
  });

  if (campaign.status === "queued") {
    refreshClients("campaign");
    return res.json({ campaign, queued: true });
  }

  const recipients = resolveCampaignRecipients(campaign);
  const stats = {
    attempted: 0,
    delivered: 0,
    failed: 0
  };

  for (const recipient of recipients) {
    stats.attempted += 1;
    try {
      await sendTemplateMessage({
        contactId: recipient.id,
        channelId: campaign.channelId,
        templateId: campaign.templateId,
        source: `campaign:${campaign.name}`
      });
      stats.delivered += 1;
    } catch (error) {
      console.error("Campaign send failed", error);
      stats.failed += 1;
    }
  }

  updateCampaignStatus(campaign.id, "sent", stats);
  refreshClients("campaign");
  return res.json({ campaignId: campaign.id, stats });
});

app.post("/api/automations", requireAuth, (req: SessionRequest, res) => {
  const automation = createAutomation({
    name: req.body.name,
    triggerType: req.body.triggerType,
    triggerValue: req.body.triggerValue,
    templateId: req.body.templateId,
    channelId: req.body.channelId,
    segmentId: req.body.segmentId,
    delayMinutes: Number(req.body.delayMinutes ?? 0)
  });
  refreshClients("automation");
  res.json({ automation });
});

app.post("/api/channels", requireAuth, (req: SessionRequest, res) => {
  const channels = createChannel({
    name: req.body.name,
    whatsappNumber: req.body.whatsappNumber,
    messagingServiceSid: req.body.messagingServiceSid
  });
  refreshClients("channels");
  res.json({ channels });
});

app.post("/api/segments", requireAuth, (req: SessionRequest, res) => {
  const segments = createSegment({
    name: req.body.name,
    color: req.body.color
  });
  refreshClients("segments");
  res.json({ segments });
});

app.post("/api/users", requireAuth, (req: SessionRequest, res) => {
  const user = createUser({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    role: req.body.role ?? "agent"
  });
  refreshClients("users");
  res.json({ user });
});

app.post("/api/webhooks/twilio/incoming", async (req, res) => {
  const from = typeof req.body.From === "string" ? req.body.From : "";
  const to = typeof req.body.To === "string" ? req.body.To : "";
  const body = typeof req.body.Body === "string" ? req.body.Body : "";
  const mediaUrl = typeof req.body.MediaUrl0 === "string" ? req.body.MediaUrl0 : null;

  const channel = findChannelByNumber(to);
  if (!channel) {
    return res.status(400).send("Unknown channel");
  }

  let contact = findContactByPhone(from);
  if (!contact) {
    contact = upsertContact({
      firstName: from.replace(/^whatsapp:/, ""),
      lastName: "",
      phone: from.replace(/^whatsapp:/, ""),
      labels: ["inbound"],
      customFields: {},
      segmentIds: [],
      segmentMode: "replace"
    });
    if (contact) {
      queueAutomationIfNeeded({
        eventType: "new_contact",
        contactId: contact.id,
        channelId: channel.id
      });
    }
  }

  if (!contact) {
    return res.status(400).send("Contact could not be created");
  }

  const conversationId = openConversation(contact.id, channel.id);
  const message = addMessage({
    conversationId,
    channelId: channel.id,
    direction: "inbound",
    body,
    mediaUrl,
    status: "received",
    twilioMessageSid: typeof req.body.MessageSid === "string" ? req.body.MessageSid : null,
    metadata: {
      profileName: req.body.ProfileName ?? null
    }
  });

  queueAutomationIfNeeded({
    eventType: "incoming_keyword",
    contactId: contact.id,
    channelId: channel.id,
    body
  });

  io.emit("conversation:message", { conversationId, message });
  refreshClients("message", { conversationId });
  return res.type("text/xml").send("<Response></Response>");
});

app.post("/api/webhooks/twilio/status", (req, res) => {
  const messageSid = typeof req.body.MessageSid === "string" ? req.body.MessageSid : null;
  const status = typeof req.body.MessageStatus === "string" ? req.body.MessageStatus : null;
  if (messageSid && status) {
    updateMessageStatus(messageSid, status);
    refreshClients("message-status");
  }
  res.type("text/xml").send("<Response></Response>");
});

if (isProduction) {
  const clientPath = resolve(process.cwd(), "dist/client");
  app.use(express.static(clientPath));
  app.get("*", (_req, res) => {
    res.sendFile(resolve(clientPath, "index.html"));
  });
}

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: error.message });
});

server.listen(port, () => {
  console.log(`WhatsApp center listening on http://localhost:${port}`);
});
