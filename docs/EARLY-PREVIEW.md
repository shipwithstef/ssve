# SSVE early preview

This repository is an **early public preview**, not a claim that every
operator workflow is finished. Two-Box Planning remains **VERIFIED**
([WI-FW-TWO-BOX-01](specs/work-items/WI-FW-TWO-BOX-01.md),
[PR #62](https://github.com/shipwithstef/ssve/pull/62)). Large-input
prompt inspection remains **CLOSED**
([WI-FW-PROMPT-INSPECTION-01](specs/work-items/WI-FW-PROMPT-INSPECTION-01.md)).
Do not rerun those paid live experiments to “confirm” this preview.

Install with `./setup` for your host, or `./setup --all-hosts` when you
intentionally provision every supported host. Keep the default hooks
enabled. Disabling a host PreToolUse hook is **not** a supported install
or recovery step.

## Known limitations

These are current operator-visible gaps. They are tracked on
[WI-FW-OSS-READINESS-01](specs/work-items/WI-FW-OSS-READINESS-01.md).
Related recovery and installation follow-up lives on
[WI-FW-CLEAN-MAIN-FOLLOWUP-01](specs/work-items/WI-FW-CLEAN-MAIN-FOLLOWUP-01.md).

1. **Completed-task recovery deadlock.** After a task is already complete
   and the controller lease has been released, a later same-owner resume
   can fail closed instead of converging. An owner once disabled a local
   Codex hook to finish an earlier release. That local deviation is not
   a default, not a documented recovery fix, and must not be copied as
   an install procedure. Proven reads and help should remain available;
   foreign or ambiguous mutation should stay denied.
2. **Invalid generated coverage on documentation-only closeout.** The
   merge helper can synthesize implementation coverage from an older
   work-item graph when the squash is documentation-only. The resulting
   receipt envelope is invalid. Substantive changes must still carry
   real coverage. Tracked with WI-533 / WI-556 contracts.
3. **Legacy state and evidence discrepancies.** `FRAMEWORK-STATE.md`,
   older delivery graphs, and some release records are not fully
   reconciled. Runtime acceptance is not the same as complete historical
   evidence. Missing receipts are not passing receipts.

## What this preview is not

- Not a promise that every host recovers automatically after
  interruption.
- Not permission to skip review gates, receipts, or install drift
  checks.
- Not a full-history privacy clearance. A clean tip does not clean
  earlier commits, other branches, notes, or GitHub pull-request
  objects. See the publication decision packet.

## License and attribution

The tree ships an MIT `LICENSE`, `CONTRIBUTING.md`, `NOTICES`, and
`NOTICES.md`. Reading those files is not a complete provenance audit.
Blend sources are listed in `references/blend-registry.json`.
