# Knowledge Spine Frontmatter Contract

Source: `proposals/done/2026-04-30-infra-project-support.md` § 3.2
Implements: WI-SPINE-001

Skills MAY declare four optional fields in their YAML frontmatter to integrate with the Knowledge Spine. These fields are **optional with default behavior preserved when absent** — every existing skill continues to work unchanged.

## The four fields

```yaml
requires_topics: [stack.iac-tool, stack.state-backend, domain.compliance]
produces_topics: [decision.architecture, plan.module-list]
recall_depth: layer-2          # layer-1 | layer-2 | layer-3 | escalate
idempotent: true               # true | false | once-only
```

### `requires_topics: [string]`
Topics this skill needs from the Spine before it runs. The `recall-stack-knowledge` gate fetches matching slices across all five Spine layers and injects them into context. Empty list (`[]`) means the skill needs no Spine recall (default behavior).

Topic naming convention: dotted-hierarchical, lowercase, hyphenated. Examples:
- `stack.iac-tool`, `stack.state-backend`, `stack.observability`
- `domain.compliance`, `domain.payment-rails`
- `learnings.recent-architectural`, `learnings.recent-security`
- `decision.architecture`, `decision.vendor`
- `<external-domain>.<sub-topic>` — e.g. `terraform.providers`, `kubernetes.networking`

When a topic doesn't match any populated knowledge domain, the gate logs a `knowledge-gap` event and (Phase B+) auto-spawns a `research` task.

### `produces_topics: [string]`
Topics this skill writes to the Spine on successful completion. Used by downstream skills to know what's now available without re-querying. Empty list (`[]`) means the skill produces no Spine-indexed knowledge.

### `recall_depth: layer-1|layer-2|layer-3|escalate`
How deep into the Spine the gate fetches. Default: `layer-2`.

| Depth | Reads | Token budget |
|---|---|---|
| `layer-1` | INDEX.md only | ~200 tokens |
| `layer-2` | + CAPABILITIES.md | ~2K tokens |
| `layer-3` | + relevant `details/*.md` | ~5–10K tokens |
| `escalate` | + recent learnings + decisions log | ~15K tokens |

Pick the smallest depth that satisfies the skill's actual needs. Quick-fix and other low-context skills should declare `layer-1`.

### `idempotent: true|false|once-only`
Whether running this skill twice on the same input is safe.
- `true` — re-runnable; output is deterministic.
- `false` — has side effects that should not be repeated (e.g., posts a comment, sends a notification).
- `once-only` — meant to run exactly once per WI; subsequent invocations refuse or no-op.

Used by execute-changeset and orchestrators to decide retry behavior on transient failures.

## Validation

Tier-1 validator: `test-framework/evals/tier-1/validate-spine-frontmatter.sh`.

The validator only checks shape **when fields are declared**. Skills that don't declare them pass automatically. Existing 47 skills are unaffected.

## Phased rollout (per proposal §11)

- **Phase A (WI-SPINE-001, current):** fields accepted but advisory. Spine gate logs gaps, never blocks.
- **Phase B (WI-SPINE-002):** gap → research auto-loop populates missing knowledge.
- **Phase E (WI-SPINE-005):** `requires_topics` becomes mandatory for `infra-*` lanes; the gate refuses to proceed on 0-hit. App lanes remain advisory.

## Caveat for skill authors

Tier-1 cap: `requires_topics[]` length must be ≤8 per skill (proposal §12 risk mitigation). If a skill needs more topics than that, the design is wrong — split the skill or restructure its needs.
