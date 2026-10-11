---
name: base44-environment
version: "1.0"
description: >
  Base44 backend operations: auth, secrets, entity schema and function deploys, DB
  queries, and known deploy and API gotchas. Use when calling Base44 APIs, deploying
  functions or entities, or debugging Base44 integrations.
inputs:
  required: []
  optional:
    - { path: "~/.base44/auth/auth.json", artifact: base44-auth-token }
    - { path: "base44/", artifact: base44-project-files }
    - { path: "docs/specs/project-state.md", artifact: project-state }
outputs:
  produces:
    - { path: "docs/logs/base44-environment.md", artifact: base44-operation-log }
phases:
  - id: P1-OperationScopeAndSafetyMode
    trigger: always
    reads: ["user request", "caller skill context", "base44/ project files"]
    writes: ["operation scope and safety-mode notes"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-AuthTokenAndSecretHandling
    trigger: after:P1-OperationScopeAndSafetyMode
    reads: ["~/.base44/auth/auth.json", "Base44 secret requirements"]
    writes: ["auth mode and secret-safety notes"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-Base44EnvironmentReadOrDiscovery
    trigger: after:P2-AuthTokenAndSecretHandling
    reads: ["Base44 API responses", "base44/functions/**", "base44/entities/**", "discovery-output/**"]
    writes: ["environment state or discovery notes"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P4-APIOrFunctionOrSchemaAction
    trigger: after:P3-Base44EnvironmentReadOrDiscovery
    reads: ["operation scope", "Base44 coding/write or function API payloads"]
    writes: ["Base44 API/function/schema response evidence"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P5-DeployOrSyncVerification
    trigger: after:P4-APIOrFunctionOrSchemaAction
    reads: ["Base44 response evidence", "deploy/readback endpoints", "git state when applicable"]
    writes: ["deploy or readback verification notes"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P6-OperationLogAndEvidenceCapture
    trigger: after:P5-DeployOrSyncVerification
    reads: ["operation scope", "response evidence", "verification notes"]
    writes: ["docs/logs/base44-environment.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P7-CallerReturnOrSkipDecision
    trigger: after:P6-OperationLogAndEvidenceCapture
    reads: ["caller skill context", "operation result", ".svc/lane-tasks-<WI>.json"]
    writes: ["caller return, skip, or remaining verification notes"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P8-SelfVerifyContinuation
    trigger: after:P7-CallerReturnOrSkipDecision
    reads: ["Self-Verify table", ".svc/lane-tasks-<WI>.json", "docs/logs/base44-environment.md"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# Example Marketplace Base44 Environment Control

**Announce at start:** "I'm using base44-environment to operate or verify the Example Marketplace Base44 backend safely."

**Version**: 1.0.0
**Last Updated**: 2025-12-18
**Tags**: base44, example-marketplace, backend, database, api, functions

## Purpose

This skill provides Claude with complete hands and eyes over the Example Marketplace Base44 environment:
- Execute backend functions via API calls
- Query and manipulate database collections (entities)
- Deploy functions and update entity schemas programmatically
- Test and debug functionality
- Monitor and understand the running environment

## Entity RLS Audit Mode

Use this mode when the request says "audit RLS", "check entity permissions",
"permissions issue detected", "Base44 schema drift", "backend schema round-trip",
or when a caller skill needs proof that entity security/persistence matches live
Base44 behavior.

Run the deterministic audit before proposing schema/RLS fixes:

```bash
node scripts/audit-base44-entity-rls.mjs \
  --root . \
  --out-md docs/specs/audit/entity-rls-audit.md \
  --out-json docs/specs/audit/entity-rls-audit.json
```

The helper accepts local `base44/entities/*.json`, `entities/*.json`, or a
round-trip app-config JSON with an `entities` map. It checks RLS presence,
malformed Base44 dashboard AND-rules, missing operations, open reads, delete
rules more permissive than update, sensitivity tier, caller surface, deployment
priority, and derived ownership pattern decisions.

For each security-rule deploy, also capture before/after probe evidence:

```bash
node scripts/validate-security-rule-probe-evidence.mjs \
  --evidence docs/specs/audit/<entity>-security-probe.json
```

The probe evidence must show the non-privileged actor, command, before status,
after status, output excerpts, and regression test. Do not deploy RLS from scanner
output alone.

## Bash Execution Rules (enforce every call)

**Short commands (curl, npx tsx, SDK scripts — complete in <30s):** run in the **foreground** with `timeout: 15000`, not with `run_in_background: true`.

**Long-running processes (full E2E suites, builds >30s):** `run_in_background: true` is allowed, and cleanup is yours: kill the process after reading its output so no orphaned shells remain.

Source: `~/.claude/rules/bash-hygiene.md`. These rules are non-negotiable because every open shell left behind is manual cleanup for the user.

## Authentication — JWT Bearer vs api_key

**Two ways to authenticate with the Base44 coding/write API:**

### JWT Bearer (preferred for interactive/local use)

```bash
# Get token — stored automatically after `base44 login`
ACCESS_TOKEN=$(cat ~/.base44/auth/auth.json | python3 -c "import json,sys; print(json.load(sys.stdin)['accessToken'])")

# Use as Bearer header
curl -H "Authorization: Bearer $ACCESS_TOKEN" ...
```

| | JWT Bearer | api_key |
|---|---|---|
| **Expiry** | 90 days, then refresh token auto-renews | Never expires unless manually rotated |
| **If leaked** | Usable for ≤90 days | Usable forever until manually revoked |
| **Revocation** | `base44 logout` | Must delete from dashboard |
| **Where stored** | `~/.base44/auth/auth.json` (local only) | Often ends up in `.env`, scripts, CI |
| **Best for** | Interactive dev on your own machine | CI/CD, automated scripts |

**Use JWT Bearer by default** — it's time-limited and never leaves your machine.

### Expired or Broken JWT Recovery

Before diagnosing Base44 API failures as application bugs, verify local auth
state. A stale `~/.base44/auth/auth.json` commonly presents as 401/403
responses, empty API output, or failed `coding/write` calls.

```bash
python3 - <<'PY'
import json, pathlib, time
p = pathlib.Path.home() / ".base44" / "auth" / "auth.json"
data = json.loads(p.read_text())
print("has_access_token=", bool(data.get("accessToken")))
print("expires_at=", data.get("expiresAt") or data.get("expires_at") or "unknown")
PY
```

If auth is missing, expired, or refresh fails, recover before continuing:

```bash
base44 logout || true
base44 login
```

After login, rerun the smallest failing API call and record the before/after
status in the task evidence. If the call still fails with fresh auth, continue
with provider/API diagnosis instead of token recovery.

---

## Secrets API — manage Base44 Secrets (env vars) programmatically

**Secrets API** — Base44 functions read env vars via `Deno.env.get('X')` from the app's Secrets store, so manage it through the API, not the dashboard: `GET https://app.base44.com/api/apps/$APP_ID/secrets` lists keys with masked values, `POST` to the same URL with a JSON object of name-to-value upserts one or many secrets, and `jq 'has("NAME")'` on the GET verifies one (token from `jq -r .accessToken ~/.base44/auth/auth.json`). Verify the secret exists **before** deploying any commit that adds a strict `Deno.env.get('X')` check (no fallback), or the function fails to compile and returns 404 "Deployment does not exist"; also use it before rotation (POST overwrites, no rebuild) and in preflight checks (`validate-required-secrets.sh`). The required Example Marketplace secret names are listed in the reference. Details: `references/secrets-and-deploy-gotchas.md`.

## coding/write response-shape gotcha (read this before you ever check `.error == null`)

**coding/write response-shape gotcha** — `coding/write` has no `.error` field on either outcome: success returns the full app config (confirm with `.last_git_commit_hash`), failure returns a flat `{error_type, message, detail, request_id, traceback}`. So `.error == null` is always true and proves nothing; test `.error_type` instead, e.g. `jq 'if .error_type then {error_type, message: .message[:200]} else {ok: true} end'`, or `response.data.error_type` in JS. Watch for `SandboxExecutionError` (non-fast-forward push rejected; recover per `rules/base44/auth-refresh.md`) and `HTTPException` (read `.message`). Details: `references/secrets-and-deploy-gotchas.md`.

## Static asset deploy gotchas — public/* must be tracked AND verified by Content-Type

**Static asset deploy gotchas** — HTTP 200 is not proof a `public/*` asset deployed, because the SPA returns 200 with `Content-Type: text/html` for unknown routes. For every new public asset: (1) the file exists locally, (2) `git ls-files public/<asset>` shows it tracked (blanket ignores like `*.png` hide it; use `git add -f`), (3) code references match the path exactly, (4) after push and deploy, `curl -sI https://<app>/<asset>` returns the matching MIME type, not `text/html`. Recover from untracked files by force-adding and redeploying, from a CDN-cached SPA fallback by cache-busting references with `?v=YYYYMMDD` or purging the zone, and do not treat a local `dist/` build as deploy proof (it reads the working tree, not git). Details: `references/secrets-and-deploy-gotchas.md` and `rules/base44/static-assets-public-dir.md`.

## "Deployment does not exist" 404 — the misleading deploy error

**"Deployment does not exist" 404** — This 404 on `POST /api/apps/{id}/functions/<name>` usually means the module threw an exception during load, so compile produced no runnable artifact; it does not mean the function is unregistered, a stale artifact, git divergence, TypeScript syntax, or (check last) a size limit. Check the Base44 dashboard first — Functions, the failing function — which shows the real exception (e.g. `REDEEM_SECRET not configured`). The most common cause is a required `Deno.env.get('X')` secret missing from Base44 Secrets (see `rules/base44/function-deploy-404-check-secrets.md`); if several functions return the same 404, grep the shared secret across `base44/functions/` and probe each function to confirm. Details: `references/secrets-and-deploy-gotchas.md`.

## Primary Deploy Flow (2026-04-18 update — headless-safe deploy)

**UI changes (pages/components/lib/api) deploy only via `git push` → wait 120s → `POST /deploy` → wait 60s → validate — not `coding/write`, which can revert real changes (see below).**

| Change type | Deploy method | Timing |
|---|---|---|
| `src/pages/*.jsx`, `src/components/*`, `src/lib/*`, `src/api/*` | `git push` → wait 120s → `POST /deploy` → wait 60s → validate | 180s total before bundle-grep |
| `base44/functions/**` | `git push` only | Auto-deploys on push — live ~30s, no `/deploy`, no `coding/write` |
| `base44/entities/*` (schemas) | `coding/write entities/EntityName` | Only case that still needs the write endpoint |

**Why this flow (2026-04-18):**
- The previous "git push → auto-detect" assumption requires a human-open Base44 UI tab to fire the rebuild. Headless agent sessions cannot open UI tabs, so auto-detect never fires, the bundle stays stale, and verify-promotion silently polls an unchanged hash forever. Observed WI-074 2026-04-18: agent waited 60s, bundle unchanged; user had to click Publish manually.
- Calling `coding/write` for `pages/*` runs an internal Base44 sandbox that does its own `git push origin main`. If that sandbox's local HEAD is behind origin, the push is rejected as non-fast-forward, the endpoint errors with `SandboxExecutionError`, Base44's deploy ref ends up stale, and `base44-builder[bot]` can commit a spurious "Manual code change" that reverts real changes. Observed WI-066, 2026-04-17.
- The only safe headless flow for UI: let `git push` land, let Base44's sandbox catch up (120s), then explicitly call `POST /deploy` to force the rebuild off the known-synced commit. Then wait 60s for the build + CDN propagation before asserting on the deployed bundle.

**Agent behavior (required):**

1. **UI changes — 4-step flow (git push + deploy, no coding/write):**
   ```bash
   # 1. Push your PR merge / commit
   git push origin main
   # 2. Wait 120s for Base44's internal git sandbox to catch up with origin.
   #    Shorter waits risk phantom-ref / non-fast-forward errors.
   sleep 120
   # 3. Trigger deploy explicitly. Auto-detect needs a human-open UI tab, so it never fires headless.
   ACCESS_TOKEN=$(cat ~/.base44/auth/auth.json | python3 -c "import json,sys; print(json.load(sys.stdin)['accessToken'])")
   curl -s -X POST "https://app.base44.com/api/apps/$APP_ID/deploy" \
     -H "Authorization: Bearer $ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{}'
   # 4. Wait 60s for the build to complete and CDN to propagate.
   sleep 60
   # 5. Validate by grepping the deployed bundle for a feature literal.
   ```
   If the user asked for post-deploy E2E, browser, visual, smoke, or API
   validation, run that named proof only after the live bundle/function marker
   has moved, and target the production URL (for example
   `PLAYWRIGHT_BASE_URL=https://example-marketplace.app`). Local or pre-deploy test output
   cannot satisfy a post-deploy validation request.
2. **Functions only:** `git push` usually auto-deploys in ~30s, but can silently fail when Base44's GitHub sync falls behind — so **API-test the function after every push.** If the function returns 422/404 or runs old code, force-redeploy via `coding/write functions/<name>` (see Function Deploy Recovery below). Observed 2026-05-05 PR #110: 4 dodo functions merged to main, `git push` reported success, `/github/sync` reported `already_up_to_date`, but functions kept running pre-PR code with old product IDs — `coding/write` per function fixed it.
3. **Entity schemas:** `coding/write entities/<Name>` with JSON round-trip → verify via round-trip read.
4. **`coding/write` for `pages/*` is restricted to `pages/BuildCanary` only** (sandbox-sync emergency recovery). For `functions/*`, `coding/write` is allowed as the recovery path when auto-deploy didn't pick up — it's the only reliable way to force Base44 to register updated function content when the GitHub sync is stale.

**Bash guard for entity schemas:** direct `coding/write entities/*` commands are blocked unless the command includes `SVC_BASE44_SCHEMA_WRITE_ARTIFACT=<repo-relative-path>` or `--schema-change-artifact <path>` pointing to a durable schema-change artifact. The artifact must include rollback plus round-trip, persistence, RLS, probe, or WI-308 evidence. Emergency bypasses must be logged in `.svc/pipeline-decisions.jsonl` with `base44_schema_write_override=true`, `reasoning`, and `approved_by`. This guard does not block function `coding/write` recovery.

### Alternative deploy model: CLI `site deploy` (sandbox-decoupled static publish)

The flow above is the **sandbox/git model** — it relies on git sync + the Base44 sandbox rebuilding your source. There is a second, independent path: `npx base44 site deploy` uploads your **local** `npm run build` output (`dist/`) straight to the live hosting slot, bypassing the sandbox entirely. Verified working end-to-end (browser-confirmed render) on a `is_managed_source_code: true` app. Use it for **backend-only apps, static/SDK-free frontends, or staging/headless CI** where you don't want a dependency on git sync + a human-open UI tab. Two hard gotchas:

1. **git sync silently reverts it.** If `connected_to_github: true`, the platform periodically republishes the pinned repo commit (`last_git_commit_hash`) over your CLI deploy. For `site deploy` to persist, disconnect git sync (`connected_to_github: false`, `git_remote_source: "s3"`) and never deploy from the web editor afterward.
2. **A raw build has no app config → all SDK calls 405** (`POST .../null/api/apps/null/functions/<name>`). The platform injects `appId`/`serverUrl` at runtime; a static deploy does not. Bake them at build time:
   ```bash
   VITE_BASE44_APP_ID=<app-id> \
   VITE_BASE44_BACKEND_URL=https://<app-subdomain>.base44.app \   # app subdomain, NOT app.base44.com
   VITE_BASE44_APP_BASE_URL=https://<app-subdomain>.base44.app \
   npm run build
   npx base44 site deploy -y
   ```
   After baking config, `functions.invoke` + `entities.*` work from the deployed build (an anonymous `401` on `entities/User/me` is expected). Verify in a real browser, not `curl` — `curl` only sees the generic platform auth shell. Full detail: `rules/base44/cli-site-deploy-decoupled.md`.

### Function Deploy Recovery (when git push didn't take)

Symptom: pushed function changes to main, GitHub shows the commit, but the deployed function still runs old code (e.g., 422 on a product that exists in the new code, hardcoded ID from before the change).

```bash
ACCESS_TOKEN=$(jq -r .accessToken ~/.base44/auth/auth.json)
APP_ID="<your-app-id>"

# Force-write each affected function. coding/write writes AND deploys in one step.
for fn in dodoCreateCheckout dodoCustomerCheckout dodoAIWalletTopup dodoWebhook; do
  jq -n --rawfile content "base44/functions/$fn/entry.ts" --arg fp "functions/$fn" \
    '{file_path: $fp, content: $content}' | \
  curl -s -X POST "https://app.base44.com/api/apps/$APP_ID/coding/write" \
    -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -d @- > /dev/null
done

# Wait ~60s, then re-test via API or E2E
```

**Why this works when `git push` doesn't:** Base44's GitHub sync (`/github/sync`) reports `already_up_to_date` even when the sandbox snapshot used by the function runtime is behind origin. `coding/write` bypasses the sync — it writes directly into the sandbox AND triggers a function-scope redeploy. Same mechanism class as the BuildCanary pattern for the UI bundle.

The sections below document the legacy `coding/write` + `/deploy` pattern; use them only for entity schemas.

---

## Legacy: coding/write + deploy API (entities + emergency fallback)

**Legacy: coding/write + deploy API** — `coding/write` writes and deploys entities (`entities/EntityName`, JSON), backend functions (`functions/functionName`, TypeScript, instant) and pages (`pages/PageName`, JSX; then POST `/api/apps/{APP_ID}/deploy` to publish). **Do not use `src/` or any other prefix with `coding/write`:** it creates an extensionless duplicate that shadows the real file and breaks the build, so commit and `git push origin main` `src/` files instead (and `git rm` any such duplicate). If `/deploy` returns `fatal: reference is not a tree: <sha>` (phantom ref from calling coding/write before `git push`), **stop** and ask the user to disconnect and reconnect the GitHub repo in Base44 Settings, then `git pull`, push, `coding/write` a real page, and `/deploy`; looping coding/write, empty-commit tricks and force-pushes make it worse. In round-trip entity updates, **`file_path` has to match the file passed as `content`**, or it silently overwrites a live page. Call functions from the frontend with `base44.functions.invoke(name, payload)` (not `base44.functions.name(...)`), with telemetry fire-and-forget (`.catch(() => {})`, state updates first). Details: `references/legacy-coding-write-deploy.md`.

## Quick Reference

### Most Common Commands

```bash
# Get JWT token
ACCESS_TOKEN=$(cat ~/.base44/auth/auth.json | python3 -c "import json,sys; print(json.load(sys.stdin)['accessToken'])")

# Query database (get all locations)
curl -s "https://example-marketplace.example.invalid" \
  -H "api_key: YOUR_BASE44_API_KEY" | jq .

# Run a function
curl -X POST "https://example-marketplace.example.invalid" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -d '{}' | jq .

# Deploy a function (using JWT — preferred)
jq -n --rawfile content /path/to/function.ts '{file_path: "functions/myFunction", content: $content}' | \
curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d @-

# Read entity schema (SAFE: round-trip existing page content so nothing is overwritten)
jq -n --rawfile content src/pages/Home.jsx '{file_path: "pages/Home", content: $content}' | \
curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d @- | jq -r '.entities.Location'

# Deploy entity schema
jq -n --rawfile content /path/to/entity.json '{file_path: "entities/Location", content: $content}' | \
curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d @-
```

### Key Capabilities
- ✅ **Database**: Full read access to all 50 entities via API
- ✅ **Functions**: Deploy and execute 49+ backend functions
- ✅ **Schemas**: Add/modify entity fields programmatically
- ✅ **Migrations**: Run data migrations with idempotent functions
- ✅ **No Git Required**: All changes deploy instantly via API

## Environment Reference (load on demand)

Project inventory and walkthroughs live in `references/environment-reference.md`: what
Example Marketplace is, Base44 architecture, environment configuration, the 49 backend
functions and 49 collections, SDK patterns, the complete database dump recipe, deploying
functions and entity schemas via API, running functions, database querying, complete
workflow examples (add field + migrate, create/test/delete function, origin 403 fix),
testing, authentication requirements, common tasks, security notes, external cron jobs
(CRON_SECRET + Cloudflare Worker) and file references. Read the relevant section before
acting; the rules above still govern every call.

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`

This is an environment-control support skill, not a product-lane phase. When invoked from a lane task, update `.svc/lane-tasks-<WI>.json` for the caller task with:

- `status`: `completed` only after the Base44 API/function/schema action has a captured response or follow-up read proving the result.
- `evidence`: command output path, response excerpt, or deployment/readback record.
- `skip_reason`: required if no Base44 environment action was actually needed.

If a Base44 operation changes product behavior, return to the caller skill for normal lane verification instead of closing the WI here.

## Phase Receipt Contract

When this skill runs inside a task graph, emit one receipt per completed phase
before marking the task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-OperationScopeAndSafetyMode --evidence command_output:.svc/base44-environment-scope-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-AuthTokenAndSecretHandling --evidence command_output:.svc/base44-environment-auth-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-Base44EnvironmentReadOrDiscovery --evidence command_output:.svc/base44-environment-discovery-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-APIOrFunctionOrSchemaAction --evidence command_output:.svc/base44-environment-action-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-DeployOrSyncVerification --evidence command_output:.svc/base44-environment-verify-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-OperationLogAndEvidenceCapture --evidence file:docs/logs/base44-environment.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-CallerReturnOrSkipDecision --evidence command_output:.svc/base44-environment-return-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P8-SelfVerifyContinuation --evidence command_output:.svc/base44-environment-self-verify-<WI>.log
```

If no remote Base44 action is needed, record `P4-APIOrFunctionOrSchemaAction`
and `P5-DeployOrSyncVerification` with explicit skip evidence rather than
fabricating API output. If no task graph exists, report the same phase evidence
in the assistant response.

## Troubleshooting

### Issue: Function Returns "Authentication required"
**Cause**: Function needs user context, not just API key
**Solution**: Call from authenticated frontend session

### Issue: RLS Policy Error
**Cause**: User doesn't have permission to access resource
**Solution**: Check if function uses `asServiceRole` or user has proper access

### Issue: Changes to functions/ not deploying
**Cause**: Base44 auto-deploys from main branch
**Solution**: Ensure changes are pushed to Git, check Base44 dashboard

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Authentication mode selected intentionally | State whether JWT Bearer or api_key is being used and why it fits the operation. | |
| 2 | Secret-bearing commands are safe | Confirm no secrets are printed, written to repo files, or embedded in reusable snippets. | |
| 3 | Remote Base44 action is verified | For any API, function, schema, or data change, capture the response or follow-up read that proves the result. | |
| 4 | Cleanup and deploy state are clear | Confirm long-running commands are stopped and note whether Git push/Base44 deploy is still required. | |
| 5 | Entity RLS audit is grounded when relevant | For entity/RLS/schema work, run `node scripts/audit-base44-entity-rls.mjs --root .` or cite a live round-trip dump used as `--app-config`. | |
| 6 | Security-rule probe evidence exists | For RLS/security-rule deploys, run `node scripts/validate-security-rule-probe-evidence.mjs --evidence <probe.json>`. | |
| 7 | Post-deploy validation requests are honored | If the user asked for post-deploy E2E/browser/visual/smoke/API validation, cite the command or artifact run after deploy against the production URL; local/pre-deploy output is not enough. | |

## Keywords

base44, example-marketplace, backend functions, database, api, stripe, subscription, loyalty, check-in, qr code, sample, referral, ai deals, employee scheduling, authentication, deno, typescript, no-code, saas

## Post-Compaction Recovery

If context was compacted and you lost track of framework state: `.svc/lane-tasks-<WI>.json` is the sole source of truth. Resume the first `in_progress` task (else the first `pending` with blockers satisfied), re-load it with `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`, re-read this SKILL.md, and continue. Verify a `skill_receipt` exists before marking any task complete — no ghost-completes.

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
