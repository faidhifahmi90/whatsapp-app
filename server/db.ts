import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type {
  Automation,
  BootstrapData,
  Campaign,
  Channel,
  Contact,
  Conversation,
  Message,
  Segment,
  Template,
  User
} from "../src/types.js";

const dbPath = resolve(process.cwd(), "data", "whatsapp-center.sqlite");
mkdirSync(dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

type DbContactRow = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  company: string | null;
  labels_json: string | null;
  custom_fields_json: string | null;
  created_at: string;
};

type DbTemplateRow = {
  id: string;
  name: string;
  category: string;
  body: string;
  placeholders_json: string | null;
  media_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  twilio_content_sid: string | null;
};

function now() {
  return new Date().toISOString();
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapUser(row: any): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role
  };
}

function mapChannel(row: any): Channel {
  return {
    id: row.id,
    name: row.name,
    whatsappNumber: row.whatsapp_number,
    messagingServiceSid: row.messaging_service_sid,
    status: row.status
  };
}

function mapSegment(row: any): Segment {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at
  };
}

function mapTemplate(row: DbTemplateRow): Template {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    body: row.body,
    placeholders: parseJson<string[]>(row.placeholders_json, []),
    mediaUrl: row.media_url,
    ctaLabel: row.cta_label,
    ctaUrl: row.cta_url,
    twilioContentSid: row.twilio_content_sid
  };
}

function mapContact(row: DbContactRow): Contact {
  const segmentRows = db
    .prepare(
      `select segment_id from contact_segments
       where contact_id = ?`
    )
    .all(row.id) as Array<{ segment_id: string }>;

  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    email: row.email,
    company: row.company,
    labels: parseJson<string[]>(row.labels_json, []),
    customFields: parseJson<Record<string, string>>(row.custom_fields_json, {}),
    segmentIds: segmentRows.map((segment) => segment.segment_id),
    createdAt: row.created_at
  };
}

function mapMessage(row: any): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    channelId: row.channel_id,
    direction: row.direction,
    body: row.body,
    mediaUrl: row.media_url,
    status: row.status,
    templateId: row.template_id,
    twilioMessageSid: row.twilio_message_sid,
    twilioContentSid: row.twilio_content_sid,
    createdAt: row.created_at,
    metadata: parseJson<Record<string, unknown>>(row.metadata_json, {})
  };
}

export function initDb() {
  db.exec(`
    create table if not exists users (
      id text primary key,
      name text not null,
      email text not null unique,
      password_hash text not null,
      role text not null,
      created_at text not null
    );

    create table if not exists channels (
      id text primary key,
      name text not null,
      whatsapp_number text not null,
      messaging_service_sid text,
      status text not null default 'active',
      created_at text not null
    );

    create table if not exists segments (
      id text primary key,
      name text not null unique,
      color text not null,
      created_at text not null
    );

    create table if not exists contacts (
      id text primary key,
      first_name text not null,
      last_name text not null,
      phone text not null unique,
      email text,
      company text,
      labels_json text,
      custom_fields_json text,
      created_at text not null,
      updated_at text not null
    );

    create table if not exists contact_segments (
      contact_id text not null,
      segment_id text not null,
      primary key (contact_id, segment_id)
    );

    create table if not exists templates (
      id text primary key,
      name text not null unique,
      category text not null,
      body text not null,
      placeholders_json text,
      media_url text,
      cta_label text,
      cta_url text,
      twilio_content_sid text,
      created_at text not null
    );

    create table if not exists conversations (
      id text primary key,
      contact_id text not null,
      channel_id text not null,
      status text not null default 'open',
      created_at text not null,
      updated_at text not null,
      last_message_at text not null
    );

    create table if not exists messages (
      id text primary key,
      conversation_id text not null,
      channel_id text not null,
      direction text not null,
      body text not null,
      media_url text,
      status text not null,
      template_id text,
      twilio_message_sid text,
      twilio_content_sid text,
      metadata_json text,
      created_at text not null
    );

    create table if not exists campaigns (
      id text primary key,
      name text not null,
      template_id text not null,
      channel_id text not null,
      recipient_mode text not null,
      recipient_ids_json text not null,
      status text not null,
      scheduled_at text,
      stats_json text,
      recurring_interval text not null default 'none',
      recurring_until text,
      metadata_json text,
      created_at text not null
    );

    create table if not exists automations (
      id text primary key,
      name text not null,
      trigger_type text not null,
      trigger_value text,
      template_id text not null,
      channel_id text not null,
      segment_id text,
      delay_minutes integer not null default 0,
      is_active integer not null default 1,
      created_at text not null
    );

    create table if not exists automation_jobs (
      id text primary key,
      automation_id text not null,
      contact_id text not null,
      channel_id text not null,
      run_at text not null,
      payload_json text,
      status text not null,
      created_at text not null
    );
  `);

  // Migrations for existing databases
  try {
    db.prepare(`alter table campaigns add column created_at text not null default CURRENT_TIMESTAMP`).run();
  } catch (e) {}
  try {
    db.prepare(`alter table campaigns add column recurring_interval text not null default 'none'`).run();
  } catch (e) {}
  try {
    db.prepare(`alter table campaigns add column recurring_until text`).run();
  } catch (e) {}
  try {
    db.prepare(`alter table campaigns add column metadata_json text`).run();
  } catch (e) {}

  seedIfEmpty();
  cleanupDummyData();
}

function cleanupDummyData() {
  db.prepare("delete from contacts where first_name = 'Sarah' and email = 'sarah@example.com'").run();
  db.prepare("delete from templates where name like 'Demo:%'").run();
  db.prepare("delete from campaigns where name like 'Seasonal Promo%' or name like 'Beta Users%'").run();
}

function seedIfEmpty() {
  const userCount = db.prepare("select count(*) as count from users").get() as { count: number };
  if (userCount.count > 0) {
    return;
  }

  const createdAt = now();
  const adminId = randomUUID();

  db.prepare(
    "insert into users (id, name, email, password_hash, role, created_at) values (?, ?, ?, ?, ?, ?)"
  ).run(adminId, "Master Admin", "faidhifahmi@gmail.com", "", "owner", createdAt);
}

export function getUserByEmail(email: string) {
  const row = db.prepare("select * from users where email = ?").get(email) as any;
  return row ? mapUser(row) : null;
}

export function getUserForSession(id: string) {
  const row = db.prepare("select id, name, email, role from users where id = ?").get(id);
  return row ? mapUser(row) : null;
}

export function createUser(input: { name: string; email: string; role: string }) {
  const id = randomUUID();
  db.prepare(
    "insert into users (id, name, email, password_hash, role, created_at) values (?, ?, ?, ?, ?, ?)"
  ).run(id, input.name, input.email, "", input.role, now());
  return getUserForSession(id);
}

export function listUsers() {
  return (db.prepare("select id, name, email, role from users order by created_at asc").all() as any[]).map(mapUser);
}

export function updateUser(id: string, input: { name: string; email: string; role: string }) {
  db.prepare(
    `update users set name = ?, email = ?, role = ? where id = ?`
  ).run(input.name, input.email, input.role, id);
  return getUserForSession(id);
}

export function deleteUser(id: string) {
  db.prepare("delete from users where id = ?").run(id);
}

export function listChannels() {
  return (db.prepare("select * from channels order by created_at asc").all() as any[]).map(mapChannel);
}

export function createChannel(input: { name: string; whatsappNumber: string; messagingServiceSid?: string | null }) {
  const id = randomUUID();
  db.prepare(
    `insert into channels (id, name, whatsapp_number, messaging_service_sid, status, created_at)
     values (?, ?, ?, ?, ?, ?)`
  ).run(id, input.name, input.whatsappNumber, input.messagingServiceSid ?? null, "active", now());
  return listChannels();
}

export function updateChannel(id: string, input: { name: string; whatsappNumber: string; messagingServiceSid?: string | null }) {
  db.prepare(
    `update channels set name = ?, whatsapp_number = ?, messaging_service_sid = ? where id = ?`
  ).run(input.name, input.whatsappNumber, input.messagingServiceSid ?? null, id);
  return findChannel(id);
}

export function deleteChannel(id: string) {
  db.prepare("delete from channels where id = ?").run(id);
}

export function listSegments() {
  return (db.prepare("select * from segments order by created_at asc").all() as any[]).map(mapSegment);
}

export function createSegment(input: { name: string; color: string }) {
  const id = randomUUID();
  db.prepare("insert into segments (id, name, color, created_at) values (?, ?, ?, ?)").run(
    id,
    input.name,
    input.color,
    now()
  );
  return listSegments();
}

export function listContacts() {
  return (db.prepare("select * from contacts order by updated_at desc").all() as DbContactRow[]).map(mapContact);
}

export function findContact(id: string) {
  const row = db.prepare("select * from contacts where id = ?").get(id) as DbContactRow | undefined;
  return row ? mapContact(row) : null;
}

export function findContactByPhone(phone: string) {
  const normalized = phone.replace(/^whatsapp:/, "");
  const row = db.prepare("select * from contacts where phone = ?").get(normalized) as DbContactRow | undefined;
  return row ? mapContact(row) : null;
}

function mutateSegments(contactId: string, segmentIds: string[], mode: "add" | "replace" | "remove") {
  const insert = db.prepare("insert or ignore into contact_segments (contact_id, segment_id) values (?, ?)");
  const remove = db.prepare("delete from contact_segments where contact_id = ? and segment_id = ?");

  if (mode === "replace") {
    db.prepare("delete from contact_segments where contact_id = ?").run(contactId);
  }

  for (const segmentId of segmentIds) {
    if (mode === "remove") {
      remove.run(contactId, segmentId);
    } else {
      insert.run(contactId, segmentId);
    }
  }
}

export function upsertContact(input: {
  id?: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  company?: string | null;
  labels?: string[];
  customFields?: Record<string, string>;
  segmentIds?: string[];
  segmentMode?: "add" | "replace" | "remove";
}) {
  const existingRaw = db.prepare("select * from contacts where phone = ?").get(input.phone) as any;
  const existing = existingRaw ? mapContact(existingRaw) : null;
  const id = input.id ?? existing?.id ?? randomUUID();
  const timestamp = now();

  if (existing) {
    db.prepare(
      `update contacts
       set first_name = ?, last_name = ?, email = ?, company = ?, labels_json = ?, custom_fields_json = ?, updated_at = ?
       where id = ?`
    ).run(
      existing.firstName || input.firstName,
      existing.lastName || input.lastName,
      existing.email || input.email || null,
      existing.company || input.company || null,
      JSON.stringify([ ...new Set([...existing.labels, ...(input.labels ?? [])]) ]),
      JSON.stringify({ ...(input.customFields ?? {}), ...existing.customFields }),
      timestamp,
      id
    );
  } else {
    db.prepare(
      `insert into contacts
        (id, first_name, last_name, phone, email, company, labels_json, custom_fields_json, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.firstName,
      input.lastName,
      input.phone,
      input.email ?? null,
      input.company ?? null,
      JSON.stringify(input.labels ?? []),
      JSON.stringify(input.customFields ?? {}),
      timestamp,
      timestamp
    );
  }

  mutateSegments(id, input.segmentIds ?? [], input.segmentMode ?? "replace");
  return findContact(id);
}

export function importContacts(
  contacts: Array<{
    firstName: string;
    lastName: string;
    phone: string;
    email?: string | null;
    company?: string | null;
    labels?: string[];
    customFields?: Record<string, string>;
  }>,
  segmentIds: string[],
  segmentMode: "add" | "replace" | "remove"
) {
  const imported: Contact[] = [];
  for (const contact of contacts) {
    const saved = upsertContact({
      ...contact,
      labels: contact.labels ?? [],
      customFields: contact.customFields ?? {},
      segmentIds,
      segmentMode
    });
    if (saved) {
      imported.push(saved);
    }
  }
  return imported;
}

export function listTemplates() {
  return (db.prepare("select * from templates order by created_at desc").all() as DbTemplateRow[]).map(mapTemplate);
}

export function findTemplate(id: string) {
  const row = db.prepare("select * from templates where id = ?").get(id) as DbTemplateRow | undefined;
  return row ? mapTemplate(row) : null;
}

export function createTemplate(input: {
  name: string;
  category: string;
  body: string;
  placeholders: string[];
  mediaUrl?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}) {
  const id = randomUUID();
  db.prepare(
    `insert into templates
      (id, name, category, body, placeholders_json, media_url, cta_label, cta_url, twilio_content_sid, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.name,
    input.category,
    input.body,
    JSON.stringify(input.placeholders),
    input.mediaUrl ?? null,
    input.ctaLabel ?? null,
    input.ctaUrl ?? null,
    null,
    now()
  );
  return findTemplate(id);
}

export function upsertTemplate(input: {
  name: string;
  category: string;
  body: string;
  placeholders: string[];
  mediaUrl?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  twilioContentSid?: string | null;
}) {
  const existingBySid = input.twilioContentSid
    ? (db.prepare("select * from templates where twilio_content_sid = ?").get(input.twilioContentSid) as DbTemplateRow | undefined)
    : undefined;
  const existingByName = db.prepare("select * from templates where name = ?").get(input.name) as DbTemplateRow | undefined;
  const existing = existingBySid ?? existingByName;

  if (!existing) {
    const created = createTemplate({
      name: input.name,
      category: input.category,
      body: input.body,
      placeholders: input.placeholders,
      mediaUrl: input.mediaUrl,
      ctaLabel: input.ctaLabel,
      ctaUrl: input.ctaUrl
    });
    if (created && input.twilioContentSid) {
      updateTemplateTwilioSid(created.id, input.twilioContentSid);
      return findTemplate(created.id);
    }
    return created;
  }

  db.prepare(
    `update templates
        set name = ?,
            category = ?,
            body = ?,
            placeholders_json = ?,
            media_url = ?,
            cta_label = ?,
            cta_url = ?,
            twilio_content_sid = ?
      where id = ?`
  ).run(
    input.name,
    input.category,
    input.body,
    JSON.stringify(input.placeholders),
    input.mediaUrl ?? null,
    input.ctaLabel ?? null,
    input.ctaUrl ?? null,
    input.twilioContentSid ?? existing.twilio_content_sid,
    existing.id
  );

  return findTemplate(existing.id);
}

export function updateTemplateTwilioSid(templateId: string, sid: string) {
  db.prepare("update templates set twilio_content_sid = ? where id = ?").run(sid, templateId);
  return findTemplate(templateId);
}

export function updateTemplate(id: string, input: {
  name: string;
  category: string;
  body: string;
  placeholders: string[];
  mediaUrl?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}) {
  db.prepare(
    `update templates
        set name = ?,
            category = ?,
            body = ?,
            placeholders_json = ?,
            media_url = ?,
            cta_label = ?,
            cta_url = ?
      where id = ?`
  ).run(
    input.name,
    input.category,
    input.body,
    JSON.stringify(input.placeholders),
    input.mediaUrl ?? null,
    input.ctaLabel ?? null,
    input.ctaUrl ?? null,
    id
  );
  return findTemplate(id);
}

export function deleteTemplate(id: string) {
  db.prepare("delete from templates where id = ?").run(id);
}

export function openConversation(contactId: string, channelId: string) {
  const existing = db
    .prepare("select * from conversations where contact_id = ? and channel_id = ?")
    .get(contactId, channelId) as any;
  if (existing) {
    return existing.id as string;
  }
  const id = randomUUID();
  const timestamp = now();
  db.prepare(
    `insert into conversations
      (id, contact_id, channel_id, status, created_at, updated_at, last_message_at)
     values (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, contactId, channelId, "open", timestamp, timestamp, timestamp);
  return id;
}

export function addMessage(input: {
  conversationId: string;
  channelId: string;
  direction: "inbound" | "outbound";
  body: string;
  mediaUrl?: string | null;
  status: string;
  templateId?: string | null;
  twilioMessageSid?: string | null;
  twilioContentSid?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const id = randomUUID();
  const timestamp = now();
  db.prepare(
    `insert into messages
      (id, conversation_id, channel_id, direction, body, media_url, status, template_id, twilio_message_sid, twilio_content_sid, metadata_json, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.conversationId,
    input.channelId,
    input.direction,
    input.body,
    input.mediaUrl ?? null,
    input.status,
    input.templateId ?? null,
    input.twilioMessageSid ?? null,
    input.twilioContentSid ?? null,
    JSON.stringify(input.metadata ?? {}),
    timestamp
  );

  db.prepare("update conversations set updated_at = ?, last_message_at = ? where id = ?").run(
    timestamp,
    timestamp,
    input.conversationId
  );

  const row = db.prepare("select * from messages where id = ?").get(id);
  return mapMessage(row);
}

export function updateMessageStatus(messageSid: string, status: string) {
  db.prepare("update messages set status = ? where twilio_message_sid = ?").run(status, messageSid);
}

export function listConversations(): Conversation[] {
  const channels = new Map(listChannels().map((channel) => [channel.id, channel]));
  const contacts = new Map(listContacts().map((contact) => [contact.id, contact]));
  const messages = (db.prepare("select * from messages order by created_at asc").all() as any[]).map(mapMessage);
  const messagesByConversation = new Map<string, Message[]>();

  for (const message of messages) {
    const existing = messagesByConversation.get(message.conversationId) ?? [];
    existing.push(message);
    messagesByConversation.set(message.conversationId, existing);
  }

  const rows = db
    .prepare("select * from conversations order by updated_at desc")
    .all() as Array<{ id: string; contact_id: string; channel_id: string; status: string; updated_at: string; last_message_at: string }>;

  return rows
    .map((row) => {
      const contact = contacts.get(row.contact_id);
      const channel = channels.get(row.channel_id);
      if (!contact || !channel) {
        return null;
      }
      return {
        id: row.id,
        contactId: row.contact_id,
        channelId: row.channel_id,
        status: row.status,
        updatedAt: row.updated_at,
        lastMessageAt: row.last_message_at,
        contact,
        channel,
        messages: messagesByConversation.get(row.id) ?? []
      } satisfies Conversation;
    })
    .filter(Boolean) as Conversation[];
}

export function findChannel(id: string) {
  return listChannels().find((channel) => channel.id === id) ?? null;
}

export function findChannelByNumber(number: string) {
  const normalized = number.replace(/^whatsapp:/, "");
  return (
    listChannels().find((channel) => channel.whatsappNumber.replace(/^whatsapp:/, "") === normalized) ?? listChannels()[0] ?? null
  );
}

export function listCampaigns(): Campaign[] {
  return (db.prepare("select * from campaigns order by created_at desc").all() as any[]).map((row) => ({
    id: row.id,
    name: row.name,
    templateId: row.template_id,
    channelId: row.channel_id,
    recipientMode: row.recipient_mode,
    recipientIds: parseJson<string[]>(row.recipient_ids_json, []),
    status: row.status,
    scheduledAt: row.scheduled_at,
    stats: parseJson(row.stats_json, { attempted: 0, delivered: 0, failed: 0 }),
    recurringInterval: row.recurring_interval,
    recurringUntil: row.recurring_until,
    metadata: row.metadata_json ? parseJson(row.metadata_json, {}) : undefined,
    createdAt: row.created_at
  }));
}

export function createCampaign(input: {
  name: string;
  templateId: string;
  channelId: string;
  recipientMode: "segments" | "contacts" | "mixed";
  recipientIds: string[];
  scheduledAt?: string | null;
  status: string;
  recurringInterval: "none" | "daily" | "weekly" | "monthly";
  recurringUntil?: string | null;
  metadata?: {
    variables?: string[];
    headerMediaUrl?: string;
  };
}) {
  const id = randomUUID();
  db.prepare(
    `insert into campaigns
      (id, name, template_id, channel_id, recipient_mode, recipient_ids_json, status, scheduled_at, stats_json, recurring_interval, recurring_until, metadata_json, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.name,
    input.templateId,
    input.channelId,
    input.recipientMode,
    JSON.stringify(input.recipientIds),
    input.status,
    input.scheduledAt ?? null,
    JSON.stringify({ attempted: 0, delivered: 0, failed: 0 }),
    input.recurringInterval,
    input.recurringUntil ?? null,
    input.metadata ? JSON.stringify(input.metadata) : null,
    now()
  );
  return listCampaigns().find((c) => c.id === id) ?? listCampaigns()[0];
}

export function updateCampaignScheduler(campaignId: string, nextScheduledAt: string | null, status: string) {
  db.prepare("update campaigns set scheduled_at = ?, status = ? where id = ?").run(
    nextScheduledAt,
    status,
    campaignId
  );
}

export function updateCampaignStatus(campaignId: string, status: string, stats: Campaign["stats"]) {
  db.prepare("update campaigns set status = ?, stats_json = ? where id = ?").run(
    status,
    JSON.stringify(stats),
    campaignId
  );
}

export function resolveCampaignRecipients(campaign: Campaign) {
  const contacts = listContacts();
  if (campaign.recipientMode === "contacts") {
    return contacts.filter((contact) => campaign.recipientIds.includes(contact.id));
  }
  const targetIds = new Set<string>();
  if (campaign.recipientMode === "segments" || campaign.recipientMode === "mixed") {
    for (const contact of contacts) {
      if (contact.segmentIds.some((segmentId) => campaign.recipientIds.includes(segmentId))) {
        targetIds.add(contact.id);
      }
    }
  }
  if (campaign.recipientMode === "mixed") {
    for (const contactId of campaign.recipientIds) {
      targetIds.add(contactId);
    }
  }
  return contacts.filter((contact) => targetIds.has(contact.id));
}

export function listAutomations(): Automation[] {
  return (db.prepare("select * from automations order by created_at desc").all() as any[]).map((row) => ({
    id: row.id,
    name: row.name,
    triggerType: row.trigger_type,
    triggerValue: row.trigger_value,
    templateId: row.template_id,
    channelId: row.channel_id,
    segmentId: row.segment_id,
    delayMinutes: row.delay_minutes,
    isActive: Boolean(row.is_active)
  }));
}

export function createAutomation(input: {
  name: string;
  triggerType: "incoming_keyword" | "new_contact" | "segment_joined";
  triggerValue?: string | null;
  templateId: string;
  channelId: string;
  segmentId?: string | null;
  delayMinutes: number;
}) {
  const id = randomUUID();
  db.prepare(
    `insert into automations
      (id, name, trigger_type, trigger_value, template_id, channel_id, segment_id, delay_minutes, is_active, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.name,
    input.triggerType,
    input.triggerValue ?? null,
    input.templateId,
    input.channelId,
    input.segmentId ?? null,
    input.delayMinutes,
    1,
    now()
  );
  return listAutomations()[0];
}

export function enqueueAutomationJob(input: {
  automationId: string;
  contactId: string;
  channelId: string;
  runAt: string;
  payload?: Record<string, unknown>;
}) {
  db.prepare(
    `insert into automation_jobs
      (id, automation_id, contact_id, channel_id, run_at, payload_json, status, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    input.automationId,
    input.contactId,
    input.channelId,
    input.runAt,
    JSON.stringify(input.payload ?? {}),
    "queued",
    now()
  );
}

export function listDueAutomationJobs() {
  return db
    .prepare(
      `select * from automation_jobs
       where status = 'queued' and run_at <= ?
       order by run_at asc`
    )
    .all(now()) as any[];
}

export function markAutomationJob(jobId: string, status: string) {
  db.prepare("update automation_jobs set status = ? where id = ?").run(status, jobId);
}

export function getAutomation(id: string) {
  return listAutomations().find((automation) => automation.id === id) ?? null;
}

export function getBootstrapData(userId: string): BootstrapData {
  const contacts = listContacts();
  const conversations = listConversations();
  return {
    user: getUserForSession(userId)!,
    stats: {
      unreadCount: conversations.filter((conversation) =>
        conversation.messages.some((message) => message.direction === "inbound" && message.status !== "read")
      ).length,
      contactCount: contacts.length,
      conversationCount: conversations.length,
      templateCount: listTemplates().length
    },
    channels: listChannels(),
    segments: listSegments(),
    contacts,
    templates: listTemplates(),
    conversations,
    campaigns: listCampaigns(),
    automations: listAutomations(),
    users: listUsers()
  };
}

export function findCampaign(id: string) {
  return listCampaigns().find((campaign) => campaign.id === id) ?? null;
}
