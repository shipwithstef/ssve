# WI-142 Plan Manifest

## Work Item
WI-142: Industry Grounding becomes default — knowledge-base read at gate, never web-fetch

## Lane
framework

## Changeset

### Already implemented (commit 12ee392)
- `references/templates/industry-grounding.md` — four-part section template
- `references/templates/competitive-risk-assessment.md` — redirect to new template
- `scripts/gates/competitive.mjs` — section header updated to `## Industry Grounding`
- `test-framework/evals/tier-1/validate-feature-competitive-cross-reference.sh` — keyword regex removed, universal gate
- `test-framework/evals/tier-1/validate-industry-grounding-section.sh` — enforces four-part substructure
- `test-framework/evals/tier-1/validate-no-web-fetch-in-gate.sh` — defensive lockdown on network calls
- `validate-feature/SKILL.md`, `write-spec/SKILL.md` — universal gate guidance
- `research/SKILL.md`, `svc-advisor/SKILL.md` — always-surface competitive context
- `references/framework-learnings.jsonl` — 3 new entries

### This changeset (design-tech → execute)
- `docs/specs/features/industry-grounding-default.md` — Technical Design added, status → BASELINED
- `scripts/lib/structured-gate-engine.mjs` — `readKnowledgeBase(slugs, topic)` export (GROUND-01..03)
- `references/knowledge/competitors/index.md` — canonical layout doc (GROUND-04)
- `references/knowledge/competitors/_test-fixture/acme-corp/` — tier-1 test fixture

## Validation Plan
- [x] `validate-no-web-fetch-in-gate.sh` PASS
- [x] `validate-industry-grounding-section.sh` PASS
- [x] `validate-feature-competitive-cross-reference.sh` PASS
- [ ] `readKnowledgeBase` unit test against fixture
- [ ] Tier-1 full suite (`bash test-framework/evals/run-all-evals.sh`)

## Checkpoints
- G4 (design-tech): Technical Design written, all ACs feasible
- G5 (execute-changeset): Implementation matches plan
- G6 (land-changeset): Clean squash-merge
- G7 (verify-promotion): Post-merge tier-1 pass
