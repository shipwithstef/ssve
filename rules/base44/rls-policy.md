# Base44 Entity RLS Policy

Every entity schema in a Base44 `user_app` project MUST declare an `rls` block. Default platform behavior with no rules is effectively permissive — any authenticated user can create/read/update/delete any record via the entity API, bypassing custom backend functions like `secureOperation`.

## Why this rule exists

Surfaced 2026-04-26 in Example Marketplace WI-113 → WI-115. Of 76 declared entities, only 1 had any RLS rules. Direct entity API calls bypass code-level security. Bug was hidden because all customer/owner UI flows go through `secureOperation` which enforces ownership in code — but anyone with devtools could call `base44.entities.X.update()` directly and modify others' records.

## Required: every `entities/<EntityName>.json` MUST have an `rls` block

Pattern (adjust per use case):

```json
"rls": {
  "create": { "user_condition": { "role": "user" } },
  "read": {},
  "update": {
    "$or": [
      { "owner_id": "{{user.id}}" },
      { "user_condition": { "role": "admin" } }
    ]
  },
  "delete": {
    "$or": [
      { "owner_id": "{{user.id}}" },
      { "user_condition": { "role": "admin" } }
    ]
  }
}
```

## ⚠️ Critical pitfall — Base44 dashboard "Apply Recommended Rules" generates a MALFORMED rule

The dashboard writes:

```json
"update": {
  "owner_id": "{{user.id}}",
  "$or": [{ "user_condition": { "role": "admin" } }]
}
```

This is valid JSON but semantically wrong. The two keys at the same object level are **AND-ed** (MongoDB query semantics) — meaning the rule reads as "owner_id matches AND user is admin," which is impossible to satisfy. **Always re-write to wrap both conditions inside a top-level `$or`** as shown in the canonical pattern above.

## Deploy via coding/write — same endpoint as schema deploy

The `rls` block is part of the entity schema, deployed via the same `coding/write entities/<EntityName>` endpoint. There is no separate permission-management API.

```bash
ACCESS_TOKEN=$(jq -r '.accessToken' ~/.base44/auth/auth.json)
APP_ID="<your-app-id>"
jq -n --rawfile content entities/<EntityName>.json '{file_path: "entities/<EntityName>", content: $content}' | \
  curl -s -X POST "https://app.base44.com/api/apps/$APP_ID/coding/write" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -d @-
```

The POST response echoes back the deployed schema including `rls` — verify it matches what was sent.

## ⚠️ Guarded write protocol — REQUIRED for entity schema writes

Even though `coding/write entities/<X>` is path-scoped per request, the response body returns the FULL `entities` map (76+ entities for Example Marketplace-scale apps). Past Base44 surprises (WI-066/WI-081 page-overwrite via dummy-content writes; WI-087 sandbox-snapshot drift forcing BuildCanary recovery) make it cheap-and-safe to verify the platform did what we asked. The protocol:

### 1. Pre-flight — capture live RLS state for ALL entities

Before any entity write, snapshot the current rls map for every entity:

```bash
# Round-trip ANY real page to fetch the full app config
ACCESS_TOKEN=$(jq -r '.accessToken' ~/.base44/auth/auth.json)
jq -n --rawfile content src/pages/Home.jsx '{file_path: "pages/Home", content: $content}' | \
  curl -s -X POST "https://app.base44.com/api/apps/$APP_ID/coding/write" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -d @- > /tmp/preflight-rls.json

# Extract per-entity rls fingerprint
python3 -c "
import json, hashlib
cfg = json.load(open('/tmp/preflight-rls.json'))
for name, schema_str in cfg.get('entities', {}).items():
    schema = json.loads(schema_str) if isinstance(schema_str, str) else schema_str
    rls = schema.get('rls')
    fp = hashlib.sha256(json.dumps(rls, sort_keys=True).encode()).hexdigest()[:12] if rls else 'NULL'
    print(f'{name}\t{fp}')" | sort > /tmp/preflight-rls.tsv
```

### 2. Write — single entity only

```bash
jq -n --rawfile content entities/<EntityName>.json '{file_path: "entities/<EntityName>", content: $content}' | \
  curl -s -X POST "https://app.base44.com/api/apps/$APP_ID/coding/write" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -d @- > /tmp/write-response.json
```

### 3. Post-flight — diff every entity's rls fingerprint

```bash
python3 -c "
import json, hashlib
cfg = json.load(open('/tmp/write-response.json'))
for name, schema_str in cfg.get('entities', {}).items():
    schema = json.loads(schema_str) if isinstance(schema_str, str) else schema_str
    rls = schema.get('rls')
    fp = hashlib.sha256(json.dumps(rls, sort_keys=True).encode()).hexdigest()[:12] if rls else 'NULL'
    print(f'{name}\t{fp}')" | sort > /tmp/postflight-rls.tsv

diff /tmp/preflight-rls.tsv /tmp/postflight-rls.tsv
```

**Expected diff:** exactly one line — the entity targeted. ANY other entity changing its fingerprint is a P0 platform regression — STOP, do not proceed with batch writes, capture the diff, and escalate.

### 4. Verify the target entity persisted correctly

Run the WI-113 probe-write-read pattern (`e2e/specs/critical/stream-b/wi113-frontend-sdk-write-probe.critical.spec.ts`-style) against the targeted entity to confirm the rule evaluates as designed.

## Why this protocol is mandatory for batch deploys

WI-115 will deploy RLS to 75 entities in batches B1-B8. Each batch write MUST run pre-flight → write → post-flight → verify per entity (or per small-batch grouping). The cost is ~30s per write; the cost of a silent platform regression that wipes adjacent entities' rules across an 8-batch run is recovery from a permissions hole that affects ALL paying customers.

## Read-back caveat

Reading the schema via the round-trip pattern (POSTing a real page file as content) returns `.entities.<Name>` with the full schema **but the `rls` field may be stripped** by some read paths in the API. Don't trust `rls: null` from a read-back as proof RLS is missing — verify by attempting a write and observing whether RLS evaluates correctly (200 with persisted value vs 403 / silent strip).

## Verification — required before declaring an entity's RLS correct

For each entity with deployed RLS, run a probe-write-read against the runtime evaluator:

1. As a user matching the rule (e.g., owner of a record), attempt an update — should return 200 + value persists
2. As a user NOT matching the rule, attempt the same update — should return 403, NOT silent strip with 200
3. As `asServiceRole` (from a backend function), attempt the update — should succeed because asServiceRole maps to admin role per SDK docs

If any case behaves unexpectedly, the rule is malformed (likely the AND/OR pitfall above) — fix the schema and redeploy.

## Skip / N/A criteria

This rule applies only to Base44 `user_app` projects. `backend_app` projects have a different deploy model. Non-Base44 projects use whatever auth/AuthZ their stack provides.

## When this fires

- Before any first paying customer onboards a Base44 user_app project, every `entities/*.json` must have an `rls` block
- Whenever a new entity is added to a Base44 user_app project
- Whenever Base44 dashboard's "Permissions issue detected" banner appears on any entity
- During `audit-implementation` for any Base44 project — flag any entity without `rls`

## Source

- WI-113 (Example Marketplace) — root cause analysis of malformed RLS pitfall
- WI-115 (Example Marketplace) — systemic 75/76 entities without RLS finding
- Audit script pattern: see `rules/base44/schema.md` for round-trip schema fetch; extend to extract `rls` per entity
