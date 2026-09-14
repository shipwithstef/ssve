# Manifest: WI-360 — quick-fix exempt-class carve-out + receipt-commit binding

- **Feature spec:** `docs/specs/work-items/WI-360.md` (framework WI — the WI doc is the spec)
- **Branch:** `feature-wi-360-quick-fix-carve-out`
- **Status:** SIMULATED
- **Base branch / SHA:** `main` @ `de840575` (origin-synced)
- **Created:** 2026-06-07T05:05Z
- **Lane:** framework (full mandatory chain; worktree at execution)
- **Archetype:** Incremental extension (predicate extension to the existing eligibility classifier + one validation branch in the receipt checker)

## Implementation Summary

Two coupled deliverables:

1. **Exempt-class carve-out (the WI goal):** `classifyDiff` gains a deliberate exempt-class path — when EVERY staged file is exempt-class (docs/specs/**, docs/analysis/**, proposals/**, references/knowledge/**) or an append-only `.svc/*.jsonl`, the commit is quick-fix eligible WITHOUT the 3-file/30-line caps. Makes `rules/plan-changeset-trigger.md`'s exemption mechanically real: docs-class closeouts stop needing 5-receipt envelopes.
2. **Receipt-commit binding (soundness hole found at grounding):** the observed "Phase-0 judged eligible" was a receipt computed from a DIFFERENT staged tree (receipt on `dfe22a00` records files:1 +2/-0 vs the 26-file commit) promoted onto the commit; `check-chain-receipts.mjs` accepts `eligible===true` without comparing `receipt.tree_hash` to the commit's tree. Fix: the quick-fix acceptance branch verifies `receipt.tree_hash === git rev-parse <sha>^{tree}`; mismatch → invalid. Without this, the carve-out would widen an unbound gate.

**Existing-implementation grounding (read 2026-06-07):**
- `classifyDiff` (quick-fix-eligibility.mjs:105-154): caps (3 files / 30+30 lines), DENY_PATH_PATTERNS (already covers hooks/, scripts/, manifest, workflows, configs, locks), content check with all-markdown waiver (line 144 — the waiver is per-CONTENT, not the false-positive source; the false positive was tree mismatch).
- Denylist gaps vs WI guardrail: `test-framework/evals/tier-1/` and `FRAMEWORK-STATE.md` not denied today → added.
- `check-chain-receipts.mjs:104` `isQuickFix` + `:140-142` validation branch — single enforcement point (pre-push slot 10 line 45 calls `--sha`; reconcile uses the same module).
- Receipt schema (`schemas/receipts/quick-fix.schema.json`): `tree_hash` already required; additionalProperties unrestricted → `carve_out` reason text fits in existing `reasons[]`, no schema change.
- Phase-0 receipt evidence: `git notes --ref=svc-receipts show dfe22a00` → `eligible:true, files:1, +2/-0` against a 26-file commit (the smoking gun for binding).

**Invariants:** existing denylist entries keep refusing; the 3-file/30-line caps stay for NON-exempt content-based eligibility; envelope path untouched; receipt schema untouched; `eligible:false` behavior for mixed exempt+hot stages.

## Files Planned

| # | File | Action | Task | Purpose |
|---|---|---|---|---|
| 1 | test-framework/evals/tier-1/validate-quick-fix-carve-out.sh | CREATE | task-1 (TDD RED) | Both-directions + binding: exempt multi-file eligible; hot-path refused; mixed refused; append-only vs rewrite .svc jsonl; tree-mismatch receipt invalid |
| 2 | `scripts/quick-fix-eligibility.mjs` | MODIFY | task-2 (GREEN) | Exempt-class predicate + denylist additions (tier-1 dir, FRAMEWORK-STATE.md) |
| 3 | `scripts/check-chain-receipts.mjs` | MODIFY | task-2 (GREEN) | Bind quick-fix receipt tree_hash to commit tree |
| 4 | `CLAUDE.md` | MODIFY | task-2 | Chain section: exempt-class commits need only the quick-fix receipt |

**Tier-1 validator promotion note (per `rules/tier-1-promotion.md`):**
- `validator_path`: file 1 in Files Planned (created under test-framework/evals/tier-1/)
- `failure_class`: push-gate soundness drift — carve-out widening silently (exempting protected paths) or binding regression (receipts validating against the wrong tree; observed live on the Phase-0 commit)
- `promotion_signal`: signal 1 (observed false-positive on dfe22a00) AND signal 3 (hot path: eligibility + receipt checker gate every push in refuse mode)
- `expected_runtime_budget`: <5s hermetic (scratch git repo in mktemp with sanitized GIT_* env per WI-358 LF-001 learning; no network/LLM)
- `why_tier_2_or_targeted_is_insufficient`: both scripts gate every push; a silent widening or binding break would be invisible until an unsound commit lands

## Changeset Blueprints

### 1. CREATE test-framework/evals/tier-1/validate-quick-fix-carve-out.sh (full contents)

```bash
#!/usr/bin/env bash
# validate-quick-fix-carve-out.sh — Tier-1 validator for WI-360.
# Both-directions proof for the exempt-class carve-out + receipt-commit binding.
# Promotion note: docs/plans/2026-06-07-wi-360-quick-fix-carve-out/manifest.md

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

TMP="$(mktemp -d /tmp/wi360-carveout.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

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

# Scratch repo with sanitized git env (WI-358 LF-001 class: never inherit GIT_*)
G() { env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE git -C "$TMP/repo" "$@"; }
ELIG() { ( cd "$TMP/repo" && env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE node "$REPO_ROOT/scripts/quick-fix-eligibility.mjs" ); }

mkdir -p "$TMP/repo"
G init -q
G config user.email t@t.t
G config user.name t
mkdir -p "$TMP/repo/docs/specs/work-items" "$TMP/repo/docs/analysis" "$TMP/repo/proposals" "$TMP/repo/.svc" "$TMP/repo/hooks"
echo "seed" > "$TMP/repo/seed.md"
printf '.svc/receipts/\n' > "$TMP/repo/.gitignore"   # the eligibility script writes staging receipts into .svc/receipts/ — keep add -A clean (found at GREEN)
G add -A; G commit -qm seed

echo "=== Tier 1: quick-fix carve-out (WI-360) ==="

# D1: exempt-class multi-file (>3 files, >30 lines) → ELIGIBLE
for i in 1 2 3 4 5; do printf 'doc %s\n%s\n' "$i" "$(seq 1 12)" > "$TMP/repo/docs/specs/work-items/WI-90$i.md"; done
printf 'analysis\n' > "$TMP/repo/docs/analysis/a.md"
printf '{"ts":"t1"}\n' >> "$TMP/repo/.svc/pipeline-decisions.jsonl"
G add -A
check "D1 exempt-class multi-file eligible" bash -c 'OUT=$(ELIG_OUT=$('"'"''"'"'); exit 0)'
OUT_D1="$(ELIG)"; CODE_D1=$?
check "D1 exit 0 (eligible)" test "$CODE_D1" = "0"
check "D1 receipt says eligible true" bash -c "printf '%s' '$OUT_D1' | grep -q '\"eligible\": *true'"
check "D1 reason cites exempt-class" bash -c "printf '%s' '$OUT_D1' | grep -qi 'exempt'"
G commit -qm "docs batch"

# D2: hot-path file → REFUSED (denylist direction)
echo "x=1" > "$TMP/repo/hooks/h.mjs"; G add -A
OUT_D2="$(ELIG)"; CODE_D2=$?
check "D2 hot-path refused (exit 1)" test "$CODE_D2" = "1"
check "D2 reason cites denylist" bash -c "printf '%s' '$OUT_D2' | grep -q 'denylist'"
G commit -qm "hot"

# D3: tier-1 dir + FRAMEWORK-STATE.md newly denied
mkdir -p "$TMP/repo/test-framework/evals/tier-1"
echo "echo hi" > "$TMP/repo/test-framework/evals/tier-1/v.sh"; G add -A
OUT_D3="$(ELIG)"; CODE_D3=$?
check "D3 tier-1 dir refused" test "$CODE_D3" = "1"
G commit -qm t1
echo "state" > "$TMP/repo/FRAMEWORK-STATE.md"; G add -A
OUT_D3b="$(ELIG)"; CODE_D3b=$?
check "D3b FRAMEWORK-STATE refused" test "$CODE_D3b" = "1"
G commit -qm fs

# D4: mixed exempt + hot → REFUSED
echo "more docs" >> "$TMP/repo/docs/analysis/a.md"
echo "y=2" >> "$TMP/repo/hooks/h.mjs"
G add -A
OUT_D4="$(ELIG)"; CODE_D4=$?
check "D4 mixed stage refused" test "$CODE_D4" = "1"
G commit -qm mixed

# D5: .svc jsonl REWRITE (removal lines) → REFUSED; append-only → eligible
printf '{"ts":"t2"}\n' >> "$TMP/repo/.svc/pipeline-decisions.jsonl"
G add -A
CODE_D5a=0; ELIG >/dev/null 2>&1 || CODE_D5a=$?
check "D5a append-only jsonl eligible" test "$CODE_D5a" = "0"
G commit -qm append
python3 - "$TMP/repo/.svc/pipeline-decisions.jsonl" <<'PY'
import sys
p=sys.argv[1]
lines=open(p).read().splitlines(True)
open(p,'w').writelines(lines[1:])  # delete first line = rewrite
PY
G add -A
CODE_D5b=0; ELIG >/dev/null 2>&1 || CODE_D5b=$?
check "D5b jsonl rewrite refused" test "$CODE_D5b" = "1"

# D6: receipt-commit binding — checker rejects tree-hash mismatch
check "checker binds receipt tree to commit tree (static)" grep -q 'rev-parse.*\^{tree}' "$REPO_ROOT/scripts/check-chain-receipts.mjs"
check "checker reports tree-mismatch reason (static)" grep -qi 'tree.*mismatch\|mismatch.*tree' "$REPO_ROOT/scripts/check-chain-receipts.mjs"

echo ""
if [ "$FAIL" = 0 ]; then
  echo "  PASS — all $PASS carve-out checks passed"
  exit 0
else
  echo "  $FAIL failed, $PASS passed"
  exit 1
fi
```

(Committed file note: the stray `check "D1 exempt-class multi-file eligible"` sketch line is dropped — assertions are the labeled ones (12 total: D1×3, D2×2, D3×2, D4×1, D5×2, D6×2). The `ELIG` helper exits with the script's code; capture via `CODE=0; ELIG >/dev/null || CODE=$?` for refusal cases. Final file must pass `bash -n`.)

### 2. MODIFY `scripts/quick-fix-eligibility.mjs` (two diffs)

**2a — denylist additions:**

```markdown
<<<<<<< BEFORE
  /^hooks\//,
  /^scripts\//,
  /^\.github\/workflows\//,
  /\.config\.(js|mjs|ts|cjs)$/,
];
=======
  /^hooks\//,
  /^scripts\//,
  /^\.github\/workflows\//,
  /\.config\.(js|mjs|ts|cjs)$/,
  /^test-framework\/evals\/tier-1\//,
  /^FRAMEWORK-STATE\.md$/,
];
>>>>>>> AFTER
```

**2b — exempt-class predicate + carve-out branch (inserted before the caps, inside classifyDiff; helper above pathDenied):**

```markdown
<<<<<<< BEFORE
function pathDenied(file) {
  return DENY_PATH_PATTERNS.some((p) => p.test(file));
}
=======
// WI-360: deliberate exempt-class carve-out (rules/plan-changeset-trigger.md
// exemptions made mechanically real). Docs/analysis/proposals/knowledge trees
// and work items; .svc JSONL ledgers count only when the diff is append-only.
const EXEMPT_PATH_PATTERNS = [
  /^docs\/specs\//,
  /^docs\/analysis\//,
  /^proposals\//,
  /^references\/knowledge\//,
];

function isExemptPath(file) {
  return EXEMPT_PATH_PATTERNS.some((p) => p.test(file));
}

function isSvcLedger(file) {
  return /^\.svc\/[^/]+\.jsonl$/.test(file);
}

function pathDenied(file) {
  return DENY_PATH_PATTERNS.some((p) => p.test(file));
}
>>>>>>> AFTER
```

```markdown
<<<<<<< BEFORE
  // File count cap (3 files for pure-text)
  if (files.length === 0) {
    reasons.push("no staged files");
    return { eligible: false, reasons, addedLines: 0, removedLines: 0 };
  }
=======
  // File count cap (3 files for pure-text)
  if (files.length === 0) {
    reasons.push("no staged files");
    return { eligible: false, reasons, addedLines: 0, removedLines: 0 };
  }

  // WI-360 exempt-class carve-out: EVERY file is exempt-class docs/state, and
  // any .svc ledger change is append-only (no removed lines in the whole
  // diff for the ledger-only case is approximated by: ledgers present =>
  // zero removed lines overall, keeping the check diff-local and cheap).
  // Denylist still wins (checked first). Caps do not apply on this path.
  const allExempt = files.every((f) => isExemptPath(f) || isSvcLedger(f));
  const anyDenied = files.some((f) => pathDenied(f));
  const hasLedger = files.some((f) => isSvcLedger(f));
  if (allExempt && !anyDenied && (!hasLedger || removedLines.length === 0)) {
    return {
      eligible: true,
      reasons: [`exempt-class carve-out: ${files.length} docs/state file(s); ledger changes append-only`],
      addedLines: addedLines.length,
      removedLines: removedLines.length,
    };
  }
>>>>>>> AFTER
```

(Note: `eligible:true` with a non-empty `reasons[]` documenting the carve-out — the schema requires `reasons` array, content unconstrained; the checker keys on `eligible` only. The `reasons.length === 0` equation at the function tail is unaffected because this path returns early.)

### 3. MODIFY `scripts/check-chain-receipts.mjs` (binding)

```markdown
<<<<<<< BEFORE
    const v = validateReceipt("quick-fix", receipts["quick-fix"]);
    if (!v.valid) return { sha, ok: false, missing: [`quick-fix invalid: ${v.reasons.join("; ")}`], type: "invalid" };
    return { sha, ok: true, type: "quick-fix" };
=======
    const v = validateReceipt("quick-fix", receipts["quick-fix"]);
    if (!v.valid) return { sha, ok: false, missing: [`quick-fix invalid: ${v.reasons.join("; ")}`], type: "invalid" };
    // WI-360: bind the receipt to THIS commit — a quick-fix verdict computed
    // from a different staged tree must not validate this commit (observed
    // live: 1-file receipt promoted onto a 26-file commit, dfe22a00).
    try {
      const commitTree = execSync(`git rev-parse ${sha}^{tree}`, { encoding: "utf8" }).trim();
      if (receipts["quick-fix"].tree_hash !== commitTree) {
        return { sha, ok: false, missing: [`quick-fix tree mismatch: receipt ${String(receipts["quick-fix"].tree_hash).slice(0, 12)} vs commit ${commitTree.slice(0, 12)}`], type: "invalid" };
      }
    } catch {
      return { sha, ok: false, missing: ["quick-fix tree mismatch: commit tree unresolvable"], type: "invalid" };
    }
    return { sha, ok: true, type: "quick-fix" };
>>>>>>> AFTER
```

(Executor pre-check: confirm `execSync` is imported in check-chain-receipts.mjs; if absent, extend the existing node:child_process import.)

### 4. MODIFY `CLAUDE.md` (chain section note)

```markdown
<<<<<<< BEFORE
Chain mode is read from `.svc/chain-policy.json` (gitignored, machine-local) —
**read the file, never assume.** On this machine: **refuse mode since
2026-05-13** — every pushed non-quick-fix commit needs the 5-receipt envelope
=======
Chain mode is read from `.svc/chain-policy.json` (gitignored, machine-local) —
**read the file, never assume.** On this machine: **refuse mode since
2026-05-13** — every pushed non-quick-fix commit needs the 5-receipt envelope.
Exempt-class commits (docs/specs, docs/analysis, proposals, references/knowledge,
append-only `.svc/*.jsonl` — per WI-360) need only the auto-emitted quick-fix
receipt; the receipt is tree-bound to its commit. Every pushed non-quick-fix commit needs the 5-receipt envelope
>>>>>>> AFTER
```

(Executor refines wording in place — intent: one sentence documenting the carve-out + tree binding immediately after the refuse-mode sentence; avoid duplicated trailing clause.)

## Amendment Log (G6 review-exec, 2026-06-07)

- **G6-001 (high, codex):** R100 rename from a denylisted source into an exempt tree is invisible to name-only (destination-only, zero +/- lines) — eligible via the LEGACY path even with the carve-out's row guard. Fix: `getStagedRows()` (name-status -M -C) + GLOBAL row-level denylist check pushing reasons for any involved path; carve-out additionally requires rows-clean (defense in depth). Validator D7.
- **G6-002 (medium, codex):** binding regression was static-grep only. Fix: dynamic scratch-repo case injecting consolidated notes receipts — wrong tree_hash rejected with `tree mismatch`, right tree_hash positive control accepted. Validator D8/D8b (notes-first discovery: checker reads notes, not the mirror, in --sha mode). Validator total: 15 assertions.
- (bring-up) validator scratch repos need `.svc/receipts/` gitignored — the eligibility script's own staging-receipt writes pollute `add -A`.

## Task Graph

| Task | Title | Files | Deps | AC coverage | Validation | Checkpoint |
|---|---|---|---|---|---|---|
| task-1-validator | TDD RED: carve-out validator (D1 eligible-direction fails pre-change; D6 static binding checks fail) | 1 | — | AC-04 | validator exits NON-zero vs unmodified scripts (D1 exempt refused today by caps; D3 tier-1/FRAMEWORK-STATE not yet denied; D6 binding absent) | `checkpoint-1-red` |
| task-2-carve-out | GREEN: predicate + denylist + binding + CLAUDE.md | 2,3,4 | task-1 | AC-01..03, AC-05 | validator 12/12 | `checkpoint-2-green` |
| task-3-branch-validation | Full validation | — | 1,2 | AC-06 | suite 197/197 in worktree; lint; diff == 4 planned files; residue classified | (gate before G5) |

## AC-to-Task / AC-to-Test Mapping

| AC | Statement | Task | Test |
|---|---|---|---|
| AC-01 | Exempt-class multi-file docs commit eligible without caps | task-2 | D1 (3 assertions) |
| AC-02 | Protected paths still refuse (existing denylist + tier-1 dir + FRAMEWORK-STATE.md); mixed stages refuse | task-2 | D2/D3/D3b/D4 |
| AC-03 | .svc ledgers: append-only eligible, rewrite refused | task-2 | D5a/D5b |
| AC-04 | Validator RED pre-change (real TDD) | task-1 | checkpoint-1 log |
| AC-05 | Receipt tree-bound to commit (false-positive class closed) | task-2 | D6 static ×2 + G7 live range check |
| AC-06 | Suite 197/197; CLAUDE.md note present | task-3 | suite + grep |

## Prerequisite Alignment Matrix

| Task | UX | UI | Tech design | Style contract | Persona |
|---|---|---|---|---|---|
| all | N/A (framework tooling) | N/A | WI guardrails (exempt list, both-directions test) + grounding discoveries (binding hole, denylist gaps) | match file idiom (DENY_PATH_PATTERNS array style, classifyDiff early-return shape, checker return-object shape) | P0 operator: ceremony cost per docs commit |

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|-------------|------------|----------|------------------|
| 1 | git notes receipts (refs/notes/svc-receipts) | RELIED ON: binding check reads existing quick-fix receipts' tree_hash | coupled | schema already requires tree_hash (verified); legacy receipts with mismatched trees become invalid AT VALIDATION — range checks only run on remote..local pushes, so already-pushed history is unaffected; reconcile checks merged PRs not receipt-tree pairs (verified consumption points) |
| 2 | /tmp scratch repos (validator) | CREATED per run | decoupled-justified | trap rm -rf; sanitized GIT_* env per LF-001 learning |
| 3 | worktree-local .svc/wi-360-checkpoints.log | CREATED at checkpoints | decoupled-justified | dies with worktree; checkpoint commit subjects = durable anchor |

**Decoupled-justified prose (rows 2-3):** ephemeral evidence with trap cleanup and commit-subject fallback anchors respectively; neither can enter the tracked diff.

Untouched taxonomy environments (walked, nothing): host configs/symlinks, package registries, DBs, CI, browser, OAuth, cloud, schedulers, MCP, containers, OS services, webhooks, marketplaces, global settings (this WI does not touch the hook wirer).

## Lane Compliance (artifact-cited)

| Chain skill | Status | Artifact / citation |
|---|---|---|
| route-workflow (task 1) | completed | graph + P1-P6 logs + pipeline-decisions WI-360 routing entry (2026-06-07, speed-levers noted) + session contract |
| WI/spec acceptance | completed | docs/specs/work-items/WI-360.md IS the spec (precedent PR #29/#30/#31) |
| plan-changeset (task 2) | completed | this manifest; phases P1-P6; receipt |
| review-plan (task 3) | in progress | docs/plans/2026-06-07-wi-360-quick-fix-carve-out/review-log.yaml (written at P5) |
| execute → verify (4-8) | pending | graph order |
| design-tech (9) | skipped | top-level skip_reason + routing decision entry |

## Validation Plan

Task-level in §Task Graph. **Final:** suite 197/197 · lint · diff == 4 files · `git status --porcelain --untracked-files=all` residue classified. **Speed levers (declared):** the gated landing push's suite run (hot range → gate fires) doubles as the audit/post-merge regression evidence when the validated SHA matches; G7's live both-direction proof = the closeout push itself (exempt-class → must pass with ONLY the quick-fix receipt — the carve-out's own live fire) plus the landing push (hot → envelope path).

## Execution Command Sequence

```bash
bash scripts/worktree.sh create feature-wi-360-quick-fix-carve-out
# task-1 RED (status-gated)
set +e; bash test-framework/evals/tier-1/validate-quick-fix-carve-out.sh; RED=$?; set -e
test "$RED" -ne 0 && echo "RED=$RED ok"
git add test-framework/evals/tier-1/validate-quick-fix-carve-out.sh
git commit -m "test(WI-360): checkpoint-1-red" && mkdir -p .svc && git rev-parse HEAD >> .svc/wi-360-checkpoints.log
# task-2 GREEN: apply blueprints 2a/2b/3/4
bash test-framework/evals/tier-1/validate-quick-fix-carve-out.sh
git add scripts/quick-fix-eligibility.mjs scripts/check-chain-receipts.mjs CLAUDE.md
git commit -m "feat(WI-360): checkpoint-2-green" && git rev-parse HEAD >> .svc/wi-360-checkpoints.log
# task-3
EVALS=0 bash test-framework/evals/run-all-evals.sh --tier1
node scripts/lint-skills-manifest.mjs
git diff --name-only main...HEAD | sort
# RECOVERY_IF_FAIL: WT="$(git rev-parse --show-toplevel)"; rescue-branch if dirty;
#   CKPT=$(tail -1 "$WT/.svc/wi-360-checkpoints.log") or log --grep checkpoint- fallback;
#   git -C "$WT" reset --keep "$CKPT" (clean tree after rescue)
```

## Checkpoint Plan

1. `checkpoint-1-red` · 2. `checkpoint-2-green` — worktree-local ledger + commit-subject anchors.

## Loop-Back Targets

- Binding check breaks legitimate historical pushes mid-range → halt; scope binding to receipts emitted post-WI-360 (timestamp gate) and re-review
- Exempt predicate misses a docs path family in live use → extend EXEMPT_PATH_PATTERNS via follow-up quick-fix (the carve-out cannot self-modify: scripts/ is denied)

## Promotion Readiness Checklist

- [x] 1 CREATE + 3 MODIFY accounted
- [x] Real TDD; both directions + binding in one validator
- [x] 6 ACs mapped
- [x] Final diff == 4 files enforced
- [x] Promotion note (5 fields)
- [x] No banned scope-reduction phrases
- [x] Self-protection paradox noted: scripts/ stays denied, so this carve-out can never quick-fix itself

## Simulation Report (2026-06-07)

| # | Check | Result |
|---|-------|--------|
| 1 | CREATE target absent | PASS |
| 2-5 | All 4 MODIFY anchors unique on disk (denylist tail, pathDenied, caps block, checker return) | PASS |
| 6 | execSync already imported in checker | PASS |
| 7 | CLAUDE.md anchor sentence present | PASS |

## Adversarial Self-Pass (10-check, inline)

| # | Lens | Verdict |
|---|---|---|
| 1 | Archetype fit (predicate extension + one validation branch) | PASS — 1 CREATE + 3 MODIFY |
| 2 | Invariants (denylist precedence, caps for non-exempt, envelope path untouched) | PASS — denylist checked before carve-out return; early-return isolates |
| 3 | TDD real (D1/D3/D6 RED pre-change) | PASS |
| 4 | Rollback (checkpoints; binding revert = single hunk) | PASS |
| 5 | Scope creep | PASS — no receipt schema change; no emit-receipt changes |
| 6 | Widening hazard (the carve-out exempting too much) | MITIGATED — allExempt ∧ ¬anyDenied ∧ ledger-append-only; mixed stages refuse (D4); self-protection: scripts/ denied so carve-out can't quick-fix itself |
| 7 | Binding false-negatives (legit receipts failing) | LOW — emitter records git write-tree at staging == commit tree when committed as staged; loop-back target defined if historical mid-range pushes trip |
| 8 | Ledger heuristic (removedLines==0 global when ledger present) | ACKNOWLEDGED — conservative: refuses a docs+ledger stage where DOCS had deletions; cost = fall back to envelope; never widens |
| 9 | Hermeticity (validator scratch repo, sanitized GIT_*) | PASS — LF-001 learning applied |
| 10 | Live-fire plan (closeout push = exempt-class proof; landing push = hot proof) | PASS — both directions proven live at G7 |
