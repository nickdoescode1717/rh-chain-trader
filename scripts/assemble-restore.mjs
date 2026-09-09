#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const root = process.cwd();
const dir = path.join(root, "docs/_restore");
const man = JSON.parse(fs.readFileSync(path.join(dir, "MANIFEST.json"), "utf8"));
function cat(prefix, n) {
  let out = "";
  for (let i = 0; i < n; i++) {
    const p = path.join(dir, `${prefix}.part${String(i).padStart(2, "0")}`);
    out += fs.readFileSync(p, "utf8");
  }
  return out;
}
const spec = cat("SPEC", man.spec_parts);
const lock = cat("LOCK", man.lock_parts);
const sh = (s) => crypto.createHash("sha256").update(s).digest("hex");
if (sh(spec) !== man.spec_sha256 || spec.length !== man.spec_len) {
  console.error("SPEC mismatch", sh(spec), spec.length);
  process.exit(1);
}
if (sh(lock) !== man.lock_sha256 || lock.length !== man.lock_len) {
  console.error("LOCK mismatch", sh(lock), lock.length);
  process.exit(1);
}
fs.mkdirSync(path.join(root, "docs"), { recursive: true });
fs.writeFileSync(path.join(root, "docs/SPEC.md"), spec);
fs.writeFileSync(path.join(root, "pnpm-lock.yaml"), lock);
console.log("Wrote docs/SPEC.md and pnpm-lock.yaml OK");
