# Cross-Model Execution Review: WI-510 Phase-Receipt Skip Integrity

**Date:** 2026-07-23
**Models:** Codex GPT-5.6 (implementation/evaluation) and Claude Opus 4.8 high (independent review)
**Rounds:** 3 of a hard maximum of 3
**Branch:** `framework-WI-510-phase-receipt-skip-integrity`

## Summary

- Round 1 was non-substantive: the canonical launcher succeeded, but the
  read-only reviewer had no repository tools and the package named rather than
  embedded the implementation. Its conservative failure was accepted as a
  packaging finding, not an implementation verdict.
- Round 2 embedded the committed diff and complete classifier, CLI, fixtures,
  consumers, feature spec, technical design, and doctrine.
- Round 3 reviewed the audit-corrected fixed-anchor, replacement-object,
  temporary-root, evidence-path, and performance delta. Its first launcher
  attempt exhausted the schema turn budget and is preserved as a hard failure;
  the same Opus/high tuple then reviewed the embedded exact delta successfully.
- Effective reviewer tuple: Codex orchestration to
  `claude-opus-4-8` / Anthropic / high effort.
- Corrected-delta findings: 0 Critical, 0 High, 0 Medium, 3 Low, 1 Info.
- Corrected-delta accepted and fixed/documented: 2.
- Corrected-delta accepted with justification: 1 Low.
- Corrected-delta rejected with direct code evidence: 1 Info.
- `rounds_run: 3`.

Authoritative artifacts:

- Round 1 findings:
  `.svc/external-review-artifacts/wi510-cross-model-round1/findings.json`
- Round 1 launcher receipt:
  `.svc/external-review-artifacts/wi510-cross-model-round1/receipt.json`
- Round 2 findings:
  `.svc/external-review-artifacts/wi510-cross-model-round2/findings.json`
- Round 2 launcher receipt:
  `.svc/external-review-artifacts/wi510-cross-model-round2/receipt.json`
- Round 3 failed schema-budget receipt:
  `.svc/external-review-artifacts/wi510-cross-model-round3/receipt.json`
- Round 3 repaired package:
  `.svc/review-cross-model-package-corrected.md`
- Round 3 repaired launcher receipt:
  `.svc/external-review-artifacts/wi510-cross-model-round3-repair/receipt.json`
- Mechanical cap log: `.svc/review-cross-model-log.yaml`

## Round 1

### REVIEW-BLOCKED-01 — Accepted

The reviewer could not inspect named repository files because its only enabled
tool was structured output. The response explicitly withheld certification and
reported no observed code defect.

Action: embed the exact committed diff and complete authoritative files into the
round-2 input. No implementation change was made from this finding.

## Round 2

### WI510-01 — Accepted and fixed (Low)

Whole-graph compatibility scans can legitimately return `checked: 0`, while
exact requested filtered tasks exit 2. This was intentional but under-signposted.

Fix: `references/phase-receipts.md` now states that a scoped scan may check zero
tasks, that the checked count is diagnostic, and that selection is not
authorization or classification.

### WI510-02 — Accepted and fixed (Low)

The authorized-skip branch required current phases, but the mutation matrix did
not directly pin authorization-with-empty-phases.

Fix: added `authorized-skip-empty-phases`, which supplies matching delivery and
task authorization but expects `invalid` / `missing-phases`.

### WI510-03 — Accepted and fixed (Low)

The timestamp parser allowed at most three fractional digits although doctrine
requires ISO-8601 without imposing millisecond precision.

Fix: accept one or more fractional digits while retaining strict calendar,
clock, offset, and parse checks. Added a microsecond-precision positive fixture.

### WI510-04 — Accepted with justification (Info)

Legacy resolution starts bounded Git subprocesses per classified graph even
when most current tasks already have phases.

Disposition: retain for a future performance-only optimization. The behavior is
correct, full Tier-1 passes 273/273 with zero timeouts, and changing evaluation
order during a security-sensitive fix would add unnecessary risk.

### WI510-05 — Accepted and fixed (Info)

The selector included receipt skill in delivery-skip candidates while
classification uses the task's canonical skill. Receipt mismatch still failed,
but the asymmetry was unnecessary.

Fix: selector delivery matching now uses only task metadata/direct skill, while
receipt skill remains part of registered-candidate discovery so malformed task
metadata cannot disappear.

## Round 3 — corrected implementation

### WI510-EX-01 — Rejected with evidence (Info)

The reviewer could not see unchanged snapshot-match code in the embedded delta
and therefore treated exact task identity as inferred from fixtures. The
classifier directly requires strict typed task-ID equality, completed state,
canonical skill equality, and `isDeepStrictEqual` over the complete receipt
before setting `legacyTaskAuthority.eligible`. Dedicated task-ID, skill, and
receipt mutations all remain red. No implementation gap exists.

### WI510-EX-02 — Accepted and fixed (Low)

The hardened Git helper disabled replacement objects and stripped repository,
object, index, and namespace overrides, but did not neutralize injected Git
configuration variables.

Fix: remove all inherited `GIT_CONFIG_*` variables, point global config to
`os.devNull`, disable system config, and retain `--no-replace-objects` plus
`GIT_NO_REPLACE_OBJECTS=1`. The focused anchor/replacement fixture remains red.

### WI510-EX-03 — Accepted with justification (Low)

The leading scheme-shaped token rule also rejects POSIX filenames such as
`note:1.log`.

Disposition: retain the rejection intentionally. Evidence paths are a portable
framework contract, and a leading colon token is ambiguous or invalid across
Windows/POSIX consumers. Doctrine now names the tradeoff and the hyphen/directory
alternative. This is fail-closed portability, not an accidental parser limit.

### WI510-EX-04 — Accepted and documented (Low)

The supported legacy fixture intentionally depends on WI-181 remaining the
repository's real phase-free pre-enforcement canary.

Fix: document the canary coupling inline. A future WI-181 byte change must
trigger an explicit compatibility decision instead of silently replacing the
historical authority.

## Convergence

- Unresolved Critical: 0
- Remaining High: 0
- Every accepted actionable corrected-delta finding: fixed or documented
- One corrected-delta Low: accepted with explicit portability justification
- One corrected-delta Info: rejected with direct code and mutation evidence
- Hard-cap check: required before task completion

## Verdict

PASS for cross-model execution review. This is not a merge or promotion claim.
The mandatory review-exec, security review, implementation audit, final
Tier-1, final-SHA receipts, landing, and promoted-main replay remain required.
