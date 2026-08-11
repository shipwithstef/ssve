# Harness QA Agent Guide — Detail

## Mechanism

Defines how to build QA agents that catch boundary/integration bugs, not just
existence checks. Based on real bugs from the SatangSlide project.

### The Core Problem: Boundary Mismatch

The most frequent defect type. Two components each work correctly in isolation,
but the contract between them is wrong:

| Boundary | Example |
|---|---|
| API response → frontend hook | API returns `{ projects: [...] }`, hook expects `SlideProject[]` directly |
| API field names → type definitions | API uses camelCase, types use snake_case, TypeScript generics mask the mismatch |
| File paths → link hrefs | Page at `/dashboard/create`, link points to `/create` |
| State transition map → actual updates | Map defines `generating → approved`, code never executes that transition |
| API endpoint → frontend hook | API exists but no corresponding hook calls it |
| Immediate response → async result | API returns 202 status, frontend accesses `data.failedIndices` that only exists in async result |

### Why Static Review Misses These

- TypeScript generics: `fetchJson<SlideProject[]>()` compiles even if runtime shape is `{ projects: [...] }`
- `npm run build` passes ≠ works correctly (type casting, `any`, generics)
- Existence check ≠ connection check: "does the API exist?" vs "does the API response shape match the consumer?"

### Integration Coherence Verification (4 areas)

1. **API response ↔ frontend hook types:** extract `NextResponse.json()` shape, compare to `fetchJson<T>` type. Check wrapping (`.data` unwrap), case conversion, sync vs async response shapes.

2. **File paths ↔ link/router paths:** extract URL patterns from `src/app/` pages, collect all `href`/`router.push()`/`redirect()` values, verify 1:1 match. Watch for route groups `(group)` removed from URL.

3. **State transition completeness:** extract allowed transitions from map, find all `.update({ status: "..." })` in code, verify every code transition is in the map AND every map transition has code executing it. Flag dead transitions.

4. **API ↔ hook 1:1 mapping:** list all API routes with HTTP methods, list all hooks with fetch URLs, identify unpaired APIs (dead code or missing hook).

### QA Agent Design Principles

1. **Use `general-purpose` type, not `Explore`** — QA needs to run scripts, grep patterns, execute verification. Read-only agents can't do this.

2. **Cross-comparison over existence checks:**
   - Weak: "Does the API endpoint exist?"
   - Strong: "Does the API response shape match the consuming hook's type?"

3. **"Read both sides simultaneously"** — Always open producer AND consumer code together. Never verify one side in isolation.

4. **Incremental QA, not end-of-pipeline QA** — Run QA after each module completion, not only after the entire build. Early boundary bugs propagate to later modules.

### Verification Checklist Template

For web apps:
- API ↔ Frontend: response shapes match, wrapping handled, case conversion consistent, all endpoints have hooks
- Routing: all hrefs point to real pages, route groups accounted for, dynamic segments filled
- State Machine: all transitions in map are executed, all code transitions are in map, intermediate→final transitions exist
- Data Flow: DB field names → API fields → frontend types are consistent, optional field null handling matches

### QA Agent Definition Template

```
name: qa-inspector
Role: verify spec compliance + integration coherence + design quality
Priority: 1. integration coherence, 2. functional spec, 3. design, 4. code quality
Method: "read both sides" — always compare producer and consumer together
Communication: report findings with file:line + fix suggestion to the responsible agent
```

## Analysis

- **Useful for:** Any project with API + frontend. The boundary mismatch patterns are universal to web apps.
- **Trade-offs:** Deep QA is expensive (reads many files cross-referencing). Incremental QA (after each module) is cheaper per-run but more total runs.
- **Similar to:** svc's `review-gate` checks artifacts but at a document level, not code boundary level. svc's `audit-implementation` is closer but doesn't have the "read both sides simultaneously" methodology. GSD's `gsd-verifier` checks truths/artifacts/wiring but not at this API↔hook level of detail.
- **Could improve svc by:** Our `verify-promotion` and `audit-implementation` should adopt the "cross-comparison over existence check" principle. Currently svc verifies "does the file exist?" and "does the spec match?" but not "does the API response shape match the consuming component's type?" The 4-area integration coherence model (API↔hook, paths↔links, state transitions, API↔hook mapping) is a concrete verification protocol we don't have.
- **Assumptions:** Web application with API routes + frontend hooks. The specific patterns are Next.js/React focused but the principle (cross-boundary verification) is universal.
- **Watch out for:** The checklist is comprehensive but expensive to run manually. Best automated as scripts in `scripts/` that grep patterns and compare shapes programmatically.

## Key Source Files (L4)
- `skills/harness/references/qa-agent-guide.md:1-228` — full guide with real bug examples
- `skills/harness/SKILL.md:89-93` — QA agent requirements in Phase 3
