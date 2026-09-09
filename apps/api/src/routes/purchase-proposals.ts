/**
 * Paper purchase proposals — Nick approve/reject only.
 * Never signs / never submits txs. ENABLE_TRADING stays false.
 * Signer handoff is a stub. See docs/PURCHASE_PROPOSALS.md
 */
import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { auditLog, purchaseProposals } from "@rh/db";
import { getDb } from "../db.js";
import {
  memPurchaseProposals,
  type MemPurchaseProposal,
} from "../memory-store.js";

export const purchaseProposalRoutes = new Hono();

const ADDR_RE = /^0x[0-9a-f]{40}$/;

type CreateBody = {
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

function normalizeAddress(raw: string): string | null {
  const a = raw.trim().toLowerCase();
  return ADDR_RE.test(a) ? a : null;
}

function encodeSize(body: CreateBody): string | null {
  if (body.size?.trim()) return body.size.trim();
  if (body.sizeEth !== undefined && body.sizeEth !== null && `${body.sizeEth}` !== "")
    return `eth:${body.sizeEth}`;
  if (body.sizeUsd !== undefined && body.sizeUsd !== null && `${body.sizeUsd}` !== "")
    return `usd:${body.sizeUsd}`;
  return null;
}

function isExpired(expiresAt: Date | string | null | undefined): boolean {
  if (!expiresAt) return false;
  const t = typeof expiresAt === "string" ? Date.parse(expiresAt) : expiresAt.getTime();
  return Number.isFinite(t) && t <= Date.now();
}

function iso(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : v;
}

function toPhonePayload(row: {
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

purchaseProposalRoutes.get("/", async (c) => {
  const db = getDb();
  if (!db) {
    return c.json({
      data: memPurchaseProposals.map(toPhonePayload),
      source: "memory",
      paperOnly: true,
    });
  }
  const rows = await db
    .select()
    .from(purchaseProposals)
    .orderBy(desc(purchaseProposals.createdAt));
  return c.json({ data: rows.map(toPhonePayload), source: "postgres", paperOnly: true });
});

purchaseProposalRoutes.post("/", async (c) => {
  const body = (await c.req.json().catch(() => null)) as CreateBody | null;
  if (!body) return c.json({ error: "invalid_json" }, 400);
  if ((body.chainId ?? 4663) !== 4663) {
    return c.json({ error: "chain_id_must_be_4663" }, 400);
  }

  const rawCa = body.tokenCA ?? body.tokenAddress;
  if (!rawCa) return c.json({ error: "tokenCA_required" }, 400);
  const tokenAddress = normalizeAddress(rawCa);
  if (!tokenAddress) return c.json({ error: "invalid_tokenCA" }, 400);

  const size = encodeSize(body);
  if (!size) {
    return c.json(
      { error: "size_required", hint: "Provide sizeEth or sizeUsd (one), or size string" },
      400
    );
  }

  const leadSource = body.leadSource ?? null;
  if (leadSource && leadSource !== "ct" && leadSource !== "watched_wallet") {
    return c.json({ error: "leadSource_must_be_ct_or_watched_wallet" }, 400);
  }

  const slippageBps =
    body.slippageBps === undefined || body.slippageBps === null
      ? null
      : Number(body.slippageBps);
  if (slippageBps !== null && (!Number.isFinite(slippageBps) || slippageBps < 0)) {
    return c.json({ error: "invalid_slippageBps" }, 400);
  }

  let expiresAt: Date | null = null;
  if (body.expiresAt) {
    const t = Date.parse(body.expiresAt);
    if (!Number.isFinite(t)) return c.json({ error: "invalid_expiresAt" }, 400);
    expiresAt = new Date(t);
  }

  const channel = body.channel ?? "grok_primary";
  const note =
    body.note ?? "PAPER_PROPOSAL_PENDING_NICK — no auto-execute; no keys; no tx";
  const exits = (body.exits ?? null) as Record<string, unknown> | null;
  const scores = (body.scores ?? null) as Record<string, unknown> | null;
  const sources = (body.sources ?? []) as Record<string, unknown>[];
  const tokenId = body.tokenId ?? null;
  const rationale = body.rationale ?? null;

  const db = getDb();
  if (!db) {
    const row: MemPurchaseProposal = {
      id: crypto.randomUUID(),
      tokenId,
      tokenAddress,
      size,
      slippageBps,
      exits,
      scores,
      sources,
      leadSource,
      rationale,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      channel,
      status: "pending_nick",
      note,
      approvedAt: null,
      rejectedAt: null,
      createdAt: new Date().toISOString(),
    };
    memPurchaseProposals.unshift(row);
    return c.json(
      { data: toPhonePayload(row), source: "memory", paperOnly: true, signed: false, txSubmitted: false },
      201
    );
  }

  const [row] = await db
    .insert(purchaseProposals)
    .values({
      tokenId,
      tokenAddress,
      size,
      slippageBps,
      exits: exits ?? undefined,
      scores: scores ?? undefined,
      sources,
      leadSource,
      rationale,
      expiresAt,
      channel,
      status: "pending_nick",
      note,
    })
    .returning();

  await db.insert(auditLog).values({
    action: "purchase_proposal_created",
    actor: "desk",
    detail: { id: row.id, tokenAddress: row.tokenAddress, status: row.status, paperOnly: true },
  });

  return c.json(
    { data: toPhonePayload(row), source: "postgres", paperOnly: true, signed: false, txSubmitted: false },
    201
  );
});

purchaseProposalRoutes.post("/:id/approve", async (c) => {
  const id = c.req.param("id");
  const actorBody = (await c.req.json().catch(() => ({}))) as { actor?: string };
  const actor = actorBody.actor ?? "nick_grok";
  const db = getDb();

  if (!db) {
    const row = memPurchaseProposals.find((p) => p.id === id);
    if (!row) return c.json({ error: "not_found" }, 404);
    if (row.status !== "pending_nick") {
      return c.json({ error: "not_pending_nick", status: row.status }, 409);
    }
    if (isExpired(row.expiresAt)) {
      row.status = "expired";
      return c.json({ error: "expired", data: toPhonePayload(row) }, 409);
    }
    row.status = "approved";
    row.approvedAt = new Date().toISOString();
    row.note = "PAPER_APPROVED — revalidate then signer_handoff_stub; no sign";
    return c.json({
      data: toPhonePayload(row),
      next: "signer_handoff_stub",
      revalidateRequired: true,
      signed: false,
      txSubmitted: false,
      source: "memory",
      paperOnly: true,
      note: "Paper path only. No keys. No tx. Live signer is a separate service.",
    });
  }

  const [existing] = await db.select().from(purchaseProposals).where(eq(purchaseProposals.id, id));
  if (!existing) return c.json({ error: "not_found" }, 404);
  if (existing.status !== "pending_nick") {
    return c.json({ error: "not_pending_nick", status: existing.status }, 409);
  }
  if (isExpired(existing.expiresAt)) {
    const [expired] = await db
      .update(purchaseProposals)
      .set({ status: "expired" })
      .where(eq(purchaseProposals.id, id))
      .returning();
    return c.json({ error: "expired", data: toPhonePayload(expired) }, 409);
  }

  const [row] = await db
    .update(purchaseProposals)
    .set({
      status: "approved",
      approvedAt: new Date(),
      note: "PAPER_APPROVED — revalidate then signer_handoff_stub; no sign",
    })
    .where(eq(purchaseProposals.id, id))
    .returning();

  await db.insert(auditLog).values({
    action: "purchase_proposal_approved",
    actor,
    detail: {
      id: row.id,
      tokenAddress: row.tokenAddress,
      next: "signer_handoff_stub",
      revalidateRequired: true,
      signed: false,
      txSubmitted: false,
      paperOnly: true,
    },
  });

  return c.json({
    data: toPhonePayload(row),
    next: "signer_handoff_stub",
    revalidateRequired: true,
    signed: false,
    txSubmitted: false,
    source: "postgres",
    paperOnly: true,
    note: "Paper path only. No keys. No tx. Live signer is a separate service.",
  });
});

purchaseProposalRoutes.post("/:id/reject", async (c) => {
  const id = c.req.param("id");
  const actorBody = (await c.req.json().catch(() => ({}))) as {
    actor?: string;
    reason?: string;
  };
  const actor = actorBody.actor ?? "nick_grok";
  const db = getDb();

  if (!db) {
    const row = memPurchaseProposals.find((p) => p.id === id);
    if (!row) return c.json({ error: "not_found" }, 404);
    if (row.status !== "pending_nick") {
      return c.json({ error: "not_pending_nick", status: row.status }, 409);
    }
    row.status = "rejected";
    row.rejectedAt = new Date().toISOString();
    row.note = actorBody.reason ? `REJECTED: ${actorBody.reason}` : "REJECTED_BY_NICK";
    return c.json({
      data: toPhonePayload(row),
      source: "memory",
      paperOnly: true,
      signed: false,
      txSubmitted: false,
    });
  }

  const [existing] = await db.select().from(purchaseProposals).where(eq(purchaseProposals.id, id));
  if (!existing) return c.json({ error: "not_found" }, 404);
  if (existing.status !== "pending_nick") {
    return c.json({ error: "not_pending_nick", status: existing.status }, 409);
  }

  const [row] = await db
    .update(purchaseProposals)
    .set({
      status: "rejected",
      rejectedAt: new Date(),
      note: actorBody.reason ? `REJECTED: ${actorBody.reason}` : "REJECTED_BY_NICK",
    })
    .where(eq(purchaseProposals.id, id))
    .returning();

  await db.insert(auditLog).values({
    action: "purchase_proposal_rejected",
    actor,
    detail: {
      id: row.id,
      tokenAddress: row.tokenAddress,
      reason: actorBody.reason ?? null,
      paperOnly: true,
    },
  });

  return c.json({
    data: toPhonePayload(row),
    source: "postgres",
    paperOnly: true,
    signed: false,
    txSubmitted: false,
  });
});
