# Framework Improvement: Blend last30days-skill

**Status:** IMPLEMENTED (2026-04-12)

## Evidence
- **Source:** blend-external proposal `proposals/2026-04-10-blend-last30days-skill.md`
- **Finding:** (1) svc has no untrusted content fencing — external web content from research/analyze-competitors flows directly into LLM context, enabling prompt injection; (2) tier-1 evals validate structure but not behavior — skills can pass all checks while producing wrong output; (3) last30days-skill is referenced by 4 svc skills but has no formal addon contract in EXTERNAL_ADDONS.md
- **Severity:** medium (AP-25 security), medium (fixture testing gap), low (addon formalization)

## Diagnosis
- **Root cause:** (1) No convention for fencing external content before LLM processing; (2) test-framework was designed for structural + live-server testing, not fixture-based behavioral testing; (3) EXTERNAL_ADDONS.md predated the last30days integration points that were added to individual skills
- **Category:** missing capability (AP-25, fixture mode), drift (addon contract)
- **Already in FRAMEWORK-STATE.md?** No — all three are new findings from the blend

## Implementation
- **Route:** Direct SKILL.md/reference edits
- **Files changed:**
  - `references/anti-patterns.md` — new AP-25 (untrusted content fencing)
  - `research/SKILL.md` — AP-25 safety note added to Step 3 (External Research)
  - `test-framework/SKILL.md` — new `fixture` mode in modes table + Fixture Mode section
  - `EXTERNAL_ADDONS.md` — new last30days addon section with integration contract
  - `references/blend-registry.json` — new last30days-skill source entry
  - `NOTICES` — updated from companion reference to formal blend attribution

## Replay Verification
- **Replay target:** `bash test-framework/evals/run-all-evals.sh --tier1`
- **Result:** PASS
- **Evidence:** 9 scripts passed, 0 failed (3,800+ checks)

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** Add 2026-04-12 blend entry
- **Known Gaps:** No gaps closed (fixture tier-2 implementation is still needed — the pattern is documented, not built)
- **Decisions:** AP-25 locked — `<untrusted_content>` is the canonical fencing convention
- **Capabilities:** Update svc/CAPABILITIES.md — AP-25, fixture mode, last30days addon
