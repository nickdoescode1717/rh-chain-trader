/**
 * Map Telegram callback_data → paper API posts.
 * actor = telegram:<userId>
 * Approve → signer_handoff_stub only. Never signs.
 */

import type { ApiClient } from "./api.js";
import { parseCallbackData } from "./format.js";

export type CallbackResult = {
  ok: boolean;
  action: string;
  detail: string;
  proposalId?: string;
  positionId?: string;
  apiBody?: unknown;
};

export async function handleCallback(
  api: ApiClient,
  callbackData: string,
  telegramUserId: string | number
): Promise<CallbackResult> {
  const parsed = parseCallbackData(callbackData);
  if (!parsed) {
    return { ok: false, action: "unknown", detail: `bad callback_data: ${callbackData}` };
  }

  const actor = `telegram:${telegramUserId}`;

  try {
    if (parsed.action === "approve") {
      const apiBody = await api.approveProposal(parsed.id, actor);
      const next =
        typeof apiBody === "object" &&
        apiBody &&
        "next" in apiBody &&
        (apiBody as { next?: string }).next
          ? String((apiBody as { next: string }).next)
          : "signer_handoff_stub";
      return {
        ok: true,
        action: "approve",
        proposalId: parsed.id,
        detail: `Approved paper proposal ${parsed.id} → ${next} (no sign)`,
        apiBody,
      };
    }

    if (parsed.action === "reject") {
      const apiBody = await api.rejectProposal(parsed.id, actor);
      return {
        ok: true,
        action: "reject",
        proposalId: parsed.id,
        detail: `Skipped paper proposal ${parsed.id}`,
        apiBody,
      };
    }

    if (parsed.action === "sell") {
      const apiBody = await api.sellPosition(parsed.positionId, actor);
      return {
        ok: true,
        action: "sell",
        positionId: parsed.positionId,
        detail: `Paper sell proposed for position ${parsed.positionId} (no live sell)`,
        apiBody,
      };
    }

    return { ok: false, action: "unknown", detail: "unreachable" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/fresh_entry_quote_required|entry_quote_storage_unavailable/.test(msg)) {
      return { ok: false, action: parsed.action, detail: "A fresh eligible price is needed. Try Approve again in a minute. No position opened." };
    }
    return { ok: false, action: parsed.action, detail: msg };
  }
}
