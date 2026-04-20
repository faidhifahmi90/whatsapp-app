export type Organization = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  stripeCustomerId?: string | null;
  subscriptionStatus?: string | null;
};

export type User = {
  id: string;
  organizationId: string | null;
  name: string;
  preferredName?: string | null;
  email: string;
  role: string;
  lastLoginAt?: string | null;
};

export type Channel = {
  id: string;
  name: string;
  whatsappNumber: string;
  messagingServiceSid?: string | null;
  status: string;
};

export type Note = {
  id: string;
  contactId: string;
  author: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type Vehicle = {
  id: string;
  contactId: string; // Maps to NRIC owner / Contact User
  vehicleRegistrationNo: string;
  vehicleOwnerName?: string | null;
  vehicleType?: string | null;
  vehicleModel?: string | null;
  makeYear?: string | null;
  marketValue?: string | null;
  createdAt: string;
};

export type Order = {
  id: string;
  contactId: string;
  vehicleRegistrationNo: string; // Link to Vehicle
  orderNo: string;
  orderStatus?: string | null;
  coverNoteNo?: string | null;
  netWrittenPremium?: string | null;
  grossTransaction?: string | null;
  netTransaction?: string | null;
  paymentMethod?: string | null;
  orderDate?: string | null;
  createdAt: string;
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
  notes: Note[];
  vehicles: Vehicle[];
  orders: Order[];
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
  status: "open" | "KIV" | "resolved" | "pending" | "follow up";
  unreadCount?: number;
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

export type JourneyNodeCategory = "trigger" | "action" | "condition" | "control";

export type JourneyNode = {
  id: string;
  category: JourneyNodeCategory;
  type: string;
  config: Record<string, any>;
  nextId?: string | null;    // For linear actions
  yesId?: string | null;     // For conditions
  noId?: string | null;      // For conditions
  position?: { x: number; y: number };
};

export type Automation = {
  id: string;
  name: string;
  version: "simple" | "journey";
  // Simple fields (used if version === "simple")
  triggerType?: "incoming_keyword" | "new_contact" | "segment_joined" | null;
  triggerValue?: string | null;
  templateId?: string | null;
  templateVariables?: string[] | null;
  channelId?: string | null;
  segmentId?: string | null;
  delayMinutes?: number | null;
  // Journey fields (used if version === "journey")
  flowData?: JourneyNode[] | null;
  isActive: boolean;
};

export type LandingPage = {
  id: string;
  name: string;
  slug: string;
  title: string;
  description: string;
  sections: any[];
  theme: any;
  isPublished: boolean;
  createdAt: string;
};

export type BootstrapData = {
  user: User;
  organization: Organization | null;
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
  landingPages: LandingPage[];
  users: User[];
  customFieldDefinitions: string[];
  settings: Record<string, string>;
};
