# Base44 Entity Schema Verification

## Entity schemas are fully queryable via API — no dashboard needed

The `coding/write` round-trip returns the complete app config including all entity
schemas with field-level detail (name, type, default, description).

**Never write "requires dashboard check" or "cannot query via API" for schema verification.
It is always possible via the round-trip.**

## The Pattern

```bash
ACCESS_TOKEN=$(cat ~/.base44/auth/auth.json | python3 -c "import json,sys; print(json.load(sys.stdin)['accessToken'])")
APP_ID="693ba692c92a2e5d0262231d"

# Round-trip any real page to get the full app config (nothing gets overwritten)
jq -n --rawfile content src/pages/Home.jsx '{file_path: "pages/Home", content: $content}' | \
curl -s -X POST "https://app.base44.com/api/apps/$APP_ID/coding/write" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d @- | python3 -c "
import json, sys
d = json.load(sys.stdin)
schema = d.get('entities', {}).get('EntityName')  # replace EntityName
if schema:
    props = schema.get('properties', {})
    # Check a specific field:
    print(json.dumps(props.get('field_name'), indent=2))
    # Or list all fields:
    print(sorted(props.keys()))
"
```

## What the response contains

For each field in an entity schema:
- `type` — data type (boolean, string, number, array, etc.)
- `default` — the schema-level default value
- `description` — human-readable description

Example output for `gps_checkins_enabled`:
```json
{
  "type": "boolean",
  "default": true,
  "description": "Whether GPS-based customer check-ins are enabled for this location"
}
```

## When to use

- Verifying a field exists before writing spec annotations as RESOLVED vs PLANNED
- Confirming a field's schema default matches code behavior
- Checking what fields are available on an entity without navigating to the dashboard
- Any time a task says "requires dashboard check" — do this instead

## Safety: the round-trip MUST use real file content

`coding/write` always writes. Pass a real existing page file so nothing is overwritten:
```bash
# ✅ Real content — safe
jq -n --rawfile content src/pages/Home.jsx '{file_path: "pages/Home", content: $content}'

# ❌ Dummy content — will overwrite the live page
--data '{"file_path": "pages/Home", "content": "dummy"}'
```
