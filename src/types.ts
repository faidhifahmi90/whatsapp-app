export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type Channel = {
  id: string;
  name: string;
  whatsappNumber: string;
  messagingServiceSid?: string | null;
  status: string;
};

export type Segment = {
  id: string;
  name: string;
  color: string;
  createdAt: string;
};

export type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  company?: string | null;
  labels: string[];
  customFields: Record<string, string>;
  segmentIds: string[];
  createdAt: string;
};

export type Template = {
  id: string;
  name: string;
  category: string;
  body: string;
  placeholders: string[];
  mediaUrl?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  twilioContentSid?: string | null;
};

export type Message = {
  id: string;
  conversationId: string;
  channelId: string;
  direction: "inbound" | "outbound";
  body: string;
  mediaUrl?: string | null;
  status: string;
  templateId?: string | null;
  twilioMessageSid?: string | null;
  twilioContentSid?: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type Conversation = {
  id: string;
  contactId: string;
  channelId: string;
  status: string;
  updatedAt: string;
  lastMessageAt: string;
  contact: Contact;
  channel: Channel;
  messages: Message[];
};

export type Campaign = {
  id: string;
  name: string;
  templateId: string;
  channelId: string;
  recipientMode: "segments" | "contacts" | "mixed";
  recipientIds: string[];
  status: string;
  scheduledAt?: string | null;
  recurringInterval: "none" | "daily" | "weekly" | "monthly";
  recurringUntil?: string | null;
  stats: {
    attempted: number;
    delivered: number;
    failed: number;
  };
  metadata?: {
    variables?: string[];
    headerMediaUrl?: string;
  };
  createdAt: string;
};

export type Automation = {
  id: string;
  name: string;
  triggerType: "incoming_keyword" | "new_contact" | "segment_joined";
  triggerValue?: string | null;
  templateId: string;
  channelId: string;
  segmentId?: string | null;
  delayMinutes: number;
  isActive: boolean;
};

export type BootstrapData = {
  user: User;
  stats: {
    unreadCount: number;
    contactCount: number;
    conversationCount: number;
    templateCount: number;
  };
  channels: Channel[];
  segments: Segment[];
  contacts: Contact[];
  templates: Template[];
  conversations: Conversation[];
  campaigns: Campaign[];
  automations: Automation[];
  users: User[];
};
