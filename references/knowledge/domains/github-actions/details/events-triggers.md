# Events & Triggers

> Complete catalog of GitHub Actions workflow trigger events.

## Mechanism

Workflows are triggered by **events**. Each event corresponds to a webhook payload. Some events have **activity types** (sub-events) that allow fine-grained control. Events can be filtered by **branches**, **tags**, or **paths**.

### Event Configuration Syntax

```yaml
on:
  <event_name>:
    types: [activity1, activity2]   # Optional. Activity types.
    branches: [main, 'releases/**'] # Optional. Branch filter (push, PR, workflow_run).
    branches-ignore: [canary]       # Optional. Exclude branches.
    tags: ['v1.*']                  # Optional. Tag filter (push only).
    tags-ignore: ['v2']             # Optional. Exclude tags.
    paths: ['src/**']               # Optional. Path filter (push, PR).
    paths-ignore: ['docs/**']       # Optional. Exclude paths.
```

### Core CI/CD Events

| Event | Activity Types | GITHUB_SHA | GITHUB_REF | Filters |
|-------|---------------|------------|------------|---------|
| `push` | N/A | Tip commit | Updated ref | branches, tags, paths |
| `pull_request` | assigned, unassigned, labeled, unlabeled, opened, edited, closed, reopened, synchronize, converted_to_draft, locked, unlocked, enqueued, dequeued, milestoned, demilestoned, ready_for_review, review_requested, review_request_removed, auto_merge_enabled, auto_merge_disabled | Last merge commit | `refs/pull/N/merge` | branches, paths |
| `pull_request_target` | Same as pull_request | Last commit on default branch | Default branch | branches, paths |
| `workflow_dispatch` | N/A | Last commit on default branch | Default branch | inputs |
| `workflow_call` | N/A | Caller's SHA | Caller's ref | inputs, secrets |
| `workflow_run` | requested, completed | Last commit on default branch | Default branch | branches |
| `schedule` | N/A | Last commit on default branch | Default branch | cron |

### Repository Events

| Event | Activity Types | Notes |
|-------|---------------|-------|
| `branch_protection_rule` | created, edited, deleted | Default branch only |
| `create` | N/A | Branch or tag created |
| `delete` | N/A | Branch or tag deleted |
| `fork` | N/A | Repository forked |
| `gollum` | N/A | Wiki page created/updated |
| `public` | N/A | Repo changed from private to public |
| `page_build` | N/A | GitHub Pages source branch pushed |

### Issue & Discussion Events

| Event | Activity Types | Notes |
|-------|---------------|-------|
| `issues` | opened, edited, deleted, transferred, pinned, unpinned, closed, reopened, assigned, unassigned, labeled, unlabeled, locked, unlocked, milestoned, demilestoned, typed, untyped | Default branch only |
| `issue_comment` | created, edited, deleted | Fires on both issues AND PRs |
| `discussion` | created, edited, deleted, transferred, pinned, unpinned, labeled, unlabeled, locked, unlocked, category_changed, answered, unanswered | Default branch only [VERIFY] |
| `discussion_comment` | created, edited, deleted | Default branch only [VERIFY] |
| `label` | created, edited, deleted | Default branch only |
| `milestone` | created, closed, opened, edited, deleted | Default branch only |

### Pull Request Review Events

| Event | Activity Types | Notes |
|-------|---------------|-------|
| `pull_request_review` | submitted, edited, dismissed | |
| `pull_request_review_comment` | created, edited, deleted | Comments on diff |

### Deployment & Registry Events

| Event | Activity Types | Notes |
|-------|---------------|-------|
| `deployment` | N/A | Deployment created |
| `deployment_status` | N/A | Third-party deployment status |
| `registry_package` | published, updated | GitHub Packages |
| `release` | published, unpublished, created, edited, deleted, prereleased, released | |

### Check Events

| Event | Activity Types | Notes |
|-------|---------------|-------|
| `check_run` | created, rerequested, completed, requested_action | Default branch only; skips if created by Actions |
| `check_suite` | completed | Default branch only; skips if created by Actions |
| `merge_group` | checks_requested | For merge queues; required for merge queue CI |

### External & Scheduled Events

| Event | Description |
|-------|-------------|
| `schedule` | Cron-based scheduling. Runs on default branch. Min interval: 5 minutes. Disabled after 60 days of inactivity in public repos. |
| `repository_dispatch` | Triggered via GitHub API with custom `event_type`. Max 10 top-level properties in `client_payload`, 65,535 chars. |
| `image_version` | New image version available [VERIFY: availability scope] |

### Activity Type Defaults

Not all activity types trigger by default:

| Event | Default Types |
|-------|--------------|
| `pull_request` | `opened`, `synchronize`, `reopened` |
| `pull_request_target` | `opened`, `synchronize`, `reopened` |
| All others with types | **All** activity types trigger by default |

### Filter Pattern Cheat Sheet

```yaml
# Include specific branches
branches:
  - main
  - 'releases/**'
  - 'feature/**'

# Exclude branches (use branches-ignore OR ! prefix)
branches-ignore:
  - 'canary'
branches:
  - 'releases/**'
  - '!releases/**-alpha'

# Include tags
push:
  tags:
    - 'v1.*'
    - 'v2.*'

# Path filters
paths:
  - '**.js'              # All JS files
  - 'src/**'             # src directory recursively
  - '!src/**/*.test.js'  # Exclude test files

# Combined: both branch AND path must match
on:
  pull_request:
    branches: [main]
    paths: ['src/**']
```

## Analysis

### `pull_request` vs `pull_request_target`

| Aspect | `pull_request` | `pull_request_target` |
|--------|---------------|----------------------|
| Context | Merge commit (`refs/pull/N/merge`) | Base branch (default branch) |
| GITHUB_SHA | Merge commit SHA | Last commit on default branch |
| Secrets access | No secrets from forks | Yes, all secrets available |
| GITHUB_TOKEN | Read-only for forks | Read/write for forks |
| Code checked out | Merge branch | Default branch |
| Use case | Build/test PR code | Label/comment on PRs, non-code tasks |
| Security risk | Lower (runs untrusted code in limited context) | **High** (write access + secrets with untrusted code) |

**Critical:** Never checkout and run untrusted code from `pull_request_target`. If you need to build PR code with write permissions, use `pull_request` with workflow_run trigger pattern.

### `schedule` Limitations

- Scheduled workflows run on the **default branch only**.
- In public repositories, scheduled workflows are **automatically disabled after 60 days of inactivity**.
- The `schedule` event can be delayed during high-load periods (start of every hour).
- Minimum interval is **5 minutes**.
- Non-standard cron syntax (`@yearly`, `@daily`, etc.) is **not supported**.

### `workflow_call` Constraints

- A workflow must declare `on: workflow_call:` to be callable.
- Called workflows live in `.github/workflows/`; subdirectories are **not supported**.
- Maximum **10 levels** of workflow nesting.
- Environment secrets **cannot** be passed from caller to called workflow via `secrets`. If the called workflow declares an `environment` at the job level, it uses that environment's secrets.

### `workflow_run` Usage Pattern

The `workflow_run` event enables the "split workflow" security pattern: run untrusted code in a `pull_request` workflow (no secrets), then trigger a privileged `workflow_run` workflow that has access to secrets and can post comments, update checks, etc.

```yaml
# Privileged workflow triggered by completion of another
on:
  workflow_run:
    workflows: ["Build"]
    types: [completed]
    branches: [main]
```

### Event Payload Size

- `workflow_dispatch` inputs: max **25** top-level properties, **65,535** characters payload.
- `repository_dispatch` client_payload: max **10** top-level properties, **65,535** characters.

### `issue_comment` Distinguishing Issues vs PRs

```yaml
if: github.event.issue.pull_request  # True if comment is on a PR
if: ${{ !github.event.issue.pull_request }}  # True if comment is on an issue
```

## Layer 4 Pointers

- [Workflow Syntax](syntax.md) — Filter syntax (`branches`, `paths`, `tags`) in detail.
- [Contexts & Expressions](contexts-expressions.md) — Using `github.event` to access payload data.
- [Security & Authentication](security-auth.md) — Fork security, `pull_request_target` risks.
- [Reusability](reusability.md) — `workflow_call`, `workflow_run` patterns.
