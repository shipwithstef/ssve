# GSD SDK Internals (v1.50.0)

## Centralized Resolution Seams

To prevent logic duplication across workflows, GSD's SDK uses a robust query layer in `sdk/src/query/`. For example, MVP Mode (v1.50.0) introduces three core queries in `mvp.ts`:

### 1. `phase.mvp-mode`
Resolves the active MVP mode for a phase using a strict precedence chain:
1. `--cli-flag` argument (caller asserts `--mvp` was used).
2. ROADMAP.md presence of `**Mode:** mvp`.
3. `workflow.mvp_mode` in the project configuration.
4. Falls back to `false`.

### 2. `task.is-behavior-adding`
Predicates whether a task in `PLAN.md` adds user-visible behavior under MVP+TDD logic. It requires all three conditions:
- **`tdd="true"`**: Frontmatter declaration.
- **`<behavior>` block**: Exists and is non-empty.
- **Source files**: `<files>` contains at least one non-test, non-config source file.

### 3. `user-story.validate`
A centralized regex validator that enforces the shape:
`/^As a (?<role>.+?), I want to (?<capability>.+?), so that (?<outcome>.+?)\.$/`
Consumed by the `gsd-verifier` and interactive prompting to ensure high-quality goals.
