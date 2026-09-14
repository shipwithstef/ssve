# Framework Evolution — 2026-04-12

## Method

Evidence sources read (in order):
1. `FRAMEWORK-STATE.md` — loaded this session; known gaps pre-checked to avoid rediscovery
2. `DOCTRINE.md` — scanned for claims not enforced by any skill
3. `references/skill-pack-comparison.md` — capability gap vs gstack/superpowers
4. `references/blend-registry.json` — source provenance and staleness
5. `proposals/` — no pending proposals outside `done/` (clean queue)
6. `land-changeset/SKILL.md` — self-verify and step structure
7. `plan-changeset/SKILL.md` lines 1-200 — output contract and baseline tasks
8. `verify-promotion/SKILL.md` lines 1-80 — verification gates

Cross-referenced all findings against FRAMEWORK-STATE.md Known Gaps before ranking.
Items already tracked (autopilot skills 13-17, wave-based parallel, C1/C7 doctrine evidence debt, etc.) are excluded unless a new angle was found.

---

## Findings

### P0 — Fix now (blocks quality)

#### P0-A: `verify-promotion` is a paper gate — passes with zero running server and zero tests
**Category:** Fragility / Gap
**File:** `verify-promotion/SKILL.md:72`

The E2E execution step is:
```bash
npx playwright test 2>/dev/null || npm test 2>/dev/null || echo "no test runner found"
```

If no test runner exists, the command exits 0 with a message. The self-verify checklist
(`verify-promotion/SKILL.md:296-304`) checks "tests pass" — which is vacuously true when
no tests exist. Combined with the inputs table listing "Live environment" as required
(`verify-promotion/SKILL.md:44-47`) but no hard-stop if the server is not running, this
means a greenfield project where `write-e2e` was skipped will pass all verification
checks with zero runtime evidence.

The autopilot S1 run (`test-framework/results/autopilot-S1/analysis.md`) confirmed
verify-promotion was SIMULATED because no server was running. The skill itself has no
mechanism to detect or block this condition.

**Fix:** Add two self-verify checks:
1. `curl -sf http://localhost:{port}/health || exit 1` — hard-stop if server is not running before any verification step
2. Count E2E test files: `find . -name "*.spec.*" -o -name "*.test.*" | wc -l` — if count = 0, FAIL with "no test files found; write-e2e must run before verify-promotion"

---

#### P0-B: `skill-pack-comparison.md` is 9 days stale — framework improvement decisions use wrong capability data
**Category:** Drift / Inefficiency
**File:** `references/skill-pack-comparison.md:4`

> Last updated: 2026-04-03

Seven blend sessions ran after that date (through 2026-04-12 per `FRAMEWORK-STATE.md`
Blend History). The comparison still lists capabilities as gaps that have since been
filled (e.g., `diagnose-bug` root-cause debugging — listed as "routes to external"
but gstack and superpowers blends have since landed in `diagnose-bug/SKILL.md`).

`evolve-framework` and `blend-external` both read this file as a capability signal.
Stale data produces incorrect gap analysis and wastes blend effort on already-solved
problems.

**Fix:** Add a `Last blend checked:` field alongside `Last updated:` in the header.
After each blend session, run a one-pass scan of the comparison table: for each row
marked as a gap, check `FRAMEWORK-STATE.md` blend history for a matching implementation.
Update the row. This is a 10-minute task after any blend. Make it a required step in
`blend-external`'s self-verify checklist.

---

### P1 — Fix soon (degrades quality)

#### P1-A: DOCTRINE claims "parallel subagent execution with conflict detection" as a current capability — not implemented
**Category:** Drift
**File:** `DOCTRINE.md:716`

> "Parallel subagent execution with conflict detection. Independent tasks run concurrently (Sonnet implementors). Overlapping tasks get inner worktrees. An Opus orchestrator coordinates, merges, and runs the holistic review."

No skill implements inner-worktree provisioning for overlapping parallel tasks.
`execute-changeset` references `parallelGroup` metadata in manifests (`DOCTRINE.md:671-673`)
but contains no conflict detection or inner-worktree protocol. The "Wave-based parallel
with file overlap" item is already in FRAMEWORK-STATE.md Known Gaps as a 2-3 day
implementation task — but the DOCTRINE presents it as if it already works.

**Fix (quick):** Downgrade the DOCTRINE claim to aspirational until the implementation
gap is closed. Change `DOCTRINE.md:716` from present tense ("run concurrently... get inner
worktrees") to planned tense ("will run concurrently... will use inner worktrees — see
FRAMEWORK-STATE.md Known Gaps"). The implementation gap stays in Known Gaps unchanged.

---

#### P1-B: `land-changeset` has duplicate "Step 3" headings — causes agent confusion
**Category:** Fragility
**File:** `land-changeset/SKILL.md:174` and `land-changeset/SKILL.md:182`

Both lines are `### Step 3:`. An agent following numbered steps will be confused about
which governs which action. A future editor could delete the wrong one.

**Fix (quick-fix):** Renumber one of them. Line 174 ("Push the branch") should become
`### Step 3a:` and line 182 ("Switch to main and open PR") should become `### Step 3b:`.

---

#### P1-C: `land-changeset` coverage gate is soft WARN — user can bypass untested code
**Category:** Gap / Fragility
**File:** `land-changeset/SKILL.md:169-173`

The coverage gate requires 60% of changed code paths at ★ or above and warns if below,
asking "proceed anyway?" There is no fallback stop condition. A "yes, proceed" response
clears it with zero enforcement — untested code lands with a logged warning.

`DOCTRINE.md` describes this as a revision gate (blocking until fixed), not an escalation
gate (warn + ask). The skill implements escalation gate behavior.

**Fix:** Add a hard-stop path: if coverage is below 30% (configurable), do not ask —
block and require `write-e2e` before re-attempting. Between 30-60%, keep the warn+ask
pattern. Above 60%, pass silently. This preserves flexibility while closing the
zero-enforcement path for critically undertested code.

---

#### P1-D: `verify-promotion` journey glob silently passes when no journey files match
**Category:** Fragility
**File:** `verify-promotion/SKILL.md:56-68`

The skill passes `--journeys docs/specs/journeys/J*-<name>.feature.md` to test-journeys.
If the naming convention wasn't followed in `write-journeys`, the glob matches zero files.
Zero-match silently passes journey verification with no evidence.

**Fix:** Add a pre-flight check: `ls docs/specs/journeys/J*-<name>.feature.md 2>/dev/null | wc -l` — if count = 0, FAIL with "no journey files found matching pattern; check write-journeys output."

---

### P2 — Improve when possible

#### P2-A: `plan-changeset` baseline task list includes frontend tasks for all feature types
**Category:** Inefficiency
**File:** `plan-changeset/SKILL.md:104-128`

The suggested baseline includes `task-5-components` (UI) and `task-6-e2e` (end-to-end test).
DOCTRINE section "Feature Types" distinguishes Feature / Enabler / Integration — Enablers and
Integrations produce no human-facing components. Agents planning Enabler change sets are
given irrelevant scaffolding that they must manually strip.

**Fix:** Add a feature-type selector before the baseline task list. Feature → full baseline.
Enabler → types + services + integration-tests + config (no components, no E2E). Integration
→ types + event-contracts + consumer-stubs + integration-tests.

---

#### P2-B: Blend registry has three sources with unrecoverable provenance (`unknown-pre-registry`)
**Category:** Fragility
**File:** `references/blend-registry.json:11` (gstack), `186` (superpowers), `312` (oh-my-claudecode)

Three sources have `"sha": "unknown-pre-registry"` for their first blend. If a license or
security issue surfaces in those repos, svc cannot determine whether the problematic commit
predates or postdates the blend.

**Fix:** For each source, record the current HEAD SHA in a `"first_blend_sha_recovered"` field
by running `git ls-remote <source-url> HEAD`. This recovers post-hoc provenance (not exact,
but bounds the exposure window). Add a note: "Original blend SHA unrecoverable; recovery SHA
is current HEAD as of 2026-04-12 — actual blend was earlier."

---

#### P2-C: `oh-my-claudecode` and `claude-code-setup` never re-evaluated after initial blend
**Category:** Stale
**File:** `references/blend-registry.json:311-336` (oh-my-claudecode), `341-363` (claude-code-setup)

Both sources were blended 2026-04-05 with unknown SHAs and never re-checked. Unlike gstack
and superpowers (which each had a second blend pass on 2026-04-08), these two sources have
had no update evaluation. If they evolved their patterns, svc has no signal.

**Fix:** Schedule a quick re-scan of both sources in the next `blend-external` session.
Scope: "What changed in oh-my-claudecode and claude-code-setup since April 2026?" — not
open-ended blending, just a delta check.

---

#### P2-D: Pipeline decision log production not verified by skill self-verify checklists
**Category:** Gap
**File:** `plan-changeset/SKILL.md` (self-verify section), `verify-promotion/SKILL.md:296-304`

DOCTRINE mandates decision log entries for material decisions and gate results
(`DOCTRINE.md:993-1029`). Neither `plan-changeset` nor `verify-promotion` self-verify
checklists include a check that a `pipeline-decisions.jsonl` entry was written.

**Fix:** Add one self-verify check to each: "decision log entry written for this phase
(`grep -q <run_id> .svc/pipeline-decisions.jsonl`)." Low cost, closes the audit gap.

---

### P3 — Track (not actionable yet)

#### P3-A: Holistic review vs per-task review contradiction in DOCTRINE
**File:** `DOCTRINE.md:730` vs `land-changeset/SKILL.md:63-78`
DOCTRINE says holistic review replaces per-task review; land-changeset still does per-task
audits. Resolving this requires a deliberate architecture decision, not a quick fix.
Track until the Level B state machine work (already in Known Gaps) is scoped.

#### P3-B: Feature-toggle enforcement table not reflected in verify-promotion self-verify
**File:** `DOCTRINE.md:1106-1169`, `verify-promotion/SKILL.md:296-304`
The toggle registry / credential absence checks are documented in DOCTRINE but absent
from verify-promotion's checklist. Low blast radius but real. Track alongside the
autopilot server gap — both require a running environment to verify.

#### P3-C: Context budget tier enforcement has no mechanical gate
**File:** `DOCTRINE.md:940-950`, `references/context-budget.md`
Gate 4 says "checkpoint if DEGRADING or POOR tier." No hook or self-verify reads context
window state. Would require Claude API telemetry access. Not actionable until API exposes
context usage in a hook-readable format.

---

## Comparison delta

`skill-pack-comparison.md` is stale (P0-B above). Taking its pre-stale data at face value:

| Capability | gstack/superpowers has | svc status |
|---|---|---|
| Design system / DESIGN.md | `/design-consultation` | Blended into design-ui (registry says so; comparison still shows gap — needs sync) |
| Persistent browser daemon | Browser MCP | No equivalent; not in scope for framework |
| Safety guardrails (`/careful`, `/freeze`) | Yes | Hook-based guards exist (svc-workflow-guard.js) but not skill-level guardrails |
| Release pipeline (`/ship`, `/canary`) | Yes | land-changeset + verify-promotion cover this but no canary/feature-flag deploy |

Nothing new vs what's already in Known Gaps. The comparison needs a refresh (P0-B) before
this delta is reliable.

---

## Stale proposal audit

- `proposals/` root: empty (all proposals in `done/`). Queue is clean.
- `proposals/done/` last entries (2026-04-12): all marked IMPLEMENTED with replay PASS.
- No stale or obsolete proposals found.

---

## Priority summary

| ID | Finding | Category | Effort | Impact |
|----|---------|----------|--------|--------|
| P0-A | verify-promotion paper gate | Fragility | 30 min | HIGH — verification is theater |
| P0-B | skill-pack-comparison stale | Drift | 20 min | HIGH — bad data feeds all evolve/blend work |
| P1-A | DOCTRINE parallel claim misrepresented | Drift | 10 min | MED — misleads readers |
| P1-B | land-changeset duplicate Step 3 | Fragility | 5 min | MED — agent confusion |
| P1-C | land-changeset coverage gate soft | Gap | 20 min | MED — untested code bypasses gate |
| P1-D | verify-promotion journey zero-match | Fragility | 10 min | MED — silent false positive |
| P2-A | plan-changeset baseline for Enablers | Inefficiency | 30 min | LOW-MED |
| P2-B | Blend provenance recovery | Fragility | 20 min | LOW (audit risk) |
| P2-C | Stale blend source re-scan | Stale | 30 min | LOW |
| P2-D | Decision log self-verify gap | Gap | 15 min | LOW |
