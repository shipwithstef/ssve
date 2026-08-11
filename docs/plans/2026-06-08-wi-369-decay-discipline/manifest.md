# WI-369 manifest — decay discipline + cluster-debt closeout (compressed)

**Base:** main 9a9b64f3 | Tier: compressed | Cluster closer (goal-hooked)

## Deliverables
| D | What | Class |
|---|---|---|
| D1 | references-ledger carve-out: `references/framework-learnings.jsonl` + `docs/learnings/learnings.jsonl` join the append-only ledger class in quick-fix-eligibility (rule text already exempts learning appends; WI-365 closeout hit this gap) | hot-path small + validator cases |
| D2 | honest-emission gap (WI-360/363 debt): when a quick-fix note claims eligible:true, check-chain-receipts RE-RUNS the eligibility predicate against the commit's own diff (files via diff-tree, per-file numstat, denylist, ledger hunks) — manual/forged eligible:true on non-exempt content now refused at check-side | hot-path + RED validator case |
| D3 | decay report: `scripts/report-decay-candidates.mjs` — rules zero-hit ≥90d (WI-361 injection memos + concern-hits.jsonl) → demotion candidates; concerns zero-hit → severity-demotion candidates; tier-1 EXPLICITLY excluded from zero-hit logic (§Demotion criteria only); learnings ≥c8 + 3 fires → elevation candidates (learning-preload mechanics, no parallel ledger) → docs/analysis/decay-report-2026-06-08.md | additive script + report |
| D4 | commit-ratio report: `scripts/report-commit-ratio.mjs` — monthly framework-vs-product classification, MEASUREMENT ONLY banner (ship-gate declined 2026-06-06) → first report in docs/analysis/ | additive |
| D5 | insights-intake: `rules/no-fabrication.md` (correction rule: never fabricate document contents/figures/facts; TBD+ask; reviewer hooks ingest-guide/research/teach-project) + rulesRegistry entry (signal-gated) + `product-owns-task` blocker type in diagnose-capability-blocker (route → validate-feature/capability-registry) | rule + registry + hot-path small |

## External State
None machine-local; rulesRegistry edit = skills-manifest.json (authenticity-protected — improve-framework-class receipt rides the chain envelope). Untouched: 15-entry taxonomy walked, none.

## Validation
D1/D2: carve-out validator +3 cases RED→GREEN; rejects-structural sibling; D3/D4: node --check + live run committed-report; D5: lint (registry shape) + blocker-ledger row probe. Suite at push gate.
RECOVERY_IF_FAIL: git revert squash.
