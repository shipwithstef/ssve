# Diff and Verdict — common/git-workflow.md

## Diff

| Scenario | Default | Rule prescribes | Delta |
|---|---|---|---|
| Commit message format | Conventional commits (feat/fix/refactor/docs...) | Same | None |
| Co-author attribution | CLAUDE.md mandates `Co-Authored-By: Claude Opus 4.6 (1M context) <contact-cd29c5ac34@example.invalid>` | **"Attribution disabled globally via ~/.claude/settings.json"** | **DIRECT CONFLICT** |
| PR workflow | Analyze full history, git diff base...HEAD, comprehensive summary | Same | None |

## Analysis

The commit format and PR workflow sections restate defaults I already follow.
No behavior change there.

**The attribution line is a hard conflict.** The ECC rule says attribution is
disabled globally. vibomatic's CLAUDE.md says:

> Co-author trailer: `Co-Authored-By: Claude Opus 4.6 (1M context) <contact-cd29c5ac34@example.invalid>`

If this rule were adopted globally, it would instruct Claude to NOT add the
Co-Authored-By trailer on every commit — directly overriding a locked
architectural decision in CLAUDE.md.

This isn't a "might conflict" situation. It's a deterministic overwrite of a
documented, actively-enforced project convention.

## Scores

| Axis | Score | Rationale |
|---|---|---|
| determinism_gain | 1 | Format conventions restated |
| correctness_delta | 0 | No correctness improvement |
| friction_cost | 1 | Minor format overhead |
| convention_conflict | 3 | **Directly contradicts CLAUDE.md's locked Co-Authored-By requirement** |

## Verdict

**reject**

convention_conflict = 3 is an automatic reject condition. The attribution
override is a hard conflict with a locked project rule. This rule cannot be
adopted in vibomatic in any form as written. If the format guidance were
wanted, it would need to be extracted without the attribution line and merged
into an svc-native git-workflow rule.
