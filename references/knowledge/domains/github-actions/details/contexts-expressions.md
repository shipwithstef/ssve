# Contexts & Expressions

> Reference for all 11 contexts, expression syntax, and built-in functions.

## Mechanism

Contexts are collections of variables that provide metadata about the workflow run, runner environment, and job execution. They are accessed using property dereference (`github.ref`) or index syntax (`github['ref']`).

### Context Availability Matrix

Not all contexts are available in every workflow key. Below is the complete availability map:

| Workflow Key | Available Contexts | Special Functions |
|-------------|-------------------|-------------------|
| `run-name` | `github`, `inputs`, `vars` | None |
| `concurrency` | `github`, `inputs`, `vars` | None |
| `env` | `github`, `secrets`, `inputs`, `vars` | None |
| `jobs.<job_id>.concurrency` | `github`, `needs`, `strategy`, `matrix`, `inputs`, `vars` | None |
| `jobs.<job_id>.container` | `github`, `needs`, `strategy`, `matrix`, `vars`, `inputs` | None |
| `jobs.<job_id>.container.credentials` | `github`, `needs`, `strategy`, `matrix`, `env`, `vars`, `secrets`, `inputs` | None |
| `jobs.<job_id>.container.env.<env_id>` | `github`, `needs`, `strategy`, `matrix`, `job`, `runner`, `env`, `vars`, `secrets`, `inputs` | None |
| `jobs.<job_id>.container.image` | `github`, `needs`, `strategy`, `matrix`, `vars`, `inputs` | None |
| `jobs.<job_id>.continue-on-error` | `github`, `needs`, `strategy`, `vars`, `matrix`, `inputs` | None |
| `jobs.<job_id>.defaults.run` | `github`, `needs`, `strategy`, `matrix`, `env`, `vars`, `inputs` | None |
| `jobs.<job_id>.env` | `github`, `needs`, `strategy`, `matrix`, `vars`, `secrets`, `inputs` | None |
| `jobs.<job_id>.environment` | `github`, `needs`, `strategy`, `matrix`, `vars`, `inputs` | None |
| `jobs.<job_id>.environment.url` | `github`, `needs`, `strategy`, `matrix`, `job`, `runner`, `env`, `vars`, `steps`, `inputs` | None |
| `jobs.<job_id>.if` | `github`, `needs`, `vars`, `inputs` | `always`, `cancelled`, `success`, `failure` |
| `jobs.<job_id>.name` | `github`, `needs`, `strategy`, `matrix`, `vars`, `inputs` | None |
| `jobs.<job_id>.outputs.<output_id>` | `github`, `needs`, `strategy`, `matrix`, `job`, `runner`, `env`, `vars`, `secrets`, `steps`, `inputs` | None |
| `jobs.<job_id>.runs-on` | `github`, `needs`, `strategy`, `matrix`, `vars`, `inputs` | None |
| `jobs.<job_id>.secrets.<secret_id>` | `github`, `needs`, `strategy`, `matrix`, `secrets`, `inputs`, `vars` | None |
| `jobs.<job_id>.services` | `github`, `needs`, `strategy`, `matrix`, `vars`, `inputs` | None |
| `jobs.<job_id>.services.<id>.credentials` | `github`, `needs`, `strategy`, `matrix`, `env`, `vars`, `secrets`, `inputs` | None |
| `jobs.<job_id>.services.<id>.env.<env_id>` | `github`, `needs`, `strategy`, `matrix`, `job`, `runner`, `env`, `vars`, `secrets`, `inputs` | None |
| `jobs.<job_id>.steps.continue-on-error` | `github`, `needs`, `strategy`, `matrix`, `job`, `runner`, `env`, `vars`, `secrets`, `steps`, `inputs` | `hashFiles` |
| `jobs.<job_id>.steps.env` | `github`, `needs`, `strategy`, `matrix`, `job`, `runner`, `env`, `vars`, `secrets`, `steps`, `inputs` | `hashFiles` |
| `jobs.<job_id>.steps.if` | `github`, `needs`, `strategy`, `matrix`, `job`, `runner`, `env`, `vars`, `steps`, `inputs` | `always`, `cancelled`, `success`, `failure`, `hashFiles` |
| `jobs.<job_id>.steps.name` | `github`, `needs`, `strategy`, `matrix`, `job`, `runner`, `env`, `vars`, `secrets`, `steps`, `inputs` | `hashFiles` |
| `jobs.<job_id>.steps.run` | `github`, `needs`, `strategy`, `matrix`, `job`, `runner`, `env`, `vars`, `secrets`, `steps`, `inputs` | `hashFiles` |
| `jobs.<job_id>.steps.timeout-minutes` | `github`, `needs`, `strategy`, `matrix`, `job`, `runner`, `env`, `vars`, `secrets`, `steps`, `inputs` | `hashFiles` |
| `jobs.<job_id>.steps.with` | `github`, `needs`, `strategy`, `matrix`, `job`, `runner`, `env`, `vars`, `secrets`, `steps`, `inputs` | `hashFiles` |
| `jobs.<job_id>.steps.working-directory` | `github`, `needs`, `strategy`, `matrix`, `job`, `runner`, `env`, `vars`, `secrets`, `steps`, `inputs` | `hashFiles` |
| `jobs.<job_id>.strategy` | `github`, `needs`, `vars`, `inputs` | None |
| `jobs.<job_id>.timeout-minutes` | `github`, `needs`, `strategy`, `matrix`, `vars`, `inputs` | None |
| `jobs.<job_id>.with.<with_id>` | `github`, `needs`, `strategy`, `matrix`, `inputs`, `vars` | None |
| `on.workflow_call.inputs.<input_id>.default` | `github`, `inputs`, `vars` | None |
| `on.workflow_call.outputs.<output_id>.value` | `github`, `jobs`, `vars`, `inputs` | None |

### The 11 Contexts

#### `github` — Workflow Run Information

| Property | Type | Description |
|----------|------|-------------|
| `github.action` | string | Action name or step `id` |
| `github.action_path` | string | Action location path (composite only) |
| `github.action_ref` | string | Ref of action being executed |
| `github.action_repository` | string | `owner/repo` of action |
| `github.action_status` | string | Current result of composite action |
| `github.actor` | string | User who triggered the workflow |
| `github.actor_id` | string | Account ID of triggerer |
| `github.api_url` | string | GitHub REST API URL |
| `github.base_ref` | string | Target branch of PR |
| `github.env` | string | Path to env file for workflow commands |
| `github.event` | object | Full webhook payload |
| `github.event_name` | string | Name of triggering event |
| `github.event_path` | string | Path to event payload file |
| `github.graphql_url` | string | GitHub GraphQL API URL |
| `github.head_ref` | string | Source branch of PR |
| `github.job` | string | Current `job_id` |
| `github.path` | string | Path to PATH file for workflow commands |
| `github.ref` | string | Full ref (`refs/heads/main`, `refs/tags/v1`) |
| `github.ref_name` | string | Short ref name (`main`, `v1`) |
| `github.ref_protected` | boolean | True if branch protection/rulesets exist |
| `github.ref_type` | string | `branch` or `tag` |
| `github.repository` | string | `owner/repo` |
| `github.repository_id` | string | Repository ID |
| `github.repository_owner` | string | Owner username |
| `github.repository_owner_id` | string | Owner account ID |
| `github.repositoryUrl` | string | Git URL |
| `github.retention_days` | string | Log/artifact retention days |
| `github.run_id` | string | Unique run ID within repo |
| `github.run_number` | string | Run number for this workflow |
| `github.run_attempt` | string | Attempt number (1, 2, 3...) |
| `github.secret_source` | string | Source of secret: `None`, `Actions`, `Codespaces`, `Dependabot` |
| `github.server_url` | string | GitHub server URL |
| `github.sha` | string | Commit SHA that triggered workflow |
| `github.token` | string | `GITHUB_TOKEN` value |
| `github.triggering_actor` | string | User who initiated/re-run the workflow |
| `github.workflow` | string | Workflow name |
| `github.workflow_ref` | string | Ref path to workflow file |
| `github.workflow_sha` | string | Commit SHA of workflow file |
| `github.workspace` | string | Default working directory |

#### `env` — Environment Variables

Contains variables set at workflow, job, or step level. Does NOT include runner-inherited variables.

```yaml
env:
  MY_VAR: value
steps:
  - run: echo ${{ env.MY_VAR }}
```

#### `vars` — Configuration Variables

Contains custom variables set at repository, organization, and environment levels. Available in most workflow keys. Returns empty string if undefined.

```yaml
runs-on: ${{ vars.RUNNER }}
```

#### `job` — Current Job Information

| Property | Type | Description |
|----------|------|-------------|
| `job.check_run_id` | number | Check run ID |
| `job.container` | object | Container info (`id`, `network`) |
| `job.services` | object | Service container info |
| `job.status` | string | `success`, `failure`, `cancelled` |

#### `jobs` — Reusable Workflow Outputs

Only available in reusable workflows, used to set `on.workflow_call.outputs`.

```yaml
value: ${{ jobs.my_job.outputs.output1 }}
```

#### `steps` — Step Results

| Property | Type | Description |
|----------|------|-------------|
| `steps.<id>.outputs` | object | Step outputs |
| `steps.<id>.conclusion` | string | Final result after `continue-on-error` |
| `steps.<id>.outcome` | string | Result before `continue-on-error` |

#### `runner` — Runner Information

| Property | Type | Description |
|----------|------|-------------|
| `runner.name` | string | Runner name |
| `runner.os` | string | `Linux`, `Windows`, `macOS` |
| `runner.arch` | string | `X86`, `X64`, `ARM`, `ARM64` |
| `runner.temp` | string | Temp directory path |
| `runner.tool_cache` | string | Preinstalled tools directory |
| `runner.debug` | string | `1` if debug logging enabled |
| `runner.environment` | string | `github-hosted` or `self-hosted` |

#### `secrets` — Secrets

| Property | Type | Description |
|----------|------|-------------|
| `secrets.GITHUB_TOKEN` | string | Auto-generated token |
| `secrets.<name>` | string | Repository/org/environment secret |

Not available in composite actions unless explicitly passed as inputs.

#### `strategy` — Matrix Execution

| Property | Type | Description |
|----------|------|-------------|
| `strategy.fail-fast` | boolean | Cancel all jobs if one fails |
| `strategy.job-index` | number | Zero-based index of current job |
| `strategy.job-total` | number | Total number of matrix jobs |
| `strategy.max-parallel` | number | Max parallel jobs |

#### `matrix` — Matrix Properties

Contains the matrix property values for the current job. Properties are user-defined.

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest]
    node: [18, 20]
# In a job: matrix.os = "ubuntu-latest", matrix.node = 18
```

#### `needs` — Dependency Job Outputs

| Property | Type | Description |
|----------|------|-------------|
| `needs.<job_id>.result` | string | `success`, `failure`, `cancelled`, `skipped` |
| `needs.<job_id>.outputs` | object | Job outputs |

#### `inputs` — Workflow Inputs

Available in reusable workflows (`workflow_call`) and manual dispatch (`workflow_dispatch`).

| Property | Type | Description |
|----------|------|-------------|
| `inputs.<name>` | string/number/boolean | Input value |

### Expression Syntax

```
${{ <expression> }}
```

#### Literals

| Type | Example |
|------|---------|
| string | `'hello'`, `"world"` |
| number | `42`, `3.14` |
| boolean | `true`, `false` |
| null | `null` |

#### Operators

| Operator | Description |
|----------|-------------|
| `==` | Equal |
| `!=` | Not equal |
| `<` | Less than |
| `>` | Greater than |
| `<=` | Less than or equal |
| `>=` | Greater than or equal |
| `&&` | And |
| `\|\|` | Or |
| `!` | Not |
| `( )` | Grouping |

#### Built-in Functions

| Function | Description | Example |
|----------|-------------|---------|
| `contains(haystack, needle)` | Check if string/array contains value | `contains(github.event.pull_request.labels.*.name, 'bug')` |
| `startsWith(string, prefix)` | String starts with prefix | `startsWith(github.ref, 'refs/heads/release/')` |
| `endsWith(string, suffix)` | String ends with suffix | `endsWith(github.ref, '-rc')` |
| `format(string, args...)` | String formatting | `format('Hello {0}', github.actor)` |
| `join(array, separator)` | Join array elements | `join(github.event.issue.labels.*.name, ', ')` |
| `toJSON(value)` | Convert to JSON string | `toJSON(github.event)` |
| `fromJSON(string)` | Parse JSON string | `fromJSON(env.MY_JSON).key` |
| `hashFiles(patterns...)` | Hash matching files | `hashFiles('**/package-lock.json')` |
| `always()` | Always return true | `if: always()` |
| `cancelled()` | True if workflow cancelled | `if: cancelled()` |
| `success()` | True if no previous failures | `if: success()` |
| `failure()` | True if any previous step failed | `if: failure()` |

## Analysis

### `if:` Auto-Expression Evaluation

The `if` keyword automatically evaluates its content as an expression. You do **not** need `${{ }}`:

```yaml
# These are equivalent:
if: github.ref == 'refs/heads/main'
if: ${{ github.ref == 'refs/heads/main' }}
```

However, when using `!` for negation, you **must** use `${{ }}` because `!` is a YAML tag character:

```yaml
# Correct
if: ${{ !startsWith(github.ref, 'refs/tags/') }}

# Incorrect - YAML parsing error
if: !startsWith(github.ref, 'refs/tags/')
```

### Missing Properties Return Empty String

If you dereference a non-existent property, it evaluates to an empty string, NOT an error:

```yaml
# If github.event.pull_request is undefined, this is '' (falsy)
if: github.event.pull_request.title == 'WIP'
```

This can lead to subtle bugs. Use `fromJSON` with defaults or explicit null checks when needed.

### `hashFiles` Availability

`hashFiles` is **only** available in `jobs.<job_id>.steps.*` keys and nowhere else. It generates a SHA-256 hash of all files matching the glob patterns, useful for cache keys.

### `toJSON` for Debugging

The best way to inspect context contents is `toJSON`:

```yaml
steps:
  - run: echo "$JSON"
    env:
      JSON: ${{ toJSON(github) }}
```

**Warning:** The `github` context includes `github.token`. GitHub masks secrets in logs, but be cautious when exporting contexts.

### `always()` Gotcha

`always()` evaluates to `true` even if the workflow is cancelled. To run a step only on failure but not cancellation:

```yaml
if: failure() && !cancelled()
```

### Contexts vs Environment Variables

| Aspect | Contexts | Environment Variables |
|--------|----------|----------------------|
| Availability | Most workflow keys | Only in `run` steps |
| Processing | Evaluated by GitHub before runner assignment | Available on the runner |
| Usage | `${{ github.ref }}` | `$GITHUB_REF` or `${{ env.VAR }}` |
| Best for | Conditional logic, dynamic configuration | Shell scripts, command arguments |

## Layer 4 Pointers

- [Workflow Syntax](syntax.md) — Where each context can be used in workflow keys.
- [Events & Triggers](events-triggers.md) — `github.event` payload structure per event type.
- [Security & Authentication](security-auth.md) — `secrets` context, `github.token` usage.
- [Advanced Features](advanced-features.md) — Using `needs` for job outputs, `strategy`/`matrix` for dynamic values.
