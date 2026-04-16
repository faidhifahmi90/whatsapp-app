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
            <img src="/logo.png" alt="tomorrowX" className="h-5 w-5 rounded-md" />
            Verified WhatsApp Operations Hub
          </div>
          <div className="space-y-5">
            <h1 className="font-headline text-5xl font-extrabold leading-tight text-primary sm:text-6xl">
              tomorrowX for live WhatsApp sales, support, and campaigns.
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
            <p className="font-label text-xs font-bold uppercase tracking-[0.3em] text-outline">tomorrowX Access</p>
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

function TemplateLivePreview(props: { template?: Template; variables: string[]; overrideMediaUrl?: string }) {
  if (!props.template) {
    return (
      <div className="flex h-64 w-full items-center justify-center rounded-2xl border border-dashed border-outline-variant/30 text-sm font-medium text-slate-400">
        No template selected
      </div>
    );
  }

  const renderedBody = props.template.body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const trimmed = String(key).trim();
    let idx = props.template?.placeholders?.indexOf(trimmed) ?? -1;
    if (idx === -1 && /^\d+$/.test(trimmed)) {
      idx = Number(trimmed) - 1;
    }
    return idx >= 0 && props.variables[idx] ? props.variables[idx] : `{{${trimmed}}}`;
  });

  const mediaSource = props.overrideMediaUrl || props.template.mediaUrl;

  return (
    <div className="relative w-full max-w-[320px] shrink-0 overflow-hidden bg-[#EFEAE2] p-4 font-sans text-[15px] shadow-sm ring-1 ring-black/5 sm:rounded-[24px]">
      <div className="mb-4 flex items-center justify-between opacity-80">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#54656f]">WhatsApp Preview</span>
        <Icon className="text-[#54656f]" name="visibility" />
      </div>
      
      <div className="relative max-w-[90%] rounded-2xl rounded-tl-none bg-white p-2 shadow-[0_1px_0.5px_rgba(11,20,26,.13)] sm:p-2.5">
        <svg viewBox="0 0 8 13" width="8" height="13" className="absolute -left-2 top-0 text-white"><path opacity=".13" fill="#0000000" d="M1.533 3.568 8 12.193V1H2.812C1.042 1 .474 2.156 1.533 3.568z"></path><path fill="currentColor" d="M1.533 2.568 8 11.193V0H2.812C1.042 0 .474 1.156 1.533 2.568z"></path></svg>
        {mediaSource && (
          <div className="mb-2 shrink-0 overflow-hidden rounded-xl bg-black/5">
            <img src={mediaSource} alt="Attached Media" className="h-auto w-full object-cover" />
          </div>
        )}
        <div className="whitespace-pre-wrap text-[#111b21] leading-[22px]">
          {renderedBody}
        </div>
        <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-[#667781]">
          <span>12:00</span>
        </div>
      </div>
      
      {props.template.ctaLabel && (
        <div className="mt-2 max-w-[90%]">
          <button className="flex w-full flex-col items-center justify-center gap-1 rounded-xl bg-white p-3 font-semibold text-[#00a884] shadow-[0_1px_0.5px_rgba(11,20,26,.13)]">
            <div className="flex items-center gap-2">
              <Icon name={props.template.ctaUrl ? "open_in_new" : "call"} className="text-[18px]" />
              {props.template.ctaLabel}
            </div>
            {props.template.ctaUrl && <span className="text-[10px] opacity-70 underline truncate max-w-full">{props.template.ctaUrl}</span>}
          </button>
        </div>
      )}
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
      title: "tomorrowX",
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
    title: "tomorrowX",
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
            <img src="/logo.png" alt="tomorrowX" className="h-10 w-10 rounded-xl object-cover shadow-sm ring-1 ring-primary/20" />
            {!sidebarCollapsed ? (
              <div>
                <h1 className="font-headline text-sm font-bold leading-tight text-primary">tomorrowX</h1>
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
          <button 
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-headline text-sm font-bold text-on-primary shadow-lg shadow-primary/10 transition-all hover:opacity-90"
            onClick={() => navigate("/campaigns")}
          >
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
  const approvedTemplates = props.data.templates.filter((t) => t.twilioContentSid);
  const [templateId, setTemplateId] = useState(approvedTemplates[0]?.id ?? "");
  const [channelId, setChannelId] = useState(props.data.channels[0]?.id ?? "");
  
  const [isTemplateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateVariables, setTemplateVariables] = useState<string[]>([]);

  const selectedConversation =
    props.data.conversations.find((conversation) => conversation.id === props.selectedConversationId) ??
    props.data.conversations[0];
  const chosenTemplate = approvedTemplates.find((template) => template.id === templateId) ?? approvedTemplates[0];

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
    const targetTemplateId = templateIdOverride ?? templateId;
    if (!selectedConversation || !targetTemplateId) {
      return;
    }
    await api(`/api/conversations/${selectedConversation.id}/messages/template`, {
      method: "POST",
      body: JSON.stringify({
        contactId: selectedConversation.contactId,
        channelId,
        templateId: targetTemplateId,
        variables: templateVariables
      })
    });
    setTemplateModalOpen(false);
    setTemplateVariables([]);
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

        <div className="min-h-[22rem] flex-1 space-y-2 overflow-y-auto bg-surface p-4 sm:p-6">
          <div className="flex justify-center mb-6">
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

        <div className="relative space-y-3 bg-surface-container-lowest p-4">
          {isTemplateModalOpen && (
            <div className="absolute bottom-full left-0 right-0 z-50 mb-4 rounded-3xl border border-outline-variant/20 bg-surface-container-low p-6 shadow-2xl backdrop-blur-3xl">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="font-headline text-lg font-bold text-on-surface">Send Approved Template</h3>
                <button
                  className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high"
                  onClick={() => setTemplateModalOpen(false)}
                >
                  <Icon name="close" />
                </button>
              </div>
              
              <div className="flex flex-col gap-8 md:flex-row">
                <div className="flex-1 space-y-4">
                  <Field label="Template">
                    <select
                      className="atrium-input"
                      value={templateId}
                      onChange={(event) => setTemplateId(event.target.value)}
                    >
                      {approvedTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name} ({template.category})
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Sender Channel">
                    <select
                      className="atrium-input"
                      value={channelId}
                      onChange={(event) => setChannelId(event.target.value)}
                    >
                      {props.data.channels.map((channel) => (
                        <option key={channel.id} value={channel.id}>
                          {channel.name} · {channel.whatsappNumber}
                        </option>
                      ))}
                    </select>
                  </Field>
                  
                  {Array.isArray(chosenTemplate?.placeholders) && chosenTemplate.placeholders.length > 0 && (
                    <div className="mt-4 space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                      <span className="text-xs font-bold uppercase tracking-wider text-outline">Placeholder Values</span>
                      {chosenTemplate.placeholders.map((ph, idx) => (
                        <input
                          key={idx}
                          className="atrium-input text-sm"
                          placeholder={`Value for ${ph}...`}
                          value={templateVariables[idx] || ""}
                          onChange={(e) => {
                            const newVars = [...templateVariables];
                            newVars[idx] = e.target.value;
                            setTemplateVariables(newVars);
                          }}
                        />
                      ))}
                    </div>
                  )}
                  
                  <div className="pt-4">
                    <button
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-on-primary shadow-lg shadow-primary/30 transition-all hover:bg-primary/90"
                      onClick={() => void sendTemplate()}
                    >
                      <Icon name="schedule_send" /> Send Template Now
                    </button>
                  </div>
                </div>
                
                <div className="flex justify-center md:w-[320px]">
                  <TemplateLivePreview template={chosenTemplate} variables={templateVariables} />
                </div>
              </div>
            </div>
          )}
          
          <div className="flex items-end gap-3 rounded-2xl border border-outline-variant/10 bg-surface-container-low p-2 pl-4">
            <button 
              className="group relative p-2 text-slate-400 transition-colors hover:text-primary"
              onClick={() => setTemplateModalOpen(!isTemplateModalOpen)}
            >
              <Icon name="quick_reference_all" />
              <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-max -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100 rounded bg-on-surface px-2 py-1 text-[10px] text-surface">
                Use Template
              </div>
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
                {deriveContactRole(selectedConversation.contact)}, {selectedConversation.contact.company || "tomorrowX Client"}
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
                <NoteCard text={`Client prefers WhatsApp for urgent updates and template confirmations. Latest ask: ${latestInbound?.body ?? "No recent inbound note."}`} meta="Today by tomorrowX" />
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
  const [currentStep, setCurrentStep] = useState(1);
  const [name, setName] = useState("Seasonal Promo Spring");
  const approvedTemplates = props.data.templates.filter((t) => t.twilioContentSid);
  const [templateId, setTemplateId] = useState(approvedTemplates[0]?.id ?? "");
  const [channelId, setChannelId] = useState(props.data.channels[0]?.id ?? "");
  const [recipientMode, setRecipientMode] = useState<Campaign["recipientMode"]>("segments");
  const [recipientIds, setRecipientIds] = useState<string[]>(props.data.segments[0] ? [props.data.segments[0].id] : []);
  const [scheduledAt, setScheduledAt] = useState("");
  const [recurringInterval, setRecurringInterval] = useState<Campaign["recurringInterval"]>("none");
  const [recurringUntil, setRecurringUntil] = useState("");
  const [templateVariables, setTemplateVariables] = useState<string[]>([]);
  const [headerMediaUrl, setHeaderMediaUrl] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const selectedTemplate = approvedTemplates.find((template) => template.id === templateId) ?? approvedTemplates[0];
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
        scheduledAt: scheduledAt || null,
        recurringInterval,
        recurringUntil: recurringUntil || null,
        variables: templateVariables,
        headerMediaUrl: headerMediaUrl || undefined
      })
    });
    setFeedback(scheduledAt ? "Campaign queued successfully." : "Campaign launched successfully.");
    if (!scheduledAt) setScheduledAt("");
    setTemplateVariables([]);
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
        <WizardStep index={1} label="Template" status={currentStep === 1 ? "selected" : "pending"} />
        <div className={`mx-4 h-[2px] flex-1 ${currentStep >= 2 ? "bg-primary-fixed" : "bg-surface-container-high"}`} />
        <WizardStep index={2} label="Audience" status={currentStep === 2 ? "selected" : currentStep > 2 ? "pending" : "locked"} dim={currentStep < 2} />
        <div className={`mx-4 h-[2px] flex-1 ${currentStep >= 3 ? "bg-primary-fixed" : "bg-surface-container-high"}`} />
        <WizardStep dim={currentStep < 3} index={3} label="Launch" status={currentStep === 3 ? "selected" : "locked"} />
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 xl:col-span-7 space-y-6">
          {currentStep === 1 && (
            <>
              <div className="rounded-xl bg-surface-container-low p-6">
                <SectionTitle icon="campaign" title="Campaign Basics" />
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Campaign name">
                    <input className="atrium-input" value={name} onChange={(event) => setName(event.target.value)} />
                  </Field>
                  <Field label="Dispatch Channel">
                    <select className="atrium-input" value={channelId} onChange={(event) => setChannelId(event.target.value)}>
                      {props.data.channels.map((channel) => (
                        <option key={channel.id} value={channel.id}>
                          {channel.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>
              <div className="rounded-xl bg-surface-container-low p-6">
                <SectionTitle icon="grid_view" title="Select Approved Template" />
                {approvedTemplates.length === 0 ? (
                  <div className="rounded-xl border border-warning/20 bg-warning-container p-4 text-sm font-medium text-on-warning-container">
                    You have no approved Twilio templates synced. Go to Templates to sync from Twilio.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Field label="Template format">
                      <select className="atrium-input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                        {approvedTemplates.map(t => (
                          <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                        ))}
                      </select>
                    </Field>
                    {selectedTemplate?.mediaUrl && (
                      <Field label="Dynamic Web Image Link (Optional, overrides template header)">
                        <input className="atrium-input" placeholder="https://example.com/image.png" value={headerMediaUrl} onChange={(e) => setHeaderMediaUrl(e.target.value)} />
                      </Field>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {currentStep === 2 && (
            <div className="rounded-xl bg-surface-container-low p-6">
            <SectionTitle icon="person_add" title="Audience Selection" />
            <div className="grid gap-4 lg:grid-cols-2">
              <NavLink to="/contacts" className="group rounded-xl border-2 border-dashed border-primary p-8 transition-all hover:bg-primary-fixed/5 block cursor-pointer">
                <div className="flex flex-col items-center justify-center text-center">
                  <Icon className="mb-2 text-3xl text-primary transition-transform group-hover:-translate-y-1" name="cloud_upload" />
                  <span className="text-sm font-bold text-primary">Upload CSV</span>
                  <span className="mt-1 text-[10px] text-outline">Click here to head to the Contacts Manager to run bulk import mappings.</span>
                </div>
              </NavLink>
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

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Field label="Schedule Run (Leave empty to broadcast now)">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <button 
                      type="button"
                      onClick={() => setScheduledAt("")}
                      className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${!scheduledAt ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
                    >
                      Broadcast Now
                    </button>
                    <button 
                      type="button"
                      onClick={() => !scheduledAt && setScheduledAt(new Date(Date.now() + 3600000).toISOString().slice(0, 16))}
                      className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${scheduledAt ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
                    >
                      Schedule Run
                    </button>
                  </div>
                  {scheduledAt !== "" && (
                    <input className="atrium-input mt-2" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
                  )}
                </div>
              </Field>
              <Field label="Estimated recipients">
                <div className="atrium-input flex items-center font-bold text-primary">{recipientEstimate} contacts</div>
              </Field>
              <Field label="Recurrence Interval">
                <select className="atrium-input" value={recurringInterval} onChange={(event) => setRecurringInterval(event.target.value as any)}>
                  <option value="none">One-time (Do Not Repeat)</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </Field>
              {recurringInterval !== "none" && (
                <Field label="Repeat Until (Optional bounds)">
                  <input className="atrium-input" type="datetime-local" value={recurringUntil} onChange={(event) => setRecurringUntil(event.target.value)} />
                </Field>
              )}
            </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="rounded-xl bg-surface-container-low p-6">
              <SectionTitle icon="data_object" title="Template Variables" />
              <div className="space-y-4 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
                {Array.isArray(selectedTemplate?.placeholders) && selectedTemplate.placeholders.length > 0 ? (
                  selectedTemplate.placeholders.map((ph, idx) => (
                    <Field key={idx} label={`Variable {{${idx + 1}}} (${ph})`}>
                      <input
                        className="atrium-input"
                        placeholder={`Dynamic value for ${ph}`}
                        value={templateVariables[idx] || ""}
                        onChange={(e) => {
                          const newVars = [...templateVariables];
                          newVars[idx] = e.target.value;
                          setTemplateVariables(newVars);
                        }}
                      />
                    </Field>
                  ))
                ) : (
                  <div className="rounded-xl bg-surface-container-lowest p-4 text-sm text-on-surface-variant">
                    This template does not require any dynamic variables.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="col-span-12 xl:col-span-5 relative mt-4 xl:mt-0">
          <div className="sticky top-10 mx-auto w-full max-w-sm">
            <div className="rounded-[3rem] border-4 border-surface-dim bg-surface-container-highest p-4 shadow-2xl">
              <TemplateLivePreview template={selectedTemplate} variables={templateVariables} overrideMediaUrl={headerMediaUrl} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 w-full max-w-5xl mx-auto md:px-0">
        <div className="flex flex-col gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-secondary-fixed/20 p-2 text-secondary">
              <Icon name="history_edu" />
            </div>
            <div>
              <p className="text-xs font-bold text-on-surface">Wizard State</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-outline">
                Step {currentStep} of 3
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {currentStep > 1 && (
            <button
              type="button"
              className="rounded-xl border border-outline-variant px-6 py-3 text-sm font-bold text-on-surface transition-all hover:bg-surface-container"
              onClick={() => setCurrentStep(prev => prev - 1)}
            >
              Back
            </button>
            )}
            {currentStep < 3 ? (
            <button
              type="button"
              className="group flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-bold text-on-primary shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
              onClick={() => setCurrentStep(prev => prev + 1)}
              disabled={currentStep === 1 && !templateId}
            >
              Next Step
              <Icon className="transition-transform group-hover:translate-x-1" name="arrow_forward" />
            </button>
            ) : (
            <button
              type="button"
              className="group flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-bold text-on-primary shadow-lg shadow-primary/20 transition-all active:scale-95"
              onClick={async () => {
                try {
                  await launchCampaign();
                  setCurrentStep(1);
                } catch (err: any) {
                  setFeedback(err.message || "Failed to launch campaign");
                }
              }}
            >
              {scheduledAt ? "Queue Campaign" : "Broadcast Now"}
              <Icon className="transition-transform group-hover:translate-x-1" name="arrow_forward" />
            </button>
            )}
          </div>
        </div>
        
      <div className="mt-16 w-full max-w-5xl mx-auto rounded-xl bg-surface-container-low p-6">
        <SectionTitle icon="insert_chart" title="Recent Campaigns Engine" />
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
  const [mappingState, setMappingState] = useState<{
    headers: string[];
    previewRows: Record<string, string>[];
    map: Record<string, string>;
    customFieldNames: Record<string, string>;
  } | null>(null);

  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(["profile", "phone", "segments", "activity", "optIn"]);
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);

  const customFieldKeys = useMemo(() => {
    const keys = new Set<string>();
    props.data.contacts.forEach((c) => Object.keys(c.customFields).forEach((k) => keys.add(k)));
    return Array.from(keys);
  }, [props.data.contacts]);

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return props.data.contacts;
    const lowerQuery = searchQuery.toLowerCase();
    return props.data.contacts.filter((c) => {
      if (c.firstName.toLowerCase().includes(lowerQuery)) return true;
      if (c.lastName.toLowerCase().includes(lowerQuery)) return true;
      if (c.phone.includes(lowerQuery)) return true;
      if (c.email?.toLowerCase().includes(lowerQuery)) return true;
      if (c.company?.toLowerCase().includes(lowerQuery)) return true;
      if (Object.values(c.customFields).some((val) => String(val).toLowerCase().includes(lowerQuery))) return true;
      return false;
    });
  }, [searchQuery, props.data.contacts]);

  const itemsPerPage = 15;
  const totalPages = Math.ceil(filteredContacts.length / itemsPerPage) || 1;
  const paginatedContacts = filteredContacts.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  function toggleColumn(key: string) {
    setVisibleColumns((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

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
    
    if (!mappingState) {
      const formData = new FormData();
      formData.append("file", csvFile);
      const { headers, previewRows } = await api<{ headers: string[]; previewRows: Record<string, string>[] }>("/api/contacts/import/preview", { method: "POST", body: formData });
      
      const initialMap: Record<string, string> = {};
      for (const h of headers) {
        const lh = h.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (lh.includes("first")) initialMap[h] = "firstName";
        else if (lh.includes("last")) initialMap[h] = "lastName";
        else if (lh.includes("phone") || lh.includes("mobile")) initialMap[h] = "phone";
        else if (lh.includes("email")) initialMap[h] = "email";
        else if (lh.includes("company")) initialMap[h] = "company";
        else if (lh.includes("identification") || lh.includes("id")) initialMap[h] = "identification_number";
        else if (lh.includes("tag") || lh.includes("label")) initialMap[h] = "labels";
        else initialMap[h] = "ignore";
      }
      setMappingState({ headers, previewRows, map: initialMap, customFieldNames: {} });
      return;
    }

    const finalMapping: Record<string, string> = {};
    for (const h of mappingState.headers) {
      if (mappingState.map[h] === "custom") {
        finalMapping[h] = mappingState.customFieldNames[h] || h;
      } else {
        finalMapping[h] = mappingState.map[h];
      }
    }

    const formData = new FormData();
    formData.append("file", csvFile);
    formData.append("segmentIds", selectedSegments.join(","));
    formData.append("segmentMode", form.segmentMode);
    formData.append("mapping", JSON.stringify(finalMapping));
    
    await api("/api/contacts/import", {
      method: "POST",
      body: formData
    });
    setCsvFile(null);
    setMappingState(null);
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
      <div className="mb-8 grid grid-cols-1 gap-6">
        <div className="flex flex-col justify-between rounded-[2rem] bg-surface-container-low p-8">
          <div>
            <span className="font-headline text-sm font-bold uppercase tracking-[0.18em] text-tertiary">Audience Vitality</span>
            <h2 className="mt-2 font-headline text-4xl font-extrabold text-primary">{props.data.contacts.length.toLocaleString()} Active Leads</h2>
            <p className="mt-2 max-w-lg text-on-surface-variant">
              Your contact base is live for CSV updates, real-time conversations, and shared team segmentation.
            </p>
          </div>
          <div className="mt-8 flex flex-col gap-4 md:flex-row">
            <OverviewMetric label="Opt-in Rate" value="89.4%" />
            <OverviewMetric label="Segments" value={String(props.data.segments.length)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start mb-8">
        <div className="xl:col-span-1 flex flex-col gap-6 order-1 xl:order-2">
        <div className="rounded-[2rem] bg-surface-container-lowest p-6 shadow-sm flex flex-col items-start gap-4 h-fit">
          <div className="flex w-full items-center justify-between">
            <SectionTitle icon="person_add" title="Add Individual Contact" />
            <button 
              type="button"
              className="rounded-full bg-primary/10 text-primary px-4 py-1.5 text-xs font-bold transition-colors hover:bg-primary/20"
              onClick={() => setIsAddContactOpen(!isAddContactOpen)}
            >
              {isAddContactOpen ? "Collapse" : "+ Add Lead"}
            </button>
          </div>
          {isAddContactOpen && (
          <form className="grid w-full gap-4 md:grid-cols-2" onSubmit={saveContact}>
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
          )}
        </div>

        <div className="rounded-[2rem] bg-surface-container-lowest p-6 shadow-sm">
          <SectionTitle icon="upload_file" title="Bulk Import & Segmenting" />
          <form className="space-y-4" onSubmit={importCsv}>
            <Field label="Quick Add Segment (Optional)">
              <div className="flex gap-2">
                <input
                  className="atrium-input"
                  placeholder="e.g. VIP Customers"
                  value={segmentName}
                  onChange={(e) => setSegmentName(e.target.value)}
                />
                <button
                  type="button"
                  className="rounded-xl bg-surface-container hover:bg-surface-container-high px-4 py-2 text-sm font-bold text-on-surface transition-colors"
                  onClick={createSegment}
                >
                  Create
                </button>
              </div>
            </Field>
            <Field label="CSV file">
              <input
                accept=".csv"
                className="atrium-input file:mr-3 file:rounded-xl file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-bold file:text-on-primary"
                type="file"
                onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)}
              />
            </Field>
            
            <div className="rounded-2xl bg-surface-container-low p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-outline">Target Segments</p>
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
            
            <p className="text-xs text-on-surface-variant">Your CSV payload will directly map into the targeted segments outlined above.</p>
            <button className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-5 py-3 text-sm font-bold text-primary transition-all hover:bg-surface-bright">
              Upload & Map Fields
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

        <div className="xl:col-span-3 order-2 xl:order-1">
      <section className="overflow-hidden rounded-[2rem] border border-outline-variant/20 bg-surface-container-lowest">
        <div className="flex flex-col gap-4 border-b border-outline-variant/10 px-8 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search contacts..."
                className="atrium-input bg-surface-container-lowest py-2 text-sm w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Icon className="absolute right-3 top-2.5 text-on-surface-variant pointer-events-none" name="search" />
            </div>
            
            <div className="relative">
              <button
                className="flex cursor-pointer items-center gap-2 rounded-full border border-outline-variant/30 bg-surface-container-low px-4 py-2 hover:bg-surface-container"
                onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)}
              >
                <span className="text-xs font-bold text-on-surface">Columns</span>
                <Icon className="text-sm" name="view_column" />
              </button>
              {isColumnDropdownOpen && (
                <div className="absolute top-12 left-0 z-10 w-56 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-2 shadow-lg">
                  <div className="mb-2 px-2 pb-2 text-xs font-bold text-on-surface-variant border-b border-outline-variant/10">Standard</div>
                  {[
                    { id: "profile", label: "Contact Profile" },
                    { id: "phone", label: "Phone Number" },
                    { id: "segments", label: "Segments & Tags" },
                    { id: "activity", label: "Last Activity" },
                    { id: "optIn", label: "Opt-In" }
                  ].map((col) => (
                    <label key={col.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-container-low">
                      <input type="checkbox" checked={visibleColumns.includes(col.id)} onChange={() => toggleColumn(col.id)} className="rounded border-outline-variant text-primary focus:ring-primary/20" />
                      <span className="text-xs font-medium text-on-surface">{col.label}</span>
                    </label>
                  ))}
                  {customFieldKeys.length > 0 && (
                    <>
                      <div className="mb-2 mt-2 px-2 pb-2 text-xs font-bold text-on-surface-variant border-b border-outline-variant/10">Custom Fields</div>
                      {customFieldKeys.map((key) => (
                        <label key={`custom_${key}`} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-container-low">
                          <input type="checkbox" checked={visibleColumns.includes(`custom_${key}`)} onChange={() => toggleColumn(`custom_${key}`)} className="rounded border-outline-variant text-primary focus:ring-primary/20" />
                          <span className="text-xs font-medium text-on-surface">{key}</span>
                        </label>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-on-surface-variant">
            <span>Showing {filteredContacts.length === 0 ? 0 : (page - 1) * itemsPerPage + 1}-{Math.min(page * itemsPerPage, filteredContacts.length)} of {filteredContacts.length} contacts</span>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded p-1 hover:bg-surface-container disabled:opacity-30"><Icon name="chevron_left" /></button>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="rounded p-1 hover:bg-surface-container disabled:opacity-30"><Icon name="chevron_right" /></button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface-container-low text-[0.6875rem] font-bold uppercase tracking-wider text-on-surface-variant">
                <th className="w-12 px-8 py-4">
                  <input className="rounded border-outline-variant text-primary focus:ring-primary/20" type="checkbox" />
                </th>
                {visibleColumns.includes("profile") && <th className="px-4 py-4">Contact Profile</th>}
                {visibleColumns.includes("phone") && <th className="px-4 py-4">Phone Number</th>}
                {visibleColumns.includes("segments") && <th className="px-4 py-4">Segments & Tags</th>}
                {customFieldKeys.map(key => visibleColumns.includes(`custom_${key}`) && <th key={key} className="px-4 py-4">{key}</th>)}
                {visibleColumns.includes("activity") && <th className="px-4 py-4">Last Activity</th>}
                {visibleColumns.includes("optIn") && <th className="px-4 py-4 text-center">Opt-In</th>}
                <th className="px-8 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {paginatedContacts.map((contact, index) => (
                <tr className="group transition-all hover:bg-surface-bright" key={contact.id}>
                  <td className="border-l-4 border-transparent px-8 py-5 group-hover:border-primary">
                    <input className="rounded border-outline-variant text-primary focus:ring-primary/20" type="checkbox" />
                  </td>
                  {visibleColumns.includes("profile") && (
                    <td className="px-4 py-5">
                      <div className="flex items-center gap-3">
                        <Avatar label={fullName(contact)} size="h-10 w-10" />
                        <div>
                          <div className="text-sm font-bold text-on-surface">{fullName(contact)}</div>
                          {contact.company && <div className="text-xs text-on-surface-variant">{contact.company}</div>}
                        </div>
                      </div>
                    </td>
                  )}
                  {visibleColumns.includes("phone") && <td className="px-4 py-5 text-sm font-medium text-on-surface-variant">{contact.phone}</td>}
                  {visibleColumns.includes("segments") && (
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
                  )}
                  {customFieldKeys.map(key => visibleColumns.includes(`custom_${key}`) && (
                    <td key={`custom_col_${key}`} className="px-4 py-5 text-sm font-medium text-on-surface-variant">
                      {contact.customFields[key] || "—"}
                    </td>
                  ))}
                  {visibleColumns.includes("activity") && <td className="px-4 py-5 text-xs text-on-surface-variant">{formatRelativeChatTime(new Date(Date.now() - (index + 1) * 3600_000).toISOString())}</td>}
                  {visibleColumns.includes("optIn") && (
                    <td className="px-4 py-5">
                      <div className="flex justify-center">
                        <div className={`h-2 w-2 rounded-full ring-4 ${index % 4 === 3 ? "bg-error ring-error/10" : "bg-secondary ring-secondary/10"}`} />
                      </div>
                    </td>
                  )}
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
      </div>

      {mappingState !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#091b18]/60 p-6 backdrop-blur-sm">
          <div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-surface-container-lowest shadow-[0_40px_120px_-48px_rgba(0,69,61,0.5)]">
            <div className="flex items-center justify-between border-b border-outline-variant/20 px-8 py-6">
              <div>
                <h2 className="font-headline text-2xl font-bold text-primary">Map CSV Columns</h2>
                <p className="text-sm text-on-surface-variant">Review header mappings before executing import.</p>
              </div>
              <button
                className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container"
                onClick={() => {
                  setMappingState(null);
                  setCsvFile(null);
                }}
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-8 py-6">
              <div className="grid gap-6 md:grid-cols-2">
                {mappingState.headers.map((h) => (
                  <div className="flex flex-col gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-low p-4" key={h}>
                    <p className="text-xs font-bold uppercase tracking-wider text-outline">{h}</p>
                    <select
                      className="atrium-input bg-surface-container-lowest py-2"
                      value={mappingState.map[h]}
                      onChange={(e) => setMappingState((prev) => (prev ? { ...prev, map: { ...prev.map, [h]: e.target.value } } : null))}
                    >
                      <option value="ignore">Skip / Ignore</option>
                      <option value="firstName">First Name</option>
                      <option value="lastName">Last Name</option>
                      <option value="phone">Phone Number (Required)</option>
                      <option value="email">Email Address</option>
                      <option value="company">Company</option>
                      <option value="identification_number">Identification Number (Custom Field)</option>
                      <option value="labels">Tags / Labels</option>
                      <option value="custom">Create Custom Field...</option>
                    </select>
                    {mappingState.map[h] === "custom" && (
                      <input
                        className="atrium-input mt-2 py-2"
                        placeholder="Type custom JSON key"
                        value={mappingState.customFieldNames[h] || ""}
                        onChange={(e) =>
                          setMappingState((prev) =>
                            prev ? { ...prev, customFieldNames: { ...prev.customFieldNames, [h]: e.target.value } } : null
                          )
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-outline-variant/20 bg-surface-container-low px-8 py-6">
              <button
                className="rounded-xl px-6 py-3 font-bold text-primary transition-colors hover:bg-primary/5"
                onClick={() => {
                  setMappingState(null);
                  setCsvFile(null);
                }}
              >
                Cancel
              </button>
              <button
                className="flex items-center gap-2 rounded-xl bg-primary px-8 py-3 font-bold text-on-primary transition-transform hover:scale-[1.02]"
                onClick={(e) => void importCsv(e)}
              >
                Execute Import
                <Icon name="check_circle" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AnalyticsPage(props: { data: BootstrapData }) {
  // --- Date Range Filtering State ---
  const [dateRange, setDateRange] = useState<"all" | "1month" | "3month" | "9month" | "custom">("1month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const filteredData = useMemo(() => {
    let start = 0;
    let end = Date.now();
    
    if (dateRange === "1month") start = Date.now() - 30 * 24 * 60 * 60 * 1000;
    else if (dateRange === "3month") start = Date.now() - 90 * 24 * 60 * 60 * 1000;
    else if (dateRange === "9month") start = Date.now() - 270 * 24 * 60 * 60 * 1000;
    else if (dateRange === "custom") {
      start = customStart ? new Date(customStart).getTime() : 0;
      end = customEnd ? new Date(customEnd).getTime() + 86400000 : Date.now();
    }

    if (dateRange === "all") return props.data;

    const filterObj = <T extends { createdAt?: string; scheduledAt?: string | null; lastMessageAt?: string }>(item: T) => {
      const timeStr = item.createdAt || item.scheduledAt || item.lastMessageAt;
      if (!timeStr) return true;
      const t = new Date(timeStr).getTime();
      return t >= start && t <= end;
    };

    return {
      ...props.data,
      contacts: props.data.contacts.filter(filterObj),
      campaigns: props.data.campaigns.filter(filterObj),
      conversations: props.data.conversations.filter(filterObj),
    } as BootstrapData;
  }, [props.data, dateRange, customStart, customEnd]);

  const analytics = useMemo(() => buildAnalyticsSummary(filteredData), [filteredData]);
  
  // --- Standard Widget State ---
  const availableWidgets = [
    { id: "overview", label: "Metrics Overview" },
    { id: "funnel", label: "Conversion Funnel" },
    { id: "trends", label: "Engagement Trends" },
    { id: "campaigns", label: "Active Campaigns" },
    { id: "explorer", label: "BI Dynamic Explorer" }
  ];
  const [visibleWidgets, setVisibleWidgets] = useState(["overview", "funnel", "explorer", "campaigns"]);
  const [isEditing, setIsEditing] = useState(false);

  // --- Dynamic BI Explorer State ---
  const [biSource, setBiSource] = useState<"contacts" | "campaigns">("contacts");
  const [biYAxis, setBiYAxis] = useState<string>("");
  const [biAggregation, setBiAggregation] = useState<"count" | "sum" | "min" | "max" | "median">("count");
  const [biXAxis, setBiXAxis] = useState<string>("");

  const toggleWidget = (id: string) => {
    setVisibleWidgets(prev => prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]);
  };

  const biFields = useMemo(() => {
    const keys = new Set<string>();
    if (biSource === "contacts") {
      filteredData.contacts.forEach(c => {
        if (c.company) keys.add("company");
        Object.keys(c.customFields).forEach(k => keys.add(`var:${k}`));
      });
    } else {
      keys.add("attempted");
      keys.add("delivered");
      keys.add("failed");
      filteredData.campaigns.forEach(c => {
        keys.add("templateId");
        keys.add("status");
      });
    }
    return Array.from(keys);
  }, [filteredData, biSource]);

  useEffect(() => {
    if (!biFields.includes(biYAxis)) setBiYAxis(biFields[0] || "");
  }, [biFields, biYAxis]);

  const biResult = useMemo(() => {
    if (!biYAxis) return null;
    
    // Map
    const dataset = (biSource === "contacts" ? filteredData.contacts : filteredData.campaigns).map(item => {
      let yVal: any = null;
      let xVal: any = "All";

      if (biSource === "contacts") {
        const c = item as Contact;
        yVal = biYAxis === "company" ? c.company : biYAxis.startsWith("var:") ? c.customFields[biYAxis.slice(4)] : null;
        xVal = biXAxis ? (biXAxis === "company" ? c.company : biXAxis.startsWith("var:") ? c.customFields[biXAxis.slice(4)] : "All") : "All";
      } else {
        const camp = item as Campaign;
        yVal = biYAxis === "attempted" ? camp.stats.attempted : biYAxis === "delivered" ? camp.stats.delivered : biYAxis === "failed" ? camp.stats.failed : biYAxis === "templateId" ? camp.templateId : camp.status;
        xVal = biXAxis ? (biXAxis === "attempted" ? camp.stats.attempted : biXAxis === "delivered" ? camp.stats.delivered : biXAxis === "failed" ? camp.stats.failed : biXAxis === "templateId" ? camp.templateId : camp.status) : "All";
      }

      const nY = Number(yVal);
      return { x: String(xVal || "Unknown"), y: isNaN(nY) ? yVal : nY, isNum: !isNaN(nY) };
    });

    // Group
    const groups: Record<string, typeof dataset> = {};
    dataset.forEach(row => {
      if (!groups[row.x]) groups[row.x] = [];
      groups[row.x].push(row);
    });

    // Aggregate
    const aggregated = Object.entries(groups).map(([xKey, rows]) => {
      let finalVal = 0;
      if (biAggregation === "count") {
        finalVal = rows.length;
      } else {
        const nums = rows.filter(r => r.isNum).map(r => r.y as number).sort((a,b)=>a-b);
        if (nums.length === 0) finalVal = 0;
        else if (biAggregation === "sum") finalVal = nums.reduce((a,b)=>a+b,0);
        else if (biAggregation === "max") finalVal = nums[nums.length-1];
        else if (biAggregation === "min") finalVal = nums[0];
        else if (biAggregation === "median") finalVal = nums[Math.floor(nums.length/2)];
      }
      return { x: xKey, y: finalVal };
    }).sort((a,b) => b.y - a.y);
    
    return aggregated;
  }, [filteredData, biSource, biYAxis, biXAxis, biAggregation]);

  return (
    <div className="px-8 pb-12 pt-8">
      <div className="mb-10 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between border-b border-outline-variant/20 pb-6">
        <div className="space-y-1">
          <h1 className="font-headline text-[2.75rem] font-medium leading-none tracking-tight text-on-surface">Analytics</h1>
          <p className="font-medium text-on-surface-variant">Real-time performance & BI metrics</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-lg bg-surface-container-lowest p-1 shadow-sm border border-outline-variant/30 flex-wrap">
            {["all", "1month", "3month", "9month", "custom"].map(rng => (
              <button 
                key={rng}
                onClick={() => setDateRange(rng as any)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${dateRange === rng ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}
              >
                {rng === "all" ? "All Time" : rng === "1month" ? "1 Month" : rng === "3month" ? "3 Months" : rng === "9month" ? "9 Months" : "Custom"}
              </button>
            ))}
          </div>
          {dateRange === "custom" && (
            <div className="flex items-center gap-2 bg-surface-container-lowest p-1 rounded-lg border border-outline-variant/30">
              <input type="date" className="atrium-input border-0 py-1 text-xs" value={customStart} onChange={e => setCustomStart(e.target.value)} />
              <span className="text-on-surface-variant text-xs">-</span>
              <input type="date" className="atrium-input border-0 py-1 text-xs" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </div>
          )}
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${isEditing ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface border border-outline-variant/30 hover:bg-surface-container'}`}
          >
            <Icon className="text-lg" name="dashboard_customize" />
            {isEditing ? "Done Editing" : "Customize"}
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="mb-8 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm transform transition-all">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-on-surface-variant">Enabled Widgets</h3>
          <div className="flex flex-wrap gap-3">
            {availableWidgets.map(widget => (
              <button
                key={widget.id}
                onClick={() => toggleWidget(widget.id)}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${visibleWidgets.includes(widget.id) ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant/30 bg-transparent text-on-surface-variant hover:border-outline-variant'}`}
              >
                <div className={`h-2 w-2 rounded-full ${visibleWidgets.includes(widget.id) ? 'bg-primary' : 'bg-surface-container-highest'}`} />
                {widget.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-8">
        {visibleWidgets.includes("overview") && (
          <section className="grid gap-6 md:grid-cols-4">
            <MinimalMetricCard label="Total Sent" value={analytics.totalSent.toLocaleString()} trend="+12.5%" data={analytics.trendBars.slice(0, 7)} />
            <MinimalMetricCard label="Delivered" value={analytics.delivered.toLocaleString()} trend={`${analytics.deliveryRate}%`} data={analytics.trendBars.slice(2, 9)} />
            <MinimalMetricCard label="Read" value={analytics.readEstimate.toLocaleString()} trend={`${analytics.readRate}%`} data={analytics.trendBars.slice(4, 11)} />
            <MinimalMetricCard label="Replied" value={analytics.replyEstimate.toLocaleString()} trend={`${analytics.replyRate}%`} data={analytics.trendBars.slice(5, 12)} />
          </section>
        )}

        {visibleWidgets.includes("funnel") && (
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-8 shadow-sm">
            <h2 className="mb-6 font-headline text-lg font-semibold text-on-surface">Conversion Funnel</h2>
            <div className="flex flex-col gap-4">
              <FunnelStep label="Sent" value={analytics.totalSent} max={analytics.totalSent} color="bg-surface-container-highest" />
              <FunnelStep label="Delivered" value={analytics.delivered} max={analytics.totalSent} color="bg-primary/40" />
              <FunnelStep label="Read" value={analytics.readEstimate} max={analytics.totalSent} color="bg-primary/70" />
              <FunnelStep label="Replied" value={analytics.replyEstimate} max={analytics.totalSent} color="bg-primary" />
            </div>
          </div>
        )}
        
        {visibleWidgets.includes("explorer") && (
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-8 shadow-sm">
            <h2 className="mb-6 font-headline text-lg font-semibold text-on-surface flex items-center gap-2">
              <Icon name="explore" className="text-primary" />
              Dynamic BI Explorer
            </h2>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 bg-surface-container-low p-5 rounded-xl border border-outline-variant/10">
              <Field label="Data Source">
                <select className="atrium-input bg-surface-container-lowest text-sm py-2 px-3" value={biSource} onChange={e => {setBiSource(e.target.value as any); setBiXAxis("");}}>
                  <option value="contacts">Contacts Registry</option>
                  <option value="campaigns">Campaigns Database</option>
                </select>
              </Field>
              <Field label="Metric (Target Variable)">
                <select className="atrium-input bg-surface-container-lowest text-sm py-2 px-3" value={biYAxis} onChange={e => setBiYAxis(e.target.value)}>
                  {biFields.map(f => <option key={f} value={f}>{f.replace("var:", "(Custom) ")}</option>)}
                </select>
              </Field>
              <Field label="Operation">
                <select className="atrium-input bg-surface-container-lowest text-sm py-2 px-3" value={biAggregation} onChange={e => setBiAggregation(e.target.value as any)}>
                  <option value="count">Count (Incidences)</option>
                  <option value="sum">Sum (Mathematical Add)</option>
                  <option value="max">Max (Peak Value)</option>
                  <option value="min">Min (Lowest Value)</option>
                  <option value="median">Median (Distribution curve midpoint)</option>
                </select>
              </Field>
              <Field label="Group By (Comparison X-Axis)">
                <select className="atrium-input bg-surface-container-lowest text-sm py-2 px-3" value={biXAxis} onChange={e => setBiXAxis(e.target.value)}>
                  <option value="">None (Global Calculation)</option>
                  {biFields.map(f => <option key={f} value={f}>{f.replace("var:", "(Custom) ")}</option>)}
                </select>
              </Field>
            </div>

            <div className="min-h-[220px] flex flex-col justify-end pt-4 border-t border-outline-variant/10 mt-6 relative">
              {!biResult || biResult.length === 0 ? (
                <div className="flex h-40 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-outline-variant/30 text-slate-400">
                  <Icon name="monitoring" className="mb-2 text-3xl opacity-50" />
                  <span className="text-sm font-medium">No valid mathematical slices found for the current configuration.</span>
                </div>
              ) : !biXAxis || (biResult.length === 1 && biResult[0].x === "All") ? (
                <div className="flex w-full items-center justify-center p-8">
                  <div className="flex flex-col items-center justify-center px-16 py-12 bg-primary-fixed/30 border-2 border-primary/20 rounded-[2rem] min-w-[340px] shadow-sm transform transition-all hover:scale-105">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/80 mb-3">{biAggregation} of {biYAxis.replace("var:", "")}</p>
                    <h1 className="font-headline text-[4rem] font-extrabold text-primary leading-none">{biResult[0].y.toLocaleString()}</h1>
                  </div>
                </div>
              ) : (
                <div className="relative w-full flex items-end justify-around gap-2 h-[260px] px-4">
                  {biResult.slice(0, 20).map((row, i) => { 
                    const maxVal = Math.max(...biResult.map(r => r.y)) || 1;
                    const heightPct = Math.max(2, (row.y / maxVal) * 100);
                    return (
                      <div key={i} className="group relative flex-1 h-full flex flex-col justify-end items-center transition-all px-1 hover:z-10">
                        <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-surface-container-highest text-on-surface text-[11px] py-2 px-3 rounded-xl font-bold whitespace-nowrap shadow-lg">
                          <span className="text-on-surface-variant font-medium mr-1">{row.x}:</span> {row.y.toLocaleString()}
                        </div>
                        <div className="w-full max-w-[64px] min-w-[20px] rounded-t-lg bg-primary hover:bg-primary-fixed shadow-[0_-4px_12px_rgba(var(--color-primary),0.2)] transition-all" style={{ height: `${heightPct}%` }} />
                        <div className="h-[40px] mt-2 w-full max-w-[64px] overflow-hidden">
                          <span className="text-[10px] text-on-surface font-semibold truncate w-full block text-center break-words leading-tight" title={row.x}>{row.x === "All" ? "Total" : row.x}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {visibleWidgets.includes("trends") && (
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-8 shadow-sm">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="font-headline text-lg font-semibold text-on-surface">Engagement Trends</h2>
                <p className="text-xs text-on-surface-variant mt-1">30-day trailing activity</p>
              </div>
              <div className="flex gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-primary" /> Sent</div>
                <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-primary/30" /> Read</div>
              </div>
            </div>
            <div className="relative h-48 w-full flex items-end justify-between gap-1.5">
              {analytics.trendBars.map((height, index) => (
                <div key={index} className="group relative flex-1 h-full flex flex-col justify-end">
                  <div className="w-full rounded-sm bg-primary/30 transition-all group-hover:bg-primary/50" style={{ height: `${height * 0.7}%` }} />
                  <div className="w-full rounded-sm bg-primary transition-all group-hover:bg-primary/90 mt-0.5" style={{ height: `${height}%` }} />
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-surface-container-highest text-on-surface text-[10px] py-1 px-2 rounded font-medium z-10 whitespace-nowrap pointer-events-none shadow-sm">
                    {Math.round((analytics.totalSent / analytics.trendBars.length) * (height / 100)).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between uppercase text-[10px] font-bold text-on-surface-variant tracking-widest border-t border-outline-variant/10 pt-4">
              <span>Week 1</span>
              <span>Week 2</span>
              <span>Week 3</span>
              <span>Week 4</span>
            </div>
          </div>
        )}

        {visibleWidgets.includes("campaigns") && (
          <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest shadow-sm">
            <div className="flex items-center justify-between px-8 py-6 border-b border-outline-variant/10">
              <h2 className="font-headline text-lg font-semibold text-on-surface">Active Campaigns</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-on-surface-variant bg-surface-container-low/50">
                    <th className="px-8 py-4 font-medium">Campaign</th>
                    <th className="px-8 py-4 font-medium">Status</th>
                    <th className="px-8 py-4 font-medium">Volume</th>
                    <th className="px-8 py-4 font-medium">Read Rate</th>
                    <th className="px-8 py-4 font-medium text-right">ROI</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {filteredData.campaigns.map((campaign, index) => {
                    const sent = campaign.stats.attempted || campaign.stats.delivered || (index + 1) * 1200;
                    const rate = sent ? Math.round((campaign.stats.delivered / Math.max(1, sent)) * 100) : 0;
                    const roi = (campaign.stats.delivered * 0.09 + 1).toFixed(1);
                    return (
                      <tr className="border-b border-outline-variant/5 last:border-0 hover:bg-surface-bright/50 transition-colors" key={campaign.id}>
                        <td className="px-8 py-5">
                          <p className="font-semibold text-on-surface">{campaign.name}</p>
                          <p className="text-xs text-on-surface-variant mt-0.5">{campaign.scheduledAt ? formatLongDate(campaign.scheduledAt) : "Immediate"}</p>
                        </td>
                        <td className="px-8 py-5">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${campaign.status === "sent" ? "text-on-surface-variant" : "text-primary"}`}>
                            <div className={`h-1.5 w-1.5 rounded-full ${campaign.status === "sent" ? "bg-on-surface-variant/40" : "bg-primary"}`} />
                            {campaign.status === "sent" ? "Completed" : "Active"}
                          </span>
                        </td>
                        <td className="px-8 py-5 font-mono text-xs">{sent.toLocaleString()}</td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs w-8">{rate}%</span>
                            <div className="h-1 w-24 overflow-hidden rounded bg-surface-container-highest">
                              <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(rate, 100)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5 font-mono text-xs font-semibold text-right">{roi}x</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function MinimalMetricCard(props: { label: string; value: string; trend: string; data: number[] }) {
  const min = Math.min(...props.data)
  const max = Math.max(...props.data)
  const range = max - min || 1
  const width = 100;
  const height = 30;
  const points = props.data.map((val, i) => {
    const x = (i / (props.data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  const isPositive = !props.trend.startsWith("-");

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="mb-6 flex items-start justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{props.label}</h3>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isPositive ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'}`}>
          {props.trend}
        </span>
      </div>
      <div className="flex items-end justify-between gap-4">
        <p className="font-headline text-3xl font-medium text-on-surface">{props.value}</p>
        <div className="w-16 h-8 flex-shrink-0 opacity-70">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points}
              className={isPositive ? "text-primary" : "text-error"}
              style={{ vectorEffect: 'non-scaling-stroke' }}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

function FunnelStep(props: { label: string; value: number; max: number; color: string }) {
  const percentage = Math.max(1, (props.value / props.max) * 100);
  return (
    <div className="flex items-center gap-4">
      <div className="w-20 flex-shrink-0 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">{props.label}</div>
      <div className="flex-1 h-10 bg-surface-container-low rounded-lg overflow-hidden flex items-center">
        <div className={`h-full ${props.color} transition-all duration-1000 ease-out`} style={{ width: `${percentage}%` }} />
      </div>
      <div className="w-20 flex-shrink-0 text-right font-mono text-sm">{props.value.toLocaleString()}</div>
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

  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  async function saveChannel(event: FormEvent) {
    event.preventDefault();
    if (editingChannelId) {
      await api(`/api/channels/${editingChannelId}`, {
        method: "PUT",
        body: JSON.stringify(channelForm)
      });
      setEditingChannelId(null);
    } else {
      await api("/api/channels", {
        method: "POST",
        body: JSON.stringify(channelForm)
      });
    }
    setChannelForm({ name: "", whatsappNumber: "", messagingServiceSid: "" });
    await props.onRefresh();
  }

  async function deleteChannel(id: string) {
    if (!window.confirm("Are you sure you want to delete this WhatsApp number?")) return;
    await api(`/api/channels/${id}`, { method: "DELETE" });
    if (editingChannelId === id) setEditingChannelId(null);
    await props.onRefresh();
  }

  function startEditingChannel(channel: BootstrapData["channels"][number]) {
    setEditingChannelId(channel.id);
    setChannelForm({
      name: channel.name,
      whatsappNumber: channel.whatsappNumber,
      messagingServiceSid: channel.messagingServiceSid || ""
    });
  }

  async function saveUser(event: FormEvent) {
    event.preventDefault();
    if (editingUserId) {
      await api(`/api/users/${editingUserId}`, {
        method: "PUT",
        body: JSON.stringify(userForm)
      });
      setEditingUserId(null);
    } else {
      await api("/api/users", {
        method: "POST",
        body: JSON.stringify(userForm)
      });
    }
    setUserForm({ name: "", email: "", role: "agent" });
    await props.onRefresh();
  }

  async function deleteUser(id: string) {
    if (!window.confirm("Are you sure you want to delete this team member?")) return;
    await api(`/api/users/${id}`, { method: "DELETE" });
    if (editingUserId === id) setEditingUserId(null);
    await props.onRefresh();
  }

  function startEditingUser(user: BootstrapData["users"][number]) {
    setEditingUserId(user.id);
    setUserForm({ name: user.name, email: user.email, role: user.role });
  }

  return (
    <StudioPageShell title="Shared Settings" subtitle="Manage multi-user access and multiple WhatsApp senders for the same workspace.">
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[2rem] bg-surface-container-lowest p-6 shadow-sm">
          <SectionTitle icon="call" title={editingChannelId ? "Edit WhatsApp Number" : "Add WhatsApp Number"} />
          <form className="space-y-4" onSubmit={saveChannel}>
            <Field label="Channel name">
              <input className="atrium-input" value={channelForm.name} onChange={(event) => setChannelForm((current) => ({ ...current, name: event.target.value }))} />
            </Field>
            <Field label="WhatsApp number">
              <input className="atrium-input" placeholder="whatsapp:+14155238886" value={channelForm.whatsappNumber} onChange={(event) => setChannelForm((current) => ({ ...current, whatsappNumber: event.target.value }))} />
            </Field>
            <Field label="Messaging service SID">
              <input className="atrium-input" value={channelForm.messagingServiceSid} onChange={(event) => setChannelForm((current) => ({ ...current, messagingServiceSid: event.target.value }))} />
            </Field>
            <div className="flex gap-2">
              <button className="flex-1 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary shadow-sm hover:opacity-90">
                {editingChannelId ? "Save Changes" : "Add number"}
              </button>
              {editingChannelId && (
                <button 
                  type="button" 
                  className="rounded-xl border border-outline-variant/30 px-5 py-3 text-sm font-bold text-on-surface hover:bg-surface-container"
                  onClick={() => { setEditingChannelId(null); setChannelForm({ name: "", whatsappNumber: "", messagingServiceSid: "" }); }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
          <div className="mt-6 space-y-3">
            {props.data.channels.map((channel) => (
              <div className="flex items-center justify-between rounded-2xl bg-surface-container-low p-4 group" key={channel.id}>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-on-surface">{channel.name}</p>
                    <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-bold text-secondary uppercase tracking-widest">{channel.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-on-surface-variant font-mono">{channel.whatsappNumber}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={() => startEditingChannel(channel)} className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors focus:outline-none">
                    <Icon className="text-sm" name="edit" />
                  </button>
                  <button type="button" onClick={() => void deleteChannel(channel.id)} className="rounded-lg p-2 text-on-surface-variant hover:bg-error/10 hover:text-error transition-colors focus:outline-none">
                    <Icon className="text-sm" name="delete" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] bg-surface-container-lowest p-6 shadow-sm">
          <SectionTitle icon="group" title={editingUserId ? "Edit Team Member" : "Add Team Member"} />
          <form className="space-y-4" onSubmit={saveUser}>
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
            <div className="flex gap-2">
              <button className="flex-1 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary shadow-sm hover:opacity-90">
                {editingUserId ? "Save Changes" : "Invite teammate"}
              </button>
              {editingUserId && (
                <button 
                  type="button" 
                  className="rounded-xl border border-outline-variant/30 px-5 py-3 text-sm font-bold text-on-surface hover:bg-surface-container"
                  onClick={() => { setEditingUserId(null); setUserForm({ name: "", email: "", role: "agent" }); }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
          <div className="mt-6 space-y-3">
            {props.data.users.map((user) => (
              <div className="flex items-center justify-between rounded-2xl bg-surface-container-low p-4 group" key={user.id}>
                <div className="flex items-center gap-3">
                  <Avatar label={user.name} size="h-10 w-10" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-on-surface">{user.name}</p>
                      <span className="rounded-full bg-primary-fixed/20 px-2 py-0.5 text-[10px] uppercase tracking-widest font-bold text-primary">{user.role}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant font-medium mt-1">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={() => startEditingUser(user)} className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors focus:outline-none">
                    <Icon className="text-sm" name="edit" />
                  </button>
                  <button type="button" onClick={() => void deleteUser(user.id)} className="rounded-lg p-2 text-on-surface-variant hover:bg-error/10 hover:text-error transition-colors focus:outline-none">
                    <Icon className="text-sm" name="delete" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="rounded-[2rem] bg-surface-container-lowest p-6 shadow-sm flex flex-col justify-between">
          <div>
            <SectionTitle icon="sync" title="CRM Synchronization" />
            <p className="mt-2 text-sm text-on-surface-variant">
              Instantly pull contacts from upstream systems, then batch and segment them for WhatsApp outreach.
            </p>
          </div>
          <button className="mt-8 rounded-xl bg-primary py-3 text-sm font-bold text-on-primary w-full">Configure Bridge</button>
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
