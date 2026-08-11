# Audit — WI-364 generate-don't-lint (G6 parallel pass)

**Changeset:** `main...HEAD` on `feature-wi-364-generate-mirrors` (05c66261 RED, 3879c4dd GREEN)
**Plan:** docs/plans/2026-06-07-wi-364-generate-mirrors/manifest.md (SIMULATED, G2-approved, GREEN-amended)

## File-set parity (three-dot, merge-base lens)
12 files = 11 planned (validator CREATE, generator CREATE, 7 mirrors MODIFY, linter MODIFY, registry MODIFY) + `.svc/pipeline-decisions.jsonl` (append-only ledger, rides per precedent). EXACT — no unplanned files, no missing files. NOTE: two-dot diff showed foreign main-side files (eic-accelerator knowledge from parallel session) — those are main-ahead artifacts, excluded by merge-base lens; landing via squash PR uses merge-base ✓.

## Task completion
| Task | Verdict | Evidence |
|---|---|---|
| task-1 validator (RED) | DONE | 05c66261; 13-fail RED proven, 14/14 GREEN after |
| task-2 generator+wraps+linter (GREEN) | DONE | 3879c4dd; `mirrors fresh` first --check (byte-identity), numstat marker-only, idempotent ×2, linter negative drift test fires |

## Findings
- **F1 MEDIUM (accepted residual):** stray list items added BETWEEN end-marker and section end are invisible to `--check`; old compareList extraction would have flagged them. Mitigations: marker note instructs editing the manifest; render covers complete membership so the canonical list stays correct; hand-adding below a visible end-marker is reviewer-visible. Hardening candidate (validator stray-line sweep) deferred unless adversarial reviewer escalates.
- **F2 LOW (documented):** README desc-merge absorbs in-marker *description* edits (names/order/membership strictly enforced; descriptions are presentation prose the old linter never validated either). Amendment §1.
- **F3 INFO:** registry presentation fields (displayName/useFor/displayRationale) are additive. Consumer proof: `resolve-model.sh` all 7 labels resolve identically post-change (STRAT/PLAN→opus-4-8, EXEC/REVIEW→sonnet-4-6, SENSE→mimo-v2.5-pro, DISC→native:web_search, PASS→haiku) + `--json` shape intact.
- **F4 INFO:** linter hot path +1 node subprocess (~150ms measured) — within tier-1 <5s budget; validator hermetic (mktemp+trap, no network, no `git config`, no LLM — WI-375 class avoided).

## Concern scan (G6 obligation)
4 matches, all false positives for this changeset; waivers logged in `.svc/pipeline-decisions.jsonl`, PR body carries the lines:
- `concern-waived: auth-surface — signal path .svc/session-contract.jsonl is machine-local dirty state, not part of the committed changeset`
- `concern-waived: oauth-callback — keyword /state\b/ matched prose ("state"/"stale") in docs+registry text; no OAuth/auth surface touched`
- `concern-acked: deploy-rollback-plan — keyword "deploy" in prose only; rollback = git revert of the two checkpoints (docs+scripts, no runtime deploy)`
- `concern-acked: pii-handling — keyword "address" in prose only; no PII fields/storage touched`

## Suite evidence
Tier-1 worktree fail-set == main fail-set ({validate-knowledge-domain-provenance agent-harnesses pre-existing, foreign} + companion); **zero worktree-only failures**; +1 new validator passing (suite 198 pass).

**Verdict: PASS** (no CRITICAL/HIGH; F1 MEDIUM accepted-with-rationale, escalation path named).
