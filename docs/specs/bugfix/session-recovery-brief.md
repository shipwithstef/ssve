# WI-FW-SESSION-RECOVERY-01 — Dedicated-session recovery

Status: BASELINED
Owner direction: current founder instruction authorizes implementation, review, landing and installation.

## Problem and reproduction
An exact already-bound registered external worktree fails WORKTREE_ROOT_UNAPPROVED after command-local root approval disappears. The complete session authority already persists but the root check precedes its consumption. Separately the review launcher classifies a structured Claude result “Not logged in” as unknown_provider; callers hand-build invalid policy and retry unavailable routes. The current origin/main already supports Cursor transport; reuse it.

## Acceptance criteria
| ID | Observable requirement |
|---|---|
| AC-1 | An exact authoritative same-session registered worktree resumes without repeating root environment approval, preserving files, branch, WI and generation. |
| AC-2 | Released/mismatched/foreign ownership, wrong WI/repo, ambiguous registration and unsafe ancestry never inherit that exception; default root and explicit owner-root paths remain compatible. |
| AC-3 | A policy builder inserts self-review, retains owner-supplied advisory and external stations, and validates tuples before writing/launching. This task input includes required Sol advisory; the general constructor does not hardcode any reviewer model. Task policy selects only Cursor Grok; unavailable accounts are never paid-probed. |
| AC-4 | Structured terminal authentication/entitlement/quota/overload errors have correct classifications; quoted text in successful output does not trigger fallback. |
| AC-5 | Owner observations and classified failures suppress repeated unavailable calls by configured account pool, preserve unknown balance, distinguish Cursor and standalone Grok, and expire only via explicit retry time/newer observation. |
| AC-6 | Existing Cursor transport yields schema-valid plan/exec evidence with truthful requested-accepted identity, never claims server observation without evidence. Invalid provider output is a failure. |
| AC-7 | Focused offline regression suite proves the behavior; required existing release checks and host installation parity remain intact. |

## Technical design
Extend ensure-worktree with a shared approval fallback that reuses verifyCompleteTuple for the exact registered target before accepting its existing session authority. No parent-root grant or new authority store. Preserve no-symlink ancestry checks at the target boundary and existing transaction locking. Initial unbound roots still require owner-root or host-authorized bootstrap; an unrelated graph is not authority.
Extend reviewer-policy v2 with optional resource_policy: routes bind exact host/model to explicit pool_id; owner observations record available/unavailable/unknown, observed_at, classification, optional retry_after, remaining=null by default. A sibling task-scoped resource state file stores classified provider observations with existing state-io atomic updates. Newer owner observations supersede older automatic failures. Quota/auth failures without reset do not invent reset times. No automatic alternate provider invocation.
Add schema-aware create-policy CLI on review-topology-v2. Existing policy resolver/launcher validates and checks resource eligibility before capability/probe/paid calls. Preserve existing policies when field absent. Bind effective resource policy via existing policy digest and keep receipt failure classification.

## Scope and quality
No product/iOS modifications, global credential changes, swarm work, or new runtime. Source-derived skill cleanup and question-policy changes follow as separate changesets after this operational slice. Actual unit-test cost is small; preserve useful tests. Eight pillars: correctness, reliability, security/authority, operations and cost directly tested; product/UX operator interruption is the outcome; accessibility and visual UI are not changed.
