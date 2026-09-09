import { parseArgs } from "node:util";
import { writeFileSync } from "node:fs";
import { inspectProject } from "./inspect.js";
import { enrichWithGrok } from "./grok.js";
const { values } = parseArgs({ options: { handle: { type: "string" }, domain: { type: "string" },
  category: { type: "string", default: "unknown" }, output: { type: "string" } } });
if (!values.handle || !values.domain) throw new Error("Use --handle name --domain example.com [--output path]");
const report = await inspectProject({ handle: values.handle.replace(/^@/, ""), domain: values.domain, category: values.category });
const result = { ...report, grok: await enrichWithGrok(report) };
if (values.output) writeFileSync(values.output, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ project: result.project, rating: result.rating, subdomains: result.subdomains,
  launchReadiness: result.launchReadiness, grok: result.grok.status, saved: values.output ?? null }, null, 2));
