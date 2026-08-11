# Implementation Manifest — WI-379: Harden svc-task-completion-guard env-var-payload sites (E2BIG class)

- **Spec:** `docs/specs/work-items/WI-379.md`
- **Branch:** `bugfix-wi-379-e2big` (lane: framework / change_type: bugfix; risk: hot-path-hooks)
- **Base SHA:** `ab70a1808a19d51535b0f1cbc57cdeecdd41aa13`
- **Timestamp:** 2026-06-10T08:52Z
- **Status:** DRAFTED
- **Execution mode:** `dispatch` — blueprints MANDATORY (full before/after diff context per MODIFY). Hot-path hook change; blueprint precision prevents drift even though the orchestrator may execute inline.
- **Archetype:** Cross-cutting concern / migration-sweep hybrid. Fix ALL env-var-payload export sites of one pattern family in one hook + its lib, then broaden the regression validator that guards the pattern. Grep-first: the universe was measured BEFORE planning tasks.

## 1. Implementation Summary

`hooks/svc-task-completion-guard.sh` (the most safety-critical Stop hook) hands the unbounded Stop payload (`$INPUT`) and the lane-task file list (`$LANE_TASKS_LIST`) to child `node` processes by **env-export** at three sites. Exported environment variables count toward `ARG_MAX`; a large Stop payload or a long lane-task list can therefore trigger `E2BIG` / "Argument list too long" — the exact regression class fixed for `svc-wi-pillars-check.sh` in the bugfix-pillars-e2big closeout (PR #46). These three sites fail SOFT today (`2>/dev/null || true`, `if !`), so a failure silently degrades the safety-critical completion guard rather than crashing it. The fix replaces env-export of payloads with the proven **stdin-pipe** pattern, ports `active-intent.mjs check` to read the payload from stdin, and broadens `validate-hook-payload-not-argv.sh` to sweep ALL `svc-*.sh` hooks (today it greps only the pillars hook to stay green).

### Invariants (must hold before AND after — behavior-identical proof)

- **I1.** The guard's decision output for every status path (`allow`, `block`, `advisory_contract`, `advisory_active_intent`, `subagent`, `anti_loop`, `missing_decision`, `missing_receipt`, `missing_phase_receipt`, `invalid_input`, `invalid_graph`) is byte-identical for small payloads before/after.
- **I2.** The node child still receives the SAME parsed `input` object and the SAME `LANE_TASKS_LIST` content — only the transport (stdin vs env) changes.
- **I3.** Soft-fail semantics preserved: a node failure still degrades gracefully (the `|| true` / `if !` wrappers stay).
- **I4.** `active-intent.mjs record` mode (already stdin-first at line 421) is untouched; only `check` mode transport priority flips.
- **I5.** The SDKG router block (lines 28–88), the `SVC_REPO_ROOT_VAR` exports (path-only, bounded), and all `node -e '...' "$arg"` argv sites (bounded hook-authored reason strings, NOT the unbounded payload) are OUT OF SCOPE and unchanged.

### Constraints

- Bash `set -euo pipefail` is active — every pipe must not introduce an unguarded non-zero exit. Use `printf '%s' "$INPUT" | ... node ... || true` shape; the existing `|| true` / `if !` guards already absorb pipe failures.
- macOS/BSD portability: no GNU-only flags introduced (consistent with the existing sha1sum→shasum fallback at line 718).
- Never type a lone quoted space in generated content (NUL-byte quirk) — use printable separators.

## 2. Site Inventory (grep-universe, measured 2026-06-10)

| Site | Actual line | Spec-named line | Pattern | Var(s) exported | Classification |
|---|---|---|---|---|---|
| S1 (check_end_to_end_stop) | **109** | 105 (drifted +4) | `INPUT="$INPUT" node <<'NODE_E2E'` heredoc | `$INPUT` | env-export of unbounded payload — **IN SCOPE** |
| S2 (main parser) | **268** | 264 (drifted +4) | `LANE_TASKS_LIST="$LANE_TASKS_LIST" INPUT="$INPUT" node <<'NODE'` heredoc | `$INPUT`, `$LANE_TASKS_LIST` | env-export of unbounded payload + lane list — **IN SCOPE** |
| S3 (active-intent lib call) | **690** | 686 (drifted +4) | `INPUT="$INPUT" LANE_TASKS_LIST="$LANE_TASKS_LIST" WI="$WI" ... node "$HOOK_DIR/lib/active-intent.mjs" check` | `$INPUT`, `$LANE_TASKS_LIST` | env-export of unbounded payload to lib — **IN SCOPE** (lib port site) |

**Line drift cause:** WI-399 run2 (`c15bdbac`, PR #69) added the real nag cap (lines 730–745) and foreign-claim check (lines 747–777) plus header doc lines (10–15), shifting the spec's named lines by exactly +4 each. Recorded so review-plan does not flag the spec/actual mismatch as a planning error.

### Out-of-scope sites (classified, NOT changed) — proves the sweep is complete

| Line | Pattern | Why safe / out of scope |
|---|---|---|
| 33, 65 | `SVC_REPO_ROOT_VAR="${SVC_REPO_ROOT:-$PWD}" node <<'...'` | Exports a **path string only** (bounded, ~<4KB). Not the payload. |
| 61 | `echo "$LAST_COMPLETED_TASK_JSON" \| node ...` | Already **stdin-piped** (the correct pattern). |
| 76, 99, 230, 791, 873, 888 | `node -e '...' "$arg"` argv | `$arg` is a hook-authored reason string or a base64 of `remaining` lines — bounded; NOT the raw Stop payload or lane-task list. The validator's argv heuristic targets `"$INPUT"`/`"$HOOK_INPUT"`/`"$PAYLOAD"` specifically, which these do not match. |
| 756 | `FOREIGN=$(node -e '...' "$CLAIM_FILE" "$SESSION_ID" "$CLAIM_TTL_MIN")` | argv of bounded values (a path + a session id + an int). Not payload. |

**Universe completeness:** `grep -lE '(INPUT\|HOOK_INPUT\|PAYLOAD\|LANE_TASKS_LIST)="\$(INPUT\|HOOK_INPUT\|PAYLOAD\|LANE_TASKS_LIST)"' hooks/svc-*.sh` returns ONLY `svc-task-completion-guard.sh` — no other svc hook has a payload-var env-export. So the broadened validator's sweep will surface exactly these 3 sites and nothing else (clean before/after signal).

## 3. Files Planned

| # | File | Op | Sites | Risk |
|---|---|---|---|---|
| F1 | `hooks/svc-task-completion-guard.sh` | MODIFY | S1 (L109), S2 (L268), S3 (L690) — 3 env-export → stdin-pipe | hot-path Stop hook (highest risk) |
| F2 | `hooks/lib/active-intent.mjs` | MODIFY | `check` mode transport priority (L433) → stdin-first | hot-path lib (called from S3) |
| F3 | `test-framework/evals/tier-1/validate-hook-payload-not-argv.sh` | MODIFY | broaden hook sweep from 1 → all 7 `svc-*.sh` | tier-1 hot path (runs every lint) |

## 3a. Changeset Blueprint (dispatch mode — full before/after, no placeholders)

### F1 — `hooks/svc-task-completion-guard.sh`

#### F1-S1: line 109 — `check_end_to_end_stop` heredoc (export `$INPUT` → stdin)

The node block reads `process.env.INPUT` at line 193 (`input = JSON.parse(process.env.INPUT || "{}")`). Port: pipe `$INPUT` to stdin and read fd 0 inside node.

**BEFORE** (lines 107–110):
```bash
  local result status reason_b64 reason
  result=$(
    INPUT="$INPUT" node <<'NODE_E2E' 2>/dev/null || true
const fs = require("node:fs");
```

**AFTER:**
```bash
  local result status reason_b64 reason
  result=$(
    printf '%s' "$INPUT" | node <<'NODE_E2E' 2>/dev/null || true
const fs = require("node:fs");
```

**BEFORE** (lines 191–196, inside NODE_E2E):
```javascript
let input = {};
try {
  input = JSON.parse(process.env.INPUT || "{}");
} catch {
  input = {};
}
```

**AFTER:**
```javascript
let input = {};
try {
  const raw = fs.readFileSync(0, "utf8");
  input = JSON.parse(raw || "{}");
} catch {
  input = {};
}
```
(`fs` is already required at the top of NODE_E2E as `require("node:fs")` — line 110 — so no new import.)

#### F1-S2: line 268 — main parser heredoc (export `$INPUT` + `$LANE_TASKS_LIST` → stdin envelope)

`$INPUT` is the unbounded payload; `$LANE_TASKS_LIST` is a newline-joined list of file PATHS (bounded by path length × active-WI count in practice, unbounded in principle and named by the spec). The node block reads `process.env.INPUT` (L276) and `process.env.LANE_TASKS_LIST` (L310). Port: carry BOTH through a single base64-framed stdin JSON envelope `{"input_b64":..,"lane_tasks_list_b64":..}` — one pipe, both vars, binary-safe.

**Decision (recorded as `taste`):** base64-framed stdin envelope rather than two streams or raw JSON interpolation — the Stop payload can contain arbitrary control characters/newlines that would corrupt a raw envelope; base64 is the same round-trip already used at lines 223/230/873.

**BEFORE** (lines 266–268):
```bash
PARSED=""
if ! PARSED=$(
  LANE_TASKS_LIST="$LANE_TASKS_LIST" INPUT="$INPUT" node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
```

**AFTER (PREFERRED — two-statement form, `set -e` safe):**
```bash
PARSED=""
GUARD_ENVELOPE=$(printf '{"input_b64":"%s","lane_tasks_list_b64":"%s"}' \
  "$(printf '%s' "$INPUT" | base64 | tr -d '\n')" \
  "$(printf '%s' "$LANE_TASKS_LIST" | base64 | tr -d '\n')")
if ! PARSED=$(
  printf '%s' "$GUARD_ENVELOPE" | node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
```

**BEFORE** (lines 276–284, inside NODE):
```javascript
const inputRaw = process.env.INPUT || "{}";
let input;
try {
  input = JSON.parse(inputRaw);
} catch (error) {
  console.log(`status\tinvalid_input`);
  console.log(`warning\tinvalid hook input: ${error.message}`);
  process.exit(0);
}
```

**AFTER:**
```javascript
let envelope = {};
try {
  envelope = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
} catch { envelope = {}; }
const inputRaw = envelope.input_b64
  ? Buffer.from(envelope.input_b64, "base64").toString("utf8")
  : "{}";
let input;
try {
  input = JSON.parse(inputRaw);
} catch (error) {
  console.log(`status\tinvalid_input`);
  console.log(`warning\tinvalid hook input: ${error.message}`);
  process.exit(0);
}
```

**BEFORE** (lines 310–314, inside NODE):
```javascript
let laneFiles = (process.env.LANE_TASKS_LIST || "")
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean)
  .filter((f) => !path.basename(f).includes(".completed"));
```

**AFTER:**
```javascript
const laneListRaw = envelope.lane_tasks_list_b64
  ? Buffer.from(envelope.lane_tasks_list_b64, "base64").toString("utf8")
  : "";
let laneFiles = laneListRaw
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean)
  .filter((f) => !path.basename(f).includes(".completed"));
```

#### F1-S3: line 690 — active-intent.mjs `check` call (pipe `$INPUT` → stdin; keep bounded env vars)

`active-intent.mjs check` needs `$INPUT` (the large payload, read at lib L433) plus `$LANE_TASKS_LIST` (used ONLY for `dirname` of the first entry — lib `laneSvcDirFromEnv` L167), `$WI`, `$CONTRACT_BOUND_TO`, `$CONTRACT_WI`, `$CONTRACT_TS`. Only `$INPUT` is unbounded. Port: pipe `$INPUT` via stdin; keep the small bounded env vars (this is the spec's "keep small-payload env for that lib only with a documented size assertion" option for `$LANE_TASKS_LIST`).

**BEFORE** (lines 688–693):
```bash
if [[ "$STATUS" == "block" && -f "$HOOK_DIR/lib/active-intent.mjs" ]]; then
  ACTIVE_INTENT_RESULT=$(
    INPUT="$INPUT" LANE_TASKS_LIST="$LANE_TASKS_LIST" WI="$WI" \
      CONTRACT_BOUND_TO="$CONTRACT_BOUND_TO" CONTRACT_WI="$CONTRACT_WI" CONTRACT_TS="$CONTRACT_TS" \
      node "$HOOK_DIR/lib/active-intent.mjs" check 2>/dev/null || true
  )
```

**AFTER (PREFERRED — `$INPUT` never enters envp):**
```bash
if [[ "$STATUS" == "block" && -f "$HOOK_DIR/lib/active-intent.mjs" ]]; then
  # WI-379: pipe the unbounded $INPUT payload via stdin (ARG_MAX/E2BIG class).
  # $LANE_TASKS_LIST (svcDir derivation only) / $WI / contract vars stay env —
  # bounded (path list + WI id + short contract strings). See lib check-mode
  # stdin-first read + size assertion.
  ACTIVE_INTENT_RESULT=$(
    printf '%s' "$INPUT" | \
      LANE_TASKS_LIST="$LANE_TASKS_LIST" WI="$WI" \
      CONTRACT_BOUND_TO="$CONTRACT_BOUND_TO" CONTRACT_WI="$CONTRACT_WI" CONTRACT_TS="$CONTRACT_TS" \
      node "$HOOK_DIR/lib/active-intent.mjs" check 2>/dev/null || true
  )
```
(The lib `check` mode MUST read stdin first — F2 — for this to work.)

### F2 — `hooks/lib/active-intent.mjs`

#### F2: line 433 — `check` mode env-first → stdin-first

`record` mode (line 421) is already stdin-first. `check` mode (line 433) is env-first. The hook (F1-S3) now pipes `$INPUT` via stdin and stops exporting `INPUT`, so `check` must read stdin first.

**BEFORE** (lines 432–434):
```javascript
    }
    const rawInput = process.env.INPUT || (!process.stdin.isTTY ? readFileSync(0, "utf8") : "");
    const resolvedWi = process.env.RESOLVED_WI || process.env.WI || "";
```

**AFTER:**
```javascript
    }
    // WI-379: read the payload from stdin first (the hook pipes $INPUT via
    // stdin to avoid ARG_MAX/E2BIG; env INPUT is the bounded test/back-compat
    // fallback when stdin is a TTY). Mirrors `record` mode above.
    const rawInput = !process.stdin.isTTY ? readFileSync(0, "utf8") : process.env.INPUT || "";
    const resolvedWi = process.env.RESOLVED_WI || process.env.WI || "";
```

> Back-compat: env-`INPUT` fallback retained for direct CLI/test invocations where stdin is a TTY. The only caller of `active-intent.mjs check` is this hook (verified in simulation: `grep -rn 'active-intent.mjs' hooks/ scripts/` → sole hit at `svc-task-completion-guard.sh:692`).

### F3 — `test-framework/evals/tier-1/validate-hook-payload-not-argv.sh`

Broaden the static heuristic backstop from the single pillars hook to ALL `svc-*.sh` hooks. The behavioral 300KB test stays anchored to the pillars hook (the documented original regression); the static source heuristic loops over every `svc-*.sh`.

**BEFORE** (lines 11–13):
```bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
HOOK="$REPO_ROOT/hooks/svc-wi-pillars-check.sh"
```

**AFTER:**
```bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
HOOK="$REPO_ROOT/hooks/svc-wi-pillars-check.sh"   # behavioral anchor (original regression)
# WI-379: the static source heuristic now sweeps ALL svc-*.sh hooks, not just
# the pillars hook — any svc hook that env-exports or argv-passes the payload
# var to a child is the same ARG_MAX/E2BIG class.
HOOKS_TO_SWEEP=("$REPO_ROOT"/hooks/svc-*.sh)
```

**BEFORE** (lines 28–33):
```bash
# Behavioral test above is authoritative. This static check is a HEURISTIC
# backstop: the payload var must not reach a child via env-export OR argv.
SRC_BAD=0
grep -qE '(HOOK_INPUT|INPUT|PAYLOAD)="\$(INPUT|HOOK_INPUT|PAYLOAD)"[[:space:]]+(node|python)' "$HOOK" && SRC_BAD=1   # env-export ordering
grep -qE '(node|python)([^|<]*)"\$(INPUT|HOOK_INPUT|PAYLOAD)"' "$HOOK" && SRC_BAD=1                                  # argv ordering
assert "hook source does not pass the payload var to a child (env or argv heuristic)" "$([ "$SRC_BAD" = 0 ] && echo 1 || echo 0)"
```

**AFTER:**
```bash
# Behavioral test above is authoritative. This static check is a HEURISTIC
# backstop: the payload var must not reach a child via env-export OR argv —
# swept across EVERY svc-*.sh hook (WI-379).
SRC_BAD=0
BAD_HOOKS=""
for H in "${HOOKS_TO_SWEEP[@]}"; do
  [ -f "$H" ] || continue
  HBAD=0
  grep -qE '(HOOK_INPUT|INPUT|PAYLOAD|LANE_TASKS_LIST)="\$(INPUT|HOOK_INPUT|PAYLOAD|LANE_TASKS_LIST)"[[:space:]]+(node|python)' "$H" && HBAD=1   # env-export ordering
  grep -qE '(node|python)([^|<]*)"\$(INPUT|HOOK_INPUT|PAYLOAD|LANE_TASKS_LIST)"' "$H" && HBAD=1                                                  # argv ordering
  if [ "$HBAD" = 1 ]; then SRC_BAD=1; BAD_HOOKS="$BAD_HOOKS $(basename "$H")"; fi
done
assert "no svc hook passes the payload var to a child (env or argv heuristic; swept all svc-*.sh)${BAD_HOOKS:+ — offenders:$BAD_HOOKS}" "$([ "$SRC_BAD" = 0 ] && echo 1 || echo 0)"
```

> **LANE_TASKS_LIST in the heuristic:** the broadened regex adds `LANE_TASKS_LIST` to the captured var family because WI-379's S2 site exported it. After F1-S2 lands (`$LANE_TASKS_LIST` no longer env-exported adjacent to `node`), the completion guard passes. ORDERING IS LOAD-BEARING: F1 (all sites) MUST land before F3's broadened assertion can go green. The behavioral 300KB pillars test stays passing throughout.

## 4. Task Graph

| id | title | files | deps | AC coverage | validation command | checkpoint | parallel group |
|---|---|---|---|---|---|---|---|
| task-1 | Port F2 `active-intent.mjs check` to stdin-first | F2 | — | AC-3 | `node hooks/lib/active-intent.mjs check </dev/null; echo $?` (no crash) | yes | A |
| task-2 | Port F1-S1 (check_end_to_end_stop heredoc) to stdin | F1 | task-1 | AC-1, AC-4 | `bash test-framework/evals/tier-1/validate-end-to-end-stop-hook.sh` | yes | B |
| task-3 | Port F1-S2 (main parser heredoc) to stdin envelope | F1 | task-2 | AC-1, AC-4 | `bash test-framework/evals/tier-1/validate-stop-hook-stdin-preservation.sh && bash test-framework/evals/tier-1/validate-stop-hook-session-isolation.sh` | yes | B |
| task-4 | Port F1-S3 (active-intent call) to stdin pipe | F1 | task-1, task-3 | AC-1, AC-3, AC-4 | `bash test-framework/evals/tier-1/validate-completion-guard-no-max-escape.sh` | yes | B |
| task-5 | Broaden F3 validator sweep to all svc-*.sh | F3 | task-2, task-3, task-4 | AC-2 | `bash test-framework/evals/tier-1/validate-hook-payload-not-argv.sh` | yes | C |
| task-6 | Full completion-guard validator regression sweep + 300KB smoke | — | task-5 | AC-1..AC-4 | run all 8 completion-guard tier-1 validators (§7) + 300KB completion-guard smoke | yes | C |

**Task ordering rationale:** task-1 (lib) first because F1-S3 depends on it. F1 sites (task-2/3/4) before F3 broadening (task-5) — the broadened validator's new `LANE_TASKS_LIST` assertion only passes once S2 stops env-exporting it. task-6 is the behavior-identical proof gate.

## 5. AC-to-Task Mapping

The WI has no numbered ACs; derived from the Goal + Guardrails (recorded so review-plan can trace).

| AC | Statement (derived) | Tasks |
|---|---|---|
| AC-1 | All 3 env-var-payload export sites (S1/S2/S3) pass the payload via stdin, not env-export; a large Stop payload no longer counts toward ARG_MAX | task-2, task-3, task-4 |
| AC-2 | `validate-hook-payload-not-argv.sh` sweeps ALL svc-*.sh hooks (not just pillars) and passes | task-5 |
| AC-3 | `active-intent.mjs check` reads the payload from stdin (ported), with bounded env-INPUT fallback for TTY/test | task-1, task-4 |
| AC-4 | Behavior-identical: all existing completion-guard tier-1 validators stay green before/after, per-site | task-2, task-3, task-4, task-6 |

## 6. AC-to-Test Mapping

| AC | Test type | Test |
|---|---|---|
| AC-1 | Unit (static + behavioral) | `validate-hook-payload-not-argv.sh` (broadened) + `validate-stop-hook-stdin-preservation.sh` |
| AC-2 | Unit | `validate-hook-payload-not-argv.sh` exit 0 with all svc hooks swept |
| AC-3 | Manual + Unit | `node hooks/lib/active-intent.mjs check </dev/null` exits 0; `validate-completion-guard-no-max-escape.sh` green |
| AC-4 | Unit (regression) | All 8 completion-guard tier-1 validators green (§7) + a new 300KB-payload behavioral smoke on the completion guard |

### 6a. Prerequisite Alignment Matrix

| Trace | Source | Status |
|---|---|---|
| Tech | Stdin-pipe pattern proven in PR #46 (pillars E2BIG fix), at hook line 61 (`echo … \| node`), and active-intent.mjs `record` mode (L421) | ALIGNED |
| Style | Base64-framing for binary-safe stdin matches existing lines 223/230/873 (`Buffer.from(...,"base64")`) | ALIGNED |
| Persona | Framework-maintainer (svc developer) — no end-user persona; hot-path hook | N/A (framework work) |
| Host | Stop hook stdin/stdout contract: hook reads payload on stdin (line 20 `INPUT=$(cat)`), emits JSON `{decision,reason}` on stdout. Child node transport is internal — host contract untouched. No host API change. | ALIGNED |
| design-tech | Skipped in lane-tasks (`pre-design-tech`, skip_reason recorded): no new architecture, data model, module boundary, or external dependency | SKIPPED (justified) |

## 7. Validation Plan

**Behavior-identical proof (Guardrails — run BEFORE any edit to capture baseline, then AFTER each site).** The 8 completion-guard tier-1 validators that MUST stay green per-site:
1. `validate-completion-guard-lane-tasks-naming.sh`
2. `validate-completion-guard-no-max-escape.sh`
3. `validate-end-to-end-stop-hook.sh`
4. `validate-hook-payload-not-argv.sh`
5. `validate-stop-hook-phase-enforcement.sh`
6. `validate-stop-hook-session-isolation.sh`
7. `validate-stop-hook-stdin-preservation.sh`
8. `validate-stop-quality-baseline.sh`

**Baseline captured 2026-06-10:** `validate-hook-payload-not-argv.sh` → PASS (4/4) at base SHA. (Full 8-validator baseline captured by EXEC as task-0 before edits.)

### 7a. Execution Command Sequence

```bash
WT=/workspace/seriousvibecoding/.worktrees/wi379
cd "$WT"

# task-0: baseline (behavior-identical proof — capture BEFORE edits)
for v in validate-completion-guard-lane-tasks-naming validate-completion-guard-no-max-escape \
         validate-end-to-end-stop-hook validate-hook-payload-not-argv \
         validate-stop-hook-phase-enforcement validate-stop-hook-session-isolation \
         validate-stop-hook-stdin-preservation validate-stop-quality-baseline; do
  echo "== $v ==" ; bash "test-framework/evals/tier-1/$v.sh" >/tmp/svc-baseline-$v.log 2>&1; echo "exit=$?"
done

# task-1: F2 active-intent.mjs check stdin-first  → apply, then:
node hooks/lib/active-intent.mjs check </dev/null; echo "check-exit=$?"
bash test-framework/evals/tier-1/validate-end-to-end-stop-hook.sh

# task-2: F1-S1  → apply, then re-run validators 3,7
bash test-framework/evals/tier-1/validate-end-to-end-stop-hook.sh
bash test-framework/evals/tier-1/validate-stop-hook-stdin-preservation.sh

# task-3: F1-S2  → apply, then re-run validators 6,7
bash test-framework/evals/tier-1/validate-stop-hook-session-isolation.sh
bash test-framework/evals/tier-1/validate-stop-hook-stdin-preservation.sh

# task-4: F1-S3  → apply, then re-run validator 2
bash test-framework/evals/tier-1/validate-completion-guard-no-max-escape.sh

# task-5: F3 broaden  → apply, then:
bash test-framework/evals/tier-1/validate-hook-payload-not-argv.sh   # must PASS with all svc hooks swept

# task-6: full regression sweep (behavior-identical proof — AFTER all edits)
bash test-framework/evals/run-all-evals.sh --tier1 2>&1 | tail -20
# AND a fresh 300KB-payload smoke through the completion guard:
node -e 'process.stdout.write(JSON.stringify({stop_hook_active:false,session_id:"smoke",cwd:process.cwd(),x:"y".repeat(300000)}))' \
  | bash hooks/svc-task-completion-guard.sh 2>&1 | head -c 200; echo " (exit=$?)"
# Expect: no 'Argument list too long', no exit 126/127.
```

**RECOVERY_IF_FAIL:** any validator green at baseline and red after a site edit ⇒ revert THAT site only (`git checkout -p` the hunk), re-diagnose the transport framing; the base64 envelope (S2) and stdin-first lib read (F2) are the two most likely failure points. Do not proceed to the next task until the prior site's validators are green.

## 8. Checkpoint Plan

Checkpoint after each of task-1..task-6 (every task is a checkpoint). Commit trailer per CLAUDE.md (`Co-Authored-By: Claude Opus 4.8 (1M context)`). Single squash-landable branch.

## 9. Promotion Readiness Checklist

- [ ] All 3 env-export sites ported (S1/S2/S3) — grep `INPUT="\$INPUT"` / `LANE_TASKS_LIST="\$LANE_TASKS_LIST"` adjacent to `node` returns ZERO in the hook
- [ ] `active-intent.mjs check` stdin-first; env-`INPUT` fallback retained for TTY/test
- [ ] Validator broadened to all svc-*.sh and PASSES
- [ ] All 8 completion-guard tier-1 validators green (behavior-identical)
- [ ] 300KB-payload smoke through completion guard: no E2BIG, no exit 126/127
- [ ] No ORM/schema file touched ⇒ no migration task needed (N/A — bash+mjs change, no data model)
- [ ] Tier-1 promotion note present for the validator CHANGE (broadening, not new): see below

### Tier-1 promotion note (validator broadening — F3)

- `validator_path`: `test-framework/evals/tier-1/validate-hook-payload-not-argv.sh` (EXISTING tier-1 validator; this WI broadens its sweep, does not add a new slot)
- `failure_class`: hook-payload-argmax-e2big (env-export of unbounded payload to child node counts toward ARG_MAX)
- `promotion_signal`: 2nd firing of the class — pillars regression 2026-06-08 (PR #46) + these 3 sibling sites in the completion guard (WI-379). Meets tier-1-promotion.md signal #1 (≥2 occurrences/60d) AND #3 (protects the Stop hook hot path).
- `expected_runtime_budget`: <2s (hermetic; 300KB payload generated in-process, no network/LLM). Broadening adds a 7-hook static grep loop — still <2s.
- `why_tier_2_or_targeted_is_insufficient`: every large Edit/Stop fires these hooks on every session; a silent ARG_MAX degradation of the safety-critical completion guard is undetectable at runtime (soft-fails). The static sweep is the only place that catches a re-introduction across ALL svc hooks.

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|---|---|---|---|
| 4 | Process env / argv (child `node`) | The Stop payload + lane-task list were passed via `envp` (counts toward `ARG_MAX`); after this change they travel via the child's **stdin** instead | coupled | `validate-hook-payload-not-argv.sh` (broadened) fails the lint if any svc hook re-introduces env/argv payload passing; the hook's own `printf '%s' "$INPUT" \| node` is the enforcing wiring |
| 9 | `/tmp/svc-completion-guard/<session>-<cwdhash>` counter file | UNCHANGED — the nag counter file is written by bash AFTER the node parse; transport change does not touch it | decoupled-justified | n/a (out of scope; not created/mutated by this change) |

**decoupled-justified (env #9):** The counter file at `/tmp/svc-completion-guard/` is read/written by bash AFTER the node child returns (lines 708–728), entirely downstream of the transport sites. This change touches only how `$INPUT`/`$LANE_TASKS_LIST` reach the node children (S1/S2/S3), not the counter logic. Drift detection: `validate-completion-guard-no-max-escape.sh` and `validate-stop-hook-session-isolation.sh` both exercise the counter path and must stay green (task-6) — they are the recovery/monitoring path that would catch an accidental counter regression.

**Untouched environments (walked the 15-environment taxonomy, found nothing else):** 1 (filesystem — only reads existing `.svc` files, no new files), 2 (git refs/notes — none; orchestrator owns receipts), 3 (network — none), 5 (DB — none), 6 (cloud — none), 7 (CI — none; no cloud CI on this repo), 8 (browser/device — none), 10 (package registry — none; no dep change), 11 (cron/scheduler — none), 12 (message queue — none), 13 (secrets/credentials — none), 14 (host config / settings.json — UNCHANGED; the Stop hook wire contract is untouched, only the internal child transport changes), 15 (DNS/domains — none).

## Simulation Report (Pre-Implementation Dry Run)

Walked the task graph in dependency order against disk (files now) and planned (earlier edits). Every check targets a SPECIFIC file/line.

| # | Check | Method | Result |
|---|---|---|---|
| SIM-1 | F1 MODIFY target exists; S1 site at L109 | `sed -n '109p'` → `INPUT="$INPUT" node <<'NODE_E2E' 2>/dev/null \|\| true` | PASS |
| SIM-2 | F1 S2 site at L268 | grep `LANE_TASKS_LIST="$LANE_TASKS_LIST" INPUT="$INPUT" node <<'NODE'` present | PASS |
| SIM-3 | F1 S3 site at L690 | grep `INPUT="$INPUT" LANE_TASKS_LIST="$LANE_TASKS_LIST" WI="$WI"` present | PASS |
| SIM-4 | NODE_E2E reads `process.env.INPUT` at L193 (port target) | grep `JSON.parse(process.env.INPUT \|\| "{}")` | PASS |
| SIM-5 | main NODE reads `process.env.INPUT` L276 + `process.env.LANE_TASKS_LIST` L310 (port targets) | grep both | PASS |
| SIM-6 | F2 MODIFY target exists; `check` mode env-first at L433 | `sed -n '433p'` → `process.env.INPUT \|\| (!process.stdin.isTTY ? readFileSync(0,"utf8") : "")` | PASS |
| SIM-7 | F2 `record` mode already stdin-first (port template) at L421 | grep `!process.stdin.isTTY ? readFileSync(0, "utf8") : process.env.INPUT` | PASS |
| SIM-8 | F3 validator hardcoded to single pillars hook at L13 | `sed -n '13p'` → `HOOK="$REPO_ROOT/hooks/svc-wi-pillars-check.sh"` | PASS |
| SIM-9 | Universe: only svc-task-completion-guard.sh env-exports payload var | `grep -lE` over `hooks/svc-*.sh` → 1 file | PASS |
| SIM-10 | No other caller of `active-intent.mjs check` besides this hook | `grep -rn 'active-intent.mjs' hooks/ scripts/` → only `svc-task-completion-guard.sh:692` | PASS (re-verify at EXEC) |
| SIM-11 | `fs` already required inside NODE_E2E (no new import for F1-S1) | L110 `const fs = require("node:fs")` | PASS |
| SIM-12 | base64 round-trip technique already in-file (F1-S2 framing precedent) | L223/L230/L873 `Buffer.from(...,"base64")` | PASS |
| SIM-13 | Baseline validator green before change | `validate-hook-payload-not-argv.sh` → 4/4 PASS | PASS |
| SIM-14 | No CREATE targets (all MODIFY) ⇒ no collision check needed | — | PASS (N/A) |
| SIM-15 | `set -euo pipefail` pipe-safety: every new pipe wrapped by `\|\| true` or `if !` | all 3 sites retain their existing soft-fail guard | PASS |

**Scenario walkthrough (the one journey — "Stop event with a large payload"):** Given a Stop event with a 300KB payload → When the completion guard reads it (`INPUT=$(cat)` L20, unchanged) and passes it to the 3 node children → Then each child receives it via stdin (no envp growth) → And the decision output is byte-identical to the small-payload path. Maps to task-2/3/4 (transport) + task-6 (300KB smoke). No WARN.

**No unresolved FAIL.** No TBD/TODO. All 15 SIM checks PASS or justified N/A.

## Self-Review / Adversarial Plan Review (review-plan SELF pass — orchestrator owns the external adversarial gate)

Structured self-review per `references/adversarial-review-detail.md`. Per-section: what was checked, gaps, confidence.

| Section | What I checked | Gaps / residual risk | Confidence |
|---|---|---|---|
| Site inventory (§2) | Grepped all `node` invocations; classified each as env-export-unbounded (in scope) vs path-only / argv-bounded / already-stdin (out). Cross-checked spec's named lines vs actuals (+4 drift via WI-399 confirmed by git log `c15bdbac`). | None. The 3 in-scope sites are exhaustive and match the spec's count; out-of-scope sites are individually justified. | HIGH |
| Blueprints (§3a) | Full before/after for all 3 sites + F2 + F3, with exact line anchors verified by `sed`/`grep`. PREFERRED `set -e`-safe two-statement form for S2; stdin-pipe-without-envp form for S3. | S2 base64-envelope is heavier than strictly needed (LANE_TASKS_LIST is small in practice) — but the spec names it as a payload site, so porting it is correct, not over-engineering. | MEDIUM-HIGH |
| Behavior-identical proof (§7) | Enumerated all 8 completion-guard tier-1 validators; baseline run of the primary one captured (4/4). Per-site validator subset mapped. Added a 300KB completion-guard smoke beyond the existing pillars-anchored behavioral test. | Full 8-validator baseline deferred to EXEC task-0 (I ran only validator #4). Low risk — green on main per the WI being "no live break". | HIGH |
| External State | Walked the 15-env taxonomy; env #4 (process env/argv → stdin) coupled, #9 (counter file) decoupled-untouched. Named the enforcing validator. | None material. | HIGH |
| Scope discipline | No banned scope-reduction phrases. All 3 sites covered (100% of grep universe), not a subset. Tier-1 promotion note supplied for the validator broadening. | None. | HIGH |
| AC traceability | Derived 4 ACs from Goal+Guardrails (WI has no numbered ACs); every AC maps to ≥1 task and ≥1 test. | ACs are derived — review-plan/audit should treat the WI Goal+Guardrails as the contract. | MEDIUM-HIGH |

**Self-review verdict:** No HIGH-severity self-findings. One MEDIUM residual (S2/S3 transport framing under `set -e`) — mitigated by the PREFERRED `set -e`-safe forms documented inline. Plan is ready for the orchestrator's external adversarial review gate (review-plan primary). Residual ≤ MEDIUM.

## Self-Verify

| # | Check | Result |
|---|---|---|
| 0 | Archetype logged before reading spec deeply | PASS (`.svc/plan-changeset-archetype.log`) |
| 1 | Manifest file exists | PASS |
| 2 | Task graph ≥1 task | PASS (6 tasks) |
| 3 | AC-to-task complete | PASS (4 ACs → tasks) |
| 4 | AC-to-test complete | PASS |
| 5 | Simulation report appended | PASS (15 checks) |
| 6 | No unresolved FAIL | PASS |
| 7 | No TBD/TODO | PASS |
| 8 | Type/naming consistency | PASS (`input_b64`/`lane_tasks_list_b64` consistent across S2; `rawInput` consistent in F2) |
| 9 | Schema-migration consistency | N/A (no ORM file) |
| 10 | Base44 ground truth | N/A (no Base44) |
| 11 | Migration universe recorded | PASS (3 sites, grep baseline in §2) |
| 12 | Lane-model validation | run at handoff (orchestrator owns validate-task-graph-lane.mjs) |
| 13 | New-lane necessity | N/A (fits bugfix/framework lane) |
| 14 | Migration phase split | N/A (100% of grep universe covered, no deferral) |

## Deviation Notes (post-exec, station-reviewed)

**S1 + S2 transport deviation:** Both sites (check_end_to_end_stop and main parser) shipped using the mktemp/path-via-env pattern (_e2e_tmp / _GUARD_TMP) instead of the blueprint's preferred stdin-pipe AFTER form (`printf '%s' "$INPUT" | node <<heredoc`). Root cause: bash subshell heredoc stdin non-delivery — inside `result=$(...)` or `if ! PARSED=$(...)`, a pipe-to-heredoc construct does not reliably deliver stdin to the node child due to bash subshell I/O wiring. Only a bounded /tmp path enters envp (not the payload); behavior is equivalent — the node child reads the same payload content from disk vs stdin. This justification was originally recorded in lane-tasks as `bash_limitation_note`. The _GUARD_TMP and _SVC_E2E_INPUT env vars carry /tmp paths only (bounded ~<100 bytes each) and are intentionally exempt from the payload-not-argv heuristic, as documented in comments at each export site and in validate-hook-payload-not-argv.sh.

**Empty-INPUT anti-loop:** The guard has no explicit anti-loop guard for an empty INPUT payload. This is a CALLER CONTRACT: Claude Code and all supported hosts (Kimi via adapter) always send non-empty Stop payloads (`{"session_id":...,"stop_hook_active":false,...}`). The existing `stop_hook_active` check (anti_loop status path) and `isSubagent` detection handle the known re-trigger scenarios. An empty payload lands as invalid_input and is handled by the existing fail-closed/fail-open branch.

**Pre-existing issues noted but OUT OF SCOPE (recorded for follow-up):**
- The e2e `check_end_to_end_stop` function uses `|| true` to crash-swallow node failures; this means a node crash silently allows the stop. Pre-existing; not introduced by WI-379. Candidate for a future WI.
- The main parser loop re-reads laneFiles up to O(3N) times (resolveActiveWI, isNonExecutionRole, the main aggregation loop). Pre-existing performance issue; not introduced by WI-379. Candidate for a future WI.
