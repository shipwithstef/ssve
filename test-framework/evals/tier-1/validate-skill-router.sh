#!/usr/bin/env bash
# tier-1: validate-skill-router.sh — WI-FW-SKILLS-ROUTING-01
#
# Hermetic validator for the JIT skill-routing surface. No network, no LLM,
# no browser. Budget target <5s wall.
#
# Verifies (plan §7 subset owned by Waves 1-2):
#   1. byte-stable compilation (identical inputs → identical bytes; committed
#      artifact matches recompile)
#   2. compiler rejects malformed inputs with named reasons
#   3. every corpus case passes its labeled assertion (pins 100% recall,
#      zero forbidden auto-invocations, ambiguity fallback, negative triggers)
#   4. normalized decision conforms to the decision contract + budgets hold
#   5. offline/hermetic: router modules make no network calls
#   6. receipts are privacy-safe: fingerprint only, never the raw intent
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"

CORPUS="test-framework/fixtures/skill-router/corpus.json"
CLI="node scripts/skill-router.mjs"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail() { echo "validate-skill-router FAIL: $1" >&2; exit 1; }
command -v node >/dev/null || fail "node not on PATH"
[ -f "$CORPUS" ] || fail "corpus missing: $CORPUS"
[ -f references/skill-routing-index.json ] || fail "committed routing index missing — run scripts/compile-skill-router-index.mjs"

# ── 1. Byte-stability ────────────────────────────────────────────────────────
node scripts/compile-skill-router-index.mjs --root "$ROOT" --check >/dev/null 2>"$TMP/drift.log" \
  || fail "committed index drifted from canonical inputs ($(cat "$TMP/drift.log" | tail -1))"
node scripts/compile-skill-router-index.mjs --root "$ROOT" >"$TMP/a.json" 2>/dev/null
node scripts/compile-skill-router-index.mjs --root "$ROOT" >"$TMP/b.json" 2>/dev/null
cmp -s "$TMP/a.json" "$TMP/b.json" || fail "two compiles of identical inputs differ"
git diff --quiet -- references/skill-routing-index.json || fail "recompile dirtied the committed artifact"

# ── 2. Malformed inputs fail loudly ─────────────────────────────────────────
BAD="$TMP/bad-root"
mkdir -p "$BAD/references" "$BAD/concerns" "$BAD/skills"
printf '%s\n' '{"includedSkills":["alpha","alpha"],"rulesRegistry":{"entries":[]}}' > "$BAD/skills-manifest.json"
printf '%s\n' '{"entries":{}}' > "$BAD/references/skill-routing-overrides.json"
printf '%s\n' '{"concerns":[]}' > "$BAD/concerns/REGISTRY.json"
if node scripts/compile-skill-router-index.mjs --root "$BAD" >/dev/null 2>"$TMP/dup.log"; then
  fail "duplicate skill names did not fail compilation"
fi
grep -q "duplicate skill name" "$TMP/dup.log" || fail "duplicate-name failure lacks a named reason"

# ── 2b. Glob matcher conformance vs rule-injector semantics ─────────────────
node --input-type=module - "$ROOT" <<'GLOBS' || fail "glob matcher conformance failed"
import process from "node:process";
const root = process.argv[2];
const { globToRe, matchConcern } = await import(root + "/scripts/lib/skill-router.mjs");
// Labeled expectations mirroring hooks/svc-rule-injector.mjs globToRe semantics:
// anchored globs with zero-dir `**/` support; bare substrings match anywhere.
const cases = [
  ["**/aup*", "docs/aup.md", true],
  ["**/aup*", "aup.md", true],
  ["**/aup*", "src/deep/nested/aup-2026.md", true],
  ["**/auth/**", "src/auth/login.ts", true],
  ["**/auth/**", "src/authorize/x.ts", false],
  ["**/login*", "pages/login.tsx", true],
  ["*.sql", "001_init.sql", true],
  ["*.sql", "migrations/002.sql", false],
];
for (const [pattern, candidate, expected] of cases) {
  const got = globToRe(pattern).test(candidate);
  if (got !== expected) {
    process.stderr.write(`glob conformance: ${pattern} vs ${candidate} => ${got}, expected ${expected}\n`);
    process.exit(1);
  }
}
// Concern-level matching must accept both dialects (globs + bare substrings)
// and must record the committed pattern — never the concrete caller path.
const concern = { signals: { file_path_patterns: ["base44", "**/oauth*"] } };
const evidence = matchConcern(concern, { files: ["src/.base44/client.js"], packages: [], env: [] });
if (!evidence) process.exit(1);
if (evidence.includes("client.js") || !evidence.startsWith("pattern:")) process.exit(1);
if (!matchConcern(concern, { files: ["lib/oauth-flow.ts"], packages: [], env: [] })) process.exit(1);
if (matchConcern(concern, { files: ["src/nothing.js"], packages: [], env: [] })) process.exit(1);
console.log("glob+conformance OK");
GLOBS

# ── 3+4. Corpus assertions via a single node runner ──────────────────────────
node --input-type=module - "$ROOT" "$CORPUS" <<'RUNNER' >"$TMP/corpus-report.txt"
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
const [root, corpusPath] = process.argv.slice(2);
const { route, validateDecision, loadIndex, BUDGETS } = await import(
  path.join(root, "scripts", "lib", "skill-router.mjs"));
const corpus = JSON.parse(fs.readFileSync(corpusPath, "utf8"));
const failures = [];
let ran = 0;
for (const c of corpus.cases) {
  const input = {
    root,
    intent: c.input.intent ?? "",
    files: c.input.files ?? [],
    packages: c.input.packages ?? [],
    env: c.input.env ?? [],
    activeSkill: c.input.active_skill ?? null,
    nextSkill: c.input.next_skill ?? null,
    mode: c.input.mode ?? "suggest",
    receipts: false,
    ts: "2026-08-25T00:00:00.000Z",
  };
  let d;
  try { d = route(input); } catch (e) { failures.push(`${c.id}: route threw ${e.message}`); continue; }
  ran += 1;

  // Every decision must conform to the normalized contract.
  for (const err of validateDecision(d)) failures.push(`${c.id}: decision invalid: ${err}`);

  // First case additionally cross-checks the hand-rolled validator against the
  // committed JSON Schema contract itself (F-EXEC-008): key sets and budget
  // ceiling constants must agree, or the "schema conformance" claim is false.
  if (ran === 1) {
    const schema = JSON.parse(fs.readFileSync(path.join(root, "schemas", "skill-router-decision.schema.json"), "utf8"));
    const schemaKeys = new Set(Object.keys(schema.properties));
    const decisionKeys = Object.keys(d);
    for (const k of decisionKeys) {
      if (!schemaKeys.has(k)) failures.push(`schema-parity: decision emits field ${k} absent from JSON Schema`);
    }
    for (const k of schema.required) {
      if (!decisionKeys.includes(k)) failures.push(`schema-parity: JSON Schema requires ${k} but validator set omits it`);
    }
    if (schema.properties.budget.properties.d1_ceiling_tokens.const !== BUDGETS.d1CeilingTokens) {
      failures.push("schema-parity: d1 ceiling constant diverges from library BUDGETS");
    }
    if (schema.properties.budget.properties.d0_ceiling_tokens.const !== BUDGETS.d0CeilingTokens) {
      failures.push("schema-parity: d0 ceiling constant diverges from library BUDGETS");
    }
    if (!schema.properties.enforcement.enum.includes("advisory-no-mutation-gate")) {
      failures.push("schema-parity: enforcement enum lacks honest advisory value");
    }
  }

  // Budgets must always hold.
  if (d.budget.d1_tokens > BUDGETS.d1CeilingTokens) failures.push(`${c.id}: d1 budget exceeded`);
  if (d.budget.d0_tokens > BUDGETS.d0CeilingTokens) failures.push(`${c.id}: d0 budget exceeded`);
  if (d.suggestions.length > BUDGETS.d1CeilingCards) failures.push(`${c.id}: card ceiling exceeded`);

  const a = c.assert || {};
  if (a.required_contains) {
    for (const s of a.required_contains) {
      if (!d.required.includes(s)) failures.push(`${c.id}: expected pin ${s}, got [${d.required}]`);
    }
  }
  if (a.rules_nonempty && d.rules.length === 0) failures.push(`${c.id}: expected non-empty rules`);
  if (a.pins_evidence_contains_concern) {
    for (const name of a.pins_evidence_contains_concern) {
      const hit = d.receipt.pins_evidence.some((p) => p.evidence.includes(`concern:${name}`));
      if (!hit) failures.push(`${c.id}: pins evidence missing concern:${name}`);
    }
  }
  if ("selected" in a && d.selected !== a.selected) failures.push(`${c.id}: selected=${d.selected} (forbidden auto-invocation or wrong selection)`);
  if (a.head_suggestion_is_route_workflow_fallback) {
    const head = d.suggestions[0];
    if (!head || head.skill !== "route-workflow" || !head.reason_codes.includes("ambiguity-fallback")) {
      failures.push(`${c.id}: head suggestion is not the approved route-workflow fallback`);
    }
  }
  if (a.head_suggestion_not && d.suggestions[0]?.skill === a.head_suggestion_not) {
    failures.push(`${c.id}: negative trigger failed to suppress ${a.head_suggestion_not}`);
  }
  if (a.suggestions_max_cards && d.suggestions.length > a.suggestions_max_cards) {
    failures.push(`${c.id}: ${d.suggestions.length} cards exceed max ${a.suggestions_max_cards}`);
  }
  if (a.suggestions_zero && d.suggestions.length !== 0) {
    failures.push(`${c.id}: mode off must disable optional discovery, got ${d.suggestions.length} cards`);
  }
  if (a.d1_tokens_within_ceiling && d.budget.d1_tokens > BUDGETS.d1CeilingTokens) {
    failures.push(`${c.id}: d1_tokens ${d.budget.d1_tokens} above ceiling`);
  }
  if (a.top_five_contains_any) {
    const top = d.suggestions.slice(0, 5).map((s) => s.skill);
    if (!a.top_five_contains_any.some((s) => top.includes(s))) {
      failures.push(`${c.id}: Recall@5 miss — top5 [${top}] lacks any of [${a.top_five_contains_any}]`);
    }
  }
}
// Corpus-level recall floor over optional-discovery cases (plan §7.1: Recall@5 ≥ 97%
// provisional floor; at this corpus size a single labeled miss already breaches it).
const discoveryCases = corpus.cases.filter((c) => c.expectation === "top-five-contains");
const discoveryFails = failures.filter((f) => discoveryCases.some((c) => f.startsWith(`${c.id}:`)));
if (discoveryCases.length > 0 && discoveryFails.length / discoveryCases.length > 0.03) {
  failures.push("corpus: lexical Recall@5 floor breached");
}
console.log(JSON.stringify({ cases: corpus.cases.length, executed: ran, failures }, null, 1));
if (failures.length > 0) process.exit(1);
RUNNER
[ $? -eq 0 ] || fail "corpus run failed:
$(cat "$TMP/corpus-report.txt")"

# ── 5. Hermetic: no network vocabulary in the router surface ────────────────
NET_HITS="$(grep -nE "fetch\(|net\.connect|XMLHttpRequest|axios|https?://" \
    scripts/lib/skill-router.mjs scripts/skill-router.mjs scripts/compile-skill-router-index.mjs \
  | grep -v "^\s*[0-9]*:\s*\*" | grep -vE "json-schema\.org|seriousvibecoding\.dev" || true)"
if [ -n "$NET_HITS" ]; then
  echo "$NET_HITS" >&2
  fail "router surface contains network-call vocabulary"
fi

# ── 6. Receipt redaction ─────────────────────────────────────────────────────
SECRET_INTENT="TOPSECRET-INTENT-zqptoiwueyralfkjhgd"
SVC_DIR="$TMP/receipt-root"
mkdir -p "$SVC_DIR/.svc"
cp references/skill-routing-index.json "$SVC_DIR/" 2>/dev/null || true
node scripts/skill-router.mjs route --root "$ROOT" --intent "$SECRET_INTENT" --mode suggest >"$TMP/redact-decision.json"
grep -q "$SECRET_INTENT" "$TMP/redact-decision.json" && fail "raw intent leaked into decision output"
RECEIPTS="$ROOT/.svc/skill-router/decisions.jsonl"
[ -f "$RECEIPTS" ] || fail "receipt stream was not written"
tail -1 "$RECEIPTS" | grep -q "$SECRET_INTENT" && fail "raw intent leaked into receipt stream"
tail -1 "$RECEIPTS" | grep -Eq '"intent_fingerprint":"sha256:[0-9a-f]{16}"' || fail "receipt fingerprint malformed"

CASES=$(node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('test-framework/fixtures/skill-router/corpus.json','utf8')).cases.length))")
echo "validate-skill-router PASS ($CASES corpus cases)"
