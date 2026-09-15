#!/usr/bin/env node
/**
 * blind-floor-route.mjs — current Two-Box run/skip uses live staged eligibility.
 *
 * Active CLI recomputes evaluateEligibility on the consumer staged tree.
 * Unproved current calls are run:true unless that LIVE recompute accepts lightweight
 * eligibility. No caller SHA/cls/files/optedIn/killSwitch exemption for current work.
 * Missing protocol/classifier fails closed (no silent success).
 *
 * export function decide(...) is historical fixture inspection only and is not
 * current execution authority. --historical prints decide() labeled nonauthoritative.
 * --mode OFFLINE is labeled nonauthoritative and cannot skip current work.
 *
 * Usage: node scripts/blind-floor-route.mjs --root <dir>
 *        node scripts/blind-floor-route.mjs --historical --wi WI-XXX --class <...> --size <...> [--files N] [--root .]
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function parseArgs(argv) {
  const o = { root: ".", files: null, historical: false, mode: "LIVE" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--wi") o.wi = argv[++i];
    else if (a === "--class") o.cls = argv[++i];
    else if (a === "--size") o.size = argv[++i];
    else if (a === "--files") o.files = Number(argv[++i]);
    else if (a === "--root") o.root = argv[++i];
    else if (a === "--historical") o.historical = true;
    else if (a === "--mode") o.mode = argv[++i];
  }
  return o;
}

const EXEMPT_CLASSES = new Set(["docs", "exempt"]); // WI-360 exempt class proxy
const MPLUS = new Set(["M", "L", "XL"]);

export function decide({ cls, size, files, optedIn, killSwitch }) {
  if (killSwitch) return { run: false, reason: "kill-switch present (.svc/dual-track.off)" };
  if (!optedIn) return { run: false, reason: "not opted in (.svc/chain-policy.json dual_track != 'measured') — v1 default OFF" };
  if (EXEMPT_CLASSES.has(cls)) return { run: false, reason: `WI-360 exempt class (${cls}) — blind==framework, floor trivially holds` };
  if (typeof files === "number" && files <= 3) return { run: false, reason: `quick-fix/trivial (${files} files <= 3) — blind wins anyway` };
  if (!MPLUS.has(size)) return { run: false, reason: `size ${size} below M — not worth the 2x plan cost` };
  if (cls !== "infra") return { run: false, reason: `class ${cls} not infra-path — outside v1 scope` };
  return { run: true, reason: "infra-path + M+ + opted-in + no kill-switch — dual-track armed" };
}

export async function routeCurrent({ consumerRoot, start, mode = "LIVE", inject } = {}) {
  if (mode !== "LIVE" && mode !== "OFFLINE") throw new Error(`unknown route mode: ${mode}`);
  let evaluateEligibility;
  try {
    const mod = await import("./lib/two-box-protocol.mjs");
    evaluateEligibility = mod.evaluateEligibility;
  } catch (error) {
    throw new Error(`two-box protocol unavailable (fail-closed): ${error.message}`);
  }
  if (typeof evaluateEligibility !== "function") throw new Error("evaluateEligibility missing — fail-closed");
  const root = consumerRoot || start || ".";
  const eligibility = evaluateEligibility({
    consumerRoot: root,
    start: root,
    ...(mode === "OFFLINE" ? { mode: "OFFLINE", inject } : { mode: "LIVE" }),
  });
  const accepted = mode === "LIVE" && eligibility.eligible === true && eligibility.evidence_class === "LIVE";
  if (accepted) {
    return {
      run: false,
      reason: "live staged eligibility accepted — v5 lightweight alternative",
      evidence_class: "LIVE",
      authoritative: true,
      eligibility,
    };
  }
  if (mode === "OFFLINE") {
    return {
      run: true,
      reason: "OFFLINE fixture is nonauthoritative; current substantive work still requires Two-Box unless live eligibility is accepted",
      evidence_class: "OFFLINE",
      authoritative: false,
      historical_readonly: true,
      eligibility,
    };
  }
  return {
    run: true,
    reason: "current substantive work requires Two-Box Planning",
    evidence_class: eligibility.evidence_class || "LIVE",
    authoritative: true,
    eligibility,
  };
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.mode === "OFFLINE") {
    process.stdout.write(JSON.stringify({
      run: true,
      reason: "OFFLINE fixture route is nonauthoritative",
      evidence_class: "OFFLINE",
      authoritative: false,
      historical_readonly: true,
      current_orchestration: "scripts/two-box-plan.mjs",
    }, null, 2) + "\n");
    return;
  }
  if (a.historical) {
    let optedIn = false;
    const policyPath = join(a.root, ".svc", "chain-policy.json");
    if (existsSync(policyPath)) {
      try { optedIn = JSON.parse(readFileSync(policyPath, "utf8")).dual_track === "measured"; } catch { optedIn = false; }
    }
    const killSwitch = existsSync(join(a.root, ".svc", "dual-track.off"));
    const result = decide({ cls: a.cls, size: a.size, files: a.files, optedIn, killSwitch });
    process.stdout.write(JSON.stringify({
      ...result,
      evidence_class: "OFFLINE",
      authoritative: false,
      historical_readonly: true,
      current_orchestration: "scripts/two-box-plan.mjs",
    }, null, 2) + "\n");
    return;
  }
  const result = await routeCurrent({ consumerRoot: a.root, start: a.root, mode: "LIVE" });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  Promise.resolve(main()).catch((error) => {
    process.stderr.write(`${error.message || error}\n`);
    process.exit(1);
  });
}
