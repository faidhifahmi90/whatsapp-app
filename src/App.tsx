import { FormEvent, useEffect, useMemo, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from "@react-oauth/google";
import { io } from "socket.io-client";
import { api, ApiError } from "./api";
import type {
  Automation,
  BootstrapData,
  Campaign,
  Contact,
  Conversation,
  Template
} from "./types";



const primaryNavItems = [
  { to: "/inbox", label: "Conversations", icon: "forum" },
  { to: "/campaigns", label: "Campaigns", icon: "rocket_launch" },
  { to: "/contacts", label: "Contacts", icon: "group" },
  { to: "/analytics", label: "Analytics", icon: "insert_chart" }
];

const studioNavItems = [
  { to: "/templates", label: "Templates", icon: "description" },
  { to: "/automations", label: "Automations", icon: "hub" },
  { to: "/settings", label: "Settings", icon: "settings" }
];

const contactRoles = [
  "Chief Logistics Officer",
  "Regional Manager",
  "Client Success Lead",
  "Director of Operations",
  "Head of Commerce",
  "Enterprise Buyer"
];

const companyLocations = [
  "Miami, FL",
  "Kuala Lumpur, MY",
  "Singapore",
  "London, UK",
  "Madrid, ES",
  "Dubai, AE"
];

export default function App() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);

  useEffect(() => {
    async function initClientConfig() {
      try {
        const response = await fetch("/api/public-config");
        const json = await response.json();
        setGoogleClientId(json.googleClientId);
      } catch (err) {
        console.error("Failed to load public config", err);
      }
    }
    void initClientConfig();
  }, []);

  async function refreshData(preferredConversationId?: string | null) {
    try {
      const next = await api<BootstrapData>("/api/bootstrap");
      setData(next);
      setSelectedConversationId((current) => {
        const target = preferredConversationId ?? current;
        if (target && next.conversations.some((conversation) => conversation.id === target)) {
          return target;
        }
        return next.conversations[0]?.id ?? null;
      });
      setError(null);
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError.status === 401) {
        setData(null);
      } else {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load dashboard");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshData();
  }, []);

  useEffect(() => {
    const socket = io({
      withCredentials: true
    });
    socket.on("data:refresh", () => {
      void refreshData(selectedConversationId);
    });
    return () => {
      socket.disconnect();
    };
  }, [selectedConversationId]);

  async function login(credentialResponse: CredentialResponse) {
    if (!credentialResponse.credential) return;
    await api("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential: credentialResponse.credential })
    });
    await refreshData();
  }

  async function logout() {
    await api("/api/auth/logout", {
      method: "POST"
    });
    setData(null);
  }

  if (loading || googleClientId === null) {
    return <div className="grid min-h-screen place-items-center bg-background text-on-surface">Loading dashboard…</div>;
  }

  if (!data) {
    return (
      <GoogleOAuthProvider clientId={googleClientId}>
        <LoginPage onLogin={login} error={error} />
      </GoogleOAuthProvider>
    );
  }

  return (
    <DashboardShell
      data={data}
      error={error}
      selectedConversationId={selectedConversationId}
      onRefresh={refreshData}
      onSelectConversation={setSelectedConversationId}
      onLogout={logout}
    />
  );
}

function LoginPage(props: { onLogin: (credential: CredentialResponse) => Promise<void>; error: string | null }) {
  const [error, setError] = useState<string | null>(props.error);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-6 py-12 text-on-surface">
      <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary-fixed/20 blur-3xl" />
      <div className="absolute -bottom-16 -left-12 h-80 w-80 rounded-full bg-secondary-fixed/20 blur-3xl" />
      <div className="mx-auto grid min-h-[80vh] max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-3 rounded-full bg-surface-container-low px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            <Icon name="hub" className="text-base" />
            Verified WhatsApp Operations Hub
          </div>
          <div className="space-y-5">
            <h1 className="font-headline text-5xl font-extrabold leading-tight text-primary sm:text-6xl">
              Atrium Business for live WhatsApp sales, support, and campaigns.
            </h1>
            <p className="max-w-2xl text-lg text-on-surface-variant">
              Shared multi-user dashboard, real-time conversations, contact imports, batch messaging, approved templates,
              automation flows, and Twilio WhatsApp integrations in one workspace.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <MarketingPill title="Realtime Inbox" subtitle="Two-way team chat" icon="forum" />
            <MarketingPill title="Broadcast Wizard" subtitle="Segments and templates" icon="rocket_launch" />
            <MarketingPill title="Shared Control" subtitle="Same dashboard for all users" icon="group" />
          </div>
        </div>

        <div className="rounded-[2rem] border border-outline-variant/20 bg-surface-container-lowest p-8 shadow-[0_40px_120px_-48px_rgba(0,69,61,0.32)]">
          <div className="mb-8 space-y-2">
            <p className="font-label text-xs font-bold uppercase tracking-[0.3em] text-outline">Atrium Access</p>
            <h2 className="font-headline text-3xl font-extrabold text-primary">Enter shared workspace</h2>
            <p className="text-sm text-on-surface-variant">Sign in securely with your Google Workspace account to begin.</p>
          </div>
          
          <div className="flex flex-col items-stretch gap-4">
            <GoogleLogin
              onSuccess={(credentialResponse) => {
                setError(null);
                props.onLogin(credentialResponse).catch((caughtError) => {
                  setError(caughtError instanceof Error ? caughtError.message : "Login failed");
                });
              }}
              onError={() => setError("Google Authentication Failed")}
              useOneTap
              theme="filled_black"
              shape="pill"
            />
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-error/20 bg-error-container px-4 py-3 text-sm font-semibold text-on-error-container">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DashboardShell(props: {
  data: BootstrapData;
  error: string | null;
  selectedConversationId: string | null;
  onRefresh: (preferredConversationId?: string | null) => Promise<void>;
  onSelectConversation: (id: string | null) => void;
  onLogout: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const routeMeta = {
    "/inbox": {
      title: "Atrium Business",
      searchPlaceholder: "Search conversations..."
    },
    "/campaigns": {
      title: "Campaign Creator",
      searchPlaceholder: "Search campaign flows..."
    },
    "/contacts": {
      title: "Contacts",
      searchPlaceholder: "Search audience..."
    },
    "/analytics": {
      title: "Campaign Reports",
      searchPlaceholder: "Search campaign reports..."
    }
  } as Record<string, { title: string; searchPlaceholder: string }>;

  const currentMeta = routeMeta[location.pathname] ?? {
    title: "Atrium Business",
    searchPlaceholder: "Search workspace..."
  };

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  async function openConversation(contactId: string, channelId: string, templateId?: string) {
    const result = await api<{ conversationId: string }>("/api/conversations/open", {
      method: "POST",
      body: JSON.stringify({ contactId, channelId, templateId })
    });
    props.onSelectConversation(result.conversationId);
    await props.onRefresh(result.conversationId);
    navigate("/inbox");
  }

  const unreadCount = props.data.conversations.filter((conversation) =>
    conversation.messages.some((message) => message.direction === "inbound" && message.status !== "read")
  ).length;

  return (
    <div className="min-h-screen bg-background text-on-surface">
      {sidebarOpen ? (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          type="button"
        />
      ) : null}

      <aside
        className={[
          "fixed left-0 top-0 z-40 flex h-screen flex-col gap-y-2 bg-slate-100 py-8 transition-transform duration-200 lg:translate-x-0",
          sidebarCollapsed ? "w-20 px-3" : "w-64 px-4",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        ].join(" ")}
      >
        <div className={`mb-8 ${sidebarCollapsed ? "px-1" : "px-4"}`}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-on-primary">
              <Icon name="hub" />
            </div>
            {!sidebarCollapsed ? (
              <div>
                <h1 className="font-headline text-sm font-bold leading-tight text-primary">Global Enterprise</h1>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Verified API</p>
              </div>
            ) : null}
            <button
              aria-label="Close navigation"
              className="ml-auto rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-200/70 lg:hidden"
              onClick={() => setSidebarOpen(false)}
              type="button"
            >
              <Icon name="close" />
            </button>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {primaryNavItems.map((item) => (
            <AtriumNavLink collapsed={sidebarCollapsed} key={item.to} to={item.to} icon={item.icon} label={item.label} />
          ))}

          {!sidebarCollapsed ? (
            <div className="px-4 pb-2 pt-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Studio</p>
            </div>
          ) : null}
          {studioNavItems.map((item) => (
            <AtriumNavLink collapsed={sidebarCollapsed} compact key={item.to} to={item.to} icon={item.icon} label={item.label} />
          ))}
        </nav>

        <div className="mt-auto space-y-1 border-t border-slate-200 pt-6">
          <button className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-headline text-sm font-bold text-on-primary shadow-lg shadow-primary/10 transition-all hover:opacity-90">
            <Icon name="add" className="text-base" />
            {!sidebarCollapsed ? "New Broadcast" : null}
          </button>
          <SidebarUtility collapsed={sidebarCollapsed} label="Support" icon="headset_mic" />
          <SidebarUtility collapsed={sidebarCollapsed} label="API Docs" icon="terminal" />
          <button
            className={`flex w-full items-center rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-500 transition-all hover:bg-slate-200/50 hover:text-emerald-800 ${
              sidebarCollapsed ? "justify-center" : "gap-3"
            }`}
            onClick={() => void props.onLogout()}
            title={sidebarCollapsed ? "Log out" : undefined}
            type="button"
          >
            <Icon name="logout" className="text-lg" />
            {!sidebarCollapsed ? "Log out" : null}
          </button>
        </div>
      </aside>

      <main className={`min-h-screen bg-surface transition-[margin] duration-200 ${sidebarCollapsed ? "lg:ml-20" : "lg:ml-64"}`}>
        <header className="sticky top-0 z-30 flex items-center justify-between bg-slate-50/80 px-6 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-3 lg:gap-8">
            <button
              aria-label="Open navigation"
              className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-200/50 lg:hidden"
              onClick={() => setSidebarOpen(true)}
              type="button"
            >
              <Icon name="menu" />
            </button>
            <button
              aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
              className="hidden rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-200/50 lg:inline-flex"
              onClick={() => setSidebarCollapsed((current) => !current)}
              type="button"
            >
              <Icon name={sidebarCollapsed ? "menu_open" : "menu"} />
            </button>
            <span className="font-headline text-xl font-bold tracking-tight text-emerald-900">{currentMeta.title}</span>
            <div className="hidden w-80 items-center gap-2 rounded-full bg-slate-100/70 px-4 py-2 md:flex">
              <Icon name="search" className="text-sm text-slate-400" />
              <input
                className="w-full border-none bg-transparent p-0 text-xs focus:ring-0"
                placeholder={currentMeta.searchPlaceholder}
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-200/50">
              <Icon name="notifications" />
            </button>
            <button className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-200/50">
              <Icon name="settings" />
            </button>
            <div className="flex items-center gap-3 rounded-full bg-white/70 px-2 py-1 shadow-sm sm:px-3">
              <div className="hidden text-right sm:block">
                <p className="text-xs font-bold text-emerald-900">{props.data.user.name}</p>
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{props.data.user.role}</p>
              </div>
              <Avatar label={props.data.user.name} size="h-8 w-8" />
            </div>
          </div>
        </header>

        {props.error ? (
          <div className="px-8 pt-6">
            <div className="rounded-2xl border border-error/20 bg-error-container px-4 py-3 text-sm font-semibold text-on-error-container">
              {props.error}
            </div>
          </div>
        ) : null}

        <Routes>
          <Route
            path="/inbox"
            element={
              <InboxPage
                data={props.data}
                selectedConversationId={props.selectedConversationId}
                unreadCount={unreadCount}
                onRefresh={props.onRefresh}
                onSelectConversation={props.onSelectConversation}
              />
            }
          />
          <Route
            path="/campaigns"
            element={<CampaignsPage data={props.data} onRefresh={props.onRefresh} />}
          />
          <Route
            path="/contacts"
            element={<ContactsPage data={props.data} onOpenConversation={openConversation} onRefresh={props.onRefresh} />}
          />
          <Route path="/analytics" element={<AnalyticsPage data={props.data} />} />
          <Route path="/templates" element={<TemplatesStudioPage data={props.data} onRefresh={props.onRefresh} />} />
          <Route path="/automations" element={<AutomationsStudioPage data={props.data} onRefresh={props.onRefresh} />} />
          <Route path="/settings" element={<SettingsStudioPage data={props.data} onRefresh={props.onRefresh} />} />
          <Route path="*" element={<Navigate to="/inbox" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function InboxPage(props: {
  data: BootstrapData;
  selectedConversationId: string | null;
  unreadCount: number;
  onRefresh: (preferredConversationId?: string | null) => Promise<void>;
  onSelectConversation: (id: string | null) => void;
}) {
  const [messageBody, setMessageBody] = useState("");
  const [templateId, setTemplateId] = useState(props.data.templates[0]?.id ?? "");
  const [channelId, setChannelId] = useState(props.data.channels[0]?.id ?? "");

  const selectedConversation =
    props.data.conversations.find((conversation) => conversation.id === props.selectedConversationId) ??
    props.data.conversations[0];
  const chosenTemplate = props.data.templates.find((template) => template.id === templateId) ?? props.data.templates[0];

  useEffect(() => {
    if (!props.selectedConversationId && props.data.conversations[0]) {
      props.onSelectConversation(props.data.conversations[0].id);
    }
  }, [props.data.conversations, props.onSelectConversation, props.selectedConversationId]);

  useEffect(() => {
    if (selectedConversation) {
      setChannelId(selectedConversation.channelId);
    }
  }, [selectedConversation]);

  async function sendManualReply() {
    if (!selectedConversation || !messageBody.trim()) {
      return;
    }
    await api("/api/messages/send", {
      method: "POST",
      body: JSON.stringify({
        conversationId: selectedConversation.id,
        contactId: selectedConversation.contactId,
        channelId,
        body: messageBody
      })
    });
    setMessageBody("");
    await props.onRefresh(selectedConversation.id);
  }

  async function sendTemplate(templateIdOverride?: string) {
    if (!selectedConversation || !(templateIdOverride ?? templateId)) {
      return;
    }
    await api("/api/messages/send", {
      method: "POST",
      body: JSON.stringify({
        conversationId: selectedConversation.id,
        contactId: selectedConversation.contactId,
        channelId,
        templateId: templateIdOverride ?? templateId
      })
    });
    await props.onRefresh(selectedConversation.id);
  }

  const quickReplyTemplates = props.data.templates.slice(0, 5);
  const latestInbound = selectedConversation?.messages.filter((message) => message.direction === "inbound").at(-1);

  return (
    <div className="flex min-h-[calc(100vh-72px)] flex-col overflow-hidden xl:h-[calc(100vh-72px)] xl:flex-row">
      <div className="flex w-full flex-col border-b border-slate-100 bg-surface-container-low xl:w-80 xl:border-b-0 xl:border-r">
        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-lg font-bold text-on-surface">Inbox</h2>
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-on-primary">{props.unreadCount} New</span>
          </div>
          <div className="flex gap-1 rounded-xl bg-surface-container-high p-1">
            <button className="flex-1 rounded-lg bg-surface-container-lowest py-2 text-[10px] font-bold text-primary shadow-sm">Open</button>
            <button className="flex-1 rounded-lg py-2 text-[10px] font-semibold text-slate-500 transition-colors hover:bg-slate-200/50">Pending</button>
            <button className="flex-1 rounded-lg py-2 text-[10px] font-semibold text-slate-500 transition-colors hover:bg-slate-200/50">Resolved</button>
          </div>
        </div>
        <div className="max-h-[24rem] flex-1 space-y-1 overflow-y-auto px-2 pb-4 xl:max-h-none">
          {props.data.conversations.map((conversation) => {
            const latest = conversation.messages[conversation.messages.length - 1];
            const active = conversation.id === selectedConversation?.id;
            return (
              <button
                className={`relative w-full overflow-hidden rounded-xl p-3 text-left transition-all ${
                  active ? "bg-surface-container-lowest shadow-sm" : "hover:bg-surface-bright"
                }`}
                key={conversation.id}
                onClick={() => props.onSelectConversation(conversation.id)}
              >
                {active ? <div className="absolute left-0 top-0 h-full w-1 bg-primary" /> : null}
                <div className="flex gap-3">
                  <div className="relative">
                    <Avatar label={fullName(conversation.contact)} size="h-12 w-12" />
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface-container-lowest bg-secondary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h4 className={`truncate text-sm ${active ? "font-semibold text-on-surface" : "font-medium text-slate-700"}`}>
                        {fullName(conversation.contact)}
                      </h4>
                      <span className={`text-[10px] ${active ? "font-medium text-primary" : "text-slate-400"}`}>
                        {formatRelativeChatTime(conversation.lastMessageAt)}
                      </span>
                    </div>
                    <p className={`mt-0.5 truncate text-xs ${active ? "text-on-surface-variant" : "text-slate-400"}`}>{latest?.body ?? "No messages yet"}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(conversation.contact.labels.length ? conversation.contact.labels : conversation.contact.segmentIds.slice(0, 2)).map((labelOrId) => (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tight ${
                            active ? "bg-tertiary-fixed text-on-tertiary-fixed-variant" : "bg-slate-200 text-slate-600"
                          }`}
                          key={labelOrId}
                        >
                          {resolveLabel(labelOrId, props.data)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-surface">
        <div className="z-10 flex flex-col gap-3 bg-surface-container-lowest px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar label={selectedConversation ? fullName(selectedConversation.contact) : "Contact"} size="h-10 w-10" />
              <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-surface-container-lowest bg-primary text-[8px] text-white">
                <Icon name="check" className="text-[8px]" fill />
              </div>
            </div>
            <div>
              <h3 className="font-headline text-base font-bold leading-tight text-on-surface">
                {selectedConversation ? fullName(selectedConversation.contact) : "No conversation"}
              </h3>
              <p className="flex items-center gap-1 text-[11px] font-medium text-secondary">
                <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
                Online • WhatsApp Business
              </p>
            </div>
          </div>
          <div className="flex gap-2 self-end sm:self-auto">
            <button className="rounded-xl border border-outline-variant/30 p-2.5 text-slate-600 transition-colors hover:bg-slate-50">
              <Icon name="call" className="text-xl" />
            </button>
            <button className="rounded-xl border border-outline-variant/30 p-2.5 text-slate-600 transition-colors hover:bg-slate-50">
              <Icon name="videocam" className="text-xl" />
            </button>
            <button className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary">Resolve</button>
          </div>
        </div>

        <div className="min-h-[22rem] flex-1 space-y-8 overflow-y-auto bg-surface p-4 sm:p-6">
          <div className="flex justify-center">
            <span className="rounded-full bg-surface-container px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Today</span>
          </div>
          {selectedConversation?.messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              message={message}
              previousMessage={selectedConversation.messages[index - 1]}
            />
          ))}
          {!selectedConversation?.messages.length ? (
            <div className="rounded-3xl border border-dashed border-outline-variant/30 bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
              Select a contact and start a realtime WhatsApp conversation.
            </div>
          ) : null}
        </div>

        <div className="flex gap-2 overflow-x-auto bg-surface-container-low/50 px-4 py-2 sm:px-6">
          {quickReplyTemplates.map((template) => (
            <button
              className="whitespace-nowrap rounded-full border border-outline-variant/20 bg-surface-container-lowest px-3 py-1.5 text-[11px] font-semibold text-primary transition-all hover:bg-primary hover:text-on-primary"
              key={template.id}
              onClick={() => void sendTemplate(template.id)}
            >
              {template.name}
            </button>
          ))}
        </div>

        <div className="space-y-3 bg-surface-container-lowest p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <select
              className="rounded-2xl border-outline-variant/20 bg-surface-container-low px-4 py-3 text-sm focus:border-primary focus:ring-primary/20"
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
            >
              {props.data.templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-2xl border-outline-variant/20 bg-surface-container-low px-4 py-3 text-sm focus:border-primary focus:ring-primary/20"
              value={channelId}
              onChange={(event) => setChannelId(event.target.value)}
            >
              {props.data.channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name} · {channel.whatsappNumber}
                </option>
              ))}
            </select>
            <button
              className="rounded-2xl border border-outline-variant/20 bg-white px-4 py-3 text-sm font-bold text-primary transition-all hover:bg-slate-50"
              onClick={() => void sendTemplate()}
            >
              Send template
            </button>
          </div>
          {chosenTemplate ? (
            <div className="rounded-2xl bg-surface-container-low p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <strong className="font-headline text-sm text-on-surface">{chosenTemplate.name}</strong>
                <span className="rounded-full bg-primary-fixed/40 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                  Preview
                </span>
              </div>
              <p className="text-sm text-on-surface-variant">{chosenTemplate.body}</p>
              {chosenTemplate.ctaLabel ? (
                <div className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold text-primary shadow-sm">
                  {chosenTemplate.ctaLabel}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="flex items-end gap-3 rounded-2xl border border-outline-variant/10 bg-surface-container-low p-2 pl-4">
            <button className="p-2 text-slate-400 transition-colors hover:text-primary">
              <Icon name="add_circle" />
            </button>
            <textarea
              className="max-h-32 flex-1 resize-none border-none bg-transparent py-2 text-sm focus:ring-0"
              placeholder="Type a message..."
              rows={1}
              value={messageBody}
              onChange={(event) => setMessageBody(event.target.value)}
            />
            <button className="p-2 text-slate-400 transition-colors hover:text-primary">
              <Icon name="mood" />
            </button>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-on-primary shadow-lg shadow-primary/20"
              onClick={() => void sendManualReply()}
            >
              <Icon name="send" />
            </button>
          </div>
        </div>
      </div>

      <div className="w-full overflow-y-auto border-t border-slate-100 bg-surface-container-high p-6 xl:w-72 xl:border-l xl:border-t-0">
        {selectedConversation ? (
          <>
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 ring-4 ring-surface-container-lowest">
                <Avatar label={fullName(selectedConversation.contact)} size="h-20 w-20 rounded-[1.5rem]" />
              </div>
              <h4 className="font-headline text-lg font-bold text-on-surface">{fullName(selectedConversation.contact)}</h4>
              <p className="text-xs text-slate-500">
                {deriveContactRole(selectedConversation.contact)}, {selectedConversation.contact.company || "Atrium Client"}
              </p>
              <div className="mt-3 flex gap-2">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-tight text-primary">VIP Tier</span>
                <span className="rounded-full bg-secondary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-tight text-secondary">Key Account</span>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <InfoCard title="Contact Info">
                <InfoLine icon="mail" value={selectedConversation.contact.email || buildFakeEmail(selectedConversation.contact)} />
                <InfoLine icon="phone_iphone" value={selectedConversation.contact.phone} />
                <InfoLine icon="location_on" value={deriveLocation(selectedConversation.contact)} />
              </InfoCard>

              <InfoCard action="+ New" title="Internal Notes">
                <NoteCard text={`Client prefers WhatsApp for urgent updates and template confirmations. Latest ask: ${latestInbound?.body ?? "No recent inbound note."}`} meta="Today by Atrium" />
                <NoteCard text={`Assigned to ${selectedConversation.channel.name} and tagged with ${selectedConversation.contact.labels[0] ?? "priority"} workflows.`} meta="Auto note" />
              </InfoCard>

              <InfoCard title="Latest Activity">
                <TimelineEntry accent icon="check" title="Conversation updated" meta={formatLongDate(selectedConversation.updatedAt)} />
                <TimelineEntry icon="description" title="Template preview available" meta={chosenTemplate?.name ?? "No template selected"} />
                <TimelineEntry icon="group" title="Segments attached" meta={selectedConversation.contact.segmentIds.map((segmentId) => resolveLabel(segmentId, props.data)).join(", ") || "No segments"} />
              </InfoCard>
            </div>
          </>
        ) : (
          <div className="rounded-3xl bg-surface-container-lowest p-6 text-sm text-on-surface-variant">Choose a conversation to inspect contact details.</div>
        )}
      </div>
    </div>
  );
}

function CampaignsPage(props: { data: BootstrapData; onRefresh: (preferredConversationId?: string | null) => Promise<void> }) {
  const [name, setName] = useState("Seasonal Promo Spring");
  const [templateId, setTemplateId] = useState(props.data.templates[0]?.id ?? "");
  const [channelId, setChannelId] = useState(props.data.channels[0]?.id ?? "");
  const [recipientMode, setRecipientMode] = useState<Campaign["recipientMode"]>("segments");
  const [recipientIds, setRecipientIds] = useState<string[]>(props.data.segments[0] ? [props.data.segments[0].id] : []);
  const [scheduledAt, setScheduledAt] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const selectedTemplate = props.data.templates.find((template) => template.id === templateId) ?? props.data.templates[0];
  const previewContact = props.data.contacts[0];
  const recipientOptions =
    recipientMode === "contacts"
      ? props.data.contacts.map((contact) => ({ id: contact.id, label: fullName(contact), subtitle: contact.company || contact.phone }))
      : props.data.segments.map((segment) => ({
          id: segment.id,
          label: segment.name,
          subtitle: `${props.data.contacts.filter((contact) => contact.segmentIds.includes(segment.id)).length} contacts`
        }));

  useEffect(() => {
    if (!recipientOptions.find((item) => recipientIds.includes(item.id))) {
      setRecipientIds(recipientOptions[0] ? [recipientOptions[0].id] : []);
    }
  }, [recipientMode, recipientIds, recipientOptions]);

  async function launchCampaign() {
    await api("/api/campaigns/send", {
      method: "POST",
      body: JSON.stringify({
        name,
        templateId,
        channelId,
        recipientMode,
        recipientIds,
        scheduledAt: scheduledAt || null
      })
    });
    setFeedback(scheduledAt ? "Campaign queued successfully." : "Campaign launched successfully.");
    setScheduledAt("");
    await props.onRefresh();
  }

  const recipientEstimate =
    recipientMode === "contacts"
      ? recipientIds.length
      : props.data.contacts.filter((contact) => contact.segmentIds.some((segmentId) => recipientIds.includes(segmentId))).length;

  return (
    <div className="relative overflow-hidden px-4 pb-10 pt-6 sm:px-6 lg:px-10 lg:pb-32 lg:pt-10">
      <div className="fixed -right-40 -top-40 -z-10 h-[600px] w-[600px] rounded-full bg-primary-fixed/10 blur-[120px]" />
      <div className="fixed bottom-0 left-10 -z-10 h-[400px] w-[400px] rounded-full bg-secondary-fixed/10 blur-[100px]" />

      <div className="mb-10">
        <nav className="mb-4 flex items-center gap-2 text-xs font-medium text-on-surface-variant">
          <span>Campaigns</span>
          <Icon name="chevron_right" className="text-xs" />
          <span className="font-bold text-primary">New Broadcast Flow</span>
        </nav>
        <h1 className="font-headline text-[2.6rem] font-extrabold tracking-tight text-primary">Broadcast Wizard</h1>
        <p className="mt-2 max-w-2xl text-on-surface-variant">Design, validate, and launch high-impact WhatsApp campaigns from your centralized atrium.</p>
      </div>

      <div className="mb-12 hidden max-w-4xl items-center justify-between gap-4 lg:flex">
        <WizardStep index={1} label="Template" status="selected" />
        <div className="mx-4 h-[2px] flex-1 bg-primary-fixed" />
        <WizardStep index={2} label="Audience" status="pending" />
        <div className="mx-4 h-[2px] flex-1 bg-surface-container-high" />
        <WizardStep dim index={3} label="Variables" status="locked" />
        <div className="mx-4 h-[2px] flex-1 bg-surface-container-high" />
        <WizardStep dim index={4} label="Launch" status="locked" />
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 space-y-6 xl:col-span-7">
          <div className="rounded-xl bg-surface-container-low p-6">
            <SectionTitle icon="grid_view" title="Select Approved Template" />
            <div className="space-y-3">
              {props.data.templates.map((template) => {
                const active = template.id === templateId;
                return (
                  <button
                    className={`flex w-full items-center justify-between rounded-xl p-4 text-left transition-all ${
                      active
                        ? "border-l-4 border-primary bg-surface-container-lowest shadow-sm"
                        : "bg-surface-container hover:bg-surface-container-high"
                    }`}
                    key={template.id}
                    onClick={() => setTemplateId(template.id)}
                    type="button"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${active ? "bg-primary-fixed/30 text-primary" : "bg-surface-variant text-on-surface-variant"}`}>
                        <Icon name={active ? "campaign" : "description"} />
                      </div>
                      <div>
                        <h4 className="font-bold text-on-surface">{template.name}</h4>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-secondary-fixed px-2 py-0.5 text-[10px] font-bold text-on-secondary-fixed">
                            <span className="mr-1.5 h-1 w-1 rounded-full bg-on-secondary-fixed" />
                            APPROVED
                          </span>
                          <span className="text-[10px] text-outline-variant">• {template.category}</span>
                        </div>
                      </div>
                    </div>
                    {active ? <Icon fill className="text-primary" name="check_circle" /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl bg-surface-container-low p-6">
            <SectionTitle icon="person_add" title="Audience Selection" />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border-2 border-dashed border-primary p-8 transition-all hover:bg-primary-fixed/5">
                <div className="flex flex-col items-center justify-center text-center">
                  <Icon className="mb-2 text-3xl text-primary" name="cloud_upload" />
                  <span className="text-sm font-bold text-primary">Upload CSV/XLS</span>
                  <span className="mt-1 text-[10px] text-outline">Use the Contacts screen for bulk imports and then target the saved segment here.</span>
                </div>
              </div>
              <div className="flex flex-col rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm font-bold text-on-surface">Existing Audience</span>
                  <Icon className="text-sm text-primary" name="search" />
                </div>
                <div className="mb-4 flex gap-2">
                  <button
                    className={`rounded-full px-4 py-2 text-xs font-bold ${recipientMode === "segments" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"}`}
                    onClick={() => {
                      setRecipientMode("segments");
                      setRecipientIds(props.data.segments[0] ? [props.data.segments[0].id] : []);
                    }}
                    type="button"
                  >
                    Segments
                  </button>
                  <button
                    className={`rounded-full px-4 py-2 text-xs font-bold ${recipientMode === "contacts" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"}`}
                    onClick={() => {
                      setRecipientMode("contacts");
                      setRecipientIds(props.data.contacts[0] ? [props.data.contacts[0].id] : []);
                    }}
                    type="button"
                  >
                    Contacts
                  </button>
                </div>
                <div className="custom-scrollbar max-h-40 space-y-2 overflow-y-auto pr-2">
                  {recipientOptions.map((option) => {
                    const active = recipientIds.includes(option.id);
                    return (
                      <button
                        className={`flex w-full items-center justify-between rounded-lg p-3 text-left text-xs font-medium transition-all ${
                          active ? "border border-outline-variant/30 bg-surface-container-low text-primary" : "hover:bg-surface-container-low"
                        }`}
                        key={option.id}
                        onClick={() => setRecipientIds(active ? recipientIds.filter((id) => id !== option.id) : [...recipientIds, option.id])}
                        type="button"
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="text-xs" name="group" />
                          <div>
                            <div>{option.label}</div>
                            <div className="text-[10px] text-outline">{option.subtitle}</div>
                          </div>
                        </div>
                        {active ? <Icon className="text-primary" fill name="check_circle" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Campaign name">
                <input className="atrium-input" value={name} onChange={(event) => setName(event.target.value)} />
              </Field>
              <Field label="Channel">
                <select className="atrium-input" value={channelId} onChange={(event) => setChannelId(event.target.value)}>
                  {props.data.channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Schedule">
                <input className="atrium-input" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
              </Field>
              <Field label="Estimated recipients">
                <div className="atrium-input flex items-center font-bold text-primary">{recipientEstimate} contacts</div>
              </Field>
            </div>
          </div>

          <div className="rounded-xl bg-surface-container-low p-6">
            <SectionTitle icon="hub" title="Workflow Notes" />
            <div className="grid gap-4 md:grid-cols-2">
              {props.data.automations.slice(0, 4).map((automation) => (
                <div className="rounded-xl bg-surface-container-lowest p-4" key={automation.id}>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-outline">{automation.triggerType.replaceAll("_", " ")}</p>
                  <h4 className="mt-2 font-headline text-base font-bold text-on-surface">{automation.name}</h4>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Sends {props.data.templates.find((template) => template.id === automation.templateId)?.name ?? "template"} after {automation.delayMinutes} minutes.
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-surface-container-low p-6">
            <SectionTitle icon="insert_chart" title="Recent Campaigns" />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
                    <th className="pb-4">Campaign</th>
                    <th className="pb-4">Status</th>
                    <th className="pb-4">Attempted</th>
                    <th className="pb-4">Delivered</th>
                    <th className="pb-4">Failed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10 text-sm">
                  {props.data.campaigns.map((campaign) => (
                    <tr key={campaign.id}>
                      <td className="py-4 font-semibold text-on-surface">{campaign.name}</td>
                      <td className="py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${campaign.status === "sent" ? "bg-secondary/10 text-secondary" : "bg-primary/10 text-primary"}`}>
                          {campaign.status}
                        </span>
                      </td>
                      <td className="py-4 text-on-surface-variant">{campaign.stats.attempted}</td>
                      <td className="py-4 text-on-surface-variant">{campaign.stats.delivered}</td>
                      <td className="py-4 text-on-surface-variant">{campaign.stats.failed}</td>
                    </tr>
                  ))}
                  {!props.data.campaigns.length ? (
                    <tr>
                      <td className="py-6 text-sm text-on-surface-variant" colSpan={5}>
                        No campaigns launched yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-span-12 xl:col-span-5">
          <div className="sticky top-24 mx-auto w-full max-w-sm">
            <div className="rounded-[3rem] border-4 border-surface-dim bg-surface-container-highest p-4 shadow-2xl">
              <div className="relative flex h-[600px] flex-col overflow-hidden rounded-[2rem] bg-background">
                <div className="flex items-center justify-between bg-primary-container/90 px-6 pb-4 pt-10 text-white">
                  <div className="flex items-center gap-3">
                    <Icon name="arrow_back" />
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                      <Icon className="text-lg" name="business" />
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-none">Global Enterprise</p>
                      <p className="mt-0.5 text-[8px] uppercase tracking-widest opacity-80">Official Business Account</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <Icon className="text-sm" name="videocam" />
                    <Icon className="text-sm" name="call" />
                  </div>
                </div>
                <div className="flex flex-1 flex-col justify-end space-y-4 bg-[radial-gradient(circle_at_top_left,rgba(168,240,227,0.25),transparent_32%),linear-gradient(180deg,#f7f9fc_0%,#eef3f5_100%)] p-4">
                  <div className="self-center rounded-full bg-white/50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">Today</div>
                  <div className="relative self-end max-w-[85%]">
                    <div className="relative z-10 rounded-xl rounded-br-sm bg-primary-container p-3 text-on-primary-container shadow-sm">
                      {selectedTemplate?.mediaUrl ? (
                        <div className="mb-3 h-32 w-full overflow-hidden rounded-lg bg-white/10">
                          <img alt={selectedTemplate.name} className="h-full w-full object-cover" src={selectedTemplate.mediaUrl} />
                        </div>
                      ) : null}
                      <h5 className="mb-1 text-sm font-bold leading-tight">{selectedTemplate?.name ?? "Campaign Template"}</h5>
                      <p className="text-xs leading-relaxed opacity-90">{renderTemplatePreview(selectedTemplate, previewContact)}</p>
                      <div className="mt-2 flex justify-end gap-1">
                        <span className="text-[9px] opacity-70">10:42 AM</span>
                        <Icon className="text-[12px] text-primary-fixed" fill name="done_all" />
                      </div>
                    </div>
                    <div className="absolute -bottom-0 -right-1 h-3 w-3 bg-primary-container [clip-path:polygon(0_0,100%_0,100%_100%)]" />
                    <div className="mt-2 space-y-1">
                      <button className="flex w-full items-center justify-center gap-1 rounded-lg border border-outline-variant/10 bg-white/90 py-2 text-[10px] font-bold text-primary">
                        <Icon className="text-xs" name="shopping_bag" />
                        {selectedTemplate?.ctaLabel ?? "Open CTA"}
                      </button>
                      <button className="flex w-full items-center justify-center gap-1 rounded-lg border border-outline-variant/10 bg-white/90 py-2 text-[10px] font-bold text-primary">
                        <Icon className="text-xs" name="close" />
                        Opt Out
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-background p-3">
                  <div className="flex flex-1 items-center gap-2 rounded-full bg-surface-container px-4 py-2">
                    <Icon className="text-lg text-outline" name="mood" />
                    <div className="h-3 flex-1 rounded bg-outline-variant/20" />
                    <Icon className="text-lg text-outline" name="attach_file" />
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-on-primary">
                    <Icon className="text-xl" name="mic" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 w-full md:pointer-events-none md:fixed md:bottom-10 md:left-1/2 md:max-w-4xl md:-translate-x-1/2 md:px-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-white/40 bg-white/80 p-4 shadow-xl backdrop-blur-md md:pointer-events-auto md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-secondary-fixed/20 p-2 text-secondary">
              <Icon name="verified" />
            </div>
            <div>
              <p className="text-xs font-bold text-on-surface">{selectedTemplate?.name ?? "No template selected"}</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-outline">
                Approved • {recipientEstimate} estimated recipients • {scheduledAt ? "Scheduled" : "Ready to send"}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button className="rounded-xl border border-outline-variant px-6 py-3 text-sm font-bold text-on-surface transition-all hover:bg-surface-container">
              Save Draft
            </button>
            <button
              className="group flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-bold text-on-primary shadow-lg shadow-primary/20 transition-all active:scale-95"
              onClick={() => void launchCampaign()}
            >
              {scheduledAt ? "Queue Campaign" : "Launch Campaign"}
              <Icon className="transition-transform group-hover:translate-x-1" name="arrow_forward" />
            </button>
          </div>
        </div>
        {feedback ? (
          <div className="mx-auto mt-3 max-w-fit rounded-full bg-primary px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-on-primary shadow-lg">
            {feedback}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ContactsPage(props: {
  data: BootstrapData;
  onOpenConversation: (contactId: string, channelId: string, templateId?: string) => Promise<void>;
  onRefresh: (preferredConversationId?: string | null) => Promise<void>;
}) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    company: "",
    labels: "",
    customFields: "",
    segmentMode: "replace"
  });
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [segmentName, setSegmentName] = useState("");
  const [segmentColor, setSegmentColor] = useState("#7ae582");
  const [csvFile, setCsvFile] = useState<File | null>(null);

  async function saveContact(event: FormEvent) {
    event.preventDefault();
    const customFields = Object.fromEntries(
      form.customFields
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [key, ...value] = line.split(":");
          return [key.trim(), value.join(":").trim()];
        })
    );

    await api("/api/contacts", {
      method: "POST",
      body: JSON.stringify({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        email: form.email,
        company: form.company,
        labels: form.labels.split(",").map((label) => label.trim()).filter(Boolean),
        customFields,
        segmentIds: selectedSegments,
        segmentMode: form.segmentMode
      })
    });

    setForm({
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      company: "",
      labels: "",
      customFields: "",
      segmentMode: "replace"
    });
    setSelectedSegments([]);
    await props.onRefresh();
  }

  async function importCsv(event: FormEvent) {
    event.preventDefault();
    if (!csvFile) {
      return;
    }
    const formData = new FormData();
    formData.append("file", csvFile);
    formData.append("segmentIds", selectedSegments.join(","));
    formData.append("segmentMode", form.segmentMode);
    await api("/api/contacts/import", {
      method: "POST",
      body: formData
    });
    setCsvFile(null);
    await props.onRefresh();
  }

  async function createSegment(event: FormEvent) {
    event.preventDefault();
    if (!segmentName.trim()) {
      return;
    }
    await api("/api/segments", {
      method: "POST",
      body: JSON.stringify({
        name: segmentName,
        color: segmentColor
      })
    });
    setSegmentName("");
    setSegmentColor("#7ae582");
    await props.onRefresh();
  }

  return (
    <div className="px-8 pb-10 pt-8">
      <div className="mb-8 grid grid-cols-12 gap-6">
        <div className="col-span-12 flex flex-col justify-between rounded-[2rem] bg-surface-container-low p-8 md:col-span-8">
          <div>
            <span className="font-headline text-sm font-bold uppercase tracking-[0.18em] text-tertiary">Audience Vitality</span>
            <h2 className="mt-2 font-headline text-4xl font-extrabold text-primary">{props.data.contacts.length.toLocaleString()} Active Leads</h2>
            <p className="mt-2 max-w-lg text-on-surface-variant">
              Your contact base is live for CSV updates, real-time conversations, and shared team segmentation.
            </p>
          </div>
          <div className="mt-8 flex flex-col gap-4 md:flex-row">
            <OverviewMetric label="Opt-in Rate" value="89.4%" />
            <OverviewMetric label="CRM Sync" value="Active" />
            <OverviewMetric label="Segments" value={String(props.data.segments.length)} />
          </div>
        </div>
        <div className="col-span-12 flex flex-col justify-end rounded-[2rem] bg-primary p-8 text-on-primary md:col-span-4">
          <div className="mb-6">
            <h3 className="font-headline text-xl font-bold">CRM Synchronization</h3>
            <p className="mt-2 text-sm text-primary-fixed/80">
              Instantly pull contacts from upstream systems, then batch and segment them for WhatsApp outreach.
            </p>
          </div>
          <button className="rounded-xl bg-surface-container-lowest py-3 text-sm font-bold text-primary">Configure Bridge</button>
        </div>
      </div>

      <div className="mb-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr_0.8fr]">
        <div className="rounded-[2rem] bg-surface-container-lowest p-6 shadow-sm">
          <SectionTitle icon="person_add" title="Add Individual Contact" />
          <form className="grid gap-4 md:grid-cols-2" onSubmit={saveContact}>
            <Field label="First name">
              <input className="atrium-input" value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} />
            </Field>
            <Field label="Last name">
              <input className="atrium-input" value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} />
            </Field>
            <Field label="Phone">
              <input className="atrium-input" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
            </Field>
            <Field label="Email">
              <input className="atrium-input" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
            </Field>
            <Field label="Company">
              <input className="atrium-input" value={form.company} onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))} />
            </Field>
            <Field label="Labels">
              <input className="atrium-input" placeholder="vip, support" value={form.labels} onChange={(event) => setForm((current) => ({ ...current, labels: event.target.value }))} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Custom fields">
                <textarea
                  className="atrium-input min-h-[110px]"
                  placeholder={"city: Kuala Lumpur\nproduct: Premium Plan"}
                  value={form.customFields}
                  onChange={(event) => setForm((current) => ({ ...current, customFields: event.target.value }))}
                />
              </Field>
            </div>
            <Field label="Segment update mode">
              <select className="atrium-input" value={form.segmentMode} onChange={(event) => setForm((current) => ({ ...current, segmentMode: event.target.value }))}>
                <option value="replace">Replace</option>
                <option value="add">Add</option>
                <option value="remove">Remove</option>
              </select>
            </Field>
            <div className="md:col-span-2">
              <div className="rounded-2xl bg-surface-container-low p-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-outline">Assign segments</p>
                <div className="flex flex-wrap gap-2">
                  {props.data.segments.map((segment) => {
                    const active = selectedSegments.includes(segment.id);
                    return (
                      <button
                        className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${active ? "bg-primary text-on-primary" : "bg-white text-on-surface-variant"}`}
                        key={segment.id}
                        onClick={() => setSelectedSegments(active ? selectedSegments.filter((id) => id !== segment.id) : [...selectedSegments, segment.id])}
                        type="button"
                      >
                        {segment.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <button className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary shadow-lg shadow-primary/10 transition-all hover:opacity-90 md:col-span-2">
              Save contact
            </button>
          </form>
        </div>

        <div className="rounded-[2rem] bg-surface-container-lowest p-6 shadow-sm">
          <SectionTitle icon="upload_file" title="Bulk Import & Segmenting" />
          <form className="space-y-4" onSubmit={importCsv}>
            <Field label="CSV file">
              <input
                accept=".csv"
                className="atrium-input file:mr-3 file:rounded-xl file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-bold file:text-on-primary"
                type="file"
                onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)}
              />
            </Field>
            <p className="text-xs text-on-surface-variant">Expected columns: firstName, lastName, phone, email, company, labels and any extra custom field columns.</p>
            <button className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-5 py-3 text-sm font-bold text-primary transition-all hover:bg-surface-bright">
              Upload contacts
            </button>
          </form>

          <form className="mt-8 space-y-4" onSubmit={createSegment}>
            <SectionTitle icon="label" title="Create Segment" />
            <Field label="Segment name">
              <input className="atrium-input" value={segmentName} onChange={(event) => setSegmentName(event.target.value)} />
            </Field>
            <Field label="Color">
              <input className="atrium-input h-12" type="color" value={segmentColor} onChange={(event) => setSegmentColor(event.target.value)} />
            </Field>
            <button className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary transition-all hover:opacity-90">
              Create segment
            </button>
          </form>
        </div>

        <div className="rounded-[2rem] bg-surface-container-lowest p-6 shadow-sm">
          <SectionTitle icon="group" title="Segment Overview" />
          <div className="space-y-3">
            {props.data.segments.map((segment) => (
              <div className="flex items-center justify-between rounded-2xl bg-surface-container-low p-4" key={segment.id}>
                <div>
                  <p className="font-bold text-on-surface">{segment.name}</p>
                  <p className="text-xs text-on-surface-variant">
                    {props.data.contacts.filter((contact) => contact.segmentIds.includes(segment.id)).length} contacts
                  </p>
                </div>
                <span className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ backgroundColor: `${segment.color}22`, color: segment.color }}>
                  Live
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-[2rem] border border-outline-variant/20 bg-surface-container-lowest">
        <div className="flex flex-col gap-4 border-b border-outline-variant/10 px-8 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <FilterPill label="Status: All" />
            <FilterPill label="Tag: Enterprise" />
            <FilterPill label="Last Active" />
          </div>
          <div className="flex items-center gap-4 text-xs text-on-surface-variant">
            <span>Showing 1-{props.data.contacts.length} of {props.data.contacts.length} contacts</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface-container-low text-[0.6875rem] font-bold uppercase tracking-wider text-on-surface-variant">
                <th className="w-12 px-8 py-4">
                  <input className="rounded border-outline-variant text-primary focus:ring-primary/20" type="checkbox" />
                </th>
                <th className="px-4 py-4">Contact Profile</th>
                <th className="px-4 py-4">Phone Number</th>
                <th className="px-4 py-4">Segments & Tags</th>
                <th className="px-4 py-4">Last Activity</th>
                <th className="px-4 py-4 text-center">Opt-In</th>
                <th className="px-8 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {props.data.contacts.map((contact, index) => (
                <tr className="group transition-all hover:bg-surface-bright" key={contact.id}>
                  <td className="border-l-4 border-transparent px-8 py-5 group-hover:border-primary">
                    <input className="rounded border-outline-variant text-primary focus:ring-primary/20" type="checkbox" />
                  </td>
                  <td className="px-4 py-5">
                    <div className="flex items-center gap-3">
                      <Avatar label={fullName(contact)} size="h-10 w-10" />
                      <div>
                        <div className="text-sm font-bold text-on-surface">{fullName(contact)}</div>
                        <div className="text-xs text-on-surface-variant">{contactRoles[index % contactRoles.length]}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-5 text-sm font-medium text-on-surface-variant">{contact.phone}</td>
                  <td className="px-4 py-5">
                    <div className="flex flex-wrap gap-1">
                      {contact.segmentIds.map((segmentId) => (
                        <span className="rounded-md bg-primary-fixed px-2 py-0.5 text-[10px] font-bold text-on-primary-fixed-variant" key={segmentId}>
                          {resolveLabel(segmentId, props.data)}
                        </span>
                      ))}
                      {contact.labels.map((label) => (
                        <span className="rounded-md bg-surface-container px-2 py-0.5 text-[10px] font-bold text-on-surface-variant" key={label}>
                          {label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-5 text-xs text-on-surface-variant">{formatRelativeChatTime(new Date(Date.now() - (index + 1) * 3600_000).toISOString())}</td>
                  <td className="px-4 py-5">
                    <div className="flex justify-center">
                      <div className={`h-2 w-2 rounded-full ring-4 ${index % 4 === 3 ? "bg-error ring-error/10" : "bg-secondary ring-secondary/10"}`} />
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex justify-end gap-2">
                      <button
                        className="rounded-xl border border-outline-variant/20 px-3 py-2 text-xs font-bold text-primary transition-all hover:bg-surface-container-low"
                        onClick={() => void props.onOpenConversation(contact.id, props.data.channels[0]?.id ?? "", props.data.templates[0]?.id)}
                      >
                        Broadcast
                      </button>
                      <button
                        className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-on-primary transition-all hover:opacity-90"
                        onClick={() => void props.onOpenConversation(contact.id, props.data.channels[0]?.id ?? "")}
                      >
                        Chat
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function AnalyticsPage(props: { data: BootstrapData }) {
  const analytics = useMemo(() => buildAnalyticsSummary(props.data), [props.data]);

  return (
    <div className="px-8 pb-12 pt-8">
      <div className="mb-10 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-1">
          <h1 className="font-headline text-[2.75rem] font-extrabold leading-none tracking-tight text-primary">Campaign Analytics</h1>
          <p className="font-medium text-on-surface-variant">Performance insights for the current live workspace snapshot</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 rounded-xl bg-surface-container-lowest px-5 py-2.5 text-sm font-semibold text-primary outline outline-1 outline-outline-variant/20 transition-all hover:bg-slate-50">
            <Icon className="text-lg" name="calendar_today" />
            Last 30 Days
          </button>
          <button className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:opacity-90">
            <Icon className="text-lg" name="download" />
            Export Report
          </button>
        </div>
      </div>

      <section className="mb-10 grid gap-6 md:grid-cols-4">
        <AnalyticsMetricCard icon="send" label="Total Sent" value={analytics.totalSent.toLocaleString()} badge="+12.5%" accent="primary" />
        <AnalyticsMetricCard icon="done_all" label="Delivered" value={analytics.delivered.toLocaleString()} badge={`${analytics.deliveryRate}%`} accent="secondary" />
        <AnalyticsMetricCard icon="visibility" label="Read Rate" value={analytics.readEstimate.toLocaleString()} badge={`${analytics.readRate}%`} accent="primary" />
        <AnalyticsMetricCard icon="chat_bubble" label="Replied" value={analytics.replyEstimate.toLocaleString()} badge={`${analytics.replyRate}%`} accent="tertiary" />
      </section>

      <section className="mb-10 grid gap-8 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-full bg-surface-container-lowest p-8 shadow-[0_32px_64px_-12px_rgba(0,69,61,0.06)] lg:col-span-2">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="font-headline text-xl font-bold text-primary">Engagement Trends</h2>
              <p className="text-sm text-on-surface-variant">Campaign activity built from recent send volume and reply movement.</p>
            </div>
            <div className="flex gap-2">
              <LegendPill color="bg-primary" label="Sent" textColor="text-primary" />
              <LegendPill color="bg-secondary" label="Read" textColor="text-secondary" />
            </div>
          </div>
          <div className="flex h-64 items-end gap-2">
            {analytics.trendBars.map((height, index) => (
              <div className={`group relative flex-1 rounded-t-lg transition-all ${index === analytics.highlightedBar ? "bg-primary/80" : "bg-surface-container-high hover:bg-primary/20"}`} key={index} style={{ height: `${height}%` }}>
                {index === analytics.highlightedBar ? (
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 rounded bg-primary px-2 py-1 text-[10px] text-on-primary">
                    {Math.round((analytics.totalSent / analytics.trendBars.length) * (height / 100)).toLocaleString()}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between px-1 text-[10px] font-bold text-on-surface-variant">
            <span>W1</span>
            <span>W2</span>
            <span>W3</span>
            <span>W4</span>
            <span>Now</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-full bg-primary p-8 text-on-primary">
          <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-primary-container opacity-20" />
          <div>
            <h2 className="font-headline text-xl font-bold">Executive Summary</h2>
            <p className="mb-6 mt-2 text-sm leading-relaxed text-primary-fixed/80">
              Delivery reliability remains strong, and reply activity is concentrated in the same campaigns driving the highest template engagement.
            </p>
            <div className="space-y-4">
              <ProgressCard label="Conversion Goal" value={Math.min(96, analytics.replyRate + 54)} />
              <ProgressCard label="Customer Retention" value={Math.min(98, analytics.deliveryRate - 2)} secondary />
            </div>
          </div>
          <button className="mt-8 w-full rounded-xl bg-primary-fixed py-3 text-sm font-bold text-on-primary-fixed">View Full Insight Report</button>
        </div>
      </section>

      <section className="overflow-hidden rounded-full bg-surface-container-low">
        <div className="flex items-center justify-between px-8 py-6">
          <h2 className="font-headline text-xl font-bold text-primary">Recent Campaigns</h2>
          <select className="border-none bg-transparent text-sm font-semibold text-on-surface-variant focus:ring-0">
            <option>Sort by Date</option>
            <option>Sort by Performance</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-container-high/50 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">
                <th className="px-8 py-4">Campaign Name</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4">Sent</th>
                <th className="px-8 py-4">Read Rate</th>
                <th className="px-8 py-4">ROI</th>
                <th className="px-8 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium">
              {props.data.campaigns.map((campaign, index) => {
                const sent = campaign.stats.attempted || campaign.stats.delivered || (index + 1) * 1200;
                const rate = sent ? Math.round((campaign.stats.delivered / Math.max(1, sent)) * 100) : 0;
                const roi = (campaign.stats.delivered * 0.09 + 1).toFixed(1);
                return (
                  <tr className="group border-b border-surface-container-high transition-all hover:bg-surface-bright last:border-0" key={campaign.id}>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-high text-primary transition-colors group-hover:bg-primary group-hover:text-on-primary">
                          <Icon name={index % 3 === 0 ? "shopping_bag" : index % 3 === 1 ? "loyalty" : "notifications_active"} />
                        </div>
                        <div>
                          <p className="font-bold text-on-surface">{campaign.name}</p>
                          <p className="text-xs text-on-surface-variant">{campaign.status} • {campaign.scheduledAt ? formatLongDate(campaign.scheduledAt) : "Immediate"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${campaign.status === "sent" ? "bg-secondary/10 text-secondary" : "bg-primary/10 text-primary"}`}>
                        {campaign.status === "sent" ? "Completed" : "Active"}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-on-surface-variant">{sent.toLocaleString()}</td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{rate}%</span>
                        <div className="h-1 w-12 overflow-hidden rounded-full bg-surface-container-highest">
                          <div className="h-full bg-primary" style={{ width: `${Math.min(rate, 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 font-bold text-emerald-700">{roi}x</td>
                    <td className="px-8 py-6 text-right">
                      <button className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-surface-container-high hover:text-primary">
                        <Icon name="more_vert" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function TemplatesStudioPage(props: { data: BootstrapData; onRefresh: (preferredConversationId?: string | null) => Promise<void> }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    category: "utility",
    body: "",
    placeholders: "",
    mediaUrl: "",
    ctaLabel: "",
    ctaUrl: ""
  });
  const [status, setStatus] = useState<string | null>(null);
  const [syncingApproved, setSyncingApproved] = useState(false);
  const [syncingTemplateId, setSyncingTemplateId] = useState<string | null>(null);

  async function saveTemplate(event: FormEvent) {
    event.preventDefault();
    await api(`/api/templates${editingId ? `/${editingId}` : ""}`, {
      method: editingId ? "PUT" : "POST",
      body: JSON.stringify({
        ...form,
        placeholders: form.placeholders.split(",").map((item) => item.trim()).filter(Boolean)
      })
    });
    setStatus(`Template ${editingId ? "updated" : "created"}.`);
    setForm({
      name: "",
      category: "utility",
      body: "",
      placeholders: "",
      mediaUrl: "",
      ctaLabel: "",
      ctaUrl: ""
    });
    setEditingId(null);
    setShowForm(false);
    await props.onRefresh();
  }

  async function deleteTemplate(template: Template) {
    if (!confirm(`Are you sure you want to delete template "${template.name}"?`)) return;
    try {
      await api(`/api/templates/${template.id}`, { method: "DELETE" });
      setStatus(`Template "${template.name}" deleted.`);
      await props.onRefresh();
    } catch (err) {
      setStatus("Failed to delete template");
    }
  }

  async function syncApprovedTemplates() {
    setSyncingApproved(true);
    try {
      const result = await api<{ synced: boolean; count: number; reason?: string }>("/api/templates/sync-approved", {
        method: "POST"
      });
      setStatus(result.synced ? `Synced ${result.count} approved templates from Twilio.` : result.reason ?? "Approved sync failed");
      await props.onRefresh();
    } finally {
      setSyncingApproved(false);
    }
  }

  async function syncTemplate(template: Template) {
    setSyncingTemplateId(template.id);
    try {
      const result = await api<{ sid: string | null; synced: boolean; reason?: string }>(`/api/templates/${template.id}/sync`, {
        method: "POST"
      });
      setStatus(result.synced ? `${template.name} pushed to Twilio Content API.` : result.reason ?? "Sync failed");
      await props.onRefresh();
    } finally {
      setSyncingTemplateId(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-8 pb-12 pt-8">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div className="sm:flex-auto">
          <h1 className="font-headline text-[2.5rem] font-extrabold tracking-tight text-primary">Message Templates</h1>
          <p className="mt-2 text-on-surface-variant">Manage your WhatsApp message templates synced from Twilio Content API.</p>
        </div>
        <div className="mt-4 flex items-center space-x-3 sm:ml-16 sm:mt-0 sm:flex-none">
          <button
            className="inline-flex items-center justify-center rounded-xl border border-outline-variant/30 bg-white px-5 py-3 text-sm font-bold text-primary shadow-sm transition-all hover:bg-surface-container disabled:opacity-50"
            disabled={syncingApproved}
            onClick={() => void syncApprovedTemplates()}
          >
            <Icon name="sync" className={`mr-2 ${syncingApproved ? "animate-spin" : ""}`} />
            {syncingApproved ? "Syncing..." : "Sync Twilio"}
          </button>
          <button
            className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:opacity-90"
            onClick={() => {
              if (showForm) {
                setShowForm(false);
                setEditingId(null);
              } else {
                setForm({
                  name: "",
                  category: "utility",
                  body: "",
                  placeholders: "",
                  mediaUrl: "",
                  ctaLabel: "",
                  ctaUrl: ""
                });
                setShowForm(true);
              }
            }}
          >
            <Icon name={showForm ? "close" : "add"} className="mr-2" />
            {showForm ? "Cancel" : "New Template"}
          </button>
        </div>
      </div>

      {showForm ? (
        <div className="mt-8 rounded-[2rem] bg-surface-container-lowest p-6 shadow-sm lg:w-1/2">
          <form className="space-y-4" onSubmit={saveTemplate}>
            <Field label="Template name">
              <input className="atrium-input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </Field>
            <Field label="Category">
              <select className="atrium-input" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
                <option value="utility">Utility</option>
                <option value="marketing">Marketing</option>
                <option value="authentication">Authentication</option>
              </select>
            </Field>
            <Field label="Body">
              <textarea className="atrium-input min-h-[120px]" value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} />
            </Field>
            <Field label="Placeholders">
              <input className="atrium-input" placeholder="first_name, company, city" value={form.placeholders} onChange={(event) => setForm((current) => ({ ...current, placeholders: event.target.value }))} />
            </Field>
            <Field label="Media URL">
              <input className="atrium-input" value={form.mediaUrl} onChange={(event) => setForm((current) => ({ ...current, mediaUrl: event.target.value }))} />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="CTA label">
                <input className="atrium-input" value={form.ctaLabel} onChange={(event) => setForm((current) => ({ ...current, ctaLabel: event.target.value }))} />
              </Field>
              <Field label="CTA URL">
                <input className="atrium-input" value={form.ctaUrl} onChange={(event) => setForm((current) => ({ ...current, ctaUrl: event.target.value }))} />
              </Field>
            </div>
            <button type="submit" className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary">
              {editingId ? "Update template" : "Save template"}
            </button>
            {status ? <div className="rounded-2xl bg-primary-fixed/20 px-4 py-3 text-sm font-semibold text-primary">{status}</div> : null}
          </form>
        </div>
      ) : null}

      {!showForm && status ? (
        <div className="mt-4 inline-flex items-center rounded-2xl bg-primary-fixed/20 px-4 py-3 text-sm font-semibold text-primary">{status}</div>
      ) : null}

      <div className="mt-8 flex flex-col">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden rounded-2xl shadow ring-1 ring-outline-variant/10">
              <table className="min-w-full divide-y divide-outline-variant/10">
                <thead className="bg-surface-container-low">
                  <tr>
                    <th scope="col" className="py-4 pl-4 pr-3 text-left text-[11px] font-bold uppercase tracking-wider text-on-surface-variant sm:pl-6">Name / SID</th>
                    <th scope="col" className="px-3 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Body Preview</th>
                    <th scope="col" className="px-3 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Variables</th>
                    <th scope="col" className="px-3 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Category</th>
                    <th scope="col" className="relative py-4 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10 bg-white">
                  {!props.data.templates.length ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-sm text-on-surface-variant">No templates found. Create one or sync.</td>
                    </tr>
                  ) : props.data.templates.map((template) => (
                    <tr key={template.id} className="transition-colors hover:bg-surface-bright">
                      <td className="whitespace-nowrap py-5 pl-4 pr-3 text-sm font-bold text-primary sm:pl-6 align-top">
                        {template.name}
                        <div className="mt-1 text-xs font-mono font-medium text-on-surface-variant">
                          {template.twilioContentSid || "Local Draft"}
                        </div>
                      </td>
                      <td className="px-3 py-5 max-w-sm align-top">
                        <div className="flex flex-col space-y-2">
                          {template.mediaUrl && (
                            <div className="flex w-fit items-center rounded bg-primary-fixed/30 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                              <Icon name="image" className="mr-1.5 text-xs" />
                              Media Attached
                            </div>
                          )}
                          <div className="whitespace-pre-wrap text-sm text-on-surface line-clamp-3" title={template.body}>
                            {template.body}
                          </div>
                          {(template.ctaLabel || template.ctaUrl) && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <div className="flex items-center rounded border border-outline-variant/20 bg-surface-container-low px-2 py-1 text-xs font-bold text-primary">
                                <Icon name={template.ctaUrl?.startsWith("tel:") ? "call" : "open_in_new"} className="mr-1.5 text-xs" />
                                {template.ctaLabel || "Button"}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-5 text-sm text-on-surface-variant align-top">
                        {template.placeholders && template.placeholders.length > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-secondary-fixed px-2.5 py-0.5 text-xs font-bold text-on-secondary-fixed">
                            {template.placeholders.length} vars
                          </span>
                        ) : (
                          <span className="text-outline">None</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-5 align-top">
                        <span className="inline-flex rounded-full bg-surface-container-highest px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface">
                          {template.category}
                        </span>
                      </td>
                      <td className="relative whitespace-nowrap py-5 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 align-top">
                        <button
                          className="mr-3 text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
                          disabled={syncingTemplateId === template.id}
                          onClick={() => void syncTemplate(template)}
                          title="Push local changes to Twilio"
                        >
                          <Icon name="cloud_upload" className="text-lg" />
                        </button>
                        <button 
                          className="mr-3 text-outline hover:text-primary transition-colors" 
                          title="Edit Template"
                          onClick={() => {
                            setEditingId(template.id);
                            setForm({
                              name: template.name,
                              category: template.category,
                              body: template.body,
                              placeholders: template.placeholders.join(", "),
                              mediaUrl: template.mediaUrl || "",
                              ctaLabel: template.ctaLabel || "",
                              ctaUrl: template.ctaUrl || ""
                            });
                            setShowForm(true);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >
                          <Icon name="edit" className="text-lg" />
                        </button>
                        <button 
                          className="text-error hover:text-error/80 transition-colors" 
                          title="Delete Template"
                          onClick={() => void deleteTemplate(template)}
                        >
                          <Icon name="delete" className="text-lg" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


function AutomationsStudioPage(props: { data: BootstrapData; onRefresh: (preferredConversationId?: string | null) => Promise<void> }) {
  const [form, setForm] = useState({
    name: "Keyword autoresponder",
    triggerType: "incoming_keyword",
    triggerValue: "price",
    templateId: props.data.templates[0]?.id ?? "",
    channelId: props.data.channels[0]?.id ?? "",
    segmentId: props.data.segments[0]?.id ?? "",
    delayMinutes: "0"
  });

  async function saveAutomation(event: FormEvent) {
    event.preventDefault();
    await api("/api/automations", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        delayMinutes: Number(form.delayMinutes)
      })
    });
    await props.onRefresh();
  }

  return (
    <StudioPageShell title="Automation Studio" subtitle="Run template workflows for keyword replies, new contacts, and segment entries.">
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-[2rem] bg-surface-container-lowest p-6 shadow-sm">
          <form className="space-y-4" onSubmit={saveAutomation}>
            <Field label="Workflow name">
              <input className="atrium-input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </Field>
            <Field label="Trigger type">
              <select className="atrium-input" value={form.triggerType} onChange={(event) => setForm((current) => ({ ...current, triggerType: event.target.value }))}>
                <option value="incoming_keyword">Incoming keyword</option>
                <option value="new_contact">New contact</option>
                <option value="segment_joined">Segment joined</option>
              </select>
            </Field>
            {form.triggerType === "incoming_keyword" ? (
              <Field label="Keyword">
                <input className="atrium-input" value={form.triggerValue} onChange={(event) => setForm((current) => ({ ...current, triggerValue: event.target.value }))} />
              </Field>
            ) : null}
            {form.triggerType === "segment_joined" ? (
              <Field label="Segment">
                <select className="atrium-input" value={form.segmentId} onChange={(event) => setForm((current) => ({ ...current, segmentId: event.target.value }))}>
                  {props.data.segments.map((segment) => (
                    <option key={segment.id} value={segment.id}>
                      {segment.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            <Field label="Template">
              <select className="atrium-input" value={form.templateId} onChange={(event) => setForm((current) => ({ ...current, templateId: event.target.value }))}>
                {props.data.templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Channel">
              <select className="atrium-input" value={form.channelId} onChange={(event) => setForm((current) => ({ ...current, channelId: event.target.value }))}>
                {props.data.channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Delay minutes">
              <input className="atrium-input" value={form.delayMinutes} onChange={(event) => setForm((current) => ({ ...current, delayMinutes: event.target.value }))} />
            </Field>
            <button className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary">Save automation</button>
          </form>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {props.data.automations.map((automation) => (
            <div className="rounded-[2rem] bg-surface-container-low p-6" key={automation.id}>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-outline">{automation.triggerType.replaceAll("_", " ")}</p>
              <h3 className="mt-2 font-headline text-lg font-bold text-primary">{automation.name}</h3>
              <p className="mt-2 text-sm text-on-surface-variant">
                Sends {props.data.templates.find((template) => template.id === automation.templateId)?.name ?? "template"} from {props.data.channels.find((channel) => channel.id === automation.channelId)?.name ?? "selected channel"} after {automation.delayMinutes} minutes.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-bold text-secondary">{automation.isActive ? "Active" : "Paused"}</span>
                {automation.triggerValue ? (
                  <span className="rounded-full bg-primary-fixed/20 px-3 py-1 text-xs font-bold text-primary">{automation.triggerValue}</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </StudioPageShell>
  );
}

function SettingsStudioPage(props: { data: BootstrapData; onRefresh: (preferredConversationId?: string | null) => Promise<void> }) {
  const [channelForm, setChannelForm] = useState({
    name: "",
    whatsappNumber: "",
    messagingServiceSid: ""
  });
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    role: "agent"
  });

  async function addChannel(event: FormEvent) {
    event.preventDefault();
    await api("/api/channels", {
      method: "POST",
      body: JSON.stringify(channelForm)
    });
    setChannelForm({
      name: "",
      whatsappNumber: "",
      messagingServiceSid: ""
    });
    await props.onRefresh();
  }

  async function addUser(event: FormEvent) {
    event.preventDefault();
    await api("/api/users", {
      method: "POST",
      body: JSON.stringify(userForm)
    });
    setUserForm({
      name: "",
      email: "",
      role: "agent"
    });
    await props.onRefresh();
  }

  return (
    <StudioPageShell title="Shared Settings" subtitle="Manage multi-user access and multiple WhatsApp senders for the same workspace.">
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[2rem] bg-surface-container-lowest p-6 shadow-sm">
          <SectionTitle icon="call" title="Add WhatsApp Number" />
          <form className="space-y-4" onSubmit={addChannel}>
            <Field label="Channel name">
              <input className="atrium-input" value={channelForm.name} onChange={(event) => setChannelForm((current) => ({ ...current, name: event.target.value }))} />
            </Field>
            <Field label="WhatsApp number">
              <input className="atrium-input" placeholder="whatsapp:+14155238886" value={channelForm.whatsappNumber} onChange={(event) => setChannelForm((current) => ({ ...current, whatsappNumber: event.target.value }))} />
            </Field>
            <Field label="Messaging service SID">
              <input className="atrium-input" value={channelForm.messagingServiceSid} onChange={(event) => setChannelForm((current) => ({ ...current, messagingServiceSid: event.target.value }))} />
            </Field>
            <button className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary">Add number</button>
          </form>
          <div className="mt-6 space-y-3">
            {props.data.channels.map((channel) => (
              <div className="flex items-center justify-between rounded-2xl bg-surface-container-low p-4" key={channel.id}>
                <div>
                  <p className="font-bold text-on-surface">{channel.name}</p>
                  <p className="text-xs text-on-surface-variant">{channel.whatsappNumber}</p>
                </div>
                <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-bold text-secondary">{channel.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] bg-surface-container-lowest p-6 shadow-sm">
          <SectionTitle icon="group" title="Add Team Member" />
          <form className="space-y-4" onSubmit={addUser}>
            <Field label="Name">
              <input className="atrium-input" value={userForm.name} onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))} />
            </Field>
            <Field label="Email">
              <input className="atrium-input" value={userForm.email} onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))} />
            </Field>
            <Field label="Role">
              <select className="atrium-input" value={userForm.role} onChange={(event) => setUserForm((current) => ({ ...current, role: event.target.value }))}>
                <option value="agent">Agent</option>
                <option value="owner">Owner</option>
              </select>
            </Field>
            <button className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary">Invite teammate</button>
          </form>
          <div className="mt-6 space-y-3">
            {props.data.users.map((user) => (
              <div className="flex items-center justify-between rounded-2xl bg-surface-container-low p-4" key={user.id}>
                <div className="flex items-center gap-3">
                  <Avatar label={user.name} size="h-10 w-10" />
                  <div>
                    <p className="font-bold text-on-surface">{user.name}</p>
                    <p className="text-xs text-on-surface-variant">{user.email}</p>
                  </div>
                </div>
                <span className="rounded-full bg-primary-fixed/20 px-3 py-1 text-xs font-bold text-primary">{user.role}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </StudioPageShell>
  );
}

function StudioPageShell(props: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="px-8 pb-12 pt-8">
      <div className="mb-8">
        <h1 className="font-headline text-[2.5rem] font-extrabold tracking-tight text-primary">{props.title}</h1>
        <p className="mt-2 text-on-surface-variant">{props.subtitle}</p>
      </div>
      {props.children}
    </div>
  );
}

function MessageBubble(props: { message: Conversation["messages"][number]; previousMessage?: Conversation["messages"][number] }) {
  const outgoing = props.message.direction === "outbound";
  const isManualReply = props.message.metadata?.source === "manual-reply";

  return (
    <div className={`flex flex-col gap-1 ${outgoing ? "items-end" : "items-start"}`}>
      {outgoing && isManualReply && props.previousMessage?.direction !== "outbound" ? (
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary italic">Agent: Sarah</span>
        </div>
      ) : null}
      <div className={`max-w-[70%] overflow-hidden rounded-xl p-4 shadow-sm ${outgoing ? "rounded-br-sm bg-primary text-on-primary shadow-md" : "rounded-bl-sm bg-surface-container-highest text-on-surface"}`}>
        {props.message.mediaUrl ? <img alt="Message attachment" className="mb-3 max-h-64 w-full rounded-lg object-cover" src={props.message.mediaUrl} /> : null}
        <p className="text-sm leading-relaxed">{props.message.body}</p>
      </div>
      <div className="flex items-center gap-1 px-1">
        <span className="text-[10px] text-slate-400">{formatClockTime(props.message.createdAt)}</span>
        {outgoing ? <Icon className="text-[14px] text-primary-fixed" fill name="done_all" /> : null}
      </div>
    </div>
  );
}

function AnalyticsMetricCard(props: { icon: string; label: string; value: string; badge: string; accent: "primary" | "secondary" | "tertiary" }) {
  const accentStyles = {
    primary: "bg-primary/5 text-primary",
    secondary: "bg-secondary/5 text-secondary",
    tertiary: "bg-tertiary/5 text-tertiary"
  };

  return (
    <div className="rounded-full bg-surface-container-low p-6 transition-all duration-300 hover:bg-surface-container-lowest">
      <div className="mb-4 flex items-start justify-between">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${accentStyles[props.accent]}`}>
          <Icon name={props.icon} />
        </div>
        <span className="flex items-center rounded-lg bg-secondary/10 px-2 py-1 text-xs font-bold text-secondary">
          {props.badge}
          <Icon className="ml-0.5 text-xs" name="trending_up" />
        </span>
      </div>
      <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">{props.label}</h3>
      <p className="font-headline text-3xl font-bold text-primary">{props.value}</p>
    </div>
  );
}

function WizardStep(props: { index: number; label: string; status: string; dim?: boolean }) {
  const active = !props.dim && props.status === "selected";
  const pending = !props.dim && props.status === "pending";
  return (
    <div className={`flex items-center gap-4 ${props.dim ? "opacity-50" : ""}`}>
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-full font-bold ${
          active ? "bg-primary text-on-primary" : pending ? "bg-primary-container text-on-primary-container" : "border border-outline-variant bg-surface-container-highest text-on-surface"
        }`}
      >
        {props.index}
      </div>
      <div className="flex flex-col">
        <span className={`text-sm font-bold ${active || pending ? "text-primary" : "text-on-surface"}`}>{props.label}</span>
        <span className="text-[10px] uppercase tracking-wider text-outline">{props.status}</span>
      </div>
    </div>
  );
}

function MarketingPill(props: { title: string; subtitle: string; icon: string }) {
  return (
    <div className="rounded-[1.5rem] border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-fixed/30 text-primary">
        <Icon name={props.icon} />
      </div>
      <h3 className="font-headline text-lg font-bold text-primary">{props.title}</h3>
      <p className="mt-1 text-sm text-on-surface-variant">{props.subtitle}</p>
    </div>
  );
}

function OverviewMetric(props: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-4">
      <div className="text-xs font-semibold text-on-surface-variant">{props.label}</div>
      <div className="text-2xl font-bold text-primary">{props.value}</div>
    </div>
  );
}

function ProgressCard(props: { label: string; value: number; secondary?: boolean }) {
  return (
    <div className="rounded-xl bg-primary-container/40 p-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium">{props.label}</span>
        <span className="text-xs font-bold">{props.value}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary-container/20">
        <div className={`h-full ${props.secondary ? "bg-secondary-fixed" : "bg-primary-fixed"}`} style={{ width: `${props.value}%` }} />
      </div>
    </div>
  );
}

function AtriumNavLink(props: { to: string; label: string; icon: string; compact?: boolean; collapsed?: boolean }) {
  return (
    <NavLink
      className={({ isActive }) =>
        [
          "relative flex items-center rounded-xl px-4 transition-all duration-200 ease-in-out",
          props.collapsed ? "justify-center px-3" : "gap-3",
          props.compact ? "py-2.5 text-xs font-semibold" : "py-3 text-sm font-medium",
          isActive
            ? "font-bold text-emerald-900 after:absolute after:right-0 after:h-6 after:w-1 after:rounded-l-full after:bg-orange-900"
            : "text-slate-500 hover:bg-slate-200/50 hover:text-emerald-800"
        ].join(" ")
      }
      title={props.collapsed ? props.label : undefined}
      to={props.to}
    >
      <Icon className={props.compact ? "text-base" : ""} name={props.icon} />
      {!props.collapsed ? <span>{props.label}</span> : null}
    </NavLink>
  );
}

function SidebarUtility(props: { label: string; icon: string; collapsed?: boolean }) {
  return (
    <a
      className={`flex rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-500 transition-all hover:bg-slate-200/50 hover:text-emerald-800 ${
        props.collapsed ? "justify-center" : "items-center gap-3"
      }`}
      href="#"
      title={props.collapsed ? props.label : undefined}
    >
      <Icon className="text-lg" name={props.icon} />
      {!props.collapsed ? <span>{props.label}</span> : null}
    </a>
  );
}

function SectionTitle(props: { title: string; icon: string }) {
  return (
    <h2 className="mb-6 flex items-center gap-2 font-headline text-lg font-bold text-primary">
      <Icon name={props.icon} />
      {props.title}
    </h2>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-on-surface">{props.label}</span>
      {props.children}
    </label>
  );
}

function FilterPill(props: { label: string }) {
  return (
    <div className="flex cursor-pointer items-center gap-2 rounded-full bg-surface-container-low px-4 py-2 transition-colors hover:bg-surface-container">
      <span className="text-xs font-bold text-on-surface">{props.label}</span>
      <Icon className="text-sm" name="expand_more" />
    </div>
  );
}

function LegendPill(props: { color: string; label: string; textColor: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg bg-white px-3 py-1 text-xs font-bold ${props.textColor}`}>
      <span className={`h-2 w-2 rounded-full ${props.color}`} />
      {props.label}
    </div>
  );
}

function InfoCard(props: { title: string; action?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl bg-surface-container-lowest p-4">
      <div className="flex items-center justify-between">
        <h5 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{props.title}</h5>
        {props.action ? <button className="text-[10px] font-bold text-primary">{props.action}</button> : null}
      </div>
      {props.children}
    </div>
  );
}

function InfoLine(props: { icon: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="text-sm text-slate-400" name={props.icon} />
      <span className="truncate text-xs font-medium text-on-surface-variant">{props.value}</span>
    </div>
  );
}

function NoteCard(props: { text: string; meta: string }) {
  return (
    <div className="rounded-lg bg-background p-2">
      <p className="text-[11px] leading-snug text-on-surface">{props.text}</p>
      <span className="mt-1 block text-[9px] text-slate-400">{props.meta}</span>
    </div>
  );
}

function TimelineEntry(props: { title: string; meta: string; icon: string; accent?: boolean }) {
  return (
    <div className="relative flex gap-3">
      <div className={`z-10 flex h-4 w-4 items-center justify-center rounded-full ${props.accent ? "bg-secondary text-white" : "bg-slate-200 text-slate-500"}`}>
        <Icon className="text-[8px]" fill={props.accent} name={props.icon} />
      </div>
      <div className="flex-1">
        <p className="text-[11px] font-bold text-on-surface">{props.title}</p>
        <p className="text-[10px] text-slate-400">{props.meta}</p>
      </div>
    </div>
  );
}

function Avatar(props: { label: string; size?: string }) {
  const initials = props.label
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br from-primary-fixed via-secondary-fixed to-primary text-sm font-bold text-primary ${props.size ?? "h-10 w-10"} rounded-full`}>
      {initials}
    </div>
  );
}

function Icon(props: { name: string; className?: string; fill?: boolean }) {
  return (
    <span className={`material-symbols-outlined ${props.className ?? ""}`} style={props.fill ? { fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24" } : undefined}>
      {props.name}
    </span>
  );
}

function fullName(contact: Contact) {
  return `${contact.firstName} ${contact.lastName}`.trim();
}

function formatClockTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatLongDate(value: string) {
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatRelativeChatTime(value: string) {
  const date = new Date(value).getTime();
  const diffMinutes = Math.max(0, Math.floor((Date.now() - date) / 60000));
  if (diffMinutes < 1) {
    return "Just now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }
  if (diffMinutes < 1440) {
    return `${Math.floor(diffMinutes / 60)}h`;
  }
  return new Date(value).toLocaleDateString([], { month: "short", day: "numeric" });
}

function resolveLabel(value: string, data: BootstrapData) {
  return data.segments.find((segment) => segment.id === value)?.name ?? value;
}

function deriveContactRole(contact: Contact) {
  const basis = (contact.firstName.charCodeAt(0) || 0) + (contact.lastName.charCodeAt(0) || 0);
  return contactRoles[basis % contactRoles.length];
}

function deriveLocation(contact: Contact) {
  const city = contact.customFields.city;
  if (city) {
    return city;
  }
  const basis = (contact.firstName.length + contact.lastName.length + (contact.company?.length ?? 0)) % companyLocations.length;
  return companyLocations[basis];
}

function buildFakeEmail(contact: Contact) {
  const slug = `${contact.firstName}.${contact.lastName}`.replace(/\s+/g, "").toLowerCase();
  return `${slug}@${(contact.company ?? "atrium-client").replace(/\s+/g, "").toLowerCase()}.io`;
}

function renderTemplatePreview(template: Template | undefined, contact: Contact | undefined) {
  if (!template) {
    return "No template selected.";
  }
  const sampleName = contact?.firstName ?? "there";
  const sampleCompany = contact?.company ?? "your team";
  const values: Record<string, string> = {
    first_name: sampleName,
    customer_name: sampleName,
    customer: sampleName,
    name: sampleName,
    company: sampleCompany,
    company_name: sampleCompany,
    email: contact?.email ?? "contact@atrium.io",
    phone: contact?.phone ?? "+1 555 000 0000"
  };
  return template.body
    .replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
      const trimmed = String(key).trim();
      if (/^\d+$/.test(trimmed)) {
        const mapped = template.placeholders[Number(trimmed) - 1];
        return mapped ? values[mapped] ?? `{{${mapped}}}` : "{{value}}";
      }
      return values[trimmed] ?? `{{${trimmed}}}`;
    });
}

function buildAnalyticsSummary(data: BootstrapData) {
  const totalSent =
    data.campaigns.reduce((sum, campaign) => sum + Math.max(campaign.stats.attempted, campaign.stats.delivered), 0) ||
    data.conversations.reduce((sum, conversation) => sum + conversation.messages.filter((message) => message.direction === "outbound").length * 120, 0);
  const delivered = data.campaigns.reduce((sum, campaign) => sum + campaign.stats.delivered, 0) || Math.round(totalSent * 0.92);
  const readEstimate = Math.round(delivered * 0.845);
  const replyEstimate = data.conversations.reduce((sum, conversation) => sum + conversation.messages.filter((message) => message.direction === "inbound").length, 0) * 24;
  const deliveryRate = totalSent ? Math.round((delivered / totalSent) * 100) : 0;
  const readRate = delivered ? Math.round((readEstimate / delivered) * 100) : 0;
  const replyRate = delivered ? Math.round((replyEstimate / delivered) * 100) : 0;
  return {
    totalSent,
    delivered,
    readEstimate,
    replyEstimate,
    deliveryRate,
    readRate,
    replyRate,
    trendBars: [40, 65, 55, 85, 70, 45, 60, 90, 75, 95, 65, 50],
    highlightedBar: 3
  };
}
