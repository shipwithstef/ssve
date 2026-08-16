# WI-541 security review

**Scope:** authority, filesystem mutation, reviewer independence, product-plan safety, learning trust, and outward-action authorization.

| Threat | Control | Negative proof | Residual |
|---|---|---|---|
| Shell spelling bypasses path guard | one concrete-target classifier used by three guards | redirect/env/cp-target/Perl/Node/Ruby/nested-shell/read-only fixtures | dynamic shell remains fail-closed at the Codex authority/containment layer |
| Generic agent capability grants mutation | exact child tuple, UUID/canonical capability, and OS policy-bound Landlock grants | malformed expiry, traversal, symlink, out-of-grant runtime write, failed probe, and no-containment cases | no native mutation without full tuple and concrete delegated paths |
| Promotion replay/widening | expiring single-use capability bound to repo/lease/branch/generation/head/tree/environment/operation/exact argv | traversal, unminted, expiry, replay, commit `-a`/`-n`, force-push, wrong branch/generation/tree | operator still needs the canonical owner-recovery boundary |
| Legacy recovery deletes residue or steals authority | secure ancestors, exact registered branch, empty authority-only adoption | residue digest, foreign owner, symlink, duplicate registration, concurrency tests | filesystem UID is the generation-zero same-owner signal |
| Money/entitlement plan is irreversible | path-independent changed-executable census plus resource writer order, compensation, and property sweep | ORM decrement and immutable balance writer omissions reject | task declares no such writer in WI-541 |
| Absence/completeness laundering | direct evidence plus integer denominator | missing denominator fixture rejects | final census remains required for closeout prose |
| Self-review laundering | current launcher schema and semantic verifier, exact commands/outputs, cross-family derivation, and hash-bound AGY transport | partial, stale-version, forged-command, failed-findings, missing-transport, and symlink subtree negatives | independent exact-candidate review remains required after cumulative assembly |
| Malformed learning becomes authority | canonical candidate-bound evaluate-rule verdict plus independent reviewer evidence | legacy self-authored pass receipt and untracked evidence reject | loader remains fail-open for availability but cannot grant framework credit to malformed rows |
| Authorization prose implies enforcement | typed exact rules at the real outward-action adapter with malformed-object fail-close | pipeline/sudo/nested shell/curl and conflicting-rule negatives | commands outside adapted outward boundaries remain governed by mutation authority and containment |
| Merge-back rejects after mutation | integration lock, clean expected HEAD, controller validations, and hard reset to exact pre-head on any failure | post-cherry-pick validation failure and concurrent two-writer fixture | sequential assembly is local and remains conflict-sensitive by design |
| Static graph ordering is bypassed at runtime | first-runnable/blocker/single-active checks, mandatory non-skip set, and digest-bound required-process receipts | blocked completion, arbitrary skip, missing visual diff, and concurrent transition negatives | controller can reopen completed work only through explicit backward status evidence |

No secret, package dependency, product database, payment system, deployment, remote branch, or GitHub state was touched. The complete 321-validator Tier 1 corpus passed after these controls were assembled. Final different-family exact-candidate review and installed-host convergence remain explicit gates.
