# Pre/Post Validation Loop

Use this contract when a task changes behavior, fixes a regression, deploys a
runtime surface, or reruns acceptance evidence after a correction.

## Required Loop

1. Select the acceptance-critical command, journey, probe, or visual capture
   before changing the code or deploying the fix.
2. Run the pre-change baseline when the target state is reachable. Record the
   exact command, target URL or environment, git SHA, fixture/account identity,
   exit status, and output path.
3. Apply exactly one fix batch.
4. Rerun the same command or journey against the post-change target. Keep the
   command, fixture/account identity, viewport, and target class the same unless
   the change itself moves the target. If the target changes, record why.
5. Compare pre and post results. Classify every failing or changed signal as
   `fixed-by-change`, `branch-introduced`, `pre-existing`, or `blocked`.
6. Iterate only on `branch-introduced` or intended-but-not-fixed signals:
   fix, rerun the same failing command, compare again, and append the result.
7. Do not close as verified while any acceptance-critical failure is unclassified
   or `branch-introduced`.

## If No Baseline Is Possible

Record `no_pre_baseline_reason` and replace the missing baseline with one of:

- an old-path-fails/new-path-passes probe against the same input
- a detached `origin/main` worktree running the same command
- a quoted provider/environment blocker plus the WI or task that will make the
  baseline runnable

The closeout must say explicitly that no pre-change baseline was available.

## Closeout Evidence Fields

Every applicable closeout summary should include:

```yaml
pre_post_validation:
  command: "<exact command or journey id>"
  pre:
    status: "pass|fail|blocked|not-run"
    evidence: "<path or command output reference>"
  post:
    status: "pass|fail|blocked"
    evidence: "<path or command output reference>"
  comparison: "fixed-by-change|unchanged|branch-introduced|pre-existing|blocked"
  iterations: <count>
```

Passing a broad test suite is not a substitute for this loop unless the suite is
the exact command selected in step 1 and the pre/post comparison is recorded.

For machine-checked closeouts, write the same evidence as JSON and run:

```bash
node scripts/validate-pre-post-validation-evidence.mjs --evidence <pre-post-evidence.json>
```

The validator rejects:

- post-change command, target, environment, fixture account, or viewport drift
  from the selected proof unless the changed target is omitted and explained in
  the closeout
- `pre.status: "not-run"` without `no_pre_baseline_reason` and a valid
  `baseline_replacement`
- acceptance-critical `branch-introduced` final comparisons or changed signals
- missing classification for changed signals
- more than one fix batch inside a single iteration record

This validator does not prove the semantic truth of the classification by
itself; it prevents unverifiable evidence shape, command substitution, and
unclassified acceptance-critical deltas from closing as verified.
