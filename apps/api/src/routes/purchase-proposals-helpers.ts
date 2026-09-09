/**
 * Helpers for paper purchase proposals. See docs/PURCHASE_PROPOSALS.md
 */
export type CreateBody = {
  tokenCA?: string;
  tokenAddress?: string;
  tokenId?: string | null;
  chainId?: number;
  sizeEth?: string | number | null;
  sizeUsd?: string | number | null;
  size?: string | null;
  slippageBps?: number | null;
  exits?: Record<string, unknown> | null;
  scores?: Record<string, unknown> | null;
  sources?: Record<string, unknown>[] | null;
  leadSource?: string | null;
  rationale?: string | null;
  expiresAt?: string | null;
  channel?: string | null;
  note?: string | null;
};

const ADDR_RE = /^0x[0-9a-f]{40}$/;

export function normalizeAddress(raw: string): string | null {
  const a = raw.trim().toLowerCase();
  return ADDR_RE.test(a) ? a : null;
}

export function encodeSize(body: CreateBody): string | null {
  if (body.size?.trim()) return body.size.trim();
  if (body.sizeEth !== undefined && body.sizeEth !== null && `${body.sizeEth}` !== "")
    return `eth:${body.sizeEth}`;
  if (body.sizeUsd !== undefined && body.sizeUsd !== null && `${body.sizeUsd}` !== "")
    return `usd:${body.sizeUsd}`;
  return null;
}

export function isExpired(expiresAt: Date | string | null | undefined): boolean {
  if (!expiresAt) return false;
  const t = typeof expiresAt === "string" ? Date.parse(expiresAt) : expiresAt.getTime();
  return Number.isFinite(t) && t <= Date.now();
}

export function iso(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : v;
}

export function toPhonePayload(row: {
  id: string;
  tokenAddress: string | null;
  size: string | null;
  slippageBps: number | null;
  exits: unknown;
  scores: unknown;
  sources: unknown;
  leadSource: string | null;
  rationale: string | null;
  expiresAt: Date | string | null;
  channel: string | null;
  status: string;
  note?: string | null;
  approvedAt?: Date | string | null;
  rejectedAt?: Date | string | null;
  createdAt?: Date | string | null;
  tokenId?: string | null;
}) {
  let sizeEth: string | null = null;
  let sizeUsd: string | null = null;
  if (row.size?.startsWith("eth:")) sizeEth = row.size.slice(4);
  else if (row.size?.startsWith("usd:")) sizeUsd = row.size.slice(4);

  return {
    id: row.id,
    tokenCA: row.tokenAddress,
    chainId: 4663,
    sizeEth,
    sizeUsd,
    size: row.size,
    slippageBps: row.slippageBps,
    exits: row.exits ?? null,
    scores: row.scores ?? null,
    sources: row.sources ?? [],
    leadSource: row.leadSource,
    rationale: row.rationale,
    expiresAt: iso(row.expiresAt),
    channel: row.channel ?? "grok_primary",
    channels: { primary: "grok_primary", fallback: "telegram_fallback" },
    status: row.status,
    note: row.note ?? null,
    approvedAt: iso(row.approvedAt),
    rejectedAt: iso(row.rejectedAt),
    createdAt: iso(row.createdAt),
    tokenId: row.tokenId ?? null,
  };
}
