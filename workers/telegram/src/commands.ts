/**
 * TG text commands + post-approve paper fill delivery helpers.
 */

import type { ApiClient } from "./api.js";
import { formatBalance, formatPaperFillSuccess } from "./format.js";

export function isBalanceCommand(text: string | undefined): boolean {
  if (!text) return false;
  const t = text.trim().split(/\s+/)[0] ?? "";
  const base = t.split("@")[0]?.toLowerCase() ?? "";
  return base === "/balance" || base === "/bal";
}

export function fillFromApprove(apiBody: unknown, proposalId: string) {
  const body = (apiBody ?? {}) as Record<string, unknown>;
  const data = (body.data ?? {}) as Record<string, unknown>;
  const s = (v: unknown) => (v == null ? null : String(v));
  return formatPaperFillSuccess({
    proposalId,
    status: s(data.status) ?? "approved",
    size: s(data.size),
    sizeEth: s(data.sizeEth),
    sizeUsd: s(data.sizeUsd),
    tokenCA: s(data.tokenCA),
    symbol: s(data.tokenSymbol) ?? s(data.symbol),
    price: null,
    next: s(body.next) ?? "signer_handoff_stub",
    signed: body.signed === true,
    txSubmitted: body.txSubmitted === true,
  });
}

export async function handleBalanceCommand(
  api: ApiClient,
  chatId: number | string,
  configuredChatId: string | undefined,
  send: (chatId: number | string, text: string) => Promise<unknown>
): Promise<void> {
  if (configuredChatId && String(chatId) !== String(configuredChatId)) {
    console.log(`[telegram] /balance ignored — chat ${chatId} != configured`);
    return;
  }
  try {
    const bal = await api.getPaperBalance();
    const msg = formatBalance(bal);
    await send(chatId, msg.text);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await send(
      chatId,
      "—— PAPER BALANCE ——\nUnavailable: " +
        detail +
        "\n(API /paper-balance). Watched alphas never included. PAPER ONLY."
    );
  }
}
