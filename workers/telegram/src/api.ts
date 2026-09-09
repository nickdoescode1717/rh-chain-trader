/**
 * Thin HTTP client for paper API (proposals, positions, paper balance).
 * Never loads keys. Never signs/submits txs.
 */

export type Proposal = {
  id: string;
  tokenCA?: string;
  tokenAddress?: string;
  chainId?: number;
  sizeEth?: string | null;
  sizeUsd?: string | null;
  size?: string | null;
  slippageBps?: number | null;
  exits?: Record<string, unknown> | null;
  scores?: Record<string, unknown> | null;
  sources?: unknown[];
  leadSource?: string | null;
  rationale?: string | null;
  expiresAt?: string | null;
  status?: string;
  channels?: Record<string, string>;
  [key: string]: unknown;
};

export type Position = {
  id: string;
  tokenCA?: string;
  chainId?: number;
  size?: string | null;
  entryPrice?: string | null;
  currentPrice?: string | null;
  pnlPct?: number | null;
  pnlAbs?: number | null;
  status?: string;
  symbol?: string | null;
  [key: string]: unknown;
};

export type BuyWallet = {
  address: string;
  label?: string | null;
  kind?: string;
  chainId?: number;
  nativeEth?: string | null;
  note?: string | null;
};

export type PaperBalance = {
  paperOnly: true;
  cashEth: string;
  equityEth: string;
  positions: Array<{
    id: string;
    tokenCA?: string;
    symbol?: string;
    size?: string;
    entryPrice?: string;
    mark?: string;
    markSource?: string;
    markLabel?: string;
    unrealizedPct?: number | null;
    unrealizedEth?: number | null;
    unrealizedUsd?: number | null;
    pnlPct?: number | null;
  }>;
  buyWallets: BuyWallet[];
  totals: {
    cashEth: string;
    positionsEth?: string;
    unrealizedEth?: string;
    equityEth: string;
  };
  note?: string;
};

export type ApiClient = {
  baseUrl: string;
  listProposals: () => Promise<Proposal[]>;
  approveProposal: (id: string, actor: string) => Promise<unknown>;
  rejectProposal: (id: string, actor: string, reason?: string) => Promise<unknown>;
  listPositions: () => Promise<Position[] | null>;
  sellPosition: (positionId: string, actor: string) => Promise<unknown>;
  getPaperBalance: () => Promise<PaperBalance>;
};

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

async function jsonFetch(
  url: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }
  return { ok: res.ok, status: res.status, body };
}

export function createApiClient(baseUrl: string): ApiClient {
  return {
    baseUrl,

    async listProposals() {
      const { ok, status, body } = await jsonFetch(
        joinUrl(baseUrl, "/purchase-proposals")
      );
      if (!ok) throw new Error(`listProposals failed: HTTP ${status}`);
      const data = (body as { data?: Proposal[] })?.data;
      return Array.isArray(data) ? data : [];
    },

    async approveProposal(id, actor) {
      const { ok, status, body } = await jsonFetch(
        joinUrl(baseUrl, `/purchase-proposals/${encodeURIComponent(id)}/approve`),
        { method: "POST", body: JSON.stringify({ actor }) }
      );
      if (!ok) {
        throw new Error(`approveProposal failed: HTTP ${status} ${JSON.stringify(body)}`);
      }
      return body;
    },

    async rejectProposal(id, actor, reason) {
      const { ok, status, body } = await jsonFetch(
        joinUrl(baseUrl, `/purchase-proposals/${encodeURIComponent(id)}/reject`),
        { method: "POST", body: JSON.stringify({ actor, reason: reason ?? undefined }) }
      );
      if (!ok) {
        throw new Error(`rejectProposal failed: HTTP ${status} ${JSON.stringify(body)}`);
      }
      return body;
    },

    async listPositions() {
      const { ok, status, body } = await jsonFetch(joinUrl(baseUrl, "/positions"));
      if (status === 403 || status === 404) return null;
      if (!ok) throw new Error(`listPositions failed: HTTP ${status}`);
      const data = (body as { data?: Position[] })?.data;
      return Array.isArray(data) ? data : [];
    },

    async sellPosition(positionId, actor) {
      const { ok, status, body } = await jsonFetch(
        joinUrl(baseUrl, `/positions/${encodeURIComponent(positionId)}/sell`),
        { method: "POST", body: JSON.stringify({ actor, mode: "full", paper: true }) }
      );
      if (!ok) {
        throw new Error(`sellPosition failed: HTTP ${status} ${JSON.stringify(body)}`);
      }
      return body;
    },

    async getPaperBalance() {
      const { ok, status, body } = await jsonFetch(
        joinUrl(baseUrl, "/paper-balance")
      );
      if (!ok) throw new Error(`getPaperBalance failed: HTTP ${status}`);
      const data = (body as { data?: PaperBalance })?.data ?? (body as PaperBalance);
      return data as PaperBalance;
    },
  };
}
