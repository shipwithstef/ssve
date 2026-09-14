# Manifest: WI-358 — Local Pre-Push Tier-1 Gate (cloud CI deferred)

- **Feature spec:** `docs/specs/work-items/WI-358.md` (framework WI — the WI doc is the spec)
- **Branch:** `feature-wi-358-tier1-pre-push-gate`
- **Status:** SIMULATED
- **Base branch / SHA:** `main` @ `5c15a214` (origin-synced)
- **Created:** 2026-06-06T21:20Z
- **Lane:** framework (full mandatory chain; worktree at execution)
- **Archetype:** Incremental extension (sibling slot in existing `hooks/git/pre-push.d/` dispatcher)

## Implementation Summary

Add a scoped tier-1 gate as pre-push slot `15-tier1-gate`: when the pushed range touches hot-path files, run the full tier-1 suite + manifest lint locally before the push proceeds; docs/WI-only pushes skip in <1s. Cloud CI stays deferred until the repo goes public (user decision 2026-06-06 — private-repo Actions minutes).

**Existing-implementation grounding (read 2026-06-06):** dispatcher `.git/hooks/pre-push` (installed by `scripts/install-git-hooks.mjs`) runs every executable in `hooks/git/pre-push.d/` in lexical order, fail-fast. Sibling `10-receipts-complete` provides the stdin push-protocol pattern (local_ref/local_sha/remote_ref/remote_sha loop, notes-ref skip, new-branch vs existing-branch range) and the `.svc/chain-policy.json` MODE read. `run-all-evals.sh` already enforces `VALIDATOR_TIMEOUT_SEC` (default 180s) per validator. Network-token triage: exactly 3 tier-1 validators grep-match `gh pr|claude -p|gh api` and all three pass in local runs (members of the 194-PASS set) — no exclusion needed; protection = inherited per-validator timeouts + outer gate timeout + logged bypass.

**Invariants (amended at G6 — see §Amendment Log):** dispatcher template gains stdin capture-replay (EXEC-001; the only dispatcher change permitted, all else preserved); `10-receipts-complete` and `20-push-notes-ref` untouched; slot ordering 10 → 15 → 20 (cheap receipts check first, expensive suite second, notes push only when both pass); gate honors `.svc/chain-policy.json` mode (warn → print-only, refuse → block) for consistency with the chain; `run-all-evals.sh` untouched.

## Files Planned

| # | File | Action | Task | Purpose |
|---|---|---|---|---|
| 1 | test-framework/evals/tier-1/validate-tier1-pre-push-gate.sh | CREATE | task-1 (TDD RED) | Structural validator: slot exists+executable+syntax, hot-pattern present, bypass path present, mode-read present, dispatcher present |
| 2 | `hooks/git/pre-push.d/15-tier1-gate` | CREATE | task-2 (GREEN) | The gate slot |
| 3 | `scripts/install-git-hooks.mjs` | MODIFY | task-2b (G6 EXEC-001) | Dispatcher template: capture stdin once, replay to every slot (slot 10's while-read starved later slots) |

**Tier-1 validator promotion note (per `rules/tier-1-promotion.md`):**
- `validator_path`: file 1 in Files Planned (the tier-1 validator this WI creates under test-framework/evals/tier-1/)
- `failure_class`: silent decay/removal of the local CI-equivalent gate (the repo's only push-time regression net while cloud CI is deferred)
- `promotion_signal`: signal 3 — protects a framework hot path (git-hook enforcement surface; regression would silently drop push-time validation repo-wide)
- `expected_runtime_budget`: <2s, hermetic (bash -n + grep assertions only; never executes the suite)
- `why_tier_2_or_targeted_is_insufficient`: the gate guards every future push; its absence/breakage must surface on every validation run, not on a scenario cadence

## Changeset Blueprints

### 1. CREATE test-framework/evals/tier-1/validate-tier1-pre-push-gate.sh (full contents)

```bash
#!/usr/bin/env bash
# validate-tier1-pre-push-gate.sh — Tier-1 validator for WI-358.
# Structural checks for the local pre-push tier-1 gate slot.
# Promotion note: see docs/plans/2026-06-06-wi-358-tier1-pre-push-gate/manifest.md
# (failure_class: silent decay of the local CI-equivalent gate; signal 3 hot-path).

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$REPO_ROOT" || exit 1

GATE="hooks/git/pre-push.d/15-tier1-gate"
PASS=0
FAIL=0

check() {
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then
    echo "  ✓ $label"; PASS=$((PASS+1))
  else
    echo "  ✗ $label"; FAIL=$((FAIL+1))
  fi
}

echo "=== Tier 1: pre-push tier-1 gate (WI-358) ==="

check "gate slot exists" test -f "$GATE"
check "gate slot is executable" test -x "$GATE"
check "gate bash syntax valid" bash -n "$GATE"
check "gate reads chain-policy mode" grep -q 'chain-policy.json' "$GATE"
check "gate has hot-path pattern" grep -q 'HOT_PATTERN=' "$GATE"
check "hot-path pattern covers hooks/" grep -q '\^hooks/' "$GATE"
check "hot-path pattern covers scripts/" grep -q '\^scripts/' "$GATE"
check "hot-path pattern covers tier-1 dir" grep -q 'test-framework/evals/tier-1/' "$GATE"
check "hot-path pattern covers manifest" grep -q 'skills-manifest' "$GATE"
check "hot-path pattern covers SKILL.md" grep -q 'SKILL\\.md' "$GATE"
check "hot-path pattern covers provision/" grep -q 'provision/' "$GATE"
check "gate has logged bypass env" grep -q 'SVC_SKIP_TIER1_GATE' "$GATE"
check "bypass writes canonical audit record" grep -q 'pipeline-decisions.jsonl' "$GATE"
check "dispatcher replays stdin to slots" grep -q 'STDIN_CAPTURE' "scripts/install-git-hooks.mjs"
check "gate runs tier-1 suite" grep -q 'run-all-evals.sh --tier1' "$GATE"
check "gate pins EVALS=0 (no LLM tiers on push)" grep -q 'EVALS=0 timeout' "$GATE"
check "gate sanitizes git hook env (LF-001)" grep -q 'env -u GIT_DIR' "$GATE"
check "gate has outer timeout" grep -q 'SVC_TIER1_GATE_TIMEOUT_SEC' "$GATE"
check "gate skips notes refs" grep -q 'refs/notes' "$GATE"
check "gate engages on lint-only pushes" grep -q 'LINT_HITS' "$GATE"
check "new-branch range uses merge-base (three-dot)" grep -q 'MAIN_REF\.\.\.' "$GATE"
check "bypass creates .svc parent dir" grep -q 'mkdir -p .svc' "$GATE"
check "dispatcher installer versioned" test -f "scripts/install-git-hooks.mjs"
check "slot ordering: receipts(10) before gate(15)" test -f "hooks/git/pre-push.d/10-receipts-complete"

# Local-install presence is NOT a tier-1 failure (hermetic: a fresh clone that
# has not run install-git-hooks.mjs is a valid tree). Warn-only drift signal.
if [ ! -x ".git/hooks/pre-push" ]; then
  echo "  ⚠ dispatcher not installed in this clone (node scripts/install-git-hooks.mjs) — warn-only, not counted"
fi

echo ""
if [ "$FAIL" = 0 ]; then
  echo "  PASS — all $PASS gate structural checks passed"
  exit 0
else
  echo "  $FAIL failed, $PASS passed"
  exit 1
fi
```

### 2. CREATE `hooks/git/pre-push.d/15-tier1-gate` (full contents)

```bash
#!/usr/bin/env bash
# svc pre-push slot: scoped local tier-1 gate (WI-358).
#
# Runs the full tier-1 suite + manifest lint BEFORE a push proceeds, but ONLY
# when the pushed range touches hot-path files. Docs/WI-only pushes skip fast.
# Cloud CI is deferred until the repo goes public (private-repo Actions minutes
# would drain) — this slot is the local CI-equivalent regression net.
#
# Mode: honors .svc/chain-policy.json — "refuse" blocks the push on failure,
# anything else prints a warning and allows.
# Bypass: SVC_SKIP_TIER1_GATE=1 skips the suite and appends an audit record to
# .svc/pipeline-decisions.jsonl — the canonical channel per WI-358 guardrail (G6 EXEC-002).
# Outer timeout: SVC_TIER1_GATE_TIMEOUT_SEC (default 420s) caps the suite run;
# per-validator 180s timeouts are inherited from run-all-evals.sh (WI-110).

set -u
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

MODE="warn"
if [[ -f .svc/chain-policy.json ]] && grep -q '"mode": *"refuse"' .svc/chain-policy.json 2>/dev/null; then
  MODE="refuse"
fi

HOT_PATTERN='^hooks/|^scripts/|^test-framework/evals/tier-1/|^skills-manifest\.json$|(^|/)SKILL\.md$|^setup$|^provision/'
LINT_PATTERN='^skills-manifest\.json$|(^|/)SKILL\.md$|^README\.md$|^REPO_MODES\.md$|^EXTERNAL_ADDONS\.md$|^references/shared-content-dirs\.json$'

if [[ "${SVC_SKIP_TIER1_GATE:-0}" == "1" ]]; then
  mkdir -p .svc   # fresh clone/worktree lacks .svc/ — >> does not create parents (tier-3 WI-358-T3-001)
  TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  # Canonical audit channel per WI-358 guardrail (G6 EXEC-002): one tracked ledger, greppable by event token.
  printf '{"ts":"%s","run_id":"push","skill":"tier1-gate","decision_type":"mechanical","decision":"tier1-gate-bypass","reasoning":"SVC_SKIP_TIER1_GATE=1 set by %s","decided_by":"P0","overrideable":false}\n' \
    "$TS" "$(git config user.email 2>/dev/null || echo unknown)" >> .svc/pipeline-decisions.jsonl
  echo "svc: tier1-gate BYPASSED (SVC_SKIP_TIER1_GATE=1) — recorded to .svc/pipeline-decisions.jsonl" >&2
  exit 0
fi

CHANGED=""
while read -r local_ref local_sha remote_ref remote_sha; do
  [[ -z "${local_sha:-}" ]] && continue
  [[ "$local_sha" == "0000000000000000000000000000000000000000" ]] && continue
  case "$local_ref" in
    refs/notes/svc-receipts|refs/notes/*) continue ;;
  esac
  if [[ "$remote_sha" == "0000000000000000000000000000000000000000" ]]; then
    MAIN_REF="$(git rev-parse --verify origin/main 2>/dev/null || git rev-parse --verify origin/HEAD 2>/dev/null || echo "")"
    if [[ -n "$MAIN_REF" ]]; then
      # Three-dot = merge-base(main, branch)..branch — only the branch's OWN changes.
      # Two-dot vs main-tip false-engages when main advanced past the branch point (tier-3 WI-358-T3-002).
      FILES="$(git diff --name-only "$MAIN_REF...$local_sha" 2>/dev/null)"
    else
      FILES="$(git show --name-only --format= "$local_sha" 2>/dev/null)"
    fi
  else
    FILES="$(git diff --name-only "$remote_sha" "$local_sha" 2>/dev/null)"
  fi
  CHANGED="${CHANGED}${FILES}"$'\n'
done

if [[ -z "$(printf '%s' "$CHANGED" | tr -d '[:space:]')" ]]; then
  exit 0
fi

# Dual-engage (review-plan G2 WI-358-PLAN-006): suite runs on HOT hits; manifest
# lint runs on LINT hits; skip only when NEITHER matches. A lint-only push (e.g.
# README skill-list sync) runs lint in ~2s without paying the full suite.
HOT_HITS="$(printf '%s\n' "$CHANGED" | grep -E "$HOT_PATTERN" | sort -u || true)"
LINT_HITS="$(printf '%s\n' "$CHANGED" | grep -E "$LINT_PATTERN" | sort -u || true)"
if [[ -z "$HOT_HITS" && -z "$LINT_HITS" ]]; then
  echo "svc: tier1-gate skip — no hot-path or lint-relevant files in pushed range (docs/WI-only push)" >&2
  exit 0
fi

GATE_TIMEOUT="${SVC_TIER1_GATE_TIMEOUT_SEC:-420}"
LOG="$(mktemp /tmp/svc-tier1-gate.XXXXXX.log)"

SUITE_CODE=0
if [[ -n "$HOT_HITS" ]]; then
  echo "svc: tier1-gate ENGAGED (suite) — hot-path files in pushed range:" >&2
  printf '%s\n' "$HOT_HITS" | head -10 | sed 's/^/    /' >&2
  # EVALS=0 pins tier-1-only even if the pushing shell exports EVALS=1 (suite
  # gates LLM tiers on EVALS==1; simulation probe 2026-06-07). The --tier1 arg is
  # documentation — tier 1 is the suite default; tier selection is env-driven.
  # Sanitize inherited git-hook env (LF-001, live-fire 2026-06-07): git exports
  # GIT_DIR/GIT_WORK_TREE/GIT_INDEX_FILE to hook subprocesses; validators that
  # create scratch git repos would otherwise execute git ops against THIS repo
  # (observed: main ref hijack, core.bare flip, identity overwrite).
  env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE -u GIT_PREFIX -u GIT_OBJECT_DIRECTORY -u GIT_ALTERNATE_OBJECT_DIRECTORIES -u GIT_QUARANTINE_PATH \
    EVALS=0 timeout "$GATE_TIMEOUT" bash test-framework/evals/run-all-evals.sh --tier1 >"$LOG" 2>&1
  SUITE_CODE=$?
fi

LINT_CODE=0
if [[ -n "$LINT_HITS" ]]; then
  echo "svc: tier1-gate ENGAGED (manifest lint) — lint-relevant files in pushed range" >&2
  env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE \
    node scripts/lint-skills-manifest.mjs >>"$LOG" 2>&1 || LINT_CODE=$?
fi

if [[ $SUITE_CODE -eq 0 && $LINT_CODE -eq 0 ]]; then
  echo "svc: tier1-gate PASS (suite green; log: $LOG)" >&2
  exit 0
fi

echo "svc: tier1-gate FAIL — suite=$SUITE_CODE lint=$LINT_CODE (log tail below; full: $LOG)" >&2
tail -15 "$LOG" >&2

if [[ "$MODE" == "refuse" ]]; then
  echo "svc: tier1-gate BLOCKING push (chain-policy mode=refuse). Fix failures, or SVC_SKIP_TIER1_GATE=1 with logged justification." >&2
  exit 2
fi

echo "svc: tier1-gate warn-only (chain-policy mode=$MODE) — allowing push despite failures" >&2
exit 0
```

### 3. MODIFY `scripts/install-git-hooks.mjs` (G6 EXEC-001 — dispatcher stdin capture-replay)

```markdown
<<<<<<< BEFORE
if [[ ! -d "$SLOT_DIR" ]]; then
  exit 0
fi

for slot in "$SLOT_DIR"/*; do
  [[ -x "$slot" ]] || continue
  "$slot" "$@"
=======
if [[ ! -d "$SLOT_DIR" ]]; then
  exit 0
fi

# Capture stdin once and replay to every slot — multiple slots can read the
# git hook payload (pre-push protocol rows); without this, the first
# stdin-consuming slot starves the rest (WI-358 G6 EXEC-001).
STDIN_CAPTURE="$(mktemp /tmp/svc-hook-stdin.XXXXXX)"
trap 'rm -f "$STDIN_CAPTURE"' EXIT
cat > "$STDIN_CAPTURE" 2>/dev/null || true

for slot in "$SLOT_DIR"/*; do
  [[ -x "$slot" ]] || continue
  "$slot" "$@" < "$STDIN_CAPTURE"
>>>>>>> AFTER
```

(Template literal inside `makeDispatcher(event)` — the same template serves all hook events; non-stdin events capture an empty file, behavior unchanged. After the edit, run `node scripts/install-git-hooks.mjs` to regenerate installed dispatchers in the shared common-dir hooks path.)

## Amendment Log (G6 review-exec, 2026-06-07)

- **EXEC-001 (reject, codex; verified by direct dispatcher read):** slot 10's `while read` drains the shared stdin; slot 15 saw EOF → CHANGED empty → silent exit 0 in INTEGRATED operation (standalone probes could not catch this). Fix: dispatcher template stdin capture-replay (blueprint §3) + integrated probe P7 + validator check 23. **Dispatcher invariant consciously revised** per this manifest's own loop-back row ("dispatcher behavior surprise → halt").
- **EXEC-002 (medium, codex):** WI guardrail mandates bypass logging to `.svc/pipeline-decisions.jsonl`; implementation used a dedicated ledger. Fix: single canonical tracked ledger (event token `tier1-gate-bypass`), dedicated ledger dropped, External State row 3 updated.

- **LF-001 (live-fire, 2026-06-07, P0):** first real gated push ran the suite under inherited git-hook env; `GIT_DIR`/`GIT_WORK_TREE` leaked into validators that build scratch git repos — their git ops executed against the REAL repo (local main ref hijacked to fixture commit, `core.bare=true` flip, repo user identity overwritten, branch renamed; 9 validators failed; push refspec error). Recovered from origin-verified refs + object store (landing commit intact). Fix: gate sanitizes git env (`env -u GIT_DIR …`) for suite AND lint invocations; validator check 25. Learning: any suite executed inside a git hook MUST clear inherited `GIT_*` repo-context vars.

## Task Graph

| Task | Title | Files | Deps | AC coverage | Validation | Checkpoint |
|---|---|---|---|---|---|---|
| task-1-validator | TDD RED: structural validator (must FAIL while gate absent) | 1 | — | AC-06 | `bash test-framework/evals/tier-1/validate-tier1-pre-push-gate.sh` exits NON-zero (gate missing) — RED proof | `checkpoint-1-validator-red` |
| task-2-gate | GREEN: gate slot | 2 | task-1 | AC-01..05 | validator exits 0 (GREEN); behavioral probes P1–P6 per §Deterministic probe harness (notes-ref, docs-only, hot-engage GREEN, refuse-block via timeout, bypass+ledger, new-branch routing) | `checkpoint-2-gate-green` |
| task-2b-dispatcher-stdin | G6 EXEC-001: installer stdin capture-replay + reinstall | 3 | task-2 | AC-01 (integrated) | validator 23/23; probe P7 integrated-dispatcher PASS | `checkpoint-3-dispatcher-stdin` |
| task-3-branch-validation | Full-branch validation | — | 1,2,2b | AC-07 | full tier-1 (incl. NEW validator) PASS; lint PASS; diff == 2 planned files | (gate before G5) |

TDD: REAL red-green (validator written first, proven failing, gate makes it pass).

## AC-to-Task / AC-to-Test Mapping

| AC | Statement | Task | Test type |
|---|---|---|---|
| AC-01 | Gate runs suite+lint when pushed range touches hot-path files | task-2 | Unit-equivalent (pattern probe vs synthetic file lists) + live fire at land-push (G7 evidence) |
| AC-02 | Docs/WI-only ranges skip in <1s | task-2 | Unit-equivalent (pattern probe) + live: the WI-358 landing push itself is hot → engaged; a synthetic docs-list probe proves skip |
| AC-03 | Bypass env allows + appends audit record | task-2 | Unit-equivalent (env probe run) |
| AC-04 | Failure blocks push in refuse mode with log tail | task-2 | Manual (code-path assertion: exit 2 branch + MODE read; full live-failure proof at G7 via deliberate-fail probe if cheap, else code-trace cited) |
| AC-05 | Bounded runtime (outer 420s + inherited 180s/validator) | task-2 | Manual (timeout wiring grep + suite's existing WI-110 budget) |
| AC-06 | Structural validator with promotion note, RED→GREEN | task-1→2 | Unit (the validator IS the test; RED proof captured) |
| AC-07 | Full tier-1 (incl. new validator) + lint green on branch | task-3 | Manual (suite run) |

## Prerequisite Alignment Matrix

| Task | UX | UI | Tech design | Style contract | Persona trace |
|---|---|---|---|---|---|
| 1-3 | N/A — no user-facing surface (git-hook tooling) | N/A | design-tech SKIPPED in lane graph w/ logged reason; constraints = §Invariants + sibling-pattern grounding (dispatcher/sibling read 2026-06-06) | bash conventions mirror sibling `10-receipts-complete` (set -u, stdin protocol, stderr messaging) | **N/A — justified:** framework-internal enforcement; sole stakeholder = P0 owner-builder; framework lane carries no persona table |

Browser-visible MODIFY mock-parity: **N/A — no browser surface.**

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|---|---|---|---|
| 1 | `.git/hooks/pre-push` dispatcher (installed git-hook surface) | RELIED ON: dispatcher glob-runs `pre-push.d/*` — new slot auto-discovered, no install step | coupled | dispatcher source `scripts/install-git-hooks.mjs` (versioned; validator asserts it exists) + warn-only install-drift signal in the validator (`⚠ dispatcher not installed` when `.git/hooks/pre-push` absent — hermetic per review-plan WI-358-PLAN-005) |
| 2 | `/tmp` gate logs (mktemp) | CREATED per gate run | decoupled-justified | ephemeral by design; OS tmp cleanup owns lifecycle; log path printed in gate output for immediate triage; nothing depends on persistence |
| 3 | `.svc/pipeline-decisions.jsonl` (canonical audit ledger — G6 EXEC-002) | bypass rows APPENDED | coupled | tracked file, committed routinely; validator greps the gate for the path; event token `tier1-gate-bypass` greppable; WI-369 telemetry reads it |
| 4 | `.svc/wi-358-checkpoints.log` (checkpoint SHA ledger, execution-time) | CREATED during execute-changeset | decoupled-justified | ephemeral runtime evidence under gitignored `.svc/`; never in tracked diff (final-diff check reads `git diff main...HEAD`); rollback-if-absent fallback = `git log --oneline` checkpoint-named commits (each checkpoint is also a commit subject) |
| 5 | `.svc/wi-358-gate-probes.log` (behavioral probe evidence, execution-time) | CREATED during task-3 validation | decoupled-justified | ephemeral runtime evidence under gitignored `.svc/`; referenced by exec-record receipt as command_output evidence; disposed per leftover-disposition ledger at landing |
| 6 | `.git/hooks/*` regenerated dispatchers (shared common-dir, repo + all worktrees) | MUTATED by `node scripts/install-git-hooks.mjs` at task-2b | coupled | generator is the versioned source (`scripts/install-git-hooks.mjs`); pre-commit drift hook re-runs setup on framework staging; validator check 23 greps the generator for STDIN_CAPTURE |

**Decoupled-justified prose (rows 2, 4, 5):** all three are ephemeral evidence artifacts under OS-tmp or gitignored `.svc/` — they can never enter the tracked diff, so artifact lifecycle and repo lifecycle cannot drift apart structurally. Detection/recovery: row 2 paths are printed in gate stderr at creation; row 4 has a stated rollback fallback (checkpoint-named commit subjects in `git log`) covering the absent-after-clean-checkout case; row 5 is consumed into the exec-record receipt at landing and classified by the leftover-disposition ledger, which is validated by `scripts/validate-leftover-disposition.mjs` at land-changeset.

Untouched taxonomy environments (walked, nothing): host symlink surfaces (no SKILL/infra files), host configs, package registries, DBs, CI providers, browser state, OAuth stores, cloud infra, schedulers, MCP state, containers, OS services, webhooks, marketplaces.

## Lane Compliance (review-plan G2 WI-358-PLAN-001)

Framework lane, WI-bound. The mandatory chain (per CLAUDE.md "Mandatory Plan-Exec-Review Chain") is plan-changeset → review-plan → execute-changeset → review-exec → audit-implementation → land-changeset → verify-promotion — tracked as tasks 2–8 in `.svc/lane-tasks-WI-358.json`:

| Chain skill | Status | Artifact / citation |
|---|---|---|
| route-workflow (task 1) | completed | lane-tasks graph + session contract (`bound_to: wi-backlog`, 2026-06-06T20:55Z) |
| plan-changeset (task 2) | completed | this manifest; phases P1–P6 recorded; receipt `validation_output`: SIMULATED, mechanical exit 0 |
| review-plan (task 3) | in progress | docs/plans/2026-06-06-wi-358-tier1-pre-push-gate/review-log.yaml (this review; written at P5) |
| execute-changeset → verify-promotion (tasks 4–8) | pending | dispatched in graph order after G2 verdict |
| design-tech (task 9) | skipped | `.svc/pipeline-decisions.jsonl` entry 2026-06-06 (route-workflow phase: "design-tech skipped — sibling-slot pattern reuse, no new architecture"); skip pre-applied in graph per validate-skip-conditions-registry |

`evolve-framework` / `improve-framework` / `write-spec` are not chain members for WI-bound framework work — the WI doc (`docs/specs/work-items/WI-358.md`, header line 3) is the spec, per the same convention WI-357 landed with (PR #29).

## Validation Plan

Task-level commands in §Task Graph. **Final branch-level:** `bash test-framework/evals/run-all-evals.sh --tier1` (now 195 validators incl. the new one) · `node scripts/lint-skills-manifest.mjs` · `git diff --name-only main...HEAD | sort` == exactly the 2 planned files · behavioral probes below, outputs captured to `.svc/wi-358-gate-probes.log`.

### Deterministic probe harness (review-plan G2 WI-358-PLAN-004)

Six probes feed the gate REAL pre-push stdin rows (`<local_ref> <local_sha> <remote_ref> <remote_sha>`) from the worktree. SHA fixtures are derived at run time with self-verifying guards (each probe first echoes `git diff --name-only` of its range into the log so the evidence proves the fixture class). `Z40` = the 40-zero SHA.

```bash
G=hooks/git/pre-push.d/15-tier1-gate
LOG=.svc/wi-358-gate-probes.log
Z40=0000000000000000000000000000000000000000
mkdir -p .svc
: >"$LOG"
MAIN=$(git rev-parse origin/main)
HEAD_SHA=$(git rev-parse HEAD)
POLICY=.svc/chain-policy.json
POLICY_BAK=""
if [ -f "$POLICY" ]; then
  POLICY_BAK=$(mktemp /tmp/wi358-chain-policy.XXXXXX)
  cp "$POLICY" "$POLICY_BAK"
fi
restore_policy() {
  if [ -n "$POLICY_BAK" ]; then
    cp "$POLICY_BAK" "$POLICY"
    rm -f "$POLICY_BAK"
  else
    rm -f "$POLICY"
  fi
}
trap restore_policy EXIT
probe() { # name expected_exit stdin_row [env pairs...]
  local name="$1" want="$2" row="$3"; shift 3
  echo "--- probe:$name (want exit $want)" >>"$LOG"
  local got
  if printf '%s\n' "$row" | env "$@" bash "$G" >>"$LOG" 2>&1; then
    got=0
  else
    got=$?
  fi
  echo "probe:$name exit=$got want=$want $([ "$got" = "$want" ] && echo PASS || echo FAIL)" | tee -a "$LOG"
}

# P1 notes-ref push → instant skip (exit 0)
probe notes-ref 0 "refs/notes/svc-receipts $HEAD_SHA refs/notes/svc-receipts $MAIN" SVC_TIER1_GATE_TIMEOUT_SEC=420

# P2 docs-only range → skip (exit 0). Fixture: a main commit whose diff is docs-only;
# derive + guard (probe aborts with FIXTURE-INVALID if the range matches HOT or LINT).
DOCS_SHA=$(git log origin/main --format=%H -20 | while read s; do
  git diff --name-only "$s~1" "$s" | grep -qE '^hooks/|^scripts/|^test-framework/|^skills-manifest|SKILL\.md|^setup$|^provision/|^README|^REPO_MODES|^EXTERNAL_ADDONS|^references/shared-content-dirs' || { echo "$s"; break; }; done)
[ -n "$DOCS_SHA" ] || { echo "FIXTURE-INVALID docs-only: no recent range matched neither HOT nor LINT" | tee -a "$LOG"; exit 1; }
git diff --name-only "$DOCS_SHA~1" "$DOCS_SHA" | tee -a "$LOG"
probe docs-only 0 "refs/heads/main $DOCS_SHA refs/heads/main $DOCS_SHA~1"

# P3 hot range (this branch vs main: exactly the 2 planned hot files) → suite runs → exit 0 GREEN (AC-01 live)
probe hot-engage 0 "refs/heads/feature-wi-358-tier1-pre-push-gate $HEAD_SHA refs/heads/feature-wi-358-tier1-pre-push-gate $MAIN"

# P4 refuse-mode BLOCK without breaking the tree: write worktree-local refuse policy,
# induce suite failure via 3s outer timeout, expect exit 2 (AC-04 live).
printf '{"mode":"refuse"}\n' >"$POLICY"
probe refuse-block 2 "refs/heads/feature-wi-358-tier1-pre-push-gate $HEAD_SHA refs/heads/feature-wi-358-tier1-pre-push-gate $MAIN" SVC_TIER1_GATE_TIMEOUT_SEC=3

# P5 bypass → exit 0 + canonical audit row in pipeline-decisions.jsonl (AC-03, G6 EXEC-002)
ROWS_BEFORE=$(grep -c 'tier1-gate-bypass' .svc/pipeline-decisions.jsonl 2>/dev/null || echo 0)
probe bypass 0 "refs/heads/feature-wi-358-tier1-pre-push-gate $HEAD_SHA refs/heads/feature-wi-358-tier1-pre-push-gate $MAIN" SVC_SKIP_TIER1_GATE=1
ROWS_AFTER=$(grep -c 'tier1-gate-bypass' .svc/pipeline-decisions.jsonl)
[ "$ROWS_AFTER" -gt "$ROWS_BEFORE" ] && echo "probe:bypass-ledger PASS" | tee -a "$LOG" || echo "probe:bypass-ledger FAIL" | tee -a "$LOG"

# P6 new-branch row (zero remote SHA) → diffs vs origin/main → hot → suite path
# taken. Run in warn mode with a 3s timeout: exit 0 proves warn-mode allowance,
# and the ENGAGED-count delta proves the zero-SHA range parsed before the suite.
printf '{"mode":"warn"}\n' >"$POLICY"
ENGAGED_BEFORE=$(grep -c 'ENGAGED (suite)' "$LOG" 2>/dev/null || echo 0)
probe new-branch 0 "refs/heads/feature-wi-358-tier1-pre-push-gate $HEAD_SHA refs/heads/feature-wi-358-tier1-pre-push-gate $Z40" SVC_TIER1_GATE_TIMEOUT_SEC=3
ENGAGED_AFTER=$(grep -c 'ENGAGED (suite)' "$LOG" 2>/dev/null || echo 0)
[ "$ENGAGED_AFTER" -gt "$ENGAGED_BEFORE" ] && echo "probe:new-branch-routing PASS" | tee -a "$LOG" || echo "probe:new-branch-routing FAIL" | tee -a "$LOG"

# P7 INTEGRATED dispatcher probe (G6 EXEC-001): run the REAL installed pre-push
# dispatcher with a hot stdin row; assert slot-10 receipts output AND the gate's
# ENGAGED line BOTH appear (stdin replay proven). warn-mode + 3s timeout keep it
# fast; dispatcher exit 0 expected (slot 10 warns, gate timeout-fail allowed by warn).
node scripts/install-git-hooks.mjs >>"$LOG" 2>&1
printf '{"mode":"warn"}\n' >"$POLICY"
HOOKS_DIR="$(git rev-parse --git-common-dir)/hooks"
HOOK_OUT=$(printf '%s\n' "refs/heads/feature-wi-358-tier1-pre-push-gate $HEAD_SHA refs/heads/feature-wi-358-tier1-pre-push-gate $MAIN" | SVC_TIER1_GATE_TIMEOUT_SEC=3 bash "$HOOKS_DIR/pre-push" origin https://github.com/s7an-it/seriousvibecoding.git 2>&1); P7_CODE=$?
printf '%s\n' "$HOOK_OUT" >>"$LOG"
if printf '%s' "$HOOK_OUT" | grep -q 'ENGAGED (suite)' && [ "$P7_CODE" = "0" ]; then echo "probe:integrated-dispatcher PASS" | tee -a "$LOG"; else echo "probe:integrated-dispatcher FAIL (exit=$P7_CODE)" | tee -a "$LOG"; fi

grep -c "PASS" "$LOG"   # informational; authoritative = the 9 probe assertion lines above (7 probes + bypass-ledger + new-branch-routing + integrated-dispatcher)
```

Expected: P1 0 · P2 0 · P3 0 (suite green, ~3-4 min) · P4 2 (timeout-induced refuse block under a probe-created refuse policy) · P5 0 + ledger row · P6 0 + `ENGAGED (suite)` count increment under a probe-created warn policy. The bypass row P5 appends 1 audit record — disposed per leftover-disposition at landing (probe row carries `reason_env` making it distinguishable from real bypasses).

**Pattern-family completeness (AC-01/02 grep ACs):** narrow probe = exact paths (a hooks-dir path; a work-items docs row); adjacent probes = a nested skill file two dirs deep, root `setup`, `scripts/` deep paths, mixed hot+docs list (must engage), empty range (must exit 0).

## Execution Command Sequence

```bash
set -euo pipefail
bash scripts/worktree.sh create feature-wi-358-tier1-pre-push-gate
cd .worktrees/feature-wi-358-tier1-pre-push-gate
bash scripts/worktree.sh guard --skill execute-changeset --lane framework --branch feature-wi-358-tier1-pre-push-gate

# task-1 (RED): write validator per blueprint §1; chmod +x
bash test-framework/evals/tier-1/validate-tier1-pre-push-gate.sh && { echo "RED EXPECTED but passed"; exit 1; } || echo "RED confirmed (gate absent)"
git add test-framework/evals/tier-1/validate-tier1-pre-push-gate.sh && git commit -m "WI-358 checkpoint-1-validator-red: structural validator (TDD red)" 
git rev-parse HEAD >> .svc/wi-358-checkpoints.log

# task-2 (GREEN): write gate per blueprint §2; chmod +x
bash -n hooks/git/pre-push.d/15-tier1-gate
bash test-framework/evals/tier-1/validate-tier1-pre-push-gate.sh   # must now PASS
# behavioral probes (pattern + bypass) -> .svc/wi-358-gate-probes.log
git add hooks/git/pre-push.d/15-tier1-gate && git commit -m "WI-358 checkpoint-2-gate-green: scoped tier-1 pre-push gate"
git rev-parse HEAD >> .svc/wi-358-checkpoints.log

# task-3: branch validation
bash test-framework/evals/run-all-evals.sh --tier1
node scripts/lint-skills-manifest.mjs

# RESUME GUARDS: git log --oneline -3 | grep -q "checkpoint-<N>" && skip that task
# CHECKPOINT SHA RECORDING: after every commit (above)
# RECOVERY_IF_FAIL (status-gated, recorded-SHA):
#   test -z "$(git status --porcelain)" || git switch -c rescue/wi-358-$(date +%s)
#   CKPT=$(tail -1 .svc/wi-358-checkpoints.log 2>/dev/null)
#   [ -n "$CKPT" ] || CKPT=$(git log --format=%H --grep='checkpoint-' -1)   # log absent after clean checkout → checkpoint commit subjects are the fallback anchor
#   git reset --hard "$CKPT"
#   full abort: preserve dirty state, then bash scripts/worktree.sh remove feature-wi-358-tier1-pre-push-gate
```

## Checkpoint Plan

1. `checkpoint-1-validator-red` — RED proof anchor
2. `checkpoint-2-gate-green` — GREEN anchor
SHAs appended to `.svc/wi-358-checkpoints.log` at commit time; rollback = status-gated reset to recorded SHA; resume = checkpoint-detection guards.

## Loop-Back Targets

- Dispatcher behavior surprise → halt; `diagnose-bug` on install-git-hooks.mjs (dispatcher INVARIANT here)
- Suite interface change needed → halt; that's a `run-all-evals.sh` change = separate WI (invariant)

## Promotion Readiness Checklist

- [x] 2 CREATE files accounted; 0 MODIFY/DELETE
- [x] Every task has validation; real TDD red-green
- [x] 7 ACs mapped to tasks + test types
- [x] Checkpoints named; final diff == 2 files enforced in task-3
- [x] No ORM schemas — N/A; no Base44 — N/A
- [x] No banned scope-reduction phrases
- [x] Tier-1 promotion note carried (5 fields, §Files Planned)

## Simulation Report (2026-06-07)

| # | Check | Result | Action |
|---|-------|--------|--------|
| 1 | CREATE target 1 (validator) absent on disk | PASS (CREATE) | — |
| 2 | CREATE target 2 (gate slot) absent on disk | PASS (CREATE) | — |
| 3 | Dispatcher `.git/hooks/pre-push` installed + executable | PASS | invariant held |
| 4 | Sibling `10-receipts-complete` exists (stdin-protocol source pattern) | PASS | pattern reused |
| 5 | Sibling `20-push-notes-ref` exists (lexical ordering 10→15→20) | PASS | — |
| 6 | `.svc/chain-policy.json` present, mode=refuse | PASS | gate honors mode |
| 7 | Suite per-validator timeout (`VALIDATOR_TIMEOUT_SEC`, default 180s) | PASS | inherited |
| 8 | Suite `--tier1` interface | PASS (corrected) | Initial probe FAILed: literal `--tier1` not in suite source. Re-investigation: tier 1 is the suite DEFAULT; the arg is inert documentation; tier selection is env-driven — LLM tiers run only when `EVALS==1` (run-all-evals.sh:90). **Finding applied:** gate invocation pins `EVALS=0` so a pushing shell with `EVALS=1` exported can never trigger LLM tiers at push time; validator gained the matching check. |
| 9 | Network-token triage: 3 tier-1 validators grep-match `gh pr`/`claude -p`, all in the 194-PASS set | PASS | no exclusion needed |
| 10 | `.svc/` bypass-audit path writable, no name collision (`tier1-gate-bypass.jsonl` unused) | PASS | — |

**Post-simulation hardening (adversarial self-pass):** `^provision/` added to HOT_PATTERN (host-manifest changes are install-affecting; shared-symlinks meta-rule validator only protects pushes where the gate fires); `^references/shared-content-dirs\.json$` added to LINT_PATTERN (registry feeding the linter meta-rule). Validator: 22 checks (post-G2: +lint-only engage, dispatcher hermetic-swap; post-T3: +three-dot range, +mkdir bypass parent).

## Scenario Walkthrough (framework lane — behavioral scenarios)

| Scenario | Implementing task | Proof point |
|---|---|---|
| S1 hot-path push → suite runs, green → push proceeds | task-2 (gate) | task-3 probe + this WI's own landing push (touches hooks/ + test-framework/ → gate self-fires) |
| S2 docs/WI-only push → skip in <1s | task-2 | task-3 probe (pattern classification on synthetic file lists) |
| S3 bypass env set → suite skipped, audit row appended | task-2 | task-3 probe (`SVC_SKIP_TIER1_GATE=1` against probe harness, row asserted) |
| S4 refuse-mode + suite fail → push blocked exit 2 | task-2 | validator check (exit-2 branch present) + code trace; live negative-fire NOT simulated pre-merge (would require deliberately broken tree); covered at verify-promotion live-fire step |
| S5 new-branch push → range vs origin/main | task-2 | exercised by this WI's own landing (feature branch push) |
| S6 notes-ref push → skipped | task-2 | exercised by every receipts-notes push at landing |

## Adversarial Self-Pass (10-check, inline)

| # | Lens | Verdict |
|---|---|---|
| 1 | Archetype fit (Incremental extension — sibling slot, dispatcher untouched) | PASS — 2 CREATEs, 0 MODIFYs |
| 2 | Invariants (dispatcher, siblings 10/20, run-all-evals.sh untouched) | PASS — enforced by task-3 diff check == 2 files |
| 3 | TDD real (validator RED against absent gate → GREEN) | PASS — checkpoint-1 captures RED output |
| 4 | Rollback (status-gated reset to recorded checkpoint SHA; worktree remove) | PASS |
| 5 | Scope creep | PASS — no manifest/linter/suite edits smuggled in |
| 6 | Hermeticity (no network/LLM in gate path; EVALS=0 pin) | PASS after sim-8 finding |
| 7 | False-positive risk (gate fires on non-hot push) | LOW — pattern is prefix-anchored; docs/, .svc/, scratch/ never match |
| 8 | False-negative risk (hot file missed) | MITIGATED — provision/ added; residual: net-new top-level hot dirs need pattern update (documented in WI-358 guardrails as review-gate item) |
| 9 | Bypass abuse | MITIGATED — every bypass appends JSONL audit row; repeated-bypass review at audit-session-execution (same protocol as concern waivers) |
| 10 | Runtime budget (420s outer cap vs ~3-4min suite) | PASS — cap > observed p95; per-validator 180s inherited |
