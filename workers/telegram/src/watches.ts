import { createHash } from "node:crypto";
import type { ApiClient, WatchTarget, XUsage } from "./api.js";
import type { BotCard } from "./research.js";
import type { AlertStore } from "./research-alerts.js";
type WatchApi = Pick<ApiClient, "addWatch" | "getWatch" | "listWatches" | "monitorWatch" | "listResearchProjects"> & Partial<Pick<ApiClient, "getXUsage" | "flagLaunch">>;
const clean = (s: string, n = 250) => s.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, " ").slice(0, n);
const button = (text: string, callback_data: string) => ({ text, callback_data });
export function formatWatch(w: WatchTarget): BotCard {
  const d = w.discovery, r = w.report;
  const lines = [`WATCH · ${clean(w.handle ? `@${w.handle}` : w.domain ?? w.inputKey)}`, w.enabled ? "Watching" : "Paused"];
  if (!d) lines.push("Saved. I’ll find linked accounts, the website and public project evidence, then send an update here.");
  else {
    lines.push(`Website: ${clean(d.domain ?? "not found yet")}`,
      `X account: ${d.primaryHandle ? `@${clean(d.primaryHandle)}` : "not uniquely identified"}`, `Checked: ${clean(d.observedAt)}`);
    if (d.accounts.length) lines.push("\nLINKED ACCOUNTS · affiliations unverified",
      ...d.accounts.slice(0, 8).map(a => `@${clean(a.handle)} · ${clean(a.relation.replaceAll("_", " "), 55)}`));
    if (d.links.length) lines.push("\nDOCS / PROJECT LINKS", ...d.links.slice(0, 3).map(l => clean(l.url)));
    if (d.addresses.length) lines.push("\nMENTIONED ADDRESSES · ownership unverified", ...d.addresses.slice(0, 2).map(a => `${a.address}\n${clean(a.sourceUrl)}`));
    if (r) lines.push(`\nEvidence rating: ${r.rating.rating10 == null ? "insufficient evidence" : `${r.rating.rating10}/10`}`,
      `Coverage: ${r.rating.evidenceCoveragePct}% · Public subdomains: ${r.subdomains.discovered}`);
    if (r && !w.projectHandle) {
      lines.push(...r.rating.checks.filter(c => c.status !== "unknown").slice(0, 3).map(c => `${clean(c.label)}: ${clean(c.status)}`));
      if (r.grok?.analysis) lines.push(`Grok: ${clean(r.grok.analysis.summary, 350)}`);
    }
    if (d.gaps.includes("twitterapi_setup_pending")) lines.push("\nX profile/posts collection is waiting for TwitterAPI.io setup. Website research continues where a domain is available.");
    if (d.gaps.includes("x_daily_budget_exhausted")) lines.push("\nX data allowance is exhausted. Website research continues; use /usage to check the budget.");
    const gaps = d.gaps.filter(g => g !== "twitterapi_setup_pending");
    if (gaps.length) lines.push(`Coverage notes: ${clean(gaps.join("; ").replaceAll("_", " "), 450)}`);
  }
  if (w.lastError && w.lastError !== "scan_in_progress") lines.push("The latest scan failed. Saved results may be older; collection will retry.");
  lines.push("\nDiscovery does not verify a token or approve a purchase.");
  return { text: lines.join("\n").slice(0, 3900), reply_markup: { inline_keyboard: [
    [button("Refresh", `watch:show:${w.id}`), button(w.enabled ? "Pause" : "Resume", `watch:${w.enabled ? "pause" : "resume"}:${w.id}`)],
    [button(w.launchFlag ? "Launch preparation" : "Flag upcoming launch", `watch:${w.launchFlag ? "launch" : "flag"}:${w.id}`)],
    ...(w.projectHandle ? [[button("Full research", `research:report:${w.projectHandle}`), button("Token identity", `identity:list:${w.projectHandle}`)]] : []),
    [button("All watches", "watch:list:0"), button("X data budget", "watch:usage:0")],
  ] } };
}
export async function handleWatchInput(api: WatchApi, input: string, actor: string): Promise<BotCard | null> {
  const [command, ...args] = input.trim().split(/\s+/), base = command.toLowerCase().split("@")[0];
  const callback = input.startsWith("watch:");
  if (!callback && base !== "/watch" && base !== "/launch" && base !== "/projects" && base !== "/usage") return null;
  // Preserve the old explicit mapping command for existing users.
  if (base === "/watch" && args.length > 1) return null;
  try {
    if (base === "/launch") {
      if (args.length !== 1) return { text: "Send /launch @account or /launch project.com. I’ll watch it and investigate deployment clues within the existing data budget. Collection stays under /stop and /status controls." };
      return formatLaunch(await api.addWatch(args[0], actor, true));
    }
    if (base === "/usage" || input === "watch:usage:0") return formatXUsage(await api.getXUsage!());
    if (base === "/watch") {
      if (args.length !== 1) return { text: "Send /watch @account, /watch https://x.com/account, or /watch project.com. I’ll find the rest." };
      return formatWatch(await api.addWatch(args[0], actor));
    }
    const [, action, id] = input.split(":");
    if (callback && action !== "list") {
      if (/^[a-f0-9-]{36}$/.test(id ?? "") && ["launch", "flag", "unflag"].includes(action)) {
        return formatLaunch(action === "launch" ? await api.getWatch(id) : await api.flagLaunch!(id, action === "flag", actor));
      }
      if (!/^[a-f0-9-]{36}$/.test(id ?? "") || !["show", "pause", "resume"].includes(action)) return { text: "Use /projects to open a watch." };
      return formatWatch(action === "show" ? await api.getWatch(id) : await api.monitorWatch(id, action === "resume", actor));
    }
    const page = Number(callback ? id : args[0] ?? 0);
    if (!Number.isSafeInteger(page) || page < 0) return { text: "Use /projects to see your watches." };
    const watches = await api.listWatches(), projects = await api.listResearchProjects();
    const linked = new Set(watches.map(w => w.projectHandle));
    const rows = [...watches.map(w => ({ label: w.handle ? `@${w.handle}` : w.domain ?? w.inputKey, enabled: w.enabled, target: `watch:show:${w.id}` })),
      ...projects.filter(p => !linked.has(p.handle)).map(p => ({ label: `@${p.handle}`, enabled: p.enabled, target: `research:report:${p.handle}` }))];
    const last = Math.max(0, Math.ceil(rows.length / 6) - 1), current = Math.min(page, last), shown = rows.slice(current * 6, current * 6 + 6);
    return { text: ["YOUR WATCHES", `Page ${current + 1}/${last + 1}`, ...shown.map(r => `${clean(r.label)} · ${r.enabled ? "watching" : "paused"}`),
      "\nAdd any project: /watch @account or /watch project.com"].join("\n"), reply_markup: { inline_keyboard: [
        ...shown.map(r => [button(clean(r.label, 50), r.target)]),
        [button("X data budget", "watch:usage:0")],
        [...(current > 0 ? [button("Previous", `watch:list:${current - 1}`)] : []), ...(current < last ? [button("Next", `watch:list:${current + 1}`)] : [])],
      ].filter(r => r.length) } };
  } catch (e) {
    return { text: e instanceof Error && e.message === "research_http_400" ? "That link could not be read. Use an X profile (not a post) or a public website, for example /watch @tradedotcv."
      : "Watch service is unavailable right now. Please retry; your existing watches are preserved." };
  }
}
export function formatLaunch(w: WatchTarget): BotCard {
  const r = w.launchReport;
  const lines = [`LAUNCH PREPARATION · ${clean(w.handle ? `@${w.handle}` : w.domain ?? w.inputKey)}`,
    !w.launchFlag ? "Launch DD disabled" : !w.enabled ? "Watch paused" : "Flagged for additional DD",
    "Collection switches: /status. Flagging does not turn collection or chain monitoring on."];
  if (!r) lines.push("\nQueued for the next scheduled research scan: linked docs, deployer labels and exact token-address evidence.");
  else {
    lines.push(`\nResearch checked: ${clean(r.observedAt)}`, `Public pages read: ${r.pagesChecked.length}`);
    if (Date.now() - Date.parse(r.observedAt) > 86_400_000) lines.push("Research is older than 24h; refresh required before matching new candidates.");
    const deployers = r.candidates.filter(c => c.role === "deployer");
    lines.push(deployers.length ? "\nDEPLOYER CANDIDATES · unverified" : "\nDeployer: not found yet");
    for (const c of deployers.slice(0, 2)) lines.push(c.address, clean(c.sourceUrl), clean(c.excerpt, 180));
    lines.push(r.matches.length ? "\nDEPLOYMENT LEADS · identity checks required" : "\nNo matching deployment recorded yet.");
    for (const m of r.matches.slice(0, 2)) lines.push(`CA: ${m.tokenAddress}`, `Deployer: ${m.deployerAddress}`,
      `Tx: ${m.creationTxHash}`, `Matched by: ${m.basis}`, m.claimId ? "Identity draft prepared for Telegram review." : "Official CA declaration / identity draft still required.");
    if (r.matches.length > 2) lines.push(`${r.matches.length} leads found. A deployer can launch unrelated tokens; none is automatically selected.`);
    if (r.gaps.length) lines.push(`\nMissing / coverage: ${clean(r.gaps.join("; ").replaceAll("_", " "), 400)}`);
  }
  lines.push("\nPons V2 events only. Other factories and direct deployments need an adapter or manual evidence. Existing chain polling runs at five-minute intervals and may lag while catching up.",
    "Not armed for trading. A matching wallet is a lead, not issuer verification. Canonical deployment checks, your source review, contract/market checks and a trading policy are still required.");
  return { text: lines.join("\n").slice(0, 3900), reply_markup: { inline_keyboard: [
    [button("Refresh preparation", `watch:launch:${w.id}`), button("Watch", `watch:show:${w.id}`)],
    ...(w.projectHandle ? [[button("Token identity / review", `identity:list:${w.projectHandle}`)]] : []),
    [button(w.launchFlag ? "Disable launch DD" : "Enable launch DD", `watch:${w.launchFlag ? "unflag" : "flag"}:${w.id}`)],
  ] } };
}
export function formatXUsage(u: XUsage): BotCard {
  const dollars = (n: number) => `$${n.toFixed(4)}`;
  return { text: ["X DATA BUDGET · USD", `Limit: $${u.dailyLimitUsd.toFixed(2)} per day`,
    `Reserved today (UTC): ${dollars(u.reservedTodayUsd)}`, `Reserved in last 24h: ${dollars(u.reserved24hUsd)}`,
    `Available allowance: ${dollars(u.remainingUsd)}`, `Paid request attempts in last 24h: ${u.requests24h}`,
    "\nConservative cost reservations, not the provider invoice. Failures retain their allowance; cache reads are free.",
    "The rolling 24-hour guard prevents a spending burst at midnight. Allowance returns as reservations age out.",
    "Profiles: daily · Main accounts: hourly · Related accounts: every 6 hours.",
    ...(u.blockedUntil && Date.parse(u.blockedUntil) > Date.now() ? [`Provider requests paused until ${clean(u.blockedUntil)}.`] : []),
  ].join("\n"), reply_markup: { inline_keyboard: [[button("Refresh budget", "watch:usage:0"), button("Watches", "watch:list:0")]] } };
}
export function createWatchAlerts(api: Pick<ApiClient, "listWatches">, store: AlertStore, destination: string, send: (card: BotCard) => Promise<void>) {
  let state = store.load();
  return async () => {
    let sent = 0;
    for (const w of (await api.listWatches()).filter(w => w.enabled && w.discovery && w.lastError !== "scan_in_progress")) {
      const d = w.discovery!, key = `${destination}:${w.id}`;
      const signature = createHash("sha256").update(JSON.stringify([d.domain, d.primaryHandle,
        d.accounts.map(a => [a.handle, a.relation]), d.links.map(l => l.url), d.addresses.map(a => a.address), d.gaps,
        w.report?.rating, w.report?.subdomains.inspected, w.lastError, w.launchFlag,
        w.launchFlag ? [w.launchReport?.candidates.map(c => [c.address, c.role, c.sourceUrl, c.tokenDeclaration]), w.launchReport?.gaps, w.launchReport?.matches] : null])).digest("hex");
      if (state[key]?.signature === signature) continue;
      if (sent++ >= 5) break;
      await send(w.launchFlag ? formatLaunch(w) : formatWatch(w));
      const next = { ...state, [key]: { signature, snapshot: d.observedAt } }; store.save(next); state = next;
    }
  };
}
