# Advanced Features

> Job matrices, service containers, job containers, concurrency, outputs, environments, and conditional patterns.

## Mechanism

### Job Matrices

A matrix strategy creates multiple job runs from a single job definition:

```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: true
      max-parallel: 4
      matrix:
        os: [ubuntu-latest, windows-latest]
        node: [18, 20, 22]
        include:
          - os: macos-latest
            node: 20
            experimental: true
        exclude:
          - os: windows-latest
            node: 18
```

**Matrix properties:**
- `fail-fast: true` — Cancels all in-progress matrix jobs if any job fails
- `max-parallel` — Limits concurrent matrix jobs
- `include` — Adds additional combinations not in the Cartesian product
- `exclude` — Removes specific combinations

Maximum 256 matrix jobs per workflow.

### Service Containers

Service containers run alongside job steps, useful for databases, caches, and message queues:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
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
      redis:
        image: redis:7
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - run: pg_isready -h localhost -p 5432
      - run: redis-cli -h localhost -p 6379 ping
```

**Service networking:**
- Services are accessible via `localhost` on the mapped host port
- The actual container port is also available via `job.services.<id>.ports[<port>]`
- All services share a Docker network created by the runner

### Job Containers

Run the entire job inside a container:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    container:
      image: node:20-alpine
      env:
        NODE_ENV: test
      ports:
        - 8080:80
      volumes:
        - my_vol:/data
      options: --cpus 1 --memory 1g
      credentials:
        username: ${{ secrets.DOCKER_USER }}
        password: ${{ secrets.DOCKER_PASSWORD }}
    steps:
      - run: node --version
```

If both `container` and `services` are defined, the job container and service containers share the same network.

### Concurrency

Prevent simultaneous runs of the same workflow/job:

```yaml
# Workflow-level concurrency
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

# Job-level concurrency
jobs:
  deploy:
    concurrency:
      group: production
      cancel-in-progress: false
```

**Behavior:**
- Group names are case-insensitive
- At most one running and one pending job per group
- New queued jobs cancel existing pending jobs in the same group
- `cancel-in-progress: true` also cancels running jobs

### Job Outputs

Pass data between jobs:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.build.outputs.version }}
      commit: ${{ github.sha }}
    steps:
      - id: build
        run: echo "version=1.2.3" >> $GITHUB_OUTPUT

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying ${{ needs.build.outputs.version }}"
```

**Limitations:**
- Outputs are strings only
- Max size: 1 MB per output [VERIFY]
- Only direct dependencies are available in `needs`

### Environment Protection Rules

Deployment environments provide protection rules:

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: production
      url: ${{ steps.deploy.outputs.url }}
    steps:
      - run: deploy.sh
```

**Protection rules (configured in repo settings):**
- Required reviewers — Specific people must approve before deployment
- Wait timer — Delay before deployment proceeds
- Deployment branches — Only allow deployment from specific branches
- Prevent self-review — Reviewers cannot approve their own deployments

### Conditional Logic Patterns

```yaml
# Run only on main branch
if: github.ref == 'refs/heads/main'

# Run only for PRs
if: github.event_name == 'pull_request'

# Run on failure
if: failure()

# Run on failure but not cancellation
if: failure() && !cancelled()

# Run always (even on failure/cancel)
if: always()

# Run only if previous step failed
if: steps.test.outcome == 'failure'

# Run if specific file changed (requires paths filter or manual check)
if: contains(github.event.head_commit.message, '[deploy]')

# Run for specific actors
if: github.actor == 'dependabot[bot]'

# Run for specific repositories
if: github.repository == 'owner/repo'

# Combine conditions
if: github.ref == 'refs/heads/main' && github.event_name == 'push'
```

## Analysis

### Matrix Dimension Explosion

Each dimension multiplies the total jobs. A matrix with `os: [3] × node: [3] × browser: [3]` creates 27 jobs. Watch your minute consumption:

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]  # 3
    node: [18, 20, 22]                                  # 3
    browser: [chrome, firefox, safari]                   # 3
    # Total: 27 jobs × 10 min = 270 minutes
    # With macOS 10x multiplier: 90 macOS minutes = 900 billed minutes
```

Use `exclude` to prune unnecessary combinations and `max-parallel` to control resource usage.

### Service Container Port Mapping

When you map ports like `5432:5432`, the host port is what you use in your steps (`localhost:5432`). However, if the host port is dynamically assigned (by omitting the host port):

```yaml
services:
  postgres:
    image: postgres
    ports:
      - 5432   # Maps container port 5432 to a random host port
```

Access the mapped port via the `job` context:
```yaml
run: psql -h localhost -p ${{ job.services.postgres.ports[5432] }}
```

### Container vs Service Containers

| Aspect | Job `container` | `services` |
|--------|----------------|-----------|
| Runs the job inside | Yes | No |
| Shared with steps | All steps | All steps |
| Network | Isolated + services network | Services network |
| Use case | Custom runtime environment | Databases, caches, brokers |

### `continue-on-error` Semantics

- `jobs.<id>.continue-on-error: true` — Job failure does not fail the workflow
- `steps[*].continue-on-error: true` — Step failure does not fail the job
- `steps.<id>.outcome` — Result BEFORE continue-on-error (`success`/`failure`)
- `steps.<id>.conclusion` — Final result AFTER continue-on-error (`success`/`failure`)

```yaml
steps:
  - id: flaky-test
    continue-on-error: true
    run: npm run flaky-test
  - run: echo "Step outcome: ${{ steps.flaky-test.outcome }}"   # failure
  - run: echo "Step conclusion: ${{ steps.flaky-test.conclusion }}" # success
```

### Concurrency Cancel Race Conditions

When using `cancel-in-progress: true`, be aware that:
- Cancellation is not instantaneous
- Steps in the cancelled job may still run to completion
- Use `if: !cancelled()` on cleanup steps that must run even during cancellation

```yaml
steps:
  - run: do-work
  - name: Cleanup
    if: always() && !cancelled()
    run: cleanup-resources
```

### Environment URL

The `environment.url` is displayed in the deployment history on GitHub. It can reference step outputs but not the `needs` context (since it's defined on the same job).

```yaml
environment:
  name: production
  url: ${{ steps.deploy.outputs.url }}
```

### Conditional Step After Failed Step

To run a step only if a previous step failed:

```yaml
steps:
  - id: test
    run: npm test
  - name: Upload failure logs
    if: steps.test.outcome == 'failure'
    uses: actions/upload-artifact@v4
    with:
      name: failure-logs
      path: logs/
```

## Layer 4 Pointers

- [Workflow Syntax](syntax.md) — Full syntax for `strategy`, `container`, `services`, `concurrency`, `outputs`.
- [Contexts & Expressions](contexts-expressions.md) — `strategy`, `matrix`, `job`, `needs` contexts.
- [Runners](runners.md) — Runner specs for matrix OS selection.
- [Security & Authentication](security-auth.md) — Environment protection rules and secrets.
