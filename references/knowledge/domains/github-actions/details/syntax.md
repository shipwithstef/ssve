# Workflow Syntax Reference

> Complete reference for GitHub Actions workflow YAML syntax.

## Mechanism

Workflow files use YAML syntax with `.yml` or `.yaml` extension, stored in `.github/workflows/`. GitHub evaluates the workflow file when an event matching the `on` configuration occurs.

### Top-Level Keys

```yaml
name: Workflow Name           # Optional. Displayed in Actions tab.
run-name: Run by ${{ github.actor }}  # Optional. Run name with expressions.
on:                           # Required. Event triggers.
env:                          # Optional. Env vars for all jobs.
defaults:                     # Optional. Default settings for all jobs.
permissions:                  # Optional. GITHUB_TOKEN permissions (workflow-wide).
concurrency:                  # Optional. Concurrency group (workflow-wide).
jobs:                         # Required. Map of job definitions.
```

### `on` — Event Configuration

Single event:
```yaml
on: push
```

Multiple events:
```yaml
on: [push, pull_request, workflow_dispatch]
```

Event with configuration:
```yaml
on:
  push:
    branches:
      - main
      - 'releases/**'
    tags:
      - 'v1.*'
    paths:
      - 'src/**'
      - '!src/**/*.test.js'
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment'
        required: true
        type: choice
        options: [dev, staging, prod]
  schedule:
    - cron: '0 2 * * *'
      timezone: "America/New_York"
  workflow_call:
    inputs:
      config-path:
        required: true
        type: string
    secrets:
      token:
        required: false
    outputs:
      result:
        description: "Result"
        value: ${{ jobs.build.outputs.result }}
```

### `jobs` — Job Configuration

```yaml
jobs:
  <job_id>:
    name: Display Name
    needs: [job1, job2]         # Dependencies; this job runs after these complete.
    runs-on: ubuntu-latest      # Runner label(s).
    outputs:                    # Data passed to downstream jobs.
      output1: ${{ steps.step1.outputs.val }}
    env:                        # Env vars scoped to this job.
      KEY: value
    defaults:                   # Defaults scoped to this job.
      run:
        shell: bash
        working-directory: ./src
    if: github.ref == 'refs/heads/main'   # Conditional job execution.
    steps: [...]                # List of steps (see below).
    strategy:                   # Matrix configuration.
      matrix:
        os: [ubuntu-latest, windows-latest]
        node: [18, 20]
      fail-fast: true
      max-parallel: 4
    continue-on-error: false    # Whether job failure fails the workflow.
    timeout-minutes: 360        # Max job runtime.
    container:                  # Run job inside this container.
      image: node:20
      env:
        NODE_ENV: test
      ports:
        - 8080:80
      volumes:
        - my_vol:/data
      options: --cpus 1
      credentials:
        username: ${{ secrets.DOCKER_USER }}
        password: ${{ secrets.DOCKER_PASSWORD }}
    services:                   # Service containers for this job.
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    environment:                # Deployment environment.
      name: production
      url: ${{ steps.deploy.outputs.url }}
    permissions:                # GITHUB_TOKEN permissions for this job.
      contents: read
      packages: write
    secrets:                    # Only used when calling reusable workflows.
      token: ${{ secrets.GITHUB_TOKEN }}
    with:                       # Only used when calling reusable workflows.
      input1: value
```

### `steps` — Step Configuration

```yaml
steps:
  - id: step-id               # Unique identifier for the step.
    name: Step Name           # Display name.
    uses: actions/checkout@v5 # Invoke an action.
    with:                     # Action inputs.
      repository: owner/repo
      ref: main
    env:                      # Env vars scoped to this step.
      KEY: value
    if: runner.os == 'Linux'  # Conditional step execution.
    continue-on-error: true   # Step failure doesn't fail the job.
    timeout-minutes: 10       # Max step runtime.
    working-directory: ./app  # Working directory for run steps.
    shell: bash               # Shell for run steps.
    run: |                    # Shell command(s) to execute.
      echo "Hello"
      npm test
```

### `uses` Reference Formats

```yaml
# Public repo action
uses: actions/checkout@v5
uses: actions/checkout@a81bbbf  # SHA (recommended for security)
uses: actions/checkout@refs/tags/v1.2.3  # Full tag ref

# Same repo action
uses: ./.github/actions/my-action

# Reusable workflow (caller syntax)
uses: owner/repo/.github/workflows/reusable.yml@main
uses: ./.github/workflows/reusable.yml

# Docker action
uses: docker://node:20-alpine
```

### Filter Patterns

GitHub Actions uses glob patterns for `branches`, `tags`, `paths`:

| Pattern | Description |
|---------|-------------|
| `*` | Matches any character except `/` |
| `**` | Matches any number of any characters including `/` |
| `?` | Matches exactly one character except `/` |
| `+` | Matches one or more of the preceding character |
| `!` | Negates a pattern (exclusion) |
| `[abc]` | Matches any character in brackets |

Branch/tag examples:
```yaml
branches:
  - main
  - 'mona/octocat'
  - 'releases/**'
  - '!releases/**-alpha'   # Exclude alpha releases
```

Path examples:
```yaml
paths:
  - '**.js'                 # All JS files anywhere
  - 'src/**'                # Everything under src/
  - '!src/**/*.test.js'     # Except test files
```

Important filter rules:
- You cannot use both `branches` and `branches-ignore` for the same event.
- You cannot use both `paths` and `paths-ignore` for the same event.
- If both branch/tag and path filters are defined, **both** must be satisfied.
- Order matters: a negative pattern after a positive match excludes; a positive after a negative re-includes.
- Diffs are limited to 300 files. If changed files aren't in the first 300 matched, the workflow won't run.

## Analysis

### `if` Auto-Expression Evaluation
- The `if` keyword on jobs and steps **automatically evaluates expressions** — you do NOT need `${{ }}` wrappers.
- Example: `if: github.ref == 'refs/heads/main'` works; `if: ${{ github.ref == 'refs/heads/main' }}` also works but is redundant.
- The exception: when `if` is combined with expressions that use environment variables or need explicit evaluation boundaries.

### `!` Escaping in `if`
- In YAML, `!` is a special tag character. To use the logical NOT operator in `if`, you must wrap in `${{ }}`:
  ```yaml
  if: ${{ !startsWith(github.ref, 'refs/tags/') }}
  ```
- Without `${{ }}`, `!` may cause YAML parsing errors.

### `run-name` vs `name`
- `name` is the workflow name shown in the Actions tab.
- `run-name` is the name of an individual workflow run. It can reference `github` and `inputs` contexts.

### `permissions` Scoping
- If you specify ANY permission at workflow or job level, all **unspecified** permissions are set to `none`.
- This is a powerful security feature — it defaults to deny.
- `permissions: read-all` and `permissions: write-all` grant blanket access.
- `permissions: {}` grants no permissions.

### `concurrency` Pitfalls
- Concurrency group names are **case-insensitive** (`prod` == `Prod`).
- There can be at most one running and one pending job per group.
- When a new job is queued, any existing pending job in the same group is canceled.
- Use `cancel-in-progress: true` to also cancel running jobs.
- Build group names with fallback values to avoid undefined context errors:
  ```yaml
  concurrency:
    group: ${{ github.head_ref || github.run_id }}
    cancel-in-progress: true
  ```

### `timeout-minutes` Defaults
- Default job timeout is **360 minutes** (6 hours) for GitHub-hosted runners.
- Self-hosted runners may have different defaults.
- Workflow-level timeout controls are not available; set per-job.

### Container Credentials
- Docker credentials for `container` and `services` can reference `secrets` context.
- These are the only places in job configuration where `secrets` context is available outside steps.

## Layer 4 Pointers

- [Events & Triggers](events-triggers.md) — Full event catalog and activity types.
- [Contexts & Expressions](contexts-expressions.md) — Expression syntax, all 11 contexts, and functions.
- [Security & Authentication](security-auth.md) — `permissions` deep dive, secrets, OIDC.
- [Runners](runners.md) — `runs-on` labels, runner specs, self-hosted setup.
- [Reusability](reusability.md) — `uses` semantics for actions and reusable workflows.
- [Advanced Features](advanced-features.md) — Matrices, containers, concurrency patterns, outputs.
