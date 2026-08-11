# Journey QA Run Template

## Run Context

- Date: YYYY-MM-DD
- Mode: `smoke|regression|feature-ac|exploratory`
- Target URL: `<url>`
- Env: `local|preview|staging|prod|custom`
- Scope:
  - Journeys: `[...]`
  - Features: `[...]`

## Preflight

- URL reachable: `yes|no`
- Auth path usable: `yes|no`
- Data/state ready: `yes|no`
- Blockers:
  - ...

## Results by Journey

| Journey | Scenarios | ACs Checked | ✅ | ❌ | ⚠️ | ⏭️ |
|---|---:|---:|---:|---:|---:|---:|
| Jxx | 0 | 0 | 0 | 0 | 0 | 0 |

## Results by Feature Spec

| Feature Spec | ACs Checked | ✅ | ❌ | ⚠️ | ⏭️ |
|---|---:|---:|---:|---:|---:|
| feature-xyz.md | 0 | 0 | 0 | 0 | 0 |

## Evidence

- `docs/specs/features/test-evidence/YYYY-MM-DD-<env>-<scope>/...`

## Routed Follow-Ups

- `audit-ac`: ...
- `write-journeys`: ...
- `sync-spec-code`: ...
- `write-e2e`: ...
