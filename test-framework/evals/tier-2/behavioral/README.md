# Tier-2 Behavioral Evals

Deterministic behavioral checks for pipeline-critical svc skills. Filling the gap between tier-1 (structural / AST) and tier-3 (LLM-as-judge / expensive).

## How it works

Each behavioral eval is a JSON file paired with a `.fixture.txt` containing a recorded assistant response. The runner loads the conversation, treats the fixture as the assistant's actual response, and evaluates the assertions against it. **No live LLM calls are made.** Recording is a separate (manual) workflow — these files capture known-good responses so we can detect drift.

## Schema

```json
{
  "skill": "<skill-under-test>",
  "scenario": "<short label>",
  "conversation": [
    { "role": "user", "content": "..." }
  ],
  "assertions": [
    { "type": "contains|not_contains|regex|equals", "value": "..." }
  ]
}
```

### Assertion types

| Type | Pass condition |
|---|---|
| `contains` | fixture text includes `value` (substring match) |
| `not_contains` | fixture text does NOT include `value` |
| `regex` | `value` is a regex; fixture matches |
| `equals` | fixture text trimmed equals `value` |

## File layout

```
behavioral/
  README.md                         (this file)
  <skill-under-test>.json           (eval definition)
  <skill-under-test>.fixture.txt    (recorded response)
```

## Running

```bash
node test-framework/evals/tier-2/run-behavioral.mjs test-framework/evals/tier-2/behavioral
```

Exit codes:
- `0` — all evals passed
- `1` — at least one eval failed (stderr names which assertion failed and why)

## Why behavioral evals exist

Tier-1 catches structural drift (frontmatter shape, AC table format, chain references). Tier-3 catches semantic correctness (does the skill produce the right idea?) but costs LLM tokens per run.

Tier-2 behavioral evals are deterministic and cheap: they verify "given input X, does the skill produce a response containing the load-bearing decision Y?" without paying LLM cost on every CI run.

A skill that always returns "proceed" regardless of input passes tier-1 (structurally fine) but fails behavioral evals (the response doesn't change with input).

Source: pattern imported from coreyhaines/marketingskills v1.9.0. Adapted to fit svc's existing tier-1/tier-2/tier-3 layering. WI-135.
