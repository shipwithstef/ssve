# plan-changeset — Per-archetype planning protocols

### What changes per archetype

**Bounded feature:** Proceed to Inputs as written.

**Migration / sweep:** Before reading the full spec:
1. Identify all pattern families the feature's *intent* implies — not just what the spec enumerates.
   ("Fix all hardcoded light-mode colors" implies: bg-white, text-slate-*, border-slate-*,
   bg-gradient-* with light stops, text-gray-*, and any other Tailwind class that doesn't respond
   to html.dark. Not just the ones the spec lists.)
2. For each pattern family, grep the codebase and record:
   ```
   Pattern: bg-white / text-slate-* / border-slate-*
   Files: N  |  Instances: M
   ```
3. Record this universe in the manifest header BEFORE writing a single task.
4. If any pattern family would take more than one focused session to fix: name that phase
   explicitly in the manifest with its instance count. A phase split is a planning decision
   that must be visible, not an implicit "we'll get to the rest later."
5. Phase splitting without universe accounting is scope reduction — banned the same as
   "v1" or "simplified version."

**Architectural change:** Before reading the full spec:
1. Map the current system's invariants in the affected area (what must not break).
2. Identify which subsystems the change touches — grep for cross-references.
3. Assess reversibility: can this be rolled back if it goes wrong?
4. Only then plan tasks; task 1 must be the smallest reversible slice.

**Cross-cutting concern:** Before reading the full spec:
1. Grep the codebase to enumerate all entry points where the concern applies.
2. Record the count. The task graph must cover all of them or explicitly defer with a count.
3. Spec defines the behavior at each entry point; the codebase defines how many entry points exist.

**Base44/backend schema or data work:** Before writing the manifest, ground the
plan in the live or local backend truth source. Do not trust frontend symptoms or
spec claims as schema proof.

```bash
node scripts/audit-base44-entity-rls.mjs --root .
```

If the plan changes RLS/security rules, require a task to run
`validate-security-rule-probe-evidence.mjs` before and after deployment. If it
changes persistence behavior for empty/zero-list symptoms, require a task to run
`classify-persistence-bisect.mjs` before frontend debugging tasks.

**Incremental extension:** Before reading the full spec:
1. Read the existing implementation of the feature being extended.
2. Understand the current patterns and constraints before planning what to add.
3. Scan the existing implementation for deprecated foundations before tasking:

```bash
node scripts/validate-deprecated-foundations-registry.mjs --root .
node scripts/scan-deprecated-foundations.mjs --root . --path <file-or-dir> --first-hit-codebase-scan --promote-findings .svc/deprecated-foundation-findings.jsonl --fail-on-findings
```

If findings exist, the manifest must include a migrate-vs-extend decision,
the successor foundation, the migration size, and either a migration task or a
child WI that owns the debt. Do not create implementation tasks that silently
extend a deprecated API or framework pattern. Confirmed findings are promoted
to `.svc/deprecated-foundation-findings.jsonl` for future sessions.

**Browser-visible MODIFY mock parity gate:** When any task modifies an existing
component, existing route, shared component, visual state, or browser-visible
screen, the manifest MUST reference a Production-Derived Mock Parity Ledger
from `design-ui` before execution tasks are considered runnable.

The ledger reference must prove:
- affected existing component/screen
- production source paths
- current-state evidence
- intended final-state mock/evidence
- affected usages/routes
- spec ACs and journeys covered
- required states and viewports
- known exclusions with rationale

If a browser-visible MODIFY task lacks this ledger, stop planning and route
back to `design-ui`. Do not let generic mocks, isolated HTML variants, or
"new design direction" prose substitute for current-ui parity evidence.

**Capability blocker:** If the WI/spec assumes a provider, SDK, API, auth mode,
host hook, storage primitive, or runtime capability that has not been proven,
plan a pre-implementation diagnostic task before implementation tasks. Route
the task to the matching skill (`validate-feature`, `research`,
`capability-registry`, `capability-concierge`, or the provider environment
skill) and block dependent tasks on its evidence.

