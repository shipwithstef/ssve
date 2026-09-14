#!/usr/bin/env node
// scripts/promote-auto-learnings.mjs
//
// Explicit promotion path from gitignored audit log to tracked learning
// files per WI-343 tranche 2. NEVER auto-promotes. Reads
// `.svc/auto-learnings.jsonl` (or `.svc/auto-learnings.draft.jsonl` with
// --from-draft), classifies each entry by its `candidate_target`, presents
// a per-entry checklist (interactive or via --accept-all for cron), and
// appends approved entries to the appropriate tracked file.
//
// Usage:
//   node scripts/promote-auto-learnings.mjs                    # interactive review
//   node scripts/promote-auto-learnings.mjs --from-draft       # use draft audit log
//   node scripts/promote-auto-learnings.mjs --accept-all       # non-interactive
//   node scripts/promote-auto-learnings.mjs --dry-run          # show plan, no writes
//   node scripts/promote-auto-learnings.mjs --filter <signal>  # only this signal type
//
// Target routing (entries must declare candidate_target in their schema):
//   framework-learnings → references/framework-learnings.jsonl
//   project-learnings   → docs/learnings/learnings.jsonl
//   user-memory         → resolved via scripts/lib/resolve-user-memory-path.mjs
//                          (tranche 2b; tranche 2a refuses user-memory targets)
//
// Promotion contract:
//   - Reads source audit log; iterates each candidate
//   - Dedups against destination tracked file (skip-if-existing)
//   - Per-entry prompt (or --accept-all): [a]ccept / [s]kip / [q]uit
//   - On accept: append to destination; remove from source audit log
//   - On skip:   leave in audit log (next promotion run sees it again)
//   - On quit:   stop; remaining entries stay in audit log
//
// Schema baselined 2026-05-12 by WI-343 tranche 2a.

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { dedupAgainstPaths } from "./lib/learning-dedup.mjs";
import { appendJsonlLine, writeJsonlAtomic } from "./state-io.mjs";
import { resolveUserMemoryPath } from "./lib/resolve-user-memory-path.mjs";
import { redactSecretsDeep, scrubSlugSecrets } from "./lib/secret-redaction.mjs";
import { normalizeLearningEntry } from "../hooks/lib/learning-index.mjs";
import { hasFrameworkLearningCredit } from "./learning-lifecycle.mjs";

const ROOT = process.cwd();

// Signal → memory `type` field (per the auto-memory schema in the CLI prompt).
// `stale-capability-rediscovery` reads as a "where to look" pointer — that's
// the `reference` archetype. The other five encode guidance about how to
// approach work, which is the `feedback` archetype.
const SIGNAL_TO_MEMORY_TYPE = {
  "correction-after-failure": "feedback",
  "review-finding-remediation": "feedback",
  "hook-side-effect": "feedback",
  "recursive-failure-observation": "feedback",
  "stale-capability-rediscovery": "reference",
  "new-rule-class-observation": "feedback",
};

// Map each signal heuristic to the `type` field of the existing learnings
// schema. The signal name maps 1:1 to type for now — future heuristics may
// override here if a more descriptive type label fits the learning shape.
const SIGNAL_TO_TYPE = {
  "correction-after-failure": "correction-after-failure",
  "review-finding-remediation": "review-finding-remediation",
  "hook-side-effect": "hook-side-effect",
  "recursive-failure-observation": "recursive-failure-observation",
  "stale-capability-rediscovery": "stale-capability-rediscovery",
  "new-rule-class-observation": "new-rule-class-observation",
};

// Transform an audit-log candidate (auto-learning-candidate.schema.json shape)
// into a tracked learning row (references/framework-learnings.jsonl shape).
// Codex PR #126 review MEDIUM: hook captures schema_version/captured_at/
// candidate_target/trigger/session_id, but the preload path reads date/skill/
// type/insight. Without this transform, promoted rows show as "(undefined,
// confidence: N)" in the preload output.
function candidateToLearningRow(c) {
  const date = String(c.captured_at || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
  const type = SIGNAL_TO_TYPE[c.signal] || String(c.signal || "auto-captured");
  const provenance = `${c.source || "(unsourced)"} — auto-captured via WI-343 hook (signal=${c.signal}, trigger=${c.trigger || "unknown"}, session=${c.session_id || "?"})`;
  const row = {
    date,
    skill: "route-workflow,framework-evolution",
    type,
    key: c.key,
    insight: c.insight,
    confidence: c.confidence,
    source: provenance,
    files: Array.isArray(c.files) ? c.files : [],
  };
  const normalized = normalizeLearningEntry(row, { origin: "auto-promotion", source: ".svc/auto-learnings.jsonl" });
  if (!normalized.ok) throw new Error(`candidate ${c.key || "(unknown)"} is malformed: ${normalized.finding.reasons.join(", ")}`);
  return { ...row, confidence: normalized.learning.confidence };
}

const TARGETS = {
  "framework-learnings": path.join(ROOT, "references/framework-learnings.jsonl"),
  "project-learnings": path.join(ROOT, "docs/learnings/learnings.jsonl"),
  // "user-memory" is resolved at runtime via resolve-user-memory-path.mjs;
  // the destination is a directory, not a file, so it is not listed here.
  // classifyTarget handles it explicitly.
};

function memoryFilenameFor(candidate) {
  const memType = SIGNAL_TO_MEMORY_TYPE[candidate.signal] || "feedback";
  const slug = String(candidate.key || "auto").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `${memType}_${slug}.md`.slice(0, 120);
}

function memoryTypeFor(candidate) {
  return SIGNAL_TO_MEMORY_TYPE[candidate.signal] || "feedback";
}

function memoryBodyFor(candidate) {
  const name = candidate.key || "(unnamed)";
  const description = String(candidate.insight || "").replace(/\s+/g, " ").slice(0, 140);
  const memType = memoryTypeFor(candidate);
  const why = `Auto-captured from signal=${candidate.signal} in session ${candidate.session_id || "(unknown)"}. Confidence ${candidate.confidence} per detector heuristic.`;
  const howToApply = "When the same signal class fires in a future session, surface this memory before recommending a fix path — this candidate predates explicit user review.";
  return [
    "---",
    `name: ${name}`,
    `description: ${description}`,
    "metadata:",
    `  type: ${memType}`,
    `  origin: auto-captured`,
    `  signal: ${candidate.signal}`,
    `  confidence: ${candidate.confidence}`,
    `  captured_at: ${candidate.captured_at}`,
    `  session_id: ${candidate.session_id || ""}`,
    "---",
    "",
    candidate.insight || "(no insight)",
    "",
    `**Why:** ${why}`,
    `**How to apply:** ${howToApply}`,
    "",
    `Source: ${candidate.source || "(unsourced)"}`,
    "",
  ].join("\n");
}

function memoryIndexLine(candidate) {
  const filename = memoryFilenameFor(candidate);
  const hook = String(candidate.insight || "").replace(/\s+/g, " ").slice(0, 110);
  return `- [${candidate.key}](${filename}) — ${hook}`;
}

function ensureDirectory(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function userMemoryEntryAlreadyExists(dir, candidate) {
  const filename = memoryFilenameFor(candidate);
  const full = path.join(dir, filename);
  return fs.existsSync(full);
}

function appendMemoryIndex(indexPath, line) {
  let existing = "";
  if (fs.existsSync(indexPath)) {
    existing = fs.readFileSync(indexPath, "utf8");
    if (existing.split(/\r?\n/).some((l) => l.trim() === line.trim())) return;
    if (!existing.endsWith("\n")) existing += "\n";
  }
  fs.writeFileSync(indexPath, existing + line + "\n", "utf8");
}

function writeUserMemoryEntry(dir, candidate) {
  ensureDirectory(dir);
  // Defense-in-depth: redact again at promote time. Catches entries that were
  // captured before the hook-level redaction landed (legacy .svc/auto-learnings.jsonl)
  // OR were hand-edited bypassing the hook. Both paths converge here.
  const safeCandidate = redactSecretsDeep(candidate);
  const filename = memoryFilenameFor(safeCandidate);
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, memoryBodyFor(safeCandidate), "utf8");
  appendMemoryIndex(path.join(dir, "MEMORY.md"), memoryIndexLine(safeCandidate));
  return filePath;
}

function usage() {
  console.error(
    "Usage: node scripts/promote-auto-learnings.mjs [--from-draft] [--accept-all] [--dry-run] [--filter <signal>]",
  );
  process.exit(2);
}

function parseArgs(argv) {
  const args = {
    fromDraft: false,
    acceptAll: false,
    dryRun: false,
    filter: null,
    sourceOverride: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const tok = argv[i];
    if (tok === "--from-draft") { args.fromDraft = true; continue; }
    if (tok === "--accept-all") { args.acceptAll = true; continue; }
    if (tok === "--dry-run") { args.dryRun = true; continue; }
    if (tok === "--filter") { args.filter = argv[++i]; continue; }
    if (tok === "--source") { args.sourceOverride = argv[++i]; continue; }
    if (tok.startsWith("--")) usage();
  }
  return args;
}

function readJsonlLines(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const out = [];
  const raw = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of raw) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* drop malformed */ }
  }
  return out;
}

// JSONL rewrite uses state-io's writeJsonlAtomic (temp + fsync + rename under
// state lock). Codex PR #126 review MEDIUM: a previous version wrapped a raw
// fs.writeFileSync in withStateLock, which serialized writers but did NOT
// give atomic-rewrite semantics. A crash mid-write could truncate the audit
// log after the tracked-learning append. writeJsonlAtomic mirrors
// writeJsonAtomic's contract: on crash, original file stays intact; on
// success, the new payload is observed atomically by readers.
function writeJsonlLines(filePath, entries) {
  return writeJsonlAtomic(filePath, entries);
}

// Single-row append; delegates to state-io's appendJsonlLine for the lock +
// directory-creation + final newline contract. Defense-in-depth redaction
// runs at promote time to catch legacy un-redacted entries.
function appendLearningRow(filePath, row) {
  return appendJsonlLine(filePath, redactSecretsDeep(row));
}

function shortKey(c) {
  return `[${c.signal || "?"}] ${c.key || "?"}`;
}

function renderCandidate(c, idx, total) {
  const lines = [];
  lines.push(`────────────────────────────────────────────────────────────`);
  lines.push(`Candidate ${idx + 1} of ${total}`);
  lines.push(`  signal:           ${c.signal}`);
  lines.push(`  key:              ${c.key}`);
  lines.push(`  confidence:       ${c.confidence}`);
  lines.push(`  candidate_target: ${c.candidate_target || "(unset)"}`);
  lines.push(`  source:           ${c.source || "(unset)"}`);
  lines.push(`  captured_at:      ${c.captured_at}`);
  lines.push(`  insight:`);
  const insight = String(c.insight || "");
  for (const chunk of insight.match(/.{1,76}(\s|$)/g) || [insight]) {
    lines.push(`    ${chunk.trim()}`);
  }
  return lines.join("\n");
}

async function prompt(rl, question) {
  return new Promise((resolve) => rl.question(question, (a) => resolve(a)));
}

function classifyTarget(c) {
  const target = String(c.candidate_target || "framework-learnings");
  if (target === "user-memory") {
    const resolved = resolveUserMemoryPath();
    return {
      target,
      destPath: resolved.path,
      destKind: "directory",
      reason: null,
      memoryHost: resolved.host,
      memorySource: resolved.source,
    };
  }
  if (!TARGETS[target]) {
    return { target, destPath: null, destKind: null, reason: `target '${target}' not recognized` };
  }
  return { target, destPath: TARGETS[target], destKind: "jsonl", reason: null };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourcePath = args.sourceOverride
    ? path.resolve(args.sourceOverride)
    : (args.fromDraft
        ? path.join(ROOT, ".svc/auto-learnings.draft.jsonl")
        : path.join(ROOT, ".svc/auto-learnings.jsonl"));

  if (!fs.existsSync(sourcePath)) {
    console.log(`No audit log at ${path.relative(ROOT, sourcePath)} — nothing to promote.`);
    return;
  }

  // CRITICAL: redact AT READ TIME, not at write time. Otherwise legacy
  // un-redacted entries (captured before the redaction landed, or
  // hand-edited) leak to stdout via renderCandidate / dry-run / interactive
  // prompts BEFORE the writers' defense-in-depth redaction fires. Codex
  // review caught this P2 leak on the secret-redaction implementation PR.
  // Read-time defense: redactSecretsDeep masks original-form secrets in
  // free text; scrubSlugSecrets ALSO masks slug-form secrets that legacy
  // detector output may have baked into candidate.key BEFORE the detector
  // slugify fix landed. Codex round-2 on PR #136 caught the legacy slug
  // leak — old keys like "correction-fix-saw-bearer-abc1234567890abcdef0123"
  // were rendered by --dry-run / interactive prompts unmasked.
  const all = readJsonlLines(sourcePath).map((c) => {
    const redacted = redactSecretsDeep(c);
    if (redacted && typeof redacted === "object" && typeof redacted.key === "string") {
      redacted.key = scrubSlugSecrets(redacted.key);
    }
    return redacted;
  });
  if (all.length === 0) {
    console.log(`Audit log ${path.relative(ROOT, sourcePath)} is empty.`);
    return;
  }

  const candidates = args.filter ? all.filter((c) => c.signal === args.filter) : all;
  if (candidates.length === 0) {
    console.log(`No candidates match filter --filter=${args.filter}.`);
    return;
  }

  console.log(`Promotion review: ${candidates.length} candidate(s) from ${path.relative(ROOT, sourcePath)}`);
  if (args.dryRun) console.log(`(dry-run; no writes will happen)`);
  if (args.acceptAll) console.log(`(--accept-all; non-interactive)`);

  // Build dedup index per target so we don't ask about already-promoted entries
  const remaining = [];     // entries to keep in audit log
  const promoted = [];      // entries successfully written to a tracked file
  const skipped = [];       // explicit skip
  const blocked = [];       // unsupported target / dedup match

  const rl = (args.acceptAll || args.dryRun)
    ? null
    : readline.createInterface({ input: process.stdin, output: process.stdout });

  let quit = false;

  for (let i = 0; i < candidates.length; i += 1) {
    const c = candidates[i];
    if (quit) {
      remaining.push(c);
      continue;
    }

    const { target, destPath, destKind, reason, memoryHost, memorySource } = classifyTarget(c);
    if (!destPath) {
      blocked.push({ candidate: c, reason });
      remaining.push(c); // keep in audit log; reviewer can re-classify
      continue;
    }
    if (target === "framework-learnings" && !args.dryRun && !hasFrameworkLearningCredit(ROOT, c.key)) {
      blocked.push({ candidate: c, reason: "framework credit requires a verified used outcome and independent evaluate-rule elevation" });
      remaining.push(c);
      continue;
    }

    // Dedup against the destination — strategy depends on destination kind.
    let alreadyPresent = false;
    if (destKind === "jsonl") {
      alreadyPresent = dedupAgainstPaths(c, [destPath]);
    } else if (destKind === "directory") {
      alreadyPresent = userMemoryEntryAlreadyExists(destPath, c);
    }
    if (alreadyPresent) {
      const where = destKind === "directory"
        ? path.join(destPath, memoryFilenameFor(c))
        : destPath;
      blocked.push({ candidate: c, reason: `already present in ${where}` });
      continue;
    }

    // Display path for prompts/dry-run output.
    const displayDest = destKind === "directory"
      ? `${destPath} (${memorySource || "user-memory"})`
      : path.relative(ROOT, destPath);

    let decision;
    if (args.acceptAll) {
      decision = "a";
    } else if (args.dryRun) {
      console.log("\n" + renderCandidate(c, i, candidates.length));
      console.log(`  → would promote to ${displayDest}`);
      decision = "a"; // dry-run treats all as accept for planning purposes
    } else {
      console.log("\n" + renderCandidate(c, i, candidates.length));
      const a = (await prompt(rl, `  → promote to ${displayDest}? [a]ccept / [s]kip / [q]uit: `)).trim().toLowerCase();
      decision = a || "s";
    }

    if (decision === "q") {
      quit = true;
      remaining.push(c);
      continue;
    }
    if (decision === "a") {
      if (!args.dryRun) {
        if (destKind === "directory") {
          writeUserMemoryEntry(destPath, c);
        } else {
          const row = candidateToLearningRow(c);
          appendLearningRow(destPath, row);
        }
      }
      promoted.push({ candidate: c, destPath, destKind });
    } else {
      skipped.push(c);
      remaining.push(c); // user-skip stays in audit log for re-review
    }
  }

  if (rl) rl.close();

  // Rewrite the audit log with what stayed (drop promoted + dedup-redundant).
  // Codex PR #126 review HIGH: a previous version used signal|key as the
  // identity tuple, which silently dropped survivors when two candidates
  // shared the same signal+key (e.g., one promoted, the other blocked for
  // user-memory target). Use object reference identity instead — each
  // parsed-from-JSONL object is unique even if its content is duplicated
  // elsewhere in the audit log. This preserves blocked-for-target rows
  // for tranche 2b to handle without data loss.
  if (!args.dryRun) {
    const removedRefs = new Set();
    for (const p of promoted) removedRefs.add(p.candidate);
    for (const b of blocked) {
      if (b.reason.startsWith("already present")) removedRefs.add(b.candidate);
    }
    const survivors = all.filter((c) => !removedRefs.has(c));
    writeJsonlLines(sourcePath, survivors);
  }

  // Summary
  console.log(`\n────────────────────────────────────────────────────────────`);
  console.log(`Promotion summary:`);
  console.log(`  promoted:  ${promoted.length}`);
  console.log(`  skipped:   ${skipped.length}`);
  console.log(`  blocked:   ${blocked.length}`);
  console.log(`  remaining in audit log: ${args.dryRun ? all.length : (all.length - promoted.length - blocked.filter((b) => b.reason.startsWith("already present")).length)}`);
  if (promoted.length > 0) {
    console.log(`\n  Promoted:`);
    for (const p of promoted) {
      const target = p.destKind === "directory"
        ? path.join(p.destPath, memoryFilenameFor(p.candidate))
        : path.relative(ROOT, p.destPath);
      console.log(`    • ${shortKey(p.candidate)} → ${target}`);
    }
  }
  if (blocked.length > 0) {
    console.log(`\n  Blocked:`);
    for (const b of blocked) {
      console.log(`    • ${shortKey(b.candidate)} — ${b.reason}`);
    }
  }
}

main().catch((e) => {
  console.error(`promote-auto-learnings failed: ${e.message}`);
  process.exit(1);
});
