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
  listLandingPages,
  createLandingPage,
  updateLandingPage,
  deleteLandingPage,
  getLandingPageBySlug,
  listSegments,
  updateContactSegments,
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
import { generateLandingPageFromContent } from "./geminiService.js";

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
          variables: automation.templateVariables || [],
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

app.get("/api/landing-pages", requireAuth, (req: SessionRequest, res) => {
  res.json(listLandingPages());
});

app.post("/api/landing-pages", requireAuth, (req: SessionRequest, res) => {
  const page = createLandingPage(req.body);
  refreshClients("landing-pages");
  res.json(page);
});

app.put("/api/landing-pages/:id", requireAuth, (req: SessionRequest, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const page = updateLandingPage(id, req.body);
  refreshClients("landing-pages");
  res.json(page);
});

app.delete("/api/landing-pages/:id", requireAuth, (req: SessionRequest, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  deleteLandingPage(id);
  refreshClients("landing-pages");
  res.json({ ok: true });
});

// ~~~ PUBLIC LANDING PAGES ~~~
app.get("/l/:slug", (req, res) => {
  const page = getLandingPageBySlug(req.params.slug);
  if (!page || !page.isPublished) {
    return res.status(404).send("Page not found");
  }

  // Basic HTML template for the landing page
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${page.title || page.name}</title>
      <meta name="description" content="${page.description || ''}">
      <script src="https://cdn.tailwindcss.com"></script>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap">
      <style>
        body { font-family: 'Outfit', sans-serif; background-color: ${page.theme?.backgroundColor || '#ffffff'}; color: ${page.theme?.textColor || '#000000'}; }
        .primary-btn { background-color: ${page.theme?.primaryColor || '#2563eb'}; color: white; border-radius: 9999px; transition: opacity 0.2s; }
        .primary-btn:hover { opacity: 0.9; }
      </style>
    </head>
    <body class="min-h-screen">
      <main>
        ${page.sections.map((section: any) => {
          if (section.type === 'hero') {
            return `
              <header class="py-20 px-6 text-center">
                <h1 class="text-5xl font-extrabold mb-6" style="color: ${page.theme?.primaryColor || 'inherit'}">${section.title}</h1>
                <p class="text-xl max-w-2xl mx-auto opacity-80">${section.subtitle}</p>
                ${section.cta ? `<div class="mt-10"><a href="#form" class="primary-btn px-10 py-4 font-bold inline-block shadow-lg">${section.cta}</a></div>` : ''}
              </header>
            `;
          }
          if (section.type === 'features') {
            return `
              <section class="py-20 px-6 bg-black/5">
                <div class="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10">
                  ${section.items.map((item: any) => `
                    <div class="p-8 rounded-3xl bg-white shadow-sm">
                      <div class="text-3xl mb-4">${item.icon || '✨'}</div>
                      <h3 class="text-xl font-bold mb-2">${item.title}</h3>
                      <p class="opacity-70">${item.text}</p>
                    </div>
                  `).join('')}
                </div>
              </section>
            `;
          }
          if (section.type === 'pricing') {
            return `
              <section class="py-24 px-6 bg-[#fcfdfd]">
                <div class="max-w-5xl mx-auto">
                  <h2 class="text-4xl font-extrabold text-center mb-16">${section.title}</h2>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-10">
                    ${section.plans.map((plan: any) => `
                      <div class="p-10 rounded-[3rem] border border-black/5 bg-white shadow-xl ${plan.featured ? 'ring-2 ring-blue-500 scale-105 relative' : ''}">
                        ${plan.featured ? '<div class="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-bold px-4 py-1 rounded-full uppercase tracking-widest">Popular</div>' : ''}
                        <h3 class="text-2xl font-bold mb-2">${plan.name}</h3>
                        <div class="text-5xl font-extrabold mb-8" style="color: ${page.theme?.primaryColor || '#000'}">${plan.price}<span class="text-sm font-normal opacity-40 ml-1">/mo</span></div>
                        <ul class="space-y-4 mb-10">
                          ${plan.features.map((f: any) => `
                            <li class="flex items-center gap-3 text-sm opacity-70">
                              <span class="text-blue-600">✓</span> ${f}
                            </li>
                          `).join('')}
                        </ul>
                        <a href="#form" class="primary-btn w-full py-4 font-bold text-center inline-block rounded-2xl shadow-md ${plan.featured ? '' : 'opacity-80'}">Select Plan</a>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </section>
            `;
          }
          if (section.type === 'testimonials') {
            return `
              <section class="py-24 px-6 bg-white border-y border-black/5">
                <div class="max-w-6xl mx-auto">
                  <h2 class="text-4xl font-extrabold text-center mb-16">${section.title}</h2>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-12">
                    ${section.items.map((item: any) => `
                      <div class="p-10 rounded-[2.5rem] bg-slate-50/50 border border-black/5 relative">
                        <div class="text-blue-500 text-4xl font-serif italic mb-6">"</div>
                        <p class="text-xl italic opacity-80 leading-relaxed mb-8">${item.quote}</p>
                        <div class="flex items-center gap-4">
                          <div class="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500">${item.name[0]}</div>
                          <div>
                            <div class="font-bold text-sm text-slate-900">${item.name}</div>
                            <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${item.role || 'Partner'}</div>
                          </div>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </section>
            `;
          }
          if (section.type === 'faq') {
            return `
              <section class="py-24 px-6 bg-slate-50/50">
                <div class="max-w-3xl mx-auto">
                  <h2 class="text-3xl font-extrabold text-center mb-16">${section.title}</h2>
                  <div class="space-y-4">
                    ${section.items.map((item: any) => `
                      <div class="p-8 rounded-[2rem] bg-white border border-black/5 shadow-sm">
                        <h4 class="text-lg font-bold mb-3 flex items-center justify-between">
                          ${item.q}
                          <span class="opacity-20 text-2xl">+</span>
                        </h4>
                        <p class="text-sm opacity-60 leading-relaxed">${item.a}</p>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </section>
            `;
          }
          if (section.type === 'form') {
            return `
              <section id="form" class="py-20 px-6 text-center">
                <div class="max-w-xl mx-auto p-10 rounded-[3rem] border border-black/5 bg-white shadow-xl">
                  <h2 class="text-3xl font-extrabold mb-4">${section.title}</h2>
                  <p class="mb-8 opacity-70">${section.subtitle}</p>
                  <form id="lpForm" class="space-y-4 text-left">
                    ${section.fields.map((field: any) => `
                      <div>
                        <label class="block text-xs font-bold uppercase tracking-wider mb-2 opacity-50">${field.label}</label>
                        <input type="${field.type || 'text'}" name="${field.name}" required class="w-full px-5 py-3 rounded-2xl border border-black/10 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="${field.placeholder || ''}">
                      </div>
                    `).join('')}
                    <button type="submit" class="w-full primary-btn py-4 font-bold mt-6 shadow-md shadow-blue-500/20">Submit</button>
                  </form>
                  <div id="successMsg" class="hidden py-10">
                    <div class="text-5xl mb-4">✅</div>
                    <h3 class="text-2xl font-bold mb-2">Thank you!</h3>
                    <p class="opacity-70">We've received your information and we'll reach out soon.</p>
                  </div>
                </div>
              </section>
            `;
          }
          return '';
        }).join('')}
      </main>
      <footer class="py-10 text-center opacity-40 text-xs">
        <p>&copy; ${new Date().getFullYear()} ${page.name}. Built with TomorrowX.</p>
      </footer>

      <script>
        document.getElementById('lpForm')?.addEventListener('submit', async (e) => {
          e.preventDefault();
          const form = e.target;
          const formData = new FormData(form);
          const data = Object.fromEntries(formData.entries());
          
          const btn = form.querySelector('button');
          btn.disabled = true;
          btn.innerText = 'Submitting...';

          try {
            const resp = await fetch('/api/public/landing-pages/${page.slug}/submit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            if (resp.ok) {
              form.classList.add('hidden');
              document.getElementById('successMsg').classList.remove('hidden');
            } else {
              alert('Something went wrong. Please try again.');
              btn.disabled = false;
              btn.innerText = 'Submit';
            }
          } catch (err) {
            alert('Failed to connect. Please check your internet.');
            btn.disabled = false;
            btn.innerText = 'Submit';
          }
        });
      </script>
    </body>
    </html>
  `;
  res.send(html);
});

app.post("/api/public/landing-pages/:slug/submit", (req, res) => {
  const page = getLandingPageBySlug(req.params.slug);
  if (!page) return res.status(404).json({ error: "Page not found" });

  const data = req.body;
  const phone = data.phone;
  if (!phone) return res.status(400).json({ error: "Phone is required" });

  // 1. Find or create contact using unified upsertContact
  const firstName = data.firstName || data.name || "Unknown";
  const lastName = data.lastName || "";
  const email = data.email || "";

  // Mapping custom fields
  const standardKeys = ["firstName", "lastName", "phone", "email", "name"];
  const customFields: Record<string, string> = { source_landing_page: page.name };
  for (const [key, val] of Object.entries(data)) {
    if (!standardKeys.includes(key)) {
      customFields[key] = String(val);
    }
  }

  const contact = upsertContact({
    firstName,
    lastName,
    phone,
    email,
    company: page.name,
    customFields
  });

  if (!contact) return res.status(500).json({ error: "Failed to process contact" });

  // 2. Add to "Landing Page Leads" segment
  let segment = listSegments().find((s: any) => s.name === "Landing Page Leads");
  if (!segment) {
    segment = createSegment({ name: "Landing Page Leads", color: "#3B82F6" });
  }
  
  if (segment) {
    updateContactSegments(contact.id, [...contact.segmentIds, segment.id]);
  }

  // 3. Trigger automation
  queueAutomationIfNeeded({
    eventType: "segment_joined",
    contactId: contact.id,
    segmentIds: segment ? [...contact.segmentIds, segment.id] : contact.segmentIds,
    body: `Submitted landing page: ${page.name}`
  });

  res.json({ success: true });
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

// ~~~ SMART AI BUILDER API ~~~
app.post("/api/ai/smart-build", async (req, res) => {
  const { name, industry, goal, style, description, sections: userSections, rawContent } = req.body;
  
  const palettes: Record<string, any> = {
    modern: { primaryColor: '#6366f1', backgroundColor: '#ffffff', textColor: '#1e293b' },
    corporate: { primaryColor: '#0f172a', backgroundColor: '#f8fafc', textColor: '#334155' },
    playful: { primaryColor: '#f43f5e', backgroundColor: '#fff7ed', textColor: '#451a03' },
    bold: { primaryColor: '#ffffff', backgroundColor: '#000000', textColor: '#ffffff' },
    minimal: { primaryColor: '#18181b', backgroundColor: '#fafafa', textColor: '#27272a' },
    ocean: { primaryColor: '#0ea5e9', backgroundColor: '#f0f9ff', textColor: '#0c4a6e' }
  };

  const theme = palettes[style] || palettes.modern;

  // Try authentic Gemini generation first if rawContent or description is provided
  if (process.env.GEMINI_API_KEY && (rawContent || description)) {
    try {
      const aiSections = await generateLandingPageFromContent({
        businessName: name,
        industry,
        goal,
        rawContent,
        description
      });

      return res.json({
        name,
        slug: name.toLowerCase().replace(/\s+/g, '-'),
        title: `${name} | Official Website`,
        description: description || `AI Architected for ${name}`,
        sections: aiSections,
        theme,
        isPublished: false
      });
    } catch (err) {
      console.warn("Gemini generation failed, falling back to heuristic/preset logic:", err);
    }
  }

  // Content-first mode: user provided their own sections (Fallback/Manual)
  if (userSections && userSections.length > 0) {

    const enriched = userSections.map((s: any) => {
      if (s.type === 'hero' && !s.subtitle) {
        s.subtitle = description || `Welcome to ${name}. We're here to help.`;
      }
      if (s.type === 'hero' && !s.cta) {
        s.cta = goal === 'lead' ? 'Get Started' : 'Learn More';
      }
      return s;
    });

    return res.json({
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      title: `${name} | Official Website`,
      description: description || `Generated by Smart AI for ${name}`,
      sections: enriched,
      theme,
      isPublished: false
    });
  }

  // Magic Text Generation Mode
  if (rawContent && rawContent.length > 20) {
    const sections: any[] = [];
    
    // Simple heuristic parser for raw text without an LLM:
    const lines = rawContent.split('\n').map((l: string) => l.trim()).filter(Boolean);
    
    let heroTitle = `${name}`;
    let heroSub = description || '';
    
    const bulletPoints = [];
    const quotes = [];
    const questions = [];
    
    // Categorize lines
    for (let i = 0; i < lines.length; i++) {
       const line = lines[i];
       if (i === 0 && line.length < 100 && !line.startsWith('-') && !line.startsWith('*')) {
          heroTitle = line;
       } else if (i === 1 && line.length > 20 && !line.startsWith('-') && !line.startsWith('*') && !heroSub) {
          heroSub = line;
       } else if (line.startsWith('-') || line.startsWith('*')) {
          bulletPoints.push(line.substring(1).trim());
       } else if (line.includes('"') || line.includes('\u201c')) {
          quotes.push(line.replace(/["\u201c\u201d]/g, '').trim());
       } else if (line.endsWith('?')) {
          questions.push(line);
       }
    }

    if (!heroSub && lines.length > 2) {
       heroSub = lines[2];
    }

    // Assembly
    sections.push({
      type: 'hero',
      title: heroTitle,
      subtitle: heroSub,
      cta: goal === 'lead' ? 'Start Free Trial' : 'Learn More',
      layout: 'standard'
    });

    if (bulletPoints.length > 0) {
      sections.push({
        type: 'features',
        title: 'Highlights',
        items: bulletPoints.map((bp) => ({
          icon: '✨',
          title: bp.split(':')[0] || 'Feature',
          text: bp.includes(':') ? bp.split(':').slice(1).join(':').trim() : bp
        })),
        layout: 'grid'
      });
    } else {
      // If no bullet points, split remaining text artificially
      const remaining = lines.slice(2).filter((l: string) => !l.includes('"') && !l.endsWith('?')).slice(0, 3);
      if (remaining.length > 0) {
        sections.push({
          type: 'features',
          title: 'What we offer',
          items: remaining.map((rem: string) => ({
            icon: '💡',
            title: rem.substring(0, 20) + '...',
            text: rem
          })),
          layout: 'centered'
        });
      }
    }

    if (quotes.length > 0) {
      sections.push({
        type: 'testimonials',
        title: 'What People Say',
        items: quotes.slice(0, 3).map((q) => ({
          name: 'Customer',
          role: 'Verified Client',
          quote: q
        }))
      });
    }

    if (questions.length > 0) {
      sections.push({
        type: 'faq',
        title: 'FAQ',
        items: questions.slice(0, 3).map((q) => ({
          q: q,
          a: 'We have all the answers you need. Contact us to learn more.'
        }))
      });
    }

    if (goal === 'lead') {
      sections.push({
        type: 'form',
        title: 'Get Started Today',
        subtitle: 'Leave your details and our team will be in touch.',
        fields: [
          { label: 'Name', name: 'name', type: 'text', placeholder: 'Your Name' },
          { label: 'WhatsApp', name: 'phone', type: 'tel', placeholder: '+1 234...' }
        ]
      });
    }

    return res.json({
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      title: `${name} | Official Website`,
      description: description || `Generated by Smart AI for ${name}`,
      sections,
      theme,
      isPublished: false
    });
  }

  // Fallback: AI-generated content based on industry
  const industryDetails: Record<string, any> = {
    coffee: {
      hero: { title: `${name}: Artisan Energy to Your Door`, sub: 'Premium beans sourced directly from sustainable farms.' },
      features: [
        { icon: '☕', title: 'Freshly Roasted', text: 'Roasted in small batches daily.' },
        { icon: '🚚', title: 'Local Delivery', text: 'Free delivery within 24 hours.' }
      ]
    },
    saas: {
      hero: { title: `Scale ${name} with Intelligent Automation`, sub: 'The only platform built for high-performance teams.' },
      features: [
        { icon: '⚡', title: 'Lightning Rapid', text: 'Sub-millisecond API response times.' },
        { icon: '🛡️', title: 'Enterprise Secure', text: 'SOC2 Type II certified infrastructure.' }
      ]
    },
    legal: {
      hero: { title: `${name}: Expert Guidance When It Matters`, sub: 'Dedicated legal support for businesses and individuals.' },
      features: [
        { icon: '⚖️', title: 'Proven Results', text: 'Over $100M recovered for our clients.' },
        { icon: '📞', title: '24/7 Support', text: 'Expert consulting available around the clock.' }
      ]
    },
    ecommerce: {
      hero: { title: `${name}: Shop the Future`, sub: 'Premium products curated for modern lifestyles.' },
      features: [
        { icon: '🛒', title: 'Easy Checkout', text: 'Streamlined purchasing in under 60 seconds.' },
        { icon: '📦', title: 'Fast Shipping', text: 'Same-day dispatch on all orders.' }
      ]
    },
    restaurant: {
      hero: { title: `${name}: Where Every Bite Tells a Story`, sub: 'Fresh ingredients, bold flavors, unforgettable experiences.' },
      features: [
        { icon: '🍽️', title: 'Farm to Table', text: 'Locally sourced, seasonally inspired menus.' },
        { icon: '📱', title: 'Easy Reservations', text: 'Book your table in seconds via WhatsApp.' }
      ]
    },
    fitness: {
      hero: { title: `${name}: Transform Your Body & Mind`, sub: 'Science-backed programs for lasting programs.' },
      features: [
        { icon: '💪', title: 'Expert Coaches', text: 'Certified trainers with 10+ years experience.' },
        { icon: '📊', title: 'Progress Tracking', text: 'Real-time analytics on your fitness journey.' }
      ]
    },
    education: {
      hero: { title: `${name}: Learn Without Limits`, sub: 'World-class courses designed for the modern learner.' },
      features: [
        { icon: '🎓', title: 'Certified Programs', text: 'Industry-recognized certifications on completion.' },
        { icon: '🌍', title: 'Learn Anywhere', text: 'Access content on any device, anytime.' }
      ]
    },
    agency: {
      hero: { title: `${name}: We Build Brands That Matter`, sub: 'Strategy, design, and execution under one roof.' },
      features: [
        { icon: '🎨', title: 'Creative Excellence', text: 'Award-winning design and branding.' },
        { icon: '📈', title: 'Growth Focused', text: 'Data-driven campaigns that deliver ROI.' }
      ]
    }
  };

  const niche = industryDetails[industry] || industryDetails.saas;

  const sections: any[] = [
    { type: 'hero', title: niche.hero.title, subtitle: niche.hero.sub, cta: goal === 'lead' ? 'Start Free Trial' : 'Book Consultation' },
    { type: 'features', title: 'Why Choose Us', items: niche.features },
    { type: 'testimonials', title: 'Our Happy Clients', items: [
      { name: 'Alex Johnson', role: 'Ops Lead', quote: 'Absolutely game changing for our workflow.' },
      { name: 'Maria Garcia', role: 'Founder', quote: 'The ROI was visible within the first week.' }
    ]},
    { type: 'faq', title: 'Common Questions', items: [
      { q: `Is ${name} right for me?`, a: 'If you value speed and quality, then yes.' },
      { q: 'Can I cancel anytime?', a: 'Of course, we offer flexible month-to-month plans.' }
    ]}
  ];

  if (goal === 'lead') {
    sections.push({
      type: 'form',
      title: 'Get Started Today',
      subtitle: 'Leave your details and our team will be in touch.',
      fields: [
        { label: 'Name', name: 'name', type: 'text', placeholder: 'Your Name' },
        { label: 'WhatsApp', name: 'phone', type: 'tel', placeholder: '+1 234...' }
      ]
    });
  }

  res.json({
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    title: `${name} | Official Website`,
    description: description || `Generated by Smart AI for ${name}`,
    sections,
    theme,
    isPublished: false
  });
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
