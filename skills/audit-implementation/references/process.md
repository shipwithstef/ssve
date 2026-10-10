# Process — detail

Moved verbatim from SKILL.md (progressive disclosure).

### Phase 1: Specialist Dispatch (parallel)

Before the main correctness audit, dispatch focused specialist subagents
based on diff scope. Each specialist gets the diff + feature spec ACs +
their focused checklist. Findings merge into the audit report.

**Select specialists based on diff scope:**

| Specialist | Dispatch when | Checklist |
|---|---|---|
| testing | always | (1) Every AC has at least one negative-path test (invalid input, timeout, auth failure). (2) Edge cases: empty collections, max-length strings, concurrent access, boundary values. (3) No test isolation violations (shared state, order-dependent, global mocks). (4) No flaky patterns (timing-dependent assertions, network calls in unit tests). (5) Security-specific tests exist for auth, injection, and privilege escalation paths. |
| security | always (NEVER_GATE) | (1) All user input is validated and parameterized — no string concatenation in queries. (2) Auth middleware present on every mutation endpoint — grep for unprotected handlers. (3) No hardcoded secrets, API keys, or credentials in source (check against .env.example). (4) Cryptographic choices are current — no MD5/SHA1 for passwords, no ECB mode, keys >= 256 bits. (5) Rate limiting on authentication endpoints. (6) CORS not set to wildcard in production config. |
| performance | >100 LOC changed OR database queries touched | (1) N+1 query patterns — loops that execute a query per iteration instead of batch. (2) Missing database indexes on columns used in WHERE/JOIN/ORDER BY. (3) Algorithmic complexity — O(n^2) or worse in hot paths, unbounded list operations. (4) Missing pagination on list endpoints. (5) Blocking operations in async contexts (sync file I/O, CPU-bound loops on event loop). |
| data-migration | migration files present (NEVER_GATE) | (1) Migration is reversible — DOWN migration exists and restores prior state. (2) No data loss — columns/tables being dropped have data preserved or migrated first. (3) Lock duration — large table ALTERs use online DDL or batched approach. (4) Backfill strategy — NOT NULL columns on existing tables have a default or backfill step. (5) Multi-phase safety — breaking changes split across deploy-compatible migrations. |
| api-contract | API routes or response shapes changed | (1) No breaking changes to existing response shapes consumed by clients. (2) New required fields have defaults for backwards compatibility. (3) Error response format is consistent with existing endpoints. (4) Versioning strategy applied if breaking change is necessary. (5) Rate limiting and pagination present on new list endpoints. |
| maintainability | >200 LOC changed | (1) No dead code or unused imports introduced. (2) No magic numbers or string constants — extract to named constants. (3) No DRY violations — same logic duplicated across 3+ locations. (4) Conditional side effects — no `if (condition) { sideEffect(); return; }` hidden in getters. (5) Module boundaries respected — no cross-layer imports (controller importing from another controller). |

**NEVER_GATE:** security and data-migration always run regardless of finding
history. Other specialists may be skipped if they consistently produce zero
findings (adaptive gating — evolve over time based on project data).

**Dispatch:** Use parallel Agent subagents. Each receives:
- The git diff (`git diff main..HEAD`)
- The feature spec ACs
- Their specialist checklist (from this table's Focus column)

**Merge:** Deduplicate findings by file:line. If multiple specialists flag
the same location, keep the highest severity. Attribute each finding to its
specialist source.

> **Review-station wave (WI-382 — Claude host).** This specialist fan-out + merge
> is the same mechanical contract the post-exec review station lifts up to span
> skills/review-exec/G5/audit/visual as ONE read-only wave over a single frozen diff. On
> Claude host, audit's specialists run as lenses inside that wave and merge via
> `scripts/review-station-merge.mjs` (this exact dedup-by-file:line / keep-highest
> rule); receipts emit post-barrier. See `references/parallel-review-station.md`.
> Non-Claude hosts run audit serially as today.

Specialist findings feed into Phase 2 hypotheses — a security finding
becomes a hypothesis to test in the correctness audit.

Source: gstack review/SKILL.md (Review Army), MIT, Copyright 2025 Garry Tan.

### Phase 3: Audit One Subsystem At A Time

For each subsystem:

1. **Trace the happy path** from entrypoint to response
2. **Trace error paths** — what happens on invalid input, timeout, DB failure?
3. **Trace cleanup/shutdown** — any resources leaked? Connections unclosed?
4. **Compare against ACs** — does the implementation actually satisfy each AC it claims to cover?

**Vibe Audit (Masterclass UI):**
For features with a "Vibe Contract," the auditor MUST re-score the final implementation against the **Aesthetic Scoring Rubric** (Precision, Resonance, Novelty, Efficiency, Maturity).
- **Target**: Aggregate Score 90+.
- **Check**: Does the visual grit and interaction physics match the technical Motion Schema in `vibe-contract.json`?

5. **Compare against journeys** — walk through the Gherkin steps, does each map to working code?
6. **Run validation commands** from the manifest — do they still pass?

**Parallel subsystem audit with subagents:**

When subagents are available, assign one subsystem per subagent. Each subagent
receives a scoped context — use this template:

```
You are auditing one subsystem of a feature for correctness.

## Constraints
- Audit ONLY the files listed below. Do NOT scan directories or grep the codebase.
- If you need to check a consumer of an export, report the question back to the
  orchestrator — do not search for it yourself.
- Trace behavior through YOUR files only. Report boundary assumptions
  (what you expect other subsystems to provide) rather than verifying cross-boundary.

## Your subsystem files (disjoint — no other auditor has these)
[INSERT only files from the manifest assigned to this subsystem]

## AC slice
[INSERT only the AC rows this subsystem covers]

## Hypotheses to test
[INSERT hypotheses from Phase 2 for this subsystem]

## Validation commands
[INSERT relevant validation commands from manifest]
```

File disjointness is enforced by the orchestrator. Cross-subsystem questions
(e.g., "does service A call service B correctly?") are reported back and
resolved in Phase 5 convergence, not by individual subagents scanning beyond
their boundary.

### Output: `docs/specs/audit/<name>-analysis.md`

```markdown
# Systems Analysis: <feature name>

**Date:** <timestamp>
**Branch:** <branch name>
**Spec:** <feature spec path>

## Verification Contract
| AC | What code must do | Verified? |
|----|-------------------|-----------|
| AC-01 | ... | ✅ Confirmed |
| AC-02 | ... | ⚠️ Likely OK (see F-2) |
| AC-03 | ... | ❌ Violation (see F-1) |

## Coverage Ledger
| Subsystem | Risk | Status | Findings |
|-----------|------|--------|----------|
| API routes | High | done | F-1, F-2 |
| Data model | High | done | none |
| Services | Medium | done | F-3 |

## Findings

### F-1: <title>
...

## Residue
<TODO/FIXME count, dead code, orphaned imports>

## Unverified Surfaces
<what was not checked and why>

## Verdict
- [ ] READY TO LAND — no Critical/High findings
- [ ] BLOCKED — Critical findings must be fixed first
- [ ] CONDITIONAL — High findings should be fixed, Medium acceptable
```
