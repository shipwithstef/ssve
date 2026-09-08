# Finish small repairs without workflow restarts

WI: WI-FW-SESSION-RECOVERY-02
Baseline: PR45/PR46 recovery is already installed. Preserve the pending canonical digest-map correction and its actual publication proof. This change connects existing repair mechanisms; it introduces no new lane or approval bypass.

## Acceptance Criteria

- **AC-RW-1:** Invalid inline plan fields and missing declared context fail before any reviewer call. Preflight and paid review consume the same validated, hash-bound plan representation and declared source.
- **AC-RW-2:** Unscored progress without negative evidence receives at most one completion attempt inside the original budget. Substantive failures remain intact.
- **AC-RW-3:** Passing-labelled plan reports with failed certifications can use the existing three-round fixed-proof closeout through both builder and consumers. Missing proof, Criticals, unread dependencies and failed execution certifications still block.
- **AC-RW-4:** Missing PR views derive from exact live PR identity and passing canonical G5/chain evidence; metadata alone cannot generate approval, and a moving PR head cannot merge as a different candidate.
- **AC-RW-5:** Plan obligations remain stable across implementation-only corrections. Candidate identity comes from execution; original worktree recovery preserves dirty files, foreign ownership and native writer locks.
- **AC-RW-6:** Release the digest-map correction, install on every provisioned host and verify drift. Measure a complete representative request-to-installed repair; unfinished review or native queue is not completion. Ten minutes is a measured target, not an assumed pass.

## Implementation and verification

Prepare source through the existing v4 plan validator and launcher. Share the plan-certification eligibility predicate between the bounded-exit builder and evidence consumer. Derive PR compatibility metadata only after native chain verification; constrain GitHub merge to the expected head. Update existing skill contracts to invoke these paths and retain unchanged plan review evidence.

Run focused plan/input, progress, signed bounded-closeout, canonical emitter/publication and PR-generation regressions, then the required release corpus once on the frozen candidate. Independent review uses preflight plus actual declared source. Preserve signed failed/provisional reports. Merge through the canonical wrapper, then canonical setup --all-hosts and all-host drift verification. Original phone session uses its existing native queue; no provider, deployment, SMS or production changes.

## Release inputs and rollback

Do not hardcode a future commit into this plan. Obtain candidate SHA/tree from the actual execution receipt and PR number from native PR creation; verify both before canonical merge. On an unsuccessful release, preserve evidence and resume the existing task. Revert source through a reviewed change if needed, then reinstall through setup; never erase shared notes or a live session lock.
