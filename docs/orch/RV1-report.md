# RV1 — Agentic, bounded review

Candidate: `feature/rv1-agentic-review`, based on `0da02ea`; local commit only.

- Packet is an entry point: card, solution, acceptance, candidate and diff.
- Reviewers must read whole touched files, callers/callees, config/routes,
  related tests and the cost path, including unchanged defaults.
- Codex uses the VM bypass and a read-only prompt contract. Private transport
  files stay outside the candidate; before/after status, diff, HEAD and
  untracked contents detect edits, including changes to already-dirty files.
- Unproved blockers become advisory; original JSON and downgrade reason remain.
- Signed feature reservations precede paid dispatch; incomplete attempts count.
  Two rounds span candidates, kinds, reviewers and explicit related WI aliases.
  Same-WI identity reset is rejected; zero-call cache replay consumes no round.
- Round 2 verifies original fixes and adjacent breakage only.
- Author routing: Grok/Claude → Sol 6.1 high; Sol → Cursor Grok 4.7 high;
  milestone → agy `claude-opus-5-5-high`; never Astra/max or Claude Pro.
- Necessary companion changes: strict findings schema, bounded-exit producer,
  verifier/log cap, schema fixtures and generated routing index.

Validation:
- `node --test` on both review test files plus topology, bounded-exit and
  clean-main-followup evals: **48 passed, 0 failed**.
- Focused launcher eval: **174 passed, 0 failed**.
- Manifest lint, routing-index check and file-persistence check passed.
- Pristine HEAD full sweep: **402 passed, 0 failed** in the baseline clone.
- Final `bash test-framework/evals/run-all-evals.sh`: **402 passed, 0 failed**.
  Delta from pristine HEAD: **0 new failures**; earlier fixture failures repaired.
  Evidence: `/tmp/rv1-acceptance-evals.log`, `/tmp/rv1-node-release.log`.
- Owner reported two known failures; the pristine comparison did not reproduce them.

Coverage is deterministic/fake-CLI evidence, not paid-model defect discovery.
Baseline clone: `/home/dianast/worktrees/ssve-rv1-baseline-check`.
Source planning inputs remain untracked and are excluded from this commit.
