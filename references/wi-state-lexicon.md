# Work Item State Lexicon

Use these states consistently in `docs/specs/work-items/WI-*.md` and
`docs/specs/work-items/INDEX.md`. Task graph JSON remains lowercase
`pending`, `in_progress`, `completed`, `blocked`, or `skipped`.

| State | Meaning | Unblocks when |
|---|---|---|
| `backlog` | Accepted but not started. | Work starts or the WI is superseded. |
| `in_progress` | Active work is underway. | The task closes, blocks, or returns to backlog. |
| `blocked` | Work cannot proceed for an external or user-answer dependency. | The dependency is resolved. |
| `BLOCKED_ON_DISCOVERY` | A verifying skill found a `BLOCKING_DISCOVERY` that prevents honest parent verification. | The follow-up WI closes and parent verification reruns without workaround evidence. |
| `VERIFIED` | Acceptance criteria are complete and validation evidence is recorded. | Terminal unless reopened by a later audit. |

When a blocking discovery has a child WI, record the parent as:

```text
BLOCKED_ON_DISCOVERY: WI-054
```

Do not use `BLOCKED_ON_DISCOVERY` for ordinary failed tests, missing evidence
that can be supplied inside the same WI, or speculative concerns without a
validated artifact.
