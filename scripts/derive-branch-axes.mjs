#!/usr/bin/env node
// derive-branch-axes.mjs — WI-512 §3d, unified onto the 10-axis vocabulary
// (WI-521 B5/G7+G8): derive branch-index candidates mechanically instead of
// hand-walking them. The 10 axis names are quote-derived verbatim from
// `skills/audit-feature/SKILL.md:107-116` — Entry points, Callers, Auth, State,
// Currencies & counters, Promises, Outcomes, Data, Journeys & tests,
// Time, retry & concurrency.
//
// Only 2 of the 10 are MECHANICALLY derivable from a symbol-grep trace:
// "Callers" (a hit outside the symbol's own definition) and
// "Journeys & tests" (a hit inside a spec/test/journey file). The other 8
// need judgment this script cannot supply and are emitted as honest empty
// axes with `note:"manual axis"` rather than fabricated content.
//
// FIX 5 (reviewer HIGH, rejected+reverted axis judgement): an earlier
// revision of this script mapped a catch/||/?./try line pattern onto "Time,
// retry & concurrency" as a third mechanical axis. That axis is "every
// mutation flow walked at each durable boundary under failure, retry and
// interleaving: commit boundaries and partial success · idempotency ·
// read-before-write races · two callers at once · delayed jobs, expiry and
// crash recovery" (skills/audit-feature/SKILL.md:116) — a `||` default or a `?.`
// chain is null-coalescing and carries zero information about any of that;
// only `catch` even threads toward "failure", and error-handling is not
// retry/idempotency/concurrency. Measured: `--symbols existsSync` produced
// 75 candidates whose top hits were `existsSync` on `||` lines inside a raw
// review-log text file — noise a reader must disprove, strictly worse than
// the honest empty bucket the other 8 manual axes get. Dropped entirely;
// those hits now fall through to "Callers" where a real reference belongs.
//
// Uses ONLY `git grep -n` and `git ls-files` — no AST libraries, no new deps.
//
// I/O: argv --scope <path-glob> (files the symbols are DEFINED in — a hit
// outside this set is a candidate "caller") + --symbols <comma-list>
// (exported names to trace).
//
// Output: JSON `{ "<Axis Name>": { IN: [...], OUT: [], FILED: [] } }` for the
// 2 mechanical axes, plus `{ IN:[], OUT:[], FILED:[], note:"manual axis" }`
// for the other 8. This is MECHANICAL derivation only (§3d "mechanical
// FIRST, so nothing is forgotten") — every hit this script finds is a
// candidate, so every hit goes into IN, tagged `provenance: "inferred"`. OUT
// and FILED are always emitted empty: excluding or filing a candidate is
// the ANALYTICAL step (§3d "Derivation produces CANDIDATES. Analysis
// decides which are IN.") and this script has no basis to justify an
// exclusion — only the calling agent, reviewing each IN entry, writes the
// OUT/FILED buckets into the actual index (per proposal: "adjudication text
// is written by the calling agent into the index, never by the script").
// `IN` is capped at 50 entries per axis (G8: the port had no cap at all);
// a capped axis carries `truncated:<total-before-cap>` as the denominator.
//
// Exit 0 on success (even zero hits — an empty candidate set is a valid
// result, not an error). Exit 2 on usage error.

import { execFileSync } from "node:child_process";

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const scopeGlob = arg("--scope");
const symbolsRaw = arg("--symbols");
if (!scopeGlob || !symbolsRaw) {
  process.stderr.write("derive-branch-axes: usage: --scope <path-glob> --symbols <comma-list>\n");
  process.exit(2);
}
const symbols = symbolsRaw.split(",").map((s) => s.trim()).filter(Boolean);
if (!symbols.length) {
  process.stderr.write("derive-branch-axes: --symbols produced an empty list\n");
  process.exit(2);
}

function git(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: "pipe" });
  } catch (e) {
    // git grep exits 1 when there are no matches — that's a valid empty
    // result here, not a failure. Anything else on stderr still surfaces
    // via e.stdout (empty) so callers see nothing rather than a crash.
    return e.stdout ?? "";
  }
}

// Resolve --scope to a concrete file set via `git ls-files` (glob handled by
// git's own pathspec matching, not a JS glob library).
const scopeFiles = new Set(
  git(["ls-files", "--", scopeGlob])
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
);

// Heuristic classifiers — mechanical only, no judgment about relevance.
// Fix round (review finding, MEDIUM): this used to test the WHOLE line for
// ANY declaration keyword, so `const res = branchIndexFresh(p);` — a real
// caller — was silently excluded because the line merely contains "const",
// not because it declares `branchIndexFresh`. Anchored per-symbol below so
// the keyword must actually name the traced symbol.
function isDefinitionLine(content, symbol) {
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `\\b(?:function|class|const|let|var|def|export(?:\\s+default)?\\s+(?:function|class|const))\\s+${escaped}\\b`
  );
  return re.test(content);
}
const TEST_JOURNEY_RE = /(\.spec\.|\.test\.|\.feature\.md$|\/(tests?|__tests__|journeys)\/)/i;

// The 10-axis vocabulary, quote-derived verbatim from
// `skills/audit-feature/SKILL.md:107-116`, in the source table's order. Only 2 are
// mechanically derivable (see header comment); the rest are manual.
const AXIS_ORDER = [
  "Entry points", "Callers", "Auth", "State", "Currencies & counters",
  "Promises", "Outcomes", "Data", "Journeys & tests", "Time, retry & concurrency",
];
const MECHANICAL_AXES = new Set(["Callers", "Journeys & tests"]);
const IN_CAP = 50;

const axes = {};
for (const axis of AXIS_ORDER) {
  axes[axis] = MECHANICAL_AXES.has(axis)
    ? { IN: [], OUT: [], FILED: [] }
    : { IN: [], OUT: [], FILED: [], note: "manual axis" };
}

for (const symbol of symbols) {
  const raw = git(["grep", "-n", "-F", "--", symbol]);
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const rawLine of lines) {
    // git grep -n output: "<file>:<lineno>:<content>"
    const m = /^([^:]+):(\d+):(.*)$/.exec(rawLine);
    if (!m) continue;
    const [, file, lineno, content] = m;
    const line = Number(lineno);

    if (TEST_JOURNEY_RE.test(file)) {
      axes["Journeys & tests"].IN.push({
        file,
        line,
        why: `references "${symbol}" in a test/journey file`,
        provenance: "inferred",
      });
      continue;
    }
    if (scopeFiles.has(file) && isDefinitionLine(content, symbol)) {
      // Looks like the symbol's own definition inside the declared scope —
      // excluded from "Callers" per §3d ("minus its own definition"). Not
      // pushed to OUT (that would be an adjudication); simply not a
      // candidate for this axis.
      continue;
    }
    axes["Callers"].IN.push({
      file,
      line,
      why: `references "${symbol}" outside a recognized definition line`,
      provenance: "inferred",
    });
  }
}

// G8: cap IN at 50 per axis; a capped axis reports the pre-cap total as its
// denominator so nothing is silently dropped without a trace.
for (const axis of Object.values(axes)) {
  if (axis.IN.length > IN_CAP) {
    axis.truncated = axis.IN.length;
    axis.IN = axis.IN.slice(0, IN_CAP);
  }
}

process.stdout.write(JSON.stringify(axes, null, 2) + "\n");
