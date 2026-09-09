const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export interface TokenRow {
  id: string;
  address: string;
  symbol: string;
  name: string;
  category: string;
  chainId: number;
  description: string | null;
  isWatchlisted: boolean;
  latestScore?: {
    opportunity: number;
    risk: number;
    evidenceConfidence: number;
    framework: string;
  } | null;
  dataLabel?: string;
}

export interface ProtocolRow {
  id: string;
  name: string;
  slug: string;
  kind: string;
  factoryAddress: string | null;
  factoryAddressStatus?: string;
  notes: string | null;
  verifiedOnchain: boolean;
  website: string | null;
}

export const api = {
  health: () => get<{ status: string; db: string; chainId: number }>("/health"),
  tokens: () => get<{ data: TokenRow[]; source: string }>("/tokens"),
  token: (id: string) =>
    get<{
      data: TokenRow & {
        scores: Array<Record<string, unknown>>;
        evidence: Array<Record<string, unknown>>;
        blockscoutUrl?: string;
      };
      source: string;
    }>(`/tokens/${id}`),
  watchlist: () => get<{ data: TokenRow[]; source: string }>("/watchlist"),
  protocols: () =>
    get<{ data: ProtocolRow[]; source: string; chainId: number }>("/protocols"),
};
