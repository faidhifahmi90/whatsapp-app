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
import twilio from "twilio";
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
  upsertTemplate,
  updateCampaignStatus,
  updateMessageStatus,
  updateTemplateTwilioSid,
  upsertContact,
  getUserByEmail,
  updateTemplate,
  deleteTemplate,
  updateChannel,
  deleteChannel,
  updateUser,
  deleteUser,
  createNote,
  updateNote,
  deleteNote,
  updateConversationStatus,
  updateUserLogin,
  clearContactsAndFields,
  registerCustomFields,
  listCustomFieldDefinitions,
  findContactByRegistrationNo,
  normalizeRegNo
} from "./db.js";
import {
  buildContentVariables,
  fetchApprovedTemplatesFromTwilio,
  renderTemplate,
  sendWhatsAppMessage,
  syncTemplateToTwilioContent
} from "./twilio.js";
import { SqliteSessionStore } from "./session-store.js";
import { OAuth2Client } from "google-auth-library";
import { processJourneys, enrollContact } from "./journeyEngine.js";

type SessionRequest = Request & {
  session: session.Session &
    Partial<session.SessionData> & {
      userId?: string;
    };
};

const app = express();
const server = createServer(app);
const oauthClient = new OAuth2Client(process.env.VITE_GOOGLE_CLIENT_ID);
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true
  }
});

const upload = multer({ storage: multer.memoryStorage() });
const port = Number(process.env.PORT ?? 3001);
const isProduction = process.env.NODE_ENV === "production";
const trustProxy = process.env.TRUST_PROXY === "true";
const secureCookie =
  process.env.SESSION_COOKIE_SECURE === "true"
    ? true
    : process.env.SESSION_COOKIE_SECURE === "false"
      ? false
      : isProduction;
const validateTwilioWebhooks = process.env.TWILIO_WEBHOOK_VALIDATE === "true";
const publicBaseUrl = process.env.PUBLIC_BASE_URL;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;

if (trustProxy) {
  app.set("trust proxy", 1);
}

initDb();

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET ?? "local-dev-secret",
  store: new SqliteSessionStore(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie,
    maxAge: 1000 * 60 * 60 * 24 * 7
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

function validateTwilioSignature(req: Request, res: Response, next: NextFunction) {
  if (!validateTwilioWebhooks || !twilioAuthToken) {
    next();
    return;
  }

  const signature = req.header("X-Twilio-Signature");
  if (!signature) {
    res.status(403).send("Missing Twilio signature");
    return;
  }

  const requestUrl = publicBaseUrl
    ? new URL(req.originalUrl, publicBaseUrl).toString()
    : `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  const isValid = twilio.validateRequest(twilioAuthToken, signature, requestUrl, req.body as Record<string, string>);

  if (!isValid) {
    res.status(403).send("Invalid Twilio signature");
    return;
  }

  next();
}

async function sendTemplateMessage(input: {
  contactId: string;
  channelId: string;
  templateId: string;
  conversationId?: string;
  source?: string;
  customVariables?: string[];
  mediaUrlOverride?: string;
}) {
  const contact = findContact(input.contactId);
  const channel = findChannel(input.channelId);
  const template = findTemplate(input.templateId);

  if (!contact || !channel || !template) {
    throw new Error("Message dependencies are missing");
  }

  const conversationId = input.conversationId ?? openConversation(contact.id, channel.id);
  const renderedBody = renderTemplate(template, contact, input.customVariables);
  const finalMediaUrl = input.mediaUrlOverride || template.mediaUrl;
  
  // If the sender explicitly overrides the media url dynamically, we must bypass the static Twilio Content API template and let the classic message API map the template manually via WhatsApp.
  const useContentAPI = template.twilioContentSid && !input.mediaUrlOverride; 

  const result = await sendWhatsAppMessage({
    channel,
    contact,
    body: renderedBody,
    mediaUrl: finalMediaUrl,
    contentSid: useContentAPI ? template.twilioContentSid : null,
    contentVariables: useContentAPI ? buildContentVariables(template, contact, input.customVariables) : null
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
  channelId?: string;
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

    if (automation.version === "journey") {
      enrollContact(automation.id, input.contactId);
    } else {
      const runAt = dayjs().add(automation.delayMinutes || 0, "minute").toISOString();
      enqueueAutomationJob({
        automationId: automation.id,
        contactId: input.contactId,
        channelId: automation.channelId || input.channelId || "",
        runAt,
        payload: {
          templateId: automation.templateId,
          triggerBody: input.body ?? null
        }
      });
    }
  }
}

async function processAutomationJobs() {
  // Simple Automations
  const jobs = listDueAutomationJobs();
  for (const job of jobs) {
    try {
      const template = findTemplate(job.payload?.templateId);
      const channel = findChannel(job.channelId);
      const contact = findContact(job.contactId);
      if (template && channel && contact) {
        await sendWhatsAppMessage({ channel, contact, body: renderTemplate(template, contact, job.payload?.variables || []), mediaUrl: template.mediaUrl });
      }
      markAutomationJob(job.id, "sent");
    } catch (err) {
      markAutomationJob(job.id, "failed");
    }
  }

  // Journey Automations
  await processJourneys().catch(err => console.error("Journey Engine Error:", err));
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

let backgroundLoopRunning = false;
setInterval(() => {
  if (backgroundLoopRunning) {
    return;
  }
  backgroundLoopRunning = true;
  void Promise.all([processAutomationJobs(), processQueuedCampaigns()]).finally(() => {
    backgroundLoopRunning = false;
  });
}, 5000);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    twilioConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
  });
});

app.get("/api/public-config", (_req, res) => {
  res.json({
    googleClientId: process.env.VITE_GOOGLE_CLIENT_ID ?? ""
  });
});

app.post("/api/auth/google", async (req: SessionRequest, res) => {
  const { credential } = req.body as { credential?: string };
  if (!credential) {
    return res.status(400).json({ error: "Missing Google credential" });
  }

  try {
    const ticket = await oauthClient.verifyIdToken({
      idToken: credential,
      audience: process.env.VITE_GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    
    if (!payload?.email) {
      return res.status(400).json({ error: "Invalid Google token payload" });
    }
    
    const user = getUserByEmail(payload.email);
    if (!user) {
      return res.status(403).json({ error: "Email not whitelisted in the system." });
    }

    req.session.userId = user.id;
    updateUserLogin(user.id);
    return res.json({ user });
  } catch (error) {
    console.error("Google Auth Error:", error);
    return res.status(401).json({ error: "Invalid Google credential" });
  }
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
  const customFields = req.body.customFields ?? {};
  if (Object.keys(customFields).length > 0) {
    registerCustomFields(Object.keys(customFields));
  }

  const contact = upsertContact({
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    phone: req.body.phone,
    email: req.body.email,
    company: req.body.company,
    labels: Array.isArray(req.body.labels) ? req.body.labels : [],
    customFields,
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

app.delete("/api/contacts/clear", requireAuth, (_req: SessionRequest, res) => {
  clearContactsAndFields();
  refreshClients("contacts");
  res.json({ success: true });
});

app.post("/api/contacts/:id/notes", requireAuth, (req: SessionRequest, res) => {
  const contactId = req.params.id as string;
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: "Note body required" });
  
  const user = req.session.userId ? getUserForSession(req.session.userId) : null;
  const note = createNote(contactId, user?.name ?? "System", body);
  refreshClients("contacts");
  res.json({ note });
});

app.put("/api/notes/:id", requireAuth, (req: SessionRequest, res) => {
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: "Note body required" });
  
  updateNote(req.params.id as string, body);
  refreshClients("contacts");
  res.json({ success: true });
});

app.delete("/api/notes/:id", requireAuth, (req: SessionRequest, res) => {
  deleteNote(req.params.id as string);
  refreshClients("contacts");
  res.json({ success: true });
});

app.post("/api/conversations/:id/status", requireAuth, (req: SessionRequest, res) => {
  const { status } = req.body;
  if (!["open", "kiv", "resolved", "attention", "pending"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  updateConversationStatus(req.params.id as string, status);
  refreshClients("campaign"); // using campaign identifier to bump overarching inbox/messages state
  res.json({ success: true });
});
app.post("/api/contacts/import/preview", requireAuth, upload.single("file"), (req: SessionRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "CSV file is required" });
  }

  const records = parse(req.file.buffer.toString("utf-8"), {
    columns: true,
    skip_empty_lines: true
  }) as Record<string, string>[];

  const headers = records.length > 0 ? Object.keys(records[0]) : [];
  const previewRows = records.slice(0, 3);

  return res.json({ headers, previewRows });
});

app.post("/api/contacts/import/evaluate", requireAuth, upload.single("file"), (req: SessionRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "CSV file is required" });
  }

  const records = parse(req.file.buffer.toString("utf-8"), {
    columns: true,
    skip_empty_lines: true
  }) as Record<string, string>[];

  let mapping: Record<string, string> = {};
  if (req.body.mapping) {
    try { mapping = JSON.parse(req.body.mapping); } catch {}
  }

  const conflicts: Array<{
    phone: string;
    firstName: string;
    lastName: string;
    originalFields: Record<string, string>;
    incomingFields: Record<string, string>;
  }> = [];

  records.forEach((row) => {
    const customFields: Record<string, string> = {};
    const translated: Record<string, string> = {};

    const vehicle: Record<string, string> = {};
    const order: Record<string, string> = {};

    for (const [originalHeader, val] of Object.entries(row)) {
      const targetHeader = mapping[originalHeader] || originalHeader;
      if (targetHeader === "ignore" || !val) continue;

      if (["firstName", "lastName", "phone", "email", "company", "labels", "identification_number", "date_joined"].includes(targetHeader)) {
        translated[targetHeader] = val;
      } else if (targetHeader.startsWith("vehicle_")) {
        vehicle[targetHeader.replace("vehicle_", "")] = val;
      } else if (targetHeader.startsWith("order_")) {
        order[targetHeader.replace("order_", "")] = val;
      } else {
        customFields[targetHeader] = val;
      }
    }
    const regForMissingPhone = vehicle.vehicleRegistrationNo || order.vehicleRegistrationNo;
    if (!translated.phone && regForMissingPhone) {
       const resolved = findContactByRegistrationNo(regForMissingPhone);
       if (resolved) translated.phone = resolved.phone;
    }
    
    if (!translated.phone) return;
    
    const existing = findContactByPhone(translated.phone);
    if (!existing) return;

    let hasConflict = false;
    // For evaluating conflicts, we only care about overlap.
    const overlappingKeys = Object.keys(customFields).filter(k => existing.customFields[k] !== undefined);
    
    if (overlappingKeys.length > 0) {
      for (const k of overlappingKeys) {
        if (existing.customFields[k] !== customFields[k]) {
          hasConflict = true;
          break;
        }
      }
    }
    
    if (hasConflict) {
      conflicts.push({
        phone: translated.phone,
        firstName: existing.firstName,
        lastName: existing.lastName,
        originalFields: existing.customFields,
        incomingFields: customFields
      });
    }
  });

  return res.json({ conflicts });
});

app.post("/api/contacts/import", requireAuth, upload.single("file"), (req: SessionRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "CSV file is required" });
  }

  const records = parse(req.file.buffer.toString("utf-8"), {
    columns: true,
    skip_empty_lines: true
  }) as Record<string, string>[];

  let mapping: Record<string, string> = {};
  if (req.body.mapping) {
    try {
      mapping = JSON.parse(req.body.mapping);
    } catch {}
  }

  let resolvers: Record<string, Record<string, string>> = {};
  if (req.body.resolvers) {
    try { resolvers = JSON.parse(req.body.resolvers); } catch {}
  }

  const parsedContacts = records.map((row) => {
    let customFields: Record<string, string> = {};
    const translated: Record<string, string> = {};

    const vehicle: Record<string, string> = {};
    const order: Record<string, string> = {};

    for (const [originalHeader, val] of Object.entries(row)) {
      const targetHeader = mapping[originalHeader] || originalHeader;
      if (targetHeader === "ignore" || !val) continue;

      if (["firstName", "lastName", "phone", "email", "company", "labels", "identification_number", "date_joined"].includes(targetHeader)) {
        translated[targetHeader] = val;
      } else if (targetHeader.startsWith("vehicle_")) {
        vehicle[targetHeader.replace("vehicle_", "")] = val;
      } else if (targetHeader.startsWith("order_")) {
        order[targetHeader.replace("order_", "")] = val;
      } else {
        customFields[targetHeader] = val;
      }
    }

    // Smart cross-population: If reg number is in either vehicle or order, share it.
    const rowRegNo = vehicle.vehicleRegistrationNo || order.vehicleRegistrationNo;
    if (rowRegNo) {
      if (!vehicle.vehicleRegistrationNo) vehicle.vehicleRegistrationNo = rowRegNo;
      if (!order.vehicleRegistrationNo) order.vehicleRegistrationNo = rowRegNo;
    }

    const regForMissingPhone = rowRegNo;
    if (!translated.phone && regForMissingPhone) {
       const resolved = findContactByRegistrationNo(regForMissingPhone);
       if (resolved) translated.phone = resolved.phone;
    }

    if (translated.phone && resolvers[translated.phone]) {
       const mappedResolvers = resolvers[translated.phone];
       for (const [k, action] of Object.entries(mappedResolvers)) {
          if (action === "keep") {
             delete customFields[k];
          } else if (action === "overwrite") {
             // Leave as is, it natively overwrites due to upsert merge order
          } else if (action.startsWith("rename:")) {
             const newKey = action.split(":")[1];
             if (newKey) {
                customFields[newKey] = customFields[k];
                delete customFields[k];
             }
          }
       }
    }
    
    if (Object.keys(customFields).length > 0) {
      registerCustomFields(Object.keys(customFields));
    }

    return {
      firstName: translated.firstName ?? "",
      lastName: translated.lastName ?? "",
      phone: translated.phone ?? "",
      email: translated.email ?? "",
      company: translated.company ?? "",
      labels: translated.labels ? translated.labels.split("|").map((label) => label.trim()).filter(Boolean) : [],
      customFields: {
         ...customFields,
         ...(translated.identification_number ? { identification_number: translated.identification_number } : {}),
         ...(translated.date_joined ? { date_joined: translated.date_joined } : {})
      },
      vehicles: Object.keys(vehicle).length ? [vehicle] : [],
      orders: Object.keys(order).length ? [order] : []
    };
  }).filter((c) => c.phone);

  const segmentIds = typeof req.body.segmentIds === "string" ? req.body.segmentIds.split(",").filter(Boolean) : [];
  const imported = importContacts(parsedContacts, segmentIds, req.body.segmentMode ?? "add");

  const fallbackChannel = listChannels()[0];
  if (fallbackChannel) {
    for (const contact of imported) {
      const newContactAutomations = listAutomations().filter((a) => a.isActive && a.triggerType === "new_contact");
      for (const auto of newContactAutomations) {
        if (auto.version === 'journey') {
           enrollContact(auto.id, contact.id);
        } else {
           enqueueAutomationJob({
             automationId: auto.id,
             contactId: contact.id,
             channelId: auto.channelId!,
             runAt: dayjs().add(auto.delayMinutes || 0, "minute").toISOString(),
             payload: { templateId: auto.templateId! }
           });
        }
      }
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

app.put("/api/templates/:id", requireAuth, (req: SessionRequest, res) => {
  const templateId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!findTemplate(templateId)) return res.status(404).json({ error: "Template not found" });
  
  const template = updateTemplate(templateId, {
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

app.delete("/api/templates/:id", requireAuth, (req: SessionRequest, res) => {
  const templateId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!findTemplate(templateId)) return res.status(404).json({ error: "Template not found" });
  
  deleteTemplate(templateId);
  refreshClients("templates");
  res.json({ ok: true });
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

app.post("/api/templates/sync-approved", requireAuth, async (_req: SessionRequest, res) => {
  const result = await fetchApprovedTemplatesFromTwilio();
  if (!result.synced) {
    return res.status(400).json(result);
  }

  const syncedTemplates = result.templates
    .map((template) =>
      upsertTemplate({
        name: template.name,
        category: template.category,
        body: template.body,
        placeholders: template.placeholders,
        mediaUrl: template.mediaUrl,
        ctaLabel: template.ctaLabel,
        ctaUrl: template.ctaUrl,
        twilioContentSid: template.twilioContentSid
      })
    )
    .filter(Boolean);

  refreshClients("templates");
  return res.json({
    synced: true,
    count: syncedTemplates.length,
    templates: syncedTemplates
  });
});

app.post("/api/campaigns/send", requireAuth, async (req: SessionRequest, res) => {
  try {
    const campaign = createCampaign({
      name: req.body.name,
      templateId: req.body.templateId,
      channelId: req.body.channelId,
      recipientMode: req.body.recipientMode,
      recipientIds: Array.isArray(req.body.recipientIds) ? req.body.recipientIds : [],
      scheduledAt: req.body.scheduledAt ?? null,
      status: req.body.scheduledAt ? "queued" : "sending",
      recurringInterval: req.body.recurringInterval ?? "none",
      recurringUntil: req.body.recurringUntil ?? null,
      metadata: {
        variables: Array.isArray(req.body.variables) ? req.body.variables : undefined,
        headerMediaUrl: req.body.headerMediaUrl ?? undefined,
      }
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
        source: `campaign:${campaign.name}`,
        customVariables: campaign.metadata?.variables,
        mediaUrlOverride: campaign.metadata?.headerMediaUrl
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
  } catch (err: any) {
    console.error("Failed to process campaign POST /api/campaigns/send:", err);
    return res.status(500).json({ error: err.message || "Failed to queue/send campaign" });
  }
});

app.post("/api/conversations/:id/messages/template", requireAuth, async (req: SessionRequest, res) => {
  try {
    const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    
    if (!req.body.templateId) {
    return res.status(400).json({ error: "Missing templateId" });
  }

  const result = await sendTemplateMessage({
    contactId: req.body.contactId,
    channelId: req.body.channelId,
    templateId: req.body.templateId,
    conversationId,
    source: "direct_template",
    customVariables: Array.isArray(req.body.variables) ? req.body.variables : undefined
  });

    return res.json({ success: true, result });
  } catch (err: any) {
    console.error("Failed to send template message:", err);
    return res.status(500).json({ error: err.message || "Failed to send template message" });
  }
});

app.post("/api/automations", requireAuth, (req: SessionRequest, res) => {
  const automation = createAutomation({
    name: req.body.name,
    version: req.body.version || "simple",
    triggerType: req.body.triggerType,
    triggerValue: req.body.triggerValue,
    templateId: req.body.templateId,
    channelId: req.body.channelId,
    segmentId: req.body.segmentId,
    delayMinutes: req.body.delayMinutes !== undefined ? Number(req.body.delayMinutes) : null,
    templateVariables: req.body.templateVariables,
    flowData: req.body.flowData
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

app.put("/api/channels/:id", requireAuth, (req: SessionRequest, res) => {
  const channelId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  updateChannel(channelId, {
    name: req.body.name,
    whatsappNumber: req.body.whatsappNumber,
    messagingServiceSid: req.body.messagingServiceSid
  });
  refreshClients("channels");
  res.json({ ok: true });
});

app.delete("/api/channels/:id", requireAuth, (req: SessionRequest, res) => {
  const channelId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  deleteChannel(channelId);
  refreshClients("channels");
  res.json({ ok: true });
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
    role: req.body.role ?? "agent"
  });
  refreshClients("users");
  res.json({ user });
});

app.put("/api/users/:id", requireAuth, (req: SessionRequest, res) => {
  const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  updateUser(userId, {
    name: req.body.name,
    email: req.body.email,
    role: req.body.role ?? "agent"
  });
  refreshClients("users");
  res.json({ ok: true });
});

app.delete("/api/users/:id", requireAuth, (req: SessionRequest, res) => {
  const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  deleteUser(userId);
  refreshClients("users");
  res.json({ ok: true });
});

app.post("/api/webhooks/twilio/incoming", validateTwilioSignature, async (req, res) => {
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

app.post("/api/webhooks/twilio/status", validateTwilioSignature, (req, res) => {
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

server.listen(port, "0.0.0.0", () => {
  console.log(`WhatsApp center listening on http://0.0.0.0:${port}`);
  
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    fetchApprovedTemplatesFromTwilio()
      .then((result) => {
        if (result.synced) {
          result.templates.forEach((t) => upsertTemplate({
            name: t.name,
            category: t.category,
            body: t.body,
            placeholders: t.placeholders,
            mediaUrl: t.mediaUrl,
            ctaLabel: t.ctaLabel,
            ctaUrl: t.ctaUrl,
            twilioContentSid: t.twilioContentSid
          }));
          console.log(`Synced ${result.templates.length} templates from Twilio`);
        }
      })
      .catch((err) => console.error("Error auto-syncing templates from Twilio", err));
  }
});

// ~~~ BACKGROUND SCHEDULING ENGINE ~~~
let dispatcherInterval = setInterval(() => {
  const allCampaigns = listCampaigns();
  const nowTime = new Date().getTime();

  for (const campaign of allCampaigns) {
    if (campaign.status === "queued" && campaign.scheduledAt) {
      const scheduledTime = new Date(campaign.scheduledAt).getTime();
      
      if (scheduledTime <= nowTime) {
        console.log(`[DISPATCHER] Firing scheduled campaign: ${campaign.id} (${campaign.name})`);
        
        const recipients = resolveCampaignRecipients(campaign);
        const engineStats = { ...campaign.stats };

        for (const recipient of recipients) {
          engineStats.attempted += 1;
          sendTemplateMessage({
            contactId: recipient.id,
            channelId: campaign.channelId,
            templateId: campaign.templateId,
            source: `campaign:${campaign.name}`,
            customVariables: campaign.metadata?.variables,
            mediaUrlOverride: campaign.metadata?.headerMediaUrl
          }).then(() => {
            engineStats.delivered += 1;
            updateCampaignStatus(campaign.id, "sent", engineStats);
            refreshClients("campaign");
          }).catch(err => {
            console.error("Scheduled Campaign delivery fail:", err);
            engineStats.failed += 1;
            updateCampaignStatus(campaign.id, "sent", engineStats);
          });
        }

        // Calculate Recurrences
        if (campaign.recurringInterval && campaign.recurringInterval !== "none") {
          let nextDate = new Date(campaign.scheduledAt);
          if (campaign.recurringInterval === "daily") nextDate.setDate(nextDate.getDate() + 1);
          if (campaign.recurringInterval === "weekly") nextDate.setDate(nextDate.getDate() + 7);
          if (campaign.recurringInterval === "monthly") nextDate.setMonth(nextDate.getMonth() + 1);

          let nextIso = nextDate.toISOString();
          
          if (campaign.recurringUntil) {
            const boundaryTime = new Date(campaign.recurringUntil).getTime();
            if (nextDate.getTime() > boundaryTime) {
              // Reached limit, permanently shut off execution sequence.
              updateCampaignStatus(campaign.id, "completed", engineStats);
            } else {
              // Bump schedule
              import("./db.js").then(({ updateCampaignScheduler }) => {
                updateCampaignScheduler(campaign.id, nextIso, "queued");
              });
            }
          } else {
             import("./db.js").then(({ updateCampaignScheduler }) => {
                updateCampaignScheduler(campaign.id, nextIso, "queued");
             });
          }
        } else {
          // Standard one-off dispatch closure
          updateCampaignStatus(campaign.id, "sent", engineStats);
        }
        refreshClients("campaign");
      }
    }
  }
}, 60000); // Evaluates the pipeline precisely every 60 seconds

function gracefulShutdown(signal: string) {
  console.log(`\n[${signal}] Initiating graceful shutdown sequence...`);
  clearInterval(dispatcherInterval);
  server.close(() => {
    console.log("HTTP server actively closed.");
    process.exit(0);
  });
  
  // Failsafe timeout
  setTimeout(() => {
    console.error("Forcing termination due to hanging resources.");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
