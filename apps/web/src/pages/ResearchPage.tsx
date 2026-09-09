import { useEffect, useState } from "react";
const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";
type Evidence = { id: string; url: string; kind: string; finding: string; observedAt: string };
type Report = { researchedAt: string; evidence: Evidence[];
  rating: { rating10: number | null; evidenceCoveragePct: number; supportedEvidencePoints: number; note: string;
    checks: { id: string; label: string; weight: number; status: string; explanation: string; sourceIds: string[] }[] };
  subdomains: { discovered: number; truncated: boolean; errors: string[];
    inspected: { host: string; discovery: string; reachable: boolean; status: number | null }[] };
  launchReadiness: { blockers: string[] };
  grok?: { status: string; analysis: { summary: string; strengths: string[]; concerns: string[]; missingEvidence: string[]; evidenceIds: string[] } | null } };
type Project = { id: string; handle: string; domain: string; category: string; enabled: boolean;
  lastResearchedAt: string | null; lastError: string | null; report?: Report | null };
async function request<T>(path: string, signal?: AbortSignal, body?: unknown): Promise<T> {
  const response = await fetch(`${BASE}/research/${path}`, { signal,
    ...(body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) });
  if (!response.ok) {
    if (response.status === 503) throw new Error("Research storage is unavailable. Connect PostgreSQL and apply migration 0007.");
    throw new Error(`Research request failed (${response.status}). Check the handle, public domain and connection.`);
  }
  return response.json();
}
function SourceLink({ evidence }: { evidence: Evidence }) {
  try { const url = new URL(evidence.url);
    if (url.protocol === "https:" && !url.username && !url.password) return <a href={url.href} target="_blank" rel="noreferrer">{evidence.id} · View source</a>;
  } catch { /* render as text */ }
  return <span>{evidence.id} · Source URL unavailable</span>;
}
function ProjectReport({ report, handle }: { report: Report; handle: string }) {
  return <div>
    <p className="muted">Snapshot: {new Date(report.researchedAt).toLocaleString()}. Recheck time-sensitive evidence before acting.</p>
    <div className="card"><h3>{report.rating.rating10 == null ? "Insufficient evidence for an overall rating" : `Research evidence rating: ${report.rating.rating10}/10`}</h3>
      <p>{report.rating.evidenceCoveragePct}% evidence coverage · {report.rating.supportedEvidencePoints}/100 supported evidence points · Legitimacy unverified</p>
      <p className="muted">{report.rating.note}</p>
    </div>
    <h3>Project checks</h3>
    {report.rating.checks.map((check) => <details key={check.id} className="card"><summary>{check.label} · {check.status} · {check.weight} points</summary>
      <p>{check.explanation}</p><p className="muted">Sources: {check.sourceIds.join(", ") || "None verified"}</p></details>)}
    <h3>Public subdomains</h3>
    <p>{report.subdomains.discovered} discovered; {report.subdomains.inspected.length} inspected{report.subdomains.truncated ? " (inspection cap reached)" : ""}.</p>
    {report.subdomains.errors.length ? <p role="status">Coverage gaps: {report.subdomains.errors.map((e) => e.replaceAll("_", " ")).join("; ")}</p> : null}
    {report.subdomains.inspected.map((s) => <p key={s.host}><code>{s.host}</code> · {s.status == null ? "Could not retrieve" : `HTTP ${s.status}`} · {s.discovery.replaceAll("_", " ")}</p>)}
    <h3>Grok research</h3><p className="muted">{(report.grok?.status ?? "not_requested").replaceAll("_", " ")}. Model analysis requires review.</p>
    {report.grok?.analysis ? <div className="card"><p>{report.grok.analysis.summary}</p>
      {(["strengths", "concerns", "missingEvidence"] as const).map((key) => <div key={key}><h4>{key === "missingEvidence" ? "Missing evidence" : key}</h4>
        <ul>{report.grok!.analysis![key].map((value, i) => <li key={i}>{value}</li>)}</ul></div>)}
      <p>Cited evidence: {report.grok.analysis.evidenceIds.join(", ")}</p></div> : null}
    <a href={`${BASE}/research/projects/${encodeURIComponent(handle)}/grok-handoff`} target="_blank" rel="noreferrer">Open Grok handoff JSON</a>
    <h3>Launch readiness: watch only</h3><p>The current execution adapter cannot buy or sell. Outstanding checks:</p>
    <ul>{report.launchReadiness.blockers.map((b) => <li key={b}>{b.replaceAll("_", " ")}</li>)}</ul>
    <h3>Collected evidence</h3>
    {report.evidence.map((e) => <details key={e.id} className="card"><summary>{e.id} · {e.kind.replaceAll("_", " ")}</summary>
      <SourceLink evidence={e} /><p className="muted">Observed {new Date(e.observedAt).toLocaleString()}</p>
      <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{e.finding}</p></details>)}
  </div>;
}
export function ResearchPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [handle, setHandle] = useState(""); const [domain, setDomain] = useState("");
  const [category, setCategory] = useState("unknown");
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState(""); const [detailError, setDetailError] = useState("");
  const [loading, setLoading] = useState(true); const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    request<{ data: Project[] }>("projects", controller.signal).then(({ data }) => {
      if (controller.signal.aborted) return;
      setProjects(data); setSelected((value) => value || data[0]?.handle || "");
    }).catch((err) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Research unavailable"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    setProject(null); setDetailError("");
    if (!selected) return;
    const controller = new AbortController(); setDetailLoading(true);
    request<{ data: Project }>(`projects/${encodeURIComponent(selected)}`, controller.signal).then(({ data }) => {
      if (!controller.signal.aborted) setProject(data);
    }).catch((err) => { if (!controller.signal.aborted) setDetailError(err instanceof Error ? err.message : "Report unavailable"); })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [selected, revision]);
  async function save(body: unknown) {
    setSaving(true); setError("");
    try { const { data } = await request<{ data: Project }>("projects", undefined, body);
      setSelected(data.handle); setHandle(""); setDomain(""); setRevision((v) => v + 1);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save project"); }
    finally { setSaving(false); }
  }
  return <div><h1>Project research</h1>
    <p>Watch a platform before its token launches. Review public development evidence and X signals, with Grok as the primary research handoff.</p>
    <form className="card research-form" onSubmit={(e) => { e.preventDefault(); void save({ handle, domain, category }); }}>
      <label>X handle <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="tradedotcv" required maxLength={16} /></label>
      <label>Public domain <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="trade.cv" required maxLength={253} /></label>
      <label>Research category <select value={category} onChange={(e) => setCategory(e.target.value)}><option value="unknown">Unknown</option><option value="utility">Utility</option><option value="meme">Meme</option></select></label>
      <button disabled={saving}>{saving ? "Saving…" : "Add or update project"}</button>
    </form>
    <p className="muted">Registration queues the enabled collector and adds the X account. Domain ownership and token identity still require verification. Updating a project clears its old report.</p>
    <button disabled={loading || detailLoading} onClick={() => setRevision((v) => v + 1)}>Refresh</button>
    {error ? <p role="alert">{error}</p> : null}
    {loading ? <p role="status">Loading projects…</p> : !error && !projects.length ? <p>No projects registered yet.</p> : null}
    {projects.length ? <label> Project <select value={selected} onChange={(e) => setSelected(e.target.value)}>{projects.map((p) => <option key={p.id} value={p.handle}>@{p.handle} · {p.domain}</option>)}</select></label> : null}
    {detailLoading ? <p role="status">Loading report…</p> : null}{detailError ? <p role="alert">{detailError}</p> : null}
    {project ? <section><h2>@{project.handle} · {project.domain}</h2>
      <p>{project.category} · Research {project.enabled ? "enabled" : "paused"}{project.lastError ? ` · ${project.lastError.replaceAll("_", " ")}` : ""}</p>
      <button disabled={saving} onClick={() => void save({ handle: project.handle, domain: project.domain, category: project.category, enabled: !project.enabled })}>{project.enabled ? "Pause research" : "Resume research"}</button>
      <p className="muted">X account monitoring is managed separately in Discovery.</p>
      {project.report ? <ProjectReport report={project.report} handle={project.handle} /> : <p>No report yet. The collector requires project research to be enabled; the first pass runs after it picks up this project.</p>}
    </section> : null}
  </div>;
}
