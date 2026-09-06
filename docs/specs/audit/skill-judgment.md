# Skill judgment audit — WI-FW-SKILL-JUDGMENT-01

Base: 6d4d8b07041e4afe8859820dbc0aac5f83f21f38. Dedicated Codex VM sessions first; shared first-party source across provisioned harnesses. Swarm/Slack deferred. The recovery/reviewer slice landed as PR36; this slice covers decision consumers, pilot applicability, duplicate continuation and focused test selection.

The frozen baseline used five skill/shared files (191123 bytes), plus the fixture. Actual contract defects included forced confirmation/market work, promotion question floors, unnecessary advisor loads and diagnosis-only scope tension. Source continuation text was extracted and reread before condensation; provenance remains in `.svc/skill-judgment-review/extraction-provenance.json`. Byte counts are not billed tokens or measured end-to-end execution savings.

## Current native evidence

Current behavioral evidence is `.svc/skill-judgment-review/candidate-release-result.json`, SHA-256 24c3a57722b4311867e18f07f36b236099775901546c2e96255b46aa6dc5d64e, 193595 evaluated input bytes including the fixture. A/B/C were reused only after exact source hashes matched; D was replayed after its final checklist correction. All four scenarios PASS. All six input hashes matched at start and end; committed blob and routing-index parity are checked before release. Required AC/state/dependency evidence, meaningful alternatives, persona fit, spec/code conflicts, risk, reversibility, success signals and UX/accessibility remain substantive requirements.

| Input | SHA-256 |
|---|---|
| test-framework/fixtures/skill-judgment/behavior.json | f14809f9c74434b396286b56b0c22deeda8c097ed6ae7607c93d1cd38342b5ac |
| _shared/product-question-format.md | 841589d99a3a1a0e981f13277e63695499ea3f0f48a4414445321fc692870bea |
| skills/validate-feature/SKILL.md | 07099be3b72eaa107997fd12b389d6c9f14d072042930d144bc853ec11e4cf6d |
| skills/design-ux/SKILL.md | 772876aa68dfb17e2c1902c98d6cdadd0f77862d0148452bf8d72f00276cc61c |
| skills/svc-advisor/SKILL.md | 04fa23588aca41a515e52bd88930c0752a09a0569922eb5a7cbe5416fff6ac42 |
| skills/diagnose-bug/SKILL.md | 1c067b8ec77bd9b200aadb15f189915ec49ffcd430a06aa66a7c908179408eb6 |

## Review and regression evidence

Native Sol High reviewed the source and correction deltas. Canonical Cursor review `exec` returned FAIL with F-EXEC-001..004; those defects were corrected. `exec-corrected` approved the cumulative 97e742d implementation with findings: F005 (this audit cited superseded evidence) and F006 (six remaining placeholder checklists). This closeout updates the citation and all six actual consumers. The validator now checks all 18 live consumers and all 10 relevant checklist-bearing skills. The final independent review and release status are recorded in the candidate-bound launcher/panel and SHA-keyed chain receipts; this evidence inventory is not itself release approval.

The prior native result `candidate-final-result.json` (2dde2bf8…, 192463 bytes) is superseded, not proof of the release candidate. `candidate-corrected-result.json` (c0daf8f7…, 193386 bytes) is the subsequent valid intermediate evaluation. Preserve both and the raw failed review; do not relabel failure as approval.

The full Tier 1 corpus ran once: 342 passed, 23 failed, zero timeouts. **19 distinct failing validator names reproduce on unchanged 6d4d8b0.** One of those validators also had six added pilot assertions that were fixed; its remaining three produce-ad-video findings now match baseline. Four other failed validator names passed after count correction, a focused timing rerun, or committed router/active-plan validation. The full corpus remains non-green. Exact results are in `full-tier1-attribution.json`, `baseline-current/results.json`, focused and postcommit results under `.svc/skill-judgment-review/`.

All nine host installer validation paths passed without paid provider use. Normal post-merge installation and all-host drift/source-identity verification are recorded by verify-promotion; no product worktree, unavailable provider, global reviewer credential or unrelated dirty checkout is part of this changeset. No measured task-speed or global prompt-token reduction is claimed.
