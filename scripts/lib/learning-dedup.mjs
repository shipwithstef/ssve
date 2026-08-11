// scripts/lib/learning-dedup.mjs
//
// Dedup helper for auto-learning candidates. Used by:
//   - hooks/svc-auto-capture-learnings.mjs (skip-if-existing)
//   - scripts/promote-auto-learnings.mjs (skip-if-promoted)
//
// Dedup rule per WI-343 proposal:
//   skip-if-existing-equal-or-higher-confidence
//
// Comparison: (key, insight_prefix_first_80_chars). If both match an existing
// entry and the candidate's confidence <= existing, skip. Otherwise append
// (the candidate carries newer/stronger evidence).
//
// Schema baselined 2026-05-12 by WI-343 tranche 1.

import fs from "node:fs";

const INSIGHT_PREFIX_LEN = 80;

function normalizeInsightPrefix(insight) {
  return String(insight || "").slice(0, INSIGHT_PREFIX_LEN).trim().toLowerCase();
}

function loadJsonlEntries(path) {
  if (!fs.existsSync(path)) return [];
  const out = [];
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("//") || t.startsWith("#")) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip malformed */ }
  }
  return out;
}

export function isDuplicate(candidate, existingEntries) {
  const ckey = String(candidate.key || "");
  const cprefix = normalizeInsightPrefix(candidate.insight);
  const cconf = Number(candidate.confidence || 0);
  for (const e of existingEntries) {
    const ekey = String(e.key || e.id || "");
    const eprefix = normalizeInsightPrefix(e.insight);
    const econf = Number(e.confidence || 0);
    if (ekey === ckey && eprefix === cprefix && econf >= cconf) return true;
  }
  return false;
}

export function dedupAgainstPaths(candidate, paths) {
  for (const p of paths) {
    if (isDuplicate(candidate, loadJsonlEntries(p))) return true;
  }
  return false;
}

// CLI smoke-test entrypoint (node -e or direct invocation).
if (import.meta.url === `file://${process.argv[1]}`) {
  const candidate = JSON.parse(process.argv[2] || "{}");
  const paths = process.argv.slice(3);
  const dup = dedupAgainstPaths(candidate, paths);
  console.log(JSON.stringify({ duplicate: dup }, null, 2));
  process.exit(dup ? 1 : 0);
}
