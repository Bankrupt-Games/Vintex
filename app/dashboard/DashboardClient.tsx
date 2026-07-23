"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const defaultApiUrl = process.env.NODE_ENV === "production" ? "" : "http://127.0.0.1:5055";
const API_URL = (process.env.NEXT_PUBLIC_VINTEX_API_URL ?? defaultApiUrl).replace(/\/$/, "");
const SDK_DOWNLOAD_URL = "/downloads/vintex-unity-sdk-1.1.0-beta.3.zip";
const SDK_SHA256 = "1BC030EAD808BD24CCC20F95919FF36F5D870DC848CB156A126368B73E270CD3";

function canonicalDashboardUrl(value: string) {
  const url = new URL(value);
  if (!API_URL) return url.toString();
  const apiUrl = new URL(API_URL, url.origin);
  if (url.hostname === "localhost" && apiUrl.hostname === "127.0.0.1") url.hostname = "127.0.0.1";
  return url.toString();
}

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
  subscriptionStatus: string; billingActive: boolean;
};
type DashboardData = { isAdministrator: boolean; user: User; organizations: OrganizationSummary[]; activeOrganization: Organization };
type BillingConfig = { enabled: boolean; unitAmount: number; currency: string };
type DashboardTab = "overview" | "players" | "usage" | "api" | "members";
type PlayerLogin = {
  id: string; playerId: string; packageName: string; status: "allowed" | "blocked" | "banned" | "credits_exhausted";
  actionCode: number; errorCode?: string; reason: string; usingVpn: boolean; integritySummary?: string; createdUtc: string;
};

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
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [playerLogins, setPlayerLogins] = useState<PlayerLogin[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState("");
  const [playerQuery, setPlayerQuery] = useState("");
  const [playerStatus, setPlayerStatus] = useState("all");
  const [expandedLoginId, setExpandedLoginId] = useState<string | null>(null);
  const [lastPlayersRefresh, setLastPlayersRefresh] = useState<Date | null>(null);
  const [billingConfig, setBillingConfig] = useState<BillingConfig | null>(null);

  const loadDashboard = useCallback(async (organizationId?: string) => {
    setStatus("loading");
    try {
      const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : "";
      const response = await request(`/api/account/dashboard${query}`);
      if (response.status === 401) { setStatus("signed-out"); return; }
      if (!response.ok) throw new Error("The Vintex backend is unavailable.");
      const nextData = await response.json() as DashboardData;
      setData(nextData);

      const checkout = new URLSearchParams(window.location.search).get("checkout");
      if (checkout === "success") {
        setMessage("Subscription checkout completed. Stripe is confirming your plan now.");
        window.history.replaceState({}, "", "/dashboard");
      }

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

  const loadPlayerLogins = useCallback(async (organizationId: string, quiet = false) => {
    if (!quiet) setPlayersLoading(true);
    setPlayersError("");
    try {
      const response = await request(`/api/account/studios/${encodeURIComponent(organizationId)}/player-logins?limit=500`);
      if (!response.ok) throw new Error("Could not load player login activity.");
      setPlayerLogins(await response.json() as PlayerLogin[]);
      setLastPlayersRefresh(new Date());
    } catch (error) {
      setPlayersError(error instanceof Error ? error.message : "Could not load player login activity.");
    } finally {
      if (!quiet) setPlayersLoading(false);
    }
  }, []);

  useEffect(() => {
    const canonicalUrl = canonicalDashboardUrl(window.location.href);
    if (canonicalUrl !== window.location.href) {
      window.location.replace(canonicalUrl);
      return;
    }
    void loadDashboard();
  }, [loadDashboard]);

  const organization = data?.activeOrganization;
  const activeOrganizationId = organization?.id;

  useEffect(() => {
    if (!activeOrganizationId) return;
    void loadPlayerLogins(activeOrganizationId);
    if (activeTab !== "players") return;
    const timer = window.setInterval(() => void loadPlayerLogins(activeOrganizationId, true), 15_000);
    return () => window.clearInterval(timer);
  }, [activeOrganizationId, activeTab, loadPlayerLogins]);

  useEffect(() => {
    if (status !== "ready") return;
    void request("/api/billing/config").then(async (response) => {
      if (response.ok) setBillingConfig(await response.json() as BillingConfig);
    }).catch(() => undefined);
  }, [status]);

  const usedPercent = organization ? Math.min(100, Math.round((organization.creditsUsed / Math.max(1, organization.creditsIncluded)) * 100)) : 0;
  const maxUsage = useMemo(() => Math.max(1, ...(organization?.usage.map((item) => item.credits) ?? [1])), [organization]);
  const canManage = organization?.role === "owner" || organization?.role === "admin";
  const filteredPlayerLogins = useMemo(() => {
    const query = playerQuery.trim().toLowerCase();
    return playerLogins.filter((login) => {
      const matchesQuery = !query || login.playerId.toLowerCase().includes(query) || login.packageName.toLowerCase().includes(query)
        || (login.errorCode ?? "").toLowerCase().includes(query);
      return matchesQuery && (playerStatus === "all" || login.status === playerStatus);
    });
  }, [playerLogins, playerQuery, playerStatus]);
  const uniquePlayers = useMemo(() => new Set(playerLogins.map((login) => login.playerId)).size, [playerLogins]);
  const allowedLogins = playerLogins.filter((login) => login.status === "allowed").length;
  const blockedLogins = playerLogins.length - allowedLogins;

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

  async function startCheckout() {
    if (!organization || !canManage) return;
    setBusy(true); setMessage("");
    try {
      const response = await request(`/api/billing/studios/${organization.id}/checkout`, { method: "POST", body: "{}" });
      const payload = await response.json();
      if (!response.ok || !payload.url) throw new Error(payload.message ?? "Could not start Stripe checkout.");
      window.location.assign(payload.url);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not start Stripe checkout."); setBusy(false); }
  }

  async function logout() {
    await request("/api/auth/logout", { method: "POST", body: "{}" });
    setData(null); setStatus("signed-out");
  }

  const loginHref = typeof window === "undefined"
    ? `${API_URL}/api/v4/oauth`
    : `${API_URL}/api/v4/oauth?returnUrl=${encodeURIComponent(canonicalDashboardUrl(window.location.href))}`;

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
          {API_URL.includes("127.0.0.1") && <a className="dev-login" href={`${API_URL}/api/auth/dev-login?returnUrl=${encodeURIComponent(typeof window === "undefined" ? "http://127.0.0.1:3000/dashboard" : canonicalDashboardUrl(window.location.href))}`}>Use local development account</a>}
          <small>Vintex requests your basic Discord identity and email only.</small>
        </section>
        <a className="signin-back" href="/">← Back to vintex.gg</a>
      </main>
    );
  }

  if (!data || !organization) return null;

  const tabMeta: Record<DashboardTab, { eyebrow: string; title: string; description: string }> = {
    overview: { eyebrow: "Workspace overview", title: organization.name, description: "Monitor protection usage and manage access for your team." },
    players: { eyebrow: "Security activity", title: "Player logins", description: "Inspect every metered game login and its anticheat decision." },
    usage: { eyebrow: "Usage ledger", title: "Validation credits", description: "Track how protected sessions consume your studio's pooled credits." },
    api: { eyebrow: "Server integration", title: "API access", description: "Manage the credential your trusted game servers use with Vintex." },
    members: { eyebrow: "Studio access", title: "Members", description: "Control who can view activity and manage this workspace." },
  };
  const currentTab = tabMeta[activeTab];

  return (
    <main className="dashboard-shell">
      <aside className="dash-sidebar">
        <a className="brand" href="/"><VintexMark /><span>vintex<span className="accent">.gg</span></span></a>
        <nav className="dash-nav" aria-label="Dashboard navigation">
          <button type="button" className={activeTab === "overview" ? "active" : ""} onClick={() => setActiveTab("overview")}><span>⌁</span> Overview</button>
          <button type="button" className={activeTab === "players" ? "active" : ""} onClick={() => setActiveTab("players")}><span>◉</span> Players</button>
          <button type="button" className={activeTab === "usage" ? "active" : ""} onClick={() => setActiveTab("usage")}><span>↗</span> Usage</button>
          <button type="button" className={activeTab === "api" ? "active" : ""} onClick={() => setActiveTab("api")}><span>⌘</span> API access</button>
          <button type="button" className={activeTab === "members" ? "active" : ""} onClick={() => setActiveTab("members")}><span>◎</span> Members</button>
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
            <div><b>{data.user.displayName}</b><small>@{data.user.username}{data.isAdministrator ? " · global admin" : ""}</small></div>
            <button type="button" onClick={() => void logout()}>Sign out</button>
          </div>
        </header>

        <div className="dash-content">
          <div className="dash-heading">
            <div><div className="eyebrow">{currentTab.eyebrow}</div><h1>{currentTab.title}</h1><p>{currentTab.description}</p></div>
            <span className="status-pill"><i /> {activeTab === "players" ? "Live · refreshes every 15s" : "All systems operational"}</span>
          </div>

          {message && <div className="dash-alert">{message}</div>}

          {activeTab === "overview" && <div className="metric-grid">
            <article><span>Credits remaining</span><strong>{organization.creditsRemaining.toLocaleString()}</strong><small>of {organization.creditsIncluded.toLocaleString()} included</small></article>
            <article><span>Validations used</span><strong>{organization.creditsUsed.toLocaleString()}</strong><small>{usedPercent}% of this cycle</small></article>
            <article><span>Cycle resets</span><strong>{new Date(organization.periodEndsUtc).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</strong><small>every 30 days</small></article>
            <article><span>Team access</span><strong>{organization.members.length}<em>/{organization.plan.seatLimit}</em></strong><small>active members</small></article>
          </div>}

          {(activeTab === "overview" || activeTab === "usage") && <div className="dash-grid">
            <article className="dash-panel usage-panel" id="usage">
              <div className="panel-head"><div><h2>Validation usage</h2><p>One credit per unique session; retries are deduplicated.</p></div><span>Last 14 days</span></div>
              <div className="usage-chart" aria-label="Validation credits used over the last fourteen days">
                {organization.usage.map((item) => <div className="usage-col" key={item.date} title={`${item.date}: ${item.credits}`}><i style={{ height: `${Math.max(4, (item.credits / maxUsage) * 100)}%` }} /><span>{new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "narrow" })}</span></div>)}
              </div>
              <div className="usage-footer"><span><i className="legend-dot" /> Credits consumed</span><b>{organization.creditsUsed.toLocaleString()} this cycle</b></div>
            </article>

            <article className="dash-panel plan-panel">
              <div className="panel-head"><div><h2>{organization.plan.name}</h2><p>{organization.plan.description}</p></div><span className="plan-badge">{organization.billingActive ? "Subscribed" : "Free access"}</span></div>
              <div className="plan-row"><span>Included usage</span><b>{organization.creditsIncluded.toLocaleString()} / month</b></div>
              <div className="plan-row"><span>Studio seats</span><b>{organization.plan.seatLimit}</b></div>
              <div className="plan-row"><span>Protected products</span><b>{organization.plan.gameLimit}</b></div>
              <div className="plan-row"><span>Role</span><b className="capitalize">{organization.role}</b></div>
              {canManage && !organization.billingActive && <div className={`billing-action${billingConfig?.enabled ? "" : " billing-action-disabled"}`}><div><b>Basic subscription</b><span>{billingConfig ? `${new Intl.NumberFormat(undefined, { style: "currency", currency: billingConfig.currency.toUpperCase() }).format(billingConfig.unitAmount / 100)} / month` : "Loading billing…"}</span>{billingConfig && !billingConfig.enabled && <small>Stripe setup is incomplete on the server.</small>}</div><button className="panel-button" type="button" disabled={busy || !billingConfig?.enabled} onClick={() => void startCheckout()}>{busy ? "Opening…" : billingConfig?.enabled ? "Subscribe" : "Setup required"}</button></div>}
              {organization.billingActive && <div className="billing-current"><i /> Stripe subscription {organization.subscriptionStatus}</div>}
            </article>
          </div>}

          {activeTab === "players" && <>
            <div className="metric-grid player-metrics">
              <article><span>Login events</span><strong>{playerLogins.length.toLocaleString()}</strong><small>latest 500 retained events</small></article>
              <article><span>Unique players</span><strong>{uniquePlayers.toLocaleString()}</strong><small>distinct player identifiers</small></article>
              <article><span>Allowed</span><strong>{allowedLogins.toLocaleString()}</strong><small>passed every security stage</small></article>
              <article><span>Blocked</span><strong>{blockedLogins.toLocaleString()}</strong><small>kicked, banned, or out of credits</small></article>
            </div>

            <article className="dash-panel players-panel">
              <div className="players-toolbar">
                <label className="player-search">
                  <span aria-hidden="true">⌕</span>
                  <input value={playerQuery} onChange={(event) => setPlayerQuery(event.target.value)} placeholder="Search player ID, game, or error code" aria-label="Search player logins" />
                </label>
                <select value={playerStatus} onChange={(event) => setPlayerStatus(event.target.value)} aria-label="Filter player logins by status">
                  <option value="all">All results</option>
                  <option value="allowed">Allowed</option>
                  <option value="blocked">Blocked</option>
                  <option value="banned">Banned</option>
                  <option value="credits_exhausted">Credits exhausted</option>
                </select>
                <button className="panel-button refresh-button" type="button" disabled={playersLoading} onClick={() => void loadPlayerLogins(organization.id)}>{playersLoading ? "Refreshing…" : "Refresh"}</button>
              </div>
              <div className="players-table" role="table" aria-label="Player login activity">
                <div className="player-table-head" role="row">
                  <span role="columnheader">Player</span><span role="columnheader">Game</span><span role="columnheader">Decision</span><span role="columnheader">Security</span><span role="columnheader">Login time</span>
                </div>
                {playersLoading && playerLogins.length === 0 && <div className="players-empty"><div className="dash-spinner" /><p>Loading player activity…</p></div>}
                {!playersLoading && playersError && <div className="players-empty error"><p>{playersError}</p><button className="panel-button" type="button" onClick={() => void loadPlayerLogins(organization.id)}>Try again</button></div>}
                {!playersLoading && !playersError && filteredPlayerLogins.length === 0 && <div className="players-empty"><strong>{playerLogins.length ? "No matching logins" : "No player logins yet"}</strong><p>{playerLogins.length ? "Try a different player ID or result filter." : "Events appear here after a game validates with this studio's API key."}</p></div>}
                {filteredPlayerLogins.map((login) => {
                  const expanded = expandedLoginId === login.id;
                  const statusLabel = login.status === "credits_exhausted" ? "No credits" : login.status;
                  return <div className={`player-entry ${expanded ? "expanded" : ""}`} key={login.id} role="rowgroup">
                    <button className="player-row" type="button" aria-expanded={expanded} onClick={() => setExpandedLoginId(expanded ? null : login.id)}>
                      <span className="player-identity"><i>{login.playerId.slice(0, 1).toUpperCase()}</i><b>{login.playerId}</b></span>
                      <span className="player-game">{login.packageName}</span>
                      <span><em className={`login-status ${login.status}`}>{statusLabel}</em></span>
                      <span className={login.usingVpn ? "security-flag" : "security-clear"}>{login.usingVpn ? "VPN flagged" : "No VPN"}</span>
                      <span className="login-time"><b>{new Date(login.createdUtc).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</b><small>{new Date(login.createdUtc).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</small></span>
                    </button>
                    {expanded && <div className="player-details">
                      <div><span>Decision reason</span><p>{login.reason || "Validation passed."}</p></div>
                      <div><span>Error code</span><code>{login.errorCode ?? "None"}</code></div>
                      <div><span>Integrity summary</span><code>{login.integritySummary ?? "Not supplied"}</code></div>
                      <div><span>Event ID</span><code>{login.id}</code></div>
                    </div>}
                  </div>;
                })}
              </div>
              <footer className="players-footer"><span>{filteredPlayerLogins.length} of {playerLogins.length} events shown</span><span>{lastPlayersRefresh ? `Updated ${lastPlayersRefresh.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" })}` : "Waiting for first refresh"}</span></footer>
            </article>
          </>}

          {(activeTab === "overview" || activeTab === "api" || activeTab === "members") && <div className={`dash-grid lower-grid ${activeTab !== "overview" ? "single-panel" : ""}`}>
            {(activeTab === "overview" || activeTab === "api") &&
            <article className="dash-panel" id="credentials">
              <div className="panel-head"><div><h2>Game-server API key</h2><p>Use this bearer key only from trusted server infrastructure.</p></div>{canManage && <button className="panel-button" type="button" disabled={busy} onClick={() => void rotateApiKey()}>{organization.apiKeys.length ? "Rotate key" : "Generate key"}</button>}</div>
              {revealedKey ? <div className="revealed-secret"><code>{revealedKey}</code><button type="button" onClick={() => navigator.clipboard.writeText(revealedKey)}>Copy</button></div> : organization.apiKeys.length ? (
                <div className="api-key-row"><span>•••• •••• •••• {organization.apiKeys[0].lastFour}</span><small>{organization.apiKeys[0].lastUsedUtc ? `Last used ${new Date(organization.apiKeys[0].lastUsedUtc).toLocaleString()}` : "Never used"}</small></div>
              ) : <div className="empty-row">No game-server key has been generated.</div>}
              <p className="panel-note">Configured environment keys remain unmetered for migration. Keys created here use the studio&apos;s pooled credits.</p>
            </article>}

            {activeTab === "api" &&
            <article className="dash-panel sdk-dashboard-card">
              <div className="panel-head"><div><h2>Unity SDK</h2><p>Runtime package and branded editor setup for Android ARM64.</p></div><span className="sdk-beta-badge">Beta</span></div>
              <div className="sdk-dashboard-version"><div><span>Current package</span><b>v1.1.0-beta.3</b></div><a className="panel-button" href={SDK_DOWNLOAD_URL} download>Download .zip</a></div>
              <div className="sdk-dashboard-details"><span>Unity 2021.3+</span><span>UPM package</span><span>Quest / ARM64</span></div>
              <div className="sdk-checksum"><span>SHA-256</span><code>{SDK_SHA256}</code><button type="button" onClick={() => navigator.clipboard.writeText(SDK_SHA256)}>Copy</button></div>
              <p className="sdk-dashboard-warning">Beta native build: test attestation and OBB checks on real Quest hardware before production.</p>
            </article>}

            {(activeTab === "overview" || activeTab === "members") &&
            <article className="dash-panel" id="members">
              <div className="panel-head"><div><h2>Studio members</h2><p>Credits are pooled across everyone in this workspace.</p></div>{canManage && <button className="panel-button" type="button" disabled={busy} onClick={() => void createInvite()}>Invite developer</button>}</div>
              <div className="member-list">
                {organization.members.map((member) => <div className="member-row" key={member.userId}>{member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : <span>{member.displayName.slice(0, 1)}</span>}<div><b>{member.displayName}</b><small>@{member.username}</small></div><em>{member.role}</em></div>)}
              </div>
              {inviteLink && <div className="invite-link"><code>{inviteLink}</code><button type="button" onClick={() => navigator.clipboard.writeText(inviteLink)}>Copy</button></div>}
            </article>}
          </div>}
        </div>
      </section>
    </main>
  );
}
