/**
 * Nick buy/funding wallets registry — NOT watched alphas.
 * Paper-safe: public addresses only. No private keys.
 * Architecture: ONE controlling key (isolated signer later) → many addresses here.
 * RH Chain 4663. See docs/BUY_WALLETS.md.
 */
import { Hono } from "hono";

export type BuyWalletRow = {
  id: string;
  address: string;
  label: string | null;
  kind: "buy" | "funding";
  chainId: number;
  createdAt: string;
};

/** In-memory until Nick registers real buy addresses / DB table lands */
export const memBuyWallets: BuyWalletRow[] = [];

const ADDR_RE = /^0x[0-9a-f]{40}$/;

function normalizeAddress(raw: string): string | null {
  const a = raw.trim().toLowerCase();
  return ADDR_RE.test(a) ? a : null;
}

export const buyWalletRoutes = new Hono();

buyWalletRoutes.get("/", (c) => {
  return c.json({
    data: memBuyWallets,
    paperOnly: true,
    keyModel: "single_controlling_key_multi_address",
    note:
      "Buy/funding addresses only — one key in isolated signer later; never stored here. Excludes watched alphas.",
  });
});

buyWalletRoutes.post("/", async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    address?: string;
    label?: string;
    kind?: string;
    privateKey?: unknown;
    key?: unknown;
  } | null;
  if (!body?.address) return c.json({ error: "address_required" }, 400);
  // Refuse any key-shaped fields — addresses only
  if (body.privateKey != null || body.key != null) {
    return c.json(
      {
        error: "keys_not_accepted",
        hint: "Register public addresses only. Key stays in isolated signer.",
      },
      400
    );
  }
  const address = normalizeAddress(body.address);
  if (!address) return c.json({ error: "invalid_address" }, 400);
  if (memBuyWallets.some((w) => w.address === address)) {
    return c.json({ error: "duplicate_address" }, 409);
  }
  const kind = body.kind === "funding" ? "funding" : "buy";
  const row: BuyWalletRow = {
    id: crypto.randomUUID(),
    address,
    label: body.label?.trim() || null,
    kind,
    chainId: 4663,
    createdAt: new Date().toISOString(),
  };
  memBuyWallets.push(row);
  return c.json(
    {
      data: row,
      paperOnly: true,
      signed: false,
      note: "Address registered for read-only balance. No keys stored. Single-key multi-address model.",
    },
    201
  );
});

buyWalletRoutes.delete("/:id", (c) => {
  const id = c.req.param("id");
  const idx = memBuyWallets.findIndex((w) => w.id === id);
  if (idx < 0) return c.json({ error: "not_found" }, 404);
  const [removed] = memBuyWallets.splice(idx, 1);
  return c.json({ data: removed, paperOnly: true });
});
