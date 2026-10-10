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
