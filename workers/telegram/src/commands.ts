/**
 * TG text commands + post-approve paper fill delivery helpers.
 */

import type { ApiClient, Position } from "./api.js";
import {
  formatBalance,
  formatPaperFillSuccess,
  formatPositionsList,
} from "./format.js";

export function isBalanceCommand(text: string | undefined): boolean {
  if (!text) return false;
  const t = text.trim().split(/\s+/)[0] ?? "";
  const base = t.split("@")[0]?.toLowerCase() ?? "";
  return base === "/balance" || base === "/bal";
}

export function isPositionsCommand(text: string | undefined): boolean {
  if (!text) return false;
  const t = text.trim().split(/\s+/)[0] ?? "";
  const base = t.split("@")[0]?.toLowerCase() ?? "";
  return base === "/positions" || base === "/pos";
}

export function fillFromApprove(apiBody: unknown, proposalId: string) {
  const body = (apiBody ?? {}) as Record<string, unknown>;
  const data = (body.data ?? {}) as Record<string, unknown>;
  const handoff = (body.signerHandoff ?? {}) as Record<string, unknown>;
  const position = (body.position ?? {}) as Record<string, unknown>;
  const s = (v: unknown) => (v == null ? null : String(v));
  return formatPaperFillSuccess({
    proposalId,
    positionId: s(position.id),
    status: s(data.status) ?? "approved",
    size: s(data.size) ?? s(handoff.size) ?? s(position.size),
    sizeEth: s(data.sizeEth) ?? s(handoff.sizeEth),
    sizeUsd: s(data.sizeUsd) ?? s(handoff.sizeUsd),
    tokenCA: s(data.tokenCA) ?? s(handoff.tokenCA) ?? s(position.tokenCA),
    symbol: s(data.tokenSymbol) ?? s(data.symbol) ?? s(position.symbol),
    price: s(position.entryPrice),
    next: s(body.next) ?? "signer_handoff_stub",
    signed: body.signed === true,
    txSubmitted: body.txSubmitted === true,
    buyAddress: s(handoff.buyAddress),
    buyAddressSelection: s(handoff.buyAddressSelection),
    keyModel: s(handoff.keyModel) ?? "single_controlling_key_multi_address",
  });
}

/** Catch-up fill from open position row (after TG restart). */
export function fillFromPosition(pos: Position, proposalId: string) {
  const s = (v: unknown) => (v == null ? null : String(v));
  const size = s(pos.size);
  const sizeEth =
    size && size.startsWith("eth:") ? size.slice(4) : null;
  return formatPaperFillSuccess({
    proposalId,
    positionId: s(pos.id),
    status: "approved",
    size,
    sizeEth,
    tokenCA: s(pos.tokenCA) ?? s(pos.tokenAddress),
    symbol: s(pos.symbol),
    price: s(pos.entryPrice),
    next: "signer_handoff_stub",
    signed: false,
    txSubmitted: false,
    keyModel: "single_controlling_key_multi_address",
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

export async function handlePositionsCommand(
  api: ApiClient,
  chatId: number | string,
  configuredChatId: string | undefined,
  send: (chatId: number | string, text: string) => Promise<unknown>
): Promise<void> {
  if (configuredChatId && String(chatId) !== String(configuredChatId)) {
    console.log(`[telegram] /positions ignored — chat ${chatId} != configured`);
    return;
  }
  try {
    const positions = await api.listPositions();
    if (positions == null) {
      await send(chatId, "—— PAPER POSITIONS ——\nAPI returned 403/404 — redeploy api with GET /positions.");
      return;
    }
    const msg = formatPositionsList(positions);
    await send(chatId, msg.text);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await send(
      chatId,
      "—— PAPER POSITIONS ——\nUnavailable: " + detail + "\nPAPER ONLY."
    );
  }
}
