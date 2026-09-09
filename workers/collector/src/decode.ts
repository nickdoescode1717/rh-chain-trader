/**
 * Minimal ABI / log decoding for launch ingest (read-only).
 */

/** Extract 20-byte address from a 32-byte topic or ABI word. */
export function addressFromWord(word: string | undefined | null): string | null {
  if (!word) return null;
  const hex = word.toLowerCase().replace(/^0x/, "");
  if (hex.length < 40) return null;
  const addr = "0x" + hex.slice(-40);
  if (!/^0x[0-9a-f]{40}$/.test(addr)) return null;
  if (addr === "0x0000000000000000000000000000000000000000") return null;
  return addr;
}

/** Pons V2: indexed token = topics[1] */
export function tokenFromPonsV2Log(topics: string[]): string | null {
  return addressFromWord(topics[1]);
}

/**
 * pools.trade TokenCreated(address): prefer first data word, fall back to topics[1].
 */
export function tokenFromPoolsTradeLog(
  topics: string[],
  data: string
): string | null {
  const fromData = addressFromWord(data?.slice(0, 66));
  if (fromData) return fromData;
  return addressFromWord(topics[1]);
}

/** Decode ABI-encoded string from eth_call result. */
export function abiDecodeString(hex: string | null | undefined): string | null {
  if (!hex || hex === "0x" || hex.length < 2 + 64 + 64) return null;
  try {
    const raw = hex.replace(/^0x/, "");
    const offset = Number.parseInt(raw.slice(0, 64), 16);
    if (!Number.isFinite(offset) || offset < 0) return null;
    const offsetNibbles = offset * 2;
    const lenHex = raw.slice(offsetNibbles, offsetNibbles + 64);
    if (lenHex.length < 64) return null;
    const len = Number.parseInt(lenHex, 16);
    if (!Number.isFinite(len) || len < 0 || len > 10_000) return null;
    const dataStart = offsetNibbles + 64;
    const dataHex = raw.slice(dataStart, dataStart + len * 2);
    if (dataHex.length < len * 2) return null;
    const bytes = Buffer.from(dataHex, "hex");
    const s = bytes.toString("utf8").replace(/\0/g, "").trim();
    return s.length ? s : null;
  } catch {
    return null;
  }
}

/** Decode uint8 / uint256 decimals from eth_call. */
export function abiDecodeUint(hex: string | null | undefined): number | null {
  if (!hex || hex === "0x") return null;
  try {
    const n = Number(BigInt(hex));
    if (!Number.isFinite(n) || n < 0 || n > 255) return null;
    return n;
  } catch {
    return null;
  }
}

export const ERC20_SELECTORS = {
  name: "0x06fdde03",
  symbol: "0x95d89b41",
  decimals: "0x313ce567",
} as const;
