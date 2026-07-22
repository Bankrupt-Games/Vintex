"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const API_URL = (process.env.NEXT_PUBLIC_VINTEX_API_URL ?? "http://127.0.0.1:5055").replace(/\/$/, "");

type User = { id: string; discordId: string; username: string; displayName: string; email?: string; avatarUrl?: string };
type Plan = { id: string; name: string; includedCredits: number; seatLimit: number; gameLimit: number; description: string };
type OrganizationSummary = { id: string; name: string; planName: string; role: string; creditsRemaining: number };
type Organization = {
  id: string; name: string; slug: string; role: string; plan: Plan;
  creditsIncluded: number; creditsUsed: number; creditsRemaining: number; purchasedCredits: number;
  periodStartsUtc: string; periodEndsUtc: string;
  members: { userId: string; displayName: string; username: string; avatarUrl?: string; role: string; joinedUtc: string }[];
  apiKeys: { id: string; name: string; lastFour: string; createdUtc: string; lastUsedUtc?: string }[];
  usage: { date: string; credits: number }[];
};
type DashboardData = { user: User; organizations: OrganizationSummary[]; activeOrganization: Organization };

async function request(path: string, init?: RequestInit) {
  return fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(init?.headers ?? {}) },
  });
}

function VintexMark() {
  return <span className="brand-mark" aria-hidden="true"><i /><i /></span>;
}

export default function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [status, setStatus] = useState<"loading" | "signed-out" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [revealedKey, setRevealedKey] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [busy, setBusy] = useState(false);

  const loadDashboard = useCallback(async (organizationId?: string) => {
    setStatus("loading");
    try {
      const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : "";
      const response = await request(`/api/account/dashboard${query}`);
      if (response.status === 401) { setStatus("signed-out"); return; }
      if (!response.ok) throw new Error("The Vintex backend is unavailable.");
      const nextData = await response.json() as DashboardData;
      setData(nextData);

      const invite = new URLSearchParams(window.location.search).get("invite");
      if (invite) {
        const accepted = await request(`/api/account/invites/${encodeURIComponent(invite)}/accept`, { method: "POST", body: "{}" });
        const payload = await accepted.json().catch(() => ({}));
        window.history.replaceState({}, "", "/dashboard");
        if (!accepted.ok) setMessage(payload.message ?? "That studio invite is no longer valid.");
        else {
          setMessage(`You joined ${payload.name}.`);
          const refreshed = await request(`/api/account/dashboard?organizationId=${encodeURIComponent(payload.id)}`);
          if (refreshed.ok) setData(await refreshed.json());
        }
      }
      setStatus("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load the dashboard.");
      setStatus("error");
    }
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const organization = data?.activeOrganization;
  const usedPercent = organization ? Math.min(100, Math.round((organization.creditsUsed / Math.max(1, organization.creditsIncluded)) * 100)) : 0;
  const maxUsage = useMemo(() => Math.max(1, ...(organization?.usage.map((item) => item.credits) ?? [1])), [organization]);
  const canManage = organization?.role === "owner" || organization?.role === "admin";

  async function rotateApiKey() {
    if (!organization || !canManage) return;
    setBusy(true); setMessage(""); setRevealedKey("");
    try {
      const response = await request(`/api/account/studios/${organization.id}/api-keys/rotate`, { method: "POST", body: JSON.stringify({ name: "Game server" }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Could not rotate the API key.");
      setRevealedKey(payload.apiKey);
      setMessage("New API key created. Copy it now; Vintex only stores its hash.");
      await loadDashboard(organization.id);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not rotate the API key."); }
    finally { setBusy(false); }
  }

  async function createInvite() {
    if (!organization || !canManage) return;
    setBusy(true); setMessage("");
    try {
      const response = await request(`/api/account/studios/${organization.id}/invites`, { method: "POST", body: JSON.stringify({ role: "developer" }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Could not create an invite.");
      const link = `${window.location.origin}/dashboard?invite=${payload.code}`;
      setInviteLink(link);
      setMessage("Developer invite created. It expires in seven days.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create an invite."); }
    finally { setBusy(false); }
  }

  async function logout() {
    await request("/api/auth/logout", { method: "POST", body: "{}" });
    setData(null); setStatus("signed-out");
  }

  const loginHref = typeof window === "undefined"
    ? `${API_URL}/api/auth/login`
    : `${API_URL}/api/auth/login?returnUrl=${encodeURIComponent(window.location.href)}`;

  if (status === "loading") return <div className="dash-state"><div className="dash-spinner" /><p>Loading Vintex workspace…</p></div>;

  if (status === "signed-out" || status === "error") {
    return (
      <main className="signin-page">
        <a className="brand signin-brand" href="/"><VintexMark /><span>vintex<span className="accent">.gg</span></span></a>
        <section className="signin-card">
          <div className="signin-icon"><VintexMark /></div>
          <div className="eyebrow">Protected workspace</div>
          <h1>Manage Vintex with Discord.</h1>
          <p>Sign in to view usage, manage studio access, and issue game-server credentials.</p>
          {status === "error" && <div className="dash-alert error">{message}</div>}
          <a className="discord-button" href={loginHref}><span aria-hidden="true">◉</span> Continue with Discord</a>
          {API_URL.includes("127.0.0.1") && <a className="dev-login" href={`${API_URL}/api/auth/dev-login?returnUrl=${encodeURIComponent(typeof window === "undefined" ? "http://localhost:3000/dashboard" : window.location.href)}`}>Use local development account</a>}
          <small>Vintex requests your basic Discord identity and email only.</small>
        </section>
        <a className="signin-back" href="/">← Back to vintex.gg</a>
      </main>
    );
  }

  if (!data || !organization) return null;

  return (
    <main className="dashboard-shell">
      <aside className="dash-sidebar">
        <a className="brand" href="/"><VintexMark /><span>vintex<span className="accent">.gg</span></span></a>
        <nav className="dash-nav" aria-label="Dashboard navigation">
          <a className="active" href="#overview"><span>⌁</span> Overview</a>
          <a href="#usage"><span>↗</span> Usage</a>
          <a href="#credentials"><span>⌘</span> API access</a>
          <a href="#members"><span>◎</span> Members</a>
        </nav>
        <div className="sidebar-plan">
          <div><span className="live-dot" /> {organization.plan.name} plan</div>
          <strong>{organization.creditsRemaining.toLocaleString()}</strong>
          <small>credits remaining</small>
          <div className="mini-progress"><i style={{ width: `${100 - usedPercent}%` }} /></div>
        </div>
        <a className="sidebar-home" href="/">← Marketing site</a>
      </aside>

      <section className="dash-main">
        <header className="dash-topbar">
          <select aria-label="Active studio" value={organization.id} onChange={(event) => void loadDashboard(event.target.value)}>
            {data.organizations.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
          <div className="dash-user">
            {data.user.avatarUrl ? <img src={data.user.avatarUrl} alt="" /> : <span>{data.user.displayName.slice(0, 1).toUpperCase()}</span>}
            <div><b>{data.user.displayName}</b><small>@{data.user.username}</small></div>
            <button type="button" onClick={() => void logout()}>Sign out</button>
          </div>
        </header>

        <div className="dash-content" id="overview">
          <div className="dash-heading">
            <div><div className="eyebrow">Workspace overview</div><h1>{organization.name}</h1><p>Monitor protection usage and manage access for your team.</p></div>
            <span className="status-pill"><i /> All systems operational</span>
          </div>

          {message && <div className="dash-alert">{message}</div>}

          <div className="metric-grid">
            <article><span>Credits remaining</span><strong>{organization.creditsRemaining.toLocaleString()}</strong><small>of {organization.creditsIncluded.toLocaleString()} included</small></article>
            <article><span>Validations used</span><strong>{organization.creditsUsed.toLocaleString()}</strong><small>{usedPercent}% of this cycle</small></article>
            <article><span>Cycle resets</span><strong>{new Date(organization.periodEndsUtc).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</strong><small>every 30 days</small></article>
            <article><span>Team access</span><strong>{organization.members.length}<em>/{organization.plan.seatLimit}</em></strong><small>active members</small></article>
          </div>

          <div className="dash-grid">
            <article className="dash-panel usage-panel" id="usage">
              <div className="panel-head"><div><h2>Validation usage</h2><p>One credit per unique session; retries are deduplicated.</p></div><span>Last 14 days</span></div>
              <div className="usage-chart" aria-label="Validation credits used over the last fourteen days">
                {organization.usage.map((item) => <div className="usage-col" key={item.date} title={`${item.date}: ${item.credits}`}><i style={{ height: `${Math.max(4, (item.credits / maxUsage) * 100)}%` }} /><span>{new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "narrow" })}</span></div>)}
              </div>
              <div className="usage-footer"><span><i className="legend-dot" /> Credits consumed</span><b>{organization.creditsUsed.toLocaleString()} this cycle</b></div>
            </article>

            <article className="dash-panel plan-panel">
              <div className="panel-head"><div><h2>{organization.plan.name}</h2><p>{organization.plan.description}</p></div><span className="plan-badge">Active</span></div>
              <div className="plan-row"><span>Included usage</span><b>1,000 / cycle</b></div>
              <div className="plan-row"><span>Studio seats</span><b>{organization.plan.seatLimit}</b></div>
              <div className="plan-row"><span>Protected games</span><b>{organization.plan.gameLimit}</b></div>
              <div className="plan-row"><span>Role</span><b className="capitalize">{organization.role}</b></div>
            </article>
          </div>

          <div className="dash-grid lower-grid">
            <article className="dash-panel" id="credentials">
              <div className="panel-head"><div><h2>Game-server API key</h2><p>Use this bearer key only from trusted server infrastructure.</p></div>{canManage && <button className="panel-button" type="button" disabled={busy} onClick={() => void rotateApiKey()}>{organization.apiKeys.length ? "Rotate key" : "Generate key"}</button>}</div>
              {revealedKey ? <div className="revealed-secret"><code>{revealedKey}</code><button type="button" onClick={() => navigator.clipboard.writeText(revealedKey)}>Copy</button></div> : organization.apiKeys.length ? (
                <div className="api-key-row"><span>•••• •••• •••• {organization.apiKeys[0].lastFour}</span><small>{organization.apiKeys[0].lastUsedUtc ? `Last used ${new Date(organization.apiKeys[0].lastUsedUtc).toLocaleString()}` : "Never used"}</small></div>
              ) : <div className="empty-row">No game-server key has been generated.</div>}
              <p className="panel-note">Configured environment keys remain unmetered for migration. Keys created here use the studio&apos;s pooled credits.</p>
            </article>

            <article className="dash-panel" id="members">
              <div className="panel-head"><div><h2>Studio members</h2><p>Credits are pooled across everyone in this workspace.</p></div>{canManage && <button className="panel-button" type="button" disabled={busy} onClick={() => void createInvite()}>Invite developer</button>}</div>
              <div className="member-list">
                {organization.members.map((member) => <div className="member-row" key={member.userId}>{member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : <span>{member.displayName.slice(0, 1)}</span>}<div><b>{member.displayName}</b><small>@{member.username}</small></div><em>{member.role}</em></div>)}
              </div>
              {inviteLink && <div className="invite-link"><code>{inviteLink}</code><button type="button" onClick={() => navigator.clipboard.writeText(inviteLink)}>Copy</button></div>}
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
