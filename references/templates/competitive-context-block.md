# Competitive Context Block — auto-surface template

Auto-appended by `research` and `svc-advisor` when query topic matches a domain slug in `references/knowledge/competitive-domains.json`. Reads from project's `docs/specs/analyze-competitors.data.json`.

```markdown
## Competitive Context

> Auto-surfaced because query topic matches `<domain>` (per references/knowledge/competitive-domains.json).
> Source: `docs/specs/analyze-competitors.data.json` (last_verified: <date>, landscape_state: <state>)

| Competitor | Earn mechanism | Enrollment | Merchant cost |
|-----------|---------------|-----------|---------------|
| <name>    | <mech>        | <path>    | <cost>        |

**Your project's mechanism for the same domain:** <if known from project docs/spec>
**Divergence:** <which competitor patterns are NOT used by this project>

If `analyze-competitors.data.json` is stale (>90 days) or missing:

> ⚠️ **Competitive context unavailable: `analyze-competitors.data.json` is stale or missing.**
> Invoke `/analyze-competitors` (per WI-140 SDKG `competitor-analysis` instance) to refresh structured competitor data before relying on advice in this domain. Stale-data warnings are surfaced rather than fabricated context (per KNOW-03).
```
