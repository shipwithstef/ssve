# Token Optimization: Spec-as-Index, Eliminate Redundant Code Scans

**Date:** 2026-04-05
**Status:** IMPLEMENTED

## The Insight

svc's spec system makes everything accountable and trackable. This means most
skills don't need to scan the codebase — they can read the spec and know exactly
which files matter. Skills that ignore this and scan the whole codebase waste
tokens on code that's irrelevant to their task.

## Evidence

### Skill categorization (38 skills audited)

| Category | Count | Token cost profile |
|----------|-------|-------------------|
| SPEC-ONLY (never reads code) | 15 | Minimal — specs are ~2-5K tokens |
| SPEC-FIRST (reads code selectively via annotations) | 9 | Moderate — loads only referenced files |
| CODE-SCAN (greps/scans codebase broadly) | 14 | Heavy — 30-200K tokens depending on codebase |

### Redundant scan chain (the biggest waste)

Three pipeline-adjacent skills scan the codebase for the same information:

```
define-code-style  → scans codebase → produces style-contract.md
design-tech        → scans codebase AGAIN (patterns, boundaries, naming)
plan-changeset     → scans codebase AGAIN ("current patterns, naming, imports")
execute-changeset  → reads "existing code" AGAIN (current patterns)
```

The style-contract already encodes: naming conventions, file structure patterns,
import style, test patterns, error handling, component patterns. Three
downstream skills re-derive the same information from source.

**Estimated waste:** 50-150K tokens per pipeline run (3 redundant scans at
15-50K each).

### Feature spec gaps causing scans

8 categories of structured data are missing from the spec, forcing downstream
skills to grep source code:

1. **API endpoint registry** — no structured method/path/schema table
2. **DB schema** — free-form prose, no column/type/constraint table
3. **Component hierarchy** — flat list, no parent-child tree
4. **Event/message contracts** — no name/payload/producer/consumer table
5. **Env vars per feature** — toggle registry is project-level, not per-spec
6. **AC type tagging** — no behavior/performance/security distinction
7. **Tier-tagged RESOLVED** — annotations lack machine-readable tier field
8. **Dependency spec status** — no status column in System Dependencies

## Implemented Changes

### A. Spec template enrichment (write-spec)

Added structured sections to the spec template:
- API Contracts table (method, path, auth, request, response, AC)
- Data Model table (table, column, type, nullable, AC)
- Component Tree (ASCII hierarchy)
- Event Contracts table (event, producer, consumer, payload, AC)
- Feature Toggles table (toggle, local default, ACs affected)

### B. Context constraints (design-tech, plan-changeset, execute-changeset)

- design-tech: reads style-contract instead of re-scanning source tree
- plan-changeset: reads style-contract + spec annotations, no source scan
- execute-changeset: reads style-contract for patterns, loads only manifest files

### C. Annotation enrichment (sync-spec-code)

- RESOLVED annotations now carry tier tags: `[DB]`, `[API]`, `[UI]`, `[TEST]`

## Estimated Savings

| Change | Tokens saved per run | Affected skills |
|--------|---------------------|----------------|
| Eliminate 3 redundant scans | 50-150K | design-tech, plan-changeset, execute-changeset |
| Structured spec → skip route/schema greps | 10-30K | audit-implementation, sync-spec-code |
| Tier-tagged annotations → skip tier verification | 5-15K | audit-implementation |
| **Total** | **65-195K per pipeline run** |

For a typical 18-step greenfield pipeline at ~500K total tokens, this is a
13-39% reduction.
