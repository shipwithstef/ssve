# Framework Evolution — 2026-06-15 (landing-audit derived)

**deferred_until**: 2026-08-25
**reason**: Survey proposal, not a single-fix brief. Its two concrete carried gaps already landed — the port/convert parity-baseline rule (commit "improve-framework(F1m)") and the route-side Deploy-Source Provenance Gate (commit "improve-framework(F4 route-side)"). Re-triaged 2026-06-29: prior deferral lapsed. A SEPARATE freshness-gate root cause found this session — hooks resolving `.svc/` runtime state against cwd, polluting `/tmp/.svc` — is captured as WI-452; this is NOT F3. The surveyed gaps F2/F3/F5 remain backlog-sequenced to `improve-framework` (F3 = `svc-task-completion-guard.sh` reads the contract's last `session-contract.jsonl` line without a session-ownership check — still untracked by a dedicated WI, intentionally deferred here).
**blocked_reason**: Remaining surveyed gaps route to `improve-framework` one fix-brief per run per the evolve↔improve scope boundary; they are sequenced behind the active backlog, not abandoned.

## Method
Scoped evolution survey validating the framework-domain findings of the session
audit `example-marketplace/proposals/2026-06-15-session-audit-landing-hero-restore.md`
(landing-hero-restore run). Each candidate gap was validated against the real
framework state, not the audit's claims:
- `FRAMEWORK-STATE.md` (388 lines) grepped for each topic — dedup.
- `references/framework-learnings.jsonl` — related learnings (foreign-claim,
  baseline, deploy).
- The live hook `hooks/svc-task-completion-guard.sh` and `route-workflow/SKILL.md`
  read for the exact contract text.
Only gaps that survived dedup are carried. This is a SURVEY; per the
evolve↔improve scope boundary it contains NO per-leaf fix briefs. Each carried
gap routes to `improve-framework` for a single fix brief.

Source run context: a port-repo parity question answered against the wrong
baseline, then a frontend restore committed in a shared checkout shared with a
concurrent session and deployed straight to prod from an unmerged branch. Five
candidate gaps (F1m, F2, F3, F4, F5).

## Findings (by priority)

### P1 — Fix soon (degrades quality / safety)

#### F3 — `end_to_end` Stop-guard reads the contract's last line with no session-ownership check  `[Drift]` `[host-capability-drift]`
- **Evidence:** `hooks/svc-task-completion-guard.sh` `readLastContract()` (lines
  ~138-148) returns `JSON.parse(lines[lines.length-1])`; `check_end_to_end_stop`
  (~214-219) blocks on `contract.execution_mode === "end_to_end"`. No session-id
  match. In the source run, a concurrent QA session's `WI-QA-VISUAL-01`
  `end_to_end` contract line was the last line of the shared
  `.svc/session-contract.jsonl`, so the guard fired 4× inside a different session.
- **Validated relevant / NOT a duplicate:** learning
  `completion-guard-foreign-claim-resolution` (conf 9, files
  `resolve-wi.mjs`/`wi-claim.mjs`) already fixed the foreign-session principle for
  the **claim-resolution** path; the **`readLastContract`/`end_to_end`** path was
  never touched. `FRAMEWORK-STATE.md:102-112` fixed only the stale *suppressed-WI*
  path. This is a new, unfixed manifestation of a known class.
- **Category:** Drift (the established "match session ownership before acting on
  foreign state" principle is applied inconsistently across the guard's paths).
- **Routes to:** `improve-framework` → one fix brief: extend session-ownership /
  staleness check to `readLastContract`/`end_to_end`; foreign or owned-elsewhere
  latest contract entry ⇒ advisory, not block. Requires `research` verification
  (hook behavior) before implementation.

#### F4 — No pre-deploy gate that production originates from merged source  `[Gap]`
- **Evidence:** `route-workflow/SKILL.md:148` Publication-State Closeout only
  *reports* `origin/main…HEAD` divergence and is scoped to "mutating framework
  work on `main`"; `:140` requires a closeout classification. Neither **blocks** a
  deploy that builds from an unmerged working tree. In the source run,
  `deploy/deploy-frontend.sh prod` (a project script using `wrangler pages deploy
  dist --branch main`) shipped prod from branch `chore/import-legacy-knowledge`;
  the deployed commit is on no remote and `origin/main` lacks it — a clean-`main`
  redeploy would silently revert prod.
- **Validated relevant:** zero hits for deploy-merged-gate / ancestor checks in
  `FRAMEWORK-STATE.md`. The existing publication-state closeout is report-only and
  framework-scoped, so it does not cover product deploy-affecting runs.
- **Category:** Gap. Framework angle = a generic "deploy-affecting run must verify
  `HEAD` is an ancestor of `origin/main` (or carry an explicit override decision)"
  obligation in route-workflow's deploy-affecting closeout. The project-side
  `deploy-frontend.sh` refusal/warning is a **project** corrective (see Non-
  Framework Corrections), not framework.
- **Routes to:** `improve-framework` → fix brief for the route-workflow
  deploy-affecting closeout addition. >2 files / >50 lines likely ⇒ must go
  through `write-spec → plan-changeset → execute-changeset`.

### P2 — Improve when possible

#### F2 — Shared-checkout / shared git-index commit safety is unguarded  `[Fragility]` `[host-capability-drift]`
- **Evidence:** no hits for `shared-checkout|concurrent-session|shared-index|
  git add -A|pathspec` in `FRAMEWORK-STATE.md`. WI-claim files prevent dual *WI*
  claims, but nothing protects the shared **git index** when two sessions share
  one working directory. In the source run a `git add <paths>` + `git commit`
  swept a concurrent session's staged `public/.well-known/assetlinks.json` into the
  commit (index race); recovered via `reset --soft` + explicit-pathspec recommit.
- **Validated relevant / new:** the project memory `concurrent-session-shared-
  checkout` exists but is project-local; no framework-level guard or contract.
- **Category:** Fragility. Framework angle = when a concurrent session is detected
  (foreign fresh claim / second active session on same cwd), require
  explicit-pathspec commits, forbid `git add -A`/`git add .`, warn before
  branch-affecting ops.
- **Routes to:** `improve-framework` → fix brief (hook + route-workflow note).
  Touches hooks ⇒ `research` verification required.

#### F1m — No comparison-baseline resolution for port/convert parity & visual-diff  `[Gap]`
- **Evidence:** the source run answered "do the landing images differ from the
  original?" by diffing the port against the **deployed** product (`example-marketplace.app`),
  which already serves the port build — a guaranteed false "parity" result;
  corrected only after 3 user pushbacks, when the **legacy source repo** was finally
  consulted. The five `baseline` learnings in `framework-learnings.jsonl` concern
  visual-asset *deploy capture* and knowledge decay — none establishes "for a
  cut-over port, the comparison baseline is the legacy source repo, never the
  deployed product."
- **Validated relevant / new** (this is the audit's agent-fault F1 converted to a
  mechanical framework gap per svc philosophy — "be more careful" is not a fix).
- **Category:** Gap. Framework angle = a baseline-resolution step/checklist line in
  the verification/parity path (route-workflow or the relevant verify skill):
  resolve `original = legacy source repo` (from `parity_verification_results.md`
  or a `source_repo` pointer); explicitly note that a cut-over port's deployed prod
  is NOT the original.
- **Routes to:** `improve-framework` → small fix brief (likely ≤2 files).

#### F5 — route-workflow does not mechanically enforce its own mutating+deploy lane obligations  `[Drift]`
- **Evidence:** `route-workflow/SKILL.md:140` already *requires* a closeout
  classification for "mutating, deploy-affecting … runs," and the skill mandates
  WI / lane-tasks / decision-log. The source run performed a diagnosis→edit→prod
  deploy with **none** of these (0 decision-log rows for the run; no
  `lane-tasks-*`), and nothing blocked it.
- **Validated relevant but LOW novelty:** the contract EXISTS; the gap is purely
  enforcement. Per svc philosophy an unenforced contract is a framework gap, but
  this overlaps the broader Phase-receipt / Stop-hook-enforcement program already
  tracked in `FRAMEWORK-STATE.md:264` (WI-191/213, "gate flip + Stop hook
  enforcement").
- **Category:** Drift / partially-tracked. Recommend FOLDING into the existing
  WI-213 enforcement track rather than a standalone fix, to avoid a duplicate
  enforcement mechanism.
- **Routes to:** `improve-framework` only if not absorbed by WI-213; otherwise
  annotate WI-213 scope.

### P3 — Track (not actionable yet)
- None. All five are actionable.

## Comparison delta
No competitor-capability delta surfaced by this run; the gaps are svc-internal
(hook session-isolation, deploy provenance, shared-checkout concurrency). Not
applicable.

## Stale proposal audit
Did not re-survey the full `proposals/` backlog (scope = the five audit-derived
gaps). One adjacency noted: F5 overlaps the open WI-191/WI-213 phase-receipt
Stop-hook enforcement track (`FRAMEWORK-STATE.md:264`) — fold, don't duplicate.

## Routing summary
| Gap | Category | Priority | Verdict | Next |
|---|---|---|---|---|
| F3 e2e-guard session ownership | Drift / host-cap | P1 | relevant, new path | improve-framework (+research) |
| F4 deploy-from-merged gate | Gap | P1 | relevant, new | improve-framework → write-spec |
| F2 shared-checkout commit guard | Fragility / host-cap | P2 | relevant, new | improve-framework (+research) |
| F1m port-parity baseline resolution | Gap | P2 | relevant, new | improve-framework |
| F5 mutating+deploy enforcement | Drift | P2 | relevant, low-novelty | fold into WI-213 |

## Non-Framework Corrections (do NOT enter the framework funnel)
- The port's `deploy/deploy-frontend.sh` ancestor-of-`origin/main` refusal is a
  **project** hardening for example-marketplace.
- The live prod-vs-`origin/main` drift from the source run is a **project ops**
  action (cherry-pick `26ad5e5` → PR → merge → reconcile), tracked in the session
  audit, not here.
- The original base44→local hero-image swap was a **project** porting defect
  (already fixed by the source run).
