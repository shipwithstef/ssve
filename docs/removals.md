# Removals and rejections

Every part of the framework that is removed, or a proposal that is rejected, is recorded here, so nothing disappears without its reason. Each entry says what the thing existed for, the evidence that it added no value or made results worse, and what now delivers its intent, if anything. The test for keeping anything is the end result: it must make what the user gets measurably better than a bare model, or guarantee that a technique which does so actually ran.

Entry format (checked by `test-framework/evals/tier-1/validate-removals-ledger.mjs`):
`## <name>` then the lines `- **Kind:**`, `- **Existed for:**`, `- **Evidence:**`, `- **Why removed:**`, `- **Intent now delivered by:**`, `- **Date / record:**`, and `- **Reintroduction check:**`.

The reintroduction check is either `pattern: /regex/ in <path prefix>[, <path prefix>]` (one or more, separated by ` ; `), which the validator runs over tracked files and fails on any match, or `review: <what a reviewer should look for>` when no pattern can catch it. review-plan and review-exec read this file and refuse a change that brings back a recorded failure without new evidence.

## Five-layer agent-slot configuration (proposal)
- **Kind:** rejected design
- **Existed for:** letting every agent slot (model, effort, host, tools) be configured without code changes and adjusted per planner or orchestrator decision.
- **Evidence:** adversarial review of `docs/decisions/2026-10-11-reviewer-ladder.md` (finding 9): `resolve-dispatch.mjs` already has an owner-protected policy, a per-WI work overlay (`parseOverlay`) and a receipt-gated session override; the proposed `.svc/slots*.json` and `SVC_SLOT_*` layers sat above the owner layer and were agent-writable, so they could override owner `deny` rules; "skip a malformed layer" would have silently dropped a malformed owner policy's deny rules.
- **Why removed:** it duplicated existing machinery and weakened owner authority.
- **Intent now delivered by:** the existing layers, plus one fix: a missing owner file falls back to registry defaults instead of failing.
- **Date / record:** 2026-10-11, reviewer-ladder decision, "Adversarial review".
- **Reintroduction check:** pattern: /\.svc\/slots(-[^"'`\s]*)?\.json|SVC_SLOT_[A-Z]/ in scripts/, hooks/, bin/

## Reviewer rungs 2 and 3 with a model-strength order (proposal)
- **Kind:** rejected design
- **Existed for:** choosing a same-family reviewer stronger than the model that did the work.
- **Evidence:** review finding 4: registry ids do not order cleanly across generations (Opus 4.8 vs Sonnet 5.5), Fable was missing, alias tuples fail the launcher's exact-model check (`model_mismatch`), and the executor's model is declared, not observed.
- **Why removed:** the guarantee it promised could not be verified.
- **Intent now delivered by:** one rung: the family's pinned top model at effort ≥ high with server-observed model attestation.
- **Date / record:** 2026-10-11, reviewer-ladder decision.
- **Reintroduction check:** pattern: /strength_order/ in scripts/, references/model-registry.json

## Reviewer-availability probe file as gate evidence (proposal)
- **Kind:** rejected design
- **Existed for:** proving that no different-family reviewer was available before falling back.
- **Evidence:** review finding 3: an agent can hand-write the file or run the probe with a stripped PATH; a 24-hour cache is stale; "auth unproven" was undefined; Cursor is family `multi` and cannot be independent.
- **Why removed:** forgeable evidence is no evidence.
- **Intent now delivered by:** the launcher attempts the different-family reviewer itself; its signed, classified failure receipt is the proof.
- **Date / record:** 2026-10-11, reviewer-ladder decision.
- **Reintroduction check:** pattern: /reviewer-availability\.json/ in scripts/, hooks/

## Profile- and zone-based acceptance of same-family review (proposal)
- **Kind:** rejected design
- **Existed for:** letting prototype and MVP work pass the chain with a same-family review while production kept cross-family review.
- **Evidence:** review findings 1 and 2: `delivery_profile` is the planner's own argument and the graph file is agent-writable; zones come from planner-declared files and the path pattern misses oauth, jwt, rbac, Prisma schemas and release workflows.
- **Why removed:** a gate that trusts the author's own declaration can be bypassed by declaring `mvp`.
- **Intent now delivered by:** same-family review lets work proceed but never authorises promotion; promotion needs cross-family review or the owner's explicit, owner-protected acceptance.
- **Date / record:** 2026-10-11, reviewer-ladder decision.
- **Reintroduction check:** review: a gate that accepts same-family review based on delivery_profile, irreversible_zones or any other value the planner writes

## Read-only (no Bash) same-family reviewer (proposal)
- **Kind:** rejected design
- **Existed for:** making sure a reviewer cannot change the code it reviews.
- **Evidence:** review finding 5: the reviewer prompt requires shell reads and failing-test proofs for blocking findings (`run-external-review.mjs:462-463`); without Bash every blocking finding drops to advisory and the review is marked incomplete. `--allowedTools` only pre-approves tools and restricts nothing.
- **Why removed:** it would have weakened every review it was meant to protect.
- **Intent now delivered by:** `--tools Read,Grep,Glob,Bash --permission-mode plan` plus the tree-unchanged check the codex host already runs.
- **Date / record:** 2026-10-11, reviewer-ladder decision.
- **Reintroduction check:** review: a claude review transport launched without Bash or without --permission-mode plan and the tree-unchanged check

## Main-module checks that compared unresolved paths (64 files)
- **Kind:** removed code
- **Existed for:** running a script's command-line entry only when the file is executed directly, not when it is imported.
- **Evidence:** run through the install symlinks, as every user project does, `compile-delivery-graph.mjs` printed nothing and exited 0 (2026-10-11 simulated fresh-project path); 64 files used `import.meta.url === file://${process.argv[1]}` or an unresolved `path.resolve` variant.
- **Why removed:** in user projects these scripts silently did nothing while reporting success.
- **Intent now delivered by:** `scripts/lib/is-main.mjs` (compares real paths), guarded by `validate-install-symlink-entry.mjs`.
- **Date / record:** 2026-10-11, commit fcf04a9.
- **Reintroduction check:** pattern: /import\.meta\.url === `file:\/\/\$\{process\.argv\[1\]\}`|process\.argv\[1\] === fileURLToPath\(import\.meta\.url\)/ in scripts/, hooks/, bin/

## Failing when the owner dispatch policy file is missing
- **Kind:** removed behaviour
- **Existed for:** making sure model routing and reviewers come only from a policy the owner wrote, never from a silent default (WI-552 "fail closed, never silently remapped").
- **Evidence:** a fresh install has no `~/.svc/dispatch-policy.json`, so `resolve-model.sh` (execute-changeset's step 0 and route-workflow's session setup) and every review launch failed with `dispatch_missing_global_file` / `config_invalid` and zero provider calls (2026-10-11 fresh-project simulation and framework-arm eval run). No user without an owner file could run the chain or get any review.
- **Why removed:** it blocked every new user without protecting anything an owner had chosen.
- **Intent now delivered by:** `references/default-dispatch-policy.json`, used only when the default owner path is absent and labelled `framework-default-policy` in every answer; it carries no release authority. An owner file that is present but invalid, or a policy path that is named and missing, still fails closed (`validate-fresh-project-path.mjs`, `validate-kimi-host.sh`).
- **Date / record:** 2026-10-11, reviewer-ladder decision step 1.
- **Reintroduction check:** review: a change that makes resolve-dispatch or review-topology-v2 fail again when the default owner path is simply absent

## svc-vibe-auditor (Claude PostToolUse hook)
- **Kind:** removed hook
- **Existed for:** starting a visual diff (`npx skills run track-visuals --mode diff`) after UI file edits so design regressions surface early.
- **Evidence:** 2026-10-11 hook audit (/tmp/hook-audit): the script only acts when `event_name === 'AfterTool'` and `tool_name === 'write_file'`, which Claude Code never sends (it sends `hook_event_name: PostToolUse`, `tool_name: Edit|Write`), so in every measured Claude session it did nothing except cost a node spawn (135-155 ms per Edit/Write). Had it fired, it would have run `npx` synchronously and could download a package.
- **Why removed:** dead on the only host that wired it, and unsafe if it ever fired.
- **Intent now delivered by:** visual verification through the browse/visual QA skills when a change touches UI; nothing automatic.
- **Date / record:** 2026-10-11, hook audit (branch hook-audit-fixes).
- **Reintroduction check:** pattern: /svc-vibe-auditor/ in scripts/wire-, hooks/hooks.json, references/host-hook-catalog.json, references/canonical-gates.json

## svc-session-end-log (SessionEnd hook, all hosts)
- **Kind:** removed hook
- **Existed for:** appending `{ts, branch}` to `.svc/sessions/sessions.jsonl` at session end "for audit-session-execution" (WI-116 R-1 lifecycle observability).
- **Evidence:** 2026-10-11: no script, skill or hook reads `sessions.jsonl` (grep across scripts/, hooks/, skills/, bin/); audit-session-execution does not open it. It was wired on Claude, Kimi, Gemini and Grok as a spawn per session end.
- **Why removed:** write-only bookkeeping with no reader.
- **Intent now delivered by:** nothing needed; session history lives in the host transcripts and in git.
- **Date / record:** 2026-10-11, hook audit; canonical gate `session-end-log` removed with it.
- **Reintroduction check:** pattern: /svc-session-end-log/ in scripts/wire-, hooks/hooks.json, references/host-hook-catalog.json, references/canonical-gates.json

## svc-notification-surface (Notification hook, all hosts)
- **Kind:** removed hook
- **Existed for:** appending every host notification payload to `.svc/sessions/notifications.jsonl` so guard messages were auditable afterwards.
- **Evidence:** 2026-10-11: no reader of `notifications.jsonl` anywhere in the repo; it was wired on Claude, Kimi and Gemini.
- **Why removed:** write-only bookkeeping with no reader.
- **Intent now delivered by:** denials are already receipted by `hooks/lib/hook-denial.mjs` (durable per-session denial receipts).
- **Date / record:** 2026-10-11, hook audit; canonical gate `notification-surface` removed with it.
- **Reintroduction check:** pattern: /svc-notification-surface/ in scripts/wire-, hooks/hooks.json, references/host-hook-catalog.json, references/canonical-gates.json

## svc-pre-compact-snapshot (PreCompact hook, all hosts)
- **Kind:** removed hook
- **Existed for:** writing `{branch, lane_tasks_files, last_decisions}` to `.svc/sessions/<ISO>.snapshot.json` before compaction so post-compact recovery would be deterministic.
- **Evidence:** 2026-10-11: nothing reads `.svc/sessions/*.snapshot.json`; no recovery path consults it. It was wired on Claude, Kimi and Gemini.
- **Why removed:** the recovery it promised never read its output.
- **Intent now delivered by:** `node scripts/task-graph.mjs checkpoint <graph>` (writes `.svc/.checkpoint-<WI>.checkpoint.json` with the next runnable task; the graph stays the authority on resume).
- **Date / record:** 2026-10-11, hook audit; canonical gate `pre-compact-snapshot` removed with it (the OpenCode plugin's own compaction handler is untouched).
- **Reintroduction check:** pattern: /svc-pre-compact-snapshot/ in scripts/wire-, hooks/hooks.json, references/host-hook-catalog.json, references/canonical-gates.json

## Claude edit accumulator (svc-stop-quality.js --accumulate on PostToolUse)
- **Kind:** removed wiring
- **Existed for:** recording each edited source file so the Stop quality check knew what to check.
- **Evidence:** 2026-10-11 audit: a node spawn on every Edit/Write (190-210 ms) whose only consumer, the Stop check, was skipped in advisory mode (the default), so the list was written and never read; it also needed an existing `.svc/` and so recorded nothing in a plain project.
- **Why removed:** the Stop check now derives the changed files from git (`git status` vs HEAD plus untracked), which is complete without any per-edit process.
- **Intent now delivered by:** `hooks/svc-stop-quality.js --check` (git-derived file set; it still reads a host accumulator file when one exists, which Kimi's wrapper keeps writing).
- **Date / record:** 2026-10-11, hook audit.
- **Reintroduction check:** pattern: /svc-stop-quality\.js --accumulate/ in scripts/wire-hooks.mjs, hooks/hooks.json

## Post-edit learning capture (svc-auto-capture-learnings --trigger post-tool-use)
- **Kind:** removed wiring
- **Existed for:** capturing learning candidates right after each Edit/Write.
- **Evidence:** 2026-10-11 audit: 215-245 ms per Edit/Write (async); the detectors read the git diff of the whole branch, which the Stop and PreCompact captures read anyway; in repos without `origin/main` it printed `fatal: Not a valid object name origin/main` into the session.
- **Why removed:** duplicate of the Stop/PreCompact capture at a per-edit cost.
- **Intent now delivered by:** the same hook at Stop (async) and PreCompact, governed repos only.
- **Date / record:** 2026-10-11, hook audit.
- **Reintroduction check:** pattern: /--trigger post-tool-use/ in scripts/wire-hooks.mjs, hooks/hooks.json

## Stop authorization summary rows with nothing declared, and .svc/ creation in un-opted repos
- **Kind:** removed behaviour
- **Existed for:** recording at Stop which typed authorization-envelope rules a session declared but never used (`stop-authorization-summary` rows in `.svc/authorization-events.jsonl`).
- **Evidence:** 2026-10-11 audit: `recordStopAuthorizationSummary` ran at every Stop in any git repo and created `.svc/authorization-events.jsonl` in a fresh repo; that new `.svc/` flipped the repo into "governed", which turned on dispatcher advice and rule injections (and in enforce mode, session-halting denials plus an unrequested branch and worktree). In this repo it appended `declared:0` rows to a tracked file at every Stop (152 rows, all `declared:0`).
- **Why removed:** a row with nothing declared answers nothing, and no hook may opt a user's repo into the framework.
- **Intent now delivered by:** the summary is still written when the session contract declares typed rules (`validate-authorization-envelope.sh`); the auto-capture hook exits before any work when the repo has no `.svc/`.
- **Date / record:** 2026-10-11, hook audit.
- **Reintroduction check:** review: a Stop or SessionEnd hook that writes into `.svc/` of a repo that has no `.svc/` yet, or a summary row written when no typed authorization rules are declared

## permissionDecision "allow" from the context injectors
- **Kind:** removed behaviour
- **Existed for:** returning "allow + additionalContext" in one PreToolUse response (rule, learning and owner injectors).
- **Evidence:** an injector's `allow` is a permission decision: in enforce mode it is passed through and Claude Code skips its own permission prompt for that Edit/Write/Bash call, although the hooks only meant to add context.
- **Why removed:** adding context must not grant permissions.
- **Intent now delivered by:** `additionalContext` alone (`validate-rule-injection.sh` I2, `validate-learning-injection.sh`, `validate-owner-injection.sh` and `validate-output-discipline-guard.sh` assert no permission decision).
- **Date / record:** 2026-10-11, hook audit.
- **Reintroduction check:** pattern: /permissionDecision\s*[:=]\s*"allow"/ in hooks/svc-rule-injector.mjs, hooks/svc-learning-inject.mjs, hooks/svc-owner-inject.mjs

## Separate injector processes per Edit/Write/Bash (rule-injector-edit/-bash, learning-inject, owner-inject)
- **Kind:** removed wiring
- **Existed for:** delivering subject rules, keyed learnings and owner-routing reminders before an action.
- **Evidence:** 2026-10-11 audit: three node spawns per Edit/Write/Bash (rule injector 200-255 ms, learning 180-210 ms, owner 180-200 ms), each re-reading the payload and the repo state.
- **Why removed:** same intent, one process.
- **Intent now delivered by:** `hooks/svc-rule-injector.mjs` (PreToolUse Edit|Write|Bash) imports `learningContext` and `ownerContext` and runs all three in-process; each part stays disableable by its old id.
- **Date / record:** 2026-10-11, hook audit.
- **Reintroduction check:** pattern: /\$\{hooksDir\}\/svc-(learning|owner)-inject\.mjs/ in scripts/wire-hooks.mjs

## Advisory-mode deferral of the Claude Stop quality check
- **Kind:** removed behaviour
- **Existed for:** not starting a typecheck that could take minutes at every Stop in advisory mode; the boundary printed "automatic Stop quality check deferred" instead.
- **Evidence:** 2026-10-11 audit: this was the only generic format/typecheck of edited files, so in the default mode no session ever got it; the deferral line itself was printed at every Stop.
- **Why removed:** the check is now cheap when nothing changed (one `git status`; a fingerprint cache skips an already-checked file set; only installed checkers run; nothing is downloaded) and reports advice instead of blocking.
- **Intent now delivered by:** `hooks/svc-stop-quality.js --check` in both modes (Kimi's wrapper stays deferred).
- **Date / record:** 2026-10-11, hook audit; `validate-advisory-hook-boundary.mjs` updated.
- **Reintroduction check:** pattern: /svc-\(\?:kimi-\)\?stop-quality/ in hooks/svc-hook-boundary.mjs

## "This project has no .svc/ yet: create it first" nudge at SessionStart
- **Kind:** removed text
- **Existed for:** making sure the framework's project state existed before a skill needed it.
- **Evidence:** it was injected into every session in every project without `.svc/`, including sessions that never use the framework, and pushed the model to initialise framework state the user did not ask for.
- **Why removed:** a plain session must not be steered into framework bookkeeping.
- **Intent now delivered by:** route-workflow's hot path initialises `.svc/` when the framework is actually used; the framework-root path note stays.
- **Date / record:** 2026-10-11, hook audit.
- **Reintroduction check:** pattern: /has no \.svc\/ yet/ in scripts/, hooks/

## Framework learnings preloaded into plain projects
- **Kind:** removed behaviour
- **Existed for:** turning framework learnings into guardrails at session start.
- **Evidence:** 2026-10-11 audit: svc-learning-preload injected about 3.6k chars of framework lore into every product session, including projects that never opted into the framework.
- **Why removed:** framework lore is not useful context for a plain user task.
- **Intent now delivered by:** the same preload in the framework repo and in projects with `.svc/` (`validate-codex-sessionstart-json.sh` asserts both sides).
- **Date / record:** 2026-10-11, hook audit.
- **Reintroduction check:** review: a SessionStart hook that injects framework learnings or lore when the session cwd has no `.svc/` and is not the framework repo

## Completion-guard pressure on WIs not bound to the session
- **Kind:** removed behaviour
- **Existed for:** keeping an agent from stopping while its task graph still had actionable work (WI-183).
- **Evidence:** 2026-10-11 audit: with no binding, the guard took the WI from the last session-contract row whatever session wrote it, or aggregated every lane-tasks file; in this repo it blocked Stop with "PROGRESS IS NOT COMPLETION ... EXECUTE it" for WI-FW-ADVISORY-PR-01, a WI of another, finished session (917 ms per Stop).
- **Why removed:** pressure to execute someone else's or abandoned work makes results worse.
- **Intent now delivered by:** the guard for WIs attributable to this session: worktree binding, SVC_WORKER_WI, payload wi, WI branch, the single active graph, or a session-contract row whose session matches; silent when several graphs exist and none is attributable.
- **Date / record:** 2026-10-11, hook audit.
- **Reintroduction check:** review: a Stop guard that resolves a WI from a session-contract row without matching its session id, or that aggregates several unattributed lane-tasks graphs

## Zombie sweep rereading every transcript, in every project
- **Kind:** removed behaviour
- **Existed for:** surfacing prior sessions that died in output-limit/API-error loops (WI-393).
- **Evidence:** 2026-10-11 audit: every SessionStart reread all prior transcripts (0.7 s at 74 MB, about 5 s at 438 MB), in projects without `.svc/` too, where a hit would also have created `.svc/`.
- **Why removed:** repeated full reads for an answer that changes only when a transcript changes.
- **Intent now delivered by:** `scripts/zombie-session-sweep.mjs` with a size/mtime cache under `~/.cache/svc/zombie-sweep`, governed repos only.
- **Date / record:** 2026-10-11, hook audit.
- **Reintroduction check:** review: a SessionStart scan that classifies unchanged transcripts again or runs in a project without `.svc/`

## hooks/hooks.json as a hand-maintained, copy-paste wiring guide
- **Kind:** removed documentation
- **Existed for:** documenting the Claude hooks and how to install them by copying entries into settings.json.
- **Evidence:** 2026-10-11: it listed guards consolidated into the decision engine as PreToolUse entries, listed entries the wirer never wired (spec-index update, subagent logs) and missed four of six SessionStart hooks; its install steps told users to copy `svc-workflow-guard` directly, which a later `./setup` would not recognize, so the guard ran twice (standalone and inside the engine).
- **Why removed:** a listing that disagrees with the installer misleads people and validators (the spawn budget counted the drifted list).
- **Intent now delivered by:** hooks.json lists exactly what `scripts/wire-hooks.mjs` wires plus a separate `engine_children` list, and installs only through `./setup` / `wire-hooks.mjs` (`validate-hooks-json-matches-wirer.mjs`).
- **Date / record:** 2026-10-11, hook audit.
- **Reintroduction check:** pattern: /Copy the hooks you want into/ in hooks/hooks.json
