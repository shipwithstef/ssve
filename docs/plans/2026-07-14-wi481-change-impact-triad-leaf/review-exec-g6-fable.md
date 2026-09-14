# WI-481 G6 Fable Review

## Round 1

- Reviewer: Claude Fable 5, independent Anthropic family
- Session: `86000345-fb49-439e-8562-fa2e37e1073f`
- Verdict: REVISE
- Scope: complete working-tree diff including untracked files, WI-481 AC1-AC6, frozen leaf manifest, proposal, guard, classifier, schema, host wiring, and behavioral tests
- Mechanical baseline reviewed: Tier 1 `243/243`, zero failures and zero timeouts

Accepted findings and remediation:

1. Allow plain non-svc repositories before binding resolution; add a global-hook negative fixture.
2. Fail closed on multiple active tasks and bind zero-active closeout commits to the last completed task receipt.
3. Allow TaskUpdate when no staged mutation exists; require a receipt when a staged mutation exists.
4. Source session identity from hook payload before environment fallbacks.
5. Treat behavior-bearing JSON/CSS/HTML as logic outside documentation and keep append-only ledger paths cosmetic.
6. Anchor release and host-hook path families; extend protected auth coverage to RBAC, ACL, OAuth, JWT, SSO, login, sessions, guards, middleware, and access-control paths.
7. Broaden git commit boundary detection across git prefix options.
8. Make replay adoption ancestry-based so deleting the schema cannot grandfather a later commit.
9. Require non-empty coverage mappings, existing proof artifacts, strict top-level receipt fields, valid session length, and valid timestamps.
10. Restrict structural diff signals to changed lines and avoid escalating arrows in documentation prose.
11. Preserve the intentional high-risk classification of task-graph status changes and document that it supersedes the prior closeout carve-out.

Round 2 is required after focused and full-suite verification.

## Round 2

- Reviewer: Claude Fable 5, same independent review session
- Verdict: APPROVE
- Another round required: no
- Post-remediation baseline: Tier 1 `243/243`, impact triad `51/51`, quick-fix composition `29/29`, envelope integrity `8/8`

Fable verified C1, H1, H2, M1-M5, and L1-L4 as resolved in code with behavioral negative tests. The final AC assessment was MET for AC1-AC6. The reviewer also traced the new closeout selection, exact svc-root scoping, staged-quiet ordering, payload-only session resolution, append-ledger interaction, ancestry replay, and git-prefix commit detection without finding a new fail-open or fail-closed regression.

Accepted non-blocking residuals:

- Direct removal of `.svc` can bypass this local guard's svc-root check, but deletion is classified high by replay and is caught by downstream pre-push enforcement.
- Environment-prefixed and cross-repository `git -C` commands may miss early hook feedback; the repository-local pre-commit slot remains authoritative.
- Git plumbing can bypass porcelain hooks; this is outside the drift-prevention threat model.
- Receipt evidence remains executor-authored; artifact existence is checked, while independent review judges relevance and truthfulness.
- Append-ledger paths are classified cosmetic by the risk classifier, while the existing quick-fix hunk validator still refuses rewrites.
- The high-risk family vocabulary and closeout receipt regeneration should be monitored for ceremony pressure.

Final review session result UUID: `1e72f9b1-3cf6-4096-ab99-a1c77edd85e7`.

## Frozen-diff Delta Check

After round 2, Codex found and fixed a two-line binary-marker precision issue: binary metadata matching is now line-anchored so source literals cannot self-trigger, and a real NUL-byte fixture proves true binaries still classify high. Focused impact became `52/52`; full Tier 1 remained `243/243`.

Fresh-context Fable session `250051ca-8b93-47b7-ba01-685d1e127a6d` inspected only this delta and returned APPROVE. It confirmed the anchored marker, independent numstat fail-safe, and discriminating binary fixture preserve the prior full-review verdict. No further review is required.
