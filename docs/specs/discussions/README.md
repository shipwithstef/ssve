# Discussion Artifacts

Discussion-phase outputs live here.

These files are topic-scoped working records for expensive ambiguity that must
be resolved before downstream phases can safely continue.

- Canonical file shape: `docs/specs/discussions/<topic>.md`
- Human-readable source of truth: markdown with YAML frontmatter
- Machine-safe reads: `scripts/discussion-artifact.mjs`

Discussion artifacts are not a replacement for:

- `docs/specs/features/*.md` — requirements and technical design
- `docs/specs/decisions/*.md` — design-alternative reasoning history
- `docs/logs/pipeline-decisions.jsonl` — append-only audit trail

This directory is tracked so the artifact family has a stable home before the
first write.
