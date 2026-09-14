# WI-489 diagnosis independent review

- Date: 2026-07-16
- Review boundary: staged diagnosis/research/work-item diff at `ebc09b71189f53c80dbf120bf57452c42cfb44ee99286bc6d2bebb6bcd9dec34`
- Executor family: OpenAI
- Reviewer family: Anthropic
- Requested/effective model: `claude-fable-5`
- Requested effort: `high`
- Invocation: bootstrap-safe direct Claude CLI because the canonical launcher is the defect under repair
- Safety mode: enabled; tools and MCP disabled; plan permission; no session persistence
- Paid provider invocations: 1
- CLI protocol turns: 2
- Turn ceiling: 4
- Result subtype: `success`
- Terminal reason: `completed`
- Provider safety route: none; `modelUsage` contained Fable 5 plus the allowed auxiliary Haiku only
- Cost reported by CLI: USD 1.319549
- Verdict: `pass-with-findings`

## Summary

The reviewer found the diagnosis implementation-planning ready and agreed with both principal defects: Claude structured-output negotiation is truncated by `--max-turns 1`, and the resulting structured `error_max_turns` payload is misclassified as `unknown_provider`. It also agreed with the intended separation between a paid provider invocation and bounded CLI protocol turns, the July 20 reviewer-policy cutover, and non-reusable provider-safety-route receipts.

The pass is conditional on closing the following findings in `write-spec` and `design-tech`.

## Findings carried forward

1. **High — do not infer a safety route from model mismatch alone.** A requested Fable/effective Opus observation does not by itself distinguish Anthropic safeguard routing from an unexplained model change. Require trustworthy runtime/provider evidence; otherwise classify `model_mismatch` and fail closed.
2. **High — preserve the WI-486 reproduction.** The two failing receipts and event evidence live in the paused WI-486 worktree. Persist redacted evidence and hashes in WI-489 before that worktree can be pruned.
3. **Medium — resolve configurability.** Establish whether Claude Code 2.1.211 exposes a supported per-invocation opt-out for automatic Fable safety routing. Design-tech must justify modeling the provider route if it cannot be disabled safely.
4. **Medium — label baseline honestly.** The 242/2 run is a dirty-worktree pre-executable-edit snapshot, not a clean-base result, because the untracked WI-489 graph triggered one failure.
5. **Medium — quantify the protocol bound.** Set an explicit maximum turn count, keep timeout and dollar limits, and fixture repeated schema-validation re-prompts through deterministic exhaustion.
6. **Low — document turn accounting.** The real failure reported `num_turns: 2` while the configured ceiling was 1; fixtures must reproduce the CLI semantics instead of assuming turns equal provider invocations.
7. **Low — correct chronology/status.** Make timestamps/status wording consistent with the completed diagnosis.
8. **Low — pin the cutover instant.** Record `2026-07-19T21:00:00Z`, equivalent to `2026-07-20 00:00:00 EEST` in `Europe/Sofia`.
9. **Info — pin real Fable verification.** The corrected launcher must receive one real `fable-high` review even if verification occurs after the scheduled default changes.
10. **Info — persist pattern-scan evidence.** Preserve the command/hit evidence behind the single-site and three-policy-authority claims.

## Review conclusion

Diagnosis may complete and proceed to `write-spec`. Plan review must reject the package if any high or medium finding above remains unresolved.
