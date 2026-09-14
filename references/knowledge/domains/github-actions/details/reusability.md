# Reusability

> Reusable workflows, composite actions, custom JavaScript/Docker actions, and versioning.

## Mechanism

GitHub Actions provides four mechanisms for code reuse, ordered from simplest to most complex:

1. **Composite actions** — Bundle multiple steps into a single callable action
2. **Reusable workflows** — Call entire workflows from other workflows
3. **JavaScript actions** — Custom logic using Node.js and the Actions toolkit
4. **Docker actions** — Custom logic packaged as Docker containers

## Reusable Workflows

### Defining a Reusable Workflow

A workflow becomes reusable by declaring `workflow_call` in its `on` configuration:

```yaml
# .github/workflows/reusable-deploy.yml
name: Reusable Deploy

on:
  workflow_call:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        type: string
        default: 'staging'
      version:
        required: true
        type: number
    secrets:
      api_token:
        required: true
    outputs:
      deploy_url:
        description: 'Deployment URL'
        value: ${{ jobs.deploy.outputs.url }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    outputs:
      url: ${{ steps.deploy.outputs.url }}
    steps:
      - run: deploy.sh ${{ inputs.environment }} ${{ inputs.version }}
        env:
          API_TOKEN: ${{ secrets.api_token }}
        id: deploy
```

### Calling a Reusable Workflow

```yaml
# .github/workflows/caller.yml
jobs:
  call-deploy:
    uses: ./.github/workflows/reusable-deploy.yml
    with:
      environment: production
      version: 42
    secrets:
      api_token: ${{ secrets.API_TOKEN }}

  call-external:
    uses: owner/repo/.github/workflows/reusable.yml@main
    secrets: inherit   # Pass all caller secrets (same org/enterprise only)
```

### Key Constraints

| Constraint | Value |
|-----------|-------|
| Max nesting depth | 10 levels |
| Location | `.github/workflows/` only (no subdirectories) |
| Environment secrets | Cannot be passed from caller via `secrets` |
| `inherit` scope | Same organization or enterprise only |
| Outputs with matrix | Last successful job's output wins |
| `jobs.<job_id>.uses` | Replaces `steps` — cannot mix `uses` and `steps` in same job |

### Passing Secrets to Nested Workflows

Secrets flow only to **directly called** workflows. In chain A → B → C:

```yaml
# Workflow A calls B
jobs:
  call-b:
    uses: ./.github/workflows/B.yml
    secrets: inherit   # All A's secrets → B

# Workflow B calls C
jobs:
  call-c:
    uses: ./.github/workflows/C.yml
    secrets:
      token: ${{ secrets.token }}   # Only explicit secrets → C
```

## Composite Actions

### Structure

```yaml
# action.yml
name: 'My Composite Action'
description: 'Does multiple things'
inputs:
  who-to-greet:
    description: 'Who to greet'
    required: true
    default: 'World'
outputs:
  greeting:
    description: 'The greeting'
    value: ${{ steps.greet.outputs.greeting }}

runs:
  using: "composite"
  steps:
    - name: Greet
      id: greet
      run: echo "greeting=Hello ${{ inputs.who-to-greet }}" >> $GITHUB_OUTPUT
      shell: bash
    - name: Follow-up
      run: echo "Goodbye!"
      shell: bash
```

### Usage

```yaml
- uses: ./.github/actions/my-composite-action
  with:
    who-to-greet: 'Mona'
- run: echo "${{ steps.greet-step.outputs.greeting }}"
```

### Composite Action Limitations

- Cannot use `secrets` context directly (must be passed as inputs)
- Cannot define `runs-on` (runs on caller's runner)
- Cannot use `needs` (not a job)
- Cannot set workflow-level env or permissions
- `github.action_path` provides the action's directory path

## Custom JavaScript Actions

### action.yml

```yaml
name: 'My JS Action'
description: 'Action description'
inputs:
  input1:
    description: 'An input'
    required: true
outputs:
  result:
    description: 'The result'

runs:
  using: 'node20'
  main: 'dist/index.js'
```

### Implementation

```javascript
// index.js
const core = require('@actions/core');
const github = require('@actions/github');

try {
  const input = core.getInput('input1');
  core.info(`Received: ${input}`);
  core.setOutput('result', `Processed: ${input}`);
} catch (error) {
  core.setFailed(error.message);
}
```

### Packaging

- Use `@vercel/ncc` or `rollup` to bundle dependencies into a single file
- Do NOT commit `node_modules`
- Commit the bundled `dist/index.js`

## Custom Docker Actions

### action.yml

```yaml
name: 'My Docker Action'
description: 'Action description'
inputs:
  input1:
    description: 'An input'
    required: true

runs:
  using: 'docker'
  image: 'Dockerfile'
  args:
    - ${{ inputs.input1 }}
  env:
    MY_VAR: value
```

### Dockerfile

```dockerfile
FROM alpine:3.18
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
```

Docker actions run on Linux runners only (the Docker daemon is not available on macOS/Windows runners in the same way).

## Action Reference Formats

```yaml
# Public repo - tag (mutable)
uses: actions/checkout@v5

# Public repo - SHA (immutable, recommended)
uses: actions/checkout@a81bbbf04b2e2b214f13d0d865e1c0f99c2ca0e0

# Same repo - local path
uses: ./.github/actions/my-action

# Public repo - branch
uses: owner/repo/.github/workflows/reusable.yml@main

# Docker image
uses: docker://node:20-alpine
```

## Versioning Best Practices

| Approach | Pros | Cons |
|----------|------|------|
| **SHA pinning** | Immutable, secure | Harder to read, manual updates |
| **Major version tag** (`@v4`) | Auto-updates within major | Tag can be force-pushed |
| **Exact version** (`@v4.1.2`) | Predictable | Manual updates needed |
| **Branch** (`@main`) | Always latest | Highly mutable, risky |

**Recommendation:** Pin to SHA for security-critical workflows; use major version tags for convenience with Dependabot updates enabled.

## Analysis

### Reusable Workflows vs Composite Actions

| Aspect | Reusable Workflow | Composite Action |
|--------|------------------|------------------|
| Granularity | Entire workflow | Multiple steps |
| Called from | `jobs.<id>.uses` | `steps[*].uses` |
| Runner | Can specify `runs-on` | Uses caller's runner |
| Jobs | Can have multiple jobs | No jobs (just steps) |
| Secrets | Declared in `workflow_call.secrets` | Passed as inputs |
| Outputs | Job-level mapped to workflow-level | Step-level mapped to action-level |
| Matrix | Full support | N/A |
| Permissions | Can set job-level | Cannot set permissions |

### When to Use What

| Scenario | Solution |
|----------|----------|
| Share a standard build/test/deploy pipeline across repos | **Reusable workflow** |
| Bundle setup + run steps into a single step | **Composite action** |
| Complex logic requiring external libraries | **JavaScript action** |
| Need a specific runtime/tool not on runners | **Docker action** |
| Simple shell script reuse | **Composite action** |

### The `inherit` Keyword

`secrets: inherit` passes all caller secrets to the called workflow. Only works within the same organization or enterprise. Use with caution — it bypasses explicit secret declaration, making it harder to audit what secrets are used.

### Output Propagation Chain

Data flows upward through three levels:
```
Step output → Job output → Workflow output (reusable) → Caller needs output
```

Example:
```yaml
# Reusable workflow
jobs:
  build:
    outputs:
      version: ${{ steps.build.outputs.version }}   # Step → Job
    steps:
      - id: build
        run: echo "version=1.0" >> $GITHUB_OUTPUT

on:
  workflow_call:
    outputs:
      version:
        value: ${{ jobs.build.outputs.version }}     # Job → Workflow

# Caller workflow
jobs:
  build:
    uses: ./.github/workflows/reusable.yml
  deploy:
    needs: build
    steps:
      - run: echo ${{ needs.build.outputs.version }}  # Workflow → Caller
```

## Layer 4 Pointers

- [Workflow Syntax](syntax.md) — `on.workflow_call`, `jobs.<id>.uses`, `steps[*].uses`.
- [Security & Authentication](security-auth.md) — Secret passing, `inherit` security implications.
- [Contexts & Expressions](contexts-expressions.md) — `inputs`, `jobs`, `needs` contexts for reusable workflows.
