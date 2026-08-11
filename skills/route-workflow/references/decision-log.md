# Pipeline Decision Log

## Pipeline Decision Log

The workflow uses `.svc/pipeline-decisions.jsonl` (append-only) as its
shared audit trail across standalone, progressive, and autorun work.
`route-workflow` owns the schema and initializes the log; workflow skills append
entries only when their contracts include explicit logging steps for material
decisions, user interactions, or gate outcomes.

The log captures the material decision trail between the model, P0, the user,
and review gates.

### JSONL Schema

Each line is one decision event:

```json
{
  "timestamp": "2026-04-05T14:32:01Z",
  "run_id": "<stable-session-or-worktree-id>",
  "skill": "validate-feature",
  "phase": 4,
  "type": "taste",
  "decision": "MVP includes delete and open commands, not just add/search/list/export",
  "reasoning": "Delete and open are table-stakes for any bookmark manager. Excluding them would feel incomplete.",
  "alternatives": ["Defer delete/open to v2", "Include only delete, not open"],
  "decided_by": "P0",
  "evidence": "buku and nb both ship delete on day 1",
  "overrideable": true
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `timestamp` | yes | ISO 8601 timestamp |
| `run_id` | yes | Stable session, worktree, or lane identifier that ties decisions to a single run before a commit exists |
| `skill` | yes | Which skill produced this decision |
| `phase` | yes | Pipeline phase number |
| `type` | yes | `mechanical` / `taste` / `user` / `question` / `answer` / `no-ship` / `gate-result` |
| `decision` | yes | What was decided or asked |
| `reasoning` | yes | Why — the specific logic |
| `alternatives` | no | Other options that were considered |
| `decided_by` | yes | `P0` / `user` / `review-gate` / `cross-model` |
| `evidence` | no | Data or research that informed this |
| `overrideable` | yes | Can the user override this at end-of-run? |

### Event Types

| Type | When to log |
|------|-------------|
| `mechanical` | Clear-answer decision (logged silently, still recorded) |
| `taste` | Close-call decision — P0 picked one of N viable options |
| `user` | Decision that stopped the pipeline for user input |
| `question` | P0 or skill asked the user something (interactive mode) |
| `answer` | User responded to a question |
| `no-ship` | validate-feature killed a feature |
| `gate-result` | review-gate returned PASS/FAIL/ESCALATE |

### When to Write

- **At workflow start:** log a `mechanical` entry with `"decision": "Starting <skill>"`
- **At explicit decision checkpoints:** log the decision before acting on it
- **At user interactions:** log the question, then the answer as separate entries
- **At gate results:** log PASS/FAIL/ESCALATE with the findings summary
- **At NO-SHIP:** log with the kill signal count and top evidence

### How to Write

Append one JSON line per decision with the helper:

```bash
node scripts/pipeline-log.mjs append \
  --path .svc/pipeline-decisions.jsonl \
  --run-id "<stable-session-or-worktree-id>" \
  --skill validate-feature \
  --phase 4 \
  --type taste \
  --decision "MVP includes delete and open commands, not just add/search/list/export" \
  --reasoning "Delete and open are table-stakes for any bookmark manager." \
  --decided-by P0 \
  --evidence "buku and nb both ship delete on day 1" \
  --overrideable true \
  --alternatives-json '["Defer delete/open to v2","Include only delete, not open"]'
```

The helper creates `.svc/` if it doesn't exist. Never overwrite — append only.

### Historical Skip Entries

Historical work items that predate a new guard requirement may be acknowledged
once with `historical_skip: true`. The completion guard treats that as a
permanent opt-out for the named WI(s), but only for already-completed
pre-enforcement receipt/decision checks; actionable `pending` or `in_progress`
tasks still block normally.

```json
{
  "timestamp": "2026-05-11T00:00:00Z",
  "run_id": "WI-085,WI-086",
  "skill": "route-workflow",
  "decision": "completed-in-prior-sessions",
  "reasoning": "These WIs were closed before route decision and receipt enforcement existed.",
  "historical_skip": true
}
```

Use this only for WIs whose completion predates the relevant guard. Do not use
`historical_skip` to bypass current task graph, phase receipt, or review-gate
requirements.

### End-of-Run Summary

At pipeline completion (or when the user asks "what happened?"), read the log
and present decisions grouped by type:

```
Pipeline Run: <run_id>
Skills executed: 8 | Decisions logged: 24

Mechanical (14): [silently decided — available in log]
Taste (10):
  1. [skill] decision — reasoning (override? yes)
  2. ...
User (0): [none — all checkpoints were P0-decided]
```

The user can override any `taste` decision by saying "override decision N"
and providing their preference. The skill that produced the decision is
re-invoked with the override.

## Decision Classification

1. **Classify every decision** as:
   - **Mechanical** — clear best answer, decide silently (e.g., file naming)
   - **Taste** — close call, P0 decides but logs it for end-of-run review
   - **User** — high stakes or irreversible, stop and ask even in auto mode

2. **Run skills through the lane**, P0 steering each one.
   **Sequential where outputs feed forward** — `analyze-domain` produces
   `domain-profile.md` which `analyze-competitors` reads for market grounding.
   Run them in order: `analyze-domain` → `analyze-competitors` → `build-personas`.

   All other skills run sequentially (they consume the previous skill's output).

3. **At end of run**, present all Taste decisions at once:
   > "I made 12 decisions during this run. 9 were mechanical. Here are the 3
   > taste calls I made — review and override any you disagree with."

4. **If any skill blocks** (self-verify fails, investigation escalates, security
   finding), stop and report. Don't silently skip.

5. **Learn from each run** — log operational discoveries to `docs/learnings/`

Decision classification examples:

| Decision | Classification | Why |
|----------|---------------|-----|
| Database column naming | Mechanical | Follow existing conventions |
| REST vs GraphQL for new API | Taste | Both viable, P0 picks based on research |
| Whether to add authentication | User | Scope-changing, irreversible |
| Which CSS framework | Taste | P0 researches, picks, documents |
| Whether to ship or descope a feature | User | Business decision |
| NO-SHIP kill decision | User | Always surfaced, never silent |

## Repository Mode Gate
