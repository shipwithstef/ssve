#!/usr/bin/env node
/**
 * parse-proposal.mjs — Proposal → JSON AST for capture-idea --from-proposal.
 *
 * Contract: see skills/capture-idea/references/from-proposal.md
 *
 * Usage:
 *   node skills/capture-idea/scripts/parse-proposal.mjs <proposal-path>
 *
 * Exit 0 with JSON on stdout; exit 1 on parse error.
 */

import fs from "node:fs";
import path from "node:path";

function die(msg) {
  process.stderr.write(`parse-proposal: ${msg}\n`);
  process.exit(1);
}

const argvPath = process.argv[2];
if (!argvPath) die("usage: parse-proposal.mjs <proposal-path>");
if (!fs.existsSync(argvPath)) die(`file not found: ${argvPath}`);

const source = fs.readFileSync(argvPath, "utf8");
const lines = source.split(/\r?\n/);

// ---------------------------------------------------------------------------
// Pass 1 — tokenize into heading/line records
// ---------------------------------------------------------------------------

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;
const records = lines.map((line, idx) => {
  const m = line.match(HEADING_RE);
  if (m) return { type: "heading", level: m[1].length, text: m[2], raw: line, lineno: idx + 1 };
  return { type: "line", raw: line, lineno: idx + 1 };
});

// ---------------------------------------------------------------------------
// Pass 2 — find phase + leaf boundaries using a heading-depth stack
// ---------------------------------------------------------------------------

const PHASE_RE = /^Phase\s+(\d+|[A-Z]+)\b/;
const LEAF_RE = /^P(\d+)\.(\d+)\b/;

/**
 * Walk the records. A phase is a level-3 heading whose text begins with `Phase N` or `Phase X`.
 * A leaf (Pattern A) is a level-5 heading whose text begins with `P<N>.<M>`.
 * Leaves belong to the most recently opened phase.
 */

const phases = [];
let currentPhase = null;
let currentLeaf = null;
let topLevelBuffer = []; // content outside any phase — used for monolithic mode

for (const rec of records) {
  if (rec.type === "heading") {
    if (rec.level === 3 && PHASE_RE.test(rec.text)) {
      // New phase boundary
      currentPhase = {
        id: `Phase ${rec.text.match(PHASE_RE)[1]}`,
        heading_text: rec.text,
        level: 3,
        raw_content: [],
        leaves: [],
      };
      currentLeaf = null;
      phases.push(currentPhase);
      continue;
    }

    if (rec.level === 5 && LEAF_RE.test(rec.text) && currentPhase) {
      // New heading-based leaf
      const leafMatch = rec.text.match(LEAF_RE);
      const leafId = `P${leafMatch[1]}.${leafMatch[2]}`;
      // Everything after the leaf ID + separator is the goal
      const goal = rec.text.replace(/^P\d+\.\d+\s*[—:\-]?\s*/, "").trim();
      currentLeaf = {
        id: leafId,
        source_anchor: `§ ${leafId}`,
        goal,
        heading_text: rec.text,
        level: 5,
        raw_content: [],
      };
      currentPhase.leaves.push(currentLeaf);
      continue;
    }

    // Headings deeper than 5 or other depths within a leaf become part of leaf content
    if (currentLeaf) {
      currentLeaf.raw_content.push(rec.raw);
      continue;
    }
    if (currentPhase) {
      currentPhase.raw_content.push(rec.raw);
      continue;
    }
    topLevelBuffer.push(rec.raw);
    continue;
  }

  // Non-heading line
  if (currentLeaf) {
    currentLeaf.raw_content.push(rec.raw);
  } else if (currentPhase) {
    currentPhase.raw_content.push(rec.raw);
  } else {
    topLevelBuffer.push(rec.raw);
  }
}

// ---------------------------------------------------------------------------
// Pass 3 — block extraction within each leaf / phase / monolithic root
// ---------------------------------------------------------------------------

const BLOCK_NAMES = {
  goals: "goals",
  goal: "goals",
  "non-goals": "non_goals",
  "non-goal": "non_goals",
  "explicit non-goals": "non_goals",
  "acceptance criteria": "acs",
  acceptance: "acs",
  ac: "acs",
  acs: "acs",
  "scope boundary": "file_impact",
  scope: "file_impact",
  "file impact": "file_impact",
  rollback: "rollback",
  size: "size",
  "risk class": "size",
};

// Match bold-paragraph labels: **Label:** text  OR  **Label**: text  OR  **Label** text
// Captured label (group 1) may have a trailing colon that we strip at lookup time.
const BOLD_LABEL_RE = /^\*\*([^*]+?)\*\*\s*[:：]?\s*(.*)$/;

function extractBlocks(rawContent) {
  // Blocks can be introduced by:
  //   (a) ATX headings whose text case-insensitively matches a block name
  //   (b) bold-paragraph labels like **Goal:** ... (single-line) or **Goal:**\n<content>
  // We collect blocks by scanning sequentially.
  const blocks = {};
  let currentBlockKey = null;
  let currentBlockLines = [];

  function flush() {
    if (currentBlockKey !== null) {
      const content = currentBlockLines.join("\n").trim();
      if (content && !blocks[currentBlockKey]) {
        blocks[currentBlockKey] = content;
      }
    }
    currentBlockKey = null;
    currentBlockLines = [];
  }

  for (const line of rawContent) {
    // Heading-introduced block?
    const h = line.match(HEADING_RE);
    if (h) {
      const key = BLOCK_NAMES[h[2].trim().toLowerCase()];
      if (key) {
        // Known block heading → flush previous, start new block.
        flush();
        currentBlockKey = key;
        currentBlockLines = [];
        continue;
      }
      // Unknown heading (e.g., `### US-01`): if we're inside a block, treat
      // the heading line as content rather than flushing. Prevents AC loss
      // when proposals nest user-story subheadings under `## Acceptance Criteria`.
      if (currentBlockKey !== null) {
        currentBlockLines.push(line);
        continue;
      }
      // Unknown heading outside any block: skip (noise between blocks).
      continue;
    }

    // Bold-label-introduced block?
    const b = line.match(BOLD_LABEL_RE);
    if (b) {
      const label = b[1].replace(/[:：]\s*$/, "").trim().toLowerCase();
      const key = BLOCK_NAMES[label];
      if (key) {
        flush();
        currentBlockKey = key;
        currentBlockLines = [];
        const rest = b[2].trim();
        if (rest) currentBlockLines.push(rest);
        continue;
      }
    }

    if (currentBlockKey !== null) currentBlockLines.push(line);
  }
  flush();
  return blocks;
}

// Extract blocks for each phase and each leaf
for (const phase of phases) {
  phase.blocks = extractBlocks(phase.raw_content);
  for (const leaf of phase.leaves) {
    leaf.blocks = extractBlocks(leaf.raw_content);
  }
}

// Monolithic fallback — if zero phases detected
const isMonolithic = phases.length === 0;
let monolithicLeaf = null;
if (isMonolithic) {
  monolithicLeaf = {
    id: "monolithic",
    source_anchor: `§ ${path.basename(argvPath, ".md")}`,
    goal: "",
    blocks: extractBlocks(topLevelBuffer),
  };
}

// ---------------------------------------------------------------------------
// Pass 4 — inheritance (leaf inherits phase AC if leaf's is empty/missing)
// ---------------------------------------------------------------------------

for (const phase of phases) {
  for (const leaf of phase.leaves) {
    if (!leaf.blocks.acs || leaf.blocks.acs.trim() === "") {
      if (phase.blocks.acs && phase.blocks.acs.trim() !== "") {
        leaf.blocks.acs = phase.blocks.acs;
        leaf.blocks.acs_inherited_from = phase.id;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Pass 5 — metadata + title extraction
// ---------------------------------------------------------------------------

const titleRec = records.find((r) => r.type === "heading" && r.level === 1);
const title = titleRec ? titleRec.text : path.basename(argvPath, ".md");

const totalLeafCount = isMonolithic ? 1 : phases.reduce((n, p) => n + p.leaves.length, 0);

const out = {
  metadata: {
    proposal_path: argvPath,
    title,
    monolithic: isMonolithic,
    leaf_count: totalLeafCount,
  },
  phases: isMonolithic
    ? []
    : phases.map((p) => ({
        id: p.id,
        heading_text: p.heading_text,
        blocks: p.blocks,
        leaves: p.leaves.map((l) => ({
          id: l.id,
          source_anchor: l.source_anchor,
          heading_text: l.heading_text,
          goal: l.goal,
          blocks: l.blocks,
        })),
      })),
  monolithic_leaf: isMonolithic ? monolithicLeaf : null,
};

process.stdout.write(JSON.stringify(out, null, 2) + "\n");
