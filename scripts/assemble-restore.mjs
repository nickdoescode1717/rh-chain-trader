#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");
const root = process.cwd();
const dir = path.join(root, "docs/_restore");
const man = JSON.parse(fs.readFileSync(path.join(dir, "MANIFEST.json"), "utf8"));
function cat(prefix, n) {
  let out = "";
  for (let i = 0; i < n; i++) {
    const p = path.join(dir, `${prefix}.part${String(i).padStart(2, "0")}`);
    if (!fs.existsSync(p)) throw new Error("missing " + p);
    out += fs.readFileSync(p, "utf8");
  }
  return out;
}
const spec = cat("SPEC", man.spec_parts);
const sh = (s) => crypto.createHash("sha256").update(s).digest("hex");
if (sh(spec) !== man.spec_sha256 || spec.length !== man.spec_len) {
  console.error("SPEC mismatch", sh(spec), spec.length, "expected", man.spec_sha256, man.spec_len);
  process.exit(1);
}
fs.mkdirSync(path.join(root, "docs"), { recursive: true });
fs.writeFileSync(path.join(root, "docs/SPEC.md"), spec);
console.log("Wrote docs/SPEC.md OK", spec.length);

// Prefer exact lock parts if all present; else generate via pnpm
let haveLock = true;
for (let i = 0; i < man.lock_parts; i++) {
  const p = path.join(dir, `LOCK.part${String(i).padStart(2, "0")}`);
  if (!fs.existsSync(p)) { haveLock = false; break; }
}
if (haveLock) {
  const lock = cat("LOCK", man.lock_parts);
  if (sh(lock) !== man.lock_sha256 || lock.length !== man.lock_len) {
    console.error("LOCK mismatch", sh(lock), lock.length);
    process.exit(1);
  }
  fs.writeFileSync(path.join(root, "pnpm-lock.yaml"), lock);
  console.log("Wrote pnpm-lock.yaml from parts OK");
} else {
  console.log("LOCK parts incomplete; generating via pnpm install");
  execSync("corepack enable && corepack prepare pnpm@9.15.0 --activate && pnpm install", {
    cwd: root,
    stdio: "inherit",
  });
  if (!fs.existsSync(path.join(root, "pnpm-lock.yaml"))) {
    console.error("pnpm-lock.yaml missing after install");
    process.exit(1);
  }
  console.log("Wrote pnpm-lock.yaml via pnpm OK");
}
