---
name: auto-learning-capture
domain: observability
severity: MEDIUM
status: active
created: 2026-05-12
last_reviewed: 2026-05-12

signals:
  file_path_patterns:
    - "hooks/svc-auto-capture-learnings.mjs"
    - "scripts/lib/learning-candidate-detector.mjs"
    - "scripts/lib/learning-dedup.mjs"
    - "scripts/lib/resolve-user-memory-path.mjs"
    - "scripts/capture-session-learnings.mjs"
    - "scripts/promote-auto-learnings.mjs"
    - "hooks/svc-learning-preload.mjs"
    - "references/schemas/auto-learning-candidate.schema.json"
    - "references/framework-learnings.jsonl"
    - "docs/learnings/learnings.jsonl"
    - ".svc/auto-learnings.jsonl"
    - ".svc/auto-learnings.draft.jsonl"
  diff_keywords:
    - "auto-learnings"
    - "learning-candidate"
    - "promote-auto-learnings"
    - "candidate_target"
    - "SVC_AUTO_LEARN"
  packages_imported:
    []
  env_vars_referenced:
    - "SVC_AUTO_LEARN_*"

handled_by:
  required_rules:
    - "learning-preload"
  required_skills:
    - "manage-learnings"
  optional_skills:
    - "audit-session-execution"
    - "improve-framework"

waiver_format: |
  PR body line: "concern-waived: auto-learning-capture — <reason>"
  Logged as a taste decision in .svc/pipeline-decisions.jsonl.

fires_on:
  - first-introduction
  - bugfix-touching-call-shape
  - new-caller
  - refactor

fires_off:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/__tests__/**"
  - "**/docs/**"

related_concerns: []
---

# auto-learning-capture

Auto-capture pipeline that scans session activity for novel learning signals, writes them to a gitignored audit log, and exposes them to the next session's preload before any explicit promotion to tracked learning files.

# How an agent should think about it

1. Default capture target is `.svc/auto-learnings.jsonl` (gitignored). Hooks and CLIs MUST NOT write to tracked files (`references/framework-learnings.jsonl`, `docs/learnings/learnings.jsonl`, or host user-memory) without an explicit user invocation of `scripts/promote-auto-learnings.mjs`.
2. Default behavior must leave `git status` clean for every tracked learning file. The tier-1 fixture `validate-auto-learning-capture.sh` pins this contract.
3. New detector heuristics belong in `scripts/lib/learning-candidate-detector.mjs` and must respect the 200ms hook budget. Add a fixture asserting the candidate shape before merge.
4. Schema changes to `references/schemas/auto-learning-candidate.schema.json` require updating the hook's emitted fields AND the promoter's `candidateToLearningRow` transform.
5. The preload hook reads BOTH `references/framework-learnings.jsonl` (threshold >= 8) AND `.svc/auto-learnings.jsonl` (threshold >= 6). A change touching either threshold needs a regression fixture proving detector-produced candidates still surface.
6. User-memory promotion routes through `scripts/lib/resolve-user-memory-path.mjs`. New hosts get their entry via `provision/hosts/<host>.json#user_memory_path_template`; absence triggers the `~/.svc/per-host/<host>/projects/<slug>/memory/` fallback.

# Why it exists

The framework's learning pipeline was read-only at session start and write-only on user request. Sessions producing N load-bearing framework learnings per run discarded them at session end. WI-343 introduced this surface so that auto-captured candidates preload next session even before explicit promotion, while keeping the repo clean by writing only to gitignored audit logs by default.

The concern engages here because edits to ANY of the listed files can silently break the loop: a stricter preload threshold can starve detector output, an unwired user-memory path can lose memories on promotion, and a schema drift between hook and promoter produces broken `(undefined, confidence: N)` rows when learnings preload. Routing the right thinker (`manage-learnings`, optionally `audit-session-execution`) on every such edit prevents the loop from regressing silently.

# Examples

**Matches:**
- Adding a 7th detector heuristic in `scripts/lib/learning-candidate-detector.mjs`.
- Tightening the hook's runtime budget below 200ms.
- Updating `references/schemas/auto-learning-candidate.schema.json`.
- Adding a `candidate_target` value beyond the existing three.
- Wiring a new host's user-memory layout via `provision/hosts/<host>.json#user_memory_path_template`.

**Does not match:**
- Editing a single framework-learning row by hand in `references/framework-learnings.jsonl` (covered by `learning-preload` rule directly).
- Test fixtures under `test-framework/evals/` (exempted via `fires_off`).
- Documentation prose in `docs/` (exempted).
