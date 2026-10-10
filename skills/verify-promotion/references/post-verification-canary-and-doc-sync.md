## Post-Verification: Canary Monitoring

If the feature has a live URL (localhost or deployed), run a canary check.

For corrective, regression, deploy-affecting, or acceptance-critical
verification, also apply `references/pre-post-validation-loop.md`: identify the
exact command, journey, probe, or visual capture that proves the shipped change,
cite its pre-change/pre-deploy evidence when reachable, rerun the same proof
post-promotion, and classify the delta. A broad green suite can support the
verdict, but it does not replace an unclassified pre/post delta for the
acceptance-critical path.
When a machine-readable pre/post evidence file exists, validate it with
`node scripts/validate-pre-post-validation-evidence.mjs --evidence <path>` and
cite the result.

### Baseline Capture (BEFORE deploy)

Before any deployment, capture the pre-deploy baseline for every page in the feature's journeys:

1. Screenshot each page at desktop and mobile at minimum
2. Record console errors (if any pre-existing)
3. Measure page load time
4. Store as the comparison baseline

### Active Monitoring Loop

After deploy, monitor every 60 seconds for 5 minutes (5 checks minimum):

1. Open the app in browser (gstack browse)
2. For each page in the feature's key journeys:
   - Take a screenshot
   - Capture console errors
   - Measure page load time (performance.timing or equivalent)
   - Check for new 404 responses in network tab
3. Compare each metric against the pre-deploy baseline

### Alert Severity

| Severity | Condition | Action |
|----------|-----------|--------|
| CRITICAL | Page fails to load entirely | Stop monitoring, report immediately |
| HIGH | New console errors not present in baseline | Flag for investigation |
| MEDIUM | Page load time >= 2x baseline | Flag as performance regression |
| LOW | New 404 requests not present in baseline | Note in report |

**Transient tolerance:** only alert on patterns that persist across 2+ consecutive checks.
A single spike that resolves on the next check is logged but not alerted.

### Health Report

Produce a per-page status table at the end of monitoring:

```
CANARY HEALTH REPORT
Page                    | Load Time | Console Errors | Status
----------------------- | --------- | -------------- | -------
/dashboard              | 1.2s (ok) | 0 new          | HEALTHY
/dashboard/settings     | 3.8s (2x) | 2 new          | DEGRADED
/checkout               | TIMEOUT   | N/A            | BROKEN
```

Final verdict:
- **HEALTHY** — all pages healthy, no new errors, load times within tolerance
- **DEGRADED** — non-blocking issues found (MEDIUM/LOW alerts), feature works but needs attention
- **BROKEN** — any CRITICAL alert fired, or HIGH alerts persisted across all checks

## Post-Verification: Document Sync

After verification passes, reconcile documentation.

### Update Classification

Not all doc updates are equal. Classify each before acting:

- **Auto-update** (apply without asking): factual corrections — version numbers, file paths,
  command syntax, API signatures that changed in the diff
- **Ask-user** (present and wait for approval): narrative changes — rewording feature descriptions,
  changing architecture explanations, modifying onboarding guides, altering project positioning

### Reconciliation Steps

1. Read ONLY project docs that the shipped diff could affect. Check the diff
   file list (use the manifest's file set, or `git log --format=%H -1 -- docs/plans/` to find the promotion commit, then `git diff <commit>~1..<commit> --name-only`) — if no docs were touched
   and no public API changed, skip doc reconciliation entirely.
2. For touched docs: cross-reference the diff — does the doc still match?
3. Apply auto-updates; queue ask-user updates and present them as a batch

### Cross-Doc Consistency Checks

After updates, verify consistency across documents:

- README feature list matches CLAUDE.md capabilities section
- CHANGELOG latest version matches VERSION file
- Any "Getting Started" commands in README still work with current codebase
- Architecture diagrams reference files/modules that still exist

If any inconsistency is found, fix it (auto-update) or flag it (ask-user).

### TODOS.md Cleanup

1. Read TODOS.md (if it exists)
2. Mark completed items — cross-reference against the shipped diff to identify which TODOs were addressed
3. Scan for new TODO/FIXME/HACK comments introduced by the promotion.
   Use the promotion commit (from manifest or merge commit), not main..HEAD
   (which is empty after merge):
   ```bash
   # Find the promotion merge commit
   PROMO_COMMIT=$(git log --merges --format=%H -1)
   git diff "${PROMO_COMMIT}^..${PROMO_COMMIT}" | grep -E '^\+.*\b(TODO|FIXME|HACK)\b'
   ```
4. Add any new items to TODOS.md with file location and context
