# Framework Evolution — 2026-04-12 — Test-Framework Mode Viability

## Method

Question: are the non-static test-framework modes (`live`, `autopilot`, `comparison`, `fixture`, `skill-test`)
actually meaningful and end-to-end viable?

Evidence read:
- `test-framework/SKILL.md` — mode definitions and documented expectations
- `test-framework/scripts/run-all.sh` — the live/static implementation
- `test-framework/evals/tier-2/` — fixture/scenario implementation
- `test-framework/evals/tier-3/` — judge implementation
- `test-framework/results/autopilot-S1/analysis.md` — prior autopilot run record
- `test-framework/results/2026-04-04-comparison/methodology-usage-audit.md` — prior comparison run record
- `FRAMEWORK-STATE.md` — no existing findings on this topic

---

## Findings

### P0 — `live` mode is a stub, not a capability

**Category:** Gap  
**File:** `test-framework/scripts/run-all.sh:75–125`

The skill's mode table says `live` = "spins up server from generated code + runs QA against it."
The actual script does: check whether `/tmp/svc-test-raw`, `/tmp/svc-test-svc`, or `/tmp/svc-test-server`
already exist, then hit `localhost:3000`. It cannot generate code. It cannot start a server.
It is a post-hoc probe of a server left over from a prior comparison run.

If you run `bash scripts/run-all.sh --include-live` on a clean machine, the test immediately
prints `SKIP No test server found` and exits clean. This is a false pass — it passed because
nothing ran, not because the pipeline worked.

**Fix:** Either (a) implement live mode properly (worktree → plan-changeset → land-changeset →
`npm install && npm start` → probe), or (b) rename the flag to `--probe-existing-server` and
update the skill's mode table to accurately describe what it does. The current name implies a
capability that doesn't exist.

---

### P0 — `autopilot` loop stalls at land-changeset

**Category:** Gap  
**File:** `test-framework/results/autopilot-S1/analysis.md:11–33`

The S1 autopilot run (2026-04-03, 19/19 skills executed) shows:

| Skill | Status |
|---|---|
| plan-changeset | REAL — 41-file manifest produced |
| land-changeset | SIMULATED |
| verify-promotion | SIMULATED |
| sync-spec-code | SIMULATED |
| test-journeys | SIMULATED |
| write-e2e | SIMULATED |

Skills 13–17 (the "did it actually work?" half of the pipeline) were all simulated
because no real codebase exists. The autopilot skill doc requires a running server to complete:

> Phase 7 produces FULL runnable code (all 8 parts) … npm start … wait for http://localhost:3000

That step has never succeeded in any autopilot run on record. The three-way comparison
(svc vs obra vs raw) was never executed as part of autopilot. `autopilot-S1` ran the first
half of the loop (vision → code manifest) but the second half (running server → tests →
comparison → self-improvement) has no evidence of completion.

**Fix:** Either (a) actually implement the `npm install && npm start` step in autopilot
and make code generation produce a startable app (requires real package.json, real
entry point, no import stubs), or (b) document the current "autopilot" as covering
skills 1–12 only ("doc-phase autopilot") and separately track the "full autopilot" as
a future capability. The skill currently claims the full loop is the standard.

---

### P1 — `comparison` fairness constraint makes it un-automatable

**Category:** Drift  
**File:** `test-framework/SKILL.md:98–102` (fairness rules)  
**Evidence:** `test-framework/results/2026-04-04-comparison/methodology-usage-audit.md`

The skill's fairness rules say:
> "Each approach MUST be run in the FOREGROUND as a sequential conversation, not as a background Agent."

This is correct for quality — background agents can't do `AskUserQuestion` so they bypass
all interactive skills. The 2026-04-04 comparison confirms it: gstack received a VERDICT
of **UNFAIR** (0/10 skills invoked; the agent wrote code directly). The superpowers approach
also likely had the same problem (no record of `brainstorming` or `writing-plans` being
invoked via the Skill tool).

But the skill also says comparison can be triggered via the test-framework command — implying
it's an automated mode. These two constraints are irreconcilable: you can't run comparison
mode as a foreground sequential conversation AND as an automated test-framework invocation.

**Fix:** Add a clear note to comparison mode: "This mode requires manual orchestration —
it cannot be run via automated script. Each approach must be a foreground conversation."
Remove the implicit automation framing from the mode table entry. Comparison is a
methodology, not a test runner.

---

### P1 — `fixture` mode is documented but not implemented

**Category:** Gap  
**File:** `test-framework/SKILL.md:~280–340` (Fixture Mode section)

The SKILL.md describes:
```
test-framework/evals/tier-2/
  fixtures/
    vision-minimal.md
    spec-with-8-acs.md
    plan-with-5-tasks.json
  test-write-spec.sh
  test-plan-changeset.sh
  test-chain-vision-spec-journeys.sh
```

None of these files exist. What actually exists in `tier-2/` is:
- `run-tier2.sh` — runs `claude -p` with a full skill prompt and checks file assertions
- `scenarios/*.md` — 8 LLM-driven scenario evals (write-vision-create.md, write-spec-greenfield.md, etc.)
- No `fixtures/` directory

The tier-2 runner is LLM-driven (requires `claude` CLI, ~50K tokens/scenario) — the
opposite of the "canned input, structural assertion" pattern the skill describes as "fixture."
True fixture tests should be deterministic and cheap. What's implemented is LLM-in-the-loop.

This is not wrong — LLM-driven scenario evals are useful — but calling them "fixture mode"
creates a false impression. The "chain fixture" value proposition (vision → spec → journeys
catch skill-to-skill drift without an LLM call) doesn't exist yet.

**Fix:** Either (a) implement real fixture files for at least one chain (vision → spec),
or (b) rename the current tier-2 mode to `scenario` in the skill's mode table and document
the `fixtures/` pattern as a future capability. Don't claim tier-2 validates "without LLM"
when the runner requires an LLM.

---

### P2 — `skill-test` mode has no infrastructure

**Category:** Gap  
**File:** `test-framework/SKILL.md` (mode table entry for `skill-test`)

The mode table entry: "Single skill, multiple variants, real output required."
No script, no runner, no directory structure exists for this. It's a mode entry
with no backing implementation.

**Fix:** Either implement it or remove it from the mode table. If the intention is
to use tier-2 scenarios as the skill-test mechanism, say that explicitly.

---

### P2 — `run-all.sh` is not reachable from the skill's documented command

**Category:** Drift  
**File:** `test-framework/SKILL.md` mode table (`static` row: `bash scripts/run-all.sh --static-only`)

`run-all.sh` is at `test-framework/scripts/run-all.sh` but the skill
says the command is `bash scripts/run-all.sh`. When run-all-evals.sh was used today,
the correct path was `test-framework/evals/run-all-evals.sh --tier1`.

The skill conflates two different runners:
- `test-framework/scripts/run-all.sh` — the suite runner (live/static, checks a `$PROJECT`)
- `test-framework/evals/run-all-evals.sh` — the tier eval runner (tier1/tier2/tier3)

The `static` mode entry in the mode table invokes the wrong one for the documented purpose
("pipeline integrity, cache measurements, doctrine checks"). The tier-1 evals are what
actually do doctrine checks.

**Fix:** Clarify the mode table — `static` should reference `run-all-evals.sh --tier1`.
Add a second static mode entry or note for `run-all.sh --static-only` if that suite
(spec-as-index, cache sharing) is also worth exposing.

---

## Summary Table

| Mode | Documented claim | Actual state | Gap severity |
|------|-----------------|--------------|-------------|
| `static` | Structure checks, <30s | WORKS — 9 scripts, 3,893 assertions | None |
| `live` | Spins up server from code | Probes pre-existing server only | P0 |
| `autopilot` | Full loop, running app, 3-way compare | Stalls at skill 13, no running app ever recorded | P0 |
| `comparison` | 3 approaches, fair methodology test | Works manually; automated = unfair; structural conflict in docs | P1 |
| `fixture` | Canned input, cheap deterministic assertions | LLM-driven scenario evals (≠ fixtures) | P1 |
| `skill-test` | Single skill, multiple variants | No implementation exists | P2 |

## Comparison delta

Not applicable — this analysis is about test infrastructure, not product feature gaps.

## Stale proposal audit

No prior proposals on test-framework mode viability. This is a new finding set.
