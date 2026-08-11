// learning-index — index framework + project learnings by their `files` arrays
// and match them to a touched path or a Bash command (WI-384).
//
// WHY: learnings only reached the agent via the SessionStart preload (last 5,
// recency-only), so ~88/96 framework learnings that carry `files` keys never
// fired, and the few that did arrived hours before the action they guard. This
// indexes them so the action-time hook can inject the 1-3 MATCHING learnings the
// moment the agent first touches a matching path / runs a matching command.
//
// DETERMINISTIC (WI-384 AC2): match results are order-stable — confidence
// DESC, then key ASC — so the same touched path always yields the same learning
// keys in the same order (golden-testable). No wall-clock, no randomness.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { norm } from "./normalize-path.mjs";

const LEDGERS = [
  ["references/framework-learnings.jsonl", "framework"],
  ["docs/learnings/learnings.jsonl", "project"],
];

export function loadLearnings(repoRoot) {
  const out = [];
  for (const [rel, origin] of LEDGERS) {
    const abs = join(repoRoot, rel);
    if (!existsSync(abs)) continue;
    for (const line of readFileSync(abs, "utf8").split("\n")) {
      const s = line.trim();
      if (!s) continue;
      try {
        const e = JSON.parse(s);
        if (!e || !e.key) continue;
        out.push({
          key: String(e.key),
          insight: String(e.insight || ""),
          confidence: Number(e.confidence || 0),
          files: Array.isArray(e.files) ? e.files.map(String) : [],
          skill: String(e.skill || ""),
          type: String(e.type || ""),
          origin,
        });
      } catch { /* skip malformed line */ }
    }
  }
  return out;
}

// Does a touched repo path match one of a learning's `files` entries? Supports
// exact, suffix (touched ends with the entry), and a simple `*` glob.
function pathMatchesEntry(touched, entry) {
  const t = norm(touched);
  const f = norm(entry);
  if (!f) return false;
  if (t === f || t.endsWith("/" + f)) return true;
  if (f.includes("*")) {
    const re = new RegExp("^" + f.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*") + "$");
    return re.test(t) || re.test(t.split("/").pop() || "");
  }
  return false;
}

const byRank = (a, b) => b.confidence - a.confidence || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

// Learnings whose `files` include the touched path. Ordered + capped.
export function matchByPath(learnings, touchedPath, cap = 3) {
  if (!touchedPath) return [];
  return learnings
    .filter((l) => l.files.some((f) => pathMatchesEntry(touchedPath, f)))
    .sort(byRank)
    .slice(0, cap);
}

// Bash-error-class v1 (WI-384 AC1): a learning matches a command when the command
// references a basename listed in the learning's `files` (e.g. running a script
// the learning is about). Ordered + capped.
export function matchByCommand(learnings, command, cap = 3) {
  if (!command) return [];
  const cmd = String(command);
  // Gemini G6 #3: a WORD-BOUNDARY match, not a raw substring — else a basename
  // like "lib" would match "glibc" and over-fire, polluting the context budget.
  const wordRe = (base) => new RegExp("(^|[^\\w.-])" + base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^\\w.-]|$)");
  return learnings
    .filter((l) => l.files.some((f) => {
      const base = norm(f).split("/").pop();
      return base && base.length > 2 && wordRe(base).test(cmd);
    }))
    .sort(byRank)
    .slice(0, cap);
}

// Fires per learning key from the action-time ledger (.svc/learning-fires.jsonl).
// WI-384 AC3: this is the substrate the elevation predicate needs — 0/116
// learnings carried a `fires` field, so confidence>=8 AND fires>=3 was unfireable.
export function firesCount(repoRoot) {
  const p = join(repoRoot, ".svc", "learning-fires.jsonl");
  const counts = {};
  if (!existsSync(p)) return counts;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const s = line.trim();
    if (!s) continue;
    try { const e = JSON.parse(s); if (e && e.key) counts[e.key] = (counts[e.key] || 0) + 1; } catch { /* skip */ }
  }
  return counts;
}

// The elevation predicate, now computable: confidence>=8 AND fires>=3. Pure.
export function elevationCandidates(learnings, counts, minConfidence = 8, minFires = 3) {
  return learnings
    .filter((l) => l.confidence >= minConfidence && (counts[l.key] || 0) >= minFires)
    .map((l) => ({ key: l.key, confidence: l.confidence, fires: counts[l.key] || 0 }))
    .sort(byRank);
}

// Render the matched learnings as additive context (never blocks — WI-384 AC4).
export function renderInjection(matched) {
  if (!matched.length) return "";
  let ctx = "[svc learning-injector] Prior learnings for what you're about to touch:\n";
  for (const l of matched) {
    ctx += `\n[${l.key}] (${l.type || "learning"}, confidence ${l.confidence}${l.origin === "project" ? ", project" : ""})\n  ${l.insight}\n`;
  }
  ctx += "\nIf a learning applies, follow it. If it prevents a mistake, its confidence can be bumped (cap 10).\n";
  return ctx;
}
