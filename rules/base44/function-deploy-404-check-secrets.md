# Base44 Function 404 "Deployment does not exist" — Check Required Secrets FIRST

When a Base44 backend function returns HTTP 404 with body `Deployment does not exist. Try redeploying the function from the code editor section.` — **the most common root cause is a missing required env var in Base44 Secrets**, not a stale deploy artifact, not a compile syntax error, not a sandbox/git issue.

The 404 message is misleading. It actually means **"the module threw during load and produced no runnable artifact"** — and the most frequent reason for a top-level throw is a missing `Deno.env.get('X')` value.

## The Pattern

Modern Base44 functions reject hardcoded secret fallbacks (per `rules/base44/auth-refresh.md`-style WIs) and use strict env-var checks at module top-level:

```typescript
const REDEEM_SECRET = Deno.env.get('REDEEM_SECRET');
if (!REDEEM_SECRET) throw new Error('REDEEM_SECRET not configured in Base44 Secrets');
// ... rest of function
```

If `REDEEM_SECRET` was added to the code but never added to Base44 Secrets:
1. Module load throws
2. Base44's compile pipeline catches the exception silently
3. No deploy artifact is produced
4. Runtime endpoint returns `404 "Deployment does not exist"`
5. **Engineers waste hours assuming the deploy plumbing is broken** when the actual fix is one secret POST

## Required Diagnostic Order — Before Any Other Theory

When ANY Base44 function returns the 404 "Deployment does not exist" message:

### Step 1 — Confirm via dashboard (canonical source of error message)

Open `https://app.base44.com` → app → Functions → click the failing function. The dashboard shows the actual deploy error, e.g. `UNCAUGHT_EXCEPTION at file:///src/main.ts:325 — Error: REDEEM_SECRET not configured in Base44 Secrets`. **This is the one piece of information all the API endpoints hide.** 30 seconds of looking saves hours.

### Step 2 — Map the error line to the missing secret

```bash
# Find the throwing line in source
sed -n '320,330p' base44/functions/<FUNCTION_NAME>/entry/entry.ts

# List all env vars the function expects
grep "Deno.env.get" base44/functions/<FUNCTION_NAME>/entry/entry.ts
```

### Step 3 — Check what's actually configured in Base44 Secrets

```bash
ACCESS_TOKEN=$(jq -r .accessToken ~/.base44/auth/auth.json)
APP_ID="<your-app-id>"
curl -s -X GET "https://app.base44.com/api/apps/$APP_ID/secrets" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq 'keys'
```

This returns an array of all configured secret names (values masked). Compare with the env vars the function expects. If a required name is absent — that's the cause.

### Step 4 — Set the missing secret

```bash
# Generate strong value (HMAC keys: 256-bit hex)
NEW_VAL=$(openssl rand -hex 32)

curl -s -X POST "https://app.base44.com/api/apps/$APP_ID/secrets" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"<SECRET_NAME>\":\"$NEW_VAL\"}" | jq

# Verify it landed
curl -s -X GET "https://app.base44.com/api/apps/$APP_ID/secrets" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq 'has("<SECRET_NAME>")'
```

### Step 5 — Force a redeploy + retest

```bash
# Trigger redeploy via coding/write (writes the function back, refreshes the deploy)
jq -n --rawfile content base44/functions/<FN>/entry.ts --arg fp "functions/<FN>" \
  '{file_path: $fp, content: $content}' | \
curl -s -X POST "https://app.base44.com/api/apps/$APP_ID/coding/write" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -d @-

# Wait ~60s for compile, then test the function endpoint
# Should now return application-layer responses (200/400/500), not 404
```

## Don't

- **Don't assume "Deployment does not exist" means a deploy infrastructure problem.** It usually means module-load threw.
- **Don't run the force-push-back-then-rebase dance** to fix sandbox/origin divergence as the first move. Check secrets first.
- **Don't try `coding/write` with `delete:true` to clear a "stale" artifact.** There's no artifact to delete — compile produced nothing.
- **Don't strip TypeScript syntax** as a fix. Deno supports TS natively. If TS were the issue, every function would fail; only the secret-dependent ones do.
- **Don't reach for a function-split refactor.** Size is rarely the issue; missing secrets are.

## Cross-check: does ANOTHER function with the same secret also 404?

If the function uses `REDEEM_SECRET`, find every other function in the repo that also uses it:

```bash
grep -rE "Deno.env.get\('?REDEEM_SECRET'?\)" base44/functions/
```

If ALL of them 404 with the same message, the secret is genuinely missing. If only one 404s and others work, the issue is something else (rare — but worth eliminating).

## Why This Rule Exists

Real failure mode observed in Example Marketplace 2026-05-06: `secureOperation` (the central entity-write wrapper) and `redeemClaim` both returning 404 "Deployment does not exist" for **8 days**. Engineering session spent ~3 hours on:
- Force-redeploy attempts via `coding/write` (returned `ok` but check was sloppy — actual response had `error_type: SandboxExecutionError`)
- TypeScript Record<> annotation strip (defensive cleanup, not the cause)
- Force-push-back dance to fix sandbox/origin divergence (real bug, but not the deploy issue)
- DELETE-then-recreate cycle (cleared nothing, since no artifact existed)

The actual fix took **30 seconds**: opened the Base44 dashboard, read `Error: REDEEM_SECRET not configured in Base44 Secrets`, ran one POST to `/api/apps/{id}/secrets`. Function deployed instantly.

Root cause was WI-117 (`security: remove all hardcoded secret fallbacks`, commit `b235a8a`, 2026-04-28) — replaced fallback default with strict env-var check, but never added the secret to Base44 Secrets. Production save flows (Hours, Deals, Menu, Branding, all of `/locationprofile`) had been silently broken since.

## Reviewer Hook

`review-security`, `audit-implementation`, and any post-WI-117-style refactor MUST verify:
1. Every `Deno.env.get('X')` with a strict throw has a corresponding entry in Base44 Secrets BEFORE the change ships
2. Pre-deploy verification step in the WI's task graph: `curl GET /api/apps/$APP_ID/secrets | jq 'has("<NEW_SECRET_NAME>")'` returns `true`
3. Post-deploy verification: every affected function endpoint returns non-404 on a smoke test

## Related

- `rules/base44/auth-refresh.md` — same family of strict env-var checks for tokens
- `rules/post-fix-evidence-before-next-fix.md` — would have caught this if dashboard inspection had been Step 1 instead of Step N
- `~/.claude/skills/base44-environment/SKILL.md` — Secrets API documentation (POST/GET endpoints)

## Severity When Violated

**HIGH** — silent multi-day production outages. Affects whatever flow the function gates. For `secureOperation` specifically, this gates ALL owner entity-update flows in the app.
