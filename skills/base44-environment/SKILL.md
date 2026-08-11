---
name: base44-environment
version: "1.0"
description: Use when working with the Example Marketplace Base44 backend environment, executing API calls, querying database collections, deploying functions, or debugging Base44 integrations.
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

**Short commands (curl, npx tsx, SDK scripts — complete in <30s):** run **foreground** with `timeout: 15000`. Never `run_in_background: true`.

**Long-running processes (full E2E suites, builds >30s):** `run_in_background: true` is allowed — but you OWN cleanup. Kill the process after reading output. Do not leave orphaned shells.

Source: `~/.claude/rules/bash-hygiene.md`. These rules are non-negotiable — open shells require manual cleanup by the user.

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

Base44 functions read env vars via `Deno.env.get('X')`. The values come from the app's Secrets store, which is manageable via two endpoints. **Use these instead of clicking through the dashboard.**

### List configured secret keys

```bash
ACCESS_TOKEN=$(jq -r .accessToken ~/.base44/auth/auth.json)
APP_ID="<your-app-id>"

curl -s -X GET "https://app.base44.com/api/apps/$APP_ID/secrets" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq 'keys'
```

Returns a JSON object with masked values: `{"GROQ_API_KEY":"••••••••","REDEEM_SECRET":"••••••••",...}`. The keys are visible; the values are NOT (use the dashboard if you need to read a value, but you usually shouldn't need to).

### Set or update a secret

```bash
NEW_VAL=$(openssl rand -hex 32)   # 256-bit hex for HMAC-style secrets

curl -s -X POST "https://app.base44.com/api/apps/$APP_ID/secrets" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"REDEEM_SECRET\":\"$NEW_VAL\"}"
# → {"success": ...}
```

POST is upsert — sets the value if missing, updates if present. The body should be a JSON object mapping secret names to values; multiple secrets can be set in one call.

### Verify a specific secret is set

```bash
curl -s -X GET "https://app.base44.com/api/apps/$APP_ID/secrets" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq 'has("REDEEM_SECRET")'
# → true | false
```

### When to use this

- **After landing any commit that adds a `Deno.env.get('X')` strict check** (no fallback). Verify the secret is in the Secrets store BEFORE the deploy runs, or the function will fail to compile and return 404 "Deployment does not exist." See `rules/base44/function-deploy-404-check-secrets.md`.
- **Before secret rotation** — POST overwrites; functions read the new value on next request, no rebuild needed.
- **CI / preflight checks** — `validate-required-secrets.sh` can grep `Deno.env.get` across `base44/functions/**` and verify each name appears in the secrets list.

### Secret name conventions in Example Marketplace

Required for current functions (verify they exist before deploying changes):

| Secret | Used by |
|---|---|
| `REDEEM_SECRET` | secureOperation, redeemClaim — HMAC for flash-offer signed tokens |
| `QR_TOKEN_SECRET` | generateLocationQR, secureCheckIn — HMAC for QR-code tokens |
| `QR_AUDIT_SALT` | secureCheckIn — audit hash salt |
| `SAMPLE_CLAIM_HMAC_SECRET` | sample-claim flow |
| `CRON_SECRET` | jobRunner — gate for Cloudflare Worker cron requests |
| `BASE44_SERVICE_TOKEN`, `BASE44_APP_ID` | system |
| `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_SECRET`, `DODO_ENVIRONMENT` | dodo* functions |
| `GROQ_API_KEY`, `MISTRAL_API_KEY` | aiGateway, generateAIDeal |
| `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY` | sendPushNotification |
| `GOOGLE_PLACES_API_KEY` | placesNearbyLookup, placesDetailsLookup |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | verifyFirebasePhone |

Stripe / VITE_MAPBOX / NODE_ENV / ALLOWED_ORIGIN_DOMAINS are also present.

---

## coding/write response-shape gotcha (read this before you ever check `.error == null`)

The `coding/write` endpoint returns **two distinct response shapes** depending on success/failure:

**Success:** the full app config object — `{id, last_git_commit_hash, status, pages, function_names, entities, ...}`. There is NO `.error` field on success (it's just absent).

**Failure:** a flat error object — `{error_type, message, detail, request_id, traceback}`. There is NO `.error` field on failure either — the failure indicator is `error_type`.

**Common bug:** checking `if (!response.error)` returns `true` on BOTH success and failure (since `.error` is always undefined). The correct check is `error_type`:

```bash
# ❌ WRONG — false positive on every error
RES=$(curl -s -X POST .../coding/write ... -d @-)
echo "$RES" | jq 'if .error == null then "ok" else "fail" end'

# ✅ RIGHT — checks the actual error indicator
echo "$RES" | jq 'if .error_type then {error_type, message: .message[:200]} else {ok: true} end'
```

```javascript
// ❌ WRONG
if (response.data.error) { /* never fires */ }

// ✅ RIGHT
if (response.data.error_type) { /* SandboxExecutionError, HTTPException, etc. */ }
```

**Why this matters:** observed 2026-05-06 in Example Marketplace session — agent reported "coding/write succeeded" 6+ times across an hour while the API was actually returning `{error_type: "SandboxExecutionError", message: "git push origin main rejected (non-fast-forward)..."}`. Hours wasted assuming writes were landing when they weren't. Same failure mode as `rules/post-fix-evidence-before-next-fix.md` — surface the real response, don't filter to a wrong field.

Common `error_type` values to watch for:
- `SandboxExecutionError` — sandbox/origin divergence; non-fast-forward push rejected. Fix per `rules/base44/auth-refresh.md` divergence-recovery section.
- `HTTPException` — generic — read `.message` for the real reason.
- `null` / absent — actual success (check for `.last_git_commit_hash` present as positive confirmation).

---

## Static asset deploy gotchas — public/* must be tracked AND verified by Content-Type

When the frontend references a static asset under `public/` (image, font, JSON), three independent failures hide a missing asset behind misleading `HTTP 200` responses. **HTTP 200 alone is NOT proof of deploy** — the SPA returns 200 with `Content-Type: text/html` (the index.html 404 fallback) for any unknown route.

### The 4-step checklist for ANY new public/* asset

```bash
# 1. File exists locally
ls -la public/<asset>

# 2. File is TRACKED in git (the silent killer — blanket *.png in .gitignore catches new assets)
git ls-files public/<asset>
# If empty: git add -f public/<asset>   ← bypass ignore explicitly

# 3. Code references match the file path exactly
grep -rE '"/<asset>"' src/

# 4. After push + deploy: VERIFY CONTENT-TYPE
curl -sI "https://<app>.app/<asset>" | grep -i content-type
# Required: image/png  (or matching MIME)
# Wrong:    text/html  ← SPA fallback, asset NOT deployed
```

### Three failure modes (pick the matching recovery)

**A. Asset not in git** (caught by `.gitignore` blanket pattern, e.g. `*.png`):
- `git ls-files` returns nothing
- Recovery: `git add -f`, commit, push, redeploy

**B. CDN cached the SPA fallback during the broken window:**
- `git ls-files` shows the asset
- `curl -sI` returns `content-type: text/html` + `cf-cache-status: HIT` + non-zero `age`
- Recovery (preferred): cache-bust the references in JSX with `?v=YYYYMMDD` query strings
- Recovery (alternative): purge Cloudflare cache via API (zone-scoped token). For Example Marketplace the zone is `fbb3b2cb0a98367fcc9b130558294ed3`:
  ```bash
  CF_TOKEN="<from .env.local>"
  CF_ZONE="fbb3b2cb0a98367fcc9b130558294ed3"
  curl -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/purge_cache" \
    -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \
    -d '{"files":["https://example-marketplace.app/<asset>"]}'
  ```

**C. Local Vite build masks the issue:**
- `npm run build` reads from working tree, not git. Untracked PNGs appear in `dist/` so local preview "works"
- Production deploy reads from git → asset missing on the live CDN
- Mitigation: always run `git ls-files` before push, never trust local `dist/` as deploy proof

See `rules/base44/static-assets-public-dir.md` for full diagnostic procedure, forbidden shortcuts, reviewer hooks, and the WI-174 iter-6 failure-mode evidence.

---

## "Deployment does not exist" 404 — the misleading deploy error

When `POST /api/apps/{id}/functions/<name>` (or the same path under `example-marketplace.app/...` / `example-marketplace.base44.app/...`) returns **HTTP 404 with body `Deployment does not exist. Try redeploying the function from the code editor section.`** — the message is misleading.

### What it usually means

**The module threw an exception during load → compile produced no runnable artifact.** It does NOT mean:
- ❌ The function was never registered (registry has the source — verify via app GET)
- ❌ A stale artifact needs cleanup (DELETE returns the same 404 — there's nothing to delete)
- ❌ Sandbox/origin git divergence (write path may be broken too, but it's not the deploy issue)
- ❌ TypeScript syntax in a `.ts` file (Deno supports TS natively — would fail every function, not one)
- ❌ Function size limit (rare; check this LAST not first)

### What to check FIRST

**Open the Base44 dashboard → Functions → click the failing function.** The dashboard shows the actual deploy exception, e.g. `UNCAUGHT_EXCEPTION at file:///src/main.ts:325 — Error: REDEEM_SECRET not configured in Base44 Secrets`. **30 seconds in the dashboard saves hours of API spelunking.** The deploy error message is NOT exposed by any API endpoint we've found — only the dashboard surfaces it.

### Most-common root cause

A required env var (per `Deno.env.get('X')` strict check) is missing from Base44 Secrets. See `rules/base44/function-deploy-404-check-secrets.md` for the full diagnostic + recovery procedure.

### Cross-check from the CLI

If multiple functions return the same 404, they likely share a missing secret:

```bash
# All functions that use REDEEM_SECRET
grep -rE "Deno.env.get\('?REDEEM_SECRET'?\)" base44/functions/

# Test each
for fn in secureOperation redeemClaim; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    "https://example-marketplace.app/api/apps/$APP_ID/functions/$fn" \
    -H "Authorization: Bearer $ACCESS_TOKEN" -d '{}')
  echo "$fn: HTTP $CODE"
done
# All 404 with the same message → confirmed missing-secret pattern
```

---

## Primary Deploy Flow (2026-04-18 update — headless-safe deploy)

**For UI changes (pages/components/lib/api), NEVER use `coding/write`. Use: `git push` → wait 120s → `POST /deploy` → wait 60s → validate.**

| Change type | Deploy method | Timing |
|---|---|---|
| `src/pages/*.jsx`, `src/components/*`, `src/lib/*`, `src/api/*` | `git push` → wait 120s → `POST /deploy` → wait 60s → validate | 180s total before bundle-grep |
| `base44/functions/**` | `git push` only | Auto-deploys on push — live ~30s, no `/deploy`, no `coding/write` |
| `base44/entities/*` (schemas) | `coding/write entities/EntityName` | Only case that still needs the write endpoint |

**Why this flow (2026-04-18):**
- The previous "git push → auto-detect" assumption requires a human-open Base44 UI tab to fire the rebuild. Headless agent sessions cannot open UI tabs, so auto-detect never fires, the bundle stays stale, and verify-promotion silently polls an unchanged hash forever. Observed WI-074 2026-04-18: agent waited 60s, bundle unchanged; user had to click Publish manually.
- Calling `coding/write` for `pages/*` runs an internal Base44 sandbox that does its own `git push origin main`. If that sandbox's local HEAD is behind origin, the push is rejected as non-fast-forward, the endpoint errors with `SandboxExecutionError`, Base44's deploy ref ends up stale, and `base44-builder[bot]` can commit a spurious "Manual code change" that reverts real changes. Observed WI-066, 2026-04-17.
- The only safe headless flow for UI: let `git push` land, let Base44's sandbox catch up (120s), then explicitly call `POST /deploy` to force the rebuild off the known-synced commit. Then wait 60s for the build + CDN propagation before asserting on the deployed bundle.

**Agent behavior (mandatory):**

1. **UI changes — 4-step flow (git push + deploy, NO coding/write):**
   ```bash
   # 1. Push your PR merge / commit
   git push origin main
   # 2. Wait 120s for Base44's internal git sandbox to catch up with origin.
   #    Shorter waits risk phantom-ref / non-fast-forward errors.
   sleep 120
   # 3. Trigger deploy explicitly. Do NOT rely on auto-detect — it requires a human-open UI tab.
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
2. **Functions only:** `git push` USUALLY auto-deploys in ~30s — but can silently fail when Base44's GitHub sync falls behind. **Always API-test the function after push.** If the function returns 422/404 or runs old code, force-redeploy via `coding/write functions/<name>` (see Function Deploy Recovery below). Observed 2026-05-05 PR #110: 4 dodo functions merged to main, `git push` reported success, `/github/sync` reported `already_up_to_date`, but functions kept running pre-PR code with old product IDs — `coding/write` per function fixed it.
3. **Entity schemas:** `coding/write entities/<Name>` with JSON round-trip → verify via round-trip read.
4. **`coding/write` for `pages/*` is RESTRICTED to `pages/BuildCanary` only** (sandbox-sync emergency recovery). For `functions/*`, `coding/write` is ALLOWED as the recovery path when auto-deploy didn't pick up — it's the only reliable way to force Base44 to register updated function content when the GitHub sync is stale.

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

The sections below document the legacy `coding/write` + `/deploy` pattern. Use them ONLY for entity schemas.

---

## Legacy: coding/write + deploy API (entities + emergency fallback)

The `coding/write` endpoint writes AND deploys in one step for **backend functions and entities** (live immediately).
For **frontend pages**, call `/deploy` after `coding/write` to publish:


```bash
# After writing files, trigger deploy:
curl -s -X POST "https://app.base44.com/api/apps/{APP_ID}/deploy" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

The `coding/write` endpoint deploys entities, functions, AND pages. Only the `file_path` prefix differs:

| Resource | `file_path` value | Content type |
|---|---|---|
| Entity schema | `entities/EntityName` | JSON |
| Backend function | `functions/functionName` | TypeScript (no extension) |
| Frontend page | `pages/PageName` | JSX (no extension) |

> **FATAL: NEVER use `src/` paths with coding/write.**
>
> `coding/write` only understands three prefixes: `functions/`, `entities/`, `pages/`.
> Using ANY other path (e.g. `src/lib/scheduledContent`, `src/components/MyComponent`)
> creates an **extensionless duplicate file** in the repo that shadows the real `.js`/`.jsx` file.
> Vite's import resolution picks up the extensionless file first, the build breaks,
> and the entire app goes down with 404 errors on all assets.
>
> **What to do instead:**
> - `src/lib/` files — commit to git and `git push origin main`. Base44 syncs from git.
> - `src/components/` files — same: git commit + push. They're bundled into pages.
> - `pages/` — use `coding/write` with `pages/PageName`, then call `/deploy`.
> - `functions/` — use `coding/write` with `functions/funcName` (instant deploy).
> - `entities/` — use `coding/write` with `entities/EntityName` (instant deploy).
>
> **If Base44 builder bot creates an extensionless duplicate** (e.g. `src/lib/scheduledContent`
> alongside `src/lib/scheduledContent.js`), delete it immediately with `git rm` and push.

---

> **FATAL: Phantom ref — when `/deploy` returns `fatal: reference is not a tree: <sha>`**
>
> **Root cause:** coding/write was called BEFORE `git push`, or local commits and coding/write
> calls were alternated in the same session. Base44's internal git is now pointing at a commit
> SHA that GitHub doesn't have. `/deploy` will stay stuck on this phantom ref forever —
> subsequent `coding/write` calls do NOT fix it, even if they return `"status": "ok"`.
>
> **Recovery — STOP and ask the user to:**
> 1. Go to Base44 dashboard → Settings → Git integration
> 2. Disconnect the GitHub repository
> 3. Reconnect the same GitHub repository (this resets Base44's internal ref to the latest GitHub HEAD)
> 4. Trigger a manual deploy from the dashboard
>
> **After reconnect, resume the normal deploy sequence from scratch:**
> ```bash
> git pull                  # pull any bot commits Base44 created during reconnect
> git add <files> && git commit -m "..." && git push   # push changes
> coding/write <real page>  # update Base44's deploy ref
> /deploy                   # rebuild app
> ```
>
> **DO NOT:**
> - Keep calling `coding/write` in a loop trying to fix it — each call succeeds but /deploy still uses the phantom ref
> - Try the "empty commit + coding/write" trick — it does not break the phantom ref
> - Force-push or rewrite git history to match the phantom SHA

---

```bash
# Deploy a function
jq -n --rawfile content functions/myFunc.ts '{file_path: "functions/myFunc", content: $content}' | \
curl -s -X POST "https://app.base44.com/api/apps/{APP_ID}/coding/write" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d @-

# Deploy an entity schema
jq -n --rawfile content /tmp/MyEntity_updated.json '{file_path: "entities/MyEntity", content: $content}' | \
curl -s -X POST "https://app.base44.com/api/apps/{APP_ID}/coding/write" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d @-
```

**Safe entity schema update pattern** (read → merge fields → write back):

> ⚠️ CRITICAL: `file_path` in the round-trip payload MUST match the actual file you pass as `content`.
> Mismatching them silently overwrites a live page with the wrong content.
> Always use a real existing page file AND set `file_path` to that same page name.

```bash
# Step 1: Read current state — file_path MUST match the file you --rawfile
# ✅ Correct: file_path "pages/Approvals" + content from src/pages/Approvals.jsx
jq -n --rawfile content src/pages/Approvals.jsx '{file_path: "pages/Approvals", content: $content}' | \
curl -s -X POST "https://app.base44.com/api/apps/{APP_ID}/coding/write" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d @- | python3 -c "
import json,sys; d=json.load(sys.stdin)
print(json.dumps(json.loads(d['entities']['MyEntity']), indent=2))
" > /tmp/MyEntity_current.json

# ❌ WRONG (will overwrite AIGenerator with base44Client.js content):
# jq -n --rawfile content src/api/base44Client.js '{file_path: "pages/AIGenerator", content: $content}'
```

### Frontend SDK: Function Invocation

**Correct** — use `invoke()`:
```javascript
base44.functions.invoke('trackCommercialEvent', { workspaceId, eventName, properties })
```

**Wrong** — direct call doesn't exist on SDK:
```javascript
// ❌ TypeError: base44.functions.trackCommercialEvent is not a function
base44.functions.trackCommercialEvent({ ... })
```

**Telemetry calls should be fire-and-forget** — always `.catch(() => {})` and place state updates BEFORE telemetry:
```javascript
setMyState(newValue);  // State update first
base44.functions.invoke('trackCommercialEvent', { ... }).catch(() => {});  // Fire-and-forget

# Step 2: Add new fields with python3/jq, save to /tmp/MyEntity_updated.json
# Step 3: Deploy updated schema (see above)
# Step 4: Verify — re-read and check new fields are present
```

---

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

## What is Example Marketplace?

Example Marketplace is a SaaS platform for business management built on Base44, featuring:
- Employee scheduling and time tracking
- Customer loyalty programs and engagement
- Location-based check-ins and QR codes
- Stripe payment integration and subscriptions
- AI-powered deal generation
- Sample/referral program management

## Base44 Architecture

### Platform Overview
- **Platform**: Base44 (no-code backend platform)
- **Runtime**: Deno (serverless TypeScript functions)
- **Database**: Base44 managed database with Row-Level Security (RLS)
- **Frontend**: React + Vite (deployed to Base44)
- **Auth**: Base44 built-in authentication system

### Repository Structure
```
/home/svc-user/app-workspaces/
├── example-marketplace/                    # Base44-managed repo (auto-deployed)
│   ├── functions/               # 49 backend functions (TypeScript/Deno)
│   ├── src/                     # React frontend
│   ├── package.json             # @base44/sdk dependencies
│   └── vite.config.js           # Base44 vite plugin
│
└── example-marketplace-docs/               # Documentation repo (git remote)
    ├── skills/base44-environment/      # Base44 environment control (this skill)
    │   ├── scripts/             # Discovery & test scripts
    │   ├── docs/                # API documentation
    │   └── discovery-output/    # Environment maps
    ├── analysis/                # Product analysis docs
    └── code-reviews/            # Code review findings
```

**IMPORTANT**:
- `example-marketplace/` is managed by Base44 - changes only through Base44 platform
- `example-marketplace-docs/` is the documentation git repo - safe for custom tooling
- Never commit custom scripts to `example-marketplace/` - they'll be overridden

## Environment Configuration

### Base44 App Details

**Example Marketplace:**
```bash
APP_ID="693ba692c92a2e5d0262231d"
BASE_URL="https://example-marketplace.example.invalid"
API_KEY="EXAMPLE_API_KEY"  # from discovery-output
```

**Distrilicious:**
```bash
APP_ID="698c626321827d1398efdb01"
BASE_URL="https://distrilicious.base44.app"
# Use JWT Bearer — see Authentication section above
```

### API Endpoints
```
Function Execution:
POST https://example-marketplace.example.invalid{functionName}

Headers:
{
  "Content-Type": "application/json",
  "api_key": "YOUR_BASE44_API_KEY"
}
```

## Backend Functions (49 Total)

### Authentication & Security (7)
- `validateUserType` - Enforce user type restrictions
- `validateAction` - Permission validation
- `secureOperation` - Secure operation wrapper
- `validateOrigin` - CSRF origin validation
- `csrfProtection` - CSRF token validation
- `auditLog` - Security audit logging
- `_validateOrigin` - Internal origin validator

### User & Location Management (3)
- `getUserLocations` - Get user's accessible locations
- `updateUserLocation` - Update location details
- `atomicEmployeeCreate` - Create employee with atomicity

### Check-In & Location (4)
- `checkIn` - Basic check-in function
- `secureCheckIn` - Check-in with security
- `generateLocationQR` - Generate QR codes for locations
- `getCheckInCooldown` - Get cooldown status

### Payments & Subscriptions (10)
- `stripeCheckout` - Create Stripe checkout session
- `stripeCreateCheckout` - Alternative checkout flow
- `stripePortal` - Customer portal redirect
- `stripePortalSession` - Portal session creation
- `stripeWebhook` - Stripe webhook handler
- `customerCheckout` - Customer subscription checkout
- `customerPortalSession` - Customer portal access
- `customerSubscriptionCheckout` - Subscription checkout
- `customerSubscriptionWebhook` - Subscription webhook
- `getSubscriptionStatus` - Check subscription status

### AI Features (3)
- `generateAIDeal` - AI-powered deal generation
- `checkAICredit` - Check AI credit balance
- `consumeAICredit` - Consume AI credits

### Sample/Referral System (4)
- `processSampleActivation` - Activate sample status
- `sampleTierEngine` - Calculate sample tier
- `submitSampleReferral` - Submit referral
- `syncLoyaltyPoints` - Sync loyalty point totals

### Business Logic (7)
- `fraudDetection` - Detect fraudulent activity
- `jobRunner` - Background job execution
- `stateEngine` - State machine processor
- `rateLimiter` - Rate limiting enforcement
- `customerEntitlementCheck` - Check customer entitlements
- `verifySubscriptionStatus` - Verify active subscription
- `rsvpEvent` - Event RSVP handling

### Data Operations (6)
- `batchLocationData` - Batch location operations
- `cascadeDelete` - Cascade delete operations
- `recordPurchase` - Record customer purchase
- `calculateBusinessUsage` - Calculate usage metrics
- `trackCustomerUsage` - Track customer activity
- `migrateLocationOwners` - Migrate location ownership

### Helper Functions (5)
- `_auditHelpers` - Audit logging utilities
- `_geo` - Geolocation utilities
- `_onesignal` - OneSignal push notification helpers
- `_pushTargeting` - Push notification targeting
- `getOneSignalAppId` - Get OneSignal app ID

## Database Collections (49 Total)

### Core Entities
- `User` - User accounts and profiles
- `Location` - Business locations
- `Employee` - Employee records
- `TeamMember` - Location team members

### Scheduling & Time Tracking
- `Shift` - Employee shifts
- `EmployeeBreak` - Break records
- `WeeklyBreak` - Weekly break config
- `WeeklyHours` - Weekly hour limits
- `Exception` - Schedule exceptions

### Customer Engagement
- `CheckIn` - Customer check-ins
- `CustomerLoyalty` - Loyalty accounts
- `LoyaltyChallenge` - Loyalty challenges
- `LoyaltyTier` - Loyalty tier config
- `CustomerBadge` - Achievement badges
- `CustomerPreference` - User preferences

### Deals & Offers
- `Deal` - Deal/promotion records
- `PersonalizedOffer` - Personalized offers
- `DailyHighlight` - Daily highlighted deals
- `FlashSlot` - Flash sale slots

### Events & Bookings
- `Event` - Business events
- `Booking` - Event bookings
- `StandbyQueue` - Event standby queue
- `Waitlist` - Waitlist entries

### Reviews & Ratings
- `Review` - Customer reviews
- `EmployeeRating` - Employee ratings

### Messaging
- `Conversation` - Message threads
- `Message` - Individual messages
- `NotificationLog` - Push notification log

### Payments & Subscriptions
- `Transaction` - Payment transactions
- `Subscription` - Subscription records
- `CustomerSubscription` - Customer subscriptions
- `PaymentMethod` - Stored payment methods
- `BankAccount` - Bank account info
- `PurchaseHistory` - Purchase records

### Sample/Referral Program
- `SampleProfile` - Sample user profiles
- `SampleReferral` - Referral records
- `SamplePointTransaction` - Point transactions
- `Referral` - General referrals
- `ReferralMilestone` - Referral milestones

### Competitions
- `Competition` - Competition records
- `CompetitionEntry` - Competition entries

### Usage & Analytics
- `BusinessUsage` - Business tier usage tracking
- `CustomerUsage` - Customer usage tracking
- `LocationAIUsage` - AI feature usage by location

### Configuration
- `LaunchConfig` - App launch configuration
- `LaunchIncentive` - Launch incentives
- `Item` - Catalog items
- `Follower` - Social follows

## Base44 SDK Patterns

### Function Invocation
```javascript
// From frontend
const result = await base44.functions.invoke('functionName', {
  param1: 'value1',
  param2: 'value2'
});
```

### Entity Operations
```javascript
// List all
const locations = await base44.entities.Location.list();

// Filter
const activeEmployees = await base44.entities.Employee.filter({
  is_active: true,
  location_id: locationId
});

// Create
const newDeal = await base44.entities.Deal.create({
  title: 'New Deal',
  location_id: locationId,
  discount_percent: 20
});

// Update
await base44.entities.Location.update(locationId, {
  business_name: 'Updated Name'
});

// Delete
await base44.entities.Deal.delete(dealId);
```

### Service Role (Bypass RLS in Functions)
```typescript
// Inside a backend function
const base44 = createClientFromRequest(req);

// Service role bypasses RLS
const allUsers = await base44.asServiceRole.entities.User.list();
```

### Authentication
```javascript
// Check auth
const isAuthed = await base44.auth.isAuthenticated();

// Get current user
const user = await base44.auth.me();

// Logout
await base44.auth.logout();

// Redirect to login
base44.auth.redirectToLogin();
```

## Complete Database Dump (JSON)

### 🎯 Capability: Full Database Export

We have dumped the **entire Example Marketplace database as JSON files**. This includes:
- **20 entity types** (Location, Deal, Review, User, etc.)
- **75 records total** with complete schema
- **All fields** from every collection
- **108KB total** of actual live database data

### Location of Database Dump

```
/home/svc-user/app-workspaces/example-marketplace-docs/base44-environment/discovery-output/entities/
```

**Files** (20 entity types as JSON):
- Location.json (9 records) - All business locations
- Deal.json (8 records) - All deals/promotions
- Review.json (7 records) - All customer reviews
- CheckIn.json (7 records) - All check-in records
- CustomerLoyalty.json (8 records) - All loyalty accounts
- LoyaltyTier.json (11 records) - All loyalty tiers
- Item.json (6 records) - All menu/catalog items
- User.json (5 records) - All user accounts
- Shift.json (3 records) - All work shifts
- Message.json (3 records) - All direct messages
- PersonalizedOffer.json (2 records) - All custom offers
- Booking.json (2 records) - All reservations
- Event.json (1 record) - Event records
- Competition.json (1 record) - Competition records
- Employee.json (2 records) - Employee records
- PaymentMethod.json, Subscription.json, etc. (empty)

### How We Did It

**Step 1: Direct Entity API Queries**
```bash
# Query any entity collection directly
curl -X GET "https://example-marketplace.example.invalid{EntityName}" \
  -H "api_key: YOUR_BASE44_API_KEY"

# Example: Get all Locations
curl -X GET "https://example-marketplace.example.invalid" \
  -H "api_key: YOUR_BASE44_API_KEY"

# Returns: JSON array of all records
[
  {"business_name": "The Rusty Spoon", "category": "restaurant", ...},
  {"business_name": "Bean & Brew", "category": "cafe", ...},
  {...}
]
```

**Step 2: Automated Dump Script**
```bash
#!/bin/bash
# Script: 3-query-all-entities.sh

APP_ID="693ba692c92a2e5d0262231d"
BASE_URL="https://example-marketplace.example.invalid"
API_KEY="EXAMPLE_API_KEY"

# Query all 20 entities and save as JSON
for entity in Location Deal Review User CheckIn ... ; do
  curl -X GET "${BASE_URL}/api/apps/${APP_ID}/entities/${entity}" \
    -H "api_key: ${API_KEY}" \
    > "entities/${entity}.json"
done
```

**Step 3: Result**
- 20 entity JSON files created
- 108KB of complete database dump
- Can be refreshed anytime with the script

### Using the Database Dump

**Load and Query in Memory**:
```bash
# Read Location data
cat entities/Location.json | python3 -m json.tool

# Filter with jq
cat entities/Deal.json | jq '.[] | select(.is_active == true)'

# Get statistics
cat entities/Location.json | jq 'length'  # Count records
cat entities/Location.json | jq '.[].category' | sort | uniq -c  # Category breakdown
```

**Parse in Code**:
```python
import json

# Load Location data
with open('discovery-output/entities/Location.json') as f:
    locations = json.load(f)

# Analyze
for loc in locations:
    print(f"{loc['business_name']}: {loc['category']} in {loc['city']}")

# Get stats
print(f"Total locations: {len(locations)}")
print(f"Open now: {sum(1 for l in locations if l.get('is_open_now'))}")
```

### Database Access Methods

| Method | What You Get | Auth Required |
|--------|-------------|---|
| **Direct Entity Query** | All records from collection | API key only ✅ |
| **Backend Function** | Filtered/processed data | API key + user token |
| **Service Role Function** | All data (bypasses RLS) | API key + function code |

---

## Deploying Functions via API

Base44 provides a **coding/write API** for creating, updating, and deleting functions/pages programmatically.

### API Endpoint
```
POST https://app.base44.com/api/apps/{APP_ID}/coding/write
```

### Authentication
```bash
-H "api_key: YOUR_BASE44_API_KEY"
```

### CRUD Operations

#### Create/Update Function or Page
```bash
# Method 1: Using jq to prepare payload (RECOMMENDED - handles special chars)
jq -n --rawfile content /path/to/function.ts \
  '{file_path: "functions/myFunction", content: $content}' > /tmp/payload.json

curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/payload.json

# Method 2: Direct inline (only for simple content)
curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"file_path": "pages/TestPage", "content": "export default function Test() { return <div>Hello</div>; }"}'
```

#### Delete Function or Page
```bash
curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"file_path": "pages/TestPage", "content": "", "delete": true}'
```

#### Read Current State
```bash
# Get entire app configuration (all functions and pages)
curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -H "Content-Type: application/json" \
  # SAFE: round-trip an existing page so nothing is overwritten
  # Replace src/pages/Home.jsx with any existing page in your project
  --data-binary "$(jq -n --rawfile content src/pages/Home.jsx '{file_path: "pages/Home", content: $content}')" | jq '.functions.targetFunction'
```

### File Paths
- **Functions**: `functions/functionName` (no `.ts` extension)
- **Pages**: `pages/PageName` (no `.jsx` extension)

### Important Notes
- **No Git Required**: Changes deploy instantly via API (Base44 overrides git anyway)
- **UI Caching**: After API deployment, hard refresh browser (Ctrl+Shift+R) to see changes in editor
- **Special Characters**: Always use `jq --rawfile` method for production code with quotes, newlines, etc.
- **Response**: Returns full app config on success with `id` field
- **Deployment Time**: ~2-5 seconds for changes to be live

### Example: Deploy Migration Function
```bash
# Save function code to file
cat > /tmp/migrateLocationOwners.ts << 'EOF'
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  // Function code here
});
EOF

# Create payload
jq -n --rawfile content /tmp/migrateLocationOwners.ts \
  '{file_path: "functions/migrateLocationOwners", content: $content}' > /tmp/payload.json

# Deploy
curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/payload.json | jq 'if .id then "✅ Deployed successfully" else . end'
```

---

## Running Backend Functions via API

### Function Execution Endpoint
```
POST https://example-marketplace.example.invalid{APP_ID}/functions/{functionName}
```

### Authentication
```bash
-H "Content-Type: application/json"
-H "api_key: YOUR_BASE44_API_KEY"
```

### Examples

#### Simple Function (No Parameters)
```bash
curl -X POST "https://example-marketplace.example.invalid" \
  -H "Content-Type: application/json" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -d '{}'
```

#### Function with Parameters
```bash
curl -X POST "https://example-marketplace.example.invalid" \
  -H "Content-Type: application/json" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -d '{"location_id": "693d12843d11c23edceb170a"}'
```

#### Migration Function
```bash
# Run data migration (idempotent - safe to run multiple times)
curl -X POST "https://example-marketplace.example.invalid" \
  -H "Content-Type: application/json" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -d '{}' | jq .

# Response:
# {
#   "success": true,
#   "summary": {
#     "total": 9,
#     "migrated": 9,
#     "skipped": 0,
#     "errors": 0
#   }
# }
```

### Important Notes
- **API Key Only**: Most service-role functions work with just API key
- **User Token Required**: Some functions need user authentication (JWT)
- **Idempotent**: Migrations can be run multiple times safely
- **Response**: Always JSON with success/error status

---

## Deploying Entity Schemas via API

Entities (database schemas) can be modified programmatically via the same coding/write API.

### Read Current Entity Schema
```bash
# SAFE: round-trip an existing page's real content so it is not overwritten
# Replace src/pages/Home.jsx with any existing page in the project
jq -n --rawfile content src/pages/Home.jsx '{file_path: "pages/Home", content: $content}' | \
curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -H "Content-Type: application/json" \
  -d @- | jq -r '.entities.Location'
```

> ⚠️ **NEVER use `"content": "dummy"`** — coding/write always writes. Passing fake content
> overwrites the live page and breaks the app. Always read the real file first and pass it back.

### Update Entity Schema
```bash
# 1. Create updated schema JSON
cat > /tmp/location_entity.json << 'EOF'
{
  "name": "Location",
  "type": "object",
  "properties": {
    "owner_id": {
      "type": "string",
      "description": "ID of the business owner (immutable, for fast lookups)"
    },
    "owner": {
      "type": "string",
      "description": "Email of the business owner (for display)"
    },
    "business_name": {
      "type": "string",
      "description": "Name of the business"
    }
    // ... rest of properties
  },
  "required": ["business_name", "category"]
}
EOF

# 1b. Create a durable schema-change artifact in the repo. The Bash guard
# requires rollback plus round-trip/persistence/RLS/probe evidence.
# Example path: .svc/base44-schema-change-WI-123.md

# 2. Deploy entity schema
jq -n --rawfile content /tmp/location_entity.json \
  '{file_path: "entities/Location", content: $content}' > /tmp/payload.json

SVC_BASE44_SCHEMA_WRITE_ARTIFACT=.svc/base44-schema-change-WI-123.md \
curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/payload.json
```

### Entity Path Convention
```
entities/{EntityName}
```

Examples:
- `entities/Location`
- `entities/Deal`
- `entities/User`

### Available Entities (50 Total)
```bash
# List all entities (SAFE: round-trip real file content)
jq -n --rawfile content src/pages/Home.jsx '{file_path: "pages/Home", content: $content}' | \
curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -H "Content-Type: application/json" \
  -d @- | jq '.entities | keys'
```

**Core Entities:**
- Location, Deal, Item, Employee, TeamMember
- User, Subscription, PaymentMethod
- Review, Follower, CheckIn
- FlashSlot, StandbyQueue, Competition
- LoyaltyTier, LoyaltyChallenge, CustomerLoyalty
- Event, Exception, WeeklyHours, Shift

---

## Database Querying via API

### Direct Entity API (Read-Only)
```
GET https://example-marketplace.example.invalid{APP_ID}/entities/{EntityName}
```

### Query All Records
```bash
# Get all locations
curl -s "https://example-marketplace.example.invalid" \
  -H "api_key: YOUR_BASE44_API_KEY" | jq .

# Get all deals
curl -s "https://example-marketplace.example.invalid" \
  -H "api_key: YOUR_BASE44_API_KEY" | jq .
```

### Filter Specific Fields
```bash
# Get only specific fields from first location
curl -s "https://example-marketplace.example.invalid" \
  -H "api_key: YOUR_BASE44_API_KEY" | \
  jq '.[0] | {business_name, owner_id, owner, created_by_id, created_by}'
```

### Count Records
```bash
curl -s "https://example-marketplace.example.invalid" \
  -H "api_key: YOUR_BASE44_API_KEY" | jq 'length'
```

### Database Dump (All Entities)
```bash
cd /home/svc-user/app-workspaces/example-marketplace-docs/base44-environment

# Dump all 20 entities as JSON files
./scripts/3-query-all-entities.sh

# Results saved to:
# discovery-output/entities/Location.json
# discovery-output/entities/Deal.json
# discovery-output/entities/Review.json
# ... (20 total files, 75 records, 108KB)
```

### What the API Returns
- **Raw database records** - actual columns, no computed fields
- **All fields** - including internal fields like `created_by_id`, `owner_id`
- **JSON array** - array of record objects
- **Unfiltered** - bypasses RLS when using service role

### Important Notes
- **API Key Only**: Entity queries work with just API key (service role)
- **No Filtering**: Base44 entity API doesn't support WHERE clauses via API
- **Full Table Scans**: Returns all records (be careful with large tables)
- **For Filtering**: Use backend functions with `.filter()` or `.list()` methods

---

## Complete Workflow Examples

### Example 1: Add Field to Entity & Populate Data

```bash
# Step 1: Read current entity schema (SAFE: round-trip real file content)
jq -n --rawfile content src/pages/Home.jsx '{file_path: "pages/Home", content: $content}' | \
curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -H "Content-Type: application/json" \
  -d @- | jq -r '.entities.Location' > /tmp/current_schema.json

# Step 2: Add new field to schema
jq '.properties.owner_id = {
  type: "string",
  description: "ID of the business owner (immutable)"
}' /tmp/current_schema.json > /tmp/updated_schema.json

# Step 3: Deploy updated schema
jq -n --rawfile content /tmp/updated_schema.json \
  '{file_path: "entities/Location", content: $content}' | \
curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -H "Content-Type: application/json" \
  -d @-

# Step 4: Run migration to populate new field
curl -X POST "https://example-marketplace.example.invalid" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -d '{}' | jq .

# Step 5: Verify data
curl -s "https://example-marketplace.example.invalid" \
  -H "api_key: YOUR_BASE44_API_KEY" | \
  jq '.[0] | {business_name, owner_id, owner}'
```

### Example 2: Deploy Function & Test

```bash
# Step 1: Write function code
cat > /tmp/myFunction.ts << 'EOF'
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const locations = await base44.asServiceRole.entities.Location.list();
  return Response.json({ total: locations.length });
});
EOF

# Step 2: Deploy function
jq -n --rawfile content /tmp/myFunction.ts \
  '{file_path: "functions/myFunction", content: $content}' | \
curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -H "Content-Type: application/json" \
  -d @-

# Step 3: Test function
curl -X POST "https://example-marketplace.example.invalid" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -d '{}' | jq .

# Step 4: Delete test function
curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"file_path": "functions/myFunction", "content": "", "delete": true}'
```

### Example 3: Fix 403 Origin Error

```bash
# Problem: 403 Forbidden when accessing from example-marketplace.app domain
# Root Cause: Origin validation only allows base44.app

# Step 1: Read current secureOperation function (SAFE: round-trip real file content)
jq -n --rawfile content src/pages/Home.jsx '{file_path: "pages/Home", content: $content}' | \
curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -H "Content-Type: application/json" \
  -d @- | jq -r '.functions.secureOperation' > /tmp/secureOperation.ts

# Step 2: Update validateOrigin function (lines 119-146)
# Replace: const allowedHosts = ['base44.app', 'localhost', '127.0.0.1'];
# With:    const allowedDomains = ['base44.app', 'example-marketplace.app', 'localhost', '127.0.0.1'];
# And fix: .includes() → exact match + subdomain check

# Step 3: Deploy fixed version
jq -n --rawfile content /tmp/secureOperation_fixed.ts \
  '{file_path: "functions/secureOperation", content: $content}' | \
curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -H "Content-Type: application/json" \
  -d @-

# Step 4: Test from example-marketplace.app - 403 error should be gone!
```

---

## Testing Functions

### Using cURL
```bash
curl -X POST "https://example-marketplace.example.invalid" \
  -H "Content-Type: application/json" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -d '{}'
```

### Using Discovery Scripts
```bash
cd /home/svc-user/app-workspaces/example-marketplace-docs/base44-environment

# Run full environment discovery
./scripts/1-discover-environment.sh

# Dump all entity data as JSON
./scripts/3-query-all-entities.sh

# Extract function documentation
./scripts/2-extract-function-docs.sh
```

## Authentication Requirements

**IMPORTANT**: Most functions require user context, not just API key:

```typescript
// Inside function
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();  // Get authenticated user

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Function logic here
});
```

**What this means**:
- API key alone is NOT sufficient for most functions
- Functions need actual user session tokens
- Test via frontend with logged-in user, or use Base44 auth flow

## Common Tasks

### Task: Call a Backend Function
```javascript
const result = await base44.functions.invoke('getUserLocations', {});
console.log(result.data);
```

### Task: Query Database
```javascript
// Get all active deals for a location
const deals = await base44.entities.Deal.filter({
  location_id: 'loc_123',
  is_active: true
});
```

### Task: Create a Record
```javascript
const newEmployee = await base44.entities.Employee.create({
  user_email: 'employee@example.com',
  location_id: 'loc_123',
  role: 'staff',
  is_active: true
});
```

### Task: Test Function Locally
```bash
# Use the discovery script
cd /home/svc-user/app-workspaces/example-marketplace-doc/base44-environment
./scripts/1-discover-environment.sh
```

## Security Notes

1. **Row-Level Security (RLS)**: Database has RLS policies
2. **Service Role**: Functions use `asServiceRole` to bypass RLS
3. **User Validation**: Most functions validate user via `auth.me()`
4. **CSRF Protection**: Functions use origin validation
5. **API Key**: Required in headers but not sufficient alone

---

## External Cron Jobs (No User Auth)

For scheduled background tasks that need to modify the database without user sessions, use **secret-based authentication** instead of `auth.me()`.

### Architecture Pattern

```
┌─────────────────────────┐
│ Cloudflare Worker       │  (runs on schedule: */3 * * * *)
│ (Cron Trigger)          │
└───────────┬─────────────┘
            │ POST + X-Cron-Secret header
            ▼
┌─────────────────────────────────────┐
│ Base44 Function (jobRunner)         │
│ 1. Validates CRON_SECRET header     │  ← Authentication
│ 2. Uses asServiceRole for DB ops    │  ← Authorization
│ 3. Updates database records         │
└─────────────────────────────────────┘
```

### Security Model

| Function Type | Protection | Why |
|--------------|------------|-----|
| **Regular functions** | `auth.me()` - requires logged-in user | Called from frontend with user session |
| **Cron jobs** | `CRON_SECRET` header validation | No user session - called by external scheduler |

### Step 1: Create the Backend Function

```typescript
// functions/jobRunner.ts
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const url = new URL(req.url);
  const jobName = url.searchParams.get('job');

  // SECURITY: Validate CRON_SECRET for cron jobs
  if (jobName === 'auto_reopen') {
    const cronSecret = req.headers.get('X-Cron-Secret');
    const expectedSecret = Deno.env.get('CRON_SECRET');

    if (!expectedSecret || cronSecret !== expectedSecret) {
      return Response.json(
        { error: 'Unauthorized: Invalid or missing CRON_SECRET' },
        { status: 401 }  // Blocks spam/unauthorized requests
      );
    }

    // Authenticated! Now do DB operations with service role
    const expiredBreaks = await base44.asServiceRole.entities.Location.filter({
      current_status: 'on_break'
    });

    for (const loc of expiredBreaks) {
      if (new Date(loc.temporary_close_until) < new Date()) {
        await base44.asServiceRole.entities.Location.update(loc.id, {
          current_status: 'open',
          temporary_close_until: null
        });
      }
    }

    return Response.json({ success: true, processed: expiredBreaks.length });
  }

  return Response.json({ error: 'Unknown job' }, { status: 400 });
});
```

**Key points:**
- NO `auth.me()` call - this function doesn't need a user session
- Validates `X-Cron-Secret` header instead
- Uses `asServiceRole` for all database operations

### Step 2: Set CRON_SECRET in Base44

1. Go to Base44 console → Functions → Environment Variables
2. Add: `CRON_SECRET` = `<your-64-char-secret>`

Generate a secret:
```bash
openssl rand -hex 32
# Example: YOUR_64_CHAR_CRON_SECRET
```

### Step 3: Create Cloudflare Worker

```javascript
// workers/auto-reopen-cron.js
export default {
  async scheduled(event, env, ctx) {
    const jobRunnerUrl = 'https://example-marketplace.app/api/functions/jobRunner?job=auto_reopen';

    const response = await fetch(jobRunnerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': env.CRON_SECRET  // Secret from worker env
      }
    });

    const result = await response.json();
    console.log('Job result:', result);
  },

  async fetch(request, env) {
    // Manual trigger endpoint for testing
    await this.scheduled(null, env, null);
    return new Response(JSON.stringify({ message: 'Manual trigger completed' }));
  }
};
```

### Step 4: Configure Worker with wrangler.toml

```toml
name = "example-marketplace-auto-reopen"
main = "auto-reopen-cron.js"
compatibility_date = "2024-01-01"

[triggers]
crons = ["*/3 * * * *"]  # Every 3 minutes
```

### Step 5: Deploy Worker & Set Secret

```bash
cd workers

# Deploy the worker
wrangler deploy

# Set the CRON_SECRET (must match Base44 env var)
wrangler secret put CRON_SECRET
# Paste the same 64-char secret when prompted
```

### Testing

```bash
# Test 1: Without secret → Should be BLOCKED (401)
curl -X POST "https://example-marketplace.app/api/functions/jobRunner?job=auto_reopen"
# {"error":"Unauthorized: Invalid or missing CRON_SECRET"}

# Test 2: With wrong secret → Should be BLOCKED (401)
curl -X POST "https://example-marketplace.app/api/functions/jobRunner?job=auto_reopen" \
  -H "X-Cron-Secret: wrong-secret"
# {"error":"Unauthorized: Invalid or missing CRON_SECRET"}

# Test 3: With correct secret → Should WORK
curl -X POST "https://example-marketplace.app/api/functions/jobRunner?job=auto_reopen" \
  -H "X-Cron-Secret: YOUR_64_CHAR_CRON_SECRET"
# {"success":true,"processed":1}

# Test 4: Trigger via Cloudflare Worker (uses stored secret)
curl "https://example-marketplace-auto-reopen.yourname.workers.dev"
# {"message":"Manual trigger completed","result":{"success":true}}
```

### Why This Works Without BASE44_SERVICE_TOKEN

The `asServiceRole` capability is **built into the Base44 SDK** for backend functions:

```javascript
const base44 = createClientFromRequest(req);

// asServiceRole is automatically available to backend functions
// No external token needed - it's a privilege of running on Base44's servers
await base44.asServiceRole.entities.Location.update(id, data);
```

The security layers are:
1. **CRON_SECRET** = Authentication (proves request is from your worker)
2. **asServiceRole** = Authorization (built into SDK for server-side code)

### Common Use Cases

- Auto-reopen locations after break expires
- Expire old offers/deals
- Archive inactive conversations
- Process pending referrals
- Clear old notification logs
- Update subscription statuses

## File References

### Discovery Output
- `discovery-output/local-functions.txt` - All function names
- `discovery-output/database-collections.txt` - All collections
- `discovery-output/functions-by-category.md` - Categorized functions
- `discovery-output/README.md` - Environment overview

### Scripts
- `scripts/1-discover-environment.sh` - Full environment discovery
- `scripts/2-extract-function-docs.sh` - Extract function documentation

### Documentation
- `docs/API-REFERENCE.md` - Complete API reference
- `docs/functions/{name}.md` - Individual function docs

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

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
