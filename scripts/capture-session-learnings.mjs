#!/usr/bin/env node
// scripts/capture-session-learnings.mjs
//
// Standalone CLI for the manual auto-learning capture path per WI-343 AC:
//
//   node scripts/capture-session-learnings.mjs [--summary] [--review] [--scope <window>] [--dry-run]
//
// Mirrors the runtime behavior of hooks/svc-auto-capture-learnings.mjs but
// driven by the user instead of a host trigger. Useful for:
//   - sessions on hosts without the right hook surface
//   - retrospective capture across a wider commit window
//   - dry-run inspection without writing the audit log
//
// Flags:
//   --summary      Emit the 3-line session-end summary (sets SVC_AUTO_LEARN_SUMMARY)
//   --review       Write to .svc/auto-learnings.draft.jsonl instead of .svc/auto-learnings.jsonl
//   --scope <ref>  Override the git merge-base (default: origin/main..HEAD)
//   --dry-run      Print candidates to stdout; do not append to any file
//   --root <path>  Override repo root (default: process.cwd())
//   --verbose      Surface detector warnings on stderr
//
// Exit code is always 0 unless a flag is misused — capture is observe-only.

import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appendJsonlLine } from "./state-io.mjs";
import { runAll } from "./lib/learning-candidate-detector.mjs";
import { dedupAgainstPaths } from "./lib/learning-dedup.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_ROOT = path.resolve(__dirname, "..");
const DEFAULT_BUDGET_MS = 2000; // CLI runs interactively; budget can be looser than the 200ms hook.

function parseArgs(argv) {
  const out = {
    summary: false,
    review: false,
    scope: null,
    dryRun: false,
    root: null,
    verbose: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const tok = argv[i];
    if (tok === "--summary") { out.summary = true; continue; }
    if (tok === "--review") { out.review = true; continue; }
    if (tok === "--scope") { out.scope = argv[++i]; continue; }
    if (tok === "--dry-run") { out.dryRun = true; continue; }
    if (tok === "--root") { out.root = argv[++i]; continue; }
    if (tok === "--verbose") { out.verbose = true; continue; }
    if (tok === "--help" || tok === "-h") {
      console.log("Usage: node scripts/capture-session-learnings.mjs [--summary] [--review] [--scope <ref>] [--dry-run] [--root <path>] [--verbose]");
      process.exit(0);
    }
    if (tok.startsWith("--")) {
      console.error(`Unknown flag: ${tok}`);
      process.exit(2);
    }
  }
  return out;
}

function git(args, cwd) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", timeout: 2000 }).trim();
  } catch {
    return "";
  }
}

function candidatePaths(root) {
  return [
    path.join(root, ".svc/auto-learnings.jsonl"),
    path.join(root, ".svc/auto-learnings.draft.jsonl"),
    path.join(root, "references/framework-learnings.jsonl"),
    path.join(root, "docs/learnings/learnings.jsonl"),
  ];
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(args.root || process.cwd());
  const branch = git(["branch", "--show-current"], root);
  const head = git(["rev-parse", "--short", "HEAD"], root);
  const mergeBase = args.scope
    ? git(["rev-parse", args.scope], root)
    : git(["merge-base", "origin/main", "HEAD"], root);
  const sessionId = `${branch || "detached"}-${head || "unknown"}-cli`;
  const warnings = [];

  const candidates = runAll({
    cwd: root,
    branch,
    mergeBase,
    sessionId,
    trigger: "manual-cli",
    gitTimeoutMs: DEFAULT_BUDGET_MS,
    warn: (msg) => warnings.push(msg),
  });

  const outPath = args.review
    ? path.join(root, ".svc/auto-learnings.draft.jsonl")
    : path.join(root, ".svc/auto-learnings.jsonl");

  const existing = candidatePaths(root).filter(existsSync);
  let appended = 0;
  let dedupSkipped = 0;
  const dryRunOutput = [];

  for (const c of candidates) {
    if (dedupAgainstPaths(c, existing)) {
      dedupSkipped += 1;
      continue;
    }
    const record = { ...c, trigger: "manual-cli" };
    if (args.dryRun) {
      dryRunOutput.push(record);
    } else {
      appendJsonlLine(outPath, record, { timeoutMs: 1000, retryMs: 10, staleMs: 10_000 });
      existing.push(outPath);
    }
    appended += 1;
  }

  if (args.dryRun) {
    for (const rec of dryRunOutput) {
      process.stdout.write(JSON.stringify(rec) + "\n");
    }
    process.stderr.write(`[dry-run] ${appended} candidate(s) NOT appended; ${dedupSkipped} dedup-skipped.\n`);
  } else if (args.summary) {
    const target = args.review ? ".svc/auto-learnings.draft.jsonl" : ".svc/auto-learnings.jsonl";
    process.stdout.write(`Captured ${appended} learning candidate(s) into ${target}.\n`);
    process.stdout.write(`${dedupSkipped} candidate(s) skipped as duplicates of existing entries.\n`);
    process.stdout.write("Run `node scripts/promote-auto-learnings.mjs` to review/promote.\n");
  }

  if (args.verbose && warnings.length > 0) {
    process.stderr.write(`[capture-session-learnings] ${warnings.join("; ")}\n`);
  }
}

main();
