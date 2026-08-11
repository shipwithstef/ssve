# Backend Query Gotchas

Use this when a direct backend read returns empty/zero despite a plausible write or
seed. Do not assume an empty result means the record was not created until the
backend/operator behavior has been checked.

| Backend | Known gotcha | Required check |
|---|---|---|
| Base44 | Some Mongo-style operators such as `$gte`, `$lte`, and `$in` can return silently empty results depending on entity field shape and SDK path. | Re-run the probe with a minimal equality filter or unfiltered list plus local filtering before declaring "not persisted." |
| Base44 | Entity schemas are not enforced like SQL migrations; unknown fields can be stripped or ignored by platform paths. | Compare write payload, API response, and schema round-trip/audit output. |
| Supabase/PostgREST | RLS-denied rows often look like empty result sets instead of explicit errors. | Test with anon key, authenticated user, owner user, and service role separately. |
| Firebase/Firestore | Security-rule denials and missing composite indexes can look similar in client flows. | Capture the exact SDK error code and repeat with emulator/admin context when available. |

When a gotcha applies, record it in the bug brief or plan as:

```text
Backend query gotcha checked: <backend> <operator/path> -> <result>; fallback probe <command/evidence>.
```
