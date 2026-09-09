/**
 * Nick buy/funding wallets registry — NOT watched alphas.
 * Paper-safe: addresses only, no private keys. RH Chain 4663.
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

/** In-memory until Nick pastes real buy wallets / DB table lands */
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
    note: "Buy/funding wallets for Nick trading stack — excludes watched alphas. Empty until registered.",
  });
});

buyWalletRoutes.post("/", async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    address?: string;
    label?: string;
    kind?: string;
  } | null;
  if (!body?.address) return c.json({ error: "address_required" }, 400);
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
      note: "Address registered for read-only balance later. No keys stored.",
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
