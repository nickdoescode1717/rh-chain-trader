/**
 * Build paper signer-handoff stub payload after Nick Approves.
 * Single controlling key → multi-address (key NEVER here).
 * See docs/ISOLATED_SIGNER.md + docs/BUY_WALLETS.md.
 */

import { memBuyWallets, type BuyWalletRow } from "./routes/buy-wallets.js";

export type SignerHandoff = {
  version: 1;
  mode: "paper_stub";
  keyModel: "single_controlling_key_multi_address";
  proposalId: string;
  chainId: 4663;
  tokenCA: string | null;
  size: string | null;
  sizeEth: string | null;
  sizeUsd: string | null;
  slippageBps: number | null;
  exits: unknown;
  buyAddress: string | null;
  buyAddressCandidates: Array<{
    address: string;
    label: string | null;
    kind: string;
  }>;
  buyAddressSelection: string;
  signed: false;
  txSubmitted: false;
  enableTrading: false;
  note: string;
};

function listBuyWallets(): BuyWalletRow[] {
  return memBuyWallets.filter((w) => w.chainId === 4663);
}

function encodeSizeParts(size: string | null | undefined): {
  size: string | null;
  sizeEth: string | null;
  sizeUsd: string | null;
} {
  if (!size) return { size: null, sizeEth: null, sizeUsd: null };
  if (size.startsWith("eth:")) {
    return { size, sizeEth: size.slice(4), sizeUsd: null };
  }
  if (size.startsWith("usd:")) {
    return { size, sizeEth: null, sizeUsd: size.slice(4) };
  }
  return { size, sizeEth: null, sizeUsd: null };
}

/**
 * Build handoff stub. optionalPreferredBuy must be a registered buy address if set.
 * Never accepts or returns key material.
 */
export function buildSignerHandoffStub(input: {
  proposalId: string;
  tokenCA: string | null;
  size: string | null;
  slippageBps: number | null;
  exits: unknown;
  preferredBuyAddress?: string | null;
}): SignerHandoff {
  const candidates = listBuyWallets();
  const buyOnly = candidates.filter((w) => w.kind === "buy");
  const pool = buyOnly.length ? buyOnly : candidates;

  let buyAddress: string | null = null;
  let selection = "none_registered";

  const pref = input.preferredBuyAddress?.trim().toLowerCase() ?? null;
  if (pref) {
    const hit = pool.find((w) => w.address === pref);
    if (hit) {
      buyAddress = hit.address;
      selection = "explicit_registered";
    } else {
      selection = "explicit_not_registered_ignored";
    }
  }

  if (!buyAddress && pool.length) {
    buyAddress = pool[0]!.address;
    selection = buyOnly.length ? "first_buy" : "first_registered";
  }

  const parts = encodeSizeParts(input.size);
  const trading =
    process.env.ENABLE_TRADING === "true" ||
    process.env.ENABLE_TX_SUBMISSION === "true";

  return {
    version: 1,
    mode: "paper_stub",
    keyModel: "single_controlling_key_multi_address",
    proposalId: input.proposalId,
    chainId: 4663,
    tokenCA: input.tokenCA,
    size: parts.size,
    sizeEth: parts.sizeEth,
    sizeUsd: parts.sizeUsd,
    slippageBps: input.slippageBps,
    exits: input.exits ?? null,
    buyAddress,
    buyAddressCandidates: pool.map((w) => ({
      address: w.address,
      label: w.label,
      kind: w.kind,
    })),
    buyAddressSelection: selection,
    signed: false,
    txSubmitted: false,
    enableTrading: false,
    note: trading
      ? "ENABLE_TRADING is true in env but research API still refuses live sign — isolated signer not called."
      : "Stub — isolated signer not called. No key material. Paper only.",
  };
}

/** Reject approve bodies that try to smuggle keys */
export function rejectKeyFields(body: Record<string, unknown> | null): string | null {
  if (!body) return null;
  const banned = [
    "privateKey",
    "private_key",
    "key",
    "mnemonic",
    "seed",
    "secret",
    "pk",
  ];
  for (const k of banned) {
    if (body[k] != null && body[k] !== "") {
      return k;
    }
  }
  return null;
}
