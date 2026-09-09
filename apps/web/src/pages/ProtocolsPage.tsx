import { useEffect, useState } from "react";
import { api, type ProtocolRow } from "../api/client";

export function ProtocolsPage() {
  const [rows, setRows] = useState<ProtocolRow[]>([]);
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .protocols()
      .then((r) => {
        setRows(r.data);
        setSource(r.source);
      })
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div>
      <h1>Protocols</h1>
      <p className="muted">
        Seed protocols for chain 4663. Factory addresses require on-chain
        verification. Source: {source || "…"}
      </p>
      {error && <p className="error">{error}</p>}
      <div className="grid">
        {rows.map((p) => (
          <div className="card" key={p.id}>
            <h2>{p.name}</h2>
            <p className="muted">
              {p.kind} · slug <code>{p.slug}</code>
            </p>
            <p>
              Factory:{" "}
              {p.factoryAddress ?? (
                <span className="badge">NEEDS_ONCHAIN_VERIFICATION</span>
              )}
            </p>
            <p className="muted">{p.notes}</p>
            {p.website && (
              <a href={p.website} target="_blank" rel="noreferrer">
                Website
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
