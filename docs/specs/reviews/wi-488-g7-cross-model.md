# WI-488 G7 Cross-Model Review

**Pull request:** #144

**Review target:** net `origin/main` diff plus staged correction tree `9def8ec3050c0987990b482fb46d47c92948123c`

**Launcher:** `scripts/run-external-review.mjs` 1.0.1

**Reviewer:** Claude Fable 5 at exactly high

**Orchestrator family:** OpenAI/Codex

**Fallback:** not used

**Terminal verdict:** PASS

## Invocation trail

| Attempt | Classification | Disposition |
|---:|---|---|
| 1 | `unknown_provider` | Fable attempted a tool under the no-tools, one-turn boundary and Claude returned `error_max_turns`; launcher hard-failed and did not invoke Opus. |
| 2 | `schema_invalid` | Fable returned an otherwise substantive payload but changed the requested `review_kind`; launcher rejected it and did not invoke Opus. Its diagnostic findings were resolved before re-review. |
| 3 | `success`, `pass-with-findings` | Fable certified all high-severity evidence fixes and identified one net-diff false positive, one low bookkeeping correction, and one informational timestamp normalization. |
| 4 | `success`, `pass` | Terminal Fable re-review certified all dispositions and found no unresolved Critical, High, Medium, or Low defect. |

The two failed attempts are retained as local schema-valid launcher receipts. Neither was reusable and neither authorized Opus. The terminal requested, invoked, and effective tuple was exactly `{host: claude, family: anthropic, model: claude-fable-5, effort: high}` with no override and no fallback.

## Terminal receipt

| Field | Value |
|---|---|
| Package SHA-256 | `09bc00bc90c08181ce1e84c0563a50f4f6d498fe1d9ea5d0368d28b7b942f3cd` |
| Findings schema SHA-256 | `4fa2653e00b57a20c555b7a82712fc287af32ddfe4c35a8b064bc7d9726c0021` |
| CLI version | Claude Code 2.1.210 |
| Started | 2026-07-15T17:09:04.162Z |
| Finished | 2026-07-15T17:10:28.445Z |
| Cache disposition | published; exact no-fallback primary is reusable |
| Opus fallback | false |
| Owner override | false |

## Finding disposition

- Durable promoted command evidence is tracked and task phases point to it. Phase timestamps are explicitly receipt-attachment times.
- The append-only decision log corrects the approximate phase-11.4 chronology and binds the final 95-to-97 assertion delta to pre-merge implementation commit `462f4e85`.
- The original verify-promotion load receipt is preserved and the promoted-main reload is append-recorded.
- The capability proof maps display name `Codex 5.6 sol` to canonical CLI ID `gpt-5.6-codex` from the model registry.
- G7 decision, task completion, and closeout ordering are consistent; the closeout event names task 14 and all affected evidence families.
- Process runtime is explicitly satisfied at V2, while browser/deploy runtime remains N/A.
- The proposal-lint file is absent from the net PR diff; the medium deletion finding was a false positive caused by reviewing an add-then-remove branch history expectation against the correct net diff.
- Capability timestamps use UTC Z.

Terminal review retained two informational observations only: the append-only runtime correction naturally postdates the closeout it clarifies, and the repository currently has two intentional WI-488 test-evidence roots. Neither is a product, receipt, or promotion defect.
