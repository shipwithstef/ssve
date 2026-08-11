# Framework Improvement: Route-Workflow GitHub Auth Recovery

## Gap

`improve-framework` already had a deterministic Step 6c recovery for GitHub
auth mismatches, but `route-workflow` Publication-State Closeout did not. That
allowed a mutating framework closeout to stop after `Repository not found` even
when the remote owner account already existed locally in `gh auth status`.

## Evidence

During the Android Play version reuse guard closeout, `git push origin main`
failed against `s7an-it/seriousvibecoding` while the active GitHub CLI account
was `archived-contributor`. The framework state already records this exact recovery
as allowed: switch once to the owner encoded in the remote URL, retry, and
restore the previous account. The first closeout answer incorrectly stopped
before applying that rule.

## Change

- `route-workflow/SKILL.md` Publication-State Closeout now explicitly requires
  the same deterministic auth-failure recovery before reporting push/fetch
  failure.
- `test-framework/evals/tier-1/validate-route-workflow-publication-state.sh`
  now asserts the `Repository not found` classification, `gh auth switch`
  recovery, previous-account restore, and no-new-auth guard.

## Acceptance

- Framework closeout must classify GitHub auth failures before surrendering.
- If the remote owner exists locally in `gh auth status`, route-workflow must
  switch once, retry once, restore the previous account, and report the outcome.
- The recovery must not create credentials, change remotes, cycle accounts, or
  force-push.

## Rollback

Revert this proposal plus the `route-workflow` and tier-1 eval hunks if
publication-state closeout is moved into a shared script that implements the
same auth-failure recovery mechanically.
