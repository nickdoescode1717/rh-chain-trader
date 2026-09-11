import type { ApiClient, ResearchProject } from "./api.js";
export type BotCard = { text: string; reply_markup?: { inline_keyboard: { text: string; callback_data: string }[][] } };
type ResearchApi = Pick<ApiClient, "listResearchProjects" | "getResearchProject" | "watchProject" | "setProjectMonitoring">;
const clean = (value: string, max = 400) => value.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, " ").slice(0, max);
const handleOf = (value = "") => value.replace(/^@/, "").toLowerCase();
const validHandle = (value: string) => /^[a-z0-9_]{1,15}$/.test(value);
const button = (text: string, callback_data: string) => ({ text, callback_data });
const bounded = (text: string) => text.length <= 3900 ? text : text.slice(0, 3860) + "\n…Use /research for the latest report.";
export const candidateAddresses = (project: ResearchProject) => [...new Set((project.report?.evidence ?? [])
  .flatMap((e) => e.finding.match(/\b0x[a-fA-F0-9]{40}\b/g) ?? []).map((address) => address.toLowerCase())
  .filter((address) => !/^0x0{40}$/.test(address)))].sort();

export function researchMenu(): BotCard {
  return { text: "RH CHAIN BOT · PAPER MODE\n\n/stop — pause all data collection\n/run — resume research\n/status — collection and RPC usage\n/usage — X data budget\n/projects — watched projects\n/research @handle — latest research\n/watch @account or website — discover and watch a project\n/launch @account or website — investigate an upcoming token launch\n/pause @handle or /resume @handle — project + X monitoring\n/balance — paper balance\n/positions — holdings and confirmed paper sells\n/history — paper trade history\n/snipe — prepare an automatic paper launch entry\n/snipes — saved paper launch plans\n/identity @handle — token identity evidence\n/proposals — latest five pending paper proposals\n\nExample: /watch @tradedotcv\n\nResearch reports are observations, not buy approvals. Existing proposal buttons handle paper approvals. Use /usage for the X budget and /status for collection switches. Live buying and selling are not connected.",
    reply_markup: { inline_keyboard: [[button("Projects", "watch:list:0"), button("Help", "research:help")]] } };
}

export function formatResearchProject(project: ResearchProject): BotCard {
  const handle = clean(project.handle, 15), report = project.report;
  const lines = [`PROJECT · @${handle}`, `${clean(project.domain, 253)} · ${clean(project.category, 20)} · ${project.enabled ? "Watching" : "Paused"}`,
    "RESEARCH ONLY · No live trade capability", "Token authenticity unverified. Never identify a token by its name/ticker alone."];
  if (project.lastError) lines.push(`Collection: ${clean(project.lastError.replaceAll("_", " "), 120)}`);
  if (!report) lines.push("\nReport pending. Collection must be configured and enabled on the backend. Registration alone does not start the providers.");
  else {
    lines.push(`\nSnapshot: ${clean(report.researchedAt, 40)}`, report.rating.rating10 == null ? "Rating: insufficient evidence" : `Evidence rating: ${report.rating.rating10}/10`,
      `Coverage: ${report.rating.evidenceCoveragePct}% · Supported points: ${report.rating.supportedEvidencePoints}/100`, "Legitimacy unverified; this is not a return estimate.");
    const concerns = report.rating.checks.filter((c) => c.status === "concern").map((c) => clean(c.label, 100));
    const supported = report.rating.checks.filter((c) => c.status === "supported").map((c) => clean(c.label, 100));
    if (supported.length) lines.push(`\nSupported: ${supported.join("; ")}`);
    if (concerns.length) lines.push(`Concerns: ${concerns.join("; ")}`);
    lines.push(`Public subdomains: ${report.subdomains.discovered} found, ${report.subdomains.inspected.length} inspected. Supporting evidence only.`);
    if (report.subdomains.errors.length) lines.push(`Coverage gaps: ${clean(report.subdomains.errors.join(", ").replaceAll("_", " "), 200)}`);
    const addresses = candidateAddresses(project);
    if (addresses.length) lines.push(`\nMENTIONED ADDRESSES · role/ownership unverified (${Math.min(addresses.length, 3)}/${addresses.length})`, ...addresses.slice(0, 3));
    lines.push("\nBEFORE BUYING", ...report.launchReadiness.blockers.map((b) => `• ${clean(b.replaceAll("_", " "), 130)}`));
    if (report.grok?.analysis) lines.push(`\nGROK ANALYSIS · unverified\n${clean(report.grok.analysis.summary, 500)}`);
    else lines.push(`\nGrok: ${clean((report.grok?.status ?? "not requested").replaceAll("_", " "), 80)}`);
    const sources = [...new Set(report.evidence.map((e) => e.url))].filter((url) => {
      try { const parsed = new URL(url); return parsed.protocol === "https:" && !parsed.username && !parsed.password && url.length <= 250; } catch { return false; }
    }).slice(0, 3);
    if (sources.length) lines.push("\nSOURCES", ...sources);
  }
  return { text: bounded(lines.join("\n")), reply_markup: validHandle(handle) ? { inline_keyboard: [
    [button("Refresh report", `research:report:${handle}`), button(project.enabled ? "Pause watching" : "Resume watching", `research:${project.enabled ? "pause" : "resume"}:${handle}`)],
    [button("Token identity", `identity:list:${handle}`),button("Projects", "watch:list:0")],
  ] } : undefined };
}

export function formatProjectList(projects: ResearchProject[], page = 0): BotCard {
  const lastPage = Math.max(0, Math.ceil(projects.length / 6) - 1);
  const index = Math.min(page, lastPage), rows = projects.slice(index * 6, index * 6 + 6);
  return { text: ["WATCHED PROJECTS", `${projects.length} projects · Page ${index + 1}/${lastPage + 1}`,
    ...rows.map((p) => `@${clean(p.handle, 15)} · ${p.enabled ? "watching" : "paused"} · ${clean(p.domain, 253)}`),
    rows.length ? "\nTap a project for its report." : "\nAdd one: /watch @tradedotcv"].join("\n"),
    reply_markup: { inline_keyboard: [...rows.filter((p) => validHandle(p.handle)).map((p) => [button(`@${p.handle}`, `research:report:${p.handle}`)]),
      [...(index > 0 ? [button("Previous", `research:list:${index - 1}`)] : []), ...(index < lastPage ? [button("Next", `research:list:${index + 1}`)] : [])],
      [button("Help", "research:help")]].filter((row) => row.length) } };
}

export async function handleResearchInput(api: ResearchApi, input: string, callback = false): Promise<BotCard | null> {
  let action: string, args: string[];
  if (callback) {
    if (!input.startsWith("research:")) return null;
    const parts = input.split(":"); action = parts[1]; args = parts.slice(2);
    if (!/^(help|list|report|pause|resume)$/.test(action)) return { text: "Unknown research action. Use /help." };
  } else {
    const [command, ...rest] = input.trim().split(/\s+/);
    const base = command.toLowerCase().split("@")[0];
    const commands: Record<string, string> = { "/start": "help", "/help": "help", "/projects": "list", "/research": "report", "/watch": "watch", "/pause": "pause", "/resume": "resume" };
    action = commands[base]; args = rest;
    if (!action) return null;
  }
  if (action === "help") return researchMenu();
  try {
    if (action === "list") {
      const page = args[0] === undefined ? 0 : Number(args[0]);
      if (!Number.isSafeInteger(page) || page < 0 || args.length > 1) return { text: "Use /projects [page], starting at 0." };
      return formatProjectList(await api.listResearchProjects(), page);
    }
    const handle = handleOf(args[0]);
    if (!validHandle(handle)) return { text: "Use an X handle, for example /research @tradedotcv." };
    if (action === "watch") {
      const domain = (args[1] ?? "").toLowerCase(), category = args[2] ?? "unknown";
      if (args.length < 2 || args.length > 3 || domain.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)
        || /\.(local|localhost|internal|test|invalid|example)$/.test(domain) || !["utility", "meme", "unknown"].includes(category)) {
        return { text: "Use /watch @handle domain [utility|meme|unknown]. Example: /watch @tradedotcv" };
      }
      // Reusing a watch preserves the report and hourly schedule; monitoring changes are idempotent.
      let existing: ResearchProject | null = null;
      try { existing = await api.getResearchProject(handle); } catch (err) { if (!(err instanceof Error) || err.message !== "research_http_404") throw err; }
      if (existing) {
        if (existing.domain !== domain || (args[2] !== undefined && existing.category !== category)) return { text: "This handle is already registered with different project details. Pause it and have the backend project mapping reviewed before changing its identity." };
        return formatResearchProject(await api.setProjectMonitoring(handle, true));
      }
      await api.watchProject({ handle, domain, category });
      return formatResearchProject(await api.setProjectMonitoring(handle, true));
    }
    if (args.length !== 1) return { text: "Use one handle, for example /research @tradedotcv." };
    if (action === "pause" || action === "resume") return formatResearchProject(await api.setProjectMonitoring(handle, action === "resume"));
    return formatResearchProject(await api.getResearchProject(handle));
  } catch (err) {
    if (err instanceof Error && err.message === "research_http_404") return { text: "Project not found. Add it with /watch @handle domain." };
    return { text: "Project research is unavailable right now. Check the backend connection and research migration, then retry. No purchase was created." };
  }
}


