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
  ledgerManaged?: boolean;
  remainingQuantity?: string | null;
  remainingCost?: string | null;
  realizedPnl?: string;
  id: string;
  tokenCA?: string;
  tokenAddress?: string;
  chainId?: number;
  size?: string | null;
  entryPrice?: string | null;
  currentPrice?: string | null;
  pnlPct?: number | null;
  pnlAbs?: number | string | null;
  markSource?: string;
  openedAt?: string | null;
  valuationStatus?: string;
  unrealizedPnl?: number | null;
  pnlCurrency?: string | null;
  currentValue?: number | null;
  entrySnapshot?: { currency: "ETH" | "USD"; unitPrice: number; quantity: number; capturedAt: string; quote: { observedAt: string; source: string } } | null;
  marketQuote?: { chainId: number; tokenAddress: string; priceUsd: number; priceEth: number; observedAt: string; source: string; url: string } | null;
  marketError?: string | null;
  markObservedAt?: string | null;
  status?: string;
  symbol?: string | null;
  proposalId?: string | null;
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
  ledgerReconciled?: boolean;
  realizedPnlEth?: string;
  accounts?: { currency: string; cash: string; realizedPnl: string }[];
  paperOnly: true;
  valuationComplete?: boolean;
  cashEth: string;
  equityEth: string;
  positions: Array<Position & {
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
  previewPaperSell: (id: string, percent: number, actor: string) => Promise<SellPreview>;
  confirmPaperSell: (id: string, actor: string) => Promise<{ fill: PaperFill; replayed: boolean }>;
  cancelPaperSell: (id: string, actor: string) => Promise<{ cancelled: boolean }>;
  listPaperFills: () => Promise<PaperFill[]>;
  baseUrl: string;
  listProposals: () => Promise<Proposal[]>;
  approveProposal: (id: string, actor: string) => Promise<unknown>;
  rejectProposal: (id: string, actor: string, reason?: string) => Promise<unknown>;
  listPositions: () => Promise<Position[] | null>;
  sellPosition: (positionId: string, actor: string) => Promise<unknown>;
  getPaperBalance: () => Promise<PaperBalance>;
  listResearchProjects: () => Promise<ResearchProject[]>;
  getResearchProject: (handle: string) => Promise<ResearchProject>;
  watchProject: (project: { handle: string; domain: string; category: string }) => Promise<ResearchProject>;
  setProjectMonitoring: (handle: string, enabled: boolean) => Promise<ResearchProject>;
};

export type PaperExecution = { mode: "paper"; side: "buy" | "sell"; quantity: string; fee: string; cashDelta: string;
  executionPrice: string; cost: string; realizedPnl: string; remainingQuantity?: string; remainingCost?: string };
export type PaperFill = { id: string; positionId: string; currency: string; side: "buy" | "sell";
  execution: PaperExecution; createdAt: string; quote: { tokenAddress: string } };
export type SellPreview = { id: string; positionId: string; tokenCA: string; percent: number; currency: string;
  minimumNet: string; expiresAt: string; preview: PaperExecution };

export type ResearchReport = {
  researchedAt: string;
  rating: { rating10: number | null; evidenceCoveragePct: number; supportedEvidencePoints: number;
    checks: { id: string; label: string; status: string }[] };
  subdomains: { discovered: number; errors: string[]; inspected: { host: string; status: number | null }[] };
  launchReadiness: { blockers: string[] };
  evidence: { id: string; url: string; kind: string; finding: string }[];
  grok?: { status: string; analysis: { summary: string; concerns: string[]; missingEvidence: string[] } | null };
};
export type ResearchProject = {
  id: string; handle: string; domain: string; category: string; enabled: boolean;
  lastResearchedAt: string | null; lastError: string | null; report?: ResearchReport | null;
};

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

async function jsonFetch(
  url: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
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

export function createApiClient(baseUrl: string, approvalToken = process.env.TELEGRAM_APPROVAL_TOKEN): ApiClient {
  async function paper<T>(path: string, body?: unknown): Promise<T> {
    const r = await jsonFetch(joinUrl(baseUrl, `/paper-sells/${path}`), body === undefined ? undefined : {
      method: "POST", headers: decisionHeaders(), body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(typeof (r.body as { error?: unknown })?.error === "string" ? (r.body as { error: string }).error : "paper_request_failed");
    return (r.body as { data: T }).data;
  }
  function decisionHeaders(): Record<string, string> {
    if (!approvalToken || approvalToken.length < 32) throw new Error("Telegram approval credential is not configured on the worker.");
    return { "x-telegram-approval-token": approvalToken };
  }
  async function research<T>(path: string, body?: unknown): Promise<T> {
    const result = await jsonFetch(joinUrl(baseUrl, `/research/${path}`), body === undefined ? undefined : {
      method: "POST", body: JSON.stringify(body),
    });
    if (!result.ok) throw new Error(`research_http_${result.status}`);
    if (!result.body || typeof result.body !== "object" || !("data" in result.body)) throw new Error("invalid_research_response");
    return (result.body as { data: T }).data;
  }
  return {
    baseUrl,
    previewPaperSell: (id, percent, actor) => paper<SellPreview>(`${encodeURIComponent(id)}/preview`, { percent, actor }),
    confirmPaperSell: (id, actor) => paper(`${encodeURIComponent(id)}/confirm`, { actor }),
    cancelPaperSell: (id, actor) => paper(`${encodeURIComponent(id)}/cancel`, { actor }),
    listPaperFills: () => paper<PaperFill[]>("history"),
    listResearchProjects: () => research<ResearchProject[]>("projects"),
    getResearchProject: (handle) => research<ResearchProject>(`projects/${encodeURIComponent(handle)}`),
    watchProject: (project) => research<ResearchProject>("projects", project),
    setProjectMonitoring: (handle, enabled) => research<ResearchProject>(`projects/${encodeURIComponent(handle)}/monitoring`, { enabled }),

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
        { method: "POST", headers: decisionHeaders(), body: JSON.stringify({ actor }) }
      );
      if (!ok) {
        throw new Error(`approveProposal failed: HTTP ${status} ${JSON.stringify(body)}`);
      }
      return body;
    },

    async rejectProposal(id, actor, reason) {
      const { ok, status, body } = await jsonFetch(
        joinUrl(baseUrl, `/purchase-proposals/${encodeURIComponent(id)}/reject`),
        { method: "POST", headers: decisionHeaders(), body: JSON.stringify({ actor, reason: reason ?? undefined }) }
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
