# review-gate — Specialized mandatory gates (external-state G6/G7, feature-validation closeout, provider fidelity, security rule probe)

## External State Lifecycle Cross-Check (G6/G7) (WI-121)

At G6 (pre-merge final review) and G7 (post-merge verification), cross-check the
final diff against the plan's `## External State Lifecycle` declared set.

### G6 procedure

1. Read the plan's External State Lifecycle table.
2. Diff the current branch against main: `git diff --name-status main...HEAD`.
3. For each touched path, classify against taxonomy entries 1-15 in
   `references/external-state-lifecycle-protocol.md`.
4. If any environment was modified but not declared in the plan: emit HIGH-severity
   `external-state-undeclared` finding and BLOCK approval until the plan is updated.

### G7 procedure (post-merge)

5. Re-run step 2 against the merge commit, expanding to include any host-side
   side effects `./setup` would have triggered.
6. If post-merge state on the host (settings.json, <SKILLS_PATH> symlinks,
   .svc/ files) doesn't match the declared lifecycle wiring, emit
   `external-state-uncoupled` finding.

This is the **Review** stage of the 4-stage external-state gate. See
`references/external-state-lifecycle-protocol.md`.

## Feature Validation Closeout Gate

For user-facing or admin-facing feature work, review-gate cannot return PASS
from screenshots, API probes, or scattered test output alone. If the delivery
graph marks `feature_validation_closeout` as `required`, require a ledger at:

```text
docs/specs/features/test-evidence/<run>/FEATURE_VALIDATION_LEDGER.md
```

Before PASS, run:

```bash
node scripts/validate-feature-closeout-ledger.mjs \
  --feature docs/specs/features/<feature>.md \
  --ledger docs/specs/features/test-evidence/<run>/FEATURE_VALIDATION_LEDGER.md
```

If the work is not user/admin-facing, record the non-user-facing rationale in
the graph skip/evidence ledger. Do not silently treat missing journeys, missing
persona mapping, partial saved states, or blocked mobile/runtime paths as PASS.
`scripts/validate-feature-closeout-ledger.mjs` rejects weak `Persona(s)` cells:
each user/admin-facing row must cite a concrete persona ID/path (`P2`,
`docs/specs/personas/P2.md`, `PERSONA_INDEX.md`) or an explicit `N/A - ...`
reason. `PASS`, `satisfied`, `customer`, `admin`, or `all users` alone is a
blocking persona-trace failure.

If a task graph has no `delivery_graph` but is `greenfield`,
`brownfield-feature`, or otherwise feature-class by its tasks/spec, run:

```bash
node scripts/task-graph.mjs validate .svc/lane-tasks-<WI>.json
```

Treat a missing `build-personas` task and missing top-level `persona_coverage`
decision as a blocking persona-evidence failure. A valid skip must explain why
the work has no user/admin journey or cite the existing persona artifact that
was mapped into the spec.

## Provider Fidelity Gate

For provider-backed or generated-output work, review-gate cannot PASS from
"content exists" evidence. If the delivery graph marks `provider_fidelity` as
`required`, require `PROVIDER_FIDELITY_EVIDENCE.md` at:

```text
docs/specs/features/test-evidence/<run>/PROVIDER_FIDELITY_EVIDENCE.md
```

Before PASS, run:

```bash
node scripts/validate-provider-fidelity-evidence.mjs \
  --evidence docs/specs/features/test-evidence/<run>/PROVIDER_FIDELITY_EVIDENCE.md
```

Fallback, mock, placeholder, uploaded substitute, wrong-provider, or draft-only
evidence fails primary-provider ACs unless the fallback was explicitly approved
and recorded in the evidence file. For generated images, require source
fidelity, semantic relevance, saved-state visibility, and product-quality
review before marking the AC satisfied.

## Security Rule Probe Gate

For any PR that adds or changes an access-control rule, RLS policy, IAM policy,
function auth gate, or Base44 entity schema security block, review-gate cannot
PASS from scanner output or intended policy text alone.

Require before/after probe evidence:

```bash
node scripts/validate-security-rule-probe-evidence.mjs \
  --evidence docs/specs/audit/<entity-or-rule>-security-probe.json
```

For Base44 entity/RLS changes, also require:

```bash
node scripts/audit-base44-entity-rls.mjs --root .
```

G3/G6 fail conditions:

- no non-privileged before probe
- no post-change re-probe
- no regression test path/name in the evidence
- high-traffic entity selected first while fewer than two zero-frontend-caller
  entity deployments have been verified, unless the PR body records an explicit
  emergency override and rollback plan
- derived ownership entity lacks a per-entity decision: denormalized owner,
  defense-in-depth `secureOperation`, or function gateway

