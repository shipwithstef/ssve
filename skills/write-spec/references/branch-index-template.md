# Branch Index Template (genesis-first, §3)

Created at spec time by `write-spec`, one file per scope, at
`docs/specs/relations/<scope>.branches.md`. Every later stage that touches the
scope **appends** to this file rather than writing a new document — see
`scripts/branch-index-freshness.mjs` for the freshness contract this header
feeds.

Copy the block below verbatim and fill in `<scope>`, the sha, and the globs.
Leave every axis section present but empty at genesis — each is filled by the
stage that first has evidence for it (often via `scripts/derive-branch-axes.mjs`
for the two mechanically-derivable axes: Callers, Journeys & tests — see
proposal §3d and the Axis note below).

**Axis note (WI-521 B5/G7):** unified onto the same 10-axis vocabulary
`audit-feature` already enumerates at `skills/audit-feature/SKILL.md:107-116` — the
earlier 7-axis fork (Entry points/Callers/Fallbacks/Tests & journeys/
Counters/Promises/Operational proof) is retired. Two axes
(**Callers**, **Journeys & tests**) can be seeded mechanically via
`scripts/derive-branch-axes.mjs` (see `skills/write-spec/SKILL.md` §Genesis Branch
Index); the other eight — including **Time, retry & concurrency**, whose
mechanical proxy (a catch/`||`/`?.`/try line pattern) was tried and rejected
as noise, not signal (WI-521 fix round) — need judgment and are filled by
hand as each stage produces evidence for them.

<!-- max 40 rows per axis; overflow → docs/specs/relations/<scope>.branches-archive.md -->

```markdown
Derived-at: <full sha, HEAD at genesis>
Scope-paths:
  - <glob>
  - <glob>

## Entry points
_(appended per stage)_

## Callers
_(appended per stage)_

## Auth
_(appended per stage)_

## State
_(appended per stage)_

## Currencies & counters
_(appended per stage)_

## Promises
_(appended per stage)_

## Outcomes
_(appended per stage)_

## Data
_(appended per stage)_

## Journeys & tests
_(appended per stage)_

## Time, retry & concurrency
_(appended per stage)_
```

Re-stamp `Derived-at` (and re-check `Scope-paths` still cover the touched
files) at the close of `plan-changeset` and again at the close of
`execute-changeset` — never mid-stage, so the SHA always names a real
checkpoint a reviewer can diff against. At each restamp, move any row the
current diff contradicts to a `## Superseded` tail section instead of
deleting it — readers skip that section, and the file stops both lying and
growing unbounded (G6).
