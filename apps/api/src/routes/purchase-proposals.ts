/**
 * Paper purchase proposals -- Nick approve/reject only.
 * Never signs / never submits txs. ENABLE_TRADING stays false.
 * Approve → open paper position + signer_handoff_stub (no key material).
 * See docs/PURCHASE_PROPOSALS.md + docs/POSITIONS.md + docs/ISOLATED_SIGNER.md
 */
import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { auditLog, positions, purchaseProposals, marketQuotes } from "@rh/db";
import { captureEntry, type EntrySnapshot, type MarketQuote } from "@rh/core";
import { getDb } from "../db.js";
import { isRecord } from "../validation.js";
import { telegramDecisionError } from "../telegram-approval.js";
import { ledgerBuy, ledgerEnabled, LedgerError } from "../paper-ledger.js";
import { dbRowToMem } from "../paper-positions-mem.js";
import {
  memPurchaseProposals,
  type MemPurchaseProposal,
} from "../purchase-proposals-mem.js";
import {
  openPaperFromProposal,
  toPositionPayload,
  memPaperPositions,
} from "../paper-positions-mem.js";
import {
  buildSignerHandoffStub,
  rejectKeyFields,
} from "../signer-handoff.js";
import {
  encodeSize,
  isExpired,
  normalizeAddress,
  toPhonePayload,
  type CreateBody,
} from "./purchase-proposals-helpers.js";

export const purchaseProposalRoutes = new Hono();

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
  const rawBody: unknown = await c.req.json().catch(() => null);
  if (!isRecord(rawBody)) return c.json({ error: "invalid_json" }, 400);
  const body = rawBody as CreateBody;
  for (const field of ["tokenId", "leadSource", "rationale", "expiresAt", "channel", "note"] as const) {
    if (body[field] != null && typeof body[field] !== "string") {
      return c.json({ error: `invalid_${field}` }, 400);
    }
  }
  for (const field of ["scores", "exits"] as const) {
    if (body[field] != null && !isRecord(body[field])) return c.json({ error: `invalid_${field}` }, 400);
  }
  if (body.sources != null && (!Array.isArray(body.sources) || !body.sources.every(isRecord))) {
    return c.json({ error: "invalid_sources" }, 400);
  }
  const keyField = rejectKeyFields(body as unknown as Record<string, unknown>);
  if (keyField) {
    return c.json(
      { error: "keys_not_accepted", field: keyField, hint: "Addresses only; key stays in isolated signer." },
      400
    );
  }
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
      { error: "invalid_size", hint: "Provide exactly one positive finite sizeEth, sizeUsd, or size ('eth:amount' / 'usd:amount')." },
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
  if (slippageBps !== null && (typeof body.slippageBps !== "number" || !Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 10_000)) {
    return c.json({ error: "invalid_slippageBps" }, 400);
  }

  let expiresAt: Date | null = null;
  if (body.expiresAt) {
    const t = Date.parse(body.expiresAt);
    if (!Number.isFinite(t)) return c.json({ error: "invalid_expiresAt" }, 400);
    expiresAt = new Date(t);
  }

  const channel = body.channel ?? "telegram";
  const note =
    body.note ?? "PAPER_PROPOSAL_PENDING_NICK -- no auto-execute; no keys; no tx";
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

function approveResponse(
  row: {
    id: string;
    tokenAddress: string | null;
    size: string | null;
    slippageBps: number | null;
    exits: unknown;
    scores?: unknown;
    rationale?: string | null;
  },
  source: "memory" | "postgres",
  preferredBuyAddress?: string | null,
  recordedPosition?: ReturnType<typeof openPaperFromProposal>
) {
  const pos = recordedPosition ?? openPaperFromProposal({
    id: row.id,
    tokenAddress: row.tokenAddress,
    size: row.size,
    scores: row.scores,
    rationale: row.rationale ?? null,
  });

  const signerHandoff = buildSignerHandoffStub({
    proposalId: row.id,
    tokenCA: row.tokenAddress,
    size: row.size,
    slippageBps: row.slippageBps,
    exits: row.exits,
    preferredBuyAddress,
  });
  return {
    data: toPhonePayload(row as Parameters<typeof toPhonePayload>[0]),
    position: toPositionPayload(pos),
    next: "signer_handoff_stub" as const,
    revalidateRequired: true,
    signed: false as const,
    txSubmitted: false as const,
    source,
    paperOnly: true as const,
    signerHandoff,
    note: "Paper path only. Position opened (simulated_open). No keys. No tx.",
  };
}

purchaseProposalRoutes.post("/:id/approve", async (c) => {
  const id = c.req.param("id");
  const actorBody = await c.req.json().catch(() => ({}));
  if (!isRecord(actorBody)) return c.json({ error: "invalid_json" }, 400);
  for (const field of ["actor", "buyAddress", "preferredBuyAddress"] as const) {
    if (actorBody[field] != null && typeof actorBody[field] !== "string") {
      return c.json({ error: `invalid_${field}` }, 400);
    }
  }
  const keyField = rejectKeyFields(actorBody as Record<string, unknown>);
  if (keyField) {
    return c.json(
      { error: "keys_not_accepted", field: keyField, hint: "Approve never accepts keys." },
      400
    );
  }
  const decisionError = telegramDecisionError(c.req.header("x-telegram-approval-token"), actorBody.actor);
  if (decisionError) return c.json({ error: decisionError.error }, decisionError.status);
  const actor = actorBody.actor as string;
  if (ledgerEnabled()) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return c.json({ error: "invalid_id" }, 400);
    try {
      const result = await ledgerBuy(id, actor);
      const p = dbRowToMem(result.position);
      p.marketQuote = result.fill.quote as MarketQuote;
      return c.json({ ...approveResponse(result.proposal, "postgres", null, p), fill: result.fill, replayed: result.replayed });
    } catch (e) { return c.json({ error: e instanceof LedgerError ? e.message : "paper_settlement_unavailable" }, e instanceof LedgerError ? e.status : 503); }
  }
  const preferred =
    (actorBody.buyAddress ?? actorBody.preferredBuyAddress ?? null) as string | null;
  const db = getDb();

  if (!db) {
    const row = memPurchaseProposals.find((p) => p.id === id);
    if (!row) return c.json({ error: "not_found" }, 404);
    if (process.env.MARKET_PRICING_ENABLED === "true") return c.json({ error: "entry_quote_storage_unavailable" }, 503);
    if (row.status !== "pending_nick") {
      return c.json({ error: "not_pending_nick", status: row.status }, 409);
    }
    if (isExpired(row.expiresAt)) {
      row.status = "expired";
      return c.json({ error: "expired", data: toPhonePayload(row) }, 409);
    }
    row.status = "approved";
    row.approvedAt = new Date().toISOString();
    row.note = "PAPER_APPROVED -- position opened + signer_handoff_stub; no sign";
    return c.json(approveResponse(row, "memory", preferred));
  }

  // Lock a proposal while recording its approval, immutable entry snapshot and position.
  // No memory mutation or success response until all writes commit.
  const result = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(purchaseProposals).where(eq(purchaseProposals.id, id)).for("update");
    if (!existing) return { error: "not_found", status: 404 as const };
    if (existing.status !== "pending_nick") return { error: "not_pending_nick", status: 409 as const };
    if (isExpired(existing.expiresAt)) return { error: "expired", status: 409 as const };
    let entrySnapshot: EntrySnapshot | null = null;
    if (process.env.MARKET_PRICING_ENABLED === "true") {
      const [cached] = await tx.select().from(marketQuotes).where(eq(marketQuotes.tokenAddress, (existing.tokenAddress ?? "").toLowerCase()));
      if (!cached || cached.lastError) return { error: "fresh_entry_quote_required", status: 409 as const };
      try { entrySnapshot = captureEntry(cached.quote as MarketQuote | null, existing.tokenAddress ?? "", existing.size); }
      catch { return { error: "fresh_entry_quote_required", status: 409 as const }; }
    }
    const pos = openPaperFromProposal({ ...existing, entrySnapshot, register: false });
    const [row] = await tx.update(purchaseProposals).set({ status: "approved", approvedAt: new Date(),
      note: "PAPER_APPROVED -- recorded position; no real transaction" }).where(eq(purchaseProposals.id, id)).returning();
    await tx.insert(positions).values({ id: pos.id, tokenAddress: pos.tokenAddress, size: pos.size, entryPrice: pos.entryPrice,
      currentPrice: pos.currentPrice, entrySnapshot: pos.entrySnapshot, markSource: pos.markSource,
      markObservedAt: pos.markObservedAt ? new Date(pos.markObservedAt) : null, proposalId: pos.proposalId,
      openedAt: new Date(pos.openedAt), status: "simulated_open", note: pos.note ?? "Paper position", channel: "telegram" });
    await tx.insert(auditLog).values({ action: "purchase_proposal_approved", actor,
      detail: { id: row.id, positionId: pos.id, paperOnly: true, signed: false, txSubmitted: false,
        entrySource: pos.entrySnapshot?.quote.source ?? "legacy_unpriced", entryObservedAt: pos.entrySnapshot?.quote.observedAt ?? null } });
    return { row, pos };
  });
  if ("error" in result) return c.json({ error: result.error, paperOnly: true }, result.status);
  memPaperPositions.unshift(result.pos);
  return c.json(approveResponse(result.row, "postgres", preferred, result.pos));
});

purchaseProposalRoutes.post("/:id/reject", async (c) => {
  const id = c.req.param("id");
  const actorBody = await c.req.json().catch(() => ({}));
  if (!isRecord(actorBody)) return c.json({ error: "invalid_json" }, 400);
  for (const field of ["actor", "reason"] as const) {
    if (actorBody[field] != null && typeof actorBody[field] !== "string") {
      return c.json({ error: `invalid_${field}` }, 400);
    }
  }
  const decisionError = telegramDecisionError(c.req.header("x-telegram-approval-token"), actorBody.actor);
  if (decisionError) return c.json({ error: decisionError.error }, decisionError.status);
  const actor = actorBody.actor as string;
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
    .where(and(eq(purchaseProposals.id, id), eq(purchaseProposals.status, "pending_nick")))
    .returning();
  if (!row) return c.json({ error: "not_pending_nick" }, 409);

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
