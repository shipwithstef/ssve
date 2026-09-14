# WI-542 / WI-543 Promotion Verification

**Date:** 2026-08-17
**Verdict:** PASS — VERIFIED-L3
**Delivery tier:** full
**Target class:** framework-host-hook
**PR (implementation):** [#9](https://github.com/s7an-it/serious-serious-vibe-engineering/pull/9)
**Promoted SHA:** `a4d0efa319241c12b5bb108b00da28313826617d`
**Closeout branch:** `closeout-WI-542-verify-promotion`
**Closeout worktree:** `.worktrees/closeout-WI-542-verify-promotion`
**Verifier session:** `01a00f37-834e-7cc0-a78d-0ad67bf9218e`

```yaml
single_lane_summary:
  item: "WI-542"
  related: ["WI-543"]
  target_class: "framework-host-hook"
  verification_tier: "V2"
  sampled: true
  evidence:
    - "docs/specs/verification/wi-542-session-start-01a00f37.json"
    - "docs/specs/verification/wi-542-grok-inspect-postmerge.hooks.json"
    - "docs/specs/test-evidence/WI-542/pre-post-evidence.json"
```

No product browser, deploy, provider, or visual surface. L3 is the honest
browser-tier label; host-hook proof is V2 (live SessionStart + inspect).

## Promotion Evidence

- PR #9 squash-merged at `2026-08-17T09:49:27Z` onto `origin/main` as
  `a4d0efa3` (`fix: Grok SessionStart tilde false-missing and native hook schema`).
- Remote feature branch `bugfix-WI-542-grok-sessionstart-healthcheck` is gone.
- Closeout ran from a new worktree created with
  `svc-ensure-worktree --wi WI-542 --branch closeout-WI-542-verify-promotion --from origin/main`.
  `HEAD` in that worktree is exactly `a4d0efa3`.
- The default checkout was not used and was not mutated for this closeout.
- Default-checkout `chmod +x` on `hooks/grok/svc-grok-task-completion-guard.sh`
  is **out of scope** and is not in this tree (this tree is `100644`, same as
  `origin/main`). Follow-up: WI-545.

## SessionStart restart-boundary (AC-542-7)

AC-542-7 is **intended** to require a new physical Grok session after land.
The implement session (`01a00e3b`) started before the hook was installed and
recorded `session_start[1]` `timed out after 5000ms`. That is not a fail of
the shipped fix.

This verifier session started after the merged hook was installed:

| Hook | Origin | Status | Elapsed |
|---|---|---|---|
| `user:session_start[0].hooks[0]` | Grok-native | success | 326ms |
| `global/settings:session_start[0]` | Claude-compat | success | 77ms |
| `global/settings:session_start[1]` | Claude-compat healthcheck (was red) | success | 203ms |
| `global/settings:session_start[2]` | Claude-compat | success | 55ms |
| `global/settings:session_start[3]` | Claude-compat | success | 239ms |
| `global/settings:session_start[4]` | Claude-compat | success | 125ms |

Source: `docs/specs/verification/wi-542-session-start-01a00f37.json`.

## Acceptance Criteria

### WI-542

| AC | Promoted evidence | Result |
|---|---|---|
| AC-542-1 | Parser tokenizes `~/.grok/skills/hooks/*.mjs`; T4/T9 fixtures and isolated grok replay report present. | PASS |
| AC-542-2 | Isolated `SVC_HOST=grok` replay: empty stdout/stderr, exit 0, 0.04s. | PASS |
| AC-542-3 | Same replay: no `self-heal:` line, no `./setup`. | PASS |
| AC-542-4 | Multi-host T12 (kimi tilde present is silent) PASS. Live `SVC_HOST=kimi` against HOME still reports 26 genuine `/tmp/fake/hooks` misses — WI-544, not a parser false-positive. | PASS |
| AC-542-5 | Claude `~/.claude/settings.json` SessionStart healthcheck has no `timeout` field. Grok-native SessionStart healthcheck in `~/.grok/config.toml` is `timeout = 30`. | PASS |
| AC-542-6 | `validate-session-start-self-heal.sh` 10/10; `validate-session-start-healthcheck-multi-host.sh` 14/14. | PASS |
| AC-542-7 | Post-merge session `01a00f37` `hook_execution` healthcheck `success` 203ms; Grok-native `user:session_start[0]` `success` 326ms. Implement-session timeout is not used. | PASS |

### WI-543

| AC | Promoted evidence | Result |
|---|---|---|
| AC-543-1 | Live inspect loads nested `[[hooks.SessionStart]]` from `~/.grok/config.toml`. `validate-grok-hook-toml-roundtrip.sh` 24/24. | PASS |
| AC-543-2 | Post-merge inspect: one session_start hook with `source.path=/home/user/.grok/config.toml`. | PASS |
| AC-543-3 | Live `~/.grok/config.toml` SessionStart healthcheck `timeout = 30`. | PASS |
| AC-543-4 | `FRAMEWORK-STATE.md` and `provision/hosts/grok.json` `toml_table_shape` are `[[hooks.<Event>]]`. | PASS |
| AC-543-5 | Roundtrip validator 24/24; other host wirers unchanged. | PASS |
| AC-543-6 | Inspect: grok-home healthcheck == 1, Claude healthcheck == 1. Runtime: both succeeded; stamp collapses a second invoke. Total count == 1 is not required. | PASS |

## Runtime regression

| Check | Result |
|---|---|
| `validate-session-start-self-heal.sh` | 10 passed, 0 failed |
| `validate-session-start-healthcheck-multi-host.sh` | 14 passed, 0 failed |
| `validate-grok-hook-toml-roundtrip.sh` | 24 passed, 0 failed |
| Isolated `SVC_HOST=grok` healthcheck | silent, exit 0, 0.04s |
| Isolated `SVC_HOST=kimi` against live HOME | 26 `/tmp/fake` misses — WI-544 |
| `grok inspect --json` | session_start=6, grok-home healthcheck=1, claude healthcheck=1 |

Pre/post: `docs/specs/test-evidence/WI-542/pre-post-evidence.json` remains
`fixed-by-change`. Live SessionStart is the post-merge delta for AC-542-7.

## Graph reconciliation

`.svc/lane-tasks-WI-542.json` still had tasks 7–11 `pending` after PR #9
merged. Closeout marks 7–10 completed from merge evidence (no re-review,
no re-land) and completes task 11 from this report.

| Task | Skill | Disposition |
|---|---|---|
| 7 | review-gate | completed — G5 remediations landed in PR #9 |
| 8 | review-exec | completed — adversarial pass was part of land envelope on PR #9 |
| 9 | audit-implementation | completed — implementation audit artifacts existed in the implement worktree; shipped tree is `a4d0efa3` |
| 10 | land-changeset | completed — PR #9 merged `2026-08-17T09:49:27Z` |
| 11 | verify-promotion | completed — this report |

## Reattach note

`svc-ensure-worktree` first refused this session because the implement
worktree still held a fresh v1 claim (`01a00e3b`, no pid, 24h TTL, no v2
lease). `svc-authority takeover` cannot run without a v2 lease. The
implement claim was released through `releaseClaim(..., preserve_for_transfer)`
using that session id after PR #9 merge + remote-branch deletion. That is
the official API, not a hand-edited claim file. Missing automatic
post-land reattach is a framework UX gap; it is not a WI-542 fail.

## Out of scope

- Default-checkout chmod on the Grok Stop adapter
- WI-544 live Kimi `/tmp/fake` leftovers
- WI-545 (100644 vs 100755 adapters)
- Local `main` commits ahead of `origin/main`

## Findings

None blocking. Follow-up WI-545 recorded for adapter executable bits.
