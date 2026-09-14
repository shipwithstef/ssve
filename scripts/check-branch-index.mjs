#!/usr/bin/env node
// check-branch-index.mjs — WI-521 Batch B, item B1 (G1).
//
// `branchIndexFresh()` in branch-index-freshness.mjs has had ZERO callers
// since it was written — a library function nobody runs is not a check, it
// is a promise. This is the missing wiring: a thin CLI over the existing
// library (no freshness logic lives here) with real exit codes, so a gate,
// a hook, or an agent can ask "is this index still trustworthy" without
// importing anything.
//
// Usage:
//   node scripts/check-branch-index.mjs --index <path>
//   node scripts/check-branch-index.mjs --all
//
// Exit codes: 0 fresh (all, for --all) / 1 stale-or-EMPTY (ok:false) / 2 usage.

import { execFileSync } from 'node:child_process';
import { branchIndexFresh } from './branch-index-freshness.mjs';

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function resolveAllIndexes() {
  // `git ls-files` keeps this deterministic and tracked-only — no stray
  // local `.branches.md` scratch files leak into the check.
  const out = execFileSync(
    'git', ['ls-files', '--', 'docs/specs/relations/*.branches.md'],
    { encoding: 'utf8' }
  );
  return out.split('\n').map((l) => l.trim()).filter(Boolean);
}

function main() {
  const all = process.argv.includes('--all');
  const indexPath = arg('--index');

  if (!all && !indexPath) {
    process.stderr.write('check-branch-index: usage: --index <path> | --all\n');
    process.exit(2);
  }
  // FIX 9 (reviewer LOW): --all previously silently ignored a co-supplied
  // --index with no trace — surface it instead of guessing intent.
  if (all && indexPath) {
    process.stderr.write(`check-branch-index: WARN: --all given, ignoring --index ${indexPath}\n`);
  }

  const paths = all ? resolveAllIndexes() : [indexPath];

  if (all && paths.length === 0) {
    // FIX 9: WARN token so a log grep can tell "0 indexes checked" apart
    // from "checked N, all fresh" — bare exit-0 prose reads as success either way.
    process.stdout.write('check-branch-index --all: WARN: no docs/specs/relations/*.branches.md tracked yet — nothing to check\n');
    process.exit(0);
  }

  let failed = false;
  for (const p of paths) {
    const result = branchIndexFresh(p);
    const status = result.ok ? 'FRESH' : (result.status || 'STALE');
    process.stdout.write(`[${status}] ${p}: ${result.evidence}\n`);
    if (!result.ok) failed = true;
  }
  process.exit(failed ? 1 : 0);
}

// FIX 1 (reviewer CRITICAL): this file exports nothing — it is a leaf CLI,
// never imported as a library — so there is no "am I the main module" case
// to guard against. The previous guard compared `process.argv[1]` (the
// invoked path, e.g. a symlink) against `fileURLToPath(import.meta.url)`
// (Node's resolved REALPATH), which differ whenever this script is invoked
// through a symlink — exactly how svc installs `scripts/` into every host
// farm (`~/.claude/skills/scripts -> .../scripts`, provision/hosts/claude.json).
// Under that mismatch `main()` never ran: no output, exit 0, on every input
// including the usage error — a permanent green light. Call it unconditionally.
main();
