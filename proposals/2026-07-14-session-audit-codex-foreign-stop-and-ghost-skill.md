# Session Audit — Codex foreign Stop continuation and ghost skill loading

**Date:** 2026-07-14
**Target:** The single Codex session bundle beginning with the request to find today's new improvement suggestion and ending with the foreign WI-479 Stop-hook continuation.
**Harness/model:** Codex, OpenAI family; exact deployed model revision is not exposed in the repo evidence.
**Outcome:** The agent protected the user's scope, but only by overriding two defective Codex framework controls.
**Proposed follow-up:** FP-026 / WI-485.

## Evidence inventory

| Evidence | Strength | What it proves |
|---|---|---|
| Visible user and hook messages in the current session | primary | The user asked only to find a proposal; the Stop hook demanded execution of WI-479 |
| `.svc/active-intent-state.json` in the default checkout | primary runtime state | Current Codex session `019f6001-5463-7dc0-a1f5-73104831606a` held the new user request and suppressed stale WI continuation |
| `.svc/claims/WI-479.claim.json` | primary runtime state | WI-479 belonged to Claude Fable session `d3f25c45-a283-4483-af64-ae62918255ff` |
| `.svc/lane-tasks-WI-479.json` | primary runtime state | The six tasks named by the hook were real but belonged to that foreign execution |
| `.svc/session-contract.jsonl` last line | primary runtime state | Shared checkout state still ended in a `wi-backlog` WI-479 contract from the other session |
| `hooks/svc-task-completion-guard.sh` | implementation | WI resolution falls back to a single active graph and last shared contract before ownership is established |
| `hooks/lib/active-intent.mjs` | implementation | `wi-backlog` is excluded from concrete binding, weakening suppression of this exact stale-contract class |
| `scripts/wire-codex-hooks.mjs` and `hooks/kimi/svc-kimi-skill-load-enforcer.sh` | implementation | Codex wires a Kimi-only enforcer which exits on non-Kimi hosts |
| Official Codex hooks reference, retrieved 2026-07-14 | external primary | Stop blocking creates a continuation prompt; session/turn ids exist; PreToolUse coverage is incomplete and matching hooks run concurrently |

Codex history/index did not yet contain the live prompt at audit time. That absence is not treated as transcript absence because the current conversation and runtime state are stronger direct evidence.

## Expected contract reconstruction

The user request authorized a read-only discovery task: locate the new improvement suggestion created today and report it. It did not authorize resuming WI-479, taking over another session's claim, modifying WI-479, or running its mandatory execution chain.

The correct framework behavior was:

1. Bind the latest prompt to the current `session_id` and `turn_id`.
2. Resolve no executable WI unless the prompt explicitly selected one or the same session created a new route binding after the prompt.
3. Treat any foreign fresh claim as an immediate allow/advisory result before backlog status is calculated.
4. Never turn a Stop hook into a broader task than the latest user prompt.
5. When later asked for a plan, load `plan-changeset`, `review-plan`, `review-cross-model`, `audit-session-execution`, `improve-framework`, and `research` before their governed writes.

## Actual timeline

| # | Event | Result |
|---|---|---|
| 1 | User asked to find today's new improvement suggestion | Read-only, no WI execution authority |
| 2 | Codex located the WI-481 proposal worktree | Requested result was satisfied |
| 3 | Stop hook emitted `SVC COMPLETION GUARD (1/3)` for WI-479 and instructed the agent to execute six remaining tasks | Foreign scope was promoted into the active turn |
| 4 | Runtime inspection compared active intent, claim owner, and session contract | Current session and WI-479 owner were proven different |
| 5 | Agent refused to execute WI-479 and reported the misfire | Correct agent recovery; framework did not prevent the fault |
| 6 | User requested a Codex-specific framework improvement and full reviewed plan | FP-026 / WI-485 became authorized planning work |

## Multi-lens audit

| Dimension | Assessment | Evidence-based conclusion |
|---|---|---|
| Scope fidelity | FAIL at framework, PASS at agent | Hook broadened scope; agent restored it |
| Task/WI identity | FAIL | Shared `wi-backlog` and single-active-graph fallbacks outranked proven ownership |
| Session concurrency | FAIL | A fresh foreign claim still produced hard continuation pressure |
| Skill invocation | FAIL at framework | Installed Codex enforcer self-disables because it is Kimi-gated |
| Artifact authenticity | WEAK | Receipt recency is repository-global rather than session/turn/task scoped |
| Host correctness | FAIL | Codex canonical `apply_patch` and Stop semantics are only partially normalized |
| Recovery behavior | PASS, manual | The agent inspected evidence and declined the unrelated execution |
| Context/token behavior | PASS | No evidence of context degradation; the error was deterministic hook state, not forgotten instructions |
| User trust | FAIL at framework | The hook's imperative wording falsely represented unrelated work as required current work |

## Findings

### Framework findings

#### F1 — HIGH — Stop authority is derived before ownership

`resolveActiveWI` can choose the only active task graph or the last shared contract without matching the current Codex session or turn. The `wi-backlog` contract then forces `status=block`. The foreign-claim check is a late fallback and depends on payload/session/path conditions after pressure has already been constructed.

**Required correction:** For Codex, establish a prompt authority record first. A Stop continuation may target a WI only when the current session/turn owns the WI binding and fresh claim, or the latest prompt explicitly says `continue WI-N`/`resume WI-N`. Missing, ambiguous, or foreign identity must allow Stop. The shared single-graph and last-contract fallbacks must never create Codex execution authority.

#### F2 — HIGH — Codex's installed skill-load enforcer is inert

The Codex wirer invokes `hooks/kimi/svc-kimi-skill-load-enforcer.sh`. That script exits zero unless host detection returns Kimi. Even on Kimi it guards only task completion, not mutation before the routed skill is loaded.

**Required correction:** Add a Codex-only PreToolUse gate for Bash and `apply_patch|Edit|Write`. For a governed task, deny mutation until a receipt binds skill name, skill content hash, task id, `session_id`, and `turn_id`. Allow reads and non-svc repos. Do not reuse a host-gated Kimi wrapper.

#### F3 — HIGH — Existing authenticity receipts are forgeable across sessions

The authenticity hook accepts any recent matching skill entry in a shared decision log. A different session's receipt can satisfy it. The freshness hook only compares skill when `SVC_CURRENT_SKILL` is present, which the Codex wirer does not provide.

**Required correction:** Share one Codex execution-authority module across the scope and skill gates. Receipts must be exact-scope records, not a time-window heuristic.

#### F4 — MEDIUM — Canonical Codex mutation and artifact paths are incomplete

The hooks are wired for `apply_patch`, but downstream logic still recognizes legacy tool names or protects `docs/specs/plans/` instead of the real `docs/plans/` surface. Official documentation also states PreToolUse does not intercept every execution route.

**Required correction:** Normalize Codex payloads centrally, include the actual plan paths, add trace replay tests, and document that hooks are guardrails. Retain skill/developer instructions and post-action validators for uncovered routes.

#### F5 — MEDIUM — Codex hook installation has untracked trust state

Codex requires review/trust when hook command hashes change. A setup script can write hooks configuration but cannot honestly claim the commands will run until trust is verified.

**Required correction:** Model `~/.codex/hooks.json`, config enablement/disablement, and `/hooks` trust as external state with install, verify, rollback, and user checkpoint steps.

### Agent findings

#### A1 — POSITIVE — Evidence overrode an unsafe hook prompt

The agent checked active intent, the claim owner, and the task graph before acting. It did not modify or take ownership of WI-479. This recovery pattern should become the mechanical Codex default.

#### A2 — MEDIUM — Skill loading depended on manual discipline

For the subsequent planning request, required skill contracts were read and announced, but there is no current Codex-native receipt that mechanically proves the load belongs to this turn and task. That is an enforcement gap, not evidence that the reads were skipped.

### Project findings

No product/project-code defect was involved. The failure domain is the svc framework's Codex host integration and shared `.svc` runtime state.

## Acceptance direction for WI-485

1. A replay of this exact two-session fixture returns allow/advisory and never a continuation prompt for WI-479.
2. `continue WI-479` still fails while the foreign claim is fresh unless ownership is explicitly and safely transferred.
3. A same-session, same-turn, explicitly bound WI with actionable tasks may continue, capped by the existing anti-loop policy.
4. A Codex mutation for a task naming `plan-changeset` is denied before an exact load receipt and allowed after it.
5. A receipt from another session, turn, task, skill, or stale skill hash is denied.
6. Claude, Kimi, Gemini, OpenCode, Antigravity, and Cursor hook registries and behavior remain unchanged.
7. Installation evidence distinguishes configured, trusted, and runtime-observed states.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | One session bundle only | Target sentence and timeline cover the find-request/foreign-Stop incident | PASS |
| 2 | Evidence precedes judgment | Inventory cites runtime state, source, and official host behavior | PASS |
| 3 | Expected and actual are separated | Dedicated reconstruction and timeline sections | PASS |
| 4 | Fault domains are separated | Framework, agent, and project findings use separate headings | PASS |
| 5 | Model/harness limits are honest | Host/family stated; exact revision not invented | PASS |
| 6 | Proposed action is testable | Seven WI-485 acceptance directions are fixture-verifiable | PASS |
