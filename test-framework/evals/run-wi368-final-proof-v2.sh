#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
BASE_SHA="${1:-237edc16e3e7731373aa8bafe41b0f367089f6a5}"
RESULT_ROOT="${SVC_WI368_RESULT_ROOT:-/tmp/svc-wi368-runtime-v2-proof}"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
RESULT_DIR="$RESULT_ROOT/$RUN_ID"
COMMON_DIR="$(git rev-parse --path-format=absolute --git-common-dir)"
MAIN_ROOT="$(dirname "$COMMON_DIR")"
BASE_WORKTREE="$MAIN_ROOT/.worktrees/wi368-base-proof-$$"
mkdir -p "$RESULT_DIR"

cleanup() {
  if [[ -d "$BASE_WORKTREE" ]]; then git -C "$REPO_ROOT" worktree remove --force "$BASE_WORKTREE" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT

git rev-parse HEAD > "$RESULT_DIR/candidate-head.txt"
printf '%s\n' "$BASE_SHA" > "$RESULT_DIR/base-sha.txt"
git status --short --untracked-files=all > "$RESULT_DIR/status-before.txt"
git diff --check "$BASE_SHA" -- > "$RESULT_DIR/diff-check.txt"

mapfile -t CHANGED_MJS < <({ git diff --name-only "$BASE_SHA"; git ls-files --others --exclude-standard; } | sort -u | grep -E '\.mjs$' || true)
for file in "${CHANGED_MJS[@]}"; do node --check "$REPO_ROOT/$file"; done > "$RESULT_DIR/node-check.txt" 2>&1

mapfile -t CHANGED_JSON < <({ git diff --name-only "$BASE_SHA"; git ls-files --others --exclude-standard; } | sort -u | grep -E '\.json$' || true)
for file in "${CHANGED_JSON[@]}"; do node -e 'JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8"))' "$REPO_ROOT/$file"; done > "$RESULT_DIR/json-parse.txt" 2>&1

git -C "$REPO_ROOT" worktree add --detach "$BASE_WORKTREE" "$BASE_SHA" > "$RESULT_DIR/base-worktree.txt" 2>&1
BASE_STARTED_MS="$(date +%s%3N)"
set +e
(cd "$BASE_WORKTREE" && bash test-framework/evals/run-all-evals.sh) > "$RESULT_DIR/tier1-base.txt" 2>&1
BASE_RC=$?
(cd "$BASE_WORKTREE" && bash test-framework/scripts/validate-pipeline-integrity.sh .) > "$RESULT_DIR/pipeline-integrity-base.txt" 2>&1
PIPELINE_BASE_RC=$?
set -e
BASE_FINISHED_MS="$(date +%s%3N)"
git -C "$REPO_ROOT" worktree remove --force "$BASE_WORKTREE"

CANDIDATE_STARTED_MS="$(date +%s%3N)"
set +e
(cd "$REPO_ROOT" && bash test-framework/evals/run-all-evals.sh) > "$RESULT_DIR/tier1-candidate.txt" 2>&1
CANDIDATE_RC=$?
set -e
CANDIDATE_FINISHED_MS="$(date +%s%3N)"

set +e
(cd "$REPO_ROOT" && node test-framework/benchmarks/benchmark-execution-controller-v2.mjs) > "$RESULT_DIR/benchmark.json"
BENCHMARK_RC=$?
node scripts/lint-skills-manifest.mjs > "$RESULT_DIR/manifest-lint.txt" 2>&1
MANIFEST_RC=$?
bash test-framework/scripts/validate-pipeline-integrity.sh . > "$RESULT_DIR/pipeline-integrity.txt" 2>&1
PIPELINE_RC=$?
set -e
if [[ "$PIPELINE_BASE_RC" -eq "$PIPELINE_RC" ]] && cmp -s "$RESULT_DIR/pipeline-integrity-base.txt" "$RESULT_DIR/pipeline-integrity.txt"; then
  PIPELINE_REGRESSION=0
else
  PIPELINE_REGRESSION=1
fi

BASE_RESULT="$(grep -E '^RESULT:|^>>> Tier 1 Result:' "$RESULT_DIR/tier1-base.txt" | tail -2 | tr '\n' ' ')"
CANDIDATE_RESULT="$(grep -E '^RESULT:|^>>> Tier 1 Result:' "$RESULT_DIR/tier1-candidate.txt" | tail -2 | tr '\n' ' ')"
node - "$RESULT_DIR" "$BASE_SHA" "$BASE_RC" "$CANDIDATE_RC" "$BENCHMARK_RC" "$MANIFEST_RC" "$PIPELINE_BASE_RC" "$PIPELINE_RC" "$PIPELINE_REGRESSION" "$BASE_STARTED_MS" "$BASE_FINISHED_MS" "$CANDIDATE_STARTED_MS" "$CANDIDATE_FINISHED_MS" "$BASE_RESULT" "$CANDIDATE_RESULT" <<'NODE'
const fs = require('node:fs'); const path = require('node:path');
const [dir, baseSha, baseRc, candidateRc, benchmarkRc, manifestRc, pipelineBaseRc, pipelineRc, pipelineRegression, baseStartedMs, baseFinishedMs, candidateStartedMs, candidateFinishedMs, baseResult, candidateResult] = process.argv.slice(2);
const benchmark = JSON.parse(fs.readFileSync(path.join(dir, 'benchmark.json'), 'utf8'));
const failures = (name) => [...fs.readFileSync(path.join(dir, name), 'utf8').matchAll(/^\s+FAIL: ([^\s]+\.(?:sh|mjs))\b/gm)].map((match) => match[1]);
const baseFailures = [...new Set(failures('tier1-base.txt'))].sort();
const candidateFailures = [...new Set(failures('tier1-candidate.txt'))].sort();
const newFailures = candidateFailures.filter((name) => !baseFailures.includes(name));
const report = {
  schema_version: 'wi368-final-proof-v2', base_sha: baseSha,
  base_tier1: { exit_code: Number(baseRc), wall_ms: Number(baseFinishedMs) - Number(baseStartedMs), summary: baseResult.trim(), failures: baseFailures },
  candidate_tier1: { exit_code: Number(candidateRc), wall_ms: Number(candidateFinishedMs) - Number(candidateStartedMs), summary: candidateResult.trim(), failures: candidateFailures },
  new_regression: newFailures.length > 0,
  new_failure_scripts: newFailures,
  benchmark: { ...benchmark, exit_code: Number(benchmarkRc) },
  manifest_lint: { exit_code: Number(manifestRc) },
  pipeline_integrity: { base_exit_code: Number(pipelineBaseRc), candidate_exit_code: Number(pipelineRc), baseline_equivalent: Number(pipelineRegression) === 0 },
  one_candidate_full_tier1_run: true,
  holistic_review_pending: true,
  production_proven: false, slo_status: 'TARGET'
};
fs.writeFileSync(path.join(dir, 'summary.json'), `${JSON.stringify(report, null, 2)}\n`);
NODE

cat "$RESULT_DIR/summary.json"
if [[ "$CANDIDATE_RC" -ne 0 ]]; then exit "$CANDIDATE_RC"; fi
if [[ "$BENCHMARK_RC" -ne 0 ]]; then exit "$BENCHMARK_RC"; fi
if [[ "$MANIFEST_RC" -ne 0 ]]; then exit "$MANIFEST_RC"; fi
if [[ "$PIPELINE_REGRESSION" -ne 0 ]]; then exit 1; fi
