import { useEffect, useState } from "react";
const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";
type Account = { id: string; handle: string; enabled: boolean; lastPolledAt: string | null;
  lastError: string | null; watchFollowers: boolean; watchFollowing: boolean;
  coverage: { postsBacklog: boolean; following: { truncated: boolean; scanning: boolean } | null;
    followers: { truncated: boolean; scanning: boolean } | null } };
type Signal = { id: string; handle: string; kind: string; sourceUrl: string; text: string;
  addresses: string[]; observedAt: string };
type Match = { token: { id: string; symbol: string; address: string }; blockers: string[] };
async function request<T>(path: string, signal?: AbortSignal, body?: unknown): Promise<T> {
  const response = await fetch(`${BASE}/discovery/${path}`, { signal,
    ...(body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) });
  if (!response.ok) {
    if (response.status === 503) throw new Error("Discovery storage is unavailable. Connect PostgreSQL and apply the discovery migration.");
    throw new Error(`Discovery request failed (${response.status}). Check the account name and connection.`);
  }
  return response.json();
}
export function DiscoveryPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [handle, setHandle] = useState("");
  const [followers, setFollowers] = useState(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    Promise.all([
      request<{ data: Account[] }>("accounts", controller.signal),
      request<{ data: Signal[] }>("signals", controller.signal),
      request<{ data: Match[] }>("launch-matches", controller.signal),
    ]).then(([a, s, m]) => { setAccounts(a.data); setSignals(s.data); setMatches(m.data); })
      .catch((err) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Discovery unavailable"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  async function save(body: unknown) {
    setSaving(true); setError("");
    try { await request("accounts", undefined, body); setHandle(""); setRevision((r) => r + 1); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not save account"); }
    finally { setSaving(false); }
  }
  return <div>
    <h1>Launch discovery</h1>
    <p className="muted">Watch X accounts, follow changes, and token-address mentions. Compare leads with observed launches.</p>
    <div className="card"><h2>Execution status: research only</h2>
      <p>Automatic purchases are not connected. Launch matches still need issuer verification, liquidity and sellability checks, spending limits, and an isolated signer.</p>
      <p className="muted">X scanning requires API access and must be enabled on the collector. Adding an account does not enable it.</p>
    </div>
    <form className="card" onSubmit={(event) => { event.preventDefault(); void save({ handle, watchFollowing: true, watchFollowers: followers }); }}>
      <h2>Monitor an account</h2>
      <div className="discovery-controls">
        <label>X username <input required aria-label="X username" value={handle} maxLength={16}
          pattern="@?[A-Za-z0-9_]{1,15}" placeholder="@platform" onChange={(e) => setHandle(e.target.value)} /></label>
        <label><input type="checkbox" checked={followers} onChange={(e) => setFollowers(e.target.checked)} /> Also scan followers</label>
        <button disabled={saving || !handle.trim()} type="submit">{saving ? "Saving…" : "Save account"}</button>
      </div>
      <p className="muted">Posts and following are monitored by default. Full follower scans can increase API usage significantly.</p>
    </form>
    {error ? <p role="alert" className="error">{error}</p> : null}
    <button className="ghost" disabled={loading} onClick={() => setRevision((r) => r + 1)}>Refresh discovery</button>
    {loading ? <p role="status">Loading discovery…</p> : null}
    <section className="card" style={{ marginTop: "1rem" }}><h2>Monitored accounts</h2>
      {!loading && !error && !accounts.length ? <p className="muted">No accounts yet. Add a project or researcher above.</p> : null}
      <div className="discovery-table"><table><thead><tr><th>Account</th><th>Last scan</th><th>Coverage</th><th>Action</th></tr></thead><tbody>
        {accounts.map((a) => <tr key={a.id}><td>@{a.handle}<br /><span className="muted">{a.enabled ? "Monitoring enabled" : "Paused"}</span></td>
          <td>{a.lastPolledAt ? new Date(a.lastPolledAt).toLocaleString() : "Not scanned"}{a.lastError ? <p className="error">{a.lastError}</p> : null}</td>
          <td>{a.coverage.postsBacklog ? "Post backlog pending. " : ""}{a.coverage.following?.truncated || a.coverage.followers?.truncated ? "Graph exceeds configured limit." : a.coverage.following?.scanning || a.coverage.followers?.scanning ? "Graph snapshot in progress." : "See last scan status."}</td>
          <td><button className="ghost" disabled={saving} onClick={() => void save({ handle: a.handle, enabled: !a.enabled })}>{a.enabled ? "Pause" : "Resume"}</button></td></tr>)}
      </tbody></table></div>
    </section>
    <section className="card"><h2>Launch matches ({matches.length})</h2>
      <p className="muted">Matches cover the latest 500 signals. An address match does not establish who owns or deployed the token.</p>
      {matches.map((m) => <article key={m.token.id}><h3>{m.token.symbol}</h3><code className="discovery-address">{m.token.address}</code>
        <p>Needs verification before buying.</p><ul>{m.blockers.map((b) => <li key={b}>{b.replaceAll("_", " ")}</li>)}</ul></article>)}
    </section>
    <section><h2>Recent evidence</h2>
      {!loading && !error && !signals.length ? <p className="muted">No evidence collected yet. This view contains no demo signals.</p> : null}
      {signals.map((s) => <article className="card" key={s.id}><p><strong>@{s.handle}</strong> · {s.kind.replaceAll("_", " ")} · {new Date(s.observedAt).toLocaleString()}</p>
        <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{s.text}</p>
        {s.addresses.map((address) => <p key={address}><code className="discovery-address">{address}</code> <span className="badge">Role and ownership unverified</span></p>)}
        <a href={s.sourceUrl} target="_blank" rel="noreferrer">View source on X</a></article>)}
    </section>
  </div>;
}
