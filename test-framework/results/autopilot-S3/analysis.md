# Autopilot S3 Analysis: Todo-API Real-Time Collaboration

**Type:** Iteration (adding to existing project)
**Mode:** Convert
**Date:** 2026-04-03
**Scenario:** "Add real-time collaboration to the existing todo-api -- multiple users can see each other's changes live."

---

## Convert Mode Differences Observed

| Skill | Bootstrap (S1) | Convert (S3) | Key Difference |
|-------|---------------|-------------|----------------|
| write-vision | Create from scratch: fill every section from user input | Propose refinements: structured proposal with Evidence Table and Approval Gate | Proposal-first, evidence-backed; never overwrites existing vision |
| build-personas | Mode 7 (Auto-Discovery): reads vision, infers all personas at once | Mode 3 (Add New): adds a single persona for a specific new capability | Interactive vs automatic; asks "how does this persona relate to existing ones?" |
| validate-feature | No existing specs: creates initial feature inventory from vision | Cross-references existing specs: validates every existing AC against new requirement | Validates against current state; identifies extensions vs replacements |
| write-spec | Clean slate: all ACs are new, all dependencies are new | References existing ACs: COL-1.4 cites AC-1.3, COL-4.3 cites AC-1.2 | Cascade shows cross-feature deps; dependency table has "existing" vs "new" columns |
| sync-spec-code | Simulated (no code or prior specs to check) | Checks existing VERIFIED specs against new DRAFT specs | Finds real consistency issues (DRIFT-001: overdue-checker gains undocumented WS dependency) |
| write-journeys | Mode 1 (Bootstrap): creates journeys from scratch, no predecessors | Mode 2 (Expand): extends existing J01 with prerequisite, conflict analysis | Extends existing journeys; validates new scenarios against single-user assumptions |

---

## Iteration-Specific Findings

### 1. Convert mode forces backward compatibility analysis

Every artifact produced in S3 had to answer the question: "Does this break anything that already works?" This question does not exist in bootstrap mode. Specific instances:

- **vision-refine-proposal:** Must justify moving "multi-user" from out-of-scope to in-scope with evidence.
- **feature-ship-brief:** Must check every existing AC for impact (6 existing ACs checked, 0 conflicts, 1 extension).
- **sync-spec-code:** Detected DRIFT-001 -- a real consistency issue where the new feature imposes an undocumented requirement on the existing overdue-checker.
- **J02 journey:** Explicit conflict analysis table comparing J01's single-user assumptions against J02's multi-user reality.

### 2. The cascade pattern becomes visible in convert mode

In bootstrap mode, all specs are created simultaneously -- there is no meaningful cascade because nothing existed before. In convert mode, the cascade is explicit:

```
feature-realtime-collab (new)
  +-- feature-todo-management (existing, VERIFIED) -- schema reuse, hydration
  +-- enabler-overdue-checker (existing, VERIFIED) -- extended with WS broadcasting
  +-- enabler-websocket-service (new, PLANNED) -- new infrastructure
       +-- enabler-presence-tracking (new, PLANNED) -- built on WS lifecycle
```

This shows a mixed dependency graph: new specs depending on both existing and new specs. Bootstrap mode only has the latter.

### 3. DRIFT detection is a convert-mode-only capability

The sync-spec-code skill found that enabler-overdue-checker, currently marked VERIFIED, will need an update to its Implementation Notes because the new feature requires it to emit WebSocket events. This kind of finding is impossible in bootstrap mode where all specs start in DRAFT state.

DRIFT-001 is a minor issue, but the pattern is significant: adding a new feature can cause previously VERIFIED specs to need revision. The skill surfaces this proactively.

### 4. Presence of approval gates in convert mode

The vision-refine-proposal includes an Approval Gate -- a checkpoint requiring human confirmation before the vision is modified. Bootstrap mode has no such gate because there is nothing to protect. Convert mode recognizes that existing artifacts represent prior decisions and requires explicit approval to change them.

### 5. AC referencing across feature boundaries

The feature-realtime-collab spec references specific ACs from feature-todo-management (AC-1.2, AC-1.3) in its own AC definitions (COL-1.4, COL-4.3). This cross-feature AC referencing is a convert-mode pattern that validates interface contracts between features.

---

## Updated Completion Criteria

| Criterion | S1 Status | S3 Status | Notes |
|-----------|----------|----------|-------|
| All 19 skills exercised (bootstrap) | Met | N/A | S1 covered all 19 |
| Convert mode tested for 6 core skills | Not tested | Met | write-vision, build-personas, validate-feature, write-spec, sync-spec-code, write-journeys |
| REFINE mode for write-vision | Not tested | Met | Proposal-based refinement with approval gate |
| Add mode for build-personas | Not tested | Met | Single persona addition (Mode 3 vs Mode 7) |
| Cross-reference validation in validate-feature | Not tested | Met | Existing ACs checked against new requirement |
| Drift detection in sync-spec-code | Not possible (no prior specs) | Met | DRIFT-001 found |
| Expand mode for write-journeys | Not tested | Met | J02 extends J01 with prerequisite and conflict analysis |
| Iteration workflow (add feature to existing project) | Not tested | Met | Full end-to-end: vision refine -> persona add -> feature discover -> spec write -> sync check -> journey expand |

---

## Glue Boundary Coverage

### Boundaries Re-Tested in Convert Mode

| Boundary | S1 Test | S3 Test | Difference |
|----------|---------|---------|------------|
| Vision -> Persona | Vision creates personas | Vision refinement triggers persona addition | Convert: incremental persona creation |
| Persona -> Feature | Personas inform feature discovery | New persona (P2) is the consumer of the new feature | Convert: persona drives feature, not vice versa |
| Feature -> Spec | Feature inventory drives spec creation | Feature ship brief validates existing specs before new spec is written | Convert: validation before creation |
| Spec -> Spec (cross-feature) | Single spec references its own enablers | New spec references ACs from existing feature spec | Convert: cross-feature AC referencing |
| Spec -> Sync | Sync checks internal consistency | Sync checks cross-spec consistency and detects drift | Convert: drift detection between old and new |
| Sync -> Journey | Journey created from specs | Journey extends existing journey with conflict analysis | Convert: expansion, not creation |
| Feature -> Enabler cascade | Linear: Feature -> Enabler | Mixed: Feature -> Existing Feature + Existing Enabler (extended) + New Enabler -> New Enabler | Convert: mixed new/existing dependency graph |

### New Boundaries Discovered in S3

| Boundary | Description |
|----------|------------|
| Approval Gate | Vision refinement requires explicit human approval before proceeding -- a boundary that does not exist in bootstrap mode |
| DRIFT remediation | sync-spec-code identifies existing specs that need updates, creating a remediation workflow that feeds back into the spec-writing phase |
| Prerequisite chaining | J02 declares J01 as a prerequisite, creating an ordered journey dependency that does not exist when all journeys are created simultaneously |

---

## Artifact Inventory

| # | Artifact | File | Skill | Mode |
|---|----------|------|-------|------|
| 1 | Vision refinement proposal | `svc/vision-refine-proposal.md` | write-vision | REFINE |
| 2 | Team Collaborator persona | `svc/P2-team-collaborator.md` | build-personas | Add New (Mode 3) |
| 3 | Feature ship brief | `svc/feature-ship-brief-realtime-collab.md` | validate-feature | Validate |
| 4 | Real-time collab feature spec | `svc/feature-realtime-collab.md` | write-spec | New (referencing existing) |
| 5 | Spec-code sync report | `svc/sync-spec-code-report.md` | sync-spec-code | Convert |
| 6 | Real-time collab journey | `svc/J02-realtime-collab.feature.md` | write-journeys | Expand (Mode 2) |
| 7 | S3 analysis | `analysis.md` | (meta) | N/A |

---

## Recommendations for Framework

1. **Make drift detection a first-class output.** DRIFT-001 is the most valuable finding in S3 -- it surfaces a real consistency issue that would otherwise be discovered at implementation time. The framework should promote drift detection as a key benefit of convert mode.

2. **Approval gates should be configurable.** The vision-refine-proposal includes an approval gate, but in autopilot mode the approval is simulated. The framework should support both interactive (human approves) and automated (CI/CD rule-based) approval paths.

3. **Cross-feature AC referencing needs a registry.** When COL-1.4 references AC-1.3, there is no automated way to validate that AC-1.3 still exists or has not changed. A spec registry that tracks cross-references would make convert mode more robust.

4. **Journey prerequisite ordering needs validation.** J02 declares J01 as a prerequisite, but there is no mechanism to enforce this ordering in test execution. The framework should support ordered journey execution.
