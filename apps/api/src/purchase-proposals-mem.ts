/** Paper purchase proposals memory fallback. Never auto-execute. */
export interface MemPurchaseProposal {
  projectHandle?: string | null;
  id: string;
  tokenId: string | null;
  tokenAddress: string | null;
  size: string | null;
  slippageBps: number | null;
  exits: Record<string, unknown> | null;
  scores: Record<string, unknown> | null;
  sources: Record<string, unknown>[];
  leadSource: string | null;
  rationale: string | null;
  expiresAt: string | null;
  channel: string | null;
  status: string;
  note: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
}

export const memPurchaseProposals: MemPurchaseProposal[] = [];
