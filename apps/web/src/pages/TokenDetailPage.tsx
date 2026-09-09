import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";

export function TokenDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .token(id)
      .then((r) => setData(r.data as unknown as Record<string, unknown>))
      .catch((e) => setError(String(e)));
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;

  const scores = (data.scores as Array<Record<string, unknown>>) ?? [];
  const evidence = (data.evidence as Array<Record<string, unknown>>) ?? [];
  const latest = scores[0];

  return (
    <div>
      <p>
        <Link to="/">← Tokens</Link>
      </p>
      <h1>
        {String(data.symbol)}{" "}
        <span className="muted" style={{ fontWeight: 400 }}>
          {String(data.name)}
        </span>
      </h1>
      {(String(data.name).includes("FICTIONAL") ||
        data.dataLabel === "FICTIONAL") && (
        <p>
          <span className="badge">FICTIONAL sample data</span>
        </p>
      )}
      <div className="grid">
        <div className="card">
          <h2>Category</h2>
          <div className="stat">{String(data.category)}</div>
        </div>
        <div className="card">
          <h2>Opportunity</h2>
          <div className="stat score-opp">
            {latest ? Number(latest.opportunity).toFixed(1) : "—"}
          </div>
        </div>
        <div className="card">
          <h2>Risk</h2>
          <div className="stat score-risk">
            {latest ? Number(latest.risk).toFixed(1) : "—"}
          </div>
        </div>
        <div className="card">
          <h2>Evidence conf.</h2>
          <div className="stat">
            {latest
              ? `${(Number(latest.evidenceConfidence) * 100).toFixed(0)}%`
              : "—"}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Address</h2>
        <code>{String(data.address)}</code>
        {data.blockscoutUrl ? (
          <p>
            <a href={String(data.blockscoutUrl)} target="_blank" rel="noreferrer">
              View on Blockscout
            </a>
          </p>
        ) : null}
        <p className="muted">{String(data.description ?? "")}</p>
      </div>

      {latest && (
        <div className="card">
          <h2>Score rationale ({String(latest.framework)})</h2>
          <p>{String(latest.rationale)}</p>
          <pre style={{ overflow: "auto", fontSize: "0.85rem" }}>
            {JSON.stringify(latest.breakdown, null, 2)}
          </pre>
        </div>
      )}

      <div className="card">
        <h2>Evidence</h2>
        {evidence.length === 0 && <p className="muted">None</p>}
        <ul>
          {evidence.map((e) => (
            <li key={String(e.id)}>
              <strong>{String(e.title)}</strong>{" "}
              <span className="muted">
                ({String(e.source)}, conf {(Number(e.confidence) * 100).toFixed(0)}
                %)
              </span>
              <div className="muted">{String(e.body)}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
