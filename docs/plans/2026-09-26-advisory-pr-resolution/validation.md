# Validation and delivery status — 2026-09-26

## Current release evidence

The combined #117 candidate passed 395/395 Tier-1 validators, zero failures and timeouts, in hosted run [36245994615](https://github.com/shipwithstef/ssve/actions/runs/36245994615). It merged to main as `130db2bff74229348b1cf6db7892615ec9ca239d`; the tested and merged trees match. Post-merge main passed 395/395 in [run 36246353708](https://github.com/shipwithstef/ssve/actions/runs/36246353708). Canonical main was installed on all nine hosts with zero drift. The eight hook-capable hosts passed installed advisory/enforce callback probes.

The owner changed live ruleset 23622869 to require strict, current-base `SSVE Required` checks from GitHub Actions app 15368. Its always-allowed role bypass was removed. Required approvals are zero and required code-owner review is disabled for the sole-owner repository; pull requests, resolved threads and linear history remain required. Owner-authenticated readback and effective main rules were captured after the change. A real PR under the updated ruleset still needs to prove the routine path before issue #70 closes.

The configured cross-family reviewer did not produce a successful review, and canonical phase-completion receipts remain incomplete. The owner-directed release decision was logged; hosted success and installed probes do not fabricate those receipts.

## Historical local implementation evidence

The corrected advisory implementation passed the complete free Tier 1 suite: **375/375 Tier 1 validators, zero failures and zero timeouts**, in 421 seconds. The runner's before/after source snapshots match (`inputs_stable: true`). Focused independent review found no concrete blocker; the reviewed runtime file hashes are in `implementation-files.json`.

After that earlier full run, the shared #114 baseline received a test-only timing correction for hosted runners: real Git discovery and fake authentication needed enough time to reach the intentional hanging GitHub command. The corrected fixture retained timeout classification, clamp, invalid-input, checkpoint and default-10-second assertions and passed in isolation. The advisory runtime did not change. The final combined revision was later validated by the 395/395 hosted runs above; the earlier 375/375 result applies only to its original input.

| Repair | Local evidence | Delivery |
|---|---|---|
| #108 page UX draft | 373/373 full; post-commit layout, triage and worktree checks | Published as a non-installed proposal |
| #114 baseline | 373/373 full; post-commit timeout/worktree checks | Published; subsequent hosted timing-fixture correction |
| #111 nested manifest scope | 374/374 full with stable inputs; 7/7 post-commit tests | Published; shared timing-fixture correction |
| #112 output alias protection | 374/374 full with stable inputs; 8/8 post-commit alias/no-write tests | Published as `5ea34f6`; final hosted checks tracked in its PR |

Full logs and input-bound summaries are retained locally under `test-framework/results/2026-09-26-advisory-pr-resolution/` (ignored evidence, not a phase approval).

## Review and remaining limits

The configured Grok reviewer returned an invalid placeholder in its first bound report. A stale retry was cancelled when compatibility fixes changed the candidate. The final corrected-candidate attempt timed out at 300 seconds. No successful cross-family review or canonical phase-completion receipt is claimed. The lane graph keeps uncertified phases open. The owner made and recorded the release exception before #117 merged; that decision does not certify the missing phases.

The #114 corrected head `e599faa` passed `SSVE Required` in [run 36241355762](https://github.com/shipwithstef/ssve/actions/runs/36241355762). The first #117 hosted run stopped at a workflow-contract test requiring explicit pending-release wording. That test was corrected to compare parsed YAML configuration instead of byte-identical comments; all configuration, security, trigger and required-check assertions remain. The subsequent combined candidate and main results are recorded above. #115/#116 were closed as obsolete partial aggregates, with useful fixes and integration tests retained in #117.
