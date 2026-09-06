---
name: improve-framework
version: "1.0"
description: >
  Use when the svc framework itself needs fixing or improving. Triggers on
  "improve the framework", "run self-improvement", "close framework gaps",
  "use the framework to improve itself", after test-framework finds failures,
  after repeated reviews uncover drift, when a blend source shipped updates,
  or when pending proposals exist in proposals/.
phases:
  - id: P1-FrameworkRepoAndMemoryLoad
    trigger: always
    reads: ["installed skills root", "FRAMEWORK-STATE.md", "references/knowledge/svc/CAPABILITIES.md"]
    writes: [".svc/improve-framework-repo-memory.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-PendingProposalAndEvidenceSelection
    trigger: always
    reads: ["proposals/", "proposals/triage.json", "test-framework/results/", "user report"]
    writes: [".svc/improve-framework-evidence.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-DiagnosisAndDuplicateFilter
    trigger: always
    reads: ["FRAMEWORK-STATE.md", "evolve-framework output", "gap evidence"]
    writes: ["proposals/<date>-framework-improvement.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-ImplementationRouteDecision
    trigger: always
    reads: ["rules/plan-changeset-trigger.md", "rules/host-capability-research.md", "gap category"]
    writes: [".svc/improve-framework-route.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P5-ImplementationAndReplayVerification
    trigger: always
    reads: ["selected route output", "test-framework replay target", "changed files"]
    writes: ["test-framework/results/ when replayed", ".svc/improve-framework-replay.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P6-ImprovementRecordAndStateMutation
    trigger: always
    reads: ["proposals/<date>-framework-improvement.md", "FRAMEWORK-STATE.md", "references/knowledge/svc/CAPABILITIES.md"]
    writes: ["proposals/<date>-framework-improvement.md", "FRAMEWORK-STATE.md", "references/knowledge/svc/CAPABILITIES.md when capabilities change"]
    evidence_kind: file
    required_for_completion: true
  - id: P7-ProposalDoneAndRemoteSync
    trigger: implementation-verified
    reads: ["proposals/<date>-framework-improvement.md", "git status", "git remote"]
    writes: ["proposals/done/<date>-framework-improvement.md", "git commit", "git push or PR URL"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P8-SelfVerifyContinuation
    trigger: always
    reads: ["Self-Verify table", ".svc/lane-tasks-<WI>.json", "validation output"]
    writes: [".svc/improve-framework-self-verify.log"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "FRAMEWORK-STATE.md", artifact: framework-state }
  optional:
    - { path: "proposals/", artifact: proposals }
    - { path: "test-framework/results/", artifact: test-results }
    - { path: "references/blend-registry.json", artifact: blend-registry }
    - { path: "references/knowledge/svc/CAPABILITIES.md", artifact: self-knowledge }
outputs:
  produces:
    - { path: "proposals/<date>-framework-improvement.md", artifact: improvement-proposal }
chain:
  lanes:
    framework: { position: 4 }
  progressive: false
  self_verify: true
  human_checkpoint: true
---

# Framework Self-Improvement

Orchestrate the closed loop: find a gap → diagnose it → fix it → prove it → record it.

**Announce at start:** "I'm using improve-framework to run the self-improvement loop."

## Scope boundary vs `evolve-framework` (WI-077)

These two skills produce DIFFERENT artifacts and should never be conflated:

| Skill | Artifact shape | What it carries |
|---|---|---|
| `evolve-framework` | `proposals/<date>-evolution.md` | **Survey** of N gaps with evidence + severity + category. No per-leaf fix briefs. |
| `improve-framework` | `proposals/<date>-framework-improvement-<name>.md` | **One** gap, diagnosed, with ACs + file-impact + rollback. Single fix brief. |

**Rule:** An improvement proposal is ALWAYS scoped to a single gap. Batching multiple gaps into one improvement proposal is forbidden. If you catch an evolution proposal carrying per-leaf fix briefs, STOP — extract each leaf to its own `framework-improvement-<name>.md` before promoting to WIs. This was the WI-073 lane-compliance failure.

Reciprocal note in `skills/evolve-framework/SKILL.md` under "Scope boundary vs improve-framework".

## Step 0: Locate the Framework Source Repo — MANDATORY FIRST STEP

Before anything else, locate the svc framework git repo. All skill edits, proposals, FRAMEWORK-STATE.md updates, and commits go there — not to the install copy at `<SKILLS_PATH>` and not to the current project repo.

```bash
# 1. Resolve the host-specific installed skills root
SKILLS_ROOT="${SVC_SKILLS_PATH:-}"
if [ -z "$SKILLS_ROOT" ]; then
  for candidate in \
    "$HOME/.codex/skills" \
    "$HOME/.kimi/skills" \
    "$HOME/.gemini/skills" \
    "$HOME/.config/opencode/skills" \
    "$HOME/.cursor/skills" \
    "$HOME/.claude/skills"
  do
    [ -d "$candidate" ] && SKILLS_ROOT="$candidate" && break
  done
fi

# 2. Check for a pointer written at install time
FRAMEWORK_REPO=""
if [ -n "$SKILLS_ROOT" ]; then
  FRAMEWORK_REPO=$(cat "$SKILLS_ROOT/.source-repo" 2>/dev/null || true)
fi

# 3. If not found, find the git repo that owns the installed SKILL.md via inode match
if [ -z "$FRAMEWORK_REPO" ] && [ -n "$SKILLS_ROOT" ]; then
  INODE=$(stat -c '%i' "$SKILLS_ROOT/improve-framework/SKILL.md" 2>/dev/null)
  FRAMEWORK_REPO=$(find ~/app-workspaces ~/workspace ~/projects ~ -maxdepth 3 -name "SKILL.md" 2>/dev/null \
    | while read f; do
        [ "$(stat -c '%i' "$f" 2>/dev/null)" = "$INODE" ] && git -C "$(dirname $(dirname $f))" rev-parse --show-toplevel 2>/dev/null && break
      done)
fi

# 4. Still not found — prompt the user
if [ -z "$FRAMEWORK_REPO" ]; then
  echo "ERROR: Cannot locate svc framework repo. Set FRAMEWORK_REPO manually or run from its directory."
  exit 1
fi

echo "Framework repo: $FRAMEWORK_REPO"
```

Once located, **all subsequent file paths in this skill are relative to `$FRAMEWORK_REPO`**. Read `FRAMEWORK-STATE.md`, write proposals, and commit — all from that directory.

If the framework repo has never been cloned on this machine, clone it before proceeding:
```bash
# Only if Step 0 failed to find it
git clone <framework-remote-url> ~/app-workspaces/seriousvibecoding
FRAMEWORK_REPO=~/app-workspaces/seriousvibecoding
```

## Recursion Guard

The framework lane has a mutual dependency: improve-framework invokes
test-framework for verification, and test-framework routes gaps back through
improve-framework for fixes. To prevent infinite loops:

- **Max depth: 1.** If improve-framework is already running (check for an active
  `proposals/<date>-framework-improvement.md` being written in this session),
  do NOT invoke improve-framework again. Instead, log the gap to
  FRAMEWORK-STATE.md Known Gaps and stop.
- **No re-entry from test-framework replay.** When Step 6 invokes test-framework
  for replay verification, test-framework MUST NOT route any new gaps back
  through improve-framework. It reports them in the replay output only.
  Pass `--no-self-improve` context to the replay invocation.

## The Loop

```
FRAMEWORK-STATE.md → evidence → diagnosis → [external comparison] →
implementation → replay verification → update FRAMEWORK-STATE.md
```

This skill does NOT do the work itself. It orchestrates existing skills:

| Role | Skill | What it does in this loop |
|---|---|---|
| Evidence engine | `test-framework` | Produce proof of failure, regression, or inefficiency |
| Diagnosis engine | `evolve-framework` | Convert evidence into ranked, actionable proposals |
| External delta | `blend-external` | Import patterns for a specific gap (not open-ended) |
| Implementation | `quick-fix` / `create-skill` / normal pipeline | Apply the fix |
| Replay verifier | `test-framework` | Prove the fix closed the gap |
| Memory | `FRAMEWORK-STATE.md` | Record what was found, fixed, deferred, locked |

## Process

### Step 1: Load Framework Memory

Read `FRAMEWORK-STATE.md` first. This tells you:
- What was already analyzed (don't rediscover)
- What was already fixed (don't re-propose)
- What was intentionally deferred (don't re-raise without new evidence)
- What decisions are locked (don't re-litigate)

Also read `references/knowledge/svc/CAPABILITIES.md` — our own capabilities
in structured format. This is what you're improving.

### Step 1.5: Check for Pending Proposals

Before gathering new evidence, check for actionable work already planned:

```bash
# List proposals, but skip any marked BLOCKED
# (a BLOCKED proposal has "**Status:** BLOCKED" in the first 20 lines)
for f in proposals/*.md; do
  [ -f "$f" ] || continue
  head -20 "$f" | grep -qE "^\*\*Status:\*\*\s*BLOCKED" && continue
  echo "$f"
done
```

Then run the proposal SLA gate before selecting work:

```bash
bash test-framework/evals/tier-1/validate-proposal-triage-sla.sh
```

The gate requires every direct `proposals/*.md` file that has reached the
`proposals/triage.json` `max_open_days` window to carry one disposition:
`accepted_wi`, `backlog_wi`, `rejected_reason`, or `deferred_until` metadata.
Use `backlog_wi` plus a reason for an open proposal already owned by a real WI;
this records unfinished work and never authorizes dispatch or overrides a freeze.
Do not combine it with another disposition. Use `accepted_wi` only for formal
promotion with the existing archive, residual-map, and ledger closeout. Metadata may
live in the proposal body or in `proposals/triage.json`. `proposals/done/` is
outside the open-proposal SLA because implemented proposals belong there.

Before selecting a `backlog_wi` proposal, read that WI and its dependencies.
Preserve freezes and explicit do-not-dispatch instructions. A backlog pointer
is not a new execution authorization; follow the current task scope and priority.
Do not start an unrelated backlog item merely because its proposal is present.

If applicable pending (non-BLOCKED) proposals exist (blend plans, evolution proposals, improvement records
not yet implemented), they ARE the evidence — skip Step 2 and Step 3 and route
directly to Step 5 (Pick Implementation Route).

A pending proposal means a previous skill (blend-external, evolve-framework)
already did the analysis and diagnosis. Re-diagnosing is wasted work. Implement
the plan that's already there.

**Proposal lifecycle statuses:**
- `DRAFT` or no status — actionable, pick up in Step 1.5
- `BLOCKED` — intentionally held; skip in Step 1.5. A BLOCKED proposal states why it's blocked (open scope question, waiting on user decision, waiting on upstream work) in a "Why BLOCKED" section. It stays in `proposals/` (not moved to `done/`) until unblocked. To unblock: remove the `**Status:** BLOCKED` line.
- `IMPLEMENTED` — move to `proposals/done/` per Step 6b.

**Placeholder rules audit (lightweight):**
While scanning pending work, also check for stale placeholder rules:

```bash
python3 -c "
import json
m = json.load(open('skills-manifest.json'))
for e in m.get('rulesRegistry', {}).get('entries', []):
    if e.get('source') == 'local' and e.get('last_evaluated') is None:
        print('Placeholder rule:', e.get('path'))
"
```

If any placeholder rules are found, emit a one-line reminder in the output summary. They are not blocking — just visibility.

**If multiple pending proposals exist:** ask the user which to implement, or pick
the one most recently created.

**If only BLOCKED proposals exist:** treat as if no pending proposals — continue to Step 2.

**If no pending proposals exist:** continue to Step 2.

### Step 2: Gather Evidence

Choose ONE source of evidence (not all at once):

| Source | When to use |
|---|---|
| Pending proposals in `seriousvibecoding/proposals/` | A blend plan or evolution proposal exists — implement it (Step 1.5 catches this) |
| `test-framework/results/` (existing) | Recent test run found failures — start from those |
| Fresh `test-framework` run | No recent results, or results are stale (> 7 days) |
| User-reported issue | User describes a specific framework problem |
| Codex / cross-model review | External review identified contract issues |
| Blend source update | A tracked source (GSD, gstack, etc.) has a new SHA |

**If no evidence exists and none is provided:** run `test-framework` to generate it.
Don't diagnose without evidence.

### Step 3: Diagnose with evolve-framework

Invoke `evolve-framework` with the evidence. It reads FRAMEWORK-STATE.md
(required input) and produces a ranked shortlist:

For each gap:
- Exact problem and affected skills/files
- Category: drift | fragility | inefficiency | missing capability
- Severity: high | medium | low
- Whether it's already in FRAMEWORK-STATE.md known gaps

**Filter:** remove anything already in FRAMEWORK-STATE.md as fixed or locked.
Only surface genuinely new findings or deferred items with new evidence.

### Step 4: Decide if External Comparison is Needed

Invoke `blend-external` ONLY if:
- The gap looks like a known solved pattern elsewhere
- The framework lacks a convincing internal answer
- The change is architectural enough to benefit from comparative evidence

**Do NOT run broad external blending.** Scope blend-external to the specific
gap: "Does GSD/gstack/superpowers solve X? How?" — not "What else can we take?"

Check `references/knowledge/INDEX.md` before cloning. If the source's Layer 2
already covers the gap, read that instead.

### Step 5: Pick Implementation Route

| Gap type | Route | Why |
|---|---|---|
| Wording/contract drift across a few files | `quick-fix` | Fast, low-risk, no pipeline overhead |
| Isolated skill surgery (new self-verify check, new reference) | Direct SKILL.md edit | Skill-level change, test-framework replays |
| New skill needed | `create-skill` | Full skill creation with eval |
| Larger pipeline/framework change | Normal svc pipeline on THIS repo | Spec → design → plan → execute → review |

**Host Capability Verification Gate (MANDATORY before any host-specific implementation):**

If the implementation route touches host integration surfaces — hooks, MCP, task graph, model routing, UI paradigms, Background Tasks, or any host-specific API — invoke `research` to verify current host documentation BEFORE proceeding. Do NOT rely on training data for host API capabilities.

This gate is non-negotiable. The `rules/host-capability-research.md` correction rule enforces it. Violating this gate is a framework-breaking deviation.

**Plan-Changeset Discipline Gate (risk-based, not size-based):**

Apply `rules/plan-changeset-trigger.md` before implementation. The old size-only rule (`>2 files` or `>50 lines`) is superseded: size is an audit signal, not a mandatory trigger. Route by semantic risk and explicit exemptions.

If the implementation matches any risk signal in `rules/plan-changeset-trigger.md`, it MUST go through the normal svc pipeline on THIS repo, regardless of size:

```
write-spec → design-ux (if UI) → design-tech → plan-changeset → execute-changeset (in worktree) → review-gate → land-changeset
```

Framework skills are NOT exempt from planning discipline. Reactive quick-fixes on framework infrastructure cause:
- Validator failures (missing boilerplate, broken contracts)
- Content loss (progressive-disclosure refactors dropping required sections)
- Silent drift (hooks wired incorrectly, lane definitions misaligned)

| Change class | Required route | Why |
|---|---|---|
| Explicit exemption in `rules/plan-changeset-trigger.md` | `quick-fix` or direct edit with logged rationale | Avoid ceremony that catches nothing |
| Risk signal in `rules/plan-changeset-trigger.md` | Normal svc pipeline on THIS repo | Spec + plan + worktree + review prevent framework degradation |
| Large but exempt documentation/additive patch | Direct edit allowed, but log why the exemption applies | Size alone is not a correctness proxy |
| Small but hot-path/contract patch | Normal svc pipeline | Small changes can still alter framework behavior |
| New skill | `create-skill` | Full skill creation with eval |
| Refactor moving > 10% of SKILL.md lines | Normal pipeline + `verify-skill-refactor.mjs` | Content-preservation gate |

**Dogfooding is the goal.** Use svc to improve svc.

**For normal pipeline route:** treat the svc repo itself as the project.
Write a feature spec for the framework change, plan it, execute it in a
worktree, review it, land it. Dogfooding.

**svc-on-svc routing rules:**
- If the framework behavior is broken or regressed, route to `diagnose-bug` first, not `write-spec`
- If the framework is gaining a new capability, route to `write-spec`
- After `design-tech`, run `explore-solutions` whenever the framework change introduces a hard-to-reverse architecture decision (new persistence model, new host abstraction, new external dependency, new state backend)
- Use `route-workflow`'s Framework Self-Management Policy as the source of truth for deciding between `diagnose-bug`, `improve-framework`, and the normal product pipeline

### Step 5.5: Refactor-Specific Safety Check (MANDATORY when touching SKILL.md)

When the implementation modifies any existing `*/SKILL.md` file AND the change removes > 10% of the file's lines OR moves content to `references/*.md` (progressive-disclosure refactor), run the content-preservation verifier BEFORE committing:

```bash
node scripts/verify-skill-refactor.mjs <skill-name> <pre-refactor-git-ref>
# Exit 0 required before commit. Exit 1 means content was lost.
```

This catches the Gemini slim-refactor failure mode archetype (WI-071, commit `4c36a4e`) where 1767 net lines of contract content were silently dropped. The verifier's exit code is a hard gate — do not commit with exit 1 unless the deletion is intentional AND documented in `FRAMEWORK-STATE.md` Decisions with justification.

**Gemini-CLI pre-flight (MANDATORY when running on Gemini):**

Before any SKILL.md refactor or multi-file framework change on Gemini, execute:

1. `du -sh ~/.gemini/tmp/*/chats/*.json 2>/dev/null | tail -1` — check session size
2. If > 2.5 MB: run `/compress`, then re-read `FRAMEWORK-STATE.md` + active WI + active task graph before proceeding (L1 → L4 re-anchor)
3. If > 4 MB: commit WIP, exit session, restart — do NOT proceed with content-sensitive work

Reference: `references/gemini-context-budget.md`. This is framework gap G4 from proposal `2026-04-19-session-audit-gemini-slim-refactor-wi071-and-wi085.md`.

### Step 6: Require Replay Verification

No framework change is "done" until the original gap is replayed.

```
test-framework --replay <original-failing-scenario>
```

If the scenario that triggered the improvement now passes: the fix is verified.
If it still fails: the fix is incomplete — iterate.

If the gap was qualitative (not testable by test-framework): require a
cross-model review or manual verification instead.

### Output Artifact: Improvement Record

Write the proposal artifact to `proposals/<date>-framework-improvement.md` in the **svc framework source repo** (e.g. `seriousvibecoding/`). This is a persistent, git-tracked change to the framework — not a temporary file, not a project artifact.

**You are working in the framework repo, not the current project.** Even when triggered from Example Marketplace or any other project, `improve-framework` makes changes to the framework source. Operate in `seriousvibecoding/` (or whichever repo the skills were installed from). All skill edits, proposals, and `FRAMEWORK-STATE.md` updates go there.

> **The split:**
> - `seriousvibecoding/proposals/` — framework change records (persistent, git-tracked)
> - `seriousvibecoding/FRAMEWORK-STATE.md` — framework memory
> - `seriousvibecoding/<skill-name>/SKILL.md` — the skill files being improved
> - Current project repo `docs/` — project work items, WIs, specs; no framework content here

**Timing:** For quick-fix and direct SKILL.md edit routes, write this record
AFTER implementation (it's a post-hoc record, not a pre-approval proposal).
For normal pipeline routes, write it BEFORE implementation as a plan, then
update with commits/replay results after.

```markdown
# Framework Improvement: <title>

## Evidence
- **Source:** <test-framework result / user report / codex review>
- **Finding:** <exact gap with file:line>
- **Severity:** <high / medium / low>

## Diagnosis
- **Root cause:** <why the gap exists>
- **Category:** <drift / fragility / inefficiency / missing capability>
- **Already in FRAMEWORK-STATE.md?** <yes (deferred) / no (new)>

## Implementation
- **Route:** <quick-fix / create-skill / normal pipeline>
- **Files changed:** <list>
- **Commits:** <SHAs>

## Replay Verification
- **Replay target:** <scenario or check that must pass>
- **Result:** <PASS / FAIL / PARTIAL>
- **Evidence:** <test output or review finding>

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** <what to add>
- **Known Gaps:** <what to move to fixed>
- **Decisions:** <any new locked decisions>
- **Capabilities:** <update svc/CAPABILITIES.md? yes/no>
```

This artifact is machine-checkable. test-framework can verify it has all
required sections. Replay target must exist and must pass.

### Step 6b: Move Proposal to Done

After replay verification passes and all changes are committed:

```bash
# run from the seriousvibecoding framework repo
mv proposals/<date>-framework-improvement.md proposals/done/
git add proposals/done/<date>-framework-improvement.md && git commit -m "improve-framework: mark proposal done"
```

Proposals live in `proposals/` while pending. Once implemented and verified, they move to `proposals/done/` and are committed. Do NOT leave implemented proposals in `proposals/` — that directory should only contain actionable pending work.

### Step 6c: Sync to Remote — MANDATORY BEFORE DECLARING DONE

Committing locally without pushing creates a silent backlog — future `improve-framework` runs stack on top of unpushed work, and collaborators/other machines never see the change. Push as the final act of the loop.

```bash
# Run from the framework repo after Step 6b commit.
# Check unpushed work first so you can report it honestly.
UNPUSHED=$(git log --oneline @{u}..HEAD 2>/dev/null | wc -l)
if [ "$UNPUSHED" -gt 1 ]; then
  echo "NOTE: pushing $UNPUSHED commits (includes $((UNPUSHED-1)) from prior unpushed runs)"
fi
git push origin main
```

**Classify the rejection before giving up.** Not all push failures are equivalent — some have deterministic, safe, in-scope recoveries:

| Failure mode | Allowed autonomous recovery | Forbidden |
|---|---|---|
| Non-fast-forward (upstream moved) | `git fetch` + `git pull --rebase origin main` ONCE, retry push. If rebase conflicts, stop and report. | `git push --force`, `git push --force-with-lease` (never without explicit user directive) |
| Branch protection (main requires PR) | Create branch `skills/improve-framework/<date>-<slug>`, push, open PR with proposal as body | Silently switching default branch, disabling protections |
| Auth failure (`Repository not found`, 401/403, "authentication required") | `gh auth switch` to the account encoded in the remote URL — see pattern below | Creating new auth, `gh auth login`, prompting user interactively, swapping to an account not already in `gh auth status` |

**Auth-failure recovery (allowed autonomous pattern):**

When `git push` fails with `remote: Repository not found`, `authentication required`, or HTTP 401/403 — the cause is almost always an account mismatch. The active `gh auth` account doesn't own (or can't see) the remote repo. Switching to the account that DOES own it is safe and deterministic: no data loss, no history rewrite, no branch change. Do it before reporting failure.

```bash
# 1. Extract expected owner from the remote URL (handles https + ssh forms)
REMOTE_URL=$(git remote get-url origin)
EXPECTED_OWNER=$(echo "$REMOTE_URL" | sed -E 's|.*github\.com[:/]([^/]+)/.*|\1|')

# 2. Existence check — account must already be in `gh auth status`. Never create new auth.
gh auth status 2>&1 | grep -q "account $EXPECTED_OWNER" || {
  echo "AUTH RECOVERY SKIPPED: $EXPECTED_OWNER not in gh auth status — stopping and reporting"
  exit 1
}

# 3. Capture current active account so we can restore after push
PREVIOUS_OWNER=$(gh auth status 2>&1 | grep -B1 "Active account: true" | grep "Logged in" | sed -E 's|.*account ([^ ]+) .*|\1|')

# 4. Switch, retry push ONCE, restore previous account
gh auth switch --user "$EXPECTED_OWNER" && git push origin main
PUSH_EXIT=$?
[ -n "$PREVIOUS_OWNER" ] && gh auth switch --user "$PREVIOUS_OWNER" 2>/dev/null || true

# 5. If push still failed after switch, stop and report both attempts
[ "$PUSH_EXIT" -eq 0 ] || { echo "AUTH RECOVERY FAILED after switch to $EXPECTED_OWNER"; exit 1; }
```

**Hard safety rules for auth-switch recovery:**

- **Deterministic match only.** Owner extracted from the remote URL. No guessing, no scanning for "probably correct" accounts.
- **Existence check first.** `gh auth status` must already show the account. Never run `gh auth login`, never prompt interactively, never create new credentials.
- **Try once.** If the switch succeeds but the push still fails, stop and report — don't cycle through multiple accounts.
- **Restore previous account after push.** The terminal must not be left in an unexpected active-account state for subsequent commands.
- **Report what happened.** Final output must name the account that owned the successful push so the user can audit.

**Fallback:** if the auth-switch recovery also fails (e.g., the expected account exists locally but lacks push permission on the remote), stop the loop and report both the initial failure AND the switch attempt.

**Still forbidden under all conditions:** force-push (any variant) without explicit user directive, silent branch switch, disabling branch protections, creating new accounts, modifying `~/.gitconfig`, changing remote URLs silently, `gh auth login` inside this recovery.

**Other guardrails:**

- If the repo uses PR-only flow (main is protected): create branch `skills/improve-framework/<date>-<slug>`, push, and open a PR with the proposal as the PR body. Do not declare the loop done until the PR is opened (merging remains the user's call).
- Report the remote SHA + unpushed count in the final output so the user can see what landed. If auth-switch was used, name the account that owned the successful push.

### Step 7: Mutate Framework Memory

Update ALL state artifacts — not just FRAMEWORK-STATE:

1. **FRAMEWORK-STATE.md:**
   - Add to Analysis History: what was found and what was done
   - Move from Known Gaps to Analysis History: if a deferred gap was fixed
   - Add to Decisions Made: if the fix involved a design choice
   - Update Current State: if skill count, gate count, etc. changed

2. **`references/knowledge/svc/CAPABILITIES.md`** — if the fix added new
   capabilities, add them. This is how svc knows what it IS.

3. **`references/blend-registry.json`** — if the improvement came from a
   blend, add the source entry with patterns_taken and patterns_skipped.

4. **Source proposal** — mark the proposal as IMPLEMENTED with date + commit SHA.
   Add `**Status:** IMPLEMENTED (date, commit SHA)` to the proposal header.
   Move it to `proposals/done/` (Step 6b).

5. **NOTICES** — if patterns were taken from an external source, credit it.

## Routing Logic

```
If issue is skill contract mismatch:
  → quick-fix or direct SKILL.md edit

If issue is lane/order/gate drift:
  → normal pipeline (this is a framework-level change)

If issue is benchmark regression without clear cause:
  → test-framework first → evolve-framework → diagnose

If issue is "others do this better":
  → blend-external (targeted) → evolve-framework → implement

If issue is already deferred in FRAMEWORK-STATE.md:
  → report that. Stop unless new evidence changes priority.

If issue is already fixed in FRAMEWORK-STATE.md:
  → skip. Do not rediscover.
```

## Non-Goals

- This skill does NOT freeform-edit the framework. It orchestrates.
- This skill does NOT run broad external blending without a target gap.
- This skill does NOT skip replay verification.
- This skill does NOT fix things that aren't broken (no speculative improvement).

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Evidence gathered | test-framework results or user report exists | |
| 2 | Diagnosis produced | evolve-framework output with ranked gaps | |
| 3 | Implementation route chosen | quick-fix / create-skill / pipeline identified | |
| 4 | Replay verification passed | test-framework confirms fix OR cross-model confirms | |
| 5 | FRAMEWORK-STATE.md updated | analysis history, known gaps, decisions current | |
| 6 | svc CAPABILITIES.md updated | new capabilities reflected (if any added) | |
| 7 | Blend registry updated (if blend) | `grep <source> references/blend-registry.json` | |
| 8 | Proposal moved to done | `test -f proposals/done/<date>-*.md` in seriousvibecoding (Step 6b moves + commits it) | |
| 9 | NOTICES updated (if external source) | `grep <source> NOTICES` | |
| 10 | Commits pushed to remote | `git log @{u}..HEAD` returns empty OR a PR URL was reported to the user | |

## Phase Receipt Contract

When running in task-graph mode, emit one receipt per required phase before
marking the `improve-framework` task complete. Use the current task id from
`.svc/lane-tasks-<WI>.json`:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-FrameworkRepoAndMemoryLoad --evidence command_output:.svc/improve-framework-repo-memory.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-PendingProposalAndEvidenceSelection --evidence command_output:.svc/improve-framework-evidence.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-DiagnosisAndDuplicateFilter --evidence file:proposals/<date>-framework-improvement.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-ImplementationRouteDecision --evidence command_output:.svc/improve-framework-route.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-ImplementationAndReplayVerification --evidence command_output:.svc/improve-framework-replay.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-ImprovementRecordAndStateMutation --evidence file:FRAMEWORK-STATE.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-ProposalDoneAndRemoteSync --evidence command_output:.svc/improve-framework-remote-sync.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P8-SelfVerifyContinuation --evidence command_output:.svc/improve-framework-self-verify.log
```

If a phase is intentionally skipped because the gap is already fixed, deferred,
or blocked, still record that phase id with command-output evidence explaining
the stop condition. Do not complete the task until all required phase ids appear
in `skill_receipt.phases_executed`.

## Pipeline Continuation

Follow the canonical task-graph chaining contract: see `references/task-graph-chaining-protocol.md`.

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

This skill does not chain progressively. It orchestrates other skills and produces a proposal + verification evidence. The output is the updated FRAMEWORK-STATE.md and any implemented fixes.

## Key Principles

- **Evidence before diagnosis.** Don't guess what's broken — prove it.
- **Diagnosis before implementation.** Don't fix symptoms — find root causes.
- **Targeted external comparison.** Import for a gap, not for exploration.
- **Replay before done.** The gap that triggered the loop must be re-tested.
- **Memory is mandatory.** Every loop iteration updates FRAMEWORK-STATE.md.
- **Dogfooding is the goal.** Use svc to improve svc.

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
