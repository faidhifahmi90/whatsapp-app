import Twilio from "twilio";
import type { Channel, Contact, Template } from "../src/types.js";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const defaultMessagingServiceSid = process.env.TWILIO_DEFAULT_MESSAGING_SERVICE_SID;
const contentApiBase = process.env.TWILIO_CONTENT_API_BASE ?? "https://content.twilio.com/v1/Content";

const client = accountSid && authToken ? Twilio(accountSid, authToken) : null;

export function renderTemplate(
  template: Pick<Template, "body" | "placeholders">,
  contact: Pick<Contact, "firstName" | "lastName" | "phone" | "email" | "company" | "customFields">
) {
  const values: Record<string, string> = {
    first_name: contact.firstName,
    last_name: contact.lastName,
    phone: contact.phone,
    email: contact.email ?? "",
    company: contact.company ?? "",
    ...contact.customFields
  };

  return template.body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => values[key] ?? "");
}

export function buildContentVariables(
  template: Pick<Template, "placeholders">,
  contact: Pick<Contact, "firstName" | "lastName" | "phone" | "email" | "company" | "customFields">
) {
  const values: Record<string, string> = {
    first_name: contact.firstName,
    last_name: contact.lastName,
    phone: contact.phone,
    email: contact.email ?? "",
    company: contact.company ?? "",
    ...contact.customFields
  };

  return JSON.stringify(
    Object.fromEntries(
      template.placeholders.map((placeholder, index) => [String(index + 1), values[placeholder] ?? ""])
    )
  );
}

export async function sendWhatsAppMessage(options: {
  channel: Channel;
  contact: Contact;
  body: string;
  mediaUrl?: string | null;
  contentSid?: string | null;
  contentVariables?: string | null;
}) {
  if (!client) {
    return {
      sid: `SIMULATED_${Date.now()}`,
      status: "simulated"
    };
  }

  const from = options.channel.whatsappNumber.startsWith("whatsapp:")
    ? options.channel.whatsappNumber
    : `whatsapp:${options.channel.whatsappNumber}`;
  const to = options.contact.phone.startsWith("whatsapp:")
    ? options.contact.phone
    : `whatsapp:${options.contact.phone}`;

  const payload: Record<string, unknown> = {
    to
  };

  if (options.channel.messagingServiceSid || defaultMessagingServiceSid) {
    payload.messagingServiceSid = options.channel.messagingServiceSid ?? defaultMessagingServiceSid;
  } else {
    payload.from = from;
  }

  if (options.contentSid) {
    payload.contentSid = options.contentSid;
    if (options.contentVariables) {
      payload.contentVariables = options.contentVariables;
    }
  } else {
    payload.body = options.body;
    if (options.mediaUrl) {
      payload.mediaUrl = [options.mediaUrl];
    }
  }

  const message = await client.messages.create(payload as any);
  return {
    sid: message.sid,
    status: message.status ?? "queued"
  };
}

export async function syncTemplateToTwilioContent(template: Template) {
  if (!accountSid || !authToken) {
    return {
      sid: null,
      synced: false,
      reason: "Missing Twilio credentials"
    };
  }

  const body = {
    friendly_name: template.name,
    language: "en",
    variables: Object.fromEntries(template.placeholders.map((placeholder, index) => [String(index + 1), placeholder])),
    types: {
      "twilio/text": {
        body: template.body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, _key, offset, input) => {
          const found = [...input.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)];
          const currentIndex = found.findIndex((item) => item.index === offset);
          return `{{${currentIndex + 1}}}`;
        })
      }
    }
  };

  const response = await fetch(contentApiBase, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    return {
      sid: null,
      synced: false,
      reason: text
    };
  }

  const json = (await response.json()) as { sid?: string };
  return {
    sid: json.sid ?? null,
    synced: Boolean(json.sid)
  };
}
