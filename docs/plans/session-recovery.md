# Restore authorized interrupted sessions

WI: WI-FW-SESSION-RECOVERY-02
Status: implemented candidate; review/release/install pending.

The owner approved generic framework recovery first, then installation, then recovery of the existing product session, with a ten-minute target and focused verification. That time target was missed. This document records the approved scope and actual execution; it does not claim a pre-execution review receipt.

## Problem and intended behavior

A user explicitly resumes a WI, asks about status, and then cannot continue because prompt authority was replaced, the old controller points at a removed checkout, or the recovery command is classified as new bootstrap. The corrected path retains the WI over follow-ups, selects its unique Git-registered checkout, uses existing locked ownership recovery, preserves the authorization envelope, and loads the current task skill before retrying the requested operation. No parent directory is globally approved.

## Acceptance Criteria

- **AC-SR-1:** Neutral follow-ups retain the authorized WI. Stop/read-only instructions pause recovery; status cannot rearm it. Positive continuation can resume the retained WI.
- **AC-SR-2:** Exact legacy claim/binding tuples can recover without a machine-specific root allowlist. V2 controller relocation requires missing old checkout, expired/dead owner evidence, matching stale target tuple, unique runnable graph and generation CAS. Same-principal resume keeps its generation.
- **AC-SR-3:** Live foreign owners, ambiguous graphs, mismatched authority and unsafe paths remain denied. Recovery never edits user product files or changes authorization rules.
- **AC-SR-4:** Graph, runnable task and contract preflight runs before controller transfer. Partial recovery retries finish the contract/skill-load step; the original operation runs only after skill content delivery and ordinary downstream checks.
- **AC-SR-5:** Existing-WI bootstrap-shaped requests take the recovery path. New bootstrap failures name the required operation checkout for the agent.
- **AC-SR-6:** Git remote inspection is a read. Custom upload-pack/compound mutations remain governed. Missing heartbeat receipts are quiet for reads, observable for writes.


Changed surfaces: Codex prompt, pre-tool dispatcher, read classifier and heartbeat; shared controller recovery and existing-worktree adoption; regression tests.

## Validation and limitations

Run `node --test test-framework/tests/session-resume-recovery.test.mjs`, plus relevant decision-engine, existing-worktree-self-heal and heartbeat tier-1 validators. The regression suite exercises real prompt and dispatcher processes, native exec_command input, the actual loader, retry after interruption, v1/v2 adoption, live-owner refusal, ambiguity, restrictions and preservation of an uncommitted file. No full paid eval is implied. Product staging/Twilio is outside this framework test.

The prompt hook is a bounded intent aid, not a universal natural-language policy interpreter. Ownership protection and existing authorization checks remain independent. A session whose old installation already erased its WI needs one new explicit WI resume instruction after installation; no historical instruction is fabricated.

Release order: finish candidate review and focused validation; record real chain evidence; merge reviewed source; run canonical setup for all provisioned hosts and drift validation; only then resume the product session through framework recovery and compare preserved file hashes. Rollback is a reviewed revert and normal setup, never editing installed hooks or disabling guards.

## First independent review dispositions

Grok F1: same-principal resume is existing permitted continuity, not displacement of a foreign live owner. Foreign live-owner regression stays denied.
F2: same-worktree v2 recovery retains the existing v2 contract; additional stale v1 evidence applies to relocation, not all v2 controllers.
F3: alleged missing validateTaskGraphShape import was already present; executable recovery tests pass.
F4: removed unreachable dispatcher tail and added interrupted retry coverage.
F5: narrowed cancellation matching, preserved WI through pause, and added restriction/status/resume tests.
F6: limited silent missing receipts to proven reads; writes remain observable.
Original signed review is preserved; these dispositions do not rewrite its FAIL verdict. A changed candidate requires fresh review.

## Implementation-review corrections

The second independent review and Sol advisory identified incomplete pending-task recovery, principal mismatch for agent-scoped sessions, upload-pack aliases, and loss of negative-intent precedence. The candidate now selects the unique active or first runnable pending task, preflights graph/contract before transfer, preserves agent identity, blocks custom Git exec aliases, and reuses the existing negative-intent classifier. Tests include pending boundaries, missing contracts, unrunnable graphs, agent identity and interrupted native exec_command retries. Sol's raw response used the wrong review_kind and model label, so its output is diagnostic evidence, not an issued approval.

## Delivery contract

After source review and receipt validation, promote the reviewed branch through land-changeset, refresh canonical main, install all provisioned hosts and verify drift. Only then use native `codex exec resume SESSION_ID` in the existing product worktree with an explicit `Resume WI` instruction, invoking the installed recovery path. Preserve the user's files by comparing the two recorded SHA-256 hashes before and after. The concrete session/worktree/WI and hashes belong in the local delivery evidence, not generic framework code. The recovery run stops after binding, loading the existing task skill and proving a read-only remote Git check; Twilio, production and deployment remain for the resumed user work.
