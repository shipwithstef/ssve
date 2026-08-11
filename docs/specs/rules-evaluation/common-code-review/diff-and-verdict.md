# Diff and Verdict — common/code-review.md

## Diff

| Scenario | Default | Rule prescribes | Delta |
|---|---|---|---|
| Review triggers | On demand; sometimes self-review | Explicit mandatory triggers (after writing, before commit, security changes) | Behavior change — more systematic |
| Severity communication | Natural language ("security issue", "minor") | Formal 4-level taxonomy: CRITICAL/HIGH/MEDIUM/LOW with BLOCK/WARN/INFO/NOTE | Significant determinism gain |
| Coverage threshold | "Good coverage", 80% as a guideline | 80% hard minimum, BLOCK if below | Stronger framing |
| Review outcome | Ad hoc | Approve/Warning/Block framework | Consistent outcomes |
| Agent routing | Inline or generic Agent | ECC-specific agents (code-reviewer, security-reviewer, etc.) | ECC dependency |

## Analysis

The severity taxonomy (CRITICAL/HIGH/MEDIUM/LOW → BLOCK/WARN/INFO/NOTE) is a
genuine behavior change. Without this rule, I describe issues in natural language
with inconsistent urgency framing. With it, I use a consistent, actionable
vocabulary that helps developers triage. This is real determinism gain.

The mandatory trigger list is also a behavior change: I don't currently have
explicit checkpoints that fire on "security-sensitive code changed." The rule
creates a clear hook.

The 80% coverage hard minimum is more prescriptive than my default guideline,
and in the right direction.

**ECC dependency issue:** The agent routing table (code-reviewer, security-reviewer,
typescript-reviewer agents) must be stripped or generalized. In non-ECC environments
these agents don't exist. The taxonomy, checklist, and severity model are valuable
independent of ECC; the agent names are not.

## Scores

| Axis | Score | Rationale |
|---|---|---|
| determinism_gain | 2 | Severity taxonomy + explicit triggers eliminate inconsistent review framing |
| correctness_delta | 2 | Structured checklist catches issues that ad hoc reviews miss |
| friction_cost | 1 | Minor — ECC agent refs create friction in non-ECC use |
| convention_conflict | 1 | ECC agent names are a minor conflict with svc's skill vocabulary |

## Edits required for adoption

1. Strip the agent routing table (the "Agent" columns) — replace with "use
   security-review skill" and "invoke review-gate skill" in svc context
2. Keep: severity taxonomy, review checklist, coverage threshold, outcome framework
3. Retitle "Agent Support" sections as "Skill Support" and reference svc skills

## Verdict

**adopt-with-edits**

DG=2, CD=2, FC=1, CC=1 — meets the adopt-with-edits threshold. The severity
taxonomy and structured checklist are genuine behavior improvements over my
natural-language defaults. ECC agent references must be replaced with svc-equivalent
skill references before adoption.
