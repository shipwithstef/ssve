# Test Suites — detail

Moved verbatim from SKILL.md (progressive disclosure).

## Test Suites

### Suite 1: Pipeline Integrity (Static)

Validates all artifacts exist and cross-reference correctly.

```bash
bash test-framework/scripts/validate-pipeline-integrity.sh <project-root>
```

Checks: all SKILL.md files exist, manifest matches directories, AC IDs are consistent across specs/journeys, RESOLVED annotations point to real files, UX/UI designs reference valid specs.

### Suite 2: Progressive Narrowing (C1)

Dispatch 6 sub-agents in parallel:
- 3 agents: single prompt -> code (no methodology)
- 3 agents: full svc pipeline -> code

Diff outputs pairwise within each group. Report variance reduction with confidence interval.

The output is RUNNING CODE, not spec documents. Each agent produces files that compile and start.

### Suite 3: Token Efficiency (C2, C3)

**C2:** Count tokens for full `src/` load vs spec-referenced-only load on a real brownfield project. Report ratio.

**C3:** Run 3 sequential sub-agent tasks with prescribed artifact order. Run 3 with random order. Compare total_tokens across the second and third requests in each series.

### Suite 4: Review Protocol Effectiveness (C4)

Plant 5 known errors in a feature spec. Run single-pass review. Run full review-gate. Count detections. The test is adversarial -- it tries to break the review process.

### Suite 5: Checkpoint Drift (C5)

3-task implementation with and without checkpoints. Measure AC compliance at the end. The implementation must COMPILE AND RUN -- not just exist as text.

### Suite 6: Cascade Discovery (C6)

Give write-spec a Feature. Verify that Enabler dependencies are discovered automatically. The cascade must produce additional specs, not just a note saying dependencies exist.

### Suite 7: Worktree Isolation (C7)

Two features, two worktrees, parallel execution. Verify zero cross-contamination. This suite uses real git worktrees and real parallel agents.
