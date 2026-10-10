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
