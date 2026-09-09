import { Link, Route, Routes } from "react-router-dom";
import { TokensPage } from "./pages/TokensPage";
import { TokenDetailPage } from "./pages/TokenDetailPage";
import { WatchlistPage } from "./pages/WatchlistPage";
import { ProtocolsPage } from "./pages/ProtocolsPage";
import { DiscoveryPage } from "./pages/DiscoveryPage";

export function App() {
  return (
    <div className="layout">
      <nav className="nav">
        <div className="brand">RH Chain Research</div>
        <span className="badge">Phase 1 · Research only · No trading</span>
        <Link to="/">Tokens</Link>
        <Link to="/watchlist">Watchlist</Link>
        <Link to="/protocols">Protocols</Link>
        <Link to="/discovery">Discovery</Link>
      </nav>
      <Routes>
        <Route path="/" element={<TokensPage />} />
        <Route path="/tokens/:id" element={<TokenDetailPage />} />
        <Route path="/watchlist" element={<WatchlistPage />} />
        <Route path="/protocols" element={<ProtocolsPage />} />
        <Route path="/discovery" element={<DiscoveryPage />} />
      </Routes>
      <p className="muted" style={{ marginTop: "2rem", fontSize: "0.85rem" }}>
        Chain ID 4663 · Blockscout{" "}
        <a
          href="https://robinhoodchain.blockscout.com"
          target="_blank"
          rel="noreferrer"
        >
          robinhoodchain.blockscout.com
        </a>
        . Sample data may be labeled FICTIONAL.
      </p>
    </div>
  );
}
