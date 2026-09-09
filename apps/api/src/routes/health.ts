import { Hono } from "hono";
import { config } from "../config.js";
import { isDbAvailable } from "../db.js";

export const healthRoutes = new Hono();

healthRoutes.get("/", (c) => {
  return c.json({
    status: "ok",
    service: "rh-chain-trader-api",
    phase: 1,
    mode: "research_dashboard_only",
    chainId: config.chainId,
    blockscoutBase: config.blockscoutBase,
    tradingEnabled: false,
    txSubmissionEnabled: false,
    db: isDbAvailable() ? "connected" : "memory_fictional_fallback",
    timestamp: new Date().toISOString(),
  });
});
