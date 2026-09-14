# WI-485 Post-Merge Verification

- **Manifest:** `docs/plans/2026-07-14-wi485-codex-execution-integrity/manifest.md`
- **Promoted commit:** `7734a4533685745412fb766899b87fa778cb5ca2`
- **Pull request:** #131
- **Host:** Codex CLI 0.144.4
- **Target class:** non-browser framework runtime
- **Verification tier:** V2 live interaction
- **Verdict:** VERIFIED

## Installed-state result

| State | Result | Evidence |
|---|---|---|
| `configured` | true | `./setup --host codex` installed the prompt-authority, exact-skill, and composite-Stop commands |
| `effective-single-stop` | true | `~/.codex/hooks.json` contains exactly one `svc-codex-stop-firewall.mjs` Stop command |
| `trusted` | true | Codex native review reported three changed hooks; the owner authorized **Trust all and continue** and `config.toml` now contains trusted hashes for `pre_tool_use:4:0`, `user_prompt_submit:1:0`, and `stop:0:0` |
| `runtime_observed` | true | The live deny, load, resumed allow, and foreign-Stop traces below passed without `--dangerously-bypass-hook-trust` |

## Live runtime trace

Session `019f6169-73d2-7831-b562-fc1565171ccc` ran in the WI-485 verification worktree.

1. Before skill loading, Codex attempted `touch /tmp/wi485-live-deny-marker`. PreToolUse denied it and returned the exact recovery command:

   `node scripts/codex-load-skill.mjs --graph /workspace/seriousvibecoding/.worktrees/framework-WI-485-verify-promotion/.svc/lane-tasks-WI-485.json --task 5 --skill verify-promotion`

   The marker remained absent.
2. The recovery command printed all 677 lines of `verify-promotion/SKILL.md` and wrote a mode-0600 receipt bound to session, task 5, the absolute graph/worktree, and the canonical skill SHA-256.
3. The same Codex session was resumed in a later turn. It attempted `touch /tmp/wi485-live-allow-marker`; PreToolUse allowed the command and the marker existed afterward.
4. A later `continue WI-485` turn ran with a valid fresh claim owned by `foreign-live-session`. The installed Stop firewall returned `{}` and Codex completed with `FOREIGN_STOP_OK`, with no continuation pressure.
5. Recursive runtime-record scans found hashes and identifiers only; no raw prompt text or seeded secret was persisted.

The redacted machine-readable events, receipt bindings, trusted-hook indexes, marker results, and transcript path are attached at `docs/specs/verification/wi-485-live-runtime-trace.json`. The original prompt text is intentionally excluded by the WI-485 data-minimization contract.

## Acceptance and regression coverage

- AC-485-1 through AC-485-10: PASS. Detailed mapping is in `docs/specs/audit/wi-485-codex-execution-integrity-analysis.md`.
- Focused validator: 88/88 PASS.
- Full Tier 1: 239 scripts passed, 0 failed, 0 timed out.
- Independent frozen-diff review: APPROVE, recorded in `docs/specs/reviews/wi-485-codex-execution-integrity-exec-cross-model.md`.
- Security review: PASS, recorded in `docs/specs/security/wi-485-codex-execution-integrity-review.md`.
- Pre/post evidence shape: PASS via `docs/specs/verification/wi-485-pre-post-evidence.json`.
- Raw runtime evidence: `docs/specs/verification/wi-485-live-runtime-trace.json`.

## G7 and exclusions

G7 passes: no critical/high drift remains, all ACs have static and runtime evidence, and the installed host exercised the promoted code. Browser server, viewport, screenshot, journey, visual-baseline, and canary checks are N/A because this changes a CLI hook control plane and has no browser-visible surface. No consumer Gradle/Xcode or provider-backed output is involved.

```yaml
single_lane_summary:
  item: WI-485
  target_class: infra
  verification_tier: V2
  sampled: true
  evidence:
    - docs/specs/verification/wi-485-live-runtime-trace.json
    - docs/specs/audit/wi-485-codex-execution-integrity-analysis.md
```

`sampled: true` means the sole WI-485 lane is the selected closeout item required by the summary schema; it does not mean that the focused or Tier-1 validator sets were sampled. Both validator sets ran exhaustively.

Delivery tier is `full`. The legacy WI graph has no `delivery_graph` envelope, so `scripts/classify-delivery-graph-closeout.mjs` conservatively classifies it as `runtime-accepted`; this report does not claim the separate `framework-complete` delivery-graph label. No unresolved source leftovers remain after this closeout.

The pre-change runtime was not rerun. Reinstalling the vulnerable old hook path would change the owner-trusted target; the prior live incident is therefore used as the declared `old-path-new-path` replacement, and the machine evidence records this limitation rather than presenting a fresh pre-change reproduction.
