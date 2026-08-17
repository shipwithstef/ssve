#!/usr/bin/env bash
# Tier 1: WI-553 risk-triggered plan/exec contracts — AC-553-1..7.
#
# Covers, in order:
#   AC-553-1  shared risk-flag table is the exact 6-flag set
#   AC-553-2  design-tech "no product UI"-family skip is denied while a flag
#             is in effect (declared or implied); accepted when no flag applies
#   AC-553-3  plan-contract.json grows ONLY the sections matched by risk_flags
#   AC-553-4  mechanical rejection of the three named WI-542 shapes, and the
#             corrected shape passing
#   AC-553-5  execute-changeset cannot complete without schema-valid
#             plan-manifest/review-plan/exec-record receipts for the tree
#   AC-553-6  a flagless docs-only/parser-only bugfix skips the extra path
#             (negative fixture)
#   AC-553-7  synthetic WI-542-shaped plan fails end-to-end; corrected shape
#             passes (composed from the AC-553-4 unit checks above)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0
pass() { PASS=$((PASS + 1)); echo "  ok: $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  FAIL: $1"; }

echo "=== Tier 1: WI-553 risk-triggered plan/exec contracts ==="

# ── AC-553-1: shared flag table is the exact 6-flag set ────────────────────
FLAG_CHECK_OUT="$(ROOT="$ROOT" node --input-type=module <<'NODE'
import { pathToFileURL } from "node:url";
import path from "node:path";
const root = process.env.ROOT;
const mod = await import(pathToFileURL(path.join(root, "scripts/lib/risk-flags.mjs")));
const expected = ["runtime_concurrency", "external_state_writer", "config_schema_migration", "lossless_rmw", "idempotent_rewriter", "cross_runtime_integration"];
const actual = [...mod.RISK_FLAGS];
const same = expected.length === actual.length && expected.every((f) => actual.includes(f));
console.log(same ? "OK" : `MISMATCH expected=${expected.join(",")} actual=${actual.join(",")}`);
NODE
)"
if [ "$FLAG_CHECK_OUT" = "OK" ]; then
  pass "AC-553-1: RISK_FLAGS is the exact shared 6-flag set"
else
  fail "AC-553-1: $FLAG_CHECK_OUT"
fi

# ── AC-553-2 / AC-553-6: design-tech skip denial fixtures ──────────────────
# Build minimal framework-lane graphs (design-tech is optional for framework,
# so the gate under test is the ONLY reason design-tech's presence/skip is
# constrained here). MANDATORY_DELIVERY_CHAIN skills are included so the
# unrelated lane-mandatory-skill check does not confound this test.
build_graph() {
  # $1 = output path, $2 = flags-json-array, $3 = design-tech-task-json ("" to omit),
  # $4 = planned_files-json-array (delivery_graph.planned_files)
  local out="$1" flags="$2" designtech="$3" planned="$4"
  node --input-type=module - "$out" "$flags" "$designtech" "$planned" <<'NODE'
import fs from "node:fs";
const [outPath, flagsJson, designTechJson, plannedJson] = process.argv.slice(2);
const chain = ["plan-changeset", "review-plan", "execute-changeset", "review-gate", "review-exec", "audit-implementation", "land-changeset", "verify-promotion"];
let nextId = 1;
const tasks = [];
const designTech = designTechJson ? JSON.parse(designTechJson) : null;
if (designTech) tasks.push({ id: nextId++, subject: "design-tech", blocked_by: [], metadata: { skill: "design-tech" }, ...designTech });
for (const skill of chain) tasks.push({ id: nextId++, subject: skill, status: "pending", blocked_by: [], metadata: { skill } });
const graph = {
  wi: "WI-553-FIXTURE",
  lane: "framework",
  flags: JSON.parse(flagsJson),
  delivery_graph: { planned_files: JSON.parse(plannedJson) },
  tasks,
};
fs.writeFileSync(outPath, JSON.stringify(graph, null, 2));
NODE
}

run_lane_validator() {
  node "$ROOT/scripts/validate-task-graph-lane.mjs" "$1"
}

# T2a: flag declared + design-tech skipped with denied reason -> FAIL
build_graph "$TMP/t2a.json" '["runtime_concurrency"]' '{"status":"skipped","skip_reason":"no product UI / no data model"}' '[]'
if run_lane_validator "$TMP/t2a.json" >"$TMP/t2a.out" 2>&1; then
  fail "AC-553-2: denied skip_reason with runtime_concurrency in effect unexpectedly PASSED"
elif grep -q "AC-553-2" "$TMP/t2a.out"; then
  pass "AC-553-2: denied skip_reason with runtime_concurrency in effect is rejected"
else
  fail "AC-553-2: rejection message drifted: $(cat "$TMP/t2a.out")"
fi

# T2b: flag declared + design-tech missing entirely -> FAIL
build_graph "$TMP/t2b.json" '["external_state_writer"]' '' '[]'
if run_lane_validator "$TMP/t2b.json" >"$TMP/t2b.out" 2>&1; then
  fail "AC-553-2: missing design-tech with a flag in effect unexpectedly PASSED"
elif grep -q "AC-553-2" "$TMP/t2b.out"; then
  pass "AC-553-2: missing design-tech with a flag in effect is rejected"
else
  fail "AC-553-2: missing-design-tech message drifted: $(cat "$TMP/t2b.out")"
fi

# T2c: flag declared + design-tech genuinely completed (no denied skip_reason) -> PASS
build_graph "$TMP/t2c.json" '["runtime_concurrency"]' '{"status":"completed"}' '[]'
if run_lane_validator "$TMP/t2c.json" >"$TMP/t2c.out" 2>&1; then
  pass "AC-553-2: genuinely completed design-tech with a flag in effect is accepted"
else
  fail "AC-553-2: genuinely completed design-tech unexpectedly rejected: $(cat "$TMP/t2c.out")"
fi

# T2d (implied flag): no declared flags, but a planned file implies one; skip denied -> FAIL
build_graph "$TMP/t2d.json" '[]' '{"status":"skipped","skip_reason":"no product UI, framework chrome only"}' '["hooks/svc-session-start-parallel-thing.mjs"]'
if run_lane_validator "$TMP/t2d.json" >"$TMP/t2d.out" 2>&1; then
  fail "AC-553-2: implied runtime_concurrency (via planned file) unexpectedly PASSED"
elif grep -q "AC-553-2" "$TMP/t2d.out"; then
  pass "AC-553-2: implied risk flag from planned files still denies the skip"
else
  fail "AC-553-2: implied-flag rejection message drifted: $(cat "$TMP/t2d.out")"
fi

# T6 (AC-553-6 negative fixture): zero flags, zero implied files, design-tech
# skipped for the "no product UI" reason (a docs-only/parser-only bugfix
# shape) -> PASS. This is the "unmatched work pays zero extra review" case.
build_graph "$TMP/t6.json" '[]' '{"status":"skipped","skip_reason":"no product UI / no data model — docs-only bugfix"}' '["docs/specs/work-items/WI-900.md"]'
if run_lane_validator "$TMP/t6.json" >"$TMP/t6.out" 2>&1; then
  pass "AC-553-6: flagless docs-only bugfix skips design-tech cleanly (negative fixture)"
else
  fail "AC-553-6: flagless docs-only bugfix was unexpectedly rejected: $(cat "$TMP/t6.out")"
fi

# ── AC-553-3 / AC-553-4: plan-contract risk sections (unit-level) ──────────
RISK_SECTIONS_OUT="$(ROOT="$ROOT" TMP="$TMP" node --input-type=module <<'NODE'
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
const root = process.env.ROOT;
const tmp = process.env.TMP;
const mod = await import(pathToFileURL(path.join(root, "scripts/validate-plan-contract.mjs")));
const results = [];
const check = (name, contract, expectFail) => {
  const errors = [];
  mod.validateRiskSections(contract, tmp, errors);
  const failed = errors.length > 0;
  if (failed === expectFail) results.push(`OK ${name}`);
  else results.push(`BAD ${name} errors=${JSON.stringify(errors)}`);
};

// AC-553-3: section present without its flag -> reject
check("section-without-flag", { risk_flags: [], concurrency: { atomic_primitive: "flock" } }, true);
// AC-553-3: flag declared without its section -> reject
check("flag-without-section", { risk_flags: ["runtime_concurrency"] }, true);

// AC-553-4 WI-542 shape 1: check-then-write race under runtime_concurrency -> reject
check("wi542-check-then-write", {
  risk_flags: ["runtime_concurrency"],
  concurrency: {
    atomic_primitive: "flock",
    owner_key: "pid",
    concurrent_invoke_behavior: "check if the hook file exists, then create it if not present",
    stale_lock_cleanup: "manual",
    concurrency_test: "none",
  },
}, true);
// AC-553-4 WI-542 shape 1, bad primitive name -> reject
check("wi542-bad-primitive", {
  risk_flags: ["runtime_concurrency"],
  concurrency: {
    atomic_primitive: "check exists first",
    owner_key: "pid",
    concurrent_invoke_behavior: "acquires an advisory lock before writing",
    stale_lock_cleanup: "manual",
    concurrency_test: "none",
  },
}, true);
// AC-553-4 corrected shape 1 -> accept
check("corrected-concurrency", {
  risk_flags: ["runtime_concurrency"],
  concurrency: {
    atomic_primitive: "o_excl",
    owner_key: "session_id",
    concurrent_invoke_behavior: "opens the lock file with O_CREAT|O_EXCL; loser gets EEXIST and retries with backoff",
    stale_lock_cleanup: "lock embeds holder PID; a dead PID is reclaimed by a new invocation",
    concurrency_test: "test-framework/evals/tier-1/validate-risk-triggered-contracts.sh",
  },
}, false);

// AC-553-4 WI-542 shape 2: one backup path as both immutable baseline and rolling rollback -> reject
check("wi542-single-backup-path", {
  risk_flags: ["external_state_writer"],
  external_writer: {
    immutable_baseline: ".svc/backup.bak",
    rolling_rollback: ".svc/backup.bak",
    read_failure_policy: "abort",
    file_mode_preservation: "preserve original mode",
  },
}, true);
// AC-553-4 corrected shape 2 -> accept
check("corrected-external-writer", {
  risk_flags: ["external_state_writer"],
  external_writer: {
    immutable_baseline: ".svc/backups/settings.pre.json",
    rolling_rollback: ".svc/backups/settings.rollback.json",
    read_failure_policy: "abort the write and report; never proceed on an unreadable target",
    file_mode_preservation: "stat() before write; chmod back after",
  },
}, false);

// AC-553-4 WI-542 shape 3: preserve entries claim with no fixture per entry type -> reject
check("wi542-no-fixture-per-entry", {
  risk_flags: ["lossless_rmw"],
  lossless_rmw: { entry_types: [{ type: "user-entry" }] },
}, true);
// AC-553-4 corrected shape 3 -> accept (fixture file created below, then referenced)
const fixturePath = path.join(tmp, "lossless-rmw-fixture.json");
fs.writeFileSync(fixturePath, JSON.stringify({ example: "user-entry" }));
check("corrected-lossless-rmw", {
  risk_flags: ["lossless_rmw"],
  lossless_rmw: { entry_types: [{ type: "user-entry", fixture: "lossless-rmw-fixture.json" }] },
}, false);

console.log(results.join("\n"));
NODE
)"
while IFS= read -r line; do
  [ -z "$line" ] && continue
  if [[ "$line" == OK* ]]; then
    pass "AC-553-4: ${line#OK }"
  else
    fail "AC-553-3/4: ${line#BAD }"
  fi
done <<< "$RISK_SECTIONS_OUT"

# ── AC-553-7: synthetic WI-542-shaped full plan-contract fails; corrected passes ──
# Reuses the same validateRiskSections entry points but exercises them
# together as one "plan" (multiple risk flags at once) to mirror an actual
# WI-542-shaped manifest rather than one isolated section at a time.
WI542_SHAPE_OUT="$(ROOT="$ROOT" TMP="$TMP" node --input-type=module <<'NODE'
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
const root = process.env.ROOT;
const tmp = process.env.TMP;
const mod = await import(pathToFileURL(path.join(root, "scripts/validate-plan-contract.mjs")));

const wi542Shaped = {
  risk_flags: ["runtime_concurrency", "external_state_writer", "lossless_rmw"],
  concurrency: {
    atomic_primitive: "check exists first",
    owner_key: "pid",
    concurrent_invoke_behavior: "check if the settings file exists, then write the merged hooks before continuing",
    stale_lock_cleanup: "none",
    concurrency_test: "none",
  },
  external_writer: {
    immutable_baseline: ".svc/settings.bak",
    rolling_rollback: ".svc/settings.bak",
    read_failure_policy: "skip silently",
    file_mode_preservation: "unspecified",
  },
  lossless_rmw: { entry_types: [{ type: "user-hook" }, { type: "unknown-hook" }] },
};
const wi542Errors = [];
mod.validateRiskSections(wi542Shaped, tmp, wi542Errors);

const fixtureDir = path.join(tmp, "ac553-7-fixtures");
fs.mkdirSync(fixtureDir, { recursive: true });
fs.writeFileSync(path.join(fixtureDir, "user-hook.json"), JSON.stringify({ type: "user-hook" }));
fs.writeFileSync(path.join(fixtureDir, "unknown-hook.json"), JSON.stringify({ type: "unknown-hook" }));
const corrected = {
  risk_flags: ["runtime_concurrency", "external_state_writer", "lossless_rmw"],
  concurrency: {
    atomic_primitive: "flock",
    owner_key: "session_id",
    concurrent_invoke_behavior: "acquires an flock() exclusive lock on .svc/settings.lock before reading or writing settings.json",
    stale_lock_cleanup: "flock is released automatically if the holder process dies",
    concurrency_test: "test-framework/evals/tier-1/validate-risk-triggered-contracts.sh",
  },
  external_writer: {
    immutable_baseline: ".svc/backups/settings.pre-change.json",
    rolling_rollback: ".svc/backups/settings.rollback.json",
    read_failure_policy: "abort the write and report; never proceed on an unreadable target",
    file_mode_preservation: "stat() before write; chmod back after",
  },
  lossless_rmw: {
    entry_types: [
      { type: "user-hook", fixture: "ac553-7-fixtures/user-hook.json" },
      { type: "unknown-hook", fixture: "ac553-7-fixtures/unknown-hook.json" },
    ],
  },
};
const correctedErrors = [];
mod.validateRiskSections(corrected, tmp, correctedErrors);

console.log(JSON.stringify({ wi542ErrorCount: wi542Errors.length, correctedErrorCount: correctedErrors.length }));
NODE
)"
WI542_FAIL_COUNT="$(node -e "console.log(JSON.parse(process.argv[1]).wi542ErrorCount)" "$WI542_SHAPE_OUT")"
CORRECTED_FAIL_COUNT="$(node -e "console.log(JSON.parse(process.argv[1]).correctedErrorCount)" "$WI542_SHAPE_OUT")"
if [ "$WI542_FAIL_COUNT" -gt 0 ]; then
  pass "AC-553-7: synthetic WI-542-shaped plan-contract fails mechanically ($WI542_FAIL_COUNT error(s))"
else
  fail "AC-553-7: synthetic WI-542-shaped plan-contract unexpectedly passed"
fi
if [ "$CORRECTED_FAIL_COUNT" -eq 0 ]; then
  pass "AC-553-7: corrected shape passes with zero errors"
else
  fail "AC-553-7: corrected shape unexpectedly failed: $WI542_SHAPE_OUT"
fi

# ── AC-553-5: execute-changeset completion gate on chain receipts ──────────
GIT_REPO="$TMP/exec-gate-repo"
mkdir -p "$GIT_REPO"
G553() { env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE git -C "$GIT_REPO" "$@"; }
G553 init -q
G553 config user.email t@t
G553 config user.name t

mkdir -p "$GIT_REPO/.svc"
cat > "$GIT_REPO/.svc/lane-tasks-WI-553-EXEC.json" <<'JSON'
{
  "wi": "WI-553-EXEC",
  "lane": "framework",
  "created": "2026-09-01T00:00:00.000Z",
  "tasks": [
    {
      "id": 1,
      "subject": "execute the fix",
      "status": "in_progress",
      "blocked_by": [],
      "metadata": { "skill": "execute-changeset" },
      "skill_receipt": { "skill": "execute-changeset", "loaded_at": "2026-09-01T00:00:00.000Z", "loaded_via": "manual" }
    }
  ]
}
JSON
G553 add -A
G553 -c commit.gpgsign=false commit -q -m baseline

GRAPH_REL=".svc/lane-tasks-WI-553-EXEC.json"
if (cd "$GIT_REPO" && node "$ROOT/scripts/task-graph.mjs" set-status "$GRAPH_REL" 1 completed) >"$TMP/ac553-5-missing.out" 2>&1; then
  fail "AC-553-5: execute-changeset completed without chain receipts unexpectedly PASSED"
elif grep -q "AC-553-5" "$TMP/ac553-5-missing.out"; then
  pass "AC-553-5: execute-changeset without plan-manifest/review-plan/exec-record receipts is blocked"
else
  fail "AC-553-5: missing-receipts rejection message drifted: $(cat "$TMP/ac553-5-missing.out")"
fi

HEAD_SHA_SHORT="$(G553 rev-parse HEAD | cut -c1-7)"
RECEIPT_DIR="$GIT_REPO/.svc/receipts/$HEAD_SHA_SHORT"
mkdir -p "$RECEIPT_DIR"
cat > "$RECEIPT_DIR/plan-manifest.json" <<'JSON'
{
  "receipt_type": "plan-manifest",
  "schema_version": 1,
  "wi": "WI-553-EXEC",
  "scope": { "included": ["file.txt"], "excluded": [] },
  "dependencies": [],
  "decision_trace": [],
  "task_graph": [],
  "validation_plan": [],
  "risk_rollback": {},
  "timestamp": "2026-09-01T00:00:00.000Z",
  "execution_command_sequence": [],
  "ac_digests": {}
}
JSON
cat > "$RECEIPT_DIR/review-plan.json" <<'JSON'
{
  "receipt_type": "review-plan",
  "schema_version": 1,
  "wi": "WI-553-EXEC",
  "self_review": { "orchestrator": "claude", "findings_count": 0, "notes": "n/a" },
  "adversarial_review": { "primary_reviewer_host": "codex", "primary_used": true, "fallback_host": "claude", "fallback_used": false, "findings": [], "iteration_count": 1 },
  "verdict": "pass",
  "timestamp": "2026-09-01T00:00:00.000Z"
}
JSON
cat > "$RECEIPT_DIR/exec-record.json" <<'JSON'
{
  "receipt_type": "exec-record",
  "schema_version": 1,
  "wi": "WI-553-EXEC",
  "diff_hash": "0000000000000000000000000000000000000000000000000000000000000000",
  "files_touched": ["file.txt"],
  "dispatch_model": "claude-sonnet-5",
  "timestamp": "2026-09-01T00:00:00.000Z"
}
JSON

if (cd "$GIT_REPO" && node "$ROOT/scripts/task-graph.mjs" set-status "$GRAPH_REL" 1 completed) >"$TMP/ac553-5-satisfied.out" 2>&1; then
  pass "AC-553-5: execute-changeset with schema-valid receipts for the current tree completes"
else
  fail "AC-553-5: execute-changeset with valid receipts was unexpectedly rejected: $(cat "$TMP/ac553-5-satisfied.out")"
fi

# AC-553-5 pre-cutoff exemption sanity: a graph with no `created` field (or one
# well before the WI-553 rollout) is not retroactively broken (Migration note:
# "existing completed graphs are not rewritten").
GIT_REPO2="$TMP/exec-gate-repo-legacy"
mkdir -p "$GIT_REPO2/.svc"
G553L() { env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE git -C "$GIT_REPO2" "$@"; }
G553L init -q
G553L config user.email t@t
G553L config user.name t
cat > "$GIT_REPO2/.svc/lane-tasks-WI-553-LEGACY.json" <<'JSON'
{
  "wi": "WI-553-LEGACY",
  "lane": "framework",
  "tasks": [
    {
      "id": 1,
      "subject": "execute the fix",
      "status": "in_progress",
      "blocked_by": [],
      "metadata": { "skill": "execute-changeset" },
      "skill_receipt": { "skill": "execute-changeset", "loaded_at": "2026-01-01T00:00:00.000Z", "loaded_via": "manual" }
    }
  ]
}
JSON
G553L add -A
G553L -c commit.gpgsign=false commit -q -m baseline
if (cd "$GIT_REPO2" && node "$ROOT/scripts/task-graph.mjs" set-status ".svc/lane-tasks-WI-553-LEGACY.json" 1 completed) >"$TMP/ac553-5-legacy.out" 2>&1; then
  pass "AC-553-5: a graph with no 'created' field is not retroactively gated"
else
  fail "AC-553-5: legacy/untagged graph unexpectedly gated: $(cat "$TMP/ac553-5-legacy.out")"
fi

echo ""
echo "  $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  echo "FAIL"
  exit 1
fi
echo "PASS — WI-553 risk-triggered plan/exec contracts (AC-553-1..7)"
exit 0
