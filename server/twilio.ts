import Twilio from "twilio";
import type { Channel, Contact, Template } from "../src/types.js";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const defaultMessagingServiceSid = process.env.TWILIO_DEFAULT_MESSAGING_SERVICE_SID;
const contentApiBase = process.env.TWILIO_CONTENT_API_BASE ?? "https://content.twilio.com/v1/Content";

const client = accountSid && authToken ? Twilio(accountSid, authToken) : null;

type TwilioContentTemplate = {
  sid: string;
  friendly_name: string;
  variables?: Record<string, string>;
  types?: Record<string, any>;
};

function collectPlaceholderTokens(body: string) {
  return [...body.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((match) => match[1]);
}

function uniquePlaceholders(tokens: string[]) {
  return [...new Set(tokens)];
}

function getContactValues(contact: Pick<Contact, "firstName" | "lastName" | "phone" | "email" | "company" | "customFields">) {
  return {
    first_name: contact.firstName,
    last_name: contact.lastName,
    name: `${contact.firstName} ${contact.lastName}`.trim(),
    customer_name: contact.firstName,
    customer: contact.firstName,
    phone: contact.phone,
    email: contact.email ?? "",
    company: contact.company ?? "",
    company_name: contact.company ?? "",
    ...contact.customFields
  };
}

function resolvePlaceholderValue(
  template: Pick<Template, "placeholders">,
  token: string,
  values: Record<string, string>
) {
  const trimmed = token.trim();
  if (/^\d+$/.test(trimmed)) {
    const index = Number(trimmed) - 1;
    const mappedKey = template.placeholders[index];
    return mappedKey ? values[mappedKey] ?? "" : "";
  }
  return values[trimmed] ?? "";
}

function numberPlaceholders(template: Pick<Template, "body" | "placeholders">) {
  const orderedTokens = uniquePlaceholders(collectPlaceholderTokens(template.body));
  const fallbackTokens = orderedTokens.length ? orderedTokens : template.placeholders;
  const tokenToIndex = new Map(fallbackTokens.map((token, index) => [token, index + 1]));

  return template.body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const index = tokenToIndex.get(String(key).trim());
    return index ? `{{${index}}}` : `{{${String(key).trim()}}}`;
  });
}

function extractTwilioCallToAction(content: Record<string, any> | undefined) {
  const actions = Array.isArray(content?.actions) ? content.actions : [];
  const action = actions.find((item) => item?.url || item?.phone || item?.phone_number || item?.type === "PHONE_NUMBER");
  if (!action) {
    return {
      ctaLabel: null,
      ctaUrl: null
    };
  }
  if (action.url) {
    return {
      ctaLabel: action.title ?? action.text ?? "Open CTA",
      ctaUrl: action.url
    };
  }
  const phone = action.phone ?? action.phone_number;
  return {
    ctaLabel: action.title ?? action.text ?? "Call now",
    ctaUrl: phone ? `tel:${phone}` : null
  };
}

function normalizePlaceholderName(value: string | undefined, index: number) {
  const candidate = (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return candidate || `variable_${index}`;
}

function mapApprovedTemplate(content: TwilioContentTemplate): Template {
  const types = content.types ?? {};
  const text = types["twilio/text"];
  const media = types["twilio/media"];
  const card = types["twilio/card"];
  const callToAction = types["twilio/call-to-action"];
  const primaryBody = text?.body ?? media?.body ?? callToAction?.body ?? card?.body ?? card?.title ?? "";
  const bodyTokens = uniquePlaceholders(collectPlaceholderTokens(primaryBody));
  const variableKeys = Object.keys(content.variables ?? {});
  const placeholders =
    bodyTokens.length > 0
      ? bodyTokens.map((token, index) => (/^\d+$/.test(token) ? normalizePlaceholderName(content.variables?.[token], index + 1) : token))
      : variableKeys.map((key, index) => (/^\d+$/.test(key) ? normalizePlaceholderName(content.variables?.[key], index + 1) : key));
  const cta = extractTwilioCallToAction(callToAction ?? card);

  return {
    id: content.sid,
    name: content.friendly_name,
    category: "approved",
    body: primaryBody,
    placeholders,
    mediaUrl: media?.media?.[0] ?? card?.media?.[0] ?? null,
    ctaLabel: cta.ctaLabel,
    ctaUrl: cta.ctaUrl,
    twilioContentSid: content.sid
  };
}

export function renderTemplate(
  template: Pick<Template, "body" | "placeholders">,
  contact: Pick<Contact, "firstName" | "lastName" | "phone" | "email" | "company" | "customFields">
) {
  const values = getContactValues(contact);

  return template.body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => resolvePlaceholderValue(template, key, values));
}

export function buildContentVariables(
  template: Pick<Template, "body" | "placeholders">,
  contact: Pick<Contact, "firstName" | "lastName" | "phone" | "email" | "company" | "customFields">
) {
  const values = getContactValues(contact);
  const tokens = uniquePlaceholders(collectPlaceholderTokens(template.body));
  const contentKeys = tokens.length ? tokens : template.placeholders;

  return JSON.stringify(
    Object.fromEntries(
      contentKeys.map((placeholder) => [placeholder, resolvePlaceholderValue(template, placeholder, values)])
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

  const textBody = numberPlaceholders(template);
  const ctaAction =
    template.ctaLabel && template.ctaUrl
      ? template.ctaUrl.startsWith("tel:")
        ? {
            type: "PHONE_NUMBER",
            title: template.ctaLabel,
            phone: template.ctaUrl.replace(/^tel:/, "")
          }
        : {
            type: "URL",
            title: template.ctaLabel,
            url: template.ctaUrl
          }
      : null;

  const body = {
    friendly_name: template.name,
    language: "en",
    variables: Object.fromEntries(
      uniquePlaceholders(collectPlaceholderTokens(template.body)).length
        ? uniquePlaceholders(collectPlaceholderTokens(template.body)).map((placeholder, index) => [String(index + 1), placeholder])
        : template.placeholders.map((placeholder, index) => [String(index + 1), placeholder])
    ),
    types: {
      "twilio/text": {
        body: textBody
      }
    }
  } as Record<string, any>;

  if (template.mediaUrl || ctaAction) {
    body.types["twilio/card"] = {
      title: textBody,
      ...(template.mediaUrl ? { media: [template.mediaUrl] } : {}),
      ...(ctaAction ? { actions: [ctaAction] } : {})
    };
  }

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

export async function fetchApprovedTemplatesFromTwilio() {
  if (!accountSid || !authToken) {
    return {
      synced: false,
      templates: [] as Template[],
      reason: "Missing Twilio credentials"
    };
  }

  const templates: Template[] = [];
  let nextUrl = `${contentApiBase}?${new URLSearchParams({
    PageSize: "100",
    ChannelEligibility: "whatsapp:approved"
  }).toString()}`;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        synced: false,
        templates,
        reason: text
      };
    }

    const json = (await response.json()) as {
      contents?: TwilioContentTemplate[];
      meta?: {
        next_page_url?: string | null;
      };
    };

    templates.push(...(json.contents ?? []).map(mapApprovedTemplate));
    nextUrl = json.meta?.next_page_url ?? "";
  }

  return {
    synced: true,
    templates
  };
}
