import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type TokenRow } from "../api/client";

export function TokensPage() {
  const [rows, setRows] = useState<TokenRow[]>([]);
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .tokens()
      .then((r) => {
        setRows(r.data);
        setSource(r.source);
      })
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div>
      <h1>Tokens</h1>
      <p className="muted">
        Research list for Robinhood Chain. Source: {source || "…"}
      </p>
      {error && <p className="error">{error}</p>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Name</th>
              <th>Category</th>
              <th>Opportunity</th>
              <th>Risk</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link to={`/tokens/${t.id}`}>{t.symbol}</Link>
                </td>
                <td>
                  {t.name}
                  {t.dataLabel === "FICTIONAL" || t.name.includes("FICTIONAL") ? (
                    <span className="badge" style={{ marginLeft: 8 }}>
                      FICTIONAL
                    </span>
                  ) : null}
                </td>
                <td>{t.category}</td>
                <td className="score-opp">
                  {t.latestScore?.opportunity?.toFixed(1) ?? "—"}
                </td>
                <td className="score-risk">
                  {t.latestScore?.risk?.toFixed(1) ?? "—"}
                </td>
                <td>
                  {t.latestScore
                    ? `${(t.latestScore.evidenceConfidence * 100).toFixed(0)}%`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
