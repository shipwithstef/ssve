### Step 1.5: Check for Pending Proposals

Before gathering new evidence, check for actionable work already planned:

```bash
# List proposals, but skip any marked BLOCKED
# (a BLOCKED proposal has "**Status:** BLOCKED" in the first 20 lines)
for f in proposals/*.md; do
  [ -f "$f" ] || continue
  head -20 "$f" | grep -qE "^\*\*Status:\*\*\s*BLOCKED" && continue
  echo "$f"
done
```

Then run the proposal SLA gate before selecting work:

```bash
bash test-framework/evals/tier-1/validate-proposal-triage-sla.sh
```

The gate requires every direct `proposals/*.md` file that has reached the
`proposals/triage.json` `max_open_days` window to carry one disposition:
`accepted_wi`, `backlog_wi`, `rejected_reason`, or `deferred_until` metadata.
Use `backlog_wi` plus a reason for an open proposal already owned by a real WI;
this records unfinished work and never authorizes dispatch or overrides a freeze.
Do not combine it with another disposition. Use `accepted_wi` only for formal
promotion with the existing archive, residual-map, and ledger closeout. Metadata may
live in the proposal body or in `proposals/triage.json`. `proposals/done/` is
outside the open-proposal SLA because implemented proposals belong there.

Before selecting a `backlog_wi` proposal, read that WI and its dependencies.
Preserve freezes and explicit do-not-dispatch instructions. A backlog pointer
is not a new execution authorization; follow the current task scope and priority.
Do not start an unrelated backlog item merely because its proposal is present.

If applicable pending (non-BLOCKED) proposals exist (blend plans, evolution proposals, improvement records
not yet implemented), they ARE the evidence — skip Step 2 and Step 3 and route
directly to Step 5 (Pick Implementation Route).

A pending proposal means a previous skill (blend-external, evolve-framework)
already did the analysis and diagnosis. Re-diagnosing is wasted work. Implement
the plan that's already there.

**Proposal lifecycle statuses:**
- `DRAFT` or no status — actionable, pick up in Step 1.5
- `BLOCKED` — intentionally held; skip in Step 1.5. A BLOCKED proposal states why it's blocked (open scope question, waiting on user decision, waiting on upstream work) in a "Why BLOCKED" section. It stays in `proposals/` (not moved to `done/`) until unblocked. To unblock: remove the `**Status:** BLOCKED` line.
- `IMPLEMENTED` — move to `proposals/done/` per Step 6b.

**Placeholder rules audit (lightweight):**
While scanning pending work, also check for stale placeholder rules:

```bash
python3 -c "
import json
m = json.load(open('skills-manifest.json'))
for e in m.get('rulesRegistry', {}).get('entries', []):
    if e.get('source') == 'local' and e.get('last_evaluated') is None:
        print('Placeholder rule:', e.get('path'))
"
```

If any placeholder rules are found, emit a one-line reminder in the output summary. They are not blocking — just visibility.

**If multiple pending proposals exist:** ask the user which to implement, or pick
the one most recently created.

**If only BLOCKED proposals exist:** treat as if no pending proposals — continue to Step 2.

**If no pending proposals exist:** continue to Step 2.
