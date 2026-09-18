---
status: DRAFT
type: Enabler
mode: contract-change
wi: WI-FW-CROSS-REPO-ORCH-01
landscape_state: inapplicable
landscape_inapplicable_reason: internal framework origin-orchestration contract with no customer-facing market flow
created: 2026-09-18
---

# Feature: Cursor origin orchestration of any named WI/worktree

**Status:** DRAFT
**Work item:** WI-FW-CROSS-REPO-ORCH-01
**Lane:** framework

## Problem Statement

A hooks-active Cursor (or other origin) session bound to worktree A cannot
orchestrate a named WI/worktree B — including another repository — without
pasting a prompt-composer package or escaping through agy. Session contract
freshness, worktree isolation, null Grok `launch_command`, and Cursor's missing
origin-orchestrator primitive combine into a hard lock.

## Delta contract

**Preserved:** foreign/ambiguous owners fail closed; default checkout stays
protected; mixed-repo mutation of arbitrary files stays denied; review still
uses the existing external-review launcher; STRAT/agy remains available, not
mandatory.

**Changed:** same-owner origin can migrate onto a named WI/worktree; Grok
PLAN/EXEC launch is a real CLI; Fable REVIEW is dispatched without paste;
isolation allows only the exact orchestrate CLI from a foreign worktree.

**Non-goals:** enabling Cursor `fresh_session_launch`; weakening isolation for
foreign owners; storing secrets in git; replacing WI-552 continuation.

## Consumer Stories

| ID | Consumer | Story |
|---|---|---|
| S1 | Origin orchestrator (Cursor) | I name a WI/worktree and my session migrates there without paste. |
| S2 | Grok PLAN/EXEC child | I am launched in the target worktree with a file prompt, not a copied chat. |
| S3 | Fable REVIEW | I receive the plan/exec package through the existing review launcher. |
| S4 | Isolation guard | I allow orchestrate migrate/dispatch and still deny mixed-repo file edits. |

## Acceptance Criteria

| ID | Criterion | Type |
|---|---|---|
| AC-1 | Same-owner `svc-orchestrate migrate` rebinds the named WI/worktree, writes a fresh target session contract, and returns `paste_required:false` `agy_required:false`. | happy |
| AC-1E | Foreign or ambiguous session identity is denied; no binding is rewritten. | error |
| AC-2 | Grok host manifest `launch_command` is a non-null grok CLI using `--cwd` and `--prompt-file`. | happy |
| AC-3 | Dispatch PLAN/EXEC argv is grok in the target worktree; REVIEW argv is the Fable/cursor external-review launcher. | happy |
| AC-3E | Dispatch refuses when the only configured escape is agy. | error |
| AC-4 | Isolation allows the exact orchestrate CLI from a non-default worktree of another repo; a Write to the other repo still denies. | edge |
| AC-5 | Orchestrate success JSON has no copy-paste prompt payload. | happy |
| AC-6 | 2026-09-18 incident fixture fails the pre-fix invariants (null launch_command / paste / agy-only) and passes post-fix. | happy |
| AC-ZERO | First-use from a bound foreign worktree: run migrate (bootstrap-shaped), then dispatch. No empty-state "configure first" dead end. | zero-state |

## System Dependencies

- Depends-on: WI-551 dispatch resolver, WI-552 continuation launch seam, `svc-ensure-worktree`, external-review launcher, isolation guard
- Depended-on-by: Cursor origin sessions, Grok PLAN/EXEC children, HoursHub follow-up work

## Industry Grounding

Internal framework enabler. Landscape inapplicable: no customer-facing market flow.

## Pillars Coverage Matrix

| Pillar | State |
|---|---|
| Product fit | [N/A — justified] framework origin orchestration, not a product feature |
| Journey | [N/A — justified] no end-user journey; operator CLI + hooks |
| Acceptance criteria | [NEW] |
| UX | [N/A — justified] no UI |
| UI | [N/A — justified] no UI |
| Tech architecture | [NEW] |
| Cost model | [UNCHANGED — VERIFIED] uses existing Grok/Fable stations; no new paid vendor |
| Operations & ownership | [NEW] public git artifacts only; no secrets |

## Technical Design stub

`scripts/svc-orchestrate.mjs` is the one CLI. Isolation short-circuits on
`parseOrchestrateCommand` before mixed-repo scope denial. Cursor origin_orchestrator
declares plan/exec=grok and review=cursor/fable. Grok `launch_command` is the
WI-552 spawn template.
