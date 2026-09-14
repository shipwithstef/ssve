# Concerns — cross-cutting routing primitives

A "concern" is a subject-matter lens. When a change set touches its signals (file paths, keywords, packages, env vars), the concern engages and routes to the right existing skills/rules.

## Why this exists

The framework has many skills (`strategic-decision`, `manage-finops`, `review-security`, `design-tech`, `validate-feature`, `audit-implementation`, etc.) and many rules. The gap was: **routing from "what changed" to "which thinkers should engage."** route-workflow used to route on verbs (feature / bugfix / refactor); concerns extend it to route on subject matter (this change touches a paid API → invoke manage-finops, this change touches PII → invoke review-security, etc.).

## Layout

```
seriousvibecoding/concerns/
  SCHEMA.md          ← format spec
  README.md          ← this file
  REGISTRY.json      ← generated runtime artifact (committed)
  <name>.md          ← one file per concern
```

Project-side overrides/additions:
```
<project>/.svc/concerns/
  <name>.md          ← project-specific concerns or overrides of universal ones
```

`scan-concerns.mjs` merges universal + project at runtime. Project wins on name collision.

## Lifecycle

1. Author concern file (or copy a universal one to project-side and modify)
2. Skill(s) declare `handles_concerns: [name]` in their SKILL.md frontmatter
3. Run `scripts/build-concern-registry.mjs` — validates + regenerates REGISTRY.json
4. route-workflow scans active change against the registry on session start, before WI dispatch, before commit
5. Matched concerns produce: hard blocks (CRITICAL), required acks (HIGH), advisories (MEDIUM), or silent logs (LOW)

## Coverage target

Phase 1 ships 5 concerns spanning 5 domains, validating the architecture.
Phase 2 brings the universal set to 100+ concerns covering the full software-engineering taxonomy.

See `SCHEMA.md` for the file format and the severity taxonomy.
