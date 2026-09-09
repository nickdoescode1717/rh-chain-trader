import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config.js";
import { initDb } from "./db.js";
import { healthRoutes } from "./routes/health.js";
import { tokenRoutes } from "./routes/tokens.js";
import { watchlistRoutes } from "./routes/watchlist.js";
import { protocolRoutes } from "./routes/protocols.js";
import { watchedWalletRoutes } from "./routes/watched-wallets.js";
import { walletEventRoutes } from "./routes/wallet-events.js";
import { purchaseProposalRoutes } from "./routes/purchase-proposals.js";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: config.corsOrigin,
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
  })
);

app.route("/health", healthRoutes);
app.route("/tokens", tokenRoutes);
app.route("/watchlist", watchlistRoutes);
app.route("/protocols", protocolRoutes);
app.route("/watched-wallets", watchedWalletRoutes);
app.route("/wallet-events", walletEventRoutes);
app.route("/purchase-proposals", purchaseProposalRoutes);

app.get("/", (c) =>
  c.json({
    name: "rh-chain-trader-api",
    phase: 1,
    disclaimer:
      "Research dashboard only. No live trading, signing, or tx submission.",
    endpoints: [
      "/health",
      "/tokens",
      "/tokens/:id",
      "/watchlist",
      "/protocols",
      "/watched-wallets",
      "/wallet-events",
      "/purchase-proposals",
      "/purchase-proposals/:id/approve",
      "/purchase-proposals/:id/reject",
    ],
  })
);

// Explicitly refuse live trading-shaped routes (orders/positions stay dark)
app.all("/orders/*", (c) =>
  c.json({ error: "DISABLED_PHASE1_NO_TRADING" }, 403)
);
app.all("/positions/*", (c) =>
  c.json({ error: "DISABLED_PHASE1_NO_TRADING" }, 403)
);

await initDb();

console.log(
  `[api] listening on http://${config.host}:${config.port} (chain ${config.chainId})`
);

serve({
  fetch: app.fetch,
  port: config.port,
  hostname: config.host,
});
