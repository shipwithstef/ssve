#!/usr/bin/env node
/**
 * review-station-merge — the mechanical barrier-merge for the post-exec parallel
 * review station (WI-382).
 *
 * The review station fans out the post-exec review lenses (G5 auditor, the
 * cross-family adversarial reviewer, the audit specialists, the visual lens) as
 * READ-ONLY in-session subagents over ONE frozen diff, then merges their finding
 * sets HERE — mechanically, never by orchestrator re-adjudication (WI-382 AC3:
 * keeps self-preferential bias out of the merge).
 *
 * Merge contract (lifted verbatim from skills/audit-implementation/SKILL.md:239-241,
 * itself from gstack review): DEDUPLICATE by file:line; on collision KEEP THE
 * HIGHEST SEVERITY; ATTRIBUTE each finding to its lens source.
 *
 * Also emits (WI-382 AC1) the keyed re-review map: each surviving HIGH/CRITICAL
 * finding records its ORIGINATING lens so a fix re-review re-runs THAT lens, not
 * a generic cross-model pass — preserving NEVER_GATE security/data-migration
 * coverage of fixes.
 *
 * PURE + DETERMINISTIC: no wall-clock, no randomness. Same lens inputs -> same
 * merged ledger in the same order (severity desc, file asc, line asc). Golden-
 * testable by validate-review-station-wave.sh.
 *
 * Usage:
 *   node scripts/review-station-merge.mjs --input lenses.json
 *   echo '<lenses-json>' | node scripts/review-station-merge.mjs
 * Input shape: [{ lens_id, never_gate?:bool, findings:[{file,line,severity,finding,evidence?}] }, ...]
 */

import { readFileSync } from "node:fs";

// Severity lattice — higher wins on a file:line collision.
const SEV_RANK = { CRITICAL: 5, HIGH: 4, MEDIUM: 3, LOW: 2, INFO: 1 };
const sevRank = (s) => SEV_RANK[String(s || "").toUpperCase()] || 0;

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1] || null;
}

function readInput() {
  const p = argValue("--input");
  const raw = p ? readFileSync(p, "utf8") : readFileSync(0, "utf8");
  const v = JSON.parse(raw);
  if (Array.isArray(v)) return v;
  if (v && Array.isArray(v.lenses)) return v.lenses;
  if (v && Array.isArray(v.results)) return v.results;
  // Gemini G6 #1: a hallucinated-but-valid JSON object (e.g. {"summary":"all clear"})
  // must FAIL-CLOSED here, not coerce to an empty (clean) ledger.
  throw new Error("review-station-merge: input is not a lens array (or {lenses|results:[...]})");
}

// The mechanical merge. Exported for the validator's in-process golden test.
export function mergeLensFindings(lenses) {
  // Fail-CLOSED (Gemini G6 #1): a hallucinating lens that returns valid JSON not
  // matching the schema must HALT the gate, not coast through as zero findings.
  if (!Array.isArray(lenses)) throw new Error("review-station-merge: input must be an array of lens results");
  const byLoc = new Map();          // "file~line" -> merged entry
  for (const lens of lenses) {
    if (!lens || typeof lens.lens_id !== "string" || !lens.lens_id || !Array.isArray(lens.findings)) {
      throw new Error("review-station-merge: malformed lens output (missing lens_id or findings[])");
    }
    const lensId = String(lens.lens_id);
    const neverGate = !!lens.never_gate;
    for (const f of lens.findings) {
      const file = String(f && f.file || "");
      const line = String(f && f.line != null ? f.line : "");
      const key = file + "~" + line;     // dedup key (in-memory only; line is always numeric so no ambiguity)
      const rank = sevRank(f && f.severity);
      let entry = byLoc.get(key);
      if (!entry) {
        entry = { file, line, severity: String(f && f.severity || "INFO").toUpperCase(),
          finding: String(f && f.finding || ""), evidence: String(f && f.evidence || ""),
          originating_lens: lensId, never_gate: neverGate, contributing_lenses: [] };
        byLoc.set(key, entry);
      }
      if (!entry.contributing_lenses.includes(lensId)) entry.contributing_lenses.push(lensId);
      // Deterministic winner regardless of input/arrival order (Gemini G6 #2,#3):
      // higher severity wins; on a TIE a never_gate lens wins (keeps NEVER_GATE keyed
      // coverage — AC1); on a tie with equal never_gate status the lexicographically
      // smaller lens_id wins. So async fan-out completion order can't flap the ledger.
      const tie = rank === sevRank(entry.severity);
      const neverGateWins = tie && neverGate && !entry.never_gate;
      const alphaWins = tie && (neverGate === entry.never_gate) && lensId < entry.originating_lens;
      if (rank > sevRank(entry.severity) || neverGateWins || alphaWins) {
        entry.severity = String(f.severity).toUpperCase();
        entry.finding = String(f && f.finding || entry.finding);
        entry.evidence = String(f && f.evidence || entry.evidence);
        entry.originating_lens = lensId;
        entry.never_gate = neverGate || entry.never_gate;
      } else if (neverGate) {
        entry.never_gate = true;   // a NEVER_GATE lens touching this loc sticks, regardless of severity
      }
    }
  }
  // deterministic order: severity desc, then file asc, then line asc
  const merged = [...byLoc.values()].sort((a, b) =>
    sevRank(b.severity) - sevRank(a.severity) ||
    (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) ||
    (Number(a.line) - Number(b.line)) || (a.line < b.line ? -1 : a.line > b.line ? 1 : 0));
  for (const e of merged) e.contributing_lenses.sort();
  return merged;
}

// AC1: keyed re-review map — for every blocking (HIGH/CRITICAL) finding, the
// originating lens that a fix must re-clear. NEVER_GATE locations are always
// keyed even at lower severity (security/data-migration coverage of fixes).
export function keyedReReviewMap(merged) {
  const map = {};
  for (const e of merged) {
    if (sevRank(e.severity) >= SEV_RANK.HIGH || e.never_gate) {
      map[`${e.file}:${e.line}`] = e.originating_lens;
    }
  }
  return map;
}

// AC2: per-lens iteration caps are INDEPENDENT — never a single merged counter.
export function perLensCaps(lenses, cap = 3) {
  const caps = {};
  for (const lens of Array.isArray(lenses) ? lenses : []) {
    const id = String(lens && lens.lens_id || "unknown");
    caps[id] = { rounds_used: Number(lens && lens.rounds_used || 0), cap };
  }
  return caps;
}

function main() {
  const lenses = readInput();
  const merged = mergeLensFindings(lenses);
  const out = {
    merged,
    counts: { critical: merged.filter((e) => e.severity === "CRITICAL").length,
      high: merged.filter((e) => e.severity === "HIGH").length, total: merged.length },
    keyed_rereview: keyedReReviewMap(merged),
    per_lens_caps: perLensCaps(lenses),
    note: "receipts emitted POST-BARRIER only; re-freeze the diff before any targeted HIGH re-review (WI-382 AC4)",
  };
  process.stdout.write(JSON.stringify(out, null, 2));
}

// run only as CLI (import for tests does not execute)
if (import.meta.url === `file://${process.argv[1]}`) main();
