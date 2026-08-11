#!/usr/bin/env node
/**
 * Mechanical structural-diff linter for the quick-fix carve-out.
 *
 * Eligibility (content-first):
 *   - Diff is entirely string literal text, comment content, doc text, or whitespace
 *   - No added/removed/renamed identifier, import, export, control-flow, signature, type
 *
 * Path denylist (applies even when content looks clean):
 *   - package.json, lockfiles, tsconfig*.json
 *   - skills-manifest.json, provision/hosts/.../json
 *   - hooks/, scripts/, .github/workflows/
 *   - any .config.js / .config.mjs / .config.ts / .config.cjs
 *
 * Markdown anywhere inherits content-based eligibility.
 *
 * Multi-file allowance: up to 3 files for pure-text changes when total diff
 * is <= 30 added + 30 removed lines AND every line passes content check.
 *
 * Output: JSON to stdout. Exit 0 if eligible, 1 if not.
 *   { eligible: bool, reasons: [string], files: [string], staged_tree: hash }
 */

import { execFileSync, execSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { classifyFromGit } from "./classify-change-risk.mjs";
import { evaluateImpactTriad } from "../hooks/svc-impact-triad-guard.mjs";

const DENY_PATH_PATTERNS = [
  /^package\.json$/,
  /^package-lock\.json$/,
  /^yarn\.lock$/,
  /^pnpm-lock\.yaml$/,
  /^tsconfig.*\.json$/,
  /^skills-manifest\.json$/,
  /^provision\/hosts\/.*\.json$/,
  /^hooks\//,
  /^scripts\//,
  /^\.github\/workflows\//,
  /\.config\.(js|mjs|ts|cjs)$/,
  /^test-framework\/evals\/tier-1\//,
  /^FRAMEWORK-STATE\.md$/,
  // WI-376 G6-001: concern files carry severity overrides (gate semantics) — a
  // small-markdown CRITICAL→LOW downgrade must never ride the quick-fix path.
  /^\.svc\/concerns\//,
  /^concerns\//,
];

const STRUCTURAL_PATTERNS = [
  /^[+-]\s*import\s+/,
  /^[+-]\s*export\s+/,
  /^[+-]\s*(function|class|interface|type|const|let|var|enum)\s+\w/,
  /^[+-]\s*(if|else|for|while|switch|case|return|throw|try|catch|finally)\b/,
  /^[+-]\s*\w[\w.]*\s*\(/, // function call line added/removed
  /^[+-]\s*\}/, // brace movement
  /^[+-]\s*\{/,
  /^[+-].*=>\s*/, // arrow function
  /^[+-].*=\s*(?!.*['"`])/, // assignment without obvious string-value
];

// Lines that are content-only safe (everything stripped after these is text)
const SAFE_LINE_PATTERNS = [
  /^[+-]\s*$/, // blank line
  /^[+-]\s*\/\//, // line comment
  /^[+-]\s*\*/, // block comment continuation
  /^[+-]\s*\/\*/, // block comment open
  /^[+-]\s*\*\//, // block comment close
  /^[+-]\s*#\s/, // shell / python comment
];

function getStagedDiff() {
  try {
    return execSync(SHA_ARG ? `git diff-tree --no-commit-id -p --unified=0 -r ${SHA_ARG}` : "git diff --cached --unified=0", { encoding: "utf8" });
  } catch (e) {
    return "";
  }
}

function getStagedFiles() {
  try {
    return execSync(SHA_ARG ? `git diff-tree --no-commit-id --name-only -r ${SHA_ARG}` : "git diff --cached --name-only", { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  } catch (e) {
    return [];
  }
}

function getStagedRows() {
  // WI-360 G6-001: name-status with rename/copy detection — name-only hides
  // the SOURCE path of an R100 rename (e.g. scripts/a.mjs -> docs/specs/a.mjs
  // shows only the exempt destination and zero +/- lines).
  try {
    return execSync(SHA_ARG ? `git diff-tree --no-commit-id --name-status -M -C -r ${SHA_ARG}` : "git diff --cached --name-status -M -C", { encoding: "utf8" })
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        const parts = l.split("\t");
        return { status: parts[0], paths: parts.slice(1) };
      });
  } catch (e) {
    return [];
  }
}

const SHA_ARG = (() => { const i = process.argv.indexOf("--sha"); return i > -1 ? process.argv[i + 1] : null; })();

function getStagedTreeHash() {
  try {
    return execSync(SHA_ARG ? `git rev-parse ${SHA_ARG}^{tree}` : "git write-tree", { encoding: "utf8" }).trim();
  } catch (e) {
    return "unknown";
  }
}

// WI-360: deliberate exempt-class carve-out (rules/plan-changeset-trigger.md
// exemptions made mechanically real). Docs/analysis/proposals/knowledge trees
// and work items; .svc JSONL ledgers count only when their own hunks are
// append-only. WI-376 widened: docs/plans (plan manifests land at closeout).
const EXEMPT_PATH_PATTERNS = [
  /^docs\/specs\//,
  /^docs\/analysis\//,
  /^docs\/plans\//,
  /^proposals\//,
  /^references\/knowledge\//,
];

// WI-396 (codex G6 H4 on WI-395 reproduced): a code file under an exempt prefix
// (e.g. docs/specs/payload.js) must NEVER ride the docs/state carve-out — that
// shipped arbitrary code with zero envelope. Executable/source extensions are
// denied exemption regardless of path.
const CODE_FILE_EXT = /\.(c|m)?(js|ts)x?$|\.(sh|bash|zsh|py|rb|go|rs|php|pl|lua|java|kt|swift|c|cc|cpp|h|hpp)$/i;

function isExemptPath(file) {
  if (CODE_FILE_EXT.test(file)) return false;
  return EXEMPT_PATH_PATTERNS.some((p) => p.test(file));
}

function isSvcLedger(file) {
  return /^\.svc\/[^/]+\.jsonl$/.test(file);
}

// WI-369 D1: learnings ledgers — rules/plan-changeset-trigger.md has always
// exempted learning APPENDS; this encodes it (same append-only-own-hunks
// contract as .svc jsonl ledgers).
function isReferenceLedger(file) {
  return /^references\/framework-learnings\.jsonl$/.test(file) ||
         /^docs\/learnings\/learnings\.jsonl$/.test(file);
}

function isAppendOnlyLedger(file) {
  return isSvcLedger(file) || isReferenceLedger(file);
}

// WI-376: closeout-class .svc state — full-rewrite JSON evidence archives
// (task graphs, WI claims, PR review receipts). These are local-machine inputs
// to local wrappers/guards; the gate-relevant artifact is the tree-bound notes
// envelope, so committing the archives never drove enforcement. Deliberately
// NOT exempt: .svc/concerns/** (severity overrides) and any other .svc path.
const SVC_STATE_PATTERNS = [
  /^\.svc\/lane-tasks-[^/]+\.json$/,
  /^\.svc\/claims\/[^/]+\.claim\.json$/,
  /^\.svc\/review-receipts\/[^/]+\.json$/,
];

function isSvcStateFile(file) {
  return SVC_STATE_PATTERNS.some((p) => p.test(file));
}

// WI-376: per-file added/removed so append-only can scope to the ledger files'
// OWN hunks instead of the whole diff (supersedes WI-360's diff-global
// shortcut — a lane-tasks rewrite beside a jsonl append is the canonical
// closeout shape and must not false-couple).
function getStagedNumstat() {
  try {
    const out = execSync(SHA_ARG ? `git diff-tree --no-commit-id --numstat -r ${SHA_ARG}` : "git diff --cached --numstat", { encoding: "utf8" });
    return out
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        const [added, removed, ...rest] = l.split("\t");
        // WI-376 G6-002: numstat prints '-' for binary — non-numeric must fail
        // the append-only check (Infinity), never coerce to 0 (fail-open).
        const num = (v) => (/^\d+$/.test(v) ? Number(v) : Infinity);
        return { added: num(added), removed: num(removed), file: rest.join("\t") };
      });
  } catch (e) {
    return null; // fail-closed at the call site
  }
}

function pathDenied(file) {
  return DENY_PATH_PATTERNS.some((p) => p.test(file));
}

function isMarkdown(file) {
  return /\.md$/i.test(file);
}

function isStringOrCommentLine(line) {
  if (SAFE_LINE_PATTERNS.some((p) => p.test(line))) return true;
  // pure-text line inside a string or doc
  // Heuristic: line has no structural tokens
  return !STRUCTURAL_PATTERNS.some((p) => p.test(line));
}

function classifyDiff(diff, files) {
  const reasons = [];
  const addedLines = [];
  const removedLines = [];
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@") || line.startsWith("diff --git")) continue;
    if (line.startsWith("+")) addedLines.push(line);
    else if (line.startsWith("-")) removedLines.push(line);
  }

  // File count cap (3 files for pure-text)
  if (files.length === 0) {
    reasons.push("no staged files");
    return { eligible: false, reasons, addedLines: 0, removedLines: 0 };
  }

  // WI-360 exempt-class carve-out (WI-376 widened): EVERY file is exempt-class
  // docs/state; .svc JSONL ledgers must be append-only IN THEIR OWN HUNKS
  // (per-file numstat — docs/state rewrites beside a ledger append are fine);
  // closeout-class .svc state files (lane-tasks/claims/review-receipts) may be
  // full rewrites. Denylist still wins. Caps do not apply here.
  const allExempt = files.every((f) => isExemptPath(f) || isAppendOnlyLedger(f) || isSvcStateFile(f));
  const anyDenied = files.some((f) => pathDenied(f));
  const hasLedger = files.some((f) => isAppendOnlyLedger(f));
  // G6-001: every name-status row (incl. rename/copy SOURCES, which name-only
  // hides) must involve only exempt/ledger/state, never-denied paths.
  const rows = getStagedRows();
  const rowsClean = rows.length > 0 && rows.every((r) =>
    r.paths.every((pp) => (isExemptPath(pp) || isAppendOnlyLedger(pp) || isSvcStateFile(pp)) && !pathDenied(pp))
  );
  let ledgerAppendOnly = true;
  if (hasLedger) {
    const numstat = getStagedNumstat();
    ledgerAppendOnly =
      numstat !== null &&
      numstat.every((n) => !isAppendOnlyLedger(n.file) || n.removed === 0);
  }
  if (allExempt && !anyDenied && rowsClean && ledgerAppendOnly) {
    return {
      eligible: true,
      reasons: [`exempt-class carve-out: ${files.length} docs/state file(s); ledger hunks append-only`],
      addedLines: addedLines.length,
      removedLines: removedLines.length,
    };
  }
  if (files.length > 3) {
    reasons.push(`${files.length} files staged; quick-fix allows at most 3`);
  }

  // Line count cap
  if (addedLines.length > 30 || removedLines.length > 30) {
    reasons.push(`${addedLines.length} added + ${removedLines.length} removed lines; quick-fix allows at most 30 each`);
  }

  // Path denylist
  for (const f of files) {
    if (pathDenied(f)) {
      reasons.push(`path '${f}' is on the executable/config denylist`);
    }
  }
  // WI-376 G6-002 (generic path): ledger append-only applies on EVERY route to
  // eligible — a binary jsonl rewrite has no ± text lines, so the caps above
  // cannot see it; only per-file numstat can (with '-' failing closed).
  if (hasLedger && !ledgerAppendOnly) {
    reasons.push("ledger .svc/*.jsonl changes must be append-only in their own hunks");
  }
  // WI-360 G6-001 (global): rename/copy SOURCES are invisible to name-only —
  // an R100 from a denylisted path shows only the destination and zero +/-
  // lines. Check every involved path on every name-status row.
  for (const r of getStagedRows()) {
    for (const pp of r.paths) {
      if (pathDenied(pp)) {
        reasons.push(`row '${r.status} ${r.paths.join(" -> ")}' involves denylisted path '${pp}'`);
      }
    }
  }

  // Content check (every changed line)
  let structuralLine = null;
  for (const line of [...addedLines, ...removedLines]) {
    if (!isStringOrCommentLine(line)) {
      structuralLine = line.substring(0, 100);
      break;
    }
  }
  if (structuralLine && !files.every(isMarkdown)) {
    reasons.push(`structural change detected: "${structuralLine}"`);
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    addedLines: addedLines.length,
    removedLines: removedLines.length,
  };
}

function writeReceipt(treeHash, verdict, files) {
  const dir = join(".svc", "receipts", "staging", treeHash);
  mkdirSync(dir, { recursive: true });
  const receipt = {
    receipt_type: "quick-fix",
    schema_version: 1,
    tree_hash: treeHash,
    eligible: verdict.eligible,
    reasons: verdict.reasons,
    files,
    added_lines: verdict.addedLines,
    removed_lines: verdict.removedLines,
    timestamp: new Date().toISOString(),
    git_user: execSync("git config user.name", { encoding: "utf8" }).trim(),
  };
  writeFileSync(join(dir, "quick-fix.json"), JSON.stringify(receipt, null, 2));
  return receipt;
}

function main() {
  const diff = getStagedDiff();
  const files = getStagedFiles();
  const treeHash = getStagedTreeHash();
  if (!diff && files.length === 0) {
    process.stdout.write(JSON.stringify({ eligible: false, reasons: ["no staged changes"] }) + "\n");
    process.exit(1);
  }
  const verdict = classifyDiff(diff, files);
  // WI-481: the triad classifier is the authoritative risk floor. Historical
  // commits created before the triad schema landed are grandfathered in
  // --sha verification mode; new commits and all staged work are not.
  let triadApplies = !SHA_ARG;
  if (SHA_ARG) {
    try {
      const adoption = execFileSync("git", ["log", "--format=%H", "--diff-filter=A", "-n", "1", SHA_ARG, "--", "schemas/change-impact-triad.schema.json"], { encoding: "utf8" }).trim();
      triadApplies = Boolean(adoption);
    }
    catch { triadApplies = false; }
  }
  if (triadApplies) {
    let risk;
    try {
      risk = classifyFromGit(SHA_ARG
        ? { cwd: process.cwd(), staged: false, range: `${SHA_ARG}^...${SHA_ARG}` }
        : { cwd: process.cwd(), staged: true });
    } catch (error) {
      verdict.eligible = false;
      verdict.reasons.push(`impact classifier failed closed: ${error.message}`);
    }
    if (risk && (risk.tier !== "cosmetic" || risk.never_fast_lane)) {
      verdict.eligible = false;
      verdict.reasons.push(`impact tier '${risk.tier}' is never quick-fix: ${risk.reasons.join(", ")}`);
    }
    // Commit replay cannot recover ignored worktree-local receipts. The
    // pre-commit gate already proved the exact receipt; replay re-derives the
    // cosmetic risk floor. Live staged eligibility additionally requires the
    // owned receipt and its static proof.
    if (!SHA_ARG && risk?.tier === "cosmetic") {
      let impact;
      try { impact = evaluateImpactTriad({ cwd: process.cwd(), env: process.env }); }
      catch (error) { impact = { ok: false, reason: error.message }; }
      if (!impact?.ok || !impact.receipt_path) {
        verdict.eligible = false;
        verdict.reasons.push(`valid cosmetic impact receipt required: ${impact?.reason || "missing receipt"}`);
      }
    }
  }
  if (SHA_ARG) {
    // WI-369 D2: commit-classification mode — print verdict, never touch staging.
    process.stdout.write(JSON.stringify({ sha: SHA_ARG, tree_hash: treeHash, ...verdict, files }) + "\n");
    process.exit(verdict.eligible ? 0 : 1);
  }
  const receipt = writeReceipt(treeHash, verdict, files);
  process.stdout.write(JSON.stringify(receipt) + "\n");
  process.exit(verdict.eligible ? 0 : 1);
}

main();
