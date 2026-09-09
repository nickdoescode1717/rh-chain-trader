export const config = {
  port: Number(process.env.API_PORT ?? 3001),
  host: process.env.API_HOST ?? "0.0.0.0",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgresql://rh_research:changeme_local_only@localhost:5432/rh_chain",
  chainId: Number(process.env.CHAIN_ID ?? 4663),
  blockscoutBase:
    process.env.BLOCKSCOUT_BASE_URL ??
    "https://robinhoodchain.blockscout.com",
  enableTrading: process.env.ENABLE_TRADING === "true",
  enableTxSubmission: process.env.ENABLE_TX_SUBMISSION === "true",
};

if (config.enableTrading || config.enableTxSubmission) {
  console.warn(
    "[safety] ENABLE_TRADING / ENABLE_TX_SUBMISSION ignored in Phase 1 — trading remains disabled."
  );
}
