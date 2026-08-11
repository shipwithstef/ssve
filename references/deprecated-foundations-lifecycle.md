# Deprecated Foundations Lifecycle

`references/deprecated-foundations.json` is a freshness-managed registry, not a
static blacklist. Each entry names a legacy API, SDK pattern, or framework
foundation that must not be extended without an explicit migrate-vs-extend
decision.

## Registry Freshness

The registry root must include `freshness.reviewed_at`,
`freshness.max_age_days`, `freshness.owner_skill`, `freshness.stale_action`,
`freshness.first_hit_scan`, `freshness.promotion_ledger`, and `freshness.policy`.
Validate it before relying on a deprecated-foundation decision:

```bash
node scripts/validate-deprecated-foundations-registry.mjs --root .
```

If the registry is stale, route to `research` before adding new registry rows or
accepting a design that extends a deprecated foundation.

## First Hit Scan

The first confirmed project hit for a foundation must trigger a whole-codebase
scan before implementation tasks are planned. Use the scanner's promotion mode:

```bash
node scripts/scan-deprecated-foundations.mjs --root . --path <file-or-dir> --first-hit-codebase-scan --promote-findings .svc/deprecated-foundation-findings.jsonl --fail-on-findings
```

When the promotion ledger has no prior row for the matched `foundation_id`, the
scanner scans the full repo root and promotes the full set of project-local
findings for that foundation.

## Promotion Surface

Confirmed project-local findings are promoted to
`.svc/deprecated-foundation-findings.jsonl`. Each row records the foundation,
file, line, successor, required decision, scan scope, and promotion targets.

Recurring or cross-project findings should also be summarized in
`docs/learnings/deprecated-foundations.md`; the ledger row keeps that target
visible for future sessions without forcing a learning doc for one-off local
hits.

Validate promoted rows with:

```bash
node scripts/validate-deprecated-foundation-findings.mjs --ledger .svc/deprecated-foundation-findings.jsonl
```
