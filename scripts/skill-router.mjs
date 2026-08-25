#!/usr/bin/env node
/**
 * skill-router.mjs — WI-FW-SKILLS-ROUTING-01 Wave 2 CLI.
 *
 * Subcommands:
 *   compile [--root <dir>] [--check]
 *       Compile (or byte-verify with --check) references/skill-routing-index.json.
 *
 *   validate [--root <dir>]
 *       Validate the committed index artifact and print a catalog summary.
 *
 *   route --intent "<text>" [--root <dir>] [--files a,b] [--packages x,y]
 *         [--env K1,K2] [--active-skill <name>] [--next-skill <name>]
 *         [--mode off|shadow|suggest|active] [--no-receipts]
 *       Emit one normalized routing decision (stdout JSON). Suggestion-only by
 *       default; active mode additionally applies the conservative top-one,
 *       confidence+margin, low-risk auto-invocation gates. Offline always:
 *       semantic retrieval reports degraded/unavailable and never gates pins.
 *
 * Exit codes: 0 success; 1 drift/validation failure; 2 usage or input error.
 */
import path from "node:path";
import process from "node:process";
import { compile } from "./compile-skill-router-index.mjs";
import { loadIndex, route, validateDecision, BUDGETS } from "./lib/skill-router.mjs";

function usage() {
  process.stderr.write(`usage:
  node scripts/skill-router.mjs compile  [--root <dir>] [--check]
  node scripts/skill-router.mjs validate [--root <dir>]
  node scripts/skill-router.mjs route --intent "<text>" [options]
`);
  process.exit(2);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--root") args.root = argv[++i];
    else if (a === "--check") args.check = true;
    else if (a === "--intent") args.intent = argv[++i];
    else if (a === "--files") args.files = String(argv[++i]).split(",").filter(Boolean);
    else if (a === "--packages") args.packages = String(argv[++i]).split(",").filter(Boolean);
    else if (a === "--env") args.env = String(argv[++i]).split(",").filter(Boolean);
    else if (a === "--active-skill") args.activeSkill = argv[++i];
    else if (a === "--next-skill") args.nextSkill = argv[++i];
    else if (a === "--mode") args.mode = argv[++i];
    else if (a === "--no-receipts") args.noReceipts = true;
    else if (!a.startsWith("--")) args._.push(a);
    else { process.stderr.write(`unknown flag: ${a}\n`); usage(); }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0];
if (!command) usage();
const root = path.resolve(args.root || process.cwd());

try {
  if (command === "compile") {
    if (args.check) {
      // Delegate to the compiler's own --check path for a single source of truth.
      const { spawnSync } = await import("node:child_process");
      const r = spawnSync(process.execPath, [
        path.join(root, "scripts", "compile-skill-router-index.mjs"), "--root", root, "--check",
      ], { stdio: "inherit" });
      process.exit(r.status ?? 1);
    }
    const out = path.join(root, "references", "skill-routing-index.json");
    const fs = await import("node:fs");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const tmp = `${out}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, compile(root), { mode: 0o644 });
    fs.renameSync(tmp, out);
    process.stdout.write(`compiled ${path.relative(root, out)}\n`);
    process.exit(0);
  }

  if (command === "validate") {
    const { index } = loadIndex(root);
    const policies = {};
    let badDescription = 0;
    for (const s of index.skills) {
      policies[s.invocation_policy] = (policies[s.invocation_policy] || 0) + 1;
      if (!s.description) badDescription += 1;
    }
    if (badDescription > 0) {
      process.stderr.write(`skill-router validate: ${badDescription} record(s) missing description\n`);
      process.exit(1);
    }
    process.stdout.write(JSON.stringify({
      ok: true,
      skills: index.skills.length,
      invocation_policies: policies,
      budgets: BUDGETS,
    }, null, 2) + "\n");
    process.exit(0);
  }

  if (command === "route") {
    if (args.intent === undefined) { process.stderr.write("route requires --intent\n"); usage(); }
    // SVC_SKILL_ROUTER_MODE is the documented safety/rollback knob (plan §9):
    // off | shadow | suggest | active. It is the DEFAULT; an explicit --mode
    // flag wins. Unknown env values fail closed to "off" with a diagnostic.
    let mode = args.mode;
    if (!mode && process.env.SVC_SKILL_ROUTER_MODE) {
      const requested = process.env.SVC_SKILL_ROUTER_MODE;
      if (["off", "shadow", "suggest", "active"].includes(requested)) mode = requested;
      else {
        process.stderr.write(`skill-router: unknown SVC_SKILL_ROUTER_MODE "${requested}"; failing closed to "off"\n`);
        mode = "off";
      }
    }
    const decision = route({
      root,
      intent: args.intent,
      files: args.files || [],
      packages: args.packages || [],
      env: args.env || [],
      activeSkill: args.activeSkill || null,
      nextSkill: args.nextSkill || null,
      mode: mode || "suggest",
      receipts: !args.noReceipts,
    });
    const errors = validateDecision(decision);
    if (errors.length > 0) {
      process.stderr.write(`skill-router route: internal decision invalid:\n${errors.map((e) => `  - ${e}`).join("\n")}\n`);
      process.exit(2);
    }
    process.stdout.write(JSON.stringify(decision, null, 2) + "\n");
    process.exit(0);
  }

  process.stderr.write(`unknown command: ${command}\n`);
  usage();
} catch (error) {
  process.stderr.write(`skill-router: ${error.message}\n`);
  process.exit(2);
}
