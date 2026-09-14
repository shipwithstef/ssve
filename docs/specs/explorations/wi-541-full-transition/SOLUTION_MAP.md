# Solution Map: WI-541 Full Framework Transition

## Paradigm A: Shared executable seams (BASELINE)

**Core bet:** The framework's foundations are sound; missing consumers and duplicated contracts are the defect.

### A1: Small pure primitives with existing consumers

- **How it works:** Add one canonical chain contract, one transport resolver, one plan contract, a narrow promotion-capability module, learning normalization/lifecycle, and envelope boundary logic. Existing skills/hooks/scripts consume them.
- **Gains:** Direct AC traceability, no new platform, offline fixtures, shared truth, reversible modules.
- **Gives up:** A broad cumulative diff and several integration points.
- **Complexity:** Medium; fits current ESM/file-backed patterns.

### A2: One universal policy engine

- **How it works:** Encode chain, path, transport, authority, plan, learning, and envelope decisions in a generic policy interpreter.
- **Gains:** One evaluation entry point and common decision schema.
- **Gives up:** Domain clarity, simple failure messages, and low-risk incremental adoption.
- **Complexity:** High; invents a new abstraction layer.

## Paradigm B: Generated declarative contracts

**Core bet:** Drift disappears if manifests generate every compiler, validator, hook, and skill contract.

### B1: Extend `skills-manifest.json` into the full policy source

- **How it works:** Add mandatory chain order, transport capabilities, recovery states, plan rules, and learning lifecycle definitions to the manifest, then generate consumers.
- **Gains:** Central inventory and reproducible mirrors.
- **Gives up:** The manifest becomes a large policy language; runtime/security semantics become indirect.
- **Complexity:** High with migration and generator risk.

### B2: Generate only lane topology; keep other seams local

- **How it works:** Derive the ordered mandatory chain from current lane definitions and generate the compiler/validator table; implement other ACs as baseline modules.
- **Gains:** Removes topology duplication with less policy expansion.
- **Gives up:** Lane definitions currently mix full pipeline, optional stages, and compatibility roles; generation can reproduce the wrong semantic array.
- **Complexity:** Medium; attractive runner-up after manifest roles are made exact.

## Paradigm C: Transactional local control plane

**Core bet:** File races and lifecycle fragmentation are state-store problems.

### C1: Move graphs, authority, proposals, and learning lifecycle into SQLite

- **How it works:** One local database owns transactional state and views; Markdown/JSON become projections.
- **Gains:** Strong transactions, queryable denominators, fewer ad hoc locks.
- **Gives up:** Migration/backup/host compatibility, direct Git review, append-only file history, and current authority proof.
- **Complexity:** Very high; not required to close the reproduced gaps.

### C2: External orchestration service

- **How it works:** A network service coordinates leases, child dispatch, reviews, proposal triage, and learning.
- **Gains:** Central multi-host observability and concurrency.
- **Gives up:** Local-first/offline operation, zero credentials, zero provider cost, and simple ownership.
- **Complexity:** Critical and out of scope.

## Paradigm D: Negative-space simplification

**Core bet:** Remove unsafe or expensive capabilities until fewer rules are needed.

### D1: Controller-only execution plus minimal cleanup

- **How it works:** Disable mutating children and detached promotion; keep serial branch-bound work, fix chain/atomic graph, and remove unused guidance.
- **Gains:** Smallest authority surface.
- **Gives up:** W541-05..08 and owner-required production/recovery capability; legitimate safe parallel work remains unavailable.
- **Complexity:** Low but incomplete.

### D2: Docs-only policy and human review

- **How it works:** Update skills and checklists, rely on reviewers to catch deviations.
- **Gains:** Small diff and easy rollback.
- **Gives up:** Every false-green and inert-mechanism AC.
- **Complexity:** Low but fails the program.

## Non-obvious option

A hybrid of A1 and B2 is tempting: generate only topology and use pure modules elsewhere. It is not selected now because the current manifest arrays intentionally represent different roles, so choosing one as an exact mutable-chain authority would create a new hidden semantic dependency. A1 can later become B2 after an explicit manifest-role change and migration proof.

## Grounding

- Git worktrees support shared repository state plus per-worktree metadata and explicit repair, favoring explicit lifecycle transitions over a new service.
- SQLite proves transactions are effective, but adopting it here would solve a larger problem than the bounded lost-update defect.
- SLSA provenance and verification separate producing evidence from consuming it, supporting the consumer-first design.
- OWASP deny-by-default supports exact recovery/envelope checks at the real boundary.
- Official Codex guidance favors read-heavy parallelism and cautions on write-heavy coordination; native availability therefore remains distinct from contained mutation authority.

## Eliminated early

- Parent-lease inheritance: violates stable child identity and least authority.
- Hook disable/force recovery: removes the boundary during the riskiest transition.
- Historical ledger rewrite: destroys append-only provenance.
- GitHub-backed coordination: violates the owner-directed local-only outcome.
