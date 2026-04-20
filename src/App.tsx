import React, { FormEvent, useEffect, useMemo, useState, Fragment } from "react";
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
  Template,
  Vehicle,
  Order,
  JourneyNode,
  LandingPage
} from "./types";
import JourneyDesigner from "./components/JourneyDesigner";



const primaryNavItems = [
  { to: "/inbox", label: "Conversations", icon: "forum" },
  { to: "/campaigns", label: "Campaigns", icon: "rocket_launch" },
  { to: "/contacts", label: "Contacts", icon: "group" },
  { to: "/analytics", label: "Analytics", icon: "insert_chart" }
];

const studioNavItems = [
  { to: "/templates", label: "Templates", icon: "description" },
  { to: "/automations", label: "Automations", icon: "hub" },
  { to: "/landing-pages", label: "Landing Pages", icon: "auto_stories" },
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
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load workspace");
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
    return <div className="grid min-h-screen place-items-center bg-background text-on-surface">Loading workspace…</div>;
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

function formatWhatsAppText(text: string) {
  let html = String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
    
  // Bold: *text*
  html = html.replace(/\*([^\*]+)\*/g, "<strong>$1</strong>");
  // Italic: _text_
  html = html.replace(/_([^_]+)_/g, "<em>$1</em>");
  // Strikethrough: ~text~
  html = html.replace(/~([^~]+)~/g, "<del>$1</del>");
  
  return html;
}

export function TemplateLivePreview(props: { template?: Template; variables: string[]; overrideMediaUrl?: string }) {
  if (!props.template) {
    return (
      <div className="flex h-[500px] w-full flex-col items-center justify-center rounded-[3rem] border border-slate-100 bg-slate-50/50 shadow-inner">
        <Icon name="smartphone" className="text-6xl text-slate-200 mb-4" />
        <span className="text-sm font-extrabold text-slate-400">Awaiting Template</span>
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
    <div className="relative mx-auto w-[320px] shrink-0 overflow-hidden bg-[#efeae2] font-sans text-[15px] shadow-2xl rounded-[2.5rem] border-[8px] border-white ring-1 ring-slate-100">
      {/* Premium WhatsApp Header */}
      <div className="bg-white/95 backdrop-blur-md px-4 pt-8 pb-3 flex items-center justify-between border-b border-slate-200/50 relative z-10">
        <div className="flex items-center gap-3">
          <Icon name="arrow_back" className="text-slate-600" />
          <div className="relative">
            <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400 text-xs border border-slate-200">TX</div>
            <div className="absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full bg-white border-2 border-white flex items-center justify-center">
              <Icon name="verified" className="text-[10px] text-[#00a884]" fill />
            </div>
          </div>
          <div className="flex flex-col -space-y-0.5">
            <span className="font-bold text-[14px] text-slate-900 leading-none">TomorrowX</span>
            <span className="text-[10px] font-medium text-[#00a884]">Official Business</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-slate-600">
          <Icon name="more_vert" className="text-lg opacity-80" />
        </div>
      </div>

      {/* Chat Area */}
      <div className="p-4 min-h-[440px] flex flex-col bg-[#efeae2]">
        <div className="mx-auto mb-4 bg-white/60 px-3 py-1 rounded-lg text-[11px] font-bold text-slate-500 uppercase tracking-wider shadow-sm">Today</div>
        
        <div className="relative max-w-[92%] self-start z-10 group">
          {/* Message Bubble */}
          <div className="bg-white rounded-2xl rounded-tl-none shadow-[0_1px_0.5px_rgba(11,20,26,.13)] overflow-hidden">
            {/* Bubble Tail */}
            <svg viewBox="0 0 8 13" width="8" height="13" className="absolute -left-2 top-0 text-white"><path fill="currentColor" d="M1.533 2.568 8 11.193V0H2.812C1.042 0 .474 1.156 1.533 2.568z"></path></svg>
            
            {mediaSource && (
              <div className="p-1.5 pb-0">
                <div className="overflow-hidden rounded-xl bg-slate-50">
                  <img src={mediaSource} alt="Attached Media" className="h-auto w-full object-cover transition-transform group-hover:scale-105 duration-700" />
                </div>
              </div>
            )}
            
            <div className="p-2.5 pb-2">
              <div 
                className="whitespace-pre-wrap text-[#111b21] leading-[1.3] text-[15px] break-words"
                dangerouslySetInnerHTML={{ __html: formatWhatsAppText(renderedBody) }}
              />
              <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-400 font-medium tracking-tight">
                <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            {/* Integrated Buttons */}
            {props.template.ctaLabel && (
              <div className="border-t border-slate-100">
                <button className="w-full py-3 px-4 flex items-center justify-center gap-2 text-[14px] font-semibold text-[#00a884] hover:bg-slate-50 transition-colors">
                  <Icon name={props.template.ctaUrl ? "open_in_new" : "call"} className="text-lg" />
                  {props.template.ctaLabel}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Mock Navigation Indicators */}
      <div className="bg-[#efeae2] pb-2 flex justify-center">
        <div className="w-24 h-1 bg-slate-300/30 rounded-full" />
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
    },
    "/landing-pages": {
      title: "Landing Pages",
      searchPlaceholder: "Search landing pages..."
    }
  } as Record<string, { title: string; searchPlaceholder: string }>;
  
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState(location.pathname);

  useEffect(() => {
    setActiveMobileTab(location.pathname);
    setIsSearchExpanded(false);
  }, [location.pathname]);


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

  useEffect(() => {
    const appName = props.data.settings.APP_NAME || "tomorrowX";
    document.title = appName + " | WhatsApp Operations Hub";
    
    // Update Meta Description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', props.data.settings.SEO_DESCRIPTION || "Verified WhatsApp Operations Hub.");
  }, [props.data.settings.APP_NAME, props.data.settings.SEO_DESCRIPTION]);

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
          "fixed left-0 top-0 z-40 flex h-screen flex-col gap-y-2 bg-[#fcfdfd] border-r border-slate-100/50 py-8 transition-transform duration-300 lg:translate-x-0",
          sidebarCollapsed ? "w-20 px-3" : "w-64 px-4",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        ].join(" ")}
      >
        <div className={`mb-6 overflow-hidden ${sidebarCollapsed ? "mx-2 rounded-xl" : "mx-4 rounded-2xl"} bg-gradient-to-br from-primary to-primary-fixed-dim shadow-lg shadow-primary/20 group`}>
          <div className="relative p-4 text-white">
            <div className="absolute right-0 top-0 translate-x-1/3 -translate-y-1/3 opacity-10 transition-transform group-hover:scale-125 duration-1000 pointer-events-none">
              <span className="material-symbols-rounded text-6xl">blur_on</span>
            </div>
            <div className="relative z-10 flex items-center gap-3">
               <div className="h-8 w-8 rounded-lg bg-white p-1.5 shadow-sm ring-1 ring-white/20">
                 <img src={props.data.settings.APP_LOGO_URL || "/logo.png"} alt={props.data.settings.APP_NAME || "tomorrowX"} className="h-full w-full object-contain" />
               </div>
               {!sidebarCollapsed && (
                 <div className="flex flex-col">
                   <h1 className="font-headline text-sm font-black tracking-widest uppercase">{props.data.settings.APP_NAME || "tomorrowX"}</h1>
                   <p className="text-[8px] font-bold text-white/50 tracking-[0.2em] uppercase mt-0.5">Studio</p>
                 </div>
               )}
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {primaryNavItems.map((item) => (
            <AtriumNavLink collapsed={sidebarCollapsed} key={item.to} to={item.to} icon={item.icon} label={item.label} />
          ))}

          {!sidebarCollapsed ? (
            <div className="px-5 pb-2 pt-6 flex items-center gap-2">
              <span className="h-px flex-1 bg-slate-100"></span>
              <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-300">Workspace</p>
              <span className="h-px flex-1 bg-slate-100"></span>
            </div>
          ) : null}
          {studioNavItems.map((item) => (
            <AtriumNavLink collapsed={sidebarCollapsed} compact key={item.to} to={item.to} icon={item.icon} label={item.label} />
          ))}
        </nav>

        <div className="mt-auto space-y-1.5 border-t border-slate-100 pt-6">
          <button
            className="flex w-full items-center rounded-xl px-5 py-4 text-left text-sm font-extrabold text-slate-400 transition-all hover:bg-error/5 hover:text-error group"
            onClick={() => void props.onLogout()}
            title={sidebarCollapsed ? "Log out" : undefined}
            type="button"
          >
            <Icon name="logout" className="text-xl transition-transform group-hover:translate-x-1" />
            {!sidebarCollapsed ? <span className="ml-3">Log out</span> : null}
          </button>
        </div>

      </aside>

      <main className={`min-h-screen bg-[#f8f9fa] transition-[margin] pb-24 lg:pb-0 duration-300 ${sidebarCollapsed ? "lg:ml-20" : "lg:ml-64"}`}>
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between bg-white/60 px-4 lg:px-8 backdrop-blur-2xl border-b border-slate-100/50">
          {isSearchExpanded ? (
            <div className="flex w-full items-center gap-4 animate-fade-in">
               <button onClick={() => setIsSearchExpanded(false)} className="text-slate-400 p-2">
                 <Icon name="arrow_back" />
               </button>
               <div className="flex-1 flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-2">
                 <Icon name="search" className="text-slate-400" />
                 <input 
                  autoFocus
                  className="w-full border-none bg-transparent p-0 text-sm font-bold focus:ring-0" 
                  placeholder={currentMeta.searchPlaceholder}
                  type="text" 
                 />
               </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 lg:gap-10">
                {location.pathname === "/inbox" && props.selectedConversationId ? (
                  <button
                    aria-label="Back to inbox"
                    className="rounded-xl p-2 text-slate-400 transition-all hover:bg-slate-100 lg:hidden"
                    onClick={() => props.onSelectConversation(null)}
                    type="button"
                  >
                    <Icon name="arrow_back" className="text-2xl" />
                  </button>
                ) : (
                  <button
                    aria-label="Open navigation"
                    className="rounded-xl p-2 text-slate-400 transition-all hover:bg-slate-100 lg:hidden"
                    onClick={() => setSidebarOpen(true)}
                    type="button"
                  >
                    <Icon name="menu" className="text-2xl" />
                  </button>
                )}
                <button
                  aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
                  className="hidden rounded-xl p-2.5 text-slate-400 transition-all hover:bg-slate-100 lg:inline-flex"
                  onClick={() => setSidebarCollapsed((current) => !current)}
                  type="button"
                >
                  <Icon name={sidebarCollapsed ? "menu_open" : "menu"} className="text-2xl" />
                </button>
                <div className="flex flex-col">
                  <span className="font-headline text-lg lg:text-2xl font-extrabold tracking-tight text-slate-900 line-clamp-1">{currentMeta.title}</span>
                  {location.pathname === "/inbox" && props.selectedConversationId && (
                     <span className="text-[10px] font-bold text-primary uppercase lg:hidden">Active Chat</span>
                  )}
                </div>
              </div>
              
              <div className="hidden w-64 xl:w-96 items-center gap-3 rounded-2xl bg-surface-container-low/50 px-5 py-2.5 lg:flex border border-outline-variant/20 group focus-within:bg-white focus-within:border-primary/30 focus-within:shadow-[0_8px_24px_-12px_rgba(0,168,132,0.2)] transition-all">
                <Icon name="search" className="text-xl text-outline group-focus-within:text-primary transition-colors" />
                <input
                  className="w-full border-none bg-transparent p-0 text-sm font-bold focus:ring-0 placeholder:text-outline/50"
                  placeholder={currentMeta.searchPlaceholder}
                  type="text"
                />
              </div>

              <div className="flex items-center gap-2 sm:gap-4">
                <button 
                  onClick={() => setIsSearchExpanded(true)}
                  className="rounded-full p-2.5 text-outline transition-colors hover:bg-surface-container-high hover:text-primary lg:hidden"
                >
                  <Icon name="search" />
                </button>
                <div className="flex items-center gap-2 lg:gap-3 rounded-2xl bg-white/80 px-1 py-1 lg:px-2 lg:py-1.5 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] border border-slate-100">
                  <div className="hidden text-right sm:block">
                    <p className="text-[11px] font-extrabold leading-tight text-primary">{props.data.user.name}</p>
                    <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-outline/70">{props.data.user.role}</p>
                  </div>
                  <Avatar label={props.data.user.name} size="h-8 w-8 lg:h-9 lg:w-9" />
                </div>
              </div>
            </>
          )}
        </header>

        {/* Global Floating Action Button */}
        <div className="fixed bottom-28 right-6 z-40 lg:hidden group">
           <button 
            onClick={() => navigate("/campaigns")}
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-2xl shadow-primary/40 active:scale-95 transition-all"
           >
             <Icon name="rocket_launch" className="text-2xl" />
           </button>
           <div className="absolute bottom-full right-0 mb-4 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
              <span className="bg-slate-900 text-[10px] font-bold text-white px-3 py-1 rounded-lg uppercase tracking-widest">Start Broadcast</span>
           </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 z-50 flex h-20 items-center justify-around bg-white/80 px-4 backdrop-blur-2xl border-t border-slate-100 lg:hidden">
           {primaryNavItems.map(item => {
             const active = location.pathname === item.to;
             return (
               <button 
                key={item.to}
                onClick={() => navigate(item.to)}
                className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-primary' : 'text-slate-400'}`}
               >
                 <div className={`flex flex-col items-center justify-center h-10 w-12 rounded-xl transition-all ${active ? 'bg-primary/10' : ''}`}>
                    <Icon name={item.icon} fill={active} className="text-xl" />
                 </div>
                 <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
               </button>
             );
           })}
        </div>


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
          <Route path="/landing-pages" element={<LandingPagesPage data={props.data} onRefresh={props.onRefresh} />} />
          <Route path="/settings" element={<SettingsStudioPage data={props.data} onRefresh={props.onRefresh} />} />
          <Route path="*" element={<Navigate to="/inbox" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function InternalNotesWidget(props: { contact: Contact; onRefresh: () => Promise<void> }) {
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [draftBody, setDraftBody] = useState("");

  const handleSave = async () => {
    if (!draftBody.trim()) return;
    if (editingNoteId) {
      await api(`/api/notes/${editingNoteId}`, { method: "PUT", body: JSON.stringify({ body: draftBody }) });
    } else {
      await api(`/api/contacts/${props.contact.id}/notes`, { method: "POST", body: JSON.stringify({ body: draftBody }) });
    }
    setEditingNoteId(null);
    setIsAddingMode(false);
    setDraftBody("");
    await props.onRefresh();
  };

  const handleDelete = async (id: string) => {
    await api(`/api/notes/${id}`, { method: "DELETE" });
    await props.onRefresh();
  };

  return (
    <InfoCard 
      title="Internal Notes" 
      action={(!isAddingMode && !editingNoteId) ? "+ New" : undefined}
      onActionClick={() => {
        setDraftBody("");
        setIsAddingMode(true);
      }}
    >
      {(isAddingMode || editingNoteId) ? (
        <div className="space-y-2">
          <textarea 
            autoFocus
            className="atrium-input bg-surface-container w-full min-h-[60px] text-xs resize-none" 
            placeholder="Type your note here..."
            value={draftBody}
            onChange={e => setDraftBody(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setIsAddingMode(false); setEditingNoteId(null); }} className="text-[10px] font-bold text-slate-400">Cancel</button>
            <button onClick={() => void handleSave()} className="text-[10px] font-bold text-primary">Save</button>
          </div>
        </div>
      ) : null}

      {!isAddingMode && !editingNoteId && (!props.contact.notes || props.contact.notes.length === 0) ? (
         <p className="text-[11px] text-slate-400 italic">No notes found.</p>
      ) : null}

      <div className="space-y-2 mt-2">
        {props.contact.notes?.map(note => (
          editingNoteId !== note.id && (
            <div key={note.id} className="group relative rounded-lg bg-background p-2">
              <p className="text-[11px] leading-snug text-on-surface whitespace-pre-wrap">{note.body}</p>
              <span className="mt-1 block text-[9px] text-slate-400">
                {formatRelativeChatTime(note.updatedAt)} by {note.author}
              </span>
              <div className="absolute right-2 top-2 hidden gap-2 bg-background pl-2 group-hover:flex">
                <button onClick={() => { setEditingNoteId(note.id); setDraftBody(note.body); setIsAddingMode(false); }} className="text-secondary hover:text-primary">
                  <Icon name="edit" className="text-[12px]" />
                </button>
                <button onClick={() => void handleDelete(note.id)} className="text-slate-400 hover:text-red-500">
                  <Icon name="delete" className="text-[12px]" />
                </button>
              </div>
            </div>
          )
        ))}
      </div>
    </InfoCard>
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
  const [filterStr, setFilterStr] = useState("");
  const [filterStatus, setFilterStatus] = useState<Conversation["status"]>("open");
  const approvedTemplates = props.data.templates.filter((t) => t.twilioContentSid);
  const [templateId, setTemplateId] = useState(approvedTemplates[0]?.id ?? "");
  const [channelId, setChannelId] = useState(props.data.channels[0]?.id ?? "");
  
  const [isTemplateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateVariables, setTemplateVariables] = useState<string[]>([]);

  const selectedConversation =
    props.data.conversations.find((conversation) => conversation.id === props.selectedConversationId) ??
    props.data.conversations[0];
  const chosenTemplate = approvedTemplates.find((template) => template.id === templateId) ?? approvedTemplates[0];
  const [headerMediaUrl, setHeaderMediaUrl] = useState(chosenTemplate?.mediaUrl || "");

  const filteredConversations = useMemo(() => {
    return props.data.conversations.filter(c => {
      // 1. Status Check
      if (c.status !== filterStatus) return false;
      // 2. Search check
      if (filterStr) {
        const lower = filterStr.toLowerCase();
        const contact = c.contact;
        const phoneMatch = contact.phone.toLowerCase().includes(lower);
        const nameMatch = fullName(contact).toLowerCase().includes(lower);
        const labelsMatch = contact.labels.some(l => l.toLowerCase().includes(lower));
        if (!phoneMatch && !nameMatch && !labelsMatch) return false;
      }
      return true;
    });
  }, [props.data.conversations, filterStatus, filterStr]);

  useEffect(() => {
    if (chosenTemplate?.mediaUrl) {
      setHeaderMediaUrl(chosenTemplate.mediaUrl);
    } else {
      setHeaderMediaUrl("");
    }
  }, [chosenTemplate?.id]);

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
        variables: templateVariables,
        headerMediaUrl: headerMediaUrl || undefined
      })
    });
    setTemplateModalOpen(false);
    setTemplateVariables([]);
    await props.onRefresh(selectedConversation.id);
  }

  const quickReplyTemplates = props.data.templates.slice(0, 5);
  const latestInbound = selectedConversation?.messages.filter((message) => message.direction === "inbound").at(-1);

  return (
    <div className="flex min-h-[calc(100vh-72px)] flex-col overflow-hidden lg:h-[calc(100vh-72px)] lg:flex-row">
      <div className={`flex w-full flex-col border-b border-slate-100 bg-surface-container-low lg:w-80 lg:border-b-0 lg:border-r ${props.selectedConversationId ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-0 border-b border-slate-100">
          <div className="bg-gradient-to-br from-primary to-primary-fixed-dim p-6 text-on-primary relative overflow-hidden group">
            <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 opacity-10 transition-transform group-hover:scale-110 duration-1000 pointer-events-none">
              <span className="material-symbols-rounded text-8xl">forum</span>
            </div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                 <h1 className="font-headline text-lg font-bold">Inbox</h1>
                 <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold text-white border border-white/10">{props.unreadCount} New</span>
              </div>
              <div className="grid grid-cols-5 gap-1 rounded-xl bg-white/10 p-1 border border-white/10">
                <button onClick={() => setFilterStatus("open")} className={`rounded-lg py-1.5 text-[9px] font-black uppercase tracking-tighter transition-all ${filterStatus === "open" ? "bg-white text-primary shadow-sm" : "text-white/60 hover:text-white"}`}>Open</button>
                <button onClick={() => setFilterStatus("KIV")} className={`rounded-lg py-1.5 text-[9px] font-black uppercase tracking-tighter transition-all ${filterStatus === "KIV" ? "bg-white text-primary shadow-sm" : "text-white/60 hover:text-white"}`}>KIV</button>
                <button onClick={() => setFilterStatus("pending")} className={`rounded-lg py-1.5 text-[9px] font-black uppercase tracking-tighter transition-all ${filterStatus === "pending" ? "bg-white text-primary shadow-sm" : "text-white/60 hover:text-white"}`}>Pend</button>
                <button onClick={() => setFilterStatus("follow up")} className={`rounded-lg py-1.5 text-[9px] font-black uppercase tracking-tighter transition-all ${filterStatus === "follow up" ? "bg-white text-primary shadow-sm" : "text-white/60 hover:text-white"}`}>FolUp</button>
                <button onClick={() => setFilterStatus("resolved")} className={`rounded-lg py-1.5 text-[9px] font-black uppercase tracking-tighter transition-all ${filterStatus === "resolved" ? "bg-white text-primary shadow-sm" : "text-white/60 hover:text-white"}`}>Done</button>
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="relative">
            <input 
              className="atrium-input bg-surface-container-lowest pl-9 text-sm" 
              placeholder="Search by phone, label, name..." 
              value={filterStr} 
              onChange={e => setFilterStr(e.target.value)} 
            />
            <Icon name="search" className="absolute left-3 top-2.5 text-[18px] text-slate-400" />
          </div>
        </div>
        <div className="max-h-[24rem] flex-1 space-y-1 overflow-y-auto px-2 pb-4 lg:max-h-none">
          {filteredConversations.map((conversation) => {
            const latest = conversation.messages[conversation.messages.length - 1];
            const active = conversation.id === selectedConversation?.id;
            const hasUnread = conversation.messages.some(m => m.direction === 'inbound' && m.status !== 'read');
            
            return (
              <button
                className={`group relative w-full overflow-hidden rounded-2xl p-4 text-left transition-all duration-300 ${
                  active 
                    ? "bg-white shadow-[0_4px_20px_-10px_rgba(0,0,0,0.08)] ring-1 ring-slate-100" 
                    : "hover:bg-white/50"
                }`}
                key={conversation.id}
                onClick={() => props.onSelectConversation(conversation.id)}
              >
                {/* Active Accent Bar */}
                <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-full bg-primary transition-all duration-300 ${active ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0"}`} />
                
                <div className="flex gap-4">
                  <div className="relative shrink-0">
                    <Avatar label={fullName(conversation.contact)} size="h-12 w-12" />
                    {hasUnread && (
                      <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-surface-container-low bg-primary shadow-sm" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className={`truncate text-sm font-extrabold ${active ? "text-primary" : "text-slate-900"}`}>
                        {fullName(conversation.contact)}
                      </h4>
                      <span className={`shrink-0 text-[10px] font-bold uppercase tracking-tight ${active ? "text-primary/70" : "text-slate-400"}`}>
                        {formatRelativeChatTime(conversation.lastMessageAt)}
                      </span>
                    </div>
                    <p className={`mt-1 truncate text-xs leading-relaxed ${active ? "font-medium text-slate-600" : "text-slate-500"}`}>
                      {latest?.body ?? "No messages yet"}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5 items-center">
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${
                        conversation.status === 'open' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        conversation.status === 'follow up' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        conversation.status === 'pending' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                        conversation.status === 'KIV' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                        'bg-slate-50 text-slate-500 border-slate-100'
                      }`}>
                        {conversation.status}
                      </span>
                      <div className="h-3 w-px bg-slate-100 mx-0.5" />
                      {(conversation.contact.labels.length ? conversation.contact.labels : conversation.contact.segmentIds.slice(0, 2)).map((labelOrId) => (
                        <span
                          className={`rounded-md px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.05em] transition-colors ${
                            active 
                              ? "bg-primary/5 text-primary" 
                              : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
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

      <div className={`flex min-w-0 flex-1 flex-col overflow-hidden bg-surface ${props.selectedConversationId ? 'flex' : 'hidden lg:flex'}`}>
        <div className="z-10 flex flex-col gap-3 bg-surface-container-lowest px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar label={selectedConversation ? fullName(selectedConversation.contact) : "Contact"} size="h-10 w-10" />
              <div className={`mt-1 flex h-4 w-4 items-center justify-center rounded-md border border-slate-200 bg-white shadow-inner`}>
                <Icon name="check" className="text-[10px] font-extrabold text-emerald-500" />
              </div>
            </div>
            <div>
              <h3 className="font-headline text-base font-bold leading-tight text-on-surface">
                {selectedConversation ? fullName(selectedConversation.contact) : "No conversation"}
              </h3>
              <p className="flex items-center gap-1 text-[11px] font-medium text-secondary">
                <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
                Live on {selectedConversation?.channel.whatsappNumber ?? "N/A"}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {selectedConversation && (
              <div className="flex items-center gap-2 mr-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-tight">Status:</span>
                <select 
                  className="atrium-input py-1.5 text-xs font-semibold text-primary w-fit bg-primary/5 border-none shadow-none"
                  value={selectedConversation.status}
                  onChange={async (e) => {
                     await api(`/api/conversations/${selectedConversation.id}/status`, {
                       method: "POST", body: JSON.stringify({ status: e.target.value })
                     });
                     await props.onRefresh(selectedConversation.id);
                  }}
                >
                  <option value="open">🟢 Open</option>
                  <option value="follow up">🟠 Follow-up</option>
                  <option value="pending">🟡 Pending</option>
                  <option value="KIV">🟣 KIV</option>
                  <option value="resolved">⚪ Resolved</option>
                </select>
              </div>
            )}

            {selectedConversation?.status !== "resolved" && (
              <button onClick={async () => {
                if (selectedConversation) {
                  await api(`/api/conversations/${selectedConversation.id}/status`, { method: "POST", body: JSON.stringify({ status: "resolved" }) });
                  await props.onRefresh(selectedConversation.id);
                }
              }} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary">Resolve</button>
            )}
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
                  
                  {chosenTemplate?.mediaUrl && (
                    <div className="flex flex-col mt-4">
                      <Field label="Dynamic Web Image Link (Optional, overrides template header)">
                        <input className="atrium-input" placeholder="https://example.com/image.png" value={headerMediaUrl} onChange={(e) => setHeaderMediaUrl(e.target.value)} />
                      </Field>
                      {chosenTemplate.mediaUrl.includes('{{') && (
                        <p className="mt-2 text-xs text-slate-500">
                          Template media link: <code className="bg-slate-100 px-1 rounded text-primary">{chosenTemplate.mediaUrl}</code>
                        </p>
                      )}
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
                  <TemplateLivePreview template={chosenTemplate} variables={templateVariables} overrideMediaUrl={headerMediaUrl} />
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

      <div className="w-full overflow-y-auto border-t border-slate-100 bg-surface-container-high p-6 lg:w-72 lg:border-l lg:border-t-0">
        {selectedConversation ? (
          <>
            <div className="flex flex-col text-left">
              <h4 className="font-headline text-xl font-bold text-on-surface mb-1">{fullName(selectedConversation.contact)}</h4>
              <p className="text-sm text-slate-500 mb-1">
                {deriveContactRole(selectedConversation.contact)}, {selectedConversation.contact.company || "tomorrowX Client"}
              </p>
              {(() => {
                const ic = selectedConversation.contact.customFields.identification_number;
                if (!ic) return null;
                const match = String(ic).match(/^(\d{2})/);
                if (!match) return null;
                const yy = parseInt(match[1], 10);
                const birthYear = yy > 26 ? 1900 + yy : 2000 + yy;
                const age = 2026 - birthYear;
                return (
                 <p className="text-sm font-semibold text-slate-700">Age: <span className="font-bold text-primary">{age}</span> <span className="font-normal text-slate-400">({ic})</span></p>
                );
              })()}
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

              <InternalNotesWidget contact={selectedConversation.contact} onRefresh={async () => void props.onRefresh()} />

              <InfoCard title="Latest Activity">
                <TimelineEntry accent icon="check" title="Conversation updated" meta={formatLongDate(selectedConversation.updatedAt)} />
                <TimelineEntry icon="description" title="Template preview available" meta={chosenTemplate?.name ?? "No template selected"} />
                <TimelineEntry icon="group" title="Segments attached" meta={selectedConversation.contact.segmentIds.map((segmentId) => resolveLabel(segmentId, props.data)).join(", ") || "No segments"} />
              </InfoCard>

              {(selectedConversation.contact.vehicles?.length > 0 || selectedConversation.contact.orders?.length > 0) && (
                <InfoCard title="Insurance Portfolio">
                  {selectedConversation.contact.vehicles?.map(v => (
                    <div key={v.id} className="flex flex-col gap-0.5 mb-3 last:mb-0 border-l-2 border-primary/20 pl-3">
                       <p className="text-xs font-bold text-on-surface">{v.vehicleRegistrationNo}</p>
                       <p className="text-[10px] text-on-surface-variant font-medium">{v.vehicleModel || v.vehicleType || "Unknown Model"} ({v.makeYear || "—"})</p>
                    </div>
                  ))}
                  {selectedConversation.contact.orders?.map(o => (
                    <div key={o.id} className="flex flex-col gap-0.5 mt-3 pt-3 border-t border-outline-variant/10">
                       <div className="flex justify-between items-start">
                          <p className="text-[10px] font-bold text-primary">{o.orderNo}</p>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${o.orderStatus?.toLowerCase() === 'paid' ? 'bg-secondary/10 text-secondary' : 'bg-surface-container text-on-surface-variant'}`}>{o.orderStatus}</span>
                       </div>
                       <p className="text-[10px] text-on-surface-variant">{o.orderDate || "Date N/A"}</p>
                    </div>
                  ))}
                </InfoCard>
              )}
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
  
  const selectedTemplate = approvedTemplates.find((template) => template.id === templateId) ?? approvedTemplates[0];
  const [headerMediaUrl, setHeaderMediaUrl] = useState(selectedTemplate?.mediaUrl || "");
  const [feedback, setFeedback] = useState<string | null>(null);

  const previewContact = props.data.contacts[0];

  useEffect(() => {
    if (selectedTemplate?.mediaUrl) {
      setHeaderMediaUrl(selectedTemplate.mediaUrl);
    } else {
      setHeaderMediaUrl("");
    }
  }, [selectedTemplate?.id]);
  const recipientOptions = useMemo(() =>
    recipientMode === "contacts"
      ? props.data.contacts.map((contact) => ({ id: contact.id, label: fullName(contact), subtitle: contact.company || contact.phone }))
      : props.data.segments.map((segment) => ({
          id: segment.id,
          label: segment.name,
          subtitle: `${props.data.contacts.filter((contact) => contact.segmentIds.includes(segment.id)).length} contacts`
        })), [recipientMode, props.data.contacts, props.data.segments]);

  useEffect(() => {
    if (recipientOptions.length > 0 && !recipientOptions.some((item) => recipientIds.includes(item.id))) {
      setRecipientIds([recipientOptions[0].id]);
    }
  }, [recipientMode, recipientOptions]);

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
    <StudioPageShell
      title="Broadcast Wizard"
      subtitle="Design, validate, and launch high-impact WhatsApp campaigns from your centralized atrium."
      heroIcon="campaign"
      eyebrow={
        <nav className="mb-1 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] opacity-60">
          <span>Campaigns</span>
          <Icon name="chevron_right" className="text-sm opacity-50" />
          <span className="text-white bg-white/20 px-2 py-0.5 rounded-md">New Broadcast</span>
        </nav>
      }
    >
      <div className="fixed -right-40 -top-40 -z-10 h-[600px] w-[600px] rounded-full bg-primary-fixed/10 blur-[120px]" />
      <div className="fixed bottom-0 left-10 -z-10 h-[400px] w-[400px] rounded-full bg-secondary-fixed/10 blur-[100px]" />

      <div className="mb-12 hidden lg:flex max-w-4xl items-center justify-between gap-4 bg-white/50 backdrop-blur-md p-4 rounded-[2rem] border border-slate-100 shadow-[0_4px_24px_-12px_rgba(0,0,0,0.05)]">
        <WizardStep index={1} label="Template" status={currentStep === 1 ? "selected" : "pending"} />
        <div className="mx-2 h-[2px] flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full bg-primary transition-all duration-700 ease-out ${currentStep >= 2 ? "w-full" : "w-0"}`} />
        </div>
        <WizardStep index={2} label="Audience" status={currentStep === 2 ? "selected" : currentStep > 2 ? "pending" : "locked"} dim={currentStep < 2} />
        <div className="mx-2 h-[2px] flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full bg-primary transition-all duration-700 ease-out ${currentStep >= 3 ? "w-full" : "w-0"}`} />
        </div>
        <WizardStep dim={currentStep < 3} index={3} label="Launch" status={currentStep === 3 ? "selected" : "locked"} />
      </div>

      {/* Mobile Step Indicator */}
      <div className="mb-8 flex items-center justify-between rounded-[2rem] bg-white p-6 shadow-sm border border-slate-100 lg:hidden">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Step {currentStep} of 3</span>
          <span className="text-sm font-black text-slate-900">
            {currentStep === 1 ? "Select Template" : currentStep === 2 ? "Choose Audience" : "Configure & Launch"}
          </span>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-black">
          {currentStep}
        </div>
      </div>


      <div className="grid grid-cols-12 gap-6 lg:gap-8">
        <div className="col-span-12 xl:col-span-7 space-y-6">
          {currentStep === 1 && (
            <>
              <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-[0_4px_24px_-10px_rgba(0,0,0,0.05)]">
                <SectionTitle icon="campaign" title="Campaign Basics" />
                <div className="grid gap-6 md:grid-cols-2 mt-6">
                  <Field label="Campaign Name">
                    <input className="atrium-input bg-slate-50/50 border-slate-100" value={name} onChange={(event) => setName(event.target.value)} />
                  </Field>
                  <Field label="Dispatch Channel">
                    <select className="atrium-input bg-slate-50/50 border-slate-100" value={channelId} onChange={(event) => setChannelId(event.target.value)}>
                      {props.data.channels.map((channel) => (
                        <option key={channel.id} value={channel.id}>
                          {channel.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>
              <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-[0_4px_24px_-10px_rgba(0,0,0,0.05)]">
                <SectionTitle icon="grid_view" title="Select Approved Template" />
                {approvedTemplates.length === 0 ? (
                  <div className="rounded-2xl border border-warning/20 bg-warning/5 p-6 mt-6">
                    <div className="flex gap-4">
                       <Icon name="warning" className="text-warning text-3xl" />
                       <div>
                          <p className="font-extrabold text-warning-container text-sm">No Templates Synced</p>
                          <p className="text-xs text-warning-container/80 mt-1">You have no approved Twilio templates synced. Go to Templates to sync from Twilio.</p>
                       </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 mt-6">
                    <Field label="Template Format">
                      <select className="atrium-input bg-slate-50/50 border-slate-100" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                        {approvedTemplates.map(t => (
                          <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                        ))}
                      </select>
                    </Field>
                    {selectedTemplate?.mediaUrl && (
                      <div className="flex flex-col">
                        <Field label="Dynamic Web Image Link (Optional, overrides template header)">
                          <input className="atrium-input bg-slate-50/50 border-slate-100" placeholder="https://example.com/image.png" value={headerMediaUrl} onChange={(e) => setHeaderMediaUrl(e.target.value)} />
                        </Field>
                        {selectedTemplate.mediaUrl.includes('{{') && (
                          <p className="mt-2 text-[10px] font-bold text-slate-400">
                            Template media link: <code className="bg-slate-100 px-1.5 py-0.5 rounded-md text-primary ml-1">{selectedTemplate.mediaUrl}</code>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {currentStep === 2 && (
            <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-[0_4px_24px_-10px_rgba(0,0,0,0.05)]">
            <SectionTitle icon="person_add" title="Audience Selection" />
            <div className="grid gap-6 lg:grid-cols-2 mt-6">
              <NavLink to="/contacts" className="group rounded-[2rem] border-2 border-dashed border-primary p-8 transition-all hover:bg-primary/5 hover:border-primary/50 block cursor-pointer">
                <div className="flex flex-col items-center justify-center text-center h-full min-h-[140px]">
                  <Icon className="mb-3 text-4xl text-primary transition-transform group-hover:-translate-y-2 group-hover:scale-110" name="cloud_upload" />
                  <span className="text-sm font-extrabold text-primary">Upload Target Roster</span>
                  <span className="mt-2 text-[10px] font-bold text-slate-400">Jump to Contacts Manager for CSV Mappings</span>
                </div>
              </NavLink>
              <div className="flex flex-col rounded-[2rem] border border-slate-100 bg-slate-50/50 p-5">
                <div className="mb-5 flex items-center justify-between">
                  <span className="text-sm font-extrabold text-slate-800">Existing Target Pool</span>
                  <Icon className="text-sm text-primary" name="search" />
                </div>
                <div className="mb-5 flex gap-2">
                  <button
                    className={`rounded-xl px-5 py-2.5 text-[10px] font-extrabold uppercase tracking-widest transition-all ${recipientMode === "segments" ? "bg-primary text-on-primary shadow-sm" : "bg-white text-slate-400 border border-slate-100 hover:text-primary"}`}
                    onClick={() => {
                      setRecipientMode("segments");
                      setRecipientIds(props.data.segments[0] ? [props.data.segments[0].id] : []);
                    }}
                    type="button"
                  >
                    Segments
                  </button>
                  <button
                    className={`rounded-xl px-5 py-2.5 text-[10px] font-extrabold uppercase tracking-widest transition-all ${recipientMode === "contacts" ? "bg-primary text-on-primary shadow-sm" : "bg-white text-slate-400 border border-slate-100 hover:text-primary"}`}
                    onClick={() => {
                      setRecipientMode("contacts");
                      setRecipientIds(props.data.contacts[0] ? [props.data.contacts[0].id] : []);
                    }}
                    type="button"
                  >
                    Individuals
                  </button>
                </div>
                <div className="custom-scrollbar max-h-48 space-y-2 overflow-y-auto pr-2">
                  {recipientOptions.map((option) => {
                    const active = recipientIds.includes(option.id);
                    return (
                      <button
                        className={`flex w-full items-center justify-between rounded-2xl p-4 text-left transition-all ${
                          active ? "border border-primary/20 bg-primary/5 shadow-sm" : "bg-white border border-slate-100 hover:border-primary/30"
                        }`}
                        key={option.id}
                        onClick={() => setRecipientIds(active ? recipientIds.filter((id) => id !== option.id) : [...recipientIds, option.id])}
                        type="button"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`text-lg ${active ? 'text-primary' : 'text-slate-300'}`} name="group" />
                          <div>
                            <div className={`text-xs font-extrabold ${active ? 'text-primary' : 'text-slate-700'}`}>{option.label}</div>
                            <div className="text-[10px] font-bold text-slate-400">{option.subtitle}</div>
                          </div>
                        </div>
                        {active ? <Icon className="text-primary text-xl" fill name="check_circle" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <Field label="Dispatch Cadence">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={() => setScheduledAt("")}
                      className={`px-4 py-2 text-[10px] font-extrabold uppercase tracking-widest rounded-xl transition-all ${!scheduledAt ? 'bg-primary text-on-primary shadow-sm' : 'bg-slate-50 text-slate-400 border border-slate-100 hover:text-primary'}`}
                    >
                      Instant Launch
                    </button>
                    <button 
                      type="button"
                      onClick={() => !scheduledAt && setScheduledAt(new Date(Date.now() + 3600000).toISOString().slice(0, 16))}
                      className={`px-4 py-2 text-[10px] font-extrabold uppercase tracking-widest rounded-xl transition-all ${scheduledAt ? 'bg-primary text-on-primary shadow-sm' : 'bg-slate-50 text-slate-400 border border-slate-100 hover:text-primary'}`}
                    >
                      Schedule
                    </button>
                  </div>
                  {scheduledAt !== "" && (
                    <input className="atrium-input bg-slate-50/50 border-slate-100" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
                  )}
                </div>
              </Field>
              <Field label="Audience Volume">
                <div className="atrium-input bg-primary/5 border-primary/20 flex items-center font-extrabold text-primary shadow-inner">
                   {recipientEstimate.toLocaleString()} verified nodes
                </div>
              </Field>
              <Field label="Recurrence Engine">
                <select className="atrium-input bg-slate-50/50 border-slate-100" value={recurringInterval} onChange={(event) => setRecurringInterval(event.target.value as any)}>
                  <option value="none">One-time (Do Not Repeat)</option>
                  <option value="daily">Daily Cadence</option>
                  <option value="weekly">Weekly Cadence</option>
                  <option value="monthly">Monthly Cadence</option>
                </select>
              </Field>
              {recurringInterval !== "none" && (
                <Field label="Lifecycle End Bounds (Optional)">
                  <input className="atrium-input bg-slate-50/50 border-slate-100" type="datetime-local" value={recurringUntil} onChange={(event) => setRecurringUntil(event.target.value)} />
                </Field>
              )}
            </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-[0_4px_24px_-10px_rgba(0,0,0,0.05)]">
              <SectionTitle icon="data_object" title="Template Variables" />
              <div className="space-y-6 mt-6 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
                {Array.isArray(selectedTemplate?.placeholders) && selectedTemplate.placeholders.length > 0 ? (
                  selectedTemplate.placeholders.map((ph, idx) => (
                    <Field key={idx} label={`Dynamic Variable {{${idx + 1}}} (${ph})`}>
                      <input
                        className="atrium-input bg-slate-50/50 border-slate-100"
                        placeholder={`Provide value for ${ph}`}
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
                  <div className="rounded-2xl bg-slate-50/50 border border-slate-100 p-6 flex items-center justify-center">
                    <p className="text-sm font-bold text-slate-400">Static Template — No runtime variables required to dispatch.</p>
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
        <div className="flex flex-col gap-5 rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-[0_4px_24px_-10px_rgba(0,0,0,0.05)] md:flex-row md:items-center md:justify-between sticky bottom-6 z-30">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary shadow-inner">
              <Icon name="history_edu" className="text-2xl" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-800">Wizard Progression</p>
              <div className="flex gap-1 mt-1">
                 {[1,2,3].map(step => (
                    <div key={step} className={`h-1.5 rounded-full transition-all ${currentStep >= step ? 'w-6 bg-primary' : 'w-2 bg-slate-100'}`} />
                 ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {currentStep > 1 && (
            <button
              type="button"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-8 py-4 text-sm font-extrabold text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-800 active:scale-[0.98]"
              onClick={() => setCurrentStep(prev => prev - 1)}
            >
              Go Back
            </button>
            )}
            {currentStep < 3 ? (
            <button
              type="button"
              className="group flex items-center justify-center gap-3 rounded-2xl bg-primary px-10 py-4 text-sm font-extrabold text-on-primary shadow-[0_8px_30px_-6px_rgba(var(--color-primary),0.5)] transition-all hover:shadow-[0_12px_40px_-6px_rgba(var(--color-primary),0.6)] active:scale-95 disabled:opacity-50 disabled:grayscale w-full sm:w-auto"
              onClick={() => setCurrentStep(prev => prev + 1)}
              disabled={currentStep === 1 && !templateId}
            >
              Continue to {currentStep === 1 ? 'Audience' : 'Launch'}
              <Icon className="transition-transform group-hover:translate-x-1" name="arrow_forward" />
            </button>
            ) : (
            <button
              type="button"
              className="group flex items-center justify-center gap-3 rounded-2xl bg-primary px-10 py-4 text-sm font-extrabold text-on-primary shadow-[0_8px_30px_-6px_rgba(var(--color-primary),0.5)] transition-all hover:shadow-[0_12px_40px_-6px_rgba(var(--color-primary),0.6)] active:scale-95 w-full sm:w-auto overflow-hidden relative"
              onClick={async () => {
                try {
                  await launchCampaign();
                  setCurrentStep(1);
                } catch (err: any) {
                  setFeedback(err.message || "Failed to launch campaign");
                }
              }}
            >
              <div className="absolute inset-0 bg-white/20 w-0 group-hover:w-full transition-all duration-500 ease-out z-0 pointer-events-none" />
              <span className="relative z-10">{scheduledAt ? "Queue Campaign" : "Broadcast Now"}</span>
              <Icon className="relative z-10 transition-transform group-hover:scale-110" name={scheduledAt ? "schedule_send" : "send"} />
            </button>
            )}
          </div>
        </div>
        
      <div className="mt-16 w-full max-w-5xl mx-auto rounded-[3rem] bg-white p-8 border border-slate-100 shadow-[0_4px_32px_-12px_rgba(0,0,0,0.04)]">
        <div className="mb-6">
          <SectionTitle icon="insert_chart" title="Recent Campaigns Engine" />
        </div>
        
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto rounded-[2rem] border border-slate-100">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 text-left text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">
                <th className="px-6 py-5 rounded-tl-[2rem]">Campaign Context</th>
                <th className="px-6 py-5">Lifecycle Status</th>
                <th className="px-6 py-5">Attempted Node Target</th>
                <th className="px-6 py-5">Successful Deliveries</th>
                <th className="px-6 py-5 rounded-tr-[2rem]">Processing Failures</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {props.data.campaigns.map((campaign) => (
                <tr key={campaign.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-5 font-bold text-slate-800">{campaign.name}</td>
                  <td className="px-6 py-5">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider ${campaign.status === "sent" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-primary/10 text-primary border border-primary/20"}`}>
                      {campaign.status === "sent" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                      {campaign.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 font-medium text-slate-500">{campaign.stats.attempted.toLocaleString()}</td>
                  <td className="px-6 py-5 font-bold text-primary">{campaign.stats.delivered.toLocaleString()}</td>
                  <td className="px-6 py-5 font-medium text-error flex items-center gap-1.5">
                     {campaign.stats.failed > 0 && <Icon name="error" className="text-[14px]" />}
                     {campaign.stats.failed.toLocaleString()}
                  </td>
                </tr>
              ))}
              {!props.data.campaigns.length ? (
                <tr>
                  <td className="px-6 py-10 text-center text-sm font-bold text-slate-400 italic" colSpan={5}>
                    No campaigns launched yet. Awaiting initialization.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden flex flex-col gap-4">
          {props.data.campaigns.map((campaign) => (
            <div key={campaign.id} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm relative overflow-hidden">
               <div className={`absolute top-0 right-0 w-16 h-16 blur-2xl -mr-8 -mt-8 rounded-full pointer-events-none ${campaign.status === "sent" ? "bg-emerald-500/20" : "bg-primary/20"}`} />
               <div className="flex justify-between items-start mb-4 relative z-10">
                  <h3 className="font-extrabold text-slate-800 text-lg leading-tight w-2/3">{campaign.name}</h3>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-widest ${campaign.status === "sent" ? "bg-emerald-50 text-emerald-600" : "bg-primary/10 text-primary"}`}>
                    {campaign.status}
                  </span>
               </div>
               <div className="grid grid-cols-3 gap-2 border-t border-slate-50 pt-4 relative z-10">
                  <div>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Attempted</p>
                     <p className="text-sm font-bold text-slate-700">{campaign.stats.attempted.toLocaleString()}</p>
                  </div>
                  <div>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Delivered</p>
                     <p className="text-sm font-extrabold text-primary">{campaign.stats.delivered.toLocaleString()}</p>
                  </div>
                  <div>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Failed</p>
                     <p className={`text-sm font-bold ${campaign.stats.failed > 0 ? "text-error" : "text-slate-400"}`}>{campaign.stats.failed.toLocaleString()}</p>
                  </div>
               </div>
            </div>
          ))}
          {!props.data.campaigns.length && (
            <div className="py-10 text-center text-sm font-bold text-slate-400 italic rounded-3xl border-2 border-dashed border-slate-100">
               No campaigns launched yet.
            </div>
          )}
        </div>
      </div>

      {feedback && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 rounded-full bg-slate-900 border border-slate-800 px-6 py-4 text-xs font-extrabold uppercase tracking-[0.2em] text-white shadow-[0_20px_40px_-5px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-5">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            {feedback}
            <button onClick={() => setFeedback(null)} className="ml-2 bg-slate-800 rounded-full p-1 hover:bg-slate-700 transition-colors">
               <Icon name="close" className="text-slate-400 text-sm" />
            </button>
          </div>
        </div>
      )}
      </div>
    </StudioPageShell>
  );
}

function ContactProfileModal(props: { contact: Contact; onClose: () => void; onRefresh: () => Promise<void>; customFieldDefinitions: string[] }) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ ...props.contact, customFields: { ...props.contact.customFields } });
  
  const totalVehicles = props.contact.vehicles?.length || 0;
  const totalAmountPaid = (props.contact.orders || []).reduce((acc, order) => {
     let amount = 0;
     if (order.netTransaction) amount = parseFloat(order.netTransaction.replace(/[^0-9.-]+/g, ""));
     else if (order.netWrittenPremium) amount = parseFloat(order.netWrittenPremium.replace(/[^0-9.-]+/g, ""));
     return acc + (isNaN(amount) ? 0 : amount);
  }, 0);

  const fallbackName = props.contact.vehicles?.[0]?.vehicleOwnerName || "Unknown Contact";
  const displayName = form.firstName || form.lastName ? `${form.firstName} ${form.lastName}`.trim() : fallbackName;
  const splitName = displayName.split(" ");
  const avatarText = (splitName[0]?.charAt(0) || "U") + (splitName[1]?.charAt(0) || "");

  async function handleSave() {
     await api("/api/contacts", {
        method: "POST",
        body: JSON.stringify(form)
     });
     setIsEditing(false);
     await props.onRefresh();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#091b18]/60 backdrop-blur-sm">
      <div className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-[2.5rem] bg-surface-container-lowest shadow-[0_40px_120px_-48px_rgba(0,69,61,0.5)]">
        {/* Banner Header */}
        <div className="bg-gradient-to-r from-primary-fixed to-tertiary-fixed px-10 py-10 relative">
          <button onClick={props.onClose} className="absolute top-6 right-6 h-10 w-10 flex items-center justify-center rounded-full bg-surface-container-lowest/20 hover:bg-surface-container-lowest/40 transition-colors text-surface-container-lowest">
            <Icon name="close" />
          </button>
          
          <div className="flex flex-col md:flex-row md:items-end gap-6 relative z-10 text-on-primary-fixed">
            <div className="h-28 w-28 flex-shrink-0 flex items-center justify-center rounded-[2rem] bg-surface-container-lowest shadow-xl text-primary font-headline text-4xl border-4 border-surface-container-lowest/50">
               {avatarText}
            </div>
            <div className="flex-1 pb-2">
               <h2 className="font-headline text-4xl font-bold">{displayName}</h2>
               <div className="flex flex-wrap gap-4 mt-3 text-sm font-medium opacity-90">
                  <span className="flex items-center gap-1.5"><Icon className="text-base" name="call" /> {form.phone}</span>
                  {form.email && <span className="flex items-center gap-1.5"><Icon className="text-base" name="mail" /> {form.email}</span>}
                  {form.company && <span className="flex items-center gap-1.5"><Icon className="text-base" name="business" /> {form.company}</span>}
               </div>
            </div>
            
            <div className="flex gap-4 pb-2 text-on-primary-fixed">
               <div className="bg-surface-container-lowest/20 backdrop-blur px-5 py-3 rounded-2xl border border-white/20">
                  <p className="text-[10px] font-black tracking-widest uppercase opacity-60 mb-0.5">Vehicles</p>
                  <p className="text-2xl font-bold font-mono leading-none">{totalVehicles}</p>
               </div>
               <div className="bg-surface-container-lowest/20 backdrop-blur px-5 py-3 rounded-2xl border border-white/20">
                  <p className="text-[10px] font-black tracking-widest uppercase opacity-60 mb-0.5">Total Premium</p>
                  <p className="text-2xl font-bold font-mono leading-none">${totalAmountPaid.toLocaleString()}</p>
               </div>
            </div>
          </div>
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-10 bg-surface-container-lowest">
           <div className="flex justify-between items-center mb-8 border-b border-outline-variant/20 pb-4">
              <h3 className="font-headline text-xl font-bold text-on-surface">Data Profile</h3>
              <div className="flex gap-3">
                 {isEditing ? (
                    <>
                       <button onClick={() => setIsEditing(false)} className="px-5 py-2 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-colors">Cancel</button>
                       <button onClick={() => void handleSave()} className="px-5 py-2 rounded-xl text-sm font-bold bg-primary text-on-primary hover:opacity-90 transition-opacity">Save Profile</button>
                    </>
                 ) : (
                    <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-secondary-fixed text-on-secondary-fixed hover:bg-secondary-fixed-dim transition-colors">
                       <Icon className="text-[18px]" name="edit" /> Edit
                    </button>
                 )}
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-10">
              <div className="space-y-6">
                 <h4 className="text-xs font-bold text-secondary uppercase tracking-widest">Standard Identifiers</h4>
                 <div className="grid grid-cols-2 gap-4">
                    <Field label="First Name"><input disabled={!isEditing} className={`atrium-input bg-transparent disabled:opacity-70 disabled:border-transparent disabled:px-0`} value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} /></Field>
                    <Field label="Last Name"><input disabled={!isEditing} className={`atrium-input bg-transparent disabled:opacity-70 disabled:border-transparent disabled:px-0`} value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} /></Field>
                    <Field label="Phone No."><input disabled={!isEditing} className={`atrium-input bg-transparent disabled:opacity-70 disabled:border-transparent disabled:px-0`} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></Field>
                    <Field label="Identification No. (NRIC)">
                       <input disabled={!isEditing} className={`atrium-input bg-transparent disabled:opacity-70 disabled:border-transparent disabled:px-0`} value={form.customFields["identification_number"] || ""} onChange={e => setForm(f => ({ ...f, customFields: { ...f.customFields, identification_number: e.target.value } }))} placeholder="Not provided" />
                    </Field>
                    <div className="col-span-2">
                       <Field label="Email Address"><input disabled={!isEditing} className={`atrium-input bg-transparent disabled:opacity-70 disabled:border-transparent disabled:px-0`} value={form.email || ""} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Not provided" /></Field>
                    </div>
                 </div>
              </div>

              <div className="space-y-6 lg:border-l lg:border-outline-variant/20 lg:pl-12">
                 <h4 className="text-xs font-bold text-secondary uppercase tracking-widest">Custom Attributes</h4>
                 {props.customFieldDefinitions.filter(k => k !== "identification_number").map(key => (
                    <Field key={key} label={key.replace(/_/g, " ")}>
                       <input disabled={!isEditing} className={`atrium-input bg-transparent disabled:opacity-70 disabled:border-transparent disabled:px-0`} value={form.customFields[key] || ""} onChange={e => setForm(f => ({ ...f, customFields: { ...f.customFields, [key]: e.target.value } }))} placeholder="—" />
                    </Field>
                 ))}
                 {props.customFieldDefinitions.filter(k => k !== "identification_number").length === 0 && (
                    <p className="text-sm text-on-surface-variant italic">No custom fields mapped to this profile.</p>
                 )}
              </div>
           </div>

           {(props.contact.vehicles && props.contact.vehicles.length > 0) && (
              <div className="mt-12 rounded-[2rem] bg-white border border-slate-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                 <div className="bg-primary/5 px-8 py-5 border-b border-primary/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <Icon name="directions_car" className="text-primary text-xl" />
                       <h4 className="text-[11px] font-black text-primary uppercase tracking-widest">Insured Assets</h4>
                    </div>
                    <span className="bg-primary text-on-primary text-[9px] font-black px-2 py-0.5 rounded-full">{props.contact.vehicles.length} Units</span>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                       <thead className="bg-[#fcfdfd] border-b border-slate-50">
                          <tr className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                             <th className="px-8 py-4">Reg No</th>
                             <th className="px-8 py-4">Vehicle Identity</th>
                             <th className="px-8 py-4">Category</th>
                             <th className="px-8 py-4 text-right">Value (Basis)</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {props.contact.vehicles.map(v => (
                             <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-8 py-4 font-black font-mono text-primary text-xs">{v.vehicleRegistrationNo}</td>
                                <td className="px-8 py-4">
                                   <div className="font-extrabold text-slate-700">{v.vehicleModel || "Unspecified Model"}</div>
                                   <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{v.makeYear ? `Make Year: ${v.makeYear}` : 'Identity Not Found'}</div>
                                </td>
                                <td className="px-8 py-4">
                                   <span className="bg-slate-100 text-slate-500 text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-wider">{v.vehicleType || 'Unknown'}</span>
                                </td>
                                <td className="px-8 py-4 font-mono text-right text-xs font-black text-slate-600">{v.marketValue || "—"}</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>
           )}

            {(props.contact.orders && props.contact.orders.length > 0) && (
               <div className="mt-12 rounded-[2rem] bg-white border border-slate-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                  <div className="bg-secondary/5 px-8 py-5 border-b border-secondary/10 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <Icon name="receipt_long" className="text-secondary text-xl" />
                        <h4 className="text-[11px] font-black text-secondary uppercase tracking-widest">Policy History</h4>
                     </div>
                     <span className="bg-secondary text-on-primary text-[9px] font-black px-2 py-0.5 rounded-full">{props.contact.orders.length} Records</span>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-[#fcfdfd] border-b border-slate-50">
                           <tr className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                              <th className="px-8 py-4">Reference</th>
                              <th className="px-8 py-4">Status & Logistics</th>
                              <th className="px-8 py-4">Asset Link</th>
                              <th className="px-8 py-4 text-right">Premium / Gross</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                           {props.contact.orders.map(o => {
                              const norm = (s: string) => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
                              const linkedVehicle = props.contact.vehicles?.find(v => norm(v.vehicleRegistrationNo) === norm(o.vehicleRegistrationNo));
                              return (
                              <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                                 <td className="px-8 py-4">
                                    <div className="font-extrabold text-secondary font-mono">{o.orderNo}</div>
                                    <div className="text-[9px] text-slate-400 font-bold uppercase">{o.orderDate || 'No Date'}</div>
                                 </td>
                                 <td className="px-8 py-4">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${o.orderStatus?.toLowerCase() === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                       {o.orderStatus || 'Pending'}
                                    </span>
                                    <div className="text-[9px] text-slate-400 font-bold mt-1.5 uppercase tracking-tighter">CN: {o.coverNoteNo || "—"} • {o.paymentMethod || "—"}</div>
                                 </td>
                                 <td className="px-8 py-4 font-mono">
                                    <div className="font-black text-xs text-slate-600">{o.vehicleRegistrationNo}</div>
                                    {linkedVehicle?.vehicleModel && <div className="text-[9px] text-slate-400 font-medium uppercase tracking-tighter mt-1">{linkedVehicle.vehicleModel}</div>}
                                 </td>
                                 <td className="px-8 py-4 text-right">
                                    <div className="text-primary font-black font-mono text-xs">{o.netTransaction || "—"}</div>
                                    <div className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-widest">Gross: {o.grossTransaction || "—"}</div>
                                 </td>
                              </tr>
                           )})}
                        </tbody>
                     </table>
                  </div>
               </div>
            )}
          </div>
       </div>
    </div>
  );
}

function ContactsPage(props: {
  data: BootstrapData;
  onOpenConversation: (contactId: string, channelId: string, templateId?: string) => Promise<void>;
  onRefresh: (preferredConversationId?: string | null) => Promise<void>;
}) {
  const [form, setForm] = useState<{
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    company: string;
    labels: string;
    customFields: Record<string, string>;
    segmentMode: string;
  }>({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    company: "",
    labels: "",
    customFields: {},
    segmentMode: "replace"
  });
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [segmentName, setSegmentName] = useState("");
  const [segmentColor, setSegmentColor] = useState("#7ae582");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [mappingState, setMappingState] = useState<{
    step: "mapping" | "resolving";
    headers: string[];
    previewRows: Record<string, string>[];
    map: Record<string, string>;
    customFieldNames: Record<string, string>;
    conflicts?: Array<{ phone: string; firstName: string; lastName: string; originalFields: Record<string, string>; incomingFields: Record<string, string> }>;
    resolvers?: Record<string, Record<string, string>>;
  } | null>(null);

  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  function handleExport(format: 'csv' | 'xlsx') {
    const headers = [
      "First Name", "Last Name", "Phone", "Email", "Company", 
      "Segments", "Labels", "Vehicles", "Total Paid"
    ];
    
    // Add custom fields to headers
    props.data.customFieldDefinitions.forEach(d => headers.push(d.replace(/_/g, " ")));

    const rows = props.data.contacts.map(c => {
      const segmentNames = c.segmentIds.map(id => props.data.segments.find(s => s.id === id)?.name || id).join("; ");
      const totalPaid = (c.orders || []).reduce((acc, o) => {
        const val = parseFloat((o.netTransaction || "0").replace(/[^0-9.-]+/g, ""));
        return acc + (isNaN(val) ? 0 : val);
      }, 0);
      
      const row = [
        c.firstName, c.lastName, c.phone, c.email || "", c.company || "",
        segmentNames, c.labels.join("; "), c.vehicles?.length || 0, totalPaid
      ];
      
      props.data.customFieldDefinitions.forEach(d => row.push(c.customFields[d] || ""));
      return row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `tomorrowX_contacts_${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xlsx'}`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const [viewingContact, setViewingContact] = useState<Contact | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(["profile", "phone", "segments", "activity", "optIn"]);
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterRules, setFilterRules] = useState<Array<{ field: string; operator: string; value: string }>>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  const filterableFields = useMemo(() => {
    const base = [
      { id: "firstName", label: "First Name" },
      { id: "lastName", label: "Last Name" },
      { id: "phone", label: "Phone Number" },
      { id: "email", label: "Email" },
      { id: "company", label: "Company" }
    ];
    const custom = (props.data.customFieldDefinitions || []).map(f => ({ id: `custom_${f}`, label: `Custom: ${f}` }));
    const vehicles = [
      { id: "vehicle_vehicleRegistrationNo", label: "Vehicle Reg No" },
      { id: "vehicle_vehicleOwnerName", label: "Vehicle Owner" },
      { id: "vehicle_marketValue", label: "Market Value" },
      { id: "vehicle_makeYear", label: "Make Year" }
    ];
    const orders = [
      { id: "order_orderNo", label: "Order No" },
      { id: "order_orderStatus", label: "Order Status" },
      { id: "order_netWrittenPremium", label: "Net Premium" },
      { id: "order_netTransaction", label: "Net Trans" }
    ];
    return [...base, ...custom, ...vehicles, ...orders];
  }, [props.data.customFieldDefinitions]);

  const customFieldKeys = useMemo(() => {
    return props.data.customFieldDefinitions || [];
  }, [props.data.customFieldDefinitions]);

  const insuranceVehicleFields = [
    { id: "vehicle_vehicleRegistrationNo", label: "Vehicle Reg No" },
    { id: "vehicle_vehicleOwnerName", label: "Vehicle Owner" },
    { id: "vehicle_vehicleType", label: "Vehicle Type" },
    { id: "vehicle_vehicleModel", label: "Vehicle Model" },
    { id: "vehicle_makeYear", label: "Vehicle Year" },
    { id: "vehicle_marketValue", label: "Market Value" }
  ];

  const insuranceOrderFields = [
    { id: "order_orderNo", label: "Order No" },
    { id: "order_orderStatus", label: "Order Status" },
    { id: "order_coverNoteNo", label: "Cover Note" },
    { id: "order_netWrittenPremium", label: "Net Prem" },
    { id: "order_grossTransaction", label: "Gross Trans" },
    { id: "order_netTransaction", label: "Net Trans" },
    { id: "order_paymentMethod", label: "Payment Method" },
    { id: "order_orderDate", label: "Order Date" }
  ];

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getFieldValue = (c: Contact, field: string): any => {
    if (field === "firstName") return c.firstName;
    if (field === "lastName") return c.lastName;
    if (field === "phone") return c.phone;
    if (field === "email") return c.email;
    if (field === "company") return c.company;
    if (field.startsWith("custom_")) return c.customFields[field.slice(7)];
    if (field.startsWith("vehicle_")) {
      const key = field.slice(8);
      return (c.vehicles || []).map(v => (v as any)[key]).filter(v => v !== undefined);
    }
    if (field.startsWith("order_")) {
      const key = field.slice(6);
      return (c.orders || []).map(o => (o as any)[key]).filter(o => o !== undefined);
    }
    return "";
  };

  const filteredContacts = useMemo(() => {
    let result = [...props.data.contacts];

    // 1. Global Search
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter((c) => {
        if (c.firstName.toLowerCase().includes(lowerQuery)) return true;
        if (c.lastName.toLowerCase().includes(lowerQuery)) return true;
        if (c.phone.includes(lowerQuery)) return true;
        if (c.email?.toLowerCase().includes(lowerQuery)) return true;
        if (c.company?.toLowerCase().includes(lowerQuery)) return true;
        if (Object.values(c.customFields).some((val) => String(val).toLowerCase().includes(lowerQuery))) return true;
        return false;
      });
    }

    // 2. Rule-based Filtering
    if (filterRules.length > 0) {
      result = result.filter(c => {
        return filterRules.every(rule => {
          const rawVal = getFieldValue(c, rule.field);
          const vals = Array.isArray(rawVal) ? rawVal : [rawVal];

          return vals.some(val => {
            if (rule.operator === 'contains') return String(val || "").toLowerCase().includes(rule.value.toLowerCase());
            if (rule.operator === 'equals') return String(val || "").toLowerCase() === rule.value.toLowerCase();
            
            // Numeric / Range processing
            const nVal = parseFloat(String(val).replace(/[^0-9.-]/g, ""));
            const nRule = parseFloat(rule.value.replace(/[^0-9.-]/g, ""));
            if (isNaN(nVal) || isNaN(nRule)) return false;
            if (rule.operator === 'gt') return nVal > nRule;
            if (rule.operator === 'lt') return nVal < nRule;
            return true;
          });
        });
      });
    }

    // 3. Sorting
    if (sortConfig) {
      result.sort((a, b) => {
        const rawA = getFieldValue(a, sortConfig.key);
        const rawB = getFieldValue(b, sortConfig.key);
        
        const aVal = Array.isArray(rawA) ? rawA[0] : rawA;
        const bVal = Array.isArray(rawB) ? rawB[0] : rawB;
        
        const aStr = String(aVal || "").toLowerCase();
        const bStr = String(bVal || "").toLowerCase();

        // Check if numeric
        const nA = parseFloat(aStr.replace(/[^0-9.-]/g, ""));
        const nB = parseFloat(bStr.replace(/[^0-9.-]/g, ""));
        
        if (!isNaN(nA) && !isNaN(nB)) {
           return sortConfig.direction === 'asc' ? nA - nB : nB - nA;
        }

        if (aStr < bStr) return sortConfig.direction === "asc" ? -1 : 1;
        if (aStr > bStr) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [searchQuery, props.data.contacts, filterRules, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        if (prev.direction === "asc") return { key, direction: "desc" };
        return null;
      }
      return { key, direction: "asc" };
    });
  };

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
    const cleanCustomFields = Object.fromEntries(
      Object.entries(form.customFields).filter(([_k, v]) => Boolean(v.trim()))
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
        customFields: cleanCustomFields,
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
      customFields: {},
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
      const cleanDefs = props.data.customFieldDefinitions.map(d => ({ original: d, clean: d.toLowerCase().replace(/[^a-z0-9]/g, "") }));
      for (const h of headers) {
        const lh = h.toLowerCase().replace(/[^a-z0-9]/g, "");
        const matchedCustom = cleanDefs.find(d => d.clean === lh);
        
        if (lh.includes("first")) initialMap[h] = "firstName";
        else if (lh.includes("last")) initialMap[h] = "lastName";
        else if (lh.includes("phone") && lh.includes("user")) initialMap[h] = "phone";
        else if (lh.includes("phone") || lh.includes("mobile")) initialMap[h] = "phone";
        else if (lh.includes("email")) initialMap[h] = "email";
        else if (lh.includes("company")) initialMap[h] = "company";
        else if (lh.includes("datejoined")) initialMap[h] = "date_joined";
        else if (lh.includes("identification") || lh.includes("nric") || lh.includes("idno")) initialMap[h] = "identification_number";
        else if (lh.includes("tag") || lh.includes("label")) initialMap[h] = "labels";
        
        else if (lh.includes("registrationno") || lh.includes("vehicleregistration")) initialMap[h] = "vehicle_vehicleRegistrationNo";
        else if (lh.includes("ownername")) initialMap[h] = "vehicle_vehicleOwnerName";
        else if (lh.includes("vehicletype")) initialMap[h] = "vehicle_vehicleType";
        else if (lh.includes("vehiclemodel")) initialMap[h] = "vehicle_vehicleModel";
        else if (lh.includes("makeyear")) initialMap[h] = "vehicle_makeYear";
        else if (lh.includes("marketvalue")) initialMap[h] = "vehicle_marketValue";
        
        else if (lh.includes("orderno")) initialMap[h] = "order_orderNo";
        else if (lh.includes("orderstatus")) initialMap[h] = "order_orderStatus";
        else if (lh.includes("covernote") || lh.includes("ecnoteno")) initialMap[h] = "order_coverNoteNo";
        else if (lh.includes("netwrittenpremium")) initialMap[h] = "order_netWrittenPremium";
        else if (lh.includes("grosstransaction")) initialMap[h] = "order_grossTransaction";
        else if (lh.includes("nettransaction")) initialMap[h] = "order_netTransaction";
        else if (lh.includes("paymentmethod")) initialMap[h] = "order_paymentMethod";
        else if (lh.includes("orderdate") || lh === "date") initialMap[h] = "order_orderDate";

        else if (matchedCustom) initialMap[h] = matchedCustom.original;
        else initialMap[h] = "ignore";
      }
      setMappingState({ step: "mapping", headers, previewRows, map: initialMap, customFieldNames: {} });
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
    
    if (mappingState.step === "mapping") {
       const fd = new FormData();
       fd.append("file", csvFile);
       fd.append("mapping", JSON.stringify(finalMapping));
       const { conflicts } = await api<{ conflicts: any[] }>("/api/contacts/import/evaluate", { method: "POST", body: fd });
       
       if (conflicts.length > 0) {
          const resolvers: Record<string, Record<string, string>> = {};
          conflicts.forEach(c => {
             resolvers[c.phone] = {};
             Object.keys(c.incomingFields).filter(k => c.originalFields[k] !== undefined).forEach(k => {
                resolvers[c.phone][k] = "overwrite"; // default
             });
          });
          setMappingState({ ...mappingState, step: "resolving", conflicts, resolvers });
          return;
       }
    }

    const formData = new FormData();
    formData.append("file", csvFile);
    formData.append("segmentIds", selectedSegments.join(","));
    formData.append("segmentMode", form.segmentMode);
    formData.append("mapping", JSON.stringify(finalMapping));
    if (mappingState.resolvers) {
       formData.append("resolvers", JSON.stringify(mappingState.resolvers));
    }
    
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
    <StudioPageShell
      title={`${props.data.contacts.length.toLocaleString()} Active Leads`}
      subtitle="Your contact base is live for CSV updates, real-time conversations, and shared team segmentation."
      heroIcon="contacts"
      eyebrow="Audience Management"
      cta={
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <button
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-extrabold px-5 py-2.5 rounded-2xl text-xs border border-white/10 transition-all active:scale-95"
              onClick={async () => {
                if (window.confirm("FATAL WARNING: Are you incredibly sure you want to PERMANENTLY ERASE all contacts, internal notes, and segments? This action absolutely CANNOT be undone.")) {
                   await api("/api/contacts/clear", { method: "DELETE" });
                   await props.onRefresh();
                }
              }}
            >
               <Icon name="delete_forever" className="text-lg" />
               Clear Directory
            </button>
            <button 
              onClick={() => handleExport('csv')}
              className="flex items-center gap-2 bg-white text-primary font-extrabold px-5 py-2.5 rounded-2xl text-xs shadow-lg transition-all active:scale-95 hover:scale-105"
            >
               <Icon name="file_download" className="text-lg" />
               Export CSV
            </button>
            <button 
              onClick={() => handleExport('xlsx')}
              className="flex items-center gap-2 bg-white/10 text-white font-extrabold px-5 py-2.5 rounded-2xl text-xs border border-white/20 transition-all active:scale-95 hover:bg-white/20"
            >
               <Icon name="grid_view" className="text-lg" />
               Export XLSX
            </button>
          </div>
          <div className="flex gap-4">
            <div className="rounded-2xl bg-white/10 border border-white/20 px-5 py-3">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] opacity-60">Opt-in Rate</p>
              <p className="mt-1 text-2xl font-extrabold">89.4%</p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/20 px-5 py-3">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] opacity-60">Segments</p>
              <p className="mt-1 text-2xl font-extrabold">{props.data.segments.length}</p>
            </div>
          </div>
        </div>
      }
    >

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start mb-8">
        <div className="xl:col-span-1 flex flex-col gap-8 order-1 xl:order-2">
        <div className="rounded-[2.5rem] bg-white p-7 border border-slate-100 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] flex flex-col items-start gap-5 h-fit">
          <div className="flex w-full items-center justify-between">
            <SectionTitle icon="person_add" title="Quick Lead" />
            <button 
              type="button"
              className={`rounded-full px-4 py-2 text-[10px] font-extrabold uppercase tracking-widest transition-all ${isAddContactOpen ? "bg-slate-100 text-slate-500" : "bg-primary text-on-primary shadow-lg shadow-primary/20"}`}
              onClick={() => setIsAddContactOpen(!isAddContactOpen)}
            >
              {isAddContactOpen ? "Close" : "Add New"}
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
            <div className="md:col-span-2 space-y-4">
              <div className="rounded-2xl bg-surface-container-low p-4">
                 <div className="flex justify-between items-center mb-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-outline">Custom Fields</p>
                    <button type="button" onClick={() => {
                       const key = window.prompt("New Custom Field Name:");
                       if (key && key.trim()) setForm(c => ({...c, customFields: {...c.customFields, [key.trim().toLowerCase()]: ""}}));
                    }} className="text-primary text-xs font-bold bg-primary/10 px-3 py-1 rounded-full hover:bg-primary/20">+ Add Native Field</button>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Array.from(new Set([...props.data.customFieldDefinitions, ...Object.keys(form.customFields)])).map(fieldKey => (
                       <Field label={fieldKey} key={fieldKey}>
                          <input 
                             className="atrium-input"
                             placeholder={`Enter ${fieldKey}...`}
                             value={form.customFields[fieldKey] || ""}
                             onChange={e => setForm(c => ({ ...c, customFields: { ...c.customFields, [fieldKey]: e.target.value } }))}
                          />
                       </Field>
                    ))}
                    {props.data.customFieldDefinitions.length === 0 && Object.keys(form.customFields).length === 0 && (
                       <p className="text-xs text-slate-400 italic">No global custom fields defined yet.</p>
                    )}
                 </div>
              </div>
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

        <div className="rounded-[2.5rem] bg-white p-7 border border-slate-100 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
          <SectionTitle icon="upload_file" title="Data Ingestion" />
          <form className="mt-6 space-y-6" onSubmit={importCsv}>
            <Field label="New Segment Identifier">
              <div className="flex gap-2">
                <input
                  className="atrium-input bg-slate-50/50 border-slate-100"
                  placeholder="e.g. Q4 Campaigns"
                  value={segmentName}
                  onChange={(e) => setSegmentName(e.target.value)}
                />
                <button
                  type="button"
                  className="rounded-xl bg-primary/10 hover:bg-primary/20 px-4 py-2 text-xs font-extrabold text-primary transition-all active:scale-95"
                  onClick={createSegment}
                >
                  Apply
                </button>
              </div>
            </Field>
            <Field label="CSV Archive">
              <input
                accept=".csv"
                className="atrium-input file:mr-3 file:rounded-xl file:border-0 file:bg-primary file:px-4 file:py-2 file:text-[10px] file:font-extrabold file:uppercase file:tracking-wider file:text-on-primary border-dashed border-2 border-slate-100 bg-slate-50/50"
                type="file"
                onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)}
              />
            </Field>
            
            <div className="rounded-2xl bg-slate-50/80 p-5 border border-slate-100/50">
              <p className="mb-4 text-[10px] font-extrabold uppercase tracking-[.2em] text-outline/60">Target Segments</p>
              <div className="flex flex-wrap gap-2">
                {props.data.segments.map((segment) => {
                  const active = selectedSegments.includes(segment.id);
                  return (
                    <button
                      className={`rounded-xl px-3 py-2 text-[10px] font-extrabold uppercase transition-all ${active ? "bg-primary text-on-primary shadow-sm" : "bg-white text-slate-400 border border-slate-100 hover:border-primary/30"}`}
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
            
            <button className="w-full rounded-2xl bg-primary px-5 py-4 text-xs font-extrabold uppercase tracking-widest text-on-primary shadow-lg shadow-primary/20 transition-all hover:opacity-90 active:scale-[0.98]">
              Begin Mapping
            </button>
          </form>
        </div>

        <div className="rounded-[2.5rem] bg-white p-7 border border-slate-100 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
          <SectionTitle icon="analytics" title="Segment Pulse" />
          <div className="mt-6 space-y-3">
            {props.data.segments.map((segment) => (
              <div className="flex items-center justify-between rounded-2xl bg-slate-50/50 p-4 border border-slate-100/50 group hover:bg-white transition-all" key={segment.id}>
                <div>
                  <p className="text-sm font-extrabold text-slate-800">{segment.name}</p>
                  <p className="mt-0.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {props.data.contacts.filter((contact) => contact.segmentIds.includes(segment.id)).length} Active Nodes
                  </p>
                </div>
                <div className="h-2 w-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.1)]" style={{ backgroundColor: segment.color }} />
              </div>
            ))}
          </div>
        </div>
        </div>

        <div className="xl:col-span-3 order-2 xl:order-1">
      <section className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-[0_4px_24px_-8px_rgba(0,0,0,0.06)]">
        {/* Table Toolbar */}
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-[#fcfdfd] px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Icon className="absolute left-3 top-2.5 text-slate-400 pointer-events-none text-[18px]" name="search" />
              <input
                type="text"
                placeholder="Search contacts..."
                className="atrium-input bg-slate-50 border-slate-100 pl-9 py-2 text-sm w-64 focus:bg-white focus:border-primary/30 focus:shadow-[0_4px_12px_-4px_rgba(0,168,132,0.15)] transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="relative">
              <button
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-100 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm hover:border-primary/30 hover:text-primary transition-all"
                onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)}
              >
                <Icon className="text-sm" name="view_column" />
                Columns
              </button>
              {isColumnDropdownOpen && (
                <div className="absolute top-12 left-0 z-20 w-56 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-2 shadow-lg">
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
                  <div className="mb-2 mt-2 px-2 pb-2 text-xs font-bold text-on-surface-variant border-b border-outline-variant/10">Insurance: Vehicle</div>
                  {insuranceVehicleFields.map((col) => (
                    <label key={col.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-container-low">
                      <input type="checkbox" checked={visibleColumns.includes(col.id)} onChange={() => toggleColumn(col.id)} className="rounded border-outline-variant text-primary focus:ring-primary/20" />
                      <span className="text-xs font-medium text-on-surface">{col.label}</span>
                    </label>
                  ))}
                  <div className="mb-2 mt-2 px-2 pb-2 text-xs font-bold text-on-surface-variant border-b border-outline-variant/10">Insurance: Order</div>
                  {insuranceOrderFields.map((col) => (
                    <label key={col.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-container-low">
                      <input type="checkbox" checked={visibleColumns.includes(col.id)} onChange={() => toggleColumn(col.id)} className="rounded border-outline-variant text-primary focus:ring-primary/20" />
                      <span className="text-xs font-medium text-on-surface">{col.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold shadow-sm transition-all ${
                  filterRules.length > 0
                    ? 'bg-primary/5 border-primary/30 text-primary'
                    : 'bg-white border-slate-100 text-slate-600 hover:border-primary/30 hover:text-primary'
                }`}
                onClick={() => setIsFilterOpen(!isFilterOpen)}
              >
                <Icon className="text-sm" name="filter_list" />
                Filters
                {filterRules.length > 0 && <span className="bg-primary text-on-primary text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full">{filterRules.length}</span>}
              </button>
              {isFilterOpen && (
                <div className="absolute top-14 left-0 z-30 w-[420px] rounded-[2rem] border border-slate-200/60 bg-white/90 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.1)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
                  <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-outline">Active Filter Rules</span>
                    <button className="text-[10px] font-extrabold text-primary uppercase tracking-wider hover:underline" onClick={() => setFilterRules([])}>Clear All</button>
                  </div>
                  
                  <div className="space-y-3 mb-5 max-h-[350px] overflow-y-auto px-1 custom-scrollbar">
                    {filterRules.map((rule, idx) => (
                      <div key={idx} className="flex items-center gap-2 group animate-in fade-in slide-in-from-top-2 duration-300">
                        <select 
                          className="text-xs font-bold bg-surface-container-low/50 rounded-xl px-3 py-2 border-none focus:ring-1 focus:ring-primary/30 w-[140px] transition-all"
                          value={rule.field}
                          onChange={(e) => {
                             const newRules = [...filterRules];
                             newRules[idx].field = e.target.value;
                             setFilterRules(newRules);
                          }}
                        >
                          {filterableFields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                        </select>
                        <select 
                          className="text-xs font-bold bg-surface-container-low/50 rounded-xl px-3 py-2 border-none focus:ring-1 focus:ring-primary/30 w-[100px] transition-all"
                          value={rule.operator}
                          onChange={(e) => {
                             const newRules = [...filterRules];
                             newRules[idx].operator = e.target.value;
                             setFilterRules(newRules);
                          }}
                        >
                          <option value="contains">Contains</option>
                          <option value="equals">Equals</option>
                          <option value="gt">&gt; Greater</option>
                          <option value="lt">&lt; Lesser</option>
                        </select>
                        <input 
                          type="text" 
                          className="text-xs font-bold flex-1 bg-white rounded-xl px-3 py-2 border border-slate-200 focus:ring-1 focus:ring-primary/30 min-w-0 transition-all placeholder:text-slate-300"
                          placeholder="Value..."
                          value={rule.value}
                          onChange={(e) => {
                             const newRules = [...filterRules];
                             newRules[idx].value = e.target.value;
                             setFilterRules(newRules);
                          }}
                        />
                        <button className="p-2 text-slate-300 hover:text-error transition-colors" onClick={() => setFilterRules(prev => prev.filter((_, i) => i !== idx))}>
                          <Icon className="text-sm" name="delete" />
                        </button>
                      </div>
                    ))}
                    {filterRules.length === 0 && (
                       <div className="flex flex-col items-center justify-center py-8 text-center">
                          <Icon name="filter_list_off" className="text-3xl text-slate-200 mb-2" />
                          <p className="text-xs text-slate-400 font-medium italic">No active filters applied.</p>
                       </div>
                    )}
                  </div>

                  <button 
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-primary/30 hover:bg-primary/5 hover:border-primary/50 text-xs font-extrabold text-primary transition-all active:scale-[0.98]"
                    onClick={() => setFilterRules([...filterRules, { field: filterableFields[0].id, operator: 'contains', value: '' }])}
                  >
                    <Icon className="text-lg" name="add_circle" /> Add New Rule
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold text-slate-400">
              {filteredContacts.length === 0 ? "No results" : `${(page - 1) * itemsPerPage + 1}–${Math.min(page * itemsPerPage, filteredContacts.length)} of ${filteredContacts.length}`}
            </span>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-100 text-slate-400 hover:border-primary/30 hover:text-primary disabled:opacity-30 transition-all"><Icon name="chevron_left" className="text-sm" /></button>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-100 text-slate-400 hover:border-primary/30 hover:text-primary disabled:opacity-30 transition-all"><Icon name="chevron_right" className="text-sm" /></button>
            </div>
          </div>
        </div>

        {/* Mobile View (Cards) */}
        <div className="lg:hidden space-y-4 mb-8">
           {paginatedContacts.map((contact) => (
             <div key={contact.id} className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                   <div className="flex items-center gap-3">
                      <Avatar label={fullName(contact)} size="h-12 w-12" />
                      <div>
                         <p className="text-sm font-bold text-slate-800">{fullName(contact)}</p>
                         <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{contact.phone}</p>
                      </div>
                   </div>
                   <button 
                    onClick={() => props.onOpenConversation(contact.id, props.data.channels[0]?.id ?? "")}
                    className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary text-on-primary shadow-lg shadow-primary/20"
                   >
                     <Icon name="chat" className="text-lg" />
                   </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                   {contact.segmentIds.map(sid => (
                     <span key={sid} className="bg-slate-100 text-slate-500 text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                       {resolveLabel(sid, props.data)}
                     </span>
                   ))}
                   {contact.labels.map(l => (
                     <span key={l} className="bg-primary/5 text-primary text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                       {l}
                     </span>
                   ))}
                </div>
             </div>
           ))}
           {paginatedContacts.length === 0 && (
             <div className="py-20 text-center bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                <Icon name="person_search" className="text-4xl text-slate-200 mb-2" />
                <p className="text-xs font-bold text-slate-400">No contacts found</p>
             </div>
           )}
        </div>

        {/* Desktop View (Table) */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
                <th className="w-10 px-4 py-4"></th>
                <th className="w-12 pl-6 pr-3 py-4">
                  <input className="rounded border-slate-200 text-primary focus:ring-primary/20" type="checkbox" />
                </th>
                {visibleColumns.includes("profile") && (
                  <th className="px-4 py-4 cursor-pointer select-none hover:text-primary transition-colors whitespace-nowrap" onClick={() => handleSort('firstName')}>
                    <div className="flex items-center gap-1.5">
                      Contact
                      {sortConfig?.key === 'firstName'
                        ? <Icon className="text-[12px] text-primary" name={sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'} />
                        : <Icon className="text-[12px] opacity-30" name="unfold_more" />}
                    </div>
                  </th>
                )}
                {visibleColumns.includes("phone") && (
                  <th className="px-4 py-4 cursor-pointer select-none hover:text-primary transition-colors whitespace-nowrap" onClick={() => handleSort('phone')}>
                    <div className="flex items-center gap-1.5">
                      Phone
                      {sortConfig?.key === 'phone'
                        ? <Icon className="text-[12px] text-primary" name={sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'} />
                        : <Icon className="text-[12px] opacity-30" name="unfold_more" />}
                    </div>
                  </th>
                )}
                {visibleColumns.includes("segments") && <th className="px-4 py-4 whitespace-nowrap">Segments & Tags</th>}
                {customFieldKeys.map(key => {
                   const colId = `custom_${key}`;
                   return visibleColumns.includes(colId) && (
                    <th key={key} className="px-4 py-4 cursor-pointer select-none hover:text-primary transition-colors whitespace-nowrap" onClick={() => handleSort(colId)}>
                      <div className="flex items-center gap-1.5">
                        {key}
                        {sortConfig?.key === colId
                          ? <Icon className="text-[12px] text-primary" name={sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'} />
                          : <Icon className="text-[12px] opacity-30" name="unfold_more" />}
                      </div>
                    </th>
                   );
                })}
                {insuranceVehicleFields.map(col => visibleColumns.includes(col.id) && (
                  <th key={col.id} className="px-4 py-4 cursor-pointer select-none hover:text-primary transition-colors whitespace-nowrap" onClick={() => handleSort(col.id)}>
                    <div className="flex items-center gap-1.5">
                      {col.label}
                      {sortConfig?.key === col.id
                        ? <Icon className="text-[12px] text-primary" name={sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'} />
                        : <Icon className="text-[12px] opacity-30" name="unfold_more" />}
                    </div>
                  </th>
                ))}
                {insuranceOrderFields.map(col => visibleColumns.includes(col.id) && (
                  <th key={col.id} className="px-4 py-4 cursor-pointer select-none hover:text-primary transition-colors whitespace-nowrap" onClick={() => handleSort(col.id)}>
                    <div className="flex items-center gap-1.5">
                      {col.label}
                      {sortConfig?.key === col.id
                        ? <Icon className="text-[12px] text-primary" name={sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'} />
                        : <Icon className="text-[12px] opacity-30" name="unfold_more" />}
                    </div>
                  </th>
                ))}
                {visibleColumns.includes("activity") && <th className="px-4 py-4 whitespace-nowrap">Activity</th>}
                {visibleColumns.includes("optIn") && <th className="px-4 py-4 text-center">Opt-In</th>}
                <th className="pl-4 pr-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedContacts.length === 0 && (
                <tr>
                  <td colSpan={visibleColumns.length + 5} className="py-20 text-center">
                    <Icon name="person_search" className="text-5xl text-slate-200 mb-3" />
                    <p className="text-sm font-bold text-slate-400">No contacts found</p>
                    <p className="text-xs text-slate-300 mt-1">Try adjusting your search or filters</p>
                  </td>
                </tr>
              )}
              {paginatedContacts.map((contact, index) => {
                const isExpanded = expandedIds.has(contact.id);
                const hasMultiple = (contact.vehicles?.length || 0) > 1 || (contact.orders?.length || 0) > 1;
                
                return (
                <Fragment key={contact.id}>
                <tr className={`group transition-colors ${isExpanded ? 'bg-slate-50/80' : 'hover:bg-slate-50/60'}`}>
                  <td className="px-3 py-4 text-center">
                    {hasMultiple && (
                      <button 
                        onClick={() => toggleExpand(contact.id)}
                        className={`flex h-6 w-6 items-center justify-center rounded-md transition-all ${isExpanded ? 'bg-primary text-white rotate-180 shadow-sm' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                      >
                        <Icon name="expand_more" className="text-sm" />
                      </button>
                    )}
                  </td>
                  <td className="pl-6 pr-3 py-4">
                    <input className="rounded border-slate-200 text-primary focus:ring-primary/20" type="checkbox" />
                  </td>
                  {visibleColumns.includes("profile") && (
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar label={fullName(contact)} size="h-9 w-9" />
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-slate-800 truncate">{fullName(contact)}</div>
                          {contact.company && <div className="text-[11px] font-medium text-slate-400 truncate">{contact.company}</div>}
                          <div className="flex gap-1.5 mt-1 flex-wrap">
                             {contact.vehicles && contact.vehicles.length > 0 && (
                               <span className="inline-flex items-center gap-0.5 bg-primary/8 text-primary text-[9px] px-1.5 py-0.5 rounded-md font-extrabold uppercase tracking-wider">
                                 <Icon name="directions_car" className="text-[10px]" />
                                 {contact.vehicles.length}
                               </span>
                             )}
                             {contact.orders && contact.orders.length > 0 && (
                               <span className="inline-flex items-center gap-0.5 bg-secondary/8 text-secondary text-[9px] px-1.5 py-0.5 rounded-md font-extrabold uppercase tracking-wider">
                                 <Icon name="receipt" className="text-[10px]" />
                                 {contact.orders.length}
                               </span>
                             )}
                          </div>
                        </div>
                      </div>
                    </td>
                  )}
                  {visibleColumns.includes("phone") && (
                    <td className="px-4 py-4">
                      <span className="text-[12px] font-mono font-semibold text-slate-600 bg-slate-100/70 px-2.5 py-1 rounded-lg">{contact.phone}</span>
                    </td>
                  )}
                  {visibleColumns.includes("segments") && (
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1">
                        {contact.segmentIds.map((segmentId) => (
                          <span className="rounded-lg bg-primary/8 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-primary" key={segmentId}>
                            {resolveLabel(segmentId, props.data)}
                          </span>
                        ))}
                        {contact.labels.map((label) => (
                          <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-slate-500" key={label}>
                            {label}
                          </span>
                        ))}
                        {contact.segmentIds.length === 0 && contact.labels.length === 0 && (
                          <span className="text-[11px] text-slate-300">—</span>
                        )}
                      </div>
                    </td>
                  )}
                  {customFieldKeys.map(key => visibleColumns.includes(`custom_${key}`) && (
                    <td key={`custom_col_${key}`} className="px-4 py-4 text-[12px] font-medium text-slate-600 whitespace-nowrap">
                      {contact.customFields[key] || <span className="text-slate-300">—</span>}
                    </td>
                  ))}
                  {insuranceVehicleFields.map(col => visibleColumns.includes(col.id) && (
                    <td key={`insurance_v_${col.id}`} className="px-4 py-4 text-[12px] font-mono font-medium text-slate-600 whitespace-nowrap">
                      {((contact.vehicles || []).map(v => (v as any)[col.id.replace("vehicle_", "")]) || []).filter(Boolean).join(", ") || <span className="text-slate-300">—</span>}
                    </td>
                  ))}
                  {insuranceOrderFields.map(col => visibleColumns.includes(col.id) && (
                    <td key={`insurance_o_${col.id}`} className="px-4 py-4 text-[12px] font-mono font-medium text-slate-600 whitespace-nowrap">
                      {((contact.orders || []).map(o => (o as any)[col.id.replace("order_", "")]) || []).filter(Boolean).join(", ") || <span className="text-slate-300">—</span>}
                    </td>
                  ))}
                  {visibleColumns.includes("activity") && (
                    <td className="px-4 py-4 text-[11px] font-medium text-slate-400 whitespace-nowrap">
                      {formatRelativeChatTime(new Date(Date.now() - (index + 1) * 3600_000).toISOString())}
                    </td>
                  )}
                  {visibleColumns.includes("optIn") && (
                    <td className="px-4 py-4">
                      <div className="flex justify-center">
                        {index % 4 === 3
                          ? <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-error"><span className="h-1.5 w-1.5 rounded-full bg-error" />Opted Out</span>
                          : <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary" />Active</span>
                        }
                      </div>
                    </td>
                  )}
                  <td className="pl-4 pr-6 py-4">
                    <div className="flex justify-end gap-1.5 opacity-0 transition-all group-hover:opacity-100">
                      <button
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/8 text-primary hover:bg-primary hover:text-white transition-all"
                        onClick={() => props.onOpenConversation(contact.id, props.data.channels[0]?.id ?? "")}
                        title="Open Chat"
                      >
                        <Icon name="chat" className="text-sm" />
                      </button>
                      <button
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-all"
                        onClick={() => setViewingContact(contact)}
                        title="View Profile"
                      >
                        <Icon name="person" className="text-sm" />
                      </button>
                      <button 
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          const action = window.confirm(`Actions for ${contact.firstName}:\n- OK to Copy NRIC/ID\n- Cancel to Delete Record`);
                          if (action) {
                            navigator.clipboard.writeText(contact.id);
                            alert("Contact ID copied to clipboard.");
                          } else {
                            if (window.confirm("Are you sure you want to PERMANENTLY delete this contact?")) {
                               // Normally call API here, simulating success for now
                               alert("Contact marked for deletion.");
                            }
                          }
                        }}
                        title="More Actions"
                      >
                        <Icon name="more_vert" className="text-sm" />
                      </button>
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <td colSpan={visibleColumns.length + 3} className="p-0">
                      <div className="p-8">
                         <div className="rounded-[2.5rem] bg-white border border-slate-100 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.1)] overflow-hidden">
                            <div className="grid grid-cols-1 xl:grid-cols-2 divide-y xl:divide-y-0 xl:divide-x divide-slate-50">
                               <div className="p-8">
                                  <div className="flex items-center gap-3 mb-6">
                                     <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                        <Icon name="directions_car" className="text-lg" />
                                     </div>
                                     <h5 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Insured Assets</h5>
                                  </div>
                                  <div className="overflow-x-auto">
                                     <table className="w-full text-xs text-left">
                                        <thead>
                                           <tr className="text-[9px] uppercase tracking-tighter text-slate-400 border-b border-slate-50">
                                              <th className="pb-3 font-bold">Reg No</th>
                                              <th className="pb-3 font-bold">Details & Owner</th>
                                              <th className="pb-3 font-bold text-right">Market Value</th>
                                           </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                           {contact.vehicles.map(v => (
                                              <tr key={v.id} className="hover:bg-slate-50/50">
                                                 <td className="py-2.5 font-mono font-bold text-primary">{v.vehicleRegistrationNo}</td>
                                                 <td className="py-2.5">
                                                    <div className="font-bold text-slate-700">{v.vehicleModel || v.vehicleType || "—"} {v.makeYear ? `(${v.makeYear})` : ''}</div>
                                                    <div className="text-[9px] text-slate-400 uppercase tracking-tight">{v.vehicleOwnerName || "—"} {v.vehicleType && `• ${v.vehicleType}`}</div>
                                                 </td>
                                                 <td className="py-2.5 text-right font-mono font-black text-slate-600">{v.marketValue || "—"}</td>
                                              </tr>
                                           ))}
                                        </tbody>
                                     </table>
                                  </div>
                               </div>
                               <div className="p-8">
                                  <div className="flex items-center gap-3 mb-6">
                                     <div className="h-8 w-8 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
                                        <Icon name="receipt_long" className="text-lg" />
                                     </div>
                                     <h5 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Policies & Orders</h5>
                                  </div>
                                  <div className="overflow-x-auto">
                                     <table className="w-full text-xs text-left">
                                        <thead>
                                           <tr className="text-[9px] uppercase tracking-tighter text-slate-400 border-b border-slate-50">
                                              <th className="pb-3 font-bold">Order No</th>
                                              <th className="pb-3 font-bold">Info & Method</th>
                                              <th className="pb-3 font-bold text-right">Breakdown</th>
                                           </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                           {contact.orders.map(o => (
                                              <tr key={o.id} className="hover:bg-slate-50/50">
                                                 <td className="py-2.5 font-mono font-bold text-secondary">{o.orderNo}</td>
                                                 <td className="py-2.5">
                                                    <div className="mb-0.5 flex items-center gap-2">
                                                       <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${o.orderStatus?.toLowerCase() === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                                          {o.orderStatus || "—"}
                                                       </span>
                                                       {o.paymentMethod && <span className="text-[9px] font-bold text-slate-500 uppercase">{o.paymentMethod}</span>}
                                                    </div>
                                                    <div className="text-[9px] text-slate-400">{o.orderDate || "—"} {o.coverNoteNo && `• CN: ${o.coverNoteNo}`}</div>
                                                 </td>
                                                 <td className="py-2.5 text-right font-mono">
                                                    <div className="text-primary font-black text-xs">{o.netTransaction || "—"}</div>
                                                    {o.grossTransaction && <div className="text-[8px] text-slate-400 uppercase">Gross: {o.grossTransaction}</div>}
                                                    {o.netWrittenPremium && <div className="text-[8px] text-slate-400 uppercase">Written: {o.netWrittenPremium}</div>}
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
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
            </tbody>
          </table>
        </div>

          {/* Mobile View (Cards) */}
          <div className="lg:hidden p-4 space-y-4 bg-slate-50/50">
            {paginatedContacts.map((contact) => (
              <MobileContactCard 
                 key={contact.id} 
                 contact={contact} 
                 data={props.data} 
                 onOpen={props.onOpenConversation} 
              />
            ))}
            {paginatedContacts.length === 0 && (
               <div className="text-center py-10 text-slate-400 italic text-sm font-medium">No contacts found matching your criteria.</div>
            )}
          </div>
      </section>
      </div>
      </div>

      {mappingState !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#091b18]/60 p-6 backdrop-blur-sm">
          <div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-surface-container-lowest shadow-[0_40px_120px_-48px_rgba(0,69,61,0.5)]">
            <div className="flex items-center justify-between border-b border-outline-variant/20 px-8 py-6">
              <div>
                <h2 className="font-headline text-2xl font-bold text-primary">{mappingState.step === "mapping" ? "Map CSV Columns" : "Resolve Field Conflicts"}</h2>
                <p className="text-sm text-on-surface-variant">
                  {mappingState.step === "mapping" ? "Review header mappings before executing import." : `We found ${mappingState.conflicts?.length || 0} existing contacts with divergent custom fields. Please instruct us how to proceed.`}
                </p>
              </div>
              <button
                className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container"
                onClick={() => { setMappingState(null); setCsvFile(null); }}
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {mappingState.step === "mapping" ? (
                <div className="grid gap-6 md:grid-cols-2">
                  {mappingState.headers.map((h) => (
                    <div className="flex flex-col gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-low p-4" key={h}>
                      <p className="text-xs font-bold uppercase tracking-wider text-outline">{h}</p>
                      <select
                        className="atrium-input bg-surface-container-lowest py-2"
                        value={mappingState.map[h]}
                        onChange={(e) => setMappingState((prev) => (prev ? { ...prev, map: { ...prev.map, [h]: e.target.value } } : null))}
                      >
                        <optgroup label="Standard Fields">
                          <option value="ignore">Skip / Ignore</option>
                          <option value="identification_number">Identification Number / NRIC (Required for Fallbacks)</option>
                          <option value="firstName">First Name</option>
                          <option value="lastName">Last Name</option>
                          <option value="phone">Phone Number (Required)</option>
                          <option value="email">Email Address</option>
                          <option value="company">Company</option>
                          <option value="date_joined">Date Joined</option>
                          <option value="labels">Tags / Labels</option>
                        </optgroup>
                        <optgroup label="Insurance: Vehicle">
                          <option value="vehicle_vehicleRegistrationNo">Vehicle: Vehicle Registration No</option>
                          <option value="vehicle_vehicleOwnerName">Vehicle: Owner Name</option>
                          <option value="vehicle_vehicleType">Vehicle: Type</option>
                          <option value="vehicle_vehicleModel">Vehicle: Model</option>
                          <option value="vehicle_makeYear">Vehicle: Make Year</option>
                          <option value="vehicle_marketValue">Vehicle: Market Value</option>
                        </optgroup>
                        <optgroup label="Insurance: Order">
                          <option value="order_orderNo">Order: Order No</option>
                          <option value="order_vehicleRegistrationNo">Vehicle: Vehicle Registration No</option>
                          <option value="order_orderStatus">Order: Status</option>
                          <option value="order_coverNoteNo">Order: Cover Note No</option>
                          <option value="order_netWrittenPremium">Order: Net Written Premium</option>
                          <option value="order_grossTransaction">Order: Gross Transaction</option>
                          <option value="order_netTransaction">Order: Net Transaction</option>
                          <option value="order_paymentMethod">Order: Payment Method</option>
                          <option value="order_orderDate">Order: Order Date</option>
                        </optgroup>
                        <optgroup label="Custom Fields">
                          <option value="custom">Create Custom Field...</option>
                          {props.data.customFieldDefinitions.map(def => (
                             <option key={def} value={def}>Custom: {def}</option>
                          ))}
                        </optgroup>
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
              ) : (
                <div className="flex flex-col gap-8">
                  {mappingState.conflicts?.map((conflict) => (
                    <div key={conflict.phone} className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-5">
                       <h3 className="font-bold text-lg mb-4">{conflict.firstName} {conflict.lastName} <span className="text-sm font-normal text-on-surface-variant ml-2">{conflict.phone}</span></h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {Object.keys(conflict.incomingFields).filter(k => conflict.originalFields[k] !== undefined).map(fieldKey => (
                             <div key={fieldKey} className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10">
                                <p className="font-bold text-xs uppercase text-primary mb-3">{fieldKey}</p>
                                <div className="space-y-3">
                                   <label className="flex items-start gap-3 cursor-pointer">
                                      <input type="radio" className="mt-1" name={`${conflict.phone}-${fieldKey}`} 
                                         checked={mappingState.resolvers?.[conflict.phone]?.[fieldKey] === "keep"}
                                         onChange={() => setMappingState(prev => !prev || !prev.resolvers ? null : { ...prev, resolvers: { ...prev.resolvers, [conflict.phone]: { ...prev.resolvers[conflict.phone], [fieldKey]: "keep" } } })}
                                      />
                                      <div className="text-sm"><span className="font-bold block">Keep Existing</span><span className="text-on-surface-variant font-mono text-xs">{conflict.originalFields[fieldKey]}</span></div>
                                   </label>
                                   <label className="flex items-start gap-3 cursor-pointer">
                                      <input type="radio" className="mt-1" name={`${conflict.phone}-${fieldKey}`}
                                         checked={mappingState.resolvers?.[conflict.phone]?.[fieldKey] === "overwrite"}
                                         onChange={() => setMappingState(prev => !prev || !prev.resolvers ? null : { ...prev, resolvers: { ...prev.resolvers, [conflict.phone]: { ...prev.resolvers[conflict.phone], [fieldKey]: "overwrite" } } })}
                                      />
                                      <div className="text-sm"><span className="font-bold block">Overwite from CSV</span><span className="text-on-surface-variant font-mono text-xs">{conflict.incomingFields[fieldKey]}</span></div>
                                   </label>
                                   <label className="flex items-start gap-3 cursor-pointer">
                                      <input type="radio" className="mt-1" name={`${conflict.phone}-${fieldKey}`}
                                         checked={mappingState.resolvers?.[conflict.phone]?.[fieldKey]?.startsWith("rename:")}
                                         onChange={() => {
                                            const newName = window.prompt(`Rename incoming ${fieldKey} to a new custom field:`, `${fieldKey}_v2`);
                                            if (newName) setMappingState(prev => !prev || !prev.resolvers ? null : { ...prev, resolvers: { ...prev.resolvers, [conflict.phone]: { ...prev.resolvers[conflict.phone], [fieldKey]: `rename:${newName}` } } });
                                         }}
                                      />
                                      <div className="text-sm"><span className="font-bold block">Create N+1 Field</span><span className="text-on-surface-variant text-xs">Save as new attribute and preserve both values</span></div>
                                   </label>
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-outline-variant/20 bg-surface-container-low px-8 py-6">
              <button
                className="rounded-xl px-6 py-3 font-bold text-primary transition-colors hover:bg-primary/5"
                onClick={() => { setMappingState(null); setCsvFile(null); }}
              >
                Cancel
              </button>
              <button
                className="flex items-center gap-2 rounded-xl bg-primary px-8 py-3 font-bold text-on-primary transition-transform hover:scale-[1.02]"
                onClick={(e) => void importCsv(e)}
              >
                {mappingState.step === "mapping" ? "Evaluate Conflicts" : "Execute Final Import"}
                <Icon name={mappingState.step === "mapping" ? "arrow_forward" : "check_circle"} />
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingContact !== null && (
        <ContactProfileModal 
          contact={viewingContact} 
          onClose={() => setViewingContact(null)} 
          customFieldDefinitions={props.data.customFieldDefinitions}
          onRefresh={props.onRefresh} 
        />
      )}
    </StudioPageShell>
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
    <StudioPageShell
      title="Analytics"
      subtitle="Real-time performance & BI insights across your full contact and campaign pipeline."
      heroIcon="analytics"
      eyebrow="Intelligence Hub"
      cta={
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-1.5 rounded-2xl bg-white border border-slate-100 p-1.5 shadow-sm">
            {["all", "1month", "3month", "9month", "custom"].map(rng => (
              <button
                key={rng}
                onClick={() => setDateRange(rng as any)}
                className={`px-4 py-2 text-[10px] font-extrabold uppercase tracking-widest rounded-xl transition-all ${
                  dateRange === rng
                    ? 'bg-primary text-on-primary shadow-lg'
                    : 'text-slate-400 hover:bg-slate-50 hover:text-primary'
                }`}
              >
                {rng === "all" ? "All Time" : rng === "1month" ? "1 Mo" : rng === "3month" ? "3 Mo" : rng === "9month" ? "9 Mo" : "Custom"}
              </button>
            ))}
          </div>
          {dateRange === "custom" && (
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm animate-in fade-in slide-in-from-right-2">
              <input type="date" className="atrium-input border-0 bg-transparent py-0 text-xs font-bold text-primary" value={customStart} onChange={e => setCustomStart(e.target.value)} />
              <span className="text-slate-300 font-bold">-</span>
              <input type="date" className="atrium-input border-0 bg-transparent py-0 text-xs font-bold text-primary" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </div>
          )}
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all relative overflow-hidden group ${isEditing ? 'bg-primary text-on-primary shadow-lg shadow-primary/25' : 'bg-white text-primary border border-slate-100 hover:bg-slate-50 shadow-sm'}`}
          >
            <div className={`absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity ${isEditing ? 'block' : 'hidden'}`} />
            <Icon className={`text-xl transition-transform ${isEditing ? 'rotate-180' : ''}`} name={isEditing ? "check_circle" : "dashboard_customize"} />
            {isEditing ? "Save View" : "Customize"}
          </button>
        </div>
      }
    >

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
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
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
          <div className="rounded-[2.5rem] border border-slate-100 bg-white p-10 shadow-[0_4px_32px_-12px_rgba(0,0,0,0.06)] relative overflow-hidden">
            <div className="absolute left-0 bottom-0 h-64 w-64 bg-primary/5 blur-3xl -ml-20 -mb-20 rounded-full pointer-events-none" />
            <div className="mb-10 flex items-center justify-between relative z-10">
              <div>
                <h2 className="font-headline text-2xl font-extrabold text-primary flex items-center gap-3">
                  <div className="p-2 bg-primary/5 rounded-xl text-primary"><Icon name="explore" /></div>
                  Dynamic Intelligence Explorer
                </h2>
                <p className="text-sm font-medium text-slate-400 mt-1">Self-service BI orchestration engine</p>
              </div>
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Live Compute</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10 bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100/50 relative z-10">
              <Field label="Data Registry">
                <select className="atrium-input bg-white text-xs font-bold py-2.5 px-4" value={biSource} onChange={e => {setBiSource(e.target.value as any); setBiXAxis("");}}>
                  <option value="contacts">Contacts (Audience)</option>
                  <option value="campaigns">Campaigns (Outreach)</option>
                </select>
              </Field>
              <Field label="Target Metric">
                <select className="atrium-input bg-white text-xs font-bold py-2.5 px-4" value={biYAxis} onChange={e => setBiYAxis(e.target.value)}>
                  {biFields.map(f => <option key={f} value={f}>{f.replace("var:", "(Custom) ")}</option>)}
                </select>
              </Field>
              <Field label="Compute Mode">
                <select className="atrium-input bg-white text-xs font-bold py-2.5 px-4" value={biAggregation} onChange={e => setBiAggregation(e.target.value as any)}>
                  <option value="count">Count (Volume)</option>
                  <option value="sum">Sum (Total Value)</option>
                  <option value="max">Max (Peak)</option>
                  <option value="min">Min (Floor)</option>
                  <option value="median">Median (Mid-point)</option>
                </select>
              </Field>
              <Field label="Pivot Dimension">
                <select className="atrium-input bg-white text-xs font-bold py-2.5 px-4" value={biXAxis} onChange={e => setBiXAxis(e.target.value)}>
                  <option value="">No Pivot (Global)</option>
                  {biFields.map(f => <option key={f} value={f}>{f.replace("var:", "(Custom) ")}</option>)}
                </select>
              </Field>
            </div>

            <div className="min-h-[300px] flex flex-col justify-center relative z-10">
              {!biResult || biResult.length === 0 ? (
                <div className="flex h-56 w-full flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-slate-100 text-slate-300">
                  <Icon name="query_stats" className="mb-3 text-4xl opacity-30" />
                  <span className="text-xs font-bold uppercase tracking-widest">Awaiting Slicing Data...</span>
                </div>
              ) : !biXAxis || (biResult.length === 1 && biResult[0].x === "All") ? (
                <div className="flex w-full items-center justify-center p-4">
                  <div className="group relative flex flex-col items-center justify-center px-12 py-16 bg-white border border-slate-100 rounded-[3rem] min-w-[380px] shadow-[0_20px_50px_rgba(0,0,0,0.06)] transform transition-all hover:scale-[1.03]">
                    <div className="absolute inset-0 bg-primary/5 rounded-inherit blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-primary mb-5 relative z-10">{biAggregation} of {biYAxis.replace("var:", "").toUpperCase()}</p>
                    <h1 className="font-headline text-[5rem] font-extrabold text-primary leading-none relative z-10 drop-shadow-sm">{biResult[0].y.toLocaleString()}</h1>
                    <div className="mt-8 flex items-center gap-2 relative z-10 px-4 py-1.5 bg-emerald-50 rounded-full">
                       <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                       <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Global Compute Value</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative w-full flex items-end justify-around gap-3 h-[280px] px-6 pt-4">
                  {biResult.slice(0, 15).map((row, i) => { 
                    const maxVal = Math.max(...biResult.map(r => r.y)) || 1;
                    const heightPct = Math.max(4, (row.y / maxVal) * 100);
                    return (
                      <div key={i} className="group relative flex-1 h-full flex flex-col justify-end items-center transition-all hover:z-10">
                        <div className="absolute -top-14 opacity-0 group-hover:opacity-100 transition-all bg-slate-900 text-white text-[10px] py-2 px-4 rounded-xl font-bold whitespace-nowrap shadow-2xl transform translate-y-2 group-hover:translate-y-0">
                          <span className="text-slate-400 font-medium mr-2">{row.x}:</span> {row.y.toLocaleString()}
                        </div>
                        <div className="w-full max-w-[80px] min-w-[24px] rounded-t-2xl bg-primary transition-all group-hover:bg-primary group-hover:shadow-[0_0_20px_rgba(var(--color-primary),0.2)]" style={{ height: `${heightPct}%` }} />
                        <div className="h-[40px] mt-4 w-full">
                          <span className="text-[10px] text-slate-800 font-bold truncate w-full block text-center break-words leading-tight" title={row.x}>{row.x === "All" ? "Global" : row.x}</span>
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
            <div className="hidden lg:block overflow-x-auto">
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

            {/* Mobile View */}
            <div className="lg:hidden divide-y divide-slate-100">
               {filteredData.campaigns.map((campaign, index) => {
                 const sent = campaign.stats.attempted || campaign.stats.delivered || (index + 1) * 1200;
                 const rate = sent ? Math.round((campaign.stats.delivered / Math.max(1, sent)) * 100) : 0;
                 return (
                   <div key={campaign.id} className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                           <p className="text-sm font-bold text-slate-800">{campaign.name}</p>
                           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{campaign.scheduledAt ? formatLongDate(campaign.scheduledAt) : "Immediate"}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${campaign.status === "sent" ? "text-slate-400" : "text-primary"}`}>
                          <div className={`h-1.5 w-1.5 rounded-full ${campaign.status === "sent" ? "bg-slate-300" : "bg-primary animate-pulse"}`} />
                          {campaign.status === "sent" ? "Done" : "Active"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                         <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Volume</p>
                            <p className="text-sm font-black text-slate-900">{sent.toLocaleString()}</p>
                         </div>
                         <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Delivery</p>
                            <p className="text-sm font-black text-slate-900">{rate}%</p>
                         </div>
                      </div>
                   </div>
                 );
               })}
            </div>
          </section>
        )}
      </div>
    </StudioPageShell>
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
    <div className={`overflow-hidden group relative flex flex-col justify-between rounded-[2rem] border border-slate-100 bg-white p-7 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.05)] transition-all hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.08)] hover:-translate-y-1`}>
      {/* Dynamic Background Glow */}
      <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full blur-[40px] transition-opacity opacity-0 group-hover:opacity-100 ${isPositive ? 'bg-primary/20' : 'bg-error/20'}`} />
      
      <div className="mb-8 flex items-start justify-between relative z-10">
        <h3 className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-slate-400">{props.label}</h3>
        <div className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold transition-all ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-error/5 text-error'}`}>
          <Icon name={isPositive ? "trending_up" : "trending_down"} className="text-xs" />
          {props.trend}
        </div>
      </div>
      <div className="flex items-end justify-between gap-4 relative z-10">
        <p className="font-headline text-4xl font-extrabold tracking-tight text-primary">{props.value}</p>
        <div className="w-20 h-10 flex-shrink-0 opacity-40 group-hover:opacity-80 transition-all duration-500">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id={`grad-${props.label.replace(/\s+/g, '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
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
    <StudioPageShell
      title="Message Templates"
      subtitle="Manage your WhatsApp message templates synced from Twilio Content API."
      heroIcon="description"
      eyebrow="Asset Library"
      cta={
        <div className="flex items-center space-x-3">
          <button
            className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-white/20 disabled:opacity-50"
            disabled={syncingApproved}
            onClick={() => void syncApprovedTemplates()}
          >
            <Icon name="sync" className={`mr-2 ${syncingApproved ? "animate-spin" : ""}`} />
            {syncingApproved ? "Syncing..." : "Sync Twilio"}
          </button>
          <button
            className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-bold text-primary shadow-lg transition-all hover:scale-105 active:scale-95"
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
            {showForm ? "Cancel" : "Add Template"}
          </button>
        </div>
      }
    >
      <>


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
      </>
    </StudioPageShell>
  );
}


function AutomationsStudioPage(props: { data: BootstrapData; onRefresh: (preferredConversationId?: string | null) => Promise<void> }) {
  const [activeTab, setActiveTab] = useState<"simple" | "journey">("simple");
  const [form, setForm] = useState({
    name: "Keyword autoresponder",
    triggerType: "incoming_keyword",
    triggerValue: "price",
    templateId: props.data.templates[0]?.id ?? "",
    channelId: props.data.channels[0]?.id ?? "",
    segmentId: props.data.segments[0]?.id ?? "",
    delayMinutes: "0",
    templateVariables: [] as string[]
  });

  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingJourney, setEditingJourney] = useState<Automation | null>(null);

  const [autoSearch, setAutoSearch] = useState("");
  const [autoSort, setAutoSort] = useState<"name" | "type" | "status">("name");

  const filteredAutomations = useMemo(() => {
    let result = props.data.automations.filter(a => (a.version || "simple") === activeTab);
    
    if (autoSearch.trim()) {
      const q = autoSearch.toLowerCase();
      result = result.filter(a => a.name.toLowerCase().includes(q) || (a.triggerType || "").toLowerCase().includes(q) || a.triggerValue?.toLowerCase().includes(q));
    }

    result.sort((a, b) => {
      if (autoSort === "name") return a.name.localeCompare(b.name);
      if (autoSort === "type") return (a.triggerType || "").localeCompare(b.triggerType || "");
      if (autoSort === "status") return (a.isActive === b.isActive) ? 0 : (a.isActive ? -1 : 1);
      return 0;
    });

    return result;
  }, [props.data.automations, autoSearch, autoSort, activeTab]);

  async function saveAutomation(event: FormEvent) {
    event.preventDefault();
    await api("/api/automations", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        version: "simple",
        delayMinutes: Number(form.delayMinutes)
      })
    });
    await props.onRefresh();
  }

  async function saveJourney(nodes: JourneyNode[]) {
     const startNode = nodes[0];
     await api("/api/automations", {
       method: "POST",
       body: JSON.stringify({
         name: editingJourney ? editingJourney.name : "New Journey " + new Date().toLocaleDateString(),
         version: "journey",
         triggerType: startNode?.type,
         triggerValue: startNode?.config?.segmentId || startNode?.config?.keyword,
         flowData: nodes
       })
     });
     setIsBuilderOpen(false);
     setEditingJourney(null);
     await props.onRefresh();
  }

  return (
    <StudioPageShell title="Automation Studio" subtitle="Run template workflows for keyword replies, new contacts, and segment entries." heroIcon="bolt" eyebrow="Workflow Engine">
      <div className="mb-8 flex items-center justify-between">
        <div className="inline-flex rounded-2xl bg-surface-container-low p-1.5 shadow-inner">
           <button 
             onClick={() => setActiveTab("simple")}
             className={`flex h-12 items-center gap-3 rounded-xl px-6 text-sm font-bold transition-all duration-300 ${activeTab === 'simple' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
           >
              <span className="material-symbols-rounded">bolt</span> Simple Workflows
           </button>
           <button 
             onClick={() => setActiveTab("journey")}
             className={`flex h-12 items-center gap-3 rounded-xl px-6 text-sm font-bold transition-all duration-300 ${activeTab === 'journey' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
           >
              <span className="material-symbols-rounded">route</span> Customer Journeys
           </button>
        </div>

        <div className="flex items-center gap-3">
           <div className="relative">
              <input 
                type="text" 
                placeholder="Search automations..." 
                className="atrium-input bg-surface-container-lowest py-2 text-sm w-64 outline-none border border-outline-variant/10 pl-10"
                value={autoSearch}
                onChange={(e) => setAutoSearch(e.target.value)}
              />
              <span className="material-symbols-rounded absolute left-3 top-2.5 text-on-surface-variant text-lg">search</span>
           </div>
           <select 
             className="atrium-input bg-surface-container-lowest py-2 text-sm w-40 border border-outline-variant/10"
             value={autoSort}
             onChange={(e) => setAutoSort(e.target.value as any)}
           >
              <option value="name">Name</option>
              <option value="type">Type</option>
              <option value="status">Status</option>
           </select>
        </div>
      </div>

      {activeTab === 'simple' ? (
        <div className="grid gap-8 lg:grid-cols-[800px_1fr]">
          <div className="rounded-[2.5rem] bg-surface-container-lowest p-8 shadow-xl shadow-surface-container-low/5 border border-outline-variant/5">
            <div className="flex flex-col lg:flex-row gap-10">
              <div className="flex-1 space-y-6">
                <div className="mb-4">
                   <h3 className="font-headline text-2xl font-bold text-primary">New Workflow</h3>
                   <p className="mt-1 text-sm text-outline font-medium">Create a simple trigger-based responder.</p>
                </div>
                <form className="space-y-6" onSubmit={saveAutomation}>
              <Field label="Workflow name">
                <input className="atrium-input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              </Field>
              <Field label="Trigger type">
                <select className="atrium-input" value={form.triggerType || ""} onChange={(event) => setForm((current) => ({ ...current, triggerType: event.target.value as any }))}>
                  <option value="incoming_keyword">Incoming keyword</option>
                  <option value="new_contact">New contact</option>
                  <option value="segment_joined">Segment joined</option>
                </select>
              </Field>
              {form.triggerType === "incoming_keyword" ? (
                <Field label="Keyword">
                  <input className="atrium-input" value={form.triggerValue || ""} onChange={(event) => setForm((current) => ({ ...current, triggerValue: event.target.value }))} />
                </Field>
              ) : null}
              {form.triggerType === "segment_joined" ? (
                <Field label="Segment">
                  <select className="atrium-input" value={form.segmentId || ""} onChange={(event) => setForm((current) => ({ ...current, segmentId: event.target.value }))}>
                    {props.data.segments.map((segment) => (
                      <option key={segment.id} value={segment.id}>
                        {segment.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
              <Field label="Broadcast Template">
                <select className="atrium-input" value={form.templateId || ""} onChange={(event) => setForm((current) => ({ ...current, templateId: event.target.value, templateVariables: [] }))}>
                  {props.data.templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </Field>
              {(() => {
                const selectedTmpl = props.data.templates.find(t => t.id === form.templateId);
                if (!selectedTmpl?.placeholders?.length) return null;
                return (
                  <div className="space-y-4 p-5 rounded-3xl bg-slate-50 border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                       <Icon name="variable" className="text-sm" /> Automated Variables ({selectedTmpl.placeholders.length})
                    </p>
                    {selectedTmpl.placeholders.map((ph, idx) => (
                       <Field key={ph + idx} label={`Variable: ${ph}`}>
                          <input 
                            className="atrium-input bg-white" 
                            placeholder={`Value for ${ph}...`}
                            value={form.templateVariables[idx] || ""}
                            onChange={(e) => {
                               const next = [...form.templateVariables];
                               next[idx] = e.target.value;
                               setForm(cur => ({ ...cur, templateVariables: next }));
                            }}
                          />
                       </Field>
                    ))}
                  </div>
                );
              })()}
              <Field label="Channel">
                <select className="atrium-input" value={form.channelId || ""} onChange={(event) => setForm((current) => ({ ...current, channelId: event.target.value }))}>
                  {props.data.channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Delay (Minutes)">
                <input className="atrium-input" value={form.delayMinutes} onChange={(event) => setForm((current) => ({ ...current, delayMinutes: event.target.value }))} />
              </Field>
                <div className="pt-4">
                  <button type="submit" className="w-full py-4 rounded-2xl bg-primary text-sm font-bold text-on-primary shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                    Activate Automation
                  </button>
                </div>
                </form>
              </div>

              {form.templateId && (
                <div className="w-[320px] shrink-0">
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Live Message Preview</p>
                   <div className="rounded-[3rem] border-[8px] border-slate-900 bg-slate-950 overflow-hidden shadow-2xl scale-90 origin-top">
                      <TemplateLivePreview 
                        template={props.data.templates.find(t => t.id === form.templateId)} 
                        variables={form.templateVariables} 
                      />
                   </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 content-start">
             {filteredAutomations.map(automation => (
                <div key={automation.id} className="group relative flex items-center gap-6 rounded-[2.5rem] bg-surface-container-lowest p-6 border border-outline-variant/10 hover:border-primary/40 transition-all duration-300 hover:shadow-xl">
                   <div className="flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-primary/5 text-primary group-hover:bg-primary group-hover:text-on-primary transition-all duration-500">
                      <span className="material-symbols-rounded text-3xl">
                         {automation.triggerType === 'incoming_keyword' ? 'key' : automation.triggerType === 'new_contact' ? 'person_add' : 'segment'}
                      </span>
                   </div>
                   <div className="flex-1">
                      <div className="flex items-center gap-2">
                         <h4 className="font-headline text-lg font-bold text-on-surface group-hover:text-primary transition-colors">{automation.name}</h4>
                         <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${automation.isActive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-surface-container-high text-outline'}`}>
                            {automation.isActive ? 'Active' : 'Paused'}
                         </span>
                      </div>
                      <p className="mt-1 text-sm text-on-surface-variant font-medium">
                         Sends {props.data.templates.find(t => t.id === automation.templateId)?.name} via {props.data.channels.find(c => c.id === automation.channelId)?.name}
                      </p>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-outline">Trigger</p>
                      <p className="text-sm font-bold text-primary group-hover:scale-105 transition-transform">{automation.triggerValue || 'Auto'}</p>
                   </div>
                </div>
             ))}
             {filteredAutomations.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 opacity-30">
                   <span className="material-symbols-rounded text-6xl mb-4">bolt</span>
                   <p className="font-bold">No active workflows found.</p>
                </div>
             )}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
           <div className="rounded-[3rem] bg-gradient-to-br from-primary to-primary-fixed-dim p-12 text-on-primary shadow-2xl relative overflow-hidden group">
              <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 opacity-10 transition-transform group-hover:scale-110 duration-1000">
                 <span className="material-symbols-rounded text-[300px]">route</span>
              </div>
              <div className="relative z-10 max-w-xl">
                 <h2 className="font-headline text-4xl font-bold">Build Multi-Stage Journeys</h2>
                 <p className="mt-4 text-lg font-medium opacity-90 leading-relaxed">Combine branching logic, delays, and cross-channel messaging to guide your customers through personlised conversion paths.</p>
                 <button 
                   onClick={() => setIsBuilderOpen(true)}
                   className="mt-8 inline-flex items-center gap-3 rounded-2xl bg-surface-container-lowest px-8 py-4 text-sm font-bold text-primary shadow-xl hover:scale-105 active:scale-95 transition-all"
                 >
                    <span className="material-symbols-rounded">add_circle</span> Create New Journey
                </button>
              </div>
           </div>

           <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filteredAutomations.map(automation => (
                 <div 
                   key={automation.id}
                   onClick={() => { setEditingJourney(automation); setIsBuilderOpen(true); }}
                   className="group cursor-pointer rounded-[2.5rem] bg-surface-container-lowest p-8 border border-outline-variant/10 shadow-lg shadow-surface-container-low/5 hover:border-primary/40 hover:shadow-2xl transition-all duration-300"
                 >
                    <div className="mb-6 flex justify-between items-start">
                       <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-lg shadow-primary/20">
                          <span className="material-symbols-rounded text-2xl">route</span>
                       </div>
                       <span className={`rounded-full px-4 py-1 text-xs font-bold ${automation.isActive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-surface-container-high text-outline'}`}>
                          {automation.isActive ? 'Active' : 'Draft'}
                       </span>
                    </div>
                    <h4 className="font-headline text-xl font-bold text-on-surface group-hover:text-primary transition-colors">{automation.name}</h4>
                    <p className="mt-3 text-sm text-on-surface-variant font-medium leading-relaxed">
                       {automation.flowData?.length || 0} automated steps including logic splits and cross-channel delivery.
                    </p>
                    <div className="mt-8 flex items-center justify-between pt-6 border-t border-outline-variant/10">
                       <div className="flex items-center gap-2">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 transition-transform hover:scale-110 shadow-sm border border-sky-500/10"><span className="material-symbols-rounded text-lg font-bold">chat</span></div>
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 transition-transform hover:scale-110 shadow-sm border border-amber-500/10"><span className="material-symbols-rounded text-lg font-bold">alternate_email</span></div>
                       </div>
                       <div className="rounded-xl bg-primary/5 px-4 py-2 text-xs font-bold text-primary opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0 flex items-center gap-2">
                          Manage Journey <span className="material-symbols-rounded text-sm">arrow_forward</span>
                       </div>
                    </div>
                 </div>
              ))}
              {filteredAutomations.length === 0 && (
                <div className="col-span-full py-20 flex flex-col items-center opacity-30">
                   <span className="material-symbols-rounded text-6xl mb-4">move_location</span>
                   <p className="font-bold">No journeys created yet.</p>
                </div>
              )}
           </div>
        </div>
      )}

      {isBuilderOpen && <JourneyDesigner nodes={editingJourney?.flowData || []} onSave={saveJourney} onCancel={() => { setIsBuilderOpen(false); setEditingJourney(null); }} data={props.data} />}
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
    preferredName: "",
    email: "",
    role: "agent"
  });

  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Consolidated Settings State
  const [settingsForm, setSettingsForm] = useState({
    GEMINI_API_KEY: props.data.settings.GEMINI_API_KEY || "",
    TWILIO_ACCOUNT_SID: props.data.settings.TWILIO_ACCOUNT_SID || "",
    TWILIO_AUTH_TOKEN: props.data.settings.TWILIO_AUTH_TOKEN || "",
    TWILIO_DEFAULT_MESSAGING_SERVICE_SID: props.data.settings.TWILIO_DEFAULT_MESSAGING_SERVICE_SID || "",
    VITE_GOOGLE_CLIENT_ID: props.data.settings.VITE_GOOGLE_CLIENT_ID || "",
    APP_NAME: props.data.settings.APP_NAME || "tomorrowX",
    APP_LOGO_URL: props.data.settings.APP_LOGO_URL || "/logo.png",
    SEO_DESCRIPTION: props.data.settings.SEO_DESCRIPTION || "Verified WhatsApp Operations Hub for sales and support."
  });
  
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const toggleVisibility = (key: string) => setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));

  const [isSavingSettings, setIsSavingSettings] = useState(false);

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
    setUserForm({ name: "", preferredName: "", email: "", role: "agent" });
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
    setUserForm({ name: user.name, preferredName: user.preferredName || "", email: user.email, role: user.role });
  }

    async function saveSettings() {
    // Basic Safeguard: Prevent saving truncated placeholders with ellipses
    const truncatedFields = Object.entries(settingsForm)
      .filter(([key, value]) => typeof value === 'string' && value.includes("..."))
      .map(([key]) => key);

    if (truncatedFields.length > 0) {
      alert(`Safety Block: The following fields appear to contain truncated placeholders (ellipses): ${truncatedFields.join(", ")}. Please enter the full value before saving.`);
      return;
    }

    // Twilio Credential Validation
    if (settingsForm.TWILIO_ACCOUNT_SID && !settingsForm.TWILIO_ACCOUNT_SID.startsWith("AC")) {
      alert("Validation Error: Twilio Account SID must start with 'AC'. Please check your Twilio Console dashboard.");
      return;
    }

    if (settingsForm.TWILIO_AUTH_TOKEN && settingsForm.TWILIO_AUTH_TOKEN.length < 32) {
      alert("Validation Error: Twilio Auth Token appears too short. It should be a 32-character hexadecimal string.");
      return;
    }

    setIsSavingSettings(true);
    try {
      await api("/api/settings", {
        method: "POST",
        body: JSON.stringify(settingsForm)
      });
      await props.onRefresh();
      alert("All integration settings updated successfully.");
    } catch (err) {
      alert("Failed to save settings. Please check your permissions.");
    } finally {
      setIsSavingSettings(false);
    }
  }

  return (
    <StudioPageShell title="Shared Settings" subtitle="Manage branding, API integrations, and multi-user access for the same workspace." heroIcon="settings" eyebrow="Workspace Configuration">
      <div className="grid gap-6 xl:grid-cols-2">
        {/* COL 1: Branding & Credentials */}
        <div className="space-y-6">
           {/* Section 0: Workspace Identity */}
           <div className="rounded-[2rem] bg-surface-container-lowest p-8 shadow-sm border border-outline-variant/10">
              <div className="flex items-center justify-between mb-8">
                 <SectionTitle icon="palette" title="Workspace Identity & Branding" />
                 <button 
                  disabled={isSavingSettings} 
                  onClick={saveSettings} 
                  className="px-6 py-2 bg-primary text-on-primary rounded-xl font-bold text-xs shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all"
                >
                  {isSavingSettings ? 'Saving...' : 'Update Branding'}
                </button>
              </div>

              <div className="grid gap-6 md:grid-cols-[1fr_auto]">
                 <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Application Name</label>
                      <input 
                        type="text"
                        className="atrium-input bg-surface-container-low border-transparent focus:bg-white transition-all font-bold text-sm" 
                        placeholder="tomorrowX" 
                        value={settingsForm.APP_NAME} 
                        onChange={e => setSettingsForm({ ...settingsForm, APP_NAME: e.target.value })} 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Logo URL</label>
                      <input 
                        type="text"
                        className="atrium-input bg-surface-container-low border-transparent focus:bg-white transition-all text-xs" 
                        placeholder="/logo.png" 
                        value={settingsForm.APP_LOGO_URL} 
                        onChange={e => setSettingsForm({ ...settingsForm, APP_LOGO_URL: e.target.value })} 
                      />
                    </div>
                 </div>
                 <div className="flex flex-col items-center justify-center p-6 bg-surface-container-low rounded-3xl border border-dashed border-outline-variant/30 min-w-[120px]">
                    <p className="text-[8px] font-black text-slate-400 uppercase mb-3 text-center">Logo Preview</p>
                    <div className="h-16 w-16 bg-white p-2 rounded-2xl shadow-sm border border-outline-variant/10 flex items-center justify-center">
                       <img src={settingsForm.APP_LOGO_URL} alt="Preview" className="h-full w-full object-contain" />
                    </div>
                 </div>
              </div>

              <div className="mt-6 pt-6 border-t border-outline-variant/10">
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">SEO Description</label>
                 <textarea 
                    className="atrium-input bg-surface-container-low border-transparent focus:bg-white transition-all text-xs resize-none h-20" 
                    placeholder="Workspace meta description..." 
                    value={settingsForm.SEO_DESCRIPTION} 
                    onChange={e => setSettingsForm({ ...settingsForm, SEO_DESCRIPTION: e.target.value })} 
                 />
                 <p className="mt-2 text-[10px] text-slate-400 font-medium italic">Updates global meta tags for social sharing and search indexing.</p>
              </div>
           </div>
           
           {/* Section 1: AI Architect */}
           <div className="rounded-[2rem] bg-surface-container-lowest p-8 shadow-sm border border-outline-variant/10">
              <div className="flex items-center justify-between mb-8">
                <SectionTitle icon="auto_fix_high" title="AI Architect Integration" />
                <button 
                  disabled={isSavingSettings} 
                  onClick={saveSettings} 
                  className="px-6 py-2 bg-primary text-on-primary rounded-xl font-bold text-xs shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all"
                >
                  {isSavingSettings ? 'Saving...' : 'Update Keys'}
                </button>
              </div>
              
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gemini API Key</label>
                    <button onClick={() => toggleVisibility('GEMINI_API_KEY')} className="text-[10px] font-bold text-primary flex items-center gap-1">
                      <Icon name={showKeys.GEMINI_API_KEY ? "visibility_off" : "visibility"} className="text-xs" />
                      {showKeys.GEMINI_API_KEY ? 'Hide' : 'Reveal'}
                    </button>
                  </div>
                  <input 
                    type={showKeys.GEMINI_API_KEY ? "text" : "password"}
                    className="atrium-input bg-surface-container-low border-transparent focus:bg-white transition-all font-mono text-xs" 
                    placeholder="AIza..." 
                    value={settingsForm.GEMINI_API_KEY} 
                    onChange={e => setSettingsForm({ ...settingsForm, GEMINI_API_KEY: e.target.value })} 
                  />
                  <p className="mt-2 text-[10px] text-slate-400 font-medium italic">Used for AI Landing Page generation and Agent Manager orchestration.</p>
                </div>

                <div className="pt-4 border-t border-outline-variant/10">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Google OAuth Client ID</label>
                    <button onClick={() => toggleVisibility('VITE_GOOGLE_CLIENT_ID')} className="text-[10px] font-bold text-primary flex items-center gap-1">
                      <Icon name={showKeys.VITE_GOOGLE_CLIENT_ID ? "visibility_off" : "visibility"} className="text-xs" />
                      {showKeys.VITE_GOOGLE_CLIENT_ID ? 'Hide' : 'Reveal'}
                    </button>
                  </div>
                  <input 
                    type={showKeys.VITE_GOOGLE_CLIENT_ID ? "text" : "password"}
                    className="atrium-input bg-surface-container-low border-transparent focus:bg-white transition-all font-mono text-xs" 
                    placeholder="Enter full client ID... (e.g. 123-abc.apps.googleusercontent.com)" 
                    value={settingsForm.VITE_GOOGLE_CLIENT_ID} 
                    onChange={e => setSettingsForm({ ...settingsForm, VITE_GOOGLE_CLIENT_ID: e.target.value })} 
                  />
                  <p className="mt-2 text-[10px] text-slate-400 font-medium italic">
                    {settingsForm.VITE_GOOGLE_CLIENT_ID 
                      ? "Enables secure 'Sign in with Google' for your team." 
                      : "Empty: Falling back to secure environment variable configuration."}
                  </p>
                </div>
              </div>
           </div>

           {/* Section 2: Communication Gateway */}
           <div className="rounded-[2rem] bg-surface-container-lowest p-8 shadow-sm border border-outline-variant/10">
              <div className="flex items-center justify-between mb-8">
                <SectionTitle icon="hub" title="Communication Gateway" />
                <button 
                 disabled={isSavingSettings} 
                 onClick={saveSettings} 
                 className="px-6 py-2 bg-primary text-on-primary rounded-xl font-bold text-xs shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all"
               >
                 {isSavingSettings ? 'Saving...' : 'Update Gateway'}
               </button>
              </div>
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Twilio Account SID</label>
                  </div>
                  <input 
                    type="text"
                    className="atrium-input bg-surface-container-low border-transparent focus:bg-white transition-all font-mono text-xs" 
                    placeholder="AC..." 
                    value={settingsForm.TWILIO_ACCOUNT_SID} 
                    onChange={e => setSettingsForm({ ...settingsForm, TWILIO_ACCOUNT_SID: e.target.value })} 
                  />
                  {!settingsForm.TWILIO_ACCOUNT_SID && (
                    <p className="mt-2 text-[10px] text-slate-400 font-medium italic">Falling back to system environment variable.</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Twilio Auth Token</label>
                    <button onClick={() => toggleVisibility('TWILIO_AUTH_TOKEN')} className="text-[10px] font-bold text-primary flex items-center gap-1">
                      <Icon name={showKeys.TWILIO_AUTH_TOKEN ? "visibility_off" : "visibility"} className="text-xs" />
                      {showKeys.TWILIO_AUTH_TOKEN ? 'Hide' : 'Reveal'}
                    </button>
                  </div>
                  <input 
                    type={showKeys.TWILIO_AUTH_TOKEN ? "text" : "password"}
                    className="atrium-input bg-surface-container-low border-transparent focus:bg-white transition-all font-mono text-xs" 
                    placeholder="••••••••••••••••••••••••••••••••" 
                    value={settingsForm.TWILIO_AUTH_TOKEN} 
                    onChange={e => setSettingsForm({ ...settingsForm, TWILIO_AUTH_TOKEN: e.target.value })} 
                  />
                  {!settingsForm.TWILIO_AUTH_TOKEN && (
                    <p className="mt-2 text-[10px] text-slate-400 font-medium italic">Falling back to secure environment rotation.</p>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Default Messaging Service SID</label>
                  <input 
                    type="text"
                    className="atrium-input bg-surface-container-low border-transparent focus:bg-white transition-all font-mono text-xs" 
                    placeholder="MG..." 
                    value={settingsForm.TWILIO_DEFAULT_MESSAGING_SERVICE_SID} 
                    onChange={e => setSettingsForm({ ...settingsForm, TWILIO_DEFAULT_MESSAGING_SERVICE_SID: e.target.value })} 
                  />
                </div>
              </div>
           </div>
        </div>

        {/* COL 2: Teams & Numbers */}
        <div className="space-y-6">
          <div className="rounded-[2rem] bg-surface-container-lowest p-6 shadow-sm border border-outline-variant/10">
            <SectionTitle icon="call" title={editingChannelId ? "Edit WhatsApp Sender" : "Add WhatsApp Sender"} />
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

          <div className="rounded-[2rem] bg-surface-container-lowest p-6 shadow-sm border border-outline-variant/10">
            <SectionTitle icon="group" title={editingUserId ? "Edit Team Member" : "Add Team Member"} />
            <form className="space-y-4" onSubmit={saveUser}>
              <Field label="Full Name">
                <input className="atrium-input" value={userForm.name} onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))} />
              </Field>
              <Field label="Preferred Name (Agent Alias)">
                <input className="atrium-input" placeholder="e.g. John" value={userForm.preferredName} onChange={(event) => setUserForm((current) => ({ ...current, preferredName: event.target.value }))} />
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
                    onClick={() => { setEditingUserId(null); setUserForm({ name: "", preferredName: "", email: "", role: "agent" }); }}
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
                    <Avatar label={user.preferredName || user.name} size="h-10 w-10" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-on-surface">{user.name}</p>
                        <span className="rounded-full bg-primary-fixed/20 px-2 py-0.5 text-[10px] uppercase tracking-widest font-bold text-primary">{user.role}</span>
                      </div>
                      <p className="text-xs text-on-surface-variant font-medium mt-1">{user.email}{user.preferredName && ` • Alias: ${user.preferredName}`}{user.lastLoginAt && ` • Last Seen: ${new Date(user.lastLoginAt).toLocaleDateString()}`}</p>
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
        </div>
      </div>
    </StudioPageShell>
  );
}

function StudioPageShell(props: { title: string; subtitle: string; heroIcon: string; eyebrow: React.ReactNode; cta?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="px-8 pb-12 pt-8">
      <div className="mb-8 rounded-[2.5rem] bg-gradient-to-br from-primary to-primary-fixed-dim p-10 text-on-primary shadow-2xl relative overflow-hidden group">
        <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 opacity-10 transition-transform group-hover:scale-110 duration-1000 pointer-events-none">
          <span className="material-symbols-rounded text-[280px]">{props.heroIcon}</span>
        </div>
        <div className="relative z-10">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-xl">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.28em] opacity-60">
                {props.eyebrow}
              </div>
              <h1 className="mt-3 font-headline text-4xl font-extrabold tracking-tight">{props.title}</h1>
              <p className="mt-4 text-base font-medium opacity-80 leading-relaxed">{props.subtitle}</p>
            </div>
            {props.cta && <div className="shrink-0">{props.cta}</div>}
          </div>
        </div>
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
      <div className={`max-w-[70%] overflow-hidden rounded-2xl px-5 py-3 shadow-sm ${outgoing ? "rounded-br-none bg-primary text-on-primary shadow-primary/20" : "rounded-bl-none bg-white border border-slate-100 text-slate-700"}`}>
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
    <div className={`flex items-center gap-4 transition-all duration-500 ${props.dim ? "opacity-40 grayscale" : ""}`}>
      <div className="relative group">
        <div className={`absolute -inset-2 rounded-full blur-md transition-opacity duration-500 ${active ? "bg-primary/30 opacity-100" : "opacity-0"}`} />
        <div
          className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl font-extrabold shadow-sm transition-colors duration-300 ${
            active ? "bg-primary text-on-primary shadow-primary/30" : pending ? "bg-emerald-50 text-primary border border-emerald-100" : "border border-slate-200 bg-slate-50 text-slate-400"
          }`}
        >
          {pending && props.status !== "selected" ? <Icon name="check" className="text-xl" /> : props.index}
        </div>
      </div>
      <div className="flex flex-col">
        <span className={`text-sm font-extrabold transition-colors duration-300 ${active ? "text-primary" : pending ? "text-slate-800" : "text-slate-400"}`}>{props.label}</span>
        <span className={`text-[9px] uppercase tracking-[0.2em] font-bold ${active ? "text-primary/70" : "text-slate-300"}`}>{active ? "In Progress" : props.status === "pending" ? "Completed" : "Locked"}</span>
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

function MobileContactCard(props: {
  contact: Contact;
  data: BootstrapData;
  onOpen: (id: string, channelId: string) => void;
}) {
  return (
    <div className="rounded-3xl bg-white p-5 border border-slate-100 shadow-sm active:scale-[0.98] transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Avatar label={fullName(props.contact)} size="h-12 w-12" />
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-primary truncate max-w-[160px]">{fullName(props.contact)}</div>
            <div className="text-[10px] font-bold text-outline/70 mt-0.5">{props.contact.phone}</div>
          </div>
        </div>
        <button 
           className="p-2.5 rounded-full bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
           onClick={() => props.onOpen(props.contact.id, props.data.channels[0]?.id)}
        >
          <Icon name="chat" className="text-xl" />
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-3 mb-4">
        {props.contact.company && (
          <div className="bg-surface-container-low/50 p-2.5 rounded-xl">
            <div className="text-[9px] font-bold uppercase tracking-wider text-outline/50">Company</div>
            <div className="text-[11px] font-bold text-slate-700 truncate mt-0.5">{props.contact.company}</div>
          </div>
        )}
        <div className="bg-surface-container-low/50 p-2.5 rounded-xl">
          <div className="text-[9px] font-bold uppercase tracking-wider text-outline/50">Status</div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-tight">Verified</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(props.contact.labels.length ? props.contact.labels : props.contact.segmentIds.slice(0, 3)).map((labelOrId) => (
           <span
             className="rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-extrabold uppercase tracking-tight text-slate-500"
             key={labelOrId}
           >
             {resolveLabel(labelOrId, props.data)}
           </span>
        ))}
        {(!props.contact.labels.length && !props.contact.segmentIds.length) && (
           <span className="text-[10px] text-slate-300 italic">No segments</span>
        )}
      </div>
    </div>
  );
}

function OverviewMetric(props: { label: string; value: string }) {
  return (
    <div className="min-w-[180px] rounded-2xl bg-white border border-slate-100 p-5 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.05)] transition-all hover:shadow-md hover:scale-[1.02]">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-outline/60">{props.label}</div>
      <div className="mt-1 font-headline text-3xl font-extrabold tracking-tight text-primary">{props.value}</div>
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
          "group relative flex items-center rounded-2xl px-5 transition-all duration-300 ease-out",
          props.collapsed ? "justify-center px-4" : "gap-4",
          props.compact ? "py-2.5 text-[11px] font-bold uppercase tracking-wider" : "py-3.5 text-sm font-bold",
          isActive
            ? "bg-gradient-to-r from-primary/8 via-primary/[0.03] to-transparent text-primary shadow-[0_8px_20px_-12px_rgba(0,168,132,0.2)] ring-1 ring-primary/10"
            : "text-slate-500 hover:bg-slate-100/70 hover:text-slate-900"
        ].join(" ")
      }
      title={props.collapsed ? props.label : undefined}
      to={props.to}
    >
      {({ isActive }) => (
        <>
          <Icon className={props.compact ? "text-lg" : "text-xl"} name={props.icon} fill={true} />
          {!props.collapsed ? <span>{props.label}</span> : null}
          
          {/* Active Indicator Bar */}
          <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-primary transition-all duration-300 ${isActive ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0"}`} />
        </>
      )}
    </NavLink>
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

function InfoCard({ title, children, action, onActionClick }: { title: string; children: React.ReactNode; action?: string; onActionClick?: () => void }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100/50 relative overflow-hidden group hover:shadow-md transition-all">
       <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-primary/5 to-transparent"></div>
       <div className="mb-4 flex items-center justify-between">
          <h3 className="font-headline text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{title}</h3>
          {action && (
            <button onClick={onActionClick} className="text-[10px] font-bold text-primary hover:underline uppercase tracking-wider">{action}</button>
          )}
       </div>
       <div className="space-y-4">
          {children}
       </div>
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

export function Icon(props: { name: string; className?: string; fill?: boolean }) {
  return (
    <span className={`material-symbols-rounded ${props.className ?? ""}`} style={props.fill ? { fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24" } : undefined}>
      {props.name}
    </span>
  );
}

function fullName(contact: Contact) {
  const name = `${contact.firstName} ${contact.lastName}`.trim();
  if (name) return name;
  return contact.vehicles?.[0]?.vehicleOwnerName || "Unknown Contact";
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

function EditableText(props: { value: string; tagName?: string; className?: string; style?: any; onChange: (next: string) => void }) {
  const Tag = (props.tagName || 'div') as any;
  const [localValue, setLocalValue] = useState(props.value);

  useEffect(() => {
    setLocalValue(props.value);
  }, [props.value]);

  return (
    <Tag
      contentEditable
      suppressContentEditableWarning
      className={`outline-none transition-all focus:ring-2 focus:ring-primary/20 rounded-md px-1 -mx-1 cursor-text ${props.className ?? ""}`}
      style={props.style}
      onBlur={(e: any) => {
        const next = e.currentTarget.textContent || "";
        setLocalValue(next);
        props.onChange(next);
      }}
      dangerouslySetInnerHTML={{ __html: localValue }}
    />
  );
}

function SmartBuilderWizard(props: { onComplete: (config: any) => void; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    industry: "saas",
    description: "",
    goal: "lead",
    style: "modern",
    sections: [] as any[],
    rawContent: ""
  });
  const [isBuilding, setIsBuilding] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);



  async function handleBuild() {
    setIsBuilding(true);
    try {
      const resp = await api("/api/ai/smart-build", {
        method: "POST",
        body: JSON.stringify(formData)
      });
      props.onComplete(resp);
    } catch (err) {
      alert("Failed to build page. Check your connection.");
      setIsBuilding(false);
    }
  }

  const industries = [
    { id: 'saas', icon: '💻', label: 'SaaS' },
    { id: 'ecommerce', icon: '🛒', label: 'E-Commerce' },
    { id: 'restaurant', icon: '🍽️', label: 'Restaurant' },
    { id: 'legal', icon: '⚖️', label: 'Legal' },
    { id: 'fitness', icon: '💪', label: 'Fitness' },
    { id: 'education', icon: '🎓', label: 'Education' },
    { id: 'agency', icon: '🎨', label: 'Agency' },
    { id: 'coffee', icon: '☕', label: 'Coffee' }
  ];

  const themes = [
    { id: 'modern', label: 'Modern', colors: ['#6366f1', '#ffffff', '#1e293b'] },
    { id: 'corporate', label: 'Corporate', colors: ['#0f172a', '#f8fafc', '#334155'] },
    { id: 'playful', label: 'Playful', colors: ['#f43f5e', '#fff7ed', '#451a03'] },
    { id: 'bold', label: 'Bold', colors: ['#ffffff', '#000000', '#ffffff'] },
    { id: 'minimal', label: 'Minimal', colors: ['#18181b', '#fafafa', '#27272a'] },
    { id: 'ocean', label: 'Ocean', colors: ['#0ea5e9', '#f0f9ff', '#0c4a6e'] }
  ];

  const canProceed = step === 1 ? !!formData.name : step === 2 ? formData.rawContent.length > 20 : true;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-md">
      <div className="w-full max-w-3xl bg-white shadow-2xl rounded-[3rem] overflow-hidden animate-slide-up border border-white/20 max-h-[90vh] flex flex-col">
         {/* Header */}
         <div className="bg-primary p-10 text-on-primary relative overflow-hidden flex-shrink-0">
            <div className="absolute top-0 right-0 h-full w-full bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent)]" />
            <div className="relative z-10">
               <h2 className="font-headline text-3xl font-extrabold mb-1">
                 {step === 1 ? 'Your Brand' : step === 2 ? 'Add Your Content' : 'Style & Launch'}
               </h2>
               <p className="text-on-primary/60 text-sm font-medium">
                 {step === 1 ? 'Tell us about your business.' : step === 2 ? 'Let the AI architect your content.' : 'Choose a look and generate.'}
               </p>
            </div>
            <div className="mt-6 flex items-center gap-3 relative z-10">
               {[1,2,3].map(s => (
                 <div key={s} className="flex-1 flex items-center gap-2">
                   <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= s ? 'bg-white text-primary' : 'bg-white/20 text-white/60'}`}>{s}</div>
                   <div className={`flex-1 h-1 rounded-full ${s < 3 ? (step > s ? 'bg-white' : 'bg-white/20') : 'hidden'}`} />
                 </div>
               ))}
            </div>
         </div>

         {/* Body */}
         <div className="flex-1 overflow-y-auto p-10 scrollbar-hide">
            {isBuilding ? (
               <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                  <div className="h-24 w-24 rounded-full border-8 border-primary/20 border-t-primary animate-spin mb-8" />
                  <p className="text-xl font-bold text-primary">Generating Your Site...</p>
                  <p className="text-sm text-slate-400 mt-2 italic">Structuring content, applying brand, optimizing layout...</p>
               </div>
            ) : (
               <>
                  {/* Step 1: Brand */}
                  {step === 1 && (
                     <div className="space-y-6">
                        <div>
                           <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Business Name</label>
                           <input
                             autoFocus
                             className="atrium-input text-lg py-5 rounded-2xl"
                             placeholder="e.g. Acme Coffee Roasters"
                             value={formData.name}
                             onChange={e => setFormData({...formData, name: e.target.value})}
                           />
                        </div>
                        <div>
                           <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Describe your business in one line</label>
                           <input
                             className="atrium-input text-sm py-4 rounded-2xl"
                             placeholder="e.g. We deliver premium single-origin coffee beans to your door"
                             value={formData.description}
                             onChange={e => setFormData({...formData, description: e.target.value})}
                           />
                        </div>
                        <div>
                           <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">Industry</label>
                           <div className="grid grid-cols-4 gap-3">
                              {industries.map(n => (
                                 <button
                                   key={n.id}
                                   onClick={() => setFormData({...formData, industry: n.id})}
                                   className={`py-3 px-2 rounded-2xl border-2 text-center transition-all ${formData.industry === n.id ? 'border-primary bg-primary/5' : 'border-slate-100 hover:border-slate-200'}`}
                                 >
                                   <div className="text-xl mb-1">{n.icon}</div>
                                   <p className={`text-[10px] font-bold ${formData.industry === n.id ? 'text-primary' : 'text-slate-500'}`}>{n.label}</p>
                                 </button>
                              ))}
                           </div>
                        </div>
                     </div>
                  )}

                  {/* Step 2: Content Builder */}
                  {step === 2 && (
                     <div className="space-y-6">
                        <div className="space-y-4 animate-fade-in">
                           <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">What are you building?</label>
                              <textarea 
                                className="atrium-input text-sm min-h-[300px] py-6 rounded-3xl resize-none"
                                placeholder="Paste website copy, brochures, or describe your product here. The AI will intelligently map this to Hero, Features, and FAQ sections..."
                                value={formData.rawContent}
                                onChange={e => setFormData({...formData, rawContent: e.target.value})}
                              />
                           </div>
                           <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex gap-3">
                              <Icon name="auto_fix_high" className="text-primary mt-0.5" />
                              <p className="text-[10px] text-slate-500 leading-relaxed font-medium uppercase tracking-tight">
                                 AI Studio Google will structure your content into a high-converting landing page.
                              </p>
                           </div>
                        </div>
                     </div>
                  )}

                  {/* Step 3: Style & Launch */}
                  {step === 3 && (
                     <div className="space-y-8">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">Visual Theme</label>
                          <div className="grid grid-cols-3 gap-4">
                             {themes.map(t => (
                               <button
                                 key={t.id}
                                 onClick={() => setFormData({...formData, style: t.id})}
                                 className={`p-4 rounded-2xl border-2 transition-all text-left ${formData.style === t.id ? 'border-primary bg-primary/5 shadow-md' : 'border-slate-100 hover:border-slate-200'}`}
                               >
                                 <div className="flex gap-1.5 mb-3">
                                   {t.colors.map((c, i) => <div key={i} className="h-6 w-6 rounded-lg border border-black/5" style={{ backgroundColor: c }} />)}
                                 </div>
                                 <p className={`text-xs font-bold ${formData.style === t.id ? 'text-primary' : 'text-slate-600'}`}>{t.label}</p>
                               </button>
                             ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">Page Goal</label>
                          <div className="flex gap-4">
                            {[
                              { id: 'lead', label: 'Capture Leads', icon: 'person_add' },
                              { id: 'info', label: 'Share Info', icon: 'info' }
                            ].map(g => (
                              <button
                                key={g.id}
                                onClick={() => setFormData({...formData, goal: g.id})}
                                className={`flex-1 p-5 rounded-2xl border-2 transition-all flex items-center gap-4 ${formData.goal === g.id ? 'border-primary bg-primary/5' : 'border-slate-100 hover:border-slate-200'}`}
                              >
                                <Icon name={g.icon} className={`text-2xl ${formData.goal === g.id ? 'text-primary' : 'text-slate-400'}`} />
                                <p className={`font-bold text-sm ${formData.goal === g.id ? 'text-primary' : 'text-slate-600'}`}>{g.label}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Summary */}
                        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">Build Summary</p>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="px-3 py-1 bg-white rounded-full text-xs font-bold text-slate-600 border border-slate-100">{formData.name || 'Untitled'}</span>
                            <span className="px-3 py-1 bg-white rounded-full text-xs font-bold text-slate-600 border border-slate-100">{formData.rawContent.length > 0 ? 'AI Studio Google' : 'Empty'}</span>
                            <span className="px-3 py-1 bg-white rounded-full text-xs font-bold text-slate-600 border border-slate-100 capitalize">{formData.style} theme</span>
                          </div>
                        </div>
                     </div>
                  )}
               </>
            )}
         </div>

         {/* Footer Navigation */}
         {!isBuilding && (
           <div className="p-8 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
              <button onClick={props.onClose} className="px-6 py-3 font-bold text-slate-400 hover:text-slate-600 transition-colors text-sm">Discard</button>
              <div className="flex gap-3">
                 {step > 1 && <button onClick={() => setStep(step - 1)} className="px-6 py-3 rounded-2xl bg-slate-100 font-bold text-slate-500 hover:bg-slate-200 transition-all text-sm">Back</button>}
                 <button
                    disabled={!canProceed}
                    onClick={() => step < 3 ? setStep(step + 1) : handleBuild()}
                    className="px-8 py-3 rounded-2xl bg-primary text-on-primary font-bold shadow-xl shadow-primary/20 hover:scale-[1.03] active:scale-[0.98] transition-all disabled:opacity-50 text-sm flex items-center gap-2"
                 >
                    {step < 3 ? (
                      <>{step === 1 ? 'Add Content' : 'Choose Style'} <Icon name="arrow_forward" className="text-sm" /></>
                    ) : (
                      <><Icon name="auto_fix_high" className="text-sm" /> Generate My Site</>
                    )}
                 </button>
              </div>
           </div>
         )}
      </div>
    </div>
  );
}

function LandingPagesPage(props: { data: BootstrapData; onRefresh: () => Promise<void> }) {
  const [editorPageId, setEditorPageId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this page?")) return;
    await api(`/api/landing-pages/${id}`, { method: "DELETE" });
    await props.onRefresh();
  };

  return (
    <StudioPageShell title="Landing Pages" subtitle="Generate high-converting mobile-first pages linked directly to your CRM." heroIcon="web" eyebrow="Publishing Studio">
      <div className="mb-10 flex flex-col md:flex-row gap-6">
        <button 
          onClick={() => setEditorPageId("new")}
          className="flex-1 group relative overflow-hidden p-10 rounded-[3rem] bg-primary text-on-primary shadow-[0_32px_64px_-16px_rgba(37,99,235,0.4)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-500"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform">
             <Icon name="auto_fix_high" className="text-8xl" />
          </div>
          <div className="relative z-10 flex items-center gap-6">
             <div className="h-20 w-20 rounded-[2rem] bg-white/20 backdrop-blur-md flex items-center justify-center">
                <Icon name="rocket_launch" className="text-4xl" />
             </div>
             <div className="text-left">
                <h3 className="font-headline text-3xl font-extrabold mb-1">Architect AI</h3>
                <p className="text-on-primary/70 font-medium text-sm">Launch a high-fidelity landing page from a single prompt in seconds.</p>
             </div>
          </div>
          <div className="mt-8 flex items-center gap-2 text-sm font-bold opacity-80">
             Start architecting <Icon name="arrow_forward" className="text-sm" />
          </div>
        </button>

        <button 
          onClick={() => setEditorPageId("new")}
          className="p-10 rounded-[3rem] border-2 border-dashed border-outline-variant/30 hover:border-primary/40 hover:bg-primary/5 transition-all group lg:min-w-[400px] text-left"
        >
          <div className="flex items-center gap-4 text-outline group-hover:text-primary transition-colors">
             <Icon name="add_circle" className="text-4xl" />
             <div>
                <h3 className="text-xl font-bold">Blank Template</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Design manually</p>
             </div>
          </div>
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {props.data.landingPages.map(page => (
          <div key={page.id} className="group relative rounded-[2.5rem] bg-white border border-slate-100 p-8 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-500">
            <div className="mb-6 flex items-start justify-between">
              <div className="h-14 w-14 rounded-2xl bg-primary/5 flex items-center justify-center text-primary transform group-hover:scale-110 transition-transform">
                <Icon name="web" className="text-2xl" />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditorPageId(page.id)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-primary transition-colors"><Icon name="edit" className="text-sm" /></button>
                <button onClick={() => handleDelete(page.id)} className="p-2 rounded-lg text-slate-400 hover:bg-error/10 hover:text-error transition-colors"><Icon name="delete" className="text-sm" /></button>
              </div>
            </div>
            
            <h3 className="text-lg font-extrabold text-slate-800 line-clamp-1">{page.name}</h3>
            <p className="text-xs text-slate-400 font-bold tracking-wider mt-1">/l/{page.slug}</p>
            
            <div className="mt-6 flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${page.isPublished ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                {page.isPublished ? 'Published' : 'Draft'}
              </span>
              <a 
                href={`/l/${page.slug}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                View Live <Icon name="open_in_new" className="text-[12px]" />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* SmartBuilderWizard retired in favor of direct Studio entry */}

      {editorPageId && (
        <LandingPageEditor 
          pageId={editorPageId} 
          data={props.data} 
          onClose={() => {
            setEditorPageId(null);
            (window as any)._lpPrefill = null;
          }} 
          onRefresh={props.onRefresh} 
        />
      )}
    </StudioPageShell>
  );
}

function DeploymentSuccessModal(props: { page: any; onClose: () => void }) {
  const url = `${window.location.origin}/l/${props.page.slug}`;
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl animate-fade-in">
      <div className="w-full max-w-xl bg-white rounded-[3rem] p-10 shadow-2xl relative overflow-hidden animate-slide-up">
        {/* Confetti simulation background */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl animate-pulse delay-500" />
        
        <div className="relative z-10 text-center">
          <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center text-emerald-500 mx-auto mb-8 transform rotate-6 animate-bounce-subtle">
            <Icon name="check_circle" className="text-4xl" />
          </div>
          
          <h2 className="text-3xl font-black text-slate-900 mb-2">Deployed to Edge!</h2>
          <p className="text-slate-500 font-medium mb-10 italic">Your vision is now live and globally accessible.</p>
          
          <div className="p-6 rounded-[2rem] bg-slate-50 border border-slate-100 text-left space-y-4 mb-10">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Live Endpoint</div>
              <div className="flex items-center justify-between gap-4">
                <code className="text-xs font-bold text-primary truncate flex-1">{url}</code>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(url);
                    alert("URL copied to clipboard!");
                  }}
                  className="p-2 rounded-xl bg-white border border-slate-200 hover:border-primary text-slate-400 hover:text-primary transition-all"
                >
                  <Icon name="content_copy" className="text-sm" />
                </button>
              </div>
            </div>
            
            <div className="pt-4 border-t border-slate-200/50 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</div>
                <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs uppercase tracking-tighter">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Active
                </div>
              </div>
              <a 
                href={url}
                target="_blank"
                rel="noreferrer"
                className="py-3 px-8 rounded-full bg-slate-900 text-white text-xs font-bold shadow-lg shadow-slate-900/20 hover:scale-105 transition-all"
              >
                Visit Site
              </a>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-6">

            <button className="flex flex-col items-center gap-2 group" onClick={props.onClose}>
              <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-all">
                <Icon name="close" />
              </div>
              <span className="text-[9px] font-black uppercase text-slate-400">Close</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BuildProgressOverlay(props: { label: string; percent: number }) {
  return (
    <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center p-10 bg-white/80 backdrop-blur-2xl animate-fade-in overflow-hidden">
      {/* Decorative pulse circles */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full animate-pulse-slow" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/5 rounded-full animate-pulse-slow delay-1000" />
      
      <div className="relative z-10 w-full max-w-md text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.3em] mb-8 animate-bounce-subtle">
           <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          Architect System Active
        </div>
        
        <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight leading-none h-[2em] flex items-center justify-center">
          {props.label}
        </h2>
        
        <div className="relative h-4 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200/50">
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary via-indigo-500 to-primary flex items-center justify-end px-2 transition-all duration-700 ease-out"
            style={{ width: `${props.percent}%` }}
          >
            <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          </div>
        </div>
        
        <div className="mt-4 flex justify-between items-center text-[10px] font-bold tracking-widest text-slate-400 uppercase">
          <span>Processing Logic</span>
          <span className="text-primary">{props.percent}% Complete</span>
        </div>
        
        <div className="mt-12 grid grid-cols-3 gap-8 opacity-40">
           <div className="flex flex-col items-center gap-2">
              <div className={`h-1.5 w-full rounded-full ${props.percent > 30 ? 'bg-primary' : 'bg-slate-200'}`} />
              <span className="text-[8px] font-black">Structure</span>
           </div>
           <div className="flex flex-col items-center gap-2">
              <div className={`h-1.5 w-full rounded-full ${props.percent > 60 ? 'bg-primary' : 'bg-slate-200'}`} />
              <span className="text-[8px] font-black">Content</span>
           </div>
           <div className="flex flex-col items-center gap-2">
              <div className={`h-1.5 w-full rounded-full ${props.percent > 90 ? 'bg-primary' : 'bg-slate-200'}`} />
              <span className="text-[8px] font-black">Visuals</span>
           </div>
        </div>
      </div>
    </div>
  );
}

function LandingPageEditor(props: { pageId: string | null; data: BootstrapData; onClose: () => void; onRefresh: () => Promise<void> }) {
  const isNew = props.pageId === "new";
  const existingPage = props.data.landingPages.find(p => p.id === props.pageId);

  const prefill = (window as any)._lpPrefill;

  const [form, setForm] = useState({
    name: (isNew && prefill) ? prefill.name : (existingPage?.name || ""),
    slug: (isNew && prefill) ? prefill.slug : (existingPage?.slug || ""),
    title: (isNew && prefill) ? prefill.title : (existingPage?.title || ""),
    description: (isNew && prefill) ? prefill.description : (existingPage?.description || ""),
    sections: (isNew && prefill) ? prefill.sections : (existingPage?.sections || []),
    theme: (isNew && prefill) ? prefill.theme : (existingPage?.theme || { backgroundColor: '#ffffff', textColor: '#000000', primaryColor: '#2563eb' }),
    isPublished: existingPage?.isPublished ?? false
  });

  const [magicPrompt, setMagicPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
    const [activeTab, setActiveTab] = useState<'design' | 'magic'>('magic');
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
    const [showGallery, setShowGallery] = useState(false);

    // Antigravity Agent Manager states
    const [phase, setPhase] = useState<'input' | 'planning' | 'executing'>('input');
    const [implementationPlan, setImplementationPlan] = useState("");
    const [previewMode, setPreviewMode] = useState<'react' | 'sandbox'>('react');
    const [feedbackIndex, setFeedbackIndex] = useState<number | null>(null);
    const [feedbackText, setFeedbackText] = useState("");
    const [isRefining, setIsRefining] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Progress Tracking
    const [progressPercent, setProgressPercent] = useState(0);
    const [progressLabel, setProgressLabel] = useState("");
    
    // Deployment Tracking
    const [isDeploying, setIsDeploying] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
      let interval: any;
      if (isGenerating) {
        setProgressPercent(0);
        let current = 0;
        
        const planningLabels = [
          "Analyzing Brand Context...",
          "Identifying Key Sectors...",
          "Mapping Information Hierarchy...",
          "Optimizing User Journey...",
          "Finalizing Blueprint..."
        ];
        
        const executionLabels = [
          "Allocating Design Tokens...",
          "Drafting Persuasive Copy...",
          "Simulating Conversions...",
          "Polishing UI Synergy...",
          "Finalizing Export..."
        ];
        
        const labels = phase === 'planning' ? planningLabels : executionLabels;
        setProgressLabel(labels[0]);

        interval = setInterval(() => {
          current += Math.random() * 10;
          if (current >= 99) {
            current = 99;
            // Transition to 'Almost there' after it caps at 99 for a while
            setTimeout(() => {
              if (isGenerating) setProgressLabel("Almost there... finalizing the final details");
            }, 8000);
            clearInterval(interval);
          }
          setProgressPercent(Math.floor(current));
          
          // Rotate labels based on percentage
          if (current < 99) {
            const labelIdx = Math.min(
              Math.floor((current / 100) * labels.length),
              labels.length - 1
            );
            setProgressLabel(labels[labelIdx]);
          }
        }, 1200);
      } else {
        clearInterval(interval);
        setTimeout(() => setProgressPercent(0), 1000);
      }
      return () => clearInterval(interval);
    }, [isGenerating, phase]);

  // Phase 1: Planning
  const handleGeneratePlan = async () => {
    if (!magicPrompt) return;
    setPhase('planning');
    setIsGenerating(true);
    try {
      const resp: any = await api("/api/ai/plan", {
        method: "POST",
        body: JSON.stringify({
          rawContent: magicPrompt,
          name: form.name,
          description: form.description
        })
      });
      setImplementationPlan(resp.plan);
      setError(null);
    } catch (err: any) {
      console.error("Architect Phase 1 Error:", err);
      setError(err.message || "Failed to generate plan.");
      setPhase('input');
    } finally {
      setIsGenerating(false);
    }
  };

  // Phase 2: Execution
  const handleExecutePlan = async () => {
    setPhase('executing');
    setIsGenerating(true);
    try {
      const resp: any = await api("/api/ai/execute", {
        method: "POST",
        body: JSON.stringify({
          plan: implementationPlan,
          name: form.name,
          description: form.description,
          sections: form.sections
        })
      });
      if (resp.sections) {
        setForm(prev => ({ 
          ...prev, 
          name: resp.metadata?.name || prev.name,
          slug: resp.metadata?.slug || prev.slug,
          title: resp.metadata?.title || prev.title,
          description: resp.metadata?.description || prev.description,
          sections: resp.sections 
        }));
        setPhase('input');
        setMagicPrompt("");
        setError(null);
      }
    } catch (err: any) {
      console.error("Architect Phase 2 Error:", err);
      setError(err.message || "Execution failed.");
      setPhase('planning');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefineSection = async (idx: number) => {
    if (!feedbackText) return;
    setIsRefining(true);
    try {
      const resp: any = await api("/api/ai/refine-section", {
        method: "POST",
        body: JSON.stringify({
          section: form.sections[idx],
          feedback: feedbackText,
          businessContext: { name: form.name, description: form.description }
        })
      });
      if (resp.section) {
        const next = [...form.sections];
        next[idx] = resp.section;
        setForm({ ...form, sections: next });
        setFeedbackIndex(null);
        setFeedbackText("");
        setError(null);
      }
    } catch (err: any) {
      alert(`Refinement failed: ${err.message}`);
    } finally {
      setIsRefining(false);
    }
  };



  const [savedPage, setSavedPage] = useState<any>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setIsDeploying(true);
    setProgressPercent(0);
    setProgressLabel("Compiling Edge Assets...");
    
    // Step 1: Simulated Deployment Sequence
    const deploySteps = [
      "Optimizing Asset Bundles...",
      "Generating Static Content...",
      "Syncing to Global CDN...",
      "Propagating DNS Records...",
      "Deployment Finalizing..."
    ];
    
    let step = 0;
    const interval = setInterval(() => {
      setProgressPercent(prev => Math.min(prev + 20, 95));
      setProgressLabel(deploySteps[step] || "Finalizing...");
      step++;
      if (step >= deploySteps.length) clearInterval(interval);
    }, 400);

    try {
      const endpoint = isNew ? "/api/landing-pages" : `/api/landing-pages/${props.pageId}`;
      const method = isNew ? "POST" : "PUT";
      const resp: any = await api(endpoint, {
        method,
        body: JSON.stringify({ ...form, isPublished: true })
      });
      
      clearInterval(interval);
      setProgressPercent(100);
      setProgressLabel("Live!");
      
      // Capture the server response (contains id, slug, etc.)
      if (resp) {
        setSavedPage(resp);
        setForm(prev => ({
          ...prev,
          name: resp.name || prev.name,
          slug: resp.slug || prev.slug,
          title: resp.title || prev.title,
        }));
      }
      
      await props.onRefresh();
      
      setIsDeploying(false);
      setShowSuccess(true);
    } catch (err: any) {
      clearInterval(interval);
      alert(`Deployment failed: ${err.message}`);
      setIsDeploying(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {/* Main Editor Shell */}
      {showSuccess && <DeploymentSuccessModal page={savedPage || existingPage || form} onClose={() => { setShowSuccess(false); props.onClose(); }} />}
      <div className="fixed inset-0 z-[60] flex bg-slate-950/20 backdrop-blur-sm">
        <div className="flex h-full w-full max-w-7xl mx-auto overflow-hidden bg-white shadow-2xl md:rounded-l-[3rem] animate-slide-up relative">
          {(isGenerating || isDeploying) && <BuildProgressOverlay label={progressLabel} percent={progressPercent} />}

          {/* Sidebar */}
          <div className="w-80 border-r border-slate-100 flex flex-col bg-[#fcfdfd]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-headline text-lg font-extrabold text-primary">Atrium Studio</h2>
              <button onClick={props.onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <Icon name="close" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100">
              {(['magic', 'design'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === tab ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {tab === 'magic' ? 'AI Architect' : tab}
                </button>
              ))}
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">

              {/* Magic (AI Architect) - Agent Manager implementation */}
              {activeTab === 'magic' && (
                <div className="space-y-6 animate-fade-in">
                  
                  {/* Phase 1: Input */}
                  {phase === 'input' && (
                    <div className="p-5 rounded-3xl bg-primary/5 border border-primary/10 shadow-inner">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                        <Icon name="magic_button" className="text-sm" /> AI Architect
                      </p>

                      {error && (
                        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-[10px] text-red-600 font-medium animate-fade-in flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 font-bold uppercase tracking-widest text-[9px]">
                            <Icon name="error" className="text-xs" /> Diagnosis
                          </div>
                          {error.includes("abort") || error.includes("timeout") ? "The Architect is taking longer than usual (60s+). This usually happens with very complex prompts. Please try again with a simpler request." : error}
                          {error.includes("API_KEY") && (
                            <div className="mt-1 pt-1 border-t border-red-100 italic text-[9px] opacity-70">
                              Suggestion: Update your Gemini API Key in Settings.
                            </div>
                          )}
                        </div>
                      )}

                      <textarea
                        className="atrium-input bg-white text-xs min-h-[120px] resize-none border-primary/10 focus:border-primary/30"
                        placeholder="e.g. 'Add a dark mode saas hero and 3 pricing tiers'..."
                        value={magicPrompt}
                        onChange={e => setMagicPrompt(e.target.value)}
                        onFocus={() => setError(null)}
                      />
                      <button
                        disabled={isGenerating || !magicPrompt}
                        onClick={handleGeneratePlan}
                        className="mt-3 w-full py-4 rounded-2xl bg-primary text-xs font-bold text-on-primary shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-all"
                      >
                        {isGenerating ? <span className="animate-spin text-sm">⌛</span> : <Icon name="description" className="text-sm" />}
                        {isGenerating ? 'Analyzing...' : 'Generate Implementation Plan'}
                      </button>
                    </div>
                  )}

                  {/* Phase 2: Planning */}
                  {phase === 'planning' && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="p-5 rounded-3xl bg-slate-50 border border-slate-100 shadow-sm relative group">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                           <Icon name="assignment" className="text-sm text-primary" /> Implementation Plan
                        </p>
                        <div className="prose prose-slate prose-sm max-h-[400px] overflow-y-auto scrollbar-hide text-[10px] leading-relaxed text-slate-600 font-medium whitespace-pre-wrap">
                          {implementationPlan}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <button
                          disabled={isGenerating}
                          onClick={handleExecutePlan}
                          className="w-full py-4 rounded-2xl bg-primary text-xs font-bold text-on-primary shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-95 transition-all"
                        >
                          {isGenerating ? <span className="animate-spin text-sm">⌛</span> : <Icon name="play_arrow" className="text-sm" />}
                          {isGenerating ? 'Executing Architecture...' : 'Approve & Build Site'}
                        </button>
                        <button
                          onClick={() => setPhase('input')}
                          className="w-full py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-400 hover:text-slate-600 transition-all"
                        >
                          Cancel / Edit Prompt
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Phase 3: Executing (Global Loader) */}
                  {phase === 'executing' && (
                    <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                      <div className="h-16 w-16 rounded-full border-4 border-primary/10 border-t-primary animate-spin mb-6" />
                      <p className="text-xs font-bold text-primary uppercase tracking-widest">Building Live Canvas...</p>
                    </div>
                  )}

                  {/* Structure View (Only in Input/Refine states) */}
                  {phase === 'input' && (
                    <div className="p-5 rounded-3xl bg-slate-50 border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Current Structure</p>
                      <div className="space-y-2">
                        {form.sections.map((s: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-100 group">
                            <div className="h-7 w-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 text-xs">
                              {idx + 1}
                            </div>
                            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-tight flex-1">{s.type}</p>
                            <Icon name="check_circle" className="text-emerald-400 text-sm" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Design */}
              {activeTab === 'design' && (
                <div className="space-y-6 animate-fade-in">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Brand & SEO</p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Page Name</label>
                      <input className="atrium-input text-xs" placeholder="My Landing Page" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">URL Slug</label>
                      <input className="atrium-input text-xs" placeholder="my-landing-page" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Primary Color</label>
                      <div className="flex items-center gap-3">
                        <input type="color" className="h-10 w-10 rounded-xl border border-slate-100 cursor-pointer" value={form.theme.primaryColor} onChange={e => setForm({ ...form, theme: { ...form.theme, primaryColor: e.target.value } })} />
                        <span className="text-xs font-mono text-slate-500">{form.theme.primaryColor}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Background</label>
                      <div className="flex items-center gap-3">
                        <input type="color" className="h-10 w-10 rounded-xl border border-slate-100 cursor-pointer" value={form.theme.backgroundColor} onChange={e => setForm({ ...form, theme: { ...form.theme, backgroundColor: e.target.value } })} />
                        <span className="text-xs font-mono text-slate-500">{form.theme.backgroundColor}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Meta Title</label>
                      <input className="atrium-input text-xs" placeholder="Page title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Meta Description</label>
                      <textarea className="atrium-input text-xs resize-none min-h-[80px]" placeholder="Page description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Save */}
            <div className="p-6 border-t border-slate-100 bg-[#fcfdfd]">
              <button
                disabled={isSaving || !form.name || !form.slug}
                onClick={handleSave}
                className="w-full py-4 rounded-2xl bg-primary text-sm font-bold text-on-primary shadow-xl shadow-primary/20 disabled:opacity-50 active:scale-95 transition-all"
              >
                {isSaving ? 'Finalizing...' : (isNew ? 'Publish to Cloud' : 'Sync Changes')}
              </button>
            </div>
          </div>

          {/* Canvas & Sandbox Header */}
          <div className="flex-1 bg-slate-100 flex flex-col overflow-hidden relative">
            <div className="p-4 border-b border-slate-200 bg-white/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-[70]">
              <div className="flex bg-slate-100 rounded-xl p-1">
                <button onClick={() => setPreviewMode('react')} className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${previewMode === 'react' ? 'bg-white shadow-sm text-primary' : 'text-slate-400'}`}>React Canvas</button>
                <button onClick={() => setPreviewMode('sandbox')} className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${previewMode === 'sandbox' ? 'bg-white shadow-sm text-primary' : 'text-slate-400'}`}>Sandbox Iframe</button>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Antigravity Live</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-12 scrollbar-hide relative">
              {previewMode === 'sandbox' ? (
                <div className="w-full h-full bg-slate-200 rounded-[3rem] overflow-hidden shadow-inner border-[12px] border-slate-900 relative">
                  <div className="absolute top-0 left-0 w-full h-8 bg-slate-800 flex items-center px-4 gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-400" /><div className="h-2 w-2 rounded-full bg-amber-400" /><div className="h-2 w-2 rounded-full bg-emerald-400" />
                    <div className="ml-4 h-4 flex-1 bg-slate-700/50 rounded-full" />
                  </div>
                  <iframe 
                    className="w-full h-full pt-8 bg-white" 
                    title="Sandbox Preview"
                    srcDoc={`
                      <html>
                        <head>
                          <script src="https://cdn.tailwindcss.com"></script>
                          <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
                          <style> body { margin: 0; font-family: sans-serif; } </style>
                        </head>
                        <body>
                          <div id="root">
                            ${form.sections.map((s: any) => `
                              <div style="padding: 100px 50px; border-bottom: 1px solid #eee;">
                                <h1 style="font-size: 40px; font-weight: 800;">${s.title || s.type}</h1>
                                <p style="opacity: 0.6;">${s.subtitle || ''}</p>
                              </div>
                            `).join('')}
                          </div>
                        </body>
                      </html>
                    `}
                  />
                </div>
              ) : (
                <div className="mx-auto max-w-4xl min-h-screen bg-white shadow-2xl rounded-[3rem] overflow-hidden border border-slate-200 relative">
                  {form.sections.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center min-h-[600px] animate-fade-in relative px-12 text-center">
                      {/* Background Accents */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -z-10" />
                      
                      <div className="max-w-2xl w-full">
                        <div className="h-16 w-16 bg-white shadow-2xl rounded-2xl flex items-center justify-center text-primary mx-auto mb-8 animate-bounce-slow">
                          <Icon name="rocket_launch" className="text-3xl" />
                        </div>
                        
                        <h1 className="text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">
                          Re-architect the <span className="text-primary">Impossible.</span>
                        </h1>
                        <p className="text-lg text-slate-500 mb-12 font-medium leading-relaxed">
                          Enter a prompt or a business description. Our Agent Manager will plan, build, and deploy a high-fidelity landing page in seconds.
                        </p>

                        <div className="relative group">
                          {/* Portal Glow */}
                          <div className="absolute -inset-1 bg-gradient-to-r from-primary to-indigo-400 rounded-[2.5rem] blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                          
                          <div className="relative bg-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl border border-white flex flex-col gap-4">
                            <textarea 
                              className="w-full bg-transparent text-lg font-medium text-slate-700 outline-none resize-none min-h-[120px] placeholder:text-slate-300"
                              placeholder="Describe your vision (e.g. 'A futuristic SaaS for underwater data centers')..."
                              value={magicPrompt}
                              onChange={e => setMagicPrompt(e.target.value)}
                            />
                            
                            <div className="flex items-center justify-between">
                              <div className="flex gap-2">
                                <span className="px-3 py-1 rounded-full bg-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Architect Mode</span>
                              </div>
                              <button 
                                disabled={isGenerating || !magicPrompt}
                                onClick={handleGeneratePlan}
                                className="px-8 py-4 bg-primary text-on-primary rounded-2xl font-bold text-sm shadow-xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                              >
                                {isGenerating ? <span className="animate-spin text-sm">⌛</span> : <Icon name="auto_fix_high" />}
                                {isGenerating ? 'Analyzing...' : 'Generate Plan'}
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-12 flex items-center justify-center gap-8 opacity-40">
                           <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                             <Icon name="check_circle" className="text-emerald-500" /> Premium Design
                           </div>
                           <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                             <Icon name="check_circle" className="text-emerald-500" /> SEO Optimized
                           </div>
                           <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                             <Icon name="check_circle" className="text-emerald-500" /> Sandbox Ready
                           </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full" style={{ backgroundColor: form.theme.backgroundColor, color: form.theme.textColor }}>
                      {form.sections.map((section: any, idx: number) => (
                        <div
                          key={idx}
                          className={`relative group/section transition-all cursor-pointer ${selectedIdx === idx ? 'ring-2 ring-primary ring-inset' : 'hover:bg-primary/[0.01]'}`}
                          onClick={e => { e.stopPropagation(); setSelectedIdx(idx); }}
                        >
                          {/* Visual Feedback (Comment Tool) Overlay */}
                          <div className="absolute left-6 top-6 opacity-0 group-hover/section:opacity-100 transition-all z-50 pointer-events-none">
                            <div className="pointer-events-auto">
                              {feedbackIndex === idx ? (
                                <div className="bg-white p-3 rounded-[1.5rem] shadow-2xl border border-primary/20 flex flex-col gap-2 w-64 animate-scale-in origin-top-left">
                                  <textarea 
                                    autoFocus
                                    className="atrium-input text-[10px] min-h-[60px] resize-none"
                                    placeholder="e.g. 'Make this headline bigger'..."
                                    value={feedbackText}
                                    onChange={e => setFeedbackText(e.target.value)}
                                  />
                                  <div className="flex gap-1.5">
                                    <button 
                                      disabled={isRefining || !feedbackText}
                                      onClick={() => handleRefineSection(idx)}
                                      className="flex-1 py-1.5 rounded-lg bg-primary text-[9px] font-bold text-on-primary shadow-lg shadow-primary/20"
                                    >
                                      {isRefining ? 'Refining...' : 'Update Section'}
                                    </button>
                                    <button 
                                      onClick={() => setFeedbackIndex(null)}
                                      className="px-3 py-1.5 rounded-lg border border-slate-100 text-[9px] font-bold text-slate-400"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setFeedbackIndex(idx); }}
                                  className="h-10 w-10 rounded-full bg-white shadow-xl border border-slate-100 flex items-center justify-center text-primary hover:scale-110 active:scale-95 transition-all"
                                >
                                  <Icon name="chat_bubble_outline" className="text-sm" />
                                </button>
                              )}
                            </div>
                          </div>

                      {section.type === 'hero' && (
                        <div className={`py-24 px-12 border-b border-black/5 ${section.layout === 'centered' ? 'text-center' : section.layout === 'split' ? 'flex flex-col md:flex-row items-center gap-12' : 'text-left'}`}>
                          <div className={section.layout === 'split' ? 'flex-1' : 'w-full'}>
                            <EditableText tagName="h1" className={`text-5xl font-extrabold mb-6 ${section.layout === 'centered' ? 'mx-auto max-w-3xl' : ''}`} style={{ color: form.theme.primaryColor }} value={section.title} onChange={val => { const next = [...form.sections]; next[idx] = { ...next[idx], title: val }; setForm({ ...form, sections: next }); }} />
                            <EditableText tagName="p" className={`text-xl opacity-70 leading-relaxed mb-10 ${section.layout === 'centered' ? 'max-w-2xl mx-auto' : 'max-w-xl'}`} value={section.subtitle} onChange={val => { const next = [...form.sections]; next[idx] = { ...next[idx], subtitle: val }; setForm({ ...form, sections: next }); }} />
                            {section.cta && (
                              <EditableText tagName="button" className={`px-10 py-5 rounded-2xl font-extrabold text-lg shadow-xl text-white ${section.layout === 'centered' ? 'mx-auto block' : ''}`} style={{ backgroundColor: form.theme.primaryColor }} value={section.cta} onChange={val => { const next = [...form.sections]; next[idx] = { ...next[idx], cta: val }; setForm({ ...form, sections: next }); }} />
                            )}
                          </div>
                          {section.layout === 'split' && (
                            <div className="flex-1 h-64 rounded-3xl bg-primary/10 flex items-center justify-center">
                              <Icon name="image" className="text-5xl text-primary/30" />
                            </div>
                          )}
                        </div>
                      )}

                      {section.type === 'features' && (
                        <div className="py-24 px-12 bg-slate-50/50 border-b border-black/5">
                          <div className={section.layout === 'centered' ? 'max-w-2xl mx-auto' : 'grid grid-cols-1 md:grid-cols-3 gap-10'}>
                            {(section.items || []).map((item: any, i: number) => (
                              <div key={i} className={section.layout === 'centered' ? 'flex items-start gap-6 mb-8' : 'p-8 rounded-[2.5rem] bg-white shadow-sm border border-slate-100'}>
                                <div className="text-4xl mb-4 flex-shrink-0">{item.icon}</div>
                                <div>
                                  <p className="font-extrabold text-lg mb-2">{item.title}</p>
                                  <p className="opacity-60 text-sm leading-relaxed">{item.text}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {section.type === 'pricing' && (
                        <div className="py-20 px-12 bg-slate-50">
                          <h2 className="text-3xl font-extrabold text-center mb-12">{section.title}</h2>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                            {(section.plans || []).map((plan: any, i: number) => (
                              <div key={i} className={`p-8 rounded-[2.5rem] border relative ${plan.featured ? 'bg-white border-primary shadow-2xl scale-105' : 'bg-white border-slate-100 shadow-sm'}`}>
                                {plan.featured && <span className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-on-primary text-[10px] font-bold uppercase rounded-full">Most Popular</span>}
                                <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                                <div className="text-4xl font-extrabold mb-6" style={{ color: form.theme.primaryColor }}>{plan.price}<span className="text-sm font-normal opacity-40 ml-1">/mo</span></div>
                                <ul className="space-y-4 mb-8">{(plan.features || []).map((f: any, j: number) => <li key={j} className="flex items-center gap-2 text-sm opacity-70"><Icon name="check_circle" className="text-primary text-lg" /> {f}</li>)}</ul>
                                <button className="w-full py-4 rounded-2xl font-bold" style={{ backgroundColor: plan.featured ? form.theme.primaryColor : '#f1f5f9', color: plan.featured ? '#fff' : '#475569' }}>Get Started</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {section.type === 'testimonials' && (
                        <div className="py-24 px-12 text-center bg-white border-y border-black/5">
                          <h2 className="text-4xl font-extrabold mb-20">{section.title}</h2>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            {(section.items || []).map((item: any, i: number) => (
                              <div key={i} className="text-left p-12 rounded-[3.5rem] bg-slate-50/50 border border-slate-100">
                                <div className="flex gap-1 mb-8">{[1,2,3,4,5].map(s => <Icon key={s} name="star" className="text-amber-400 text-xl" />)}</div>
                                <p className="text-2xl italic font-medium opacity-80 leading-relaxed mb-10">"{item.quote}"</p>
                                <div className="flex items-center gap-5">
                                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center font-bold text-primary text-xl">{item.name[0]}</div>
                                  <div>
                                    <p className="font-bold text-base">{item.name}</p>
                                    <p className="text-xs font-medium opacity-40 uppercase tracking-widest">{item.role}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {section.type === 'faq' && (
                        <div className="py-24 px-12 bg-slate-50/30">
                          <div className="max-w-3xl mx-auto">
                            <h2 className="text-3xl font-extrabold mb-12 text-center">{section.title || 'FAQ'}</h2>
                            <div className="space-y-4">
                              {(section.items || []).map((item: any, i: number) => (
                                <div key={i} className="p-8 rounded-3xl bg-white border border-slate-100 shadow-sm">
                                  <p className="font-bold mb-3">{item.q}</p>
                                  <p className="opacity-60 text-sm leading-relaxed">{item.a}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {section.type === 'form' && (
                        <div className="py-24 px-12 flex justify-center border-b border-black/5">
                          <div className="w-full max-w-md p-12 rounded-[3rem] shadow-2xl border border-slate-100 relative overflow-hidden">
                            <div className="absolute -top-6 -right-6 h-20 w-20 bg-primary/10 rounded-full blur-2xl" />
                            <h2 className="text-3xl font-extrabold mb-4">{section.title}</h2>
                            <p className="text-base opacity-60 mb-10">{section.subtitle}</p>
                            <div className="space-y-5">
                              {(section.fields || []).map((f: any, i: number) => (
                                <div key={i}>
                                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 ml-1">{f.label}</label>
                                  <div className="w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl px-5 flex items-center text-slate-300 text-sm italic">{f.placeholder}</div>
                                </div>
                              ))}
                            </div>
                            <button className="w-full py-5 mt-10 rounded-2xl font-extrabold text-lg text-white shadow-xl" style={{ backgroundColor: form.theme.primaryColor }}>Continue</button>
                          </div>
                        </div>
                      )}

                      {section.type === 'events' && (
                        <div className="py-24 px-12 bg-white">
                          <div className="max-w-5xl mx-auto">
                            <div className="flex items-end justify-between mb-12">
                              <div className="text-left">
                                <h2 className="text-4xl font-extrabold mb-4">{section.title}</h2>
                                <p className="text-lg opacity-60">{section.subtitle}</p>
                              </div>
                              <button className="px-8 py-3 rounded-2xl bg-primary/10 text-primary font-bold text-sm">View Calendar</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              {(section.items || []).map((item: any, i: number) => (
                                <div key={i} className="flex gap-6 p-8 rounded-[2.5rem] bg-slate-50 border border-slate-100 group hover:bg-white hover:shadow-2xl transition-all">
                                  <div className="h-16 w-16 rounded-2xl bg-white shadow-sm flex flex-col items-center justify-center border border-slate-100">
                                    <span className="text-[10px] font-bold uppercase text-primary">OCT</span>
                                    <span className="text-xl font-extrabold">24</span>
                                  </div>
                                  <div>
                                    <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors">{item.title}</h3>
                                    <p className="text-sm opacity-60 leading-relaxed mb-4">{item.text}</p>
                                    <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                      <span><Icon name="schedule" className="text-xs mr-1" /> 10:00 AM</span>
                                      <span><Icon name="location_on" className="text-xs mr-1" /> Virtual</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {section.type === 'logos' && (
                        <div className="py-16 border-y border-black/5 bg-slate-50/20">
                          <div className="max-w-5xl mx-auto px-12">
                            <p className="text-center text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-12">{section.title || 'Powering World-Class Teams'}</p>
                            <div className="flex flex-wrap items-center justify-center gap-x-16 gap-y-10 opacity-30 grayscale">
                              {(section.logos || []).map((logo: string, i: number) => (
                                <span key={i} className="text-2xl font-black text-slate-900 tracking-tighter">{logo}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {section.type === 'stats' && (
                        <div className="py-24 px-12 bg-white">
                          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-16 text-center">
                            {(section.items || []).map((item: any, i: number) => (
                              <div key={i}>
                                <div className="text-5xl font-black mb-3 tracking-tighter" style={{ color: form.theme.primaryColor }}>{item.value || '0'}</div>
                                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{item.label || 'Metric'}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {section.type === 'cta_banner' && (
                        <div className="py-24 px-12">
                          <div className="max-w-4xl mx-auto rounded-[3rem] p-16 text-center shadow-2xl relative overflow-hidden" style={{ backgroundColor: form.theme.primaryColor, color: 'white' }}>
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[80px] -mr-32 -mt-32" />
                            <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full blur-[60px] -ml-24 -mb-24" />
                            <h2 className="text-4xl font-black mb-6 relative z-10">{section.title}</h2>
                            <p className="text-xl mb-10 opacity-90 max-w-2xl mx-auto relative z-10 leading-relaxed">{section.subtitle}</p>
                            <button className="bg-white text-slate-950 px-10 py-4 rounded-2xl font-black text-lg shadow-2xl relative z-10">{section.cta}</button>
                          </div>
                        </div>
                      )}

                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
</>
);
}
