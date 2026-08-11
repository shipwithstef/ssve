# WI-485 Execution Cross-Model Review

- **Reviewed range:** `9a098a84...21500752`
- **Authoring host:** Codex
- **Independent reviewer:** Claude/Fable-family resolver target
- **Final verdict:** APPROVE

## Review Rounds

| Round | Frozen commit | Verdict | Finding disposition |
|---|---|---|---|
| 1 | `49144d5f` | REVISE | Accepted F1 Critical (`find` mutation bypass), F2 High (foreign claim schema fail-open), and F3 Medium (shared cache parent mode). Fixed all three. |
| 2 | `bb37d7d0` | REVISE | Accepted Critical quoted/escaped `find`, `sed -i`, and `git --output` equivalents. Replaced permissive suffix matching with a strict lexical boundary and option denylists. |
| 3 | `3d098b9f` | REVISE | Accepted High `rg --hostname-bin` external-process bypass. Denied both token forms and added a denial fixture. |
| 4 | `d286bb25` | REVISE | Accepted Low `rg -z` / `--search-zip` decompressor process path. Denied both forms and added fixtures. |
| 5 | `e7577684` | APPROVE | No blocking finding. Reviewer enumerated installed `rg`, `git`, GNU `find`, and coreutils help; 24/24 adversarial probes were governed, 12/12 legitimate reads allowed, and the focused suite passed 44/44. |
| 6 | `09e78062` | REVISE | Audit-remediation review reproduced a Critical natural-negation leak: `do not try to continue WI-485` still pressured Stop. The run timed out after producing the end-to-end reproducer; silence was not treated as approval. |
| 7 | `176ca48b` | APPROVE | The reviewer reran its leaked negation corpus and accepted the direct fix at 82/82, then suggested three Low/Informational hardenings. All three were accepted. |
| 8 | `8c0bfe07` | APPROVE | Final frozen-delta review live-probed approved and forged canonical paths in framework and consumer layouts, soft negations, malformed timestamps, positive continuation, and 88/88 focused tests. No unresolved Critical, High, or material AC blocker. |
| 9 | `21500752` | APPROVE | Final frozen-diff check confirmed the sole later production delta was a transaction-neutral temp suffix rename, the audit evidence was consistent, focused tests passed 88/88, and full Tier 1 passed 239/239. |

## Accepted Fixes

- Mutation-capable `find` actions, including quoted and escaped variants, require a receipt.
- Shell quoting, escaping, redirects, chains, substitution, and ambiguous commands fail into the governed path.
- `sed` and `node --check` no longer use the unreceipted Bash fast path.
- Git output and external-helper flags require a receipt.
- Ripgrep preprocessors, hostname helpers, and decompressor helpers require a receipt.
- Unknown, legacy, or freshness-undecidable WI claims protect the foreign session from Stop continuation.
- The home runtime fallback permits a conventional shared `~/.cache` parent while retaining a current-user, non-symlink, mode-0700 svc leaf.
- Direct and natural negations never authorize continuation; malformed authority timestamps fail toward allowing Stop.
- Skill receipts bind both canonical bytes and an approved canonical realpath. Consumer repositories without in-tree skill source use only the configured Codex install path, not arbitrary receipt paths.

## Safe Plan Deviation

The frozen manifest listed `sed -n` and `node --check` as recognized read-only forms. Adversarial review proved that their option/environment surfaces could execute or write. The implementation intentionally governs both commands instead. This is stricter than the frozen plan and preserves AC-485-4 in the safe direction; the shipped reference and tests describe the implemented boundary.

## Final Evidence

- `bash test-framework/evals/tier-1/validate-codex-execution-integrity.sh` — 88 passed, 0 failed.
- `bash test-framework/evals/tier-1/validate-codex-hook-feature-flag.sh` — PASS.
- `bash test-framework/evals/tier-1/validate-stop-hook-stdin-preservation.sh` — PASS.
- Round-5 Claude session: `fc635b3f-987c-49dd-9da6-bb4e8a8d3994` — APPROVE.
- Audit-remediation Claude session: `85a44576-1ce6-4d4e-9985-12a8bd063b27` — REVISE at `09e78062`, APPROVE at `176ca48b`, final APPROVE at `8c0bfe07`.
- The same audit-remediation session gave frozen-diff APPROVE at `21500752` with no actionable finding.

## Verdict

APPROVE — the implementation may proceed to AC audit. Runtime trust and runtime-observed promotion states remain post-merge verification obligations and are not claimed by this review.
