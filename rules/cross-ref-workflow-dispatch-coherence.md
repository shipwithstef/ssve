# Cross-Ref Workflow Dispatch Coherence

When dispatching a CI workflow on a different `--ref` than the ref your test proved success on, the same workflow filename can call **completely different reusable workflows** depending on which branch you dispatched from. The filename is identical; the build pipeline is not. Treat them as equivalent at your peril.

## The trap

A repo with multiple long-lived branches (e.g. `main`, an integration branch, a release branch, or feature branches) typically keeps the SAME service/build workflow filenames on every branch. The only thing that changes between branches is the `uses:` line — which pins the reusable workflow ref:

```yaml
# .github/workflows/build-service-X.yml on branch topic
jobs:
  build:
    uses: org/platform-repo/.github/workflows/build-X.yml@topic/new-pipeline

# .github/workflows/build-service-X.yml on branch main
jobs:
  build:
    uses: org/platform-repo/.github/workflows/build-X.yml@main
```

When you `gh workflow run build-service-X.yml --ref <branch>`, GitHub fires the workflow as defined on `<branch>`, which transitively calls whatever reusable-workflow ref is pinned in `<branch>`'s copy. **Two dispatches of identically-named workflows on different refs can land at completely different reusable workflows producing different artifacts.**

## The failure mode this rule prevents

Real scenario (de-identified):

1. Agent proves a new build pipeline on a feature branch — say `topic/new-pipeline-test`. The feature branch's `build-service-X.yml` calls `build-X.yml@topic/new-pipeline`. Builds succeed. Output artifacts have property P (e.g. consume a `*-SNAPSHOT` coord, or strip a debug header, or sign with a new key).
2. User asks: "this is slow, can we parallelize?" — bridge-style serial dispatch on the feature branch is rate-limited.
3. Agent switches to dispatching the SAME workflow filenames but `--ref main` to bypass the bottleneck and use the broader runner pool.
4. **Agent does not check what `main`'s copy of `build-service-X.yml` actually calls.** It still pins `build-X.yml@main` — the PRODUCTION reusable WITHOUT the new pipeline behavior. The PR that brings the new pipeline to `main` is still unmerged.
5. Dispatches succeed. Agent reports "N services built" as goal progress. But those builds went through the OLD pipeline — they don't have property P. The "success" is a silent regression from the proven test-branch state.
6. User has to explicitly ask "wait, shouldn't this be consuming the new artifact?" before the gap is recognized. Hours of debug-by-PR loops, wasted CI cycles, and trust burn.

## The rule — mandatory pre-flight before cross-ref dispatch

When the dispatch target's `--ref` is different from the ref where your test proved success, BEFORE dispatching, compare the reusable-workflow refs:

```bash
# Compare reusable-workflow refs between test ref and target ref
TEST_REF="<branch where test proved success>"
TARGET_REF="<branch you're about to dispatch on>"
WF="<workflow filename>"

for REF in "$TEST_REF" "$TARGET_REF"; do
  echo "=== $REF ==="
  gh api "repos/<owner>/<repo>/contents/.github/workflows/$WF?ref=$REF" \
    --jq '.content' | base64 -d | grep -E '^\s*uses:'
done
```

If the `@<ref>` part of the `uses:` line differs between test and target, **you are about to dispatch a different pipeline**. Three options:

1. **Land the PR that brings the proven reusable-workflow ref to the target branch first** (correct, slower).
2. **Keep dispatching from the test ref** (correct, slower, may be rate-limited).
3. **Accept that the target-ref dispatch consumes the OLD pipeline** and report progress as such — NOT as equivalent to the test-ref success.

Picking option 3 silently is the violation this rule blocks.

## Post-dispatch verification — log-level artifact check

Even after correct dispatch, do NOT claim "service consumed X" purely on green build status. Inspect at least one build's log for the dependency-resolution path:

```bash
gh run view <run-id> --log | grep -E "Downloaded.*<dep-coord>|Resolved.*<version-string>"
```

If you expected `1.2.3-SNAPSHOT` consumption and the log shows `1.2.3` (no `-SNAPSHOT` suffix), the build resolved against the release coord. Green build status does not prove the dependency-resolution path. The log does.

Same pattern for any artifact property the new pipeline is supposed to add: signature, manifest entry, build-arg propagation, image label, etc. Verify the property is in the output, not just that the build returned exit code 0.

## Why this generalizes

The pattern fires anywhere CI workflows reference reusable workflows by branch ref:

- GitHub Actions reusable workflows (`uses: org/repo/.github/workflows/X.yml@<ref>`)
- GitLab CI `include:` with `ref:`
- Jenkins shared libraries with `@Library('name@branch')`
- Buildkite plugin refs
- Bitbucket Pipes versions

Any "fan-out" or "trunk-and-leaf" CI architecture where leaves pin a ref to a trunk-defined pipeline carries this hazard. The branch chosen for dispatch determines which trunk version of the pipeline you actually run.

## How to enforce

- **`execute-changeset` Self-Verify** — for any work that proved success on a non-default branch and is being closed by dispatching the same workflows on a different branch, the closeout MUST include the dispatch-ref + reusable-workflow-ref pairing comparison output.
- **`verify-promotion` G7** — block any "fleet rebuild" or "fleet dispatch" closeout that does not include both (a) the cross-ref `uses:` comparison and (b) a sample build log showing the expected artifact-resolution evidence.
- **`audit-implementation`** — flag any session log where the agent reports "rebuilt N services with property P" without log-level verification of property P in at least one build's output.

## Severity when violated

HIGH. The failure mode is silent — green builds, fanned-out progress, plausible-looking reports — but the system is in a regressed state vs the proven test. Recovery requires re-dispatching everything once the correct pipeline is on the dispatch branch, AND the cost of the false-progress reports (operator trust, debug hours, CI minutes) is unrecoverable. Block at `review-gate` G7 if the pairing comparison is missing.

## Companion rules

- `rules/common/research-before-build.md` — verify before assuming
- `rules/post-fix-evidence-before-next-fix.md` — same discipline at the test-failure level
- `rules/destructive-git-ops.md` — same discipline at the git-state level
