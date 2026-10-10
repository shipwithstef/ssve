## Phase 4 — Update the blend registry

After the blend plan is approved and implemented, update
`references/blend-registry.json`:

```json
{
  "sources": [
    {
      "name": "gstack",
      "url": "https://github.com/garrytan/gstack",
      "license": "MIT",
      "author": "Garry Tan",
      "blends": [
        {
          "sha": "abc123...",
          "date": "2026-04-05",
          "patterns_taken": [
            {
              "external_path": "skills/cso/SKILL.md",
              "svc_target": "skills/review-security/SKILL.md",
              "pattern": "OWASP + STRIDE audit"
            }
          ],
          "patterns_skipped": [
            {
              "external_path": "skills/ship/SKILL.md",
              "reason": "land-changeset already covers this"
            }
          ]
        }
      ]
    }
  ]
}
```

This registry is the source of truth for what was taken, when, and from which
version. When re-blending, compare the current HEAD against the last recorded
SHA to scope the analysis.

## Phase 4.5 — Re-evaluate Rules From This Source

After a re-blend (mode 2 or higher), check whether the source contributes
rules to `rulesRegistry`:

```bash
# Find all rules whose source matches this blend key
node -e "
const m = JSON.parse(require('fs').readFileSync('skills-manifest.json','utf8'));
const key = 'blended:ecc'; // replace with this source's blend key
m.rulesRegistry.entries
  .filter(e => e.source === key)
  .forEach(e => console.log(e.path, e.stack, e.last_evaluated));
"
```

For each rule found:
- If `source_sha` differs from the new blend SHA → rule content may have changed upstream. Re-evaluate.
- If `last_evaluated` is older than 90 days → rule freshness expired. Re-evaluate.
- If neither → skip; prior verdict stands.

Re-evaluate via:

```
/evaluate-rule --rule <path> --stack <stack> --scope <scope>
```

Or for a full re-run of all rules from this source:

```
/evaluate-rule --rule-pack rules/<stack>/ --stack <stack> --scope project
```

### Auto-Invoke On-Demand Skills

Phase 4.5 already conditionally invokes `evaluate-rule` when rule staleness is detected. This is the canonical on-demand skill insertion pattern:

| Signal | Skill | Insertion Point | Why |
|--------|-------|-----------------|-----|
| Blended rule `source_sha` differs from new blend SHA or `last_evaluated` > 90 days | `evaluate-rule` | After Phase 4.5 detection, before updating rulesRegistry | Prevents stale or degraded rules from entering the framework |

If `evaluate-rule` is inserted, set `blocked_by` so rule registry updates wait for evaluation PASS. Log the insertion as a `mechanical` decision in `.svc/pipeline-decisions.jsonl`.

After re-evaluation, update `last_evaluated` and `source_sha` in `rulesRegistry` for each rule that passed.

**Why this matters:** Rules blended from an external source were evaluated at a specific SHA. When the source updates its rule files, the distilled rule may no longer reflect the best available content — or the upstream may have added genuine new directives worth adopting.
