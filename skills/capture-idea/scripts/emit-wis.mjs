#!/usr/bin/env node
/**
 * emit-wis.mjs — Consume parse-proposal.mjs JSON and emit WI files + archive.
 *
 * Contract: see skills/capture-idea/references/from-proposal.md
 *
 * Usage:
 *   node skills/capture-idea/scripts/emit-wis.mjs <proposal-path> [--dry-run] [--wi-dir <dir>]
 *
 * Default --wi-dir = docs/specs/work-items
 *
 * Exit 0 on success (including idempotent no-op); exit 1 on error.
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { appendJsonlLine } from "../../../scripts/state-io.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function die(msg) {
  process.stderr.write(`emit-wis: ${msg}\n`);
  process.exit(1);
}

function log(msg) {
  process.stderr.write(`emit-wis: ${msg}\n`);
}

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === "--dry-run") args.dryRun = true;
  else if (a === "--wi-dir") args.wiDir = process.argv[++i];
  else if (a === "--decisions-log") args.decisionsLog = process.argv[++i];
  else if (!args.proposalPath) args.proposalPath = a;
  else die(`unknown argument: ${a}`);
}

if (!args.proposalPath) die("usage: emit-wis.mjs <proposal-path> [--dry-run] [--wi-dir <dir>] [--decisions-log <path>]");
const proposalPath = args.proposalPath;
const wiDir = args.wiDir || "docs/specs/work-items";
const decisionsLog = args.decisionsLog || ".svc/pipeline-decisions.jsonl";
const dryRun = args.dryRun || false;

if (!fs.existsSync(proposalPath)) die(`proposal not found: ${proposalPath}`);

// ---------------------------------------------------------------------------
// Idempotency: already-promoted detection
// ---------------------------------------------------------------------------
const proposalDoneDir = path.join(path.dirname(proposalPath), "done");
const basename = path.basename(proposalPath);
const alreadyInDone = proposalPath.includes("/done/");
const doneCandidate = path.join(proposalDoneDir, basename);

function hasPromotedTrailer(p) {
  if (!fs.existsSync(p)) return false;
  const txt = fs.readFileSync(p, "utf8");
  return /\*\*Promoted to:\*\*/.test(txt);
}

const alreadyPromoted = alreadyInDone || hasPromotedTrailer(proposalPath) || fs.existsSync(doneCandidate);
if (alreadyPromoted) {
  log(`proposal ${basename} already promoted — no action`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------
const parserPath = path.join(__dirname, "parse-proposal.mjs");
let astJson;
try {
  astJson = execSync(`node "${parserPath}" "${proposalPath}"`, { encoding: "utf8" });
} catch (e) {
  die(`parser failed: ${e.message}`);
}
const ast = JSON.parse(astJson);

// ---------------------------------------------------------------------------
// WI numbering
// ---------------------------------------------------------------------------
function nextWiNumber() {
  if (!fs.existsSync(wiDir)) return 1;
  const files = fs.readdirSync(wiDir).filter((f) => /^WI-\d+\.md$/.test(f));
  const nums = files.map((f) => parseInt(f.match(/^WI-(\d+)\.md$/)[1], 10));
  return nums.length ? Math.max(...nums) + 1 : 1;
}

function wiFilename(n) {
  return path.join(wiDir, `WI-${String(n).padStart(3, "0")}.md`);
}

// ---------------------------------------------------------------------------
// Self-exclusion: skip leaves whose proposal basename OR source anchor matches
// an existing WI. Anchor-only matching misses post-merge captures where the
// proposal was moved proposals/ → proposals/done/ (observed WI-081 duplicate
// of WI-079). Basename-matching catches that case; anchor-matching still
// catches partial re-captures from the same proposal into new leaves.
// ---------------------------------------------------------------------------
function findExistingWiByAnchorOrBasename(anchor, proposalBasename) {
  if (!fs.existsSync(wiDir)) return null;
  const files = fs.readdirSync(wiDir).filter((f) => /^WI-\d+\.md$/.test(f));
  for (const f of files) {
    const txt = fs.readFileSync(path.join(wiDir, f), "utf8");
    const m = txt.match(/\*\*Source:\*\*\s*(.+?)(?:\n|$)/);
    if (!m) continue;
    const sourceLine = m[1];
    // Anchor match — handles phased leaves where Source includes § P<N>.<M>.
    if (anchor && sourceLine.includes(anchor)) return f.replace(/\.md$/, "");
    // Basename match — handles monolithic proposals whose Source is a bare
    // path (no § anchor), and catches cross-directory re-captures after
    // proposals/ → proposals/done/ moves.
    if (proposalBasename && sourceLine.includes(proposalBasename)) return f.replace(/\.md$/, "");
  }
  return null;
}

// ---------------------------------------------------------------------------
// WI body renderer
// ---------------------------------------------------------------------------
function renderWi({ wiId, leaf, proposalPath, proposalTitle, isMonolithic }) {
  const today = new Date().toISOString().slice(0, 10);
  const lane = proposalPath.startsWith("proposals/") ? "framework" : "TBD";
  const sourceLine = isMonolithic
    ? `${proposalPath}`
    : `${proposalPath} ${leaf.source_anchor}`;

  const typeGuess = /refactor|port/i.test(leaf.goal || leaf.heading_text || "")
    ? "refactor"
    : /bug|fix/i.test(leaf.goal || leaf.heading_text || "")
      ? "bugfix"
      : "feature";

  const block = (label, fallback) => {
    const v = leaf.blocks?.[label];
    if (v && v.trim()) return v;
    return fallback;
  };

  return [
    `# ${wiId}: ${leaf.goal || proposalTitle}`,
    ``,
    `**Type:** ${typeGuess}`,
    `**Status:** DRAFT`,
    `**Severity:** medium`,
    `**Filed:** ${today}`,
    `**Source:** ${sourceLine}`,
    `**Lane:** ${lane}`,
    ``,
    `## Goal`,
    ``,
    // Prefer the parsed goals block (content under `## Goal` / `**Goal:**`)
    // over the heading-derived leaf.goal, which is typically empty for
    // monolithic proposals. Remove the redundant `## Goals` section that
    // previously duplicated this content.
    block("goals", leaf.goal || "_TBD — defer to plan-changeset_"),
    ``,
    `## Non-Goals`,
    ``,
    block("non_goals", "_TBD — defer to plan-changeset_"),
    ``,
    `## Acceptance Criteria`,
    ``,
    leaf.blocks?.acs_inherited_from
      ? `_(Inherited from ${leaf.blocks.acs_inherited_from})_\n\n${block("acs", "_TBD — defer to plan-changeset_")}`
      : block("acs", "_TBD — defer to plan-changeset_"),
    ``,
    `## File Impact`,
    ``,
    block("file_impact", "_TBD — defer to plan-changeset_"),
    ``,
    `## Rollback`,
    ``,
    block("rollback", "_TBD — defer to plan-changeset_"),
    ``,
    `## Source`,
    ``,
    `- Promoted from: \`${proposalPath}\``,
    `- Leaf: \`${leaf.source_anchor || "(monolithic)"}\``,
    `- Promoted at: ${new Date().toISOString()}`,
    ``,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Collect leaves (phased or monolithic)
// ---------------------------------------------------------------------------
const leaves = [];
if (ast.metadata.monolithic) {
  leaves.push(ast.monolithic_leaf);
} else {
  for (const phase of ast.phases) {
    for (const leaf of phase.leaves) leaves.push(leaf);
  }
}

// ---------------------------------------------------------------------------
// Atomic WI allocation (WI-098) — multiple parallel sessions invoking
// capture-idea must not collide on WI numbers. We reserve each number by
// creating its WI-NNN.md file with `wx` flag (fails with EEXIST if another
// process beat us) and bump on conflict. Dry-run mode skips reservation.
// ---------------------------------------------------------------------------
function reserveNextWi(startFrom, dryRun) {
  let n = startFrom;
  while (true) {
    const filename = wiFilename(n);
    if (dryRun) {
      if (!fs.existsSync(filename)) return { n, filename };
      n += 1;
      continue;
    }
    try {
      // 'wx' flag: create-exclusive. Throws EEXIST if file already exists.
      // This is the POSIX atomic reservation primitive.
      fs.writeFileSync(filename, "", { flag: "wx" });
      return { n, filename };
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
      n += 1;
    }
  }
}

// Apply self-exclusion
if (!dryRun && !fs.existsSync(wiDir)) fs.mkdirSync(wiDir, { recursive: true });
const emitted = [];
const skipped = [];
let nextHint = nextWiNumber();
for (const leaf of leaves) {
  // Phased leaves carry a distinguishing anchor (§ P<N>.<M>); monolithic
  // leaves share a single anchor equal to the basename, so falling back to
  // basename-match is only safe for monolithic proposals. For phased, basename
  // alone would falsely skip every sibling leaf.
  const existingWi = findExistingWiByAnchorOrBasename(
    leaf.source_anchor,
    ast.metadata.monolithic ? basename : null,
  );
  if (existingWi) {
    skipped.push({ leaf: leaf.id, source_anchor: leaf.source_anchor, existing_wi: existingWi });
    continue;
  }
  const { n, filename } = reserveNextWi(nextHint, dryRun);
  const wiId = `WI-${String(n).padStart(3, "0")}`;
  const body = renderWi({
    wiId,
    leaf,
    proposalPath,
    proposalTitle: ast.metadata.title,
    isMonolithic: ast.metadata.monolithic,
  });
  emitted.push({ wiId, leaf, filename, body });
  nextHint = n + 1;
}

if (dryRun) {
  process.stdout.write(
    JSON.stringify(
      {
        dry_run: true,
        emitted: emitted.map(({ wiId, leaf, filename }) => ({ wiId, leaf: leaf.id, filename })),
        skipped,
      },
      null,
      2,
    ) + "\n",
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Write WIs, move proposal, append trailer, log decision
// ---------------------------------------------------------------------------
if (!fs.existsSync(wiDir)) fs.mkdirSync(wiDir, { recursive: true });
for (const { filename, body } of emitted) {
  fs.writeFileSync(filename, body);
}

// Archive: move proposal to proposals/done/<basename>
let doneTarget = doneCandidate;
if (!fs.existsSync(proposalDoneDir)) fs.mkdirSync(proposalDoneDir, { recursive: true });
fs.renameSync(proposalPath, doneTarget);

// Append trailer
const trailerLines = [
  "",
  "",
  "---",
  "",
  `**Promoted to:** ${emitted.map((e) => e.filename).join(", ")}`,
  `**Promoted at:** ${new Date().toISOString()}`,
];
if (skipped.length) {
  trailerLines.push(
    `**Skipped (already-existing):** ${skipped
      .map((s) => `${s.existing_wi} (leaf ${s.leaf})`)
      .join(", ")} — per self-exclusion rule in skills/capture-idea/references/from-proposal.md §5`,
  );
}
fs.appendFileSync(doneTarget, trailerLines.join("\n") + "\n");

// Log decision
const decisionEntry = {
  timestamp: new Date().toISOString(),
  run_id: `capture-idea-from-proposal-${path.basename(proposalPath, ".md")}`,
  skill: "capture-idea",
  mode: "from-proposal",
  proposal: proposalPath,
  promoted_path: doneTarget,
  emitted_wis: emitted.map((e) => e.wiId),
  skipped_leaves: skipped,
  decision_type: "taste",
};
appendJsonlLine(decisionsLog, decisionEntry);

// Report
process.stdout.write(
  JSON.stringify(
    {
      emitted: emitted.map(({ wiId, leaf, filename }) => ({ wiId, leaf: leaf.id, filename })),
      skipped,
      proposal_moved_to: doneTarget,
      decision_logged_in: decisionsLog,
    },
    null,
    2,
  ) + "\n",
);
