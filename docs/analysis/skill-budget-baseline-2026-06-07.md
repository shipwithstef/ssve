# Skill-budget baseline & WI-365 L0/L1/L4/L5 results (2026-06-07)

**Tool:** `scripts/measure-skill-budget.mjs` (live install default; `--root .` for repo mode; `--fraction/--context/--top`).

## L0 baseline (live install, BEFORE)
- **214 skills, 96,594 desc chars ≈ 24,148 tokens**
- Default budget (1% × 1M = 10K tokens ≈ 40K chars): **241% occupancy → native eviction actively dropping descriptions** (least-invoked first) = the live trigger-reliability degradation WI-365 targets
- At 0.02 fraction: 121% — knob alone does not fit the catalog
- Zero skills used `disable-model-invocation` (the zero-cost lever) before this WI

## What shipped this run
| Layer | Change | Effect |
|---|---|---|
| L1 | `disable-model-invocation: true` ×3 — suno-architect, svc-advisor, wsl2-audio (the ONLY mechanically chain-independent skills per `scripts/check-chain-independence.mjs`: zero lane/core/bootstrap memberships, zero repo refs; 15 near-misses correctly excluded) | their descs leave the budget; user invocation intact |
| L4 | 18 fattest svc-owned descriptions rewritten key-use-case-first: 14,827 → 8,361 chars (**−6,466, −44%** after the G6 zero-drop trigger sweep), all ≤640 chars; EVERY quoted trigger phrase from the originals preserved (mechanical sweep, punctuation-normalized containment: TOTAL DROPPED = 0 — codex G6-004 driven to mechanical convergence) | svc 82-skill active total now **34,770 chars ≈ 8,693 tokens = 87% of even the DEFAULT budget** — svc alone now fits |
| L4 | host knob `skillListingBudgetFraction: 0.02` + `skillOverrides: "name-only"` ×14 (near-miss + utility set) — machine-local | catalog headroom doubled; rare-trigger skills cost ~name-only |
| L5 | routing-rules note: router resolves from skills-manifest file reads, never assumes system-prompt visibility | description dieting is SAFE by construction — routed dispatch immune to eviction |

## Host-config appendix (machine-local, NOT repo state)
Applied: `skillListingBudgetFraction: 0.02`; `skillOverrides: "<skill>": "name-only"` for base44-environment, capability-concierge, capability-registry, reverse-engineer, generate-visuals, evaluate-rule, manage-learnings, ingest-guide-batch, extract-bootstrap, launch-knowledge, blend-private, suno-architect, wsl2-audio, svc-advisor.
Backup: `~/.claude/settings.json.bak-wi365-20260607-200359` · Restore: `cp ~/.claude/settings.json.bak-wi365-20260607-200359 ~/.claude/settings.json`
Per-host adoption (other machines/hosts) rides the L2 follow-up (plugins/wire-hooks) — until then this is documented per-machine tuning; drift check = re-run the L0 tool.

## Trigger-reliability regression statement (per-layer gate)
- Mechanical: `validate-chain-references` PASS + `lint-skills-manifest` PASS after all edits → every routed target still resolves (router never reads descriptions).
- dmi set = user-utility only (no router/chain participation by construction of the eligibility check).
- Rewrites preserve the highest-signal trigger phrases (kept verbatim: "what should I build", "free vs paid", "store this idea", "does the spec reflect the code", …). A short description that FITS the budget beats a long one that is EVICTED — at 241% occupancy, long-tail phrases were not reaching the model anyway.

## Remaining gap → L2/L3 follow-up (filed at closeout)
Estimated live-install occupancy after this WI deploys: ~79K chars ≈ 99% @0.02 — borderline. The full fix is **L2 per-project `enabledPlugins` partitioning** (svc repo stops loading capacitor/marketing packs; ~50K+ chars leave per project) + **L3 `paths:` scoping** for stack packs; both need the marketplace.json probe-verify. Target end-state: ~15-20 hot svc descriptions per project.
