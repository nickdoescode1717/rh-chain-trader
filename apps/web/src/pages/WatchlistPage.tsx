import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type TokenRow } from "../api/client";

export function WatchlistPage() {
  const [rows, setRows] = useState<TokenRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .watchlist()
      .then((r) => setRows(r.data))
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div>
      <h1>Watchlist</h1>
      <p className="muted">Tokens marked for research follow-up.</p>
      {error && <p className="error">{error}</p>}
      <div className="card">
        {rows.length === 0 ? (
          <p className="muted">Watchlist empty.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Category</th>
                <th>Opp</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link to={`/tokens/${t.id}`}>{t.symbol}</Link>
                  </td>
                  <td>{t.category}</td>
                  <td className="score-opp">
                    {t.latestScore?.opportunity?.toFixed(1) ?? "—"}
                  </td>
                  <td className="score-risk">
                    {t.latestScore?.risk?.toFixed(1) ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
