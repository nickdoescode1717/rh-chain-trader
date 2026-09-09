import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ApiClient, ResearchProject } from "./api.js";
import { candidateAddresses, formatResearchProject, type BotCard } from "./research.js";

export type AlertState = Record<string, { snapshot: string; signature: string }>;
export interface AlertStore { load(): AlertState; save(state: AlertState): void }

export function fileAlertStore(path: string): AlertStore {
  return {
    load() {
      if (!existsSync(path)) return {};
      const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("invalid_research_alert_state");
      const state: AlertState = {};
      for (const [key, value] of Object.entries(raw)) {
        if (!value || typeof value !== "object" || typeof value.snapshot !== "string" || typeof value.signature !== "string") throw new Error("invalid_research_alert_state");
        state[key] = { snapshot: value.snapshot, signature: value.signature };
      }
      return state;
    },
    save(state) {
      mkdirSync(dirname(path), { recursive: true });
      const temporary = `${path}.tmp`;
      writeFileSync(temporary, JSON.stringify(state), { encoding: "utf8", mode: 0o600 });
      renameSync(temporary, path);
    },
  };
}

/** Ignore timestamps, prose rewrites and ordinary post chatter. Alert only on structural research changes. */
export function researchSignature(project: ResearchProject): string {
  const report = project.report;
  if (!report) return "";
  return createHash("sha256").update(JSON.stringify({ domain: project.domain, category: project.category,
    rating: report.rating.rating10, coverage: report.rating.evidenceCoveragePct,
    checks: report.rating.checks.map((c) => [c.id, c.status]).sort((a, b) => a[0].localeCompare(b[0])),
    hosts: report.subdomains.inspected.map((s) => [s.host, s.status]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    blockers: [...report.launchReadiness.blockers].sort(), addresses: candidateAddresses(project),
  })).digest("hex");
}

export function createResearchAlerts(api: Pick<ApiClient, "listResearchProjects" | "getResearchProject">,
  store: AlertStore, destination: string, deliver: (card: BotCard) => Promise<void>) {
  let state = store.load(), running = false, cursor = 0;
  return async () => {
    if (running) return;
    running = true;
    try {
      const projects = (await api.listResearchProjects()).filter((p) => p.enabled && p.lastResearchedAt && !p.lastError);
      // Bounded detail fetches with round-robin fairness; don't reread unchanged snapshots.
      const ordered = [...projects.slice(cursor), ...projects.slice(0, cursor)];
      let inspected = 0;
      for (const project of ordered) {
        const key = `${destination}:${project.handle}`;
        if (state[key]?.snapshot === project.lastResearchedAt) continue;
        if (inspected++ >= 5) break;
        cursor = projects.length ? (projects.indexOf(project) + 1) % projects.length : 0;
        try {
          const detail = await api.getResearchProject(project.handle);
          if (!detail.enabled || !detail.report || detail.lastError || !detail.lastResearchedAt) continue;
          const signature = researchSignature(detail);
          if (state[key]?.signature !== signature) {
            const card = formatResearchProject(detail);
            card.text = `RESEARCH UPDATE\n${card.text}`;
            await deliver(card);
          }
          const next = { ...state, [key]: { snapshot: detail.lastResearchedAt, signature } };
          store.save(next); state = next;
        } catch { console.warn("[telegram] project alert unavailable; will retry"); }
      }
    } finally { running = false; }
  };
}
