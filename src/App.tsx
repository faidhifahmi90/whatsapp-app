import { FormEvent, useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { api, ApiError } from "./api";
import type { Automation, BootstrapData, Campaign, Template } from "./types";

type LoginForm = {
  email: string;
  password: string;
};

const navItems = [
  { to: "/inbox", label: "Inbox" },
  { to: "/contacts", label: "Contacts" },
  { to: "/campaigns", label: "Campaigns" },
  { to: "/templates", label: "Templates" },
  { to: "/automations", label: "Automations" },
  { to: "/settings", label: "Settings" }
];

export default function App() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  async function login(form: LoginForm) {
    await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(form)
    });
    await refreshData();
  }

  async function logout() {
    await api("/api/auth/logout", {
      method: "POST"
    });
    setData(null);
  }

  if (loading) {
    return <div className="screen-center">Loading dashboard…</div>;
  }

  if (!data) {
    return <LoginPage onLogin={login} error={error} />;
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

function LoginPage(props: { onLogin: (form: LoginForm) => Promise<void>; error: string | null }) {
  const [form, setForm] = useState<LoginForm>({
    email: "admin@example.com",
    password: "admin123"
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(props.error);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      await props.onLogin(form);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <p className="eyebrow">Shared WhatsApp Command Center</p>
        <h1>Run realtime sales and support conversations from one place.</h1>
        <p className="muted">
          Multi-user inbox, contact segments, batch campaigns, workflow automation, and Twilio WhatsApp integrations.
        </p>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            />
          </label>
          {error ? <div className="status error">{error}</div> : null}
          <button className="primary-button" disabled={submitting} type="submit">
            {submitting ? "Signing in…" : "Enter dashboard"}
          </button>
        </form>
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

  async function openConversation(contactId: string, channelId: string, templateId?: string) {
    const result = await api<{ conversationId: string }>("/api/conversations/open", {
      method: "POST",
      body: JSON.stringify({ contactId, channelId, templateId })
    });
    props.onSelectConversation(result.conversationId);
    await props.onRefresh(result.conversationId);
    navigate("/inbox");
  }

  const stats = props.data.stats;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">WhatsApp Center</p>
          <h2>Shared dashboard</h2>
          <p className="muted small">Every logged-in teammate sees the same inbox, channels, templates, and settings.</p>
        </div>
        <nav className="nav-list">
          {navItems.map((item) => (
            <NavLink
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              key={item.to}
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button className="ghost-button" onClick={() => void props.onLogout()}>
          Log out
        </button>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <h1>Realtime conversational operations</h1>
            <p className="muted">Twilio-powered WhatsApp inbox with campaigns, templates, contacts, and automations.</p>
          </div>
          <div className="stat-row">
            <StatCard label="Unread" value={String(stats.unreadCount)} />
            <StatCard label="Contacts" value={String(stats.contactCount)} />
            <StatCard label="Conversations" value={String(stats.conversationCount)} />
            <StatCard label="Templates" value={String(stats.templateCount)} />
          </div>
        </header>

        {props.error ? <div className="status error">{props.error}</div> : null}

        <Routes>
          <Route
            path="/inbox"
            element={
              <InboxPage
                data={props.data}
                selectedConversationId={props.selectedConversationId}
                onRefresh={props.onRefresh}
                onSelectConversation={props.onSelectConversation}
              />
            }
          />
          <Route
            path="/contacts"
            element={<ContactsPage data={props.data} onOpenConversation={openConversation} onRefresh={props.onRefresh} />}
          />
          <Route
            path="/campaigns"
            element={<CampaignsPage data={props.data} onRefresh={props.onRefresh} />}
          />
          <Route
            path="/templates"
            element={<TemplatesPage data={props.data} onRefresh={props.onRefresh} />}
          />
          <Route
            path="/automations"
            element={<AutomationsPage data={props.data} onRefresh={props.onRefresh} />}
          />
          <Route
            path="/settings"
            element={<SettingsPage data={props.data} onRefresh={props.onRefresh} />}
          />
          <Route path="*" element={<Navigate to="/inbox" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function InboxPage(props: {
  data: BootstrapData;
  selectedConversationId: string | null;
  onRefresh: (preferredConversationId?: string | null) => Promise<void>;
  onSelectConversation: (id: string | null) => void;
}) {
  const [messageBody, setMessageBody] = useState("");
  const [templateId, setTemplateId] = useState(props.data.templates[0]?.id ?? "");
  const [channelId, setChannelId] = useState(props.data.channels[0]?.id ?? "");
  const selectedConversation =
    props.data.conversations.find((conversation) => conversation.id === props.selectedConversationId) ??
    props.data.conversations[0];

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

  async function sendTemplate() {
    if (!selectedConversation || !templateId) {
      return;
    }
    await api("/api/messages/send", {
      method: "POST",
      body: JSON.stringify({
        conversationId: selectedConversation.id,
        contactId: selectedConversation.contactId,
        channelId,
        templateId
      })
    });
    await props.onRefresh(selectedConversation.id);
  }

  const chosenTemplate = props.data.templates.find((template) => template.id === templateId);

  return (
    <section className="inbox-layout">
      <div className="panel conversation-list">
        <SectionHeader
          title="Conversations"
          subtitle="Two-way realtime inbox with contact context, labels, and channel switching."
        />
        {props.data.conversations.map((conversation) => {
          const latest = conversation.messages[conversation.messages.length - 1];
          return (
            <button
              className={conversation.id === selectedConversation?.id ? "conversation-card active" : "conversation-card"}
              key={conversation.id}
              onClick={() => props.onSelectConversation(conversation.id)}
            >
              <div className="space-between">
                <strong>
                  {conversation.contact.firstName} {conversation.contact.lastName}
                </strong>
                <span className="small muted">{conversation.channel.name}</span>
              </div>
              <p className="muted">{latest?.body ?? "No messages yet"}</p>
              <div className="chip-row">
                {conversation.contact.labels.map((label) => (
                  <span className="chip" key={label}>
                    {label}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="panel thread-panel">
        <SectionHeader
          title={selectedConversation ? `${selectedConversation.contact.firstName} ${selectedConversation.contact.lastName}` : "Inbox"}
          subtitle={selectedConversation ? selectedConversation.contact.phone : "Select a conversation to start messaging."}
        />
        <div className="messages-scroller">
          {selectedConversation?.messages.map((message) => (
            <div className={message.direction === "outbound" ? "message-bubble outbound" : "message-bubble inbound"} key={message.id}>
              <div className="space-between">
                <span>{message.direction === "outbound" ? "You" : "Contact"}</span>
                <span className="small muted">{new Date(message.createdAt).toLocaleString()}</span>
              </div>
              <p>{message.body}</p>
              {message.mediaUrl ? (
                <a href={message.mediaUrl} rel="noreferrer" target="_blank">
                  View media
                </a>
              ) : null}
              <span className="small muted">Status: {message.status}</span>
            </div>
          ))}
        </div>
        <div className="composer">
          <label>
            Send from number
            <select value={channelId} onChange={(event) => setChannelId(event.target.value)}>
              {props.data.channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name} · {channel.whatsappNumber}
                </option>
              ))}
            </select>
          </label>
          <label>
            Quick template
            <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
              {props.data.templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          {chosenTemplate ? (
            <div className="template-preview">
              <strong>{chosenTemplate.name}</strong>
              <p>{chosenTemplate.body}</p>
              <div className="chip-row">
                {chosenTemplate.placeholders.map((placeholder) => (
                  <span className="chip" key={placeholder}>
                    {placeholder}
                  </span>
                ))}
              </div>
              {chosenTemplate.ctaLabel && chosenTemplate.ctaUrl ? (
                <a href={chosenTemplate.ctaUrl} rel="noreferrer" target="_blank">
                  {chosenTemplate.ctaLabel}
                </a>
              ) : null}
              <button className="secondary-button" onClick={() => void sendTemplate()}>
                Send template
              </button>
            </div>
          ) : null}
          <textarea
            placeholder="Write a realtime reply…"
            rows={5}
            value={messageBody}
            onChange={(event) => setMessageBody(event.target.value)}
          />
          <button className="primary-button" onClick={() => void sendManualReply()}>
            Send reply
          </button>
        </div>
      </div>

      <div className="panel details-panel">
        <SectionHeader title="Contact profile" subtitle="Labels, segments, custom fields, and quick campaign context." />
        {selectedConversation ? (
          <>
            <dl className="details-list">
              <div>
                <dt>Company</dt>
                <dd>{selectedConversation.contact.company || "—"}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{selectedConversation.contact.email || "—"}</dd>
              </div>
              <div>
                <dt>Segments</dt>
                <dd className="chip-row">
                  {selectedConversation.contact.segmentIds.map((segmentId) => {
                    const segment = props.data.segments.find((item) => item.id === segmentId);
                    return (
                      <span className="chip" key={segmentId}>
                        {segment?.name ?? segmentId}
                      </span>
                    );
                  })}
                </dd>
              </div>
              <div>
                <dt>Labels</dt>
                <dd className="chip-row">
                  {selectedConversation.contact.labels.map((label) => (
                    <span className="chip" key={label}>
                      {label}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
            <div className="field-stack">
              <h3>Custom fields</h3>
              {Object.entries(selectedConversation.contact.customFields).map(([key, value]) => (
                <div className="space-between line-item" key={key}>
                  <span>{key}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="muted">No conversation selected.</p>
        )}
      </div>
    </section>
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
        ...form,
        labels: form.labels.split(",").map((label) => label.trim()).filter(Boolean),
        customFields,
        segmentIds: selectedSegments
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

  return (
    <div className="page-grid two-column">
      <div className="panel">
        <SectionHeader title="Add contact" subtitle="Add a single contact with custom fields, labels, and segment membership." />
        <form className="form-grid" onSubmit={saveContact}>
          <div className="split-grid">
            <label>
              First name
              <input value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} />
            </label>
            <label>
              Last name
              <input value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} />
            </label>
          </div>
          <label>
            Phone
            <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
          </label>
          <label>
            Email
            <input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          </label>
          <label>
            Company
            <input value={form.company} onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))} />
          </label>
          <label>
            Labels
            <input value={form.labels} onChange={(event) => setForm((current) => ({ ...current, labels: event.target.value }))} placeholder="vip, retail" />
          </label>
          <label>
            Custom fields
            <textarea
              rows={5}
              value={form.customFields}
              onChange={(event) => setForm((current) => ({ ...current, customFields: event.target.value }))}
              placeholder={"city: Kuala Lumpur\nproduct: Premium Plan"}
            />
          </label>
          <label>
            Segment update mode
            <select value={form.segmentMode} onChange={(event) => setForm((current) => ({ ...current, segmentMode: event.target.value }))}>
              <option value="replace">Replace</option>
              <option value="add">Add</option>
              <option value="remove">Remove</option>
            </select>
          </label>
          <SegmentSelector segments={props.data.segments} selected={selectedSegments} onChange={setSelectedSegments} />
          <button className="primary-button" type="submit">
            Save contact
          </button>
        </form>
      </div>

      <div className="panel">
        <SectionHeader title="Bulk CSV upload" subtitle="Import contacts in bulk and update one or more segments during import." />
        <form className="form-grid" onSubmit={importCsv}>
          <label>
            CSV file
            <input accept=".csv" onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)} type="file" />
          </label>
          <p className="muted small">Expected columns: firstName, lastName, phone, email, company, labels plus any custom field columns.</p>
          <button className="secondary-button" type="submit">
            Upload contacts
          </button>
        </form>

        <div className="stack-list">
          {props.data.contacts.map((contact) => (
            <div className="contact-row" key={contact.id}>
              <div>
                <strong>
                  {contact.firstName} {contact.lastName}
                </strong>
                <p className="muted">
                  {contact.phone} · {contact.company || "No company"}
                </p>
                <div className="chip-row">
                  {contact.segmentIds.map((segmentId) => {
                    const segment = props.data.segments.find((item) => item.id === segmentId);
                    return (
                      <span className="chip" key={segmentId}>
                        {segment?.name ?? segmentId}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="button-column">
                <button
                  className="ghost-button"
                  onClick={() => void props.onOpenConversation(contact.id, props.data.channels[0]?.id ?? "", props.data.templates[0]?.id)}
                >
                  New template chat
                </button>
                <button className="ghost-button" onClick={() => void props.onOpenConversation(contact.id, props.data.channels[0]?.id ?? "")}>
                  Open inbox
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TemplatesPage(props: { data: BootstrapData; onRefresh: (preferredConversationId?: string | null) => Promise<void> }) {
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

  async function saveTemplate(event: FormEvent) {
    event.preventDefault();
    await api("/api/templates", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        placeholders: form.placeholders
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      })
    });
    setForm({
      name: "",
      category: "utility",
      body: "",
      placeholders: "",
      mediaUrl: "",
      ctaLabel: "",
      ctaUrl: ""
    });
    await props.onRefresh();
  }

  async function syncTemplate(template: Template) {
    const result = await api<{ sid: string | null; synced: boolean; reason?: string }>(`/api/templates/${template.id}/sync`, {
      method: "POST"
    });
    setStatus(result.synced ? `${template.name} synced to Twilio Content API: ${result.sid}` : result.reason ?? "Sync failed");
    await props.onRefresh();
  }

  return (
    <div className="page-grid two-column">
      <div className="panel">
        <SectionHeader title="Message template builder" subtitle="Create placeholder-driven templates with media and CTA preview." />
        <form className="form-grid" onSubmit={saveTemplate}>
          <label>
            Template name
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            Category
            <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
              <option value="utility">Utility</option>
              <option value="marketing">Marketing</option>
              <option value="authentication">Authentication</option>
            </select>
          </label>
          <label>
            Body
            <textarea rows={7} value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} />
          </label>
          <label>
            Placeholders
            <input
              value={form.placeholders}
              onChange={(event) => setForm((current) => ({ ...current, placeholders: event.target.value }))}
              placeholder="first_name, company, product"
            />
          </label>
          <label>
            Media URL
            <input value={form.mediaUrl} onChange={(event) => setForm((current) => ({ ...current, mediaUrl: event.target.value }))} />
          </label>
          <div className="split-grid">
            <label>
              CTA label
              <input value={form.ctaLabel} onChange={(event) => setForm((current) => ({ ...current, ctaLabel: event.target.value }))} />
            </label>
            <label>
              CTA URL
              <input value={form.ctaUrl} onChange={(event) => setForm((current) => ({ ...current, ctaUrl: event.target.value }))} />
            </label>
          </div>
          <button className="primary-button" type="submit">
            Save template
          </button>
          {status ? <div className="status success">{status}</div> : null}
        </form>
      </div>
      <div className="stack-list">
        {props.data.templates.map((template) => (
          <div className="panel" key={template.id}>
            <SectionHeader title={template.name} subtitle={`${template.category} template`} />
            <div className="template-preview">
              <p>{template.body}</p>
              <div className="chip-row">
                {template.placeholders.map((placeholder) => (
                  <span className="chip" key={placeholder}>
                    {placeholder}
                  </span>
                ))}
              </div>
              {template.mediaUrl ? <img alt={template.name} className="template-image" src={template.mediaUrl} /> : null}
              {template.ctaLabel && template.ctaUrl ? (
                <a href={template.ctaUrl} rel="noreferrer" target="_blank">
                  {template.ctaLabel}
                </a>
              ) : null}
              <div className="space-between">
                <span className="small muted">
                  {template.twilioContentSid ? `Twilio Content SID: ${template.twilioContentSid}` : "Not synced to Content API yet"}
                </span>
                <button className="secondary-button" onClick={() => void syncTemplate(template)}>
                  Sync to Twilio
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CampaignsPage(props: { data: BootstrapData; onRefresh: (preferredConversationId?: string | null) => Promise<void> }) {
  const [name, setName] = useState("VIP Broadcast");
  const [templateId, setTemplateId] = useState(props.data.templates[0]?.id ?? "");
  const [channelId, setChannelId] = useState(props.data.channels[0]?.id ?? "");
  const [recipientMode, setRecipientMode] = useState<Campaign["recipientMode"]>("segments");
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const recipientOptions =
    recipientMode === "contacts"
      ? props.data.contacts.map((contact) => ({ id: contact.id, label: `${contact.firstName} ${contact.lastName}` }))
      : props.data.segments.map((segment) => ({ id: segment.id, label: segment.name }));

  useEffect(() => {
    setRecipientIds([]);
  }, [recipientMode]);

  async function submitCampaign(event: FormEvent) {
    event.preventDefault();
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
    setScheduledAt("");
    await props.onRefresh();
  }

  return (
    <div className="page-grid two-column">
      <div className="panel">
        <SectionHeader title="Simplified bulk messaging" subtitle="Pick segments or specific contacts and send now or schedule later." />
        <form className="form-grid" onSubmit={submitCampaign}>
          <label>
            Campaign name
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Template
            <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
              {props.data.templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Channel
            <select value={channelId} onChange={(event) => setChannelId(event.target.value)}>
              {props.data.channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Target mode
            <select value={recipientMode} onChange={(event) => setRecipientMode(event.target.value as Campaign["recipientMode"])}>
              <option value="segments">Segments</option>
              <option value="contacts">Contacts</option>
            </select>
          </label>
          <MultiSelect options={recipientOptions} selected={recipientIds} onChange={setRecipientIds} />
          <label>
            Schedule time
            <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
          </label>
          <button className="primary-button" type="submit">
            {scheduledAt ? "Queue campaign" : "Send campaign"}
          </button>
        </form>
      </div>
      <div className="stack-list">
        {props.data.campaigns.map((campaign) => (
          <div className="panel" key={campaign.id}>
            <SectionHeader title={campaign.name} subtitle={`${campaign.status.toUpperCase()} campaign`} />
            <div className="space-between line-item">
              <span>Template</span>
              <strong>{props.data.templates.find((template) => template.id === campaign.templateId)?.name ?? campaign.templateId}</strong>
            </div>
            <div className="space-between line-item">
              <span>Recipients</span>
              <strong>{campaign.recipientIds.length}</strong>
            </div>
            <div className="space-between line-item">
              <span>Attempted / Delivered / Failed</span>
              <strong>
                {campaign.stats.attempted} / {campaign.stats.delivered} / {campaign.stats.failed}
              </strong>
            </div>
            <p className="muted">{campaign.scheduledAt ? `Scheduled for ${campaign.scheduledAt}` : "Sent immediately from the dashboard."}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AutomationsPage(props: { data: BootstrapData; onRefresh: (preferredConversationId?: string | null) => Promise<void> }) {
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
    <div className="page-grid two-column">
      <div className="panel">
        <SectionHeader title="Workflows and automations" subtitle="Run template-based actions for new contacts, joined segments, or keyword triggers." />
        <form className="form-grid" onSubmit={saveAutomation}>
          <label>
            Workflow name
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            Trigger
            <select value={form.triggerType} onChange={(event) => setForm((current) => ({ ...current, triggerType: event.target.value }))}>
              <option value="incoming_keyword">Incoming keyword</option>
              <option value="new_contact">New contact</option>
              <option value="segment_joined">Segment joined</option>
            </select>
          </label>
          {form.triggerType === "incoming_keyword" ? (
            <label>
              Keyword
              <input value={form.triggerValue} onChange={(event) => setForm((current) => ({ ...current, triggerValue: event.target.value }))} />
            </label>
          ) : null}
          {form.triggerType === "segment_joined" ? (
            <label>
              Segment
              <select value={form.segmentId} onChange={(event) => setForm((current) => ({ ...current, segmentId: event.target.value }))}>
                {props.data.segments.map((segment) => (
                  <option key={segment.id} value={segment.id}>
                    {segment.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            Template
            <select value={form.templateId} onChange={(event) => setForm((current) => ({ ...current, templateId: event.target.value }))}>
              {props.data.templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Channel
            <select value={form.channelId} onChange={(event) => setForm((current) => ({ ...current, channelId: event.target.value }))}>
              {props.data.channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Delay minutes
            <input value={form.delayMinutes} onChange={(event) => setForm((current) => ({ ...current, delayMinutes: event.target.value }))} />
          </label>
          <button className="primary-button" type="submit">
            Save automation
          </button>
        </form>
      </div>
      <div className="stack-list">
        {props.data.automations.map((automation: Automation) => (
          <div className="panel" key={automation.id}>
            <SectionHeader title={automation.name} subtitle={automation.isActive ? "Active workflow" : "Paused workflow"} />
            <p className="muted">
              Trigger: {automation.triggerType}
              {automation.triggerValue ? ` · ${automation.triggerValue}` : ""}
            </p>
            <div className="space-between line-item">
              <span>Template</span>
              <strong>{props.data.templates.find((template) => template.id === automation.templateId)?.name ?? automation.templateId}</strong>
            </div>
            <div className="space-between line-item">
              <span>Channel</span>
              <strong>{props.data.channels.find((channel) => channel.id === automation.channelId)?.name ?? automation.channelId}</strong>
            </div>
            <div className="space-between line-item">
              <span>Delay</span>
              <strong>{automation.delayMinutes} minutes</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsPage(props: { data: BootstrapData; onRefresh: (preferredConversationId?: string | null) => Promise<void> }) {
  const [channelForm, setChannelForm] = useState({
    name: "",
    whatsappNumber: "",
    messagingServiceSid: ""
  });
  const [segmentForm, setSegmentForm] = useState({
    name: "",
    color: "#ff9966"
  });
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "agent"
  });

  async function addChannel(event: FormEvent) {
    event.preventDefault();
    await api("/api/channels", {
      method: "POST",
      body: JSON.stringify(channelForm)
    });
    setChannelForm({ name: "", whatsappNumber: "", messagingServiceSid: "" });
    await props.onRefresh();
  }

  async function addSegment(event: FormEvent) {
    event.preventDefault();
    await api("/api/segments", {
      method: "POST",
      body: JSON.stringify(segmentForm)
    });
    setSegmentForm({ name: "", color: "#ff9966" });
    await props.onRefresh();
  }

  async function addUser(event: FormEvent) {
    event.preventDefault();
    await api("/api/users", {
      method: "POST",
      body: JSON.stringify(userForm)
    });
    setUserForm({ name: "", email: "", password: "", role: "agent" });
    await props.onRefresh();
  }

  return (
    <div className="page-grid three-column">
      <div className="panel">
        <SectionHeader title="WhatsApp numbers" subtitle="Add multiple Twilio-connected WhatsApp senders and toggle them in the inbox." />
        <form className="form-grid" onSubmit={addChannel}>
          <label>
            Channel name
            <input value={channelForm.name} onChange={(event) => setChannelForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            WhatsApp number
            <input
              value={channelForm.whatsappNumber}
              onChange={(event) => setChannelForm((current) => ({ ...current, whatsappNumber: event.target.value }))}
              placeholder="whatsapp:+14155238886"
            />
          </label>
          <label>
            Messaging Service SID
            <input
              value={channelForm.messagingServiceSid}
              onChange={(event) => setChannelForm((current) => ({ ...current, messagingServiceSid: event.target.value }))}
            />
          </label>
          <button className="primary-button" type="submit">
            Add number
          </button>
        </form>
        <div className="stack-list compact">
          {props.data.channels.map((channel) => (
            <div className="line-item" key={channel.id}>
              <strong>{channel.name}</strong>
              <span className="muted">{channel.whatsappNumber}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <SectionHeader title="Shared settings" subtitle="Segments and teammates affect the same dashboard for every logged-in user." />
        <form className="form-grid" onSubmit={addSegment}>
          <label>
            Segment name
            <input value={segmentForm.name} onChange={(event) => setSegmentForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            Color
            <input type="color" value={segmentForm.color} onChange={(event) => setSegmentForm((current) => ({ ...current, color: event.target.value }))} />
          </label>
          <button className="secondary-button" type="submit">
            Add segment
          </button>
        </form>
        <div className="stack-list compact">
          {props.data.segments.map((segment) => (
            <div className="line-item" key={segment.id}>
              <span className="chip" style={{ background: `${segment.color}22`, borderColor: segment.color }}>
                {segment.name}
              </span>
              <span className="muted">{segment.color}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <SectionHeader title="User access" subtitle="Create multiple logins that all share the same data, channels, and interface." />
        <form className="form-grid" onSubmit={addUser}>
          <label>
            Name
            <input value={userForm.name} onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            Email
            <input value={userForm.email} onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))} />
          </label>
          <label>
            Password
            <input type="password" value={userForm.password} onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))} />
          </label>
          <label>
            Role
            <select value={userForm.role} onChange={(event) => setUserForm((current) => ({ ...current, role: event.target.value }))}>
              <option value="agent">Agent</option>
              <option value="owner">Owner</option>
            </select>
          </label>
          <button className="primary-button" type="submit">
            Add user
          </button>
        </form>
        <div className="stack-list compact">
          {props.data.users.map((user) => (
            <div className="line-item" key={user.id}>
              <strong>{user.name}</strong>
              <span className="muted">
                {user.email} · {user.role}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionHeader(props: { title: string; subtitle: string }) {
  return (
    <div className="section-header">
      <h2>{props.title}</h2>
      <p className="muted">{props.subtitle}</p>
    </div>
  );
}

function StatCard(props: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function SegmentSelector(props: {
  segments: BootstrapData["segments"];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="selector-grid">
      {props.segments.map((segment) => {
        const active = props.selected.includes(segment.id);
        return (
          <button
            className={active ? "chip selectable active" : "chip selectable"}
            key={segment.id}
            onClick={(event) => {
              event.preventDefault();
              props.onChange(active ? props.selected.filter((id) => id !== segment.id) : [...props.selected, segment.id]);
            }}
            type="button"
          >
            {segment.name}
          </button>
        );
      })}
    </div>
  );
}

function MultiSelect(props: {
  options: Array<{ id: string; label: string }>;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="selector-grid">
      {props.options.map((option) => {
        const active = props.selected.includes(option.id);
        return (
          <button
            className={active ? "chip selectable active" : "chip selectable"}
            key={option.id}
            onClick={(event) => {
              event.preventDefault();
              props.onChange(active ? props.selected.filter((id) => id !== option.id) : [...props.selected, option.id]);
            }}
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
