/** JSON boundary helpers. Type assertions alone do not validate HTTP input. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Finite decimal notation only; preserve the caller's precision as text. */
export function decimalText(value: unknown, allowZero = false): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return null;
  const number = Number(text);
  if (!Number.isFinite(number) || (allowZero ? number < 0 : number <= 0)) return null;
  return text;
}
