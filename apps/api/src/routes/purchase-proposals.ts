/**
 * Paper purchase proposals -- Nick approve/reject only.
 * Never signs / never submits txs. ENABLE_TRADING stays false.
 * Approve → open paper position + signer_handoff_stub (no key material).
 * See docs/PURCHASE_PROPOSALS.md + docs/POSITIONS.md + docs/ISOLATED_SIGNER.md
 */
import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { auditLog, positions, purchaseProposals } from "@rh/db";
import { getDb } from "../db.js";
import {
  memPurchaseProposals,
  type MemPurchaseProposal,
} from "../purchase-proposals-mem.js";
import {
  openPaperFromProposal,
  toPositionPayload,
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
  const body = (await c.req.json().catch(() => null)) as CreateBody | null;
  if (!body) return c.json({ error: "invalid_json" }, 400);
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

async function persistPositionDb(
  pos: ReturnType<typeof openPaperFromProposal>
): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.insert(positions).values({
      id: pos.id,
      tokenAddress: pos.tokenAddress,
      size: pos.size ?? undefined,
      entryPrice: pos.entryPrice ?? undefined,
      currentPrice: pos.currentPrice ?? undefined,
      pnlAbs: pos.pnlAbs ?? undefined,
      pnlPct: pos.pnlPct ?? undefined,
      proposalId: pos.proposalId ?? undefined,
      openedAt: new Date(pos.openedAt),
      status: "simulated_open",
      note: pos.note ?? "PAPER simulated_open from Approve",
      channel: "grok_primary",
    });
  } catch (err) {
    console.warn(
      "[purchase-proposals] positions insert failed (mem still has it):",
      err instanceof Error ? err.message : err
    );
  }
}

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
  preferredBuyAddress?: string | null
) {
  const pos = openPaperFromProposal({
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
  const actorBody = (await c.req.json().catch(() => ({}))) as {
    actor?: string;
    buyAddress?: string;
    preferredBuyAddress?: string;
  };
  const keyField = rejectKeyFields(actorBody as Record<string, unknown>);
  if (keyField) {
    return c.json(
      { error: "keys_not_accepted", field: keyField, hint: "Approve never accepts keys." },
      400
    );
  }
  const actor = actorBody.actor ?? "nick_grok";
  const preferred =
    actorBody.buyAddress ?? actorBody.preferredBuyAddress ?? null;
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
    row.note = "PAPER_APPROVED -- position opened + signer_handoff_stub; no sign";
    return c.json(approveResponse(row, "memory", preferred));
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
      note: "PAPER_APPROVED -- position opened + signer_handoff_stub; no sign",
    })
    .where(eq(purchaseProposals.id, id))
    .returning();

  const resp = approveResponse(row, "postgres", preferred);
  await persistPositionDb(
    openPaperFromProposal({
      id: row.id,
      tokenAddress: row.tokenAddress,
      size: row.size,
      scores: row.scores,
      rationale: row.rationale,
    })
  );

  await db.insert(auditLog).values({
    action: "purchase_proposal_approved",
    actor,
    detail: {
      id: row.id,
      tokenAddress: row.tokenAddress,
      next: "signer_handoff_stub",
      positionId: resp.position.id,
      revalidateRequired: true,
      signed: false,
      txSubmitted: false,
      paperOnly: true,
      buyAddress: resp.signerHandoff.buyAddress,
      buyAddressSelection: resp.signerHandoff.buyAddressSelection,
      keyModel: resp.signerHandoff.keyModel,
    },
  });

  return c.json(resp);
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
