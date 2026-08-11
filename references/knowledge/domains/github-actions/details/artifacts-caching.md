# Artifacts & Caching

> Upload/download artifacts, dependency caching, retention, and eviction policies.

## Mechanism

### Artifacts

Artifacts are files produced by workflow runs that persist after the run completes. They are used to:
- Share build outputs between jobs in a workflow
- Store test results, coverage reports, and logs
- Save build artifacts for deployment

#### Upload Artifacts (v4)

```yaml
- uses: actions/upload-artifact@v4
  with:
    name: my-artifact
    path: |
      dist
      !dist/**/*.md
    retention-days: 5
    if-no-files-found: warn   # warn, error, ignore
    overwrite: false          # Whether to overwrite existing artifact
```

**Key behaviors:**
- Artifacts are **immutable** in v4. You cannot overwrite an artifact with the same name in a single workflow run.
- Artifacts can include multiple files and directories with glob patterns and exclusions.
- Each upload produces a SHA256 `digest` output for validation.

#### Download Artifacts (v4/v5)

```yaml
# Download a single artifact by name
- uses: actions/download-artifact@v5
  with:
    name: my-artifact
    path: ./download-dir

# Download all artifacts from the workflow run
- uses: actions/download-artifact@v5
  # No name = download all; creates subdirectories per artifact
```

**Validation:** The download action computes the SHA256 digest and validates it against the upload digest. Mismatches produce warnings.

#### Passing Data Between Jobs

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "build_id=$RANDOM" > build.txt
      - uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: build.txt

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v5
        with:
          name: build-output
      - run: cat build.txt
```

### Caching

The `actions/cache` action (and setup-* actions with built-in caching) stores dependencies between workflow runs to speed up builds.

#### Cache Action

```yaml
- uses: actions/cache@v4
  with:
    path: |
      ~/.npm
      node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
      ${{ runner.os }}-
```

**Cache resolution sequence:**
1. Search for exact `key` match → **cache hit**
2. Search for prefix match of `key`
3. Search `restore-keys` sequentially for exact match, then prefix match
4. If no match → **cache miss**; create new cache on successful job completion

#### Setup Actions with Built-in Caching

| Package Manager | Setup Action | Cache Key |
|-----------------|-------------|-----------|
| npm, Yarn, pnpm | `actions/setup-node` | `cache: 'npm'` |
| pip, pipenv, Poetry | `actions/setup-python` | `cache: 'pip'` |
| Gradle, Maven | `actions/setup-java` | `cache: 'gradle'` |
| RubyGems | `actions/setup-ruby` | `cache: 'bundler'` |
| Go | `actions/setup-go` | `cache: true` |
| .NET NuGet | `actions/setup-dotnet` | N/A [VERIFY] |

## Analysis

### Artifact v4 Breaking Changes

Artifact v4 introduced significant changes from v3:
- **Immutability:** Artifacts cannot be overwritten in the same workflow run
- **Digest validation:** SHA256 digests are computed and validated
- **Faster uploads/downloads:** Improved performance architecture
- **No `path` merging:** Each upload creates a distinct artifact

When passing artifacts between jobs, use different names for intermediate vs. final artifacts:
```yaml
# Job 1 uploads
- uses: actions/upload-artifact@v4
  with:
    name: intermediate-result
    path: result.txt

# Job 2 downloads, processes, uploads with new name
- uses: actions/upload-artifact@v4
  with:
    name: final-result
    path: result.txt
```

### Cache Scope and Access Rules

A workflow run can restore caches from:
1. **Current branch** (highest priority)
2. **Default branch** (e.g., `main`)
3. **Base branch** (for pull requests, including forks)

Caches **cannot** be restored from:
- Child branches (a cache created on `feature-b` is not accessible from `main`)
- Sibling branches (cache on `feature-a` not accessible from `feature-c`)
- Different tags

**Pull request caches are scoped to the merge ref** (`refs/pull/N/merge`). They can only be restored by re-runs of the same PR.

### Cache Size and Eviction

| Limit | Value |
|-------|-------|
| Default storage per repository | 10 GB |
| Maximum configurable (paid) | Up to 10 TB per repository |
| Retention | 7 days (LRU eviction after no access) |
| Upload rate limit | 200 uploads/minute per repository |
| Download rate limit | 1,500 downloads/minute per repository |

When storage is exceeded, caches are evicted by **last access date** (oldest first). This can cause **cache thrashing** if storage is undersized.

### Artifact Retention

| Plan | Default Retention |
|------|-------------------|
| Free/Pro/Team | 90 days |
| Enterprise | 90 days (customizable up to 400 days) |

Individual artifacts can override with `retention-days` (cannot exceed org/repo limit).

### Security Warning: Cache Poisoning

Caches are accessible to anyone who can create a pull request:
- Forks can create PRs against the base branch and access base branch caches
- Do NOT cache sensitive data (tokens, credentials)
- Do NOT use caches for secrets or authentication material

### Cache vs Artifacts: When to Use Which

| Use Case | Solution | Reason |
|----------|----------|--------|
| Dependencies between runs | **Cache** | Restored automatically, speeds up builds |
| Build outputs between jobs | **Artifact** | Explicit pass-through, validated |
| Test reports/logs | **Artifact** | Persisted for inspection |
| Deployment packages | **Artifact** | Immutable, downloadable |
| Compiled node_modules | **Cache** | Recreatable, large, speeds up install |

### Cross-OS Caching

By default, caches are scoped to the OS they were created on. Enable cross-OS with:
```yaml
- uses: actions/cache@v4
  with:
    enableCrossOsArchive: true
```

Use cautiously — binary artifacts may not be portable across OSes.

## Layer 4 Pointers

- [Workflow Syntax](syntax.md) — `steps` syntax for `uses`, `with`, `env`.
- [Advanced Features](advanced-features.md) — Passing artifacts between jobs with `needs`.
- [Runners](runners.md) — Runner disk space and temp directory usage.
