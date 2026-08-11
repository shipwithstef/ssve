#!/usr/bin/env node
/**
 * prompt-floor-route.mjs — WI-411 run/skip gate for the best-of-2 craft-prompt floor (AC7).
 *
 * Pure decision (no clock): given the WI class/size and machine-local policy, decide whether
 * to generate a craft prompt at all. Default OFF — the best-of-2 craft floor runs only when explicitly armed,
 * because generating B doubles plan-stage tokens (context economy is the framework's worst dim).
 *
 * RUN only when ALL hold:
 *   - chain-policy opts in:  .svc/chain-policy.json { "prompt_craft": "measured" }
 *   - kill-switch absent:    .svc/prompt-craft.off does NOT exist
 *   - class is infra-path:   infra
 *   - size is M or larger:   M | L | XL
 * SKIP otherwise (quick-fix/trivial, WI-360 exempt class, not opted-in, kill-switch present).
 *
 * Usage: node scripts/prompt-floor-route.mjs --wi WI-XXX --class <infra|product|docs> --size <XS|S|M|L|XL> [--files N] [--root .]
 * Output: { "run": bool, "reason": "..." }  (exit 0 always; routing is advisory)
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function parseArgs(argv) {
  const o = { root: ".", files: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--wi") o.wi = argv[++i];
    else if (a === "--class") o.cls = argv[++i];
    else if (a === "--size") o.size = argv[++i];
    else if (a === "--files") o.files = Number(argv[++i]);
    else if (a === "--root") o.root = argv[++i];
  }
  return o;
}

const EXEMPT_CLASSES = new Set(["docs", "exempt"]); // WI-360 exempt class proxy
const MPLUS = new Set(["M", "L", "XL"]);

export function decide({ cls, size, files, optedIn, killSwitch }) {
  if (killSwitch) return { run: false, reason: "kill-switch present (.svc/prompt-craft.off)" };
  if (!optedIn) return { run: false, reason: "not opted in (.svc/chain-policy.json prompt_craft != 'measured') — v1 default OFF" };
  if (EXEMPT_CLASSES.has(cls)) return { run: false, reason: `WI-360 exempt class (${cls}) — blind==framework, floor trivially holds` };
  if (typeof files === "number" && files <= 3) return { run: false, reason: `quick-fix/trivial (${files} files <= 3) — blind wins anyway` };
  if (!MPLUS.has(size)) return { run: false, reason: `size ${size} below M — not worth the 2x plan cost` };
  if (cls !== "infra") return { run: false, reason: `class ${cls} not infra-path — outside v1 scope` };
  return { run: true, reason: "infra-path + M+ + opted-in + no kill-switch — best-of-2 craft floor armed" };
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  let optedIn = false;
  const policyPath = join(a.root, ".svc", "chain-policy.json");
  if (existsSync(policyPath)) {
    try { optedIn = JSON.parse(readFileSync(policyPath, "utf8")).prompt_craft === "measured"; } catch { optedIn = false; }
  }
  const killSwitch = existsSync(join(a.root, ".svc", "prompt-craft.off"));
  const result = decide({ cls: a.cls, size: a.size, files: a.files, optedIn, killSwitch });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

if (import.meta.url === `file://${process.argv[1]}`) main();
