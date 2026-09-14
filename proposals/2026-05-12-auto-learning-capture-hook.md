# Framework Proposal — 2026-05-12 — Auto-Learning Capture Hook

**Status:** DRAFT
**Promotion:** mapped to WI-343 in `docs/specs/work-items/PROPOSAL-PROMOTION-LEDGER.md`. Will move to `proposals/done/` only after WI-343 lands.
**Author:** route-workflow (Claude opus-4-7, harness profile resolved via `scripts/resolve-model.sh`, model registry at `references/model-registry.json`, routing per `references/model-routing.md`), triggered by user directive 2026-05-12 ("LEARNING SHOULD BE AUTOMATIC AND ALWAYS CHECKED TRIGGERED NO USER INVOLVED ONLY OPTIONALLY IF USER WANTS"). Cross-model adversarial reviewer (Codex) was the catalyst for the 5 learnings this proposal exists to capture.
**Plan-changeset class:** contract-change
**Lane:** framework
**Severity:** HIGH
**Source incidents:** WI-341 tranche 1 session (PR #121, #122) — 5 load-bearing learnings surfaced but ZERO auto-captured into `references/framework-learnings.jsonl` until explicit user demand.
**accepted_wi**: WI-343

---

## Problem

The framework's learning pipeline is **read-only at session start, write-only at user request**. Concretely:

- `hooks/svc-learning-preload.mjs` exists and reads `references/framework-learnings.jsonl` + `docs/learnings/learnings.jsonl` at session start.
- `audit-session-execution` skill can extract learnings, but it is user-invoked.
- `manage-learnings` skill can write learnings, but it is user-invoked.
- `hooks/svc-session-end-log.mjs` exists but logs session-end metadata only, not learnings.
- `.svc/pipeline-decisions.jsonl` captures decisions in-flight but does NOT promote them to learnings.

Result: every session produces N load-bearing learnings (procedural corrections, hook side-effects, recursive-failure observations, code-pattern fixes) that get **discarded at session end**. The next agent re-discovers the same patterns from scratch. The WI-341 tranche 1 session alone produced 5 framework-grade learnings that the user had to explicitly request capture for. Without the explicit request, they would have been lost.

## Root cause

`hooks/svc-session-end-log.mjs` and `hooks/svc-learning-preload.mjs` exist as a one-way pipeline (write metadata at end, read learnings at start) with **no learning-extraction step in between**. The framework has the trigger surface and the storage; the missing primitive is the auto-scanner.

## Proposal — Auto-Learning Capture Hook

Add a hook that scans session activity for novel learning signals and auto-appends them to the appropriate learnings file. **Default = on for every session.** Opt-out via env var for sessions where the user wants silence (e.g., one-shot research extraction). Opt-IN review surfacing via env var for sessions where the user wants to vet entries before they land.

### Trigger points (multi, per `rules/concern-routing.md` pattern)

| # | Trigger | When fires | Mode |
|---|---------|------------|------|
| 1 | `Stop` hook (session end) | Every session end | Always (default) |
| 2 | `PreCompact` hook | Before context summarization (long sessions) | Always (default) — captures before learnings get summarized away |
| 3 | `PostToolUse` for `Edit`/`Write` matching `correction-after-failure` pattern | After a fix-the-fix cycle | Always (default) |
| 4 | Explicit user CLI: `node scripts/capture-session-learnings.mjs` | On demand | Opt-in |

### What signals count as a learning candidate

The scanner reads `.svc/pipeline-decisions.jsonl`, the active task graph, the last N tool-use entries, and recent commit messages on the active branch. A learning candidate is detected when ANY of:

- **Correction-after-failure** — a commit message contains "fix" / "address" / "restore" referencing a prior commit in the same branch, AND the diff against that prior commit is non-trivial.
- **Review-finding remediation** — a commit message references "Codex review" / "review finding" / "5/5 accept" / similar adversarial-review acknowledgment.
- **Hook side-effect surfaced** — `.svc/pipeline-decisions.jsonl` carries a `guard_override_count > 0` entry OR a hook-blocked decision.
- **Recursive failure observation** — the author's own code change contains a pattern flagged in `references/anti-patterns.md` or in `references/framework-learnings.jsonl` with `confidence >= 8`.
- **Stale-capability rediscovery** — a tool call hit a 404/auth-fail/method-not-found that previously had a learning.
- **New rule-class observation** — the session ends with a rule cited >2 times in commit messages or decision log but the rule has no entry in `rules/`.

For each candidate, the hook drafts a learning entry conforming to the existing schema (`date`, `skill`, `type`, `key`, `insight`, `confidence`, `source`, `files`, `saves_minutes`). The entry is auto-deduped (hash-compare key + insight prefix against existing entries; skip if confidence ≤ existing).

### Storage routing — gitignored by default, never auto-writes tracked files

**Critical correction after Codex review of PR #123:** the prior version of this section proposed auto-writing to `references/framework-learnings.jsonl` and `docs/learnings/learnings.jsonl`. Both are TRACKED files. That would mean every normal session dirties the repo with learning entries that leak into unrelated feature PRs — exactly the PR-noise class this proposal's underlying motivation (the svc-pre-commit auto-stages session-contract.jsonl learning, entry 74) names. Recursive irony catch.

**Corrected default contract:**

| Signal source | Default destination (always silent, gitignored) | Promotion-to-tracked path (explicit only) |
|---|---|---|
| Any candidate | `.svc/auto-learnings.jsonl` (gitignored, append-only audit log) | `manage-learnings promote --from-auto` reviews and moves selected entries to: |
| Framework-wide pattern | — | `references/framework-learnings.jsonl` |
| Project-specific pattern | — | `docs/learnings/learnings.jsonl` |
| User preference / collaboration style | — | host-resolved user-memory path (see § Host neutrality) |

The hook NEVER writes a tracked file by default. The tracked-files promotion is a separate explicit operation that the user (or a scheduled job) invokes via `node scripts/promote-auto-learnings.mjs` or `manage-learnings promote --from-auto`. Promotion is the human-or-cron review point, not the capture point.

**Three operational modes** (renamed to remove ambiguity about what writes where):

- **Default (silent capture)** — every session. Hook writes ONLY to `.svc/auto-learnings.jsonl`. Zero user output, zero tracked-file dirtying. Repo stays clean. The audit log accumulates between promotion runs.
- **Summary (opt-in via `SVC_AUTO_LEARN_SUMMARY=1`)** — same write target as default, plus a 3-line session-end summary: "Auto-captured N learnings into .svc/auto-learnings.jsonl. Run `node scripts/promote-auto-learnings.mjs` to review/promote."
- **Review (opt-in via `SVC_AUTO_LEARN_REVIEW=1`)** — hook drafts entries to a temp file under `.svc/auto-learnings.draft.jsonl`, emits a checklist to stdout, and waits for the user to merge/discard. Slowest path, for users who want to vet every entry before it touches even the audit log.

`scripts/promote-auto-learnings.mjs` reads `.svc/auto-learnings.jsonl`, classifies each entry (framework / project / user), and emits a review prompt naming the target tracked file. The user approves entries to land; the rest stay in the audit log or get discarded.

### Host neutrality

This proposal must work across the 5 hosts the framework supports (Claude Code, Codex, Gemini CLI, Kimi CLI, OpenCode). Hook trigger surfaces differ — `PreCompact` is Claude Code-specific; `Stop` and `PostToolUse` exist across most hosts in some form; `settings.json` is the Claude Code wire format.

**Multi-host contract:**

| Host | Triggers wired | Storage path resolver |
|---|---|---|
| Claude Code | `Stop`, `PreCompact`, `PostToolUse` (Edit/Write matcher) | `settings.json` hook entries |
| Codex | `Stop` equivalent only (no PreCompact, no fine-grained PostToolUse) | Codex hook config file (per `provision/hosts/codex.json`) |
| Gemini CLI / Kimi CLI / OpenCode | `Stop` equivalent only | per-host config from `provision/hosts/<host>.json` |

User-memory storage path is resolved via a new shared helper `scripts/lib/resolve-user-memory-path.mjs` that consults the active host (`SVC_HOST` env, set by `setup`) and returns:

- Claude Code → `~/.claude/projects/<project-slug>/memory/`
- Codex → `~/.codex/projects/<project-slug>/memory/` (or codex equivalent — to be confirmed against current Codex docs at WI-343 implementation time per `rules/host-capability-research.md`)
- Other hosts → `~/.svc/per-host/<host>/projects/<project-slug>/memory/` as fallback until each host has a native equivalent

The hook does NOT hardcode `~/.claude/...` anywhere. All paths flow through the resolver. Hosts that lack a trigger (e.g., Codex lacking `PreCompact`) capture less per session — that's acceptable; some auto-capture beats none.

### Surfacing modes

- **Silent** (default for `Stop` hook) — append + log to `.svc/auto-learnings.jsonl` for audit. No user-facing output unless `--verbose`.
- **Summary** (opt-in via `SVC_AUTO_LEARN_SUMMARY=1`) — append + emit a 3-line summary in session-end output: "Auto-captured 2 learnings: [key1], [key2]. Full entries at <files>."
- **Review** (opt-in via `SVC_AUTO_LEARN_REVIEW=1`) — draft entries but do NOT append; emit them as a checklist for the user to approve. Slow path for users who want to vet.

### Implementation surface

- `hooks/svc-auto-capture-learnings.mjs` — the scanner. Wired into per-host trigger sets per § Host neutrality (Claude Code: `Stop`/`PreCompact`/`PostToolUse`; Codex and other hosts: `Stop` equivalent only until host capabilities expand). Host wiring lives in the existing `scripts/wire-hooks.mjs` / `scripts/wire-kimi-hooks.mjs` machinery — NOT in a hardcoded `settings.json` reference.
- `scripts/capture-session-learnings.mjs` — standalone CLI for the manual case.
- `scripts/lib/learning-candidate-detector.mjs` — shared library implementing the 6 signal heuristics above.
- `scripts/lib/learning-dedup.mjs` — hash + confidence dedup.
- `.svc/auto-learnings.jsonl` — append-only audit log (gitignored).
- `test-framework/evals/tier-1/validate-auto-learning-capture.sh` — fixtures that prove: (a) a synthetic correction-after-failure session captures an entry, (b) dedup skips a duplicate-confidence entry, (c) silent mode produces no stdout, (d) summary mode emits 3-line output.

  **Tier-1 promotion note** (per `rules/tier-1-promotion.md`):
  - `validator_path`: `test-framework/evals/tier-1/validate-auto-learning-capture.sh`
  - `failure_class`: silent-learning-loss — sessions producing N>=1 learning-grade observations but auto-writing 0 entries to `references/framework-learnings.jsonl`
  - `promotion_signal`: WI-341 tranche 1 session alone produced 5 framework-grade learnings, all of which would have been lost without explicit user intervention (observed 2026-05-12). Recurrence is daily across every active session; the failure-frequency bar in `rules/tier-1-promotion.md` (signal 1: ≥2 observations in 60 days) is met by every multi-PR-iteration session this repo has ever run.
  - `expected_runtime_budget`: ≤2s (4 fixtures, each a stub session-end scan against a synthetic `.svc/pipeline-decisions.jsonl`)
  - `why_tier_2_or_targeted_is_insufficient`: tier-2 LLM-judged checks gate on `EVALS=1`; this validator must run on every commit to prove the hook didn't regress silent-mode (per the noise-suppression risk above)

### Why this is one hook, not three

I considered separate hooks for each trigger point. Rejected because:
- All three triggers consume the same `.svc/pipeline-decisions.jsonl` + task graph + recent commits.
- Dedup must be cross-trigger (don't capture the same learning from a `PostToolUse` AND a later `Stop`).
- One hook with three matchers is simpler to maintain than three near-identical hooks.

### Acceptance criteria

These ACs match the corrected contract in §"Storage routing" and §"Host neutrality" above. They supersede the original draft ACs (which were stale relative to the corrected sections after Codex review of PR #123). WI-343's AC block mirrors this list — the proposal and the WI must stay in sync.

- [ ] `hooks/svc-auto-capture-learnings.mjs` exists and is wired via the existing `scripts/wire-hooks.mjs` / `scripts/wire-kimi-hooks.mjs` machinery per host. Claude Code: `Stop`, `PreCompact`, `PostToolUse` (Edit/Write matcher). Codex and other hosts: `Stop` equivalent only (no `PreCompact` available on Codex). Per-host config flows from `provision/hosts/<host>.json`. No direct `settings.json` reference in the hook code itself.
- [ ] `scripts/lib/learning-candidate-detector.mjs` implements all 6 signal heuristics.
- [ ] `scripts/lib/learning-dedup.mjs` hash+confidence dedup.
- [ ] `scripts/lib/resolve-user-memory-path.mjs` — host-neutral resolver. Returns `~/.claude/projects/<slug>/memory/` for Claude Code, host-equivalent for Codex/Gemini/Kimi/OpenCode per `provision/hosts/<host>.json`, falls back to `~/.svc/per-host/<host>/projects/<slug>/memory/` for hosts without a native equivalent. No hardcoded `~/.claude/...` anywhere in hook code.
- [ ] `scripts/promote-auto-learnings.mjs` exists as the explicit promotion path. Reads `.svc/auto-learnings.jsonl`, classifies entries, emits review prompt, writes approved entries to the appropriate tracked file. NEVER auto-promotes.
- [ ] **Default capture target is the gitignored audit log only.** The hook writes ONLY to `.svc/auto-learnings.jsonl` by default. It MUST NOT write to `references/framework-learnings.jsonl`, `docs/learnings/learnings.jsonl`, or any tracked user-memory path without explicit user invocation of `scripts/promote-auto-learnings.mjs` (or `manage-learnings promote --from-auto`). Verified by tier-1 fixture: a default-mode run that scans a session with N learning candidates produces ZERO `git diff` against tracked files.
- [ ] Default mode is silent (no user output).
- [ ] Opt-in summary mode (`SVC_AUTO_LEARN_SUMMARY=1`) emits 3-line session-end summary; storage target unchanged (still gitignored audit log only).
- [ ] Opt-in review mode (`SVC_AUTO_LEARN_REVIEW=1`) writes to `.svc/auto-learnings.draft.jsonl` and waits for user merge before any append; tracked files still untouched.
- [ ] `.svc/auto-learnings.jsonl` and `.svc/auto-learnings.draft.jsonl` are gitignored.
- [ ] Tier-1 validator `validate-auto-learning-capture.sh` covers 5 fixtures: (a) correction-after-failure session captures entry to gitignored log, (b) duplicate-confidence dedup skips, (c) silent mode produces no stdout, (d) summary mode emits 3-line output, (e) **default-mode run leaves `git status` clean for all tracked learning files** — the regression test for the tracked-file-leakage class Codex flagged on PR #123.
- [ ] Cross-link: `hooks/svc-learning-preload.mjs` is updated to ALSO read `.svc/auto-learnings.jsonl` for in-session learnings (so the next session preloads them even before the user's next `manage-learnings` review).
- [ ] Replay fixture using THIS session's 5 captured learnings (`references/framework-learnings.jsonl` entries 73-77) — prove the hook would have caught them automatically AND would have written them to `.svc/auto-learnings.jsonl` (gitignored), not directly to the tracked file.

## Concerns wired

- New `concerns/auto-learning-capture.md` — signals: any commit message containing "fix(WI-*)" / "address review" / "restore" / `guard_override_count`; required_skills: this hook engages.

## What this does NOT do

- Does NOT replace `audit-session-execution` — that skill does deeper retrospective analysis (root cause, gap classification) than this hook can. Auto-capture is for the obvious-pattern case.
- Does NOT replace `manage-learnings` — that's the review/prune/export tool. Auto-capture only handles the append path.
- Does NOT capture every micro-decision — only signals strong enough to clear the 6-heuristic bar. Noise-suppression is a feature.

## Risks

- **False positives** — hook captures noise. Mitigation: 6-heuristic bar + dedup + opt-in surfacing + audit log allows pruning via `manage-learnings`.
- **Hook latency** — adds time to every session end. Mitigation: cap scanner at 200ms hard timeout; if exceeded, log warning and skip.
- **Storage growth** — `references/framework-learnings.jsonl` grows over time. Existing rule: `manage-learnings prune` handles this on user request; could be auto-scheduled.

## Self-Verify

| # | Check | Result |
|---|---|---|
| 1 | Names concrete artifacts (hook, scripts, validator, schema) | PASS |
| 2 | Severity rated against `rules/github-projects.md` | PASS (Severity: HIGH — closes structural learning-loss gap) |
| 3 | Host-agnostic (no project-specific tokens) | PASS |
| 4 | Concerns wired (new evidence family OR existing concern cited) | PASS (new `concerns/auto-learning-capture.md` named) |
| 5 | Tier-1 validator promotion note | PASS (`validate-auto-learning-capture.sh` named with fixture coverage) |
| 6 | Capability oracles | N/A (no harness/model references) |
| 7 | Plan-changeset class declared | PASS (`contract-change`) |

## Route

If accepted: file as WI-343 through the WI-341 gate (which is now on origin/main via PR #121 + tranche 1). This proposal is the **first non-bootstrap WI** to dogfood the gate — its T1 lint sidecar lands at `.svc/proposal-lints/2026-05-12-auto-learning-capture-hook.md`. Severity = HIGH. Plan-changeset class = `contract-change`.

## Bootstrap note

This proposal is NOT a bootstrap exception — the WI-341 gate already shipped (tranche 1 on origin/main as `f4e84cd` + `5b294ba`). The T1 author-time linter ran against this proposal as part of authoring; output is at `.svc/proposal-lints/2026-05-12-auto-learning-capture-hook.md` (gitignored).
