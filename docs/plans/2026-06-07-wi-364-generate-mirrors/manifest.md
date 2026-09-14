# Manifest: WI-364 — generate-don't-lint: manifest/registry → marker-codegen mirrors

- **Feature spec:** `docs/specs/work-items/WI-364.md`
- **Branch:** `feature-wi-364-generate-mirrors`
- **Status:** SIMULATED
- **Base branch / SHA:** `main` @ `7547dd98`
- **Lane:** framework (hot path: lint + authenticity-protected routing-rules.md → full chain in worktree)
- **Archetype:** Incremental extension (inverts the linter's existing compare logic into a generator; section anchors reused from the linter's own extractors)

## Implementation Summary

`skills-manifest.json` + `references/model-registry.json` become generative sources. `scripts/generate-manifest-mirrors.mjs` writes marker-delimited sections; `--check` regenerates in-memory and fails on drift with "edit skills-manifest.json / model-registry.json instead". The linter's 4-way compareList swaps to one `--check` spawn (manifest-internal checks stay). Doc drift becomes impossible instead of detected; completes WI-357's model single-sourcing (both mirror files carry "Full generation pending WI-364" notes).

**Grounding (read live 2026-06-07):** linter extractors define the EXACT section anchors (lint:139-191): README `## Included Skills` w/ `- \`name\`` bullets; EXTERNAL_ADDONS `## Core Pack (always available)` → next `## Add-On:`; REPO_MODES `Default greenfield sequence:` → `### Convert Mode`; route-workflow/references/routing-rules.md `### Core Pack (always available in svc)` → `### External Add-On Packs (optional)`. Model mirrors: CLAUDE.md svc-default table; rules/common/model-selection.md Host-Specific Resolutions + Quick tables; references/model-routing.md tables. routing-rules.md IS authenticity-protected (hook list) → receipt before its Edit; CLAUDE.md/README not protected.

**Markers:** `<!-- svc:generated:begin <id> — edit skills-manifest.json / references/model-registry.json, then run: node scripts/generate-manifest-mirrors.mjs --write -->` … `<!-- svc:generated:end <id> -->`. Block ids: `readme-included-skills`, `external-core-pack`, `repo-modes-bootstrap`, `routing-rules-core-pack`, `claude-md-svc-default`, `model-selection-quick-ref`, `model-selection-cognitive-labels`, `model-routing-svc-default`, `model-routing-cognitive-labels` (one block per table — G2 H2). **DESCOPED from generation (G2 C2, honest-source ruling):** the multi-host resolution tables (Claude/Kimi/Gemini/Codex/OpenCode columns) — the registry deliberately has NO gemini harness (it is not a wired execution harness), so a pure registry function cannot render those columns; backfilling fake harness data to satisfy a table inverts the source of truth. Those tables keep their MIRROR note plus an explicit `<!-- not generated: multi-host columns exceed registry scope (WI-364 C2) -->` line.

**Invariants:** rendered CONTENT inside markers is byte-identical to today's hand-synced content at first generation (stable manifest ordering = current order; readable diffs guardrail); section heads/tails outside markers untouched; linter keeps manifest-internal checks (subsets, dups, rulesRegistry WI-361 block); generator is deterministic (no timestamps inside markers).

## Files Planned

| # | File | Action | Task |
|---|---|---|---|
| 1 | test-framework/evals/tier-1/validate-generated-mirrors.sh | CREATE | task-1 RED: markers present ×7; --check exit 0; hand-edit-inside-marker fixture → --check exit 1 w/ edit-the-source message; determinism (two runs byte-identical) |
| 2 | scripts/generate-manifest-mirrors.mjs | CREATE | task-2 |
| 3 | `README.md` | MODIFY | task-2: wrap Included Skills in markers (content regenerated == current) |
| 4 | `EXTERNAL_ADDONS.md` | MODIFY | task-2: wrap Core Pack |
| 5 | `REPO_MODES.md` | MODIFY | task-2: wrap bootstrap sequence |
| 6 | `route-workflow/references/routing-rules.md` | MODIFY | task-2 (authenticity receipt first): wrap Core Pack |
| 7 | `CLAUDE.md` | MODIFY | task-2: wrap svc-default table; MIRROR note → generated note |
| 8 | `rules/common/model-selection.md` | MODIFY | task-2: wrap both model tables |
| 9 | `references/model-routing.md` | MODIFY | task-2: wrap tables |
| 10 | `scripts/lint-skills-manifest.mjs` | MODIFY | task-2: compareList×4 → generator --check spawn; keep internal checks |

**Promotion note:** validator_path=file 1; failure_class=mirror drift returning via generator rot/marker tampering (the 3-disagreeing-model-tables incident class); promotion_signal=2 (documented in eval dim-9) +3 (lint hot path); budget <5s hermetic (worktree copies, --check in-process); tier-2-insufficient: drift detection IS the lint contract.

## Generator blueprint (file 2 core; executor refines table rendering against registry shape at GREEN)

```javascript
#!/usr/bin/env node
/** generate-manifest-mirrors (WI-364): skills-manifest + model-registry -> marker sections. */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(path.join(ROOT, "skills-manifest.json"), "utf8"));
const registry = JSON.parse(readFileSync(path.join(ROOT, "references", "model-registry.json"), "utf8"));
const bullets = (xs) => xs.map((s) => `- \`${s}\``).join("\n");
const numbered = (xs) => xs.map((s, i) => `${i + 1}. \`${s}\``).join("\n");
const BLOCKS = {
  "readme-included-skills": { file: "README.md", render: () => bullets(manifest.includedSkills) },
  "external-core-pack": { file: "EXTERNAL_ADDONS.md", render: () => bullets(manifest.includedSkills) },
  "repo-modes-bootstrap": { file: "REPO_MODES.md", render: () => numbered(manifest.bootstrapStartSequence) },
  "routing-rules-core-pack": { file: "route-workflow/references/routing-rules.md", render: () => bullets(manifest.corePackForRouting) },
  "claude-md-svc-default": { file: "CLAUDE.md", render: () => renderSvcDefault(registry) },
  "model-selection-quick-ref": { file: "rules/common/model-selection.md", render: () => renderQuickRef(registry) },
  "model-selection-cognitive-labels": { file: "rules/common/model-selection.md", render: () => renderCognitiveLabels(registry) },
  "model-routing-svc-default": { file: "references/model-routing.md", render: () => renderSvcDefault(registry) },
  "model-routing-cognitive-labels": { file: "references/model-routing.md", render: () => renderCognitiveLabels(registry) },
};
function markerRe(id) {
  // G2 H1: whitespace-tolerant, id-escaped
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(<!--\\s*svc:generated:begin ${esc}[^>]*-->)([\\s\\S]*?)(<!--\\s*svc:generated:end ${esc}\\s*-->)`);
}
function run(write) {
  const drift = [];
  for (const [id, b] of Object.entries(BLOCKS)) {
    const p = path.join(ROOT, b.file);
    const text = readFileSync(p, "utf8");
    const m = text.match(markerRe(id));
    if (!m) { drift.push(`${id}: markers missing in ${b.file}`); continue; }
    const want = `\n${b.render()}\n`;
    if (m[2] !== want) {
      if (write) writeFileSync(p, text.replace(markerRe(id), `$1${want}$3`));
      else drift.push(`${id}: content drift in ${b.file} — edit skills-manifest.json / references/model-registry.json, then run: node scripts/generate-manifest-mirrors.mjs --write`);
    }
  }
  if (!write && drift.length) { console.error(drift.join("\n")); process.exit(1); }
  console.log(write ? "mirrors regenerated" : "mirrors fresh");
}
run(process.argv.includes("--write"));
// renderSvcDefault/renderHostTables/renderRoutingTables: build the EXISTING
// markdown tables byte-identically from registry.profiles + registry.models —
// executor derives the exact rows from current file content + registry fields
// at GREEN (deterministic key order; no timestamps).
```

## Linter swap (file 10): replace the compareList block (139-191 region: readme/external/repoModes/workflow section extracts + compareList×4) with:

```javascript
// WI-364: mirrors are GENERATED — validate freshness, not agreement.
try {
  execSync(`node ${path.join(repoRoot, "scripts", "generate-manifest-mirrors.mjs")} --check`, { stdio: "pipe" });
} catch (e) {
  errors.push(`generated mirrors stale or tampered:\n${e.stderr?.toString() || e.stdout?.toString() || e.message}`);
}
```
(manifest-internal checks + coreyhaines section checks + rulesRegistry block stay untouched; executor confirms execSync import exists.)

## G2 Amendment (gemini REJECT → resolved)

- C1 REJECTED w/ contract citation: EXTERNAL_ADDONS core == includedSkills is the LINTER'S OWN rule (compareList line 187; live count 82==82). Blueprint mapping correct.
- C2 CONFIRMED-PARTIAL → DESCOPE ruling: multi-host resolution tables stay hand-maintained (registry truthfully lacks a gemini harness); generated set = registry-derived tables only (svc-default ×2, quick-ref, cognitive-labels ×2). No fake backfill.
- H1 ACCEPTED: whitespace-tolerant, id-escaped marker regex.
- H2 ACCEPTED: one marker block per table.

## Task Graph

| Task | Files | Validation | Checkpoint |
|---|---|---|---|
| task-1 RED | 1 | validator NON-zero (no generator/markers) | `checkpoint-1-red` |
| task-2 GREEN | 2-10 | validator green; generated content byte-identical to pre-wrap content (git diff inside markers empty except markers); lint green via new path | `checkpoint-2-green` |
| task-3 validation | — | suite (200 incl. new) via gated push reuse; diff EXACT-10 | (pre-G5) |

## AC map
AC-01 7 blocks generate deterministically == current content · AC-02 --check catches in-marker hand-edits w/ message · AC-03 linter freshness path replaces 4-way compare; old drift class impossible · AC-04 model tables single-sourced (WI-357 completion; MIRROR notes updated) · AC-05 RED proof · AC-06 readable diffs (stable order).

## Prerequisite Alignment Matrix
| Task | UX | UI | Tech design | Style contract | Persona |
|---|---|---|---|---|---|
| all | N/A | N/A | linter's own extractors define anchors; marker-codegen established pattern | generator idiom matches lint script style | P0: doc drift impossible |

## External State
| # | Env | What | Coupling | Wiring |
|---|---|---|---|---|
| 1 | none beyond repo | generated sections live in tracked files | coupled | --check in lint = the coupling |
| 2 | /tmp validator copies | per run | decoupled-justified | trap rm |
| 3 | worktree ckpt ledger | per run | decoupled-justified | commit-subject anchors |

Untouched: all other taxonomy entries (no settings/hooks/machine state this WI).

## Lane Compliance
Graph tasks 1-9, phases live; WI doc = spec; design-tech skipped (top-level reason); routing-rules.md edit behind plan-changeset receipt (this manifest's worktree receipt).

## Validation Plan
Task-level above. **Byte-identity guard at GREEN:** wrap sections, run --write, `git diff` must show ONLY marker lines added (content untouched) — proves render==current before any reordering temptation. Final: suite 200 via gated push; lint green through the new freshness path.

## Execution Command Sequence
```bash
bash scripts/worktree.sh create feature-wi-364-generate-mirrors
set +e; bash test-framework/evals/tier-1/validate-generated-mirrors.sh; RED=$?; set -e
test "$RED" -ne 0 && echo "RED=$RED ok"
git add test-framework/evals/tier-1/validate-generated-mirrors.sh
git commit -m "test(WI-364): checkpoint-1-red" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <contact-cd29c5ac34@example.invalid>"
mkdir -p .svc && git rev-parse HEAD >> .svc/wi-364-checkpoints.log
# GREEN: generator, markers x7, linter swap; byte-identity guard; receipt before routing-rules edit
git add scripts/generate-manifest-mirrors.mjs README.md EXTERNAL_ADDONS.md REPO_MODES.md route-workflow/references/routing-rules.md CLAUDE.md rules/common/model-selection.md references/model-routing.md scripts/lint-skills-manifest.mjs
git commit -m "feat(WI-364): checkpoint-2-green" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <contact-cd29c5ac34@example.invalid>"
git rev-parse HEAD >> .svc/wi-364-checkpoints.log
EVALS=0 bash test-framework/evals/run-all-evals.sh --tier1
node scripts/lint-skills-manifest.mjs
git diff --name-only main...HEAD | sort
# RECOVERY_IF_FAIL: WT="$(git rev-parse --show-toplevel)"; rescue if dirty; reset --keep anchor
```

## Loop-Backs
- A render can't reproduce current content byte-identically (hand-drift already present) → fix the SOURCE (manifest/registry) or accept the regenerated truth — diff shown, decision logged; never fudge the renderer
- routing-rules authenticity friction → receipt pattern from WI-361

## Promotion Readiness
- [x] 2C+8M · TDD real · 6 ACs · diff EXACT-10 · promotion note · byte-identity guard · phases live

## Execution Amendments (GREEN, 2026-06-07)

Logged as taste decision in worktree `.svc/pipeline-decisions.jsonl`; byte-identity invariant (G2 load-bearing) drove all four:

1. **readme-included-skills render = description-preserving merge.** Blueprint sketched `bullets(includedSkills)`; the live README carries hand-curated ` — description` suffixes per bullet. Plain bullets would have destroyed them. Render now: names+order+membership authoritative from manifest; ` — desc` suffix preserved from current block content. Name-tamper detection intact (rogue names not in manifest are dropped by render → drift). Residual: in-marker *description* edits are absorbed, not flagged — names are the contract, descriptions are presentation prose the linter never validated either.
2. **Variant renders.** `renderSvcDefault("plain"|"rationale")` — CLAUDE.md is 3-col, model-routing is 4-col with inline icons + Rationale. `renderCognitiveLabels("table"|"numbered")` — model-selection is a 4-col table, model-routing is a numbered prose list derived from `cognitiveLabels[L].description` ("Title — blurb" split). Blueprint treated the pairs as identical; live shapes differ.
3. **Registry `displayRationale`** added on svc-default PLAN/EXEC/SENSE labels (table shows short display strings; archival `rationale` decision records stay untouched). Render falls back `displayRationale ?? rationale`.
4. **Marker wrap = pure line insertion.** Proven: `git diff --numstat` = +2/-0 (or +4/-0 for two-block files) across all 7 mirrors; zero non-marker added lines; `--check` returned `mirrors fresh` on first run (byte-identity at first generation); two `--write` runs byte-identical.

Validation actuals: validator 14/14 GREEN; linter negative test (manifest drift → stale-mirror error naming `--write` fix) fires; tier-1 suite worktree fail-set == main fail-set (2 pre-existing: knowledge-domain-provenance agent-harnesses + companion; zero worktree-only failures).
