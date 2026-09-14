# WI-488 Post-Merge Verification

- **Manifest:** `docs/plans/2026-07-15-wi488-deterministic-external-reviewer/manifest.md`
- **Promoted commit:** `71e01336d733ab324c8dd8fbc0a7e5c2a6662a21`
- **Pull request:** #143, merged 2026-07-15T16:33:47Z
- **Target class:** infra (non-browser framework runtime)
- **Verification tier:** V2 process interaction with fixture-controlled provider processes and installed capability probes
- **Delivery tier:** full
- **Verdict:** VERIFIED

## Promotion evidence

`HEAD`, local `main`, and `origin/main` resolved to the promoted squash commit before verification. The promoted tree contains `scripts/run-external-review.mjs` and both external-review schemas. The framework was refreshed from canonical promoted `main` for Antigravity, Claude, Codex, Cursor, Gemini, Kimi, Mimo Code, and OpenCode; every corresponding `check-install-drift.sh --quiet` invocation exited 0.

## Promoted behavior

| Proof | Result | Scope |
|---|---|---|
| Canonical launcher fixture replay | 97 passed, 0 failed | Exact tuples, stdin, isolation, schema, streams, classified fallback, forbidden fallback, timeout/cancellation, overrides, cache, concurrency, crash recovery, kill switch, empty input, and migrated consumers |
| Review-plan readonly replay | 22 passed, 0 failed | Canonical launcher routing and readonly contract |
| Installed Codex capability probe | PASS, `codex-cli-exec 0.144.4` | Required `codex exec` flags; requested tuple `gpt-5.6-codex` high; zero provider attempts |
| Installed Claude capability probe | PASS, Claude Code 2.1.210 | Required safe-mode/structured flags; requested tuple `claude-fable-5` high; zero provider attempts |
| Provider-fidelity evidence validator | PASS | Fable-5/high independent review receipt with no fallback |
| Pre/post evidence validator | PASS | Acceptance-critical launcher boundary classified `fixed-by-change` |
| Full Tier 1 | 244 passed, 0 failed, 0 timed out | Current complete landing-policy suite |
| Independent G7 re-review | PASS | Fable 5 exactly high through the canonical launcher; no unresolved Critical/High/Medium/Low defect; no fallback |

The durable command/result digest is `docs/specs/verification/wi-488-command-evidence.md`. Task-graph phase timestamps record when the already-completed evidence was attached to the receipt; they are not represented as command start/end timestamps.

The capability probes are free local CLI surface checks, not model-availability smoke calls. No extra paid model invocation was made; the implemented primary invocation remains the only paid availability probe.

## Acceptance and test-quality audit

EXTREV-01 through EXTREV-69 are confirmed. The detailed one-row-per-AC mapping is in `docs/specs/audit/wi-488-deterministic-external-reviewer-analysis.md`; the promoted replay exercises the same fixture-controlled contract from the promoted commit.

The requirement-linked test contains no `.skip`, `xit`, `xdescribe`, or `@Disabled` markers. Expected values come from the accepted tuple/CLI/schema contract, while fake provider processes independently capture argv, stdin, call counts, streams, receipts, cache identities, and process termination. Assertions compare concrete values and negative paths; they do not compare launcher output with launcher-generated expectations. Test-quality verdict: PASS.

## Pre/post classification

The exact selected proof is `bash test-framework/evals/tier-1/validate-external-review-launcher.sh --runtime-only`, represented by the full promoted replay because the script exposes no separate paid mode. Pre-change evidence recorded the launcher-exists red boundary at 2 passed / 1 failed. Post-change implementation evidence recorded 53 runtime assertions; the final promoted suite now contains 97 passing assertions after independent-review hardening. The delta remains `fixed-by-change`, iteration 1. `validate-pre-post-validation-evidence.mjs` passes.

## G7 and exclusions

G7 passes: no unresolved critical/high drift remains, 69/69 ACs have current evidence, both supported installed reviewer CLIs expose the required controls, every active consumer uses the canonical launcher, and the promoted full suite is green. Browser server, journey-file, viewport, screenshot, visual-baseline, and canary checks are N/A because this is a headless process launcher with no browser-visible surface. No mobile build, database migration, or deployed HTTP endpoint exists.

The delivery graph's `runtime` evidence family is satisfied by process-level V2 fixture interaction and installed CLI capability probes. This is different from browser/deployed-server runtime, which remains N/A. `closeout_classification_required: true` records that this graph requires classification; the adjacent `closeout_classification: framework-complete` records that the requirement was satisfied.

```yaml
single_lane_summary:
  item: WI-488
  target_class: infra
  verification_tier: V2
  sampled: true
  evidence:
    - docs/specs/verification/wi-488-capability-proof.json
    - docs/specs/verification/wi-488-command-evidence.md
    - docs/specs/audit/wi-488-deterministic-external-reviewer-analysis.md
    - docs/specs/test-evidence/WI-488/pre-post-evidence.json
    - docs/specs/reviews/wi-488-g7-cross-model.md
```

`sampled: true` identifies the sole WI-488 lane as the selected closeout item. The 97 focused assertions, 22 readonly assertions, and 244 Tier-1 scripts ran exhaustively.

The delivery graph selects `full` with no compressed/rush override and no blocked mandatory validation skill. Provider fidelity and process-runtime evidence are satisfied. Feature-validation closeout, deploy, browser, and visual evidence families are correctly N/A. Verification leaves no unclassified source path; generated capability probe scratch files were normalized into the tracked proof above and removed.
