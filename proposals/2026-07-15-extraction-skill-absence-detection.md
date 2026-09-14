# Proposal: Absence-detection protocol for extraction/inventory skills

**Status:** Mode 9 shipped for analyze-marketing (2026-07-15, additive reference + SKILL.md mode entry). This proposal covers GENERALIZATION to sibling skills.

deferred_until: 2026-08-25
reason: Generalization is a separate cross-skill contract change and remains outside the WI-489 to WI-487 dependency wave.

**Origin:** example-marketplace WI-MKT-GTM-01 — owner challenged a "complete" marketing-context refresh; a blind two-phase agent review + cross-model adversarial pass found ~12 missing live capabilities and 6 overclaims that every existing gate (no-loss, self-verify, phase receipts) passed over, because all existing gates verify what IS written.

**Pattern to generalize:** any skill whose output claims to inventory a system (capability-registry, audit-coverage, sync-spec-code, onboard-repo discovery, catalog-domain-capabilities) needs: (1) a mechanically-built surface denominator from the ARTIFACT-OF-RECORD LAYER BELOW its usual input (code surfaces below specs; specs below docs); (2) a blind independent reader producing its own inventory BEFORE seeing the skill's output, then diffing; (3) a coverage ledger (surfaces → insight | entry | explicit-skip) whose staleness triggers re-audit; (4) status reconciliation against runtime truth (flags/deploy records), since intermediate-layer status headers lag both directions.

**Candidate next steps (needs plan-changeset per framework policy):** add the shared protocol to `_shared/` and wire preflight staleness flags into the sibling skills above; add a tier-1 validator that flags any inventory-skill completion without a gap_check ledger entry.
