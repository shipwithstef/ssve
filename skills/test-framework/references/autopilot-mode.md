# Autopilot Mode — detail

Moved verbatim from SKILL.md (progressive disclosure).

### The Loop

```
LOOP:
  1.  PICK scenario (start with S1, or auto-suggest based on gaps)
  2.  OPEN worktree from main
  3.  RUN all pipeline skills in pipeline order
      - Phase 7 produces FULL runnable code (all 8 parts)
      - land-changeset writes files into the worktree
  4.  START server
      - cd into worktree
      - npm install (or equivalent)
      - npm start (or node src/index.js)
      - Wait for http://localhost:3000 to respond
      - If server fails to start: fix the code, re-run Phase 7, try again (max 3 attempts)
  5.  TEST live
      - sync-spec-code against actual source files in the worktree
      - test-journeys against the live server
      - write-e2e generates AND RUNS tests against localhost
  6.  COMPARE: obra approach
      - Open second worktree
      - Run brainstorm -> plan -> execute (parallel agents) -> running app
      - Same scenario, same ACs to measure against
  7.  COMPARE: raw approach
      - Open third worktree
      - Single prompt -> code -> running app
      - Same scenario, same ACs to measure against
  8.  MEASURE three-way delta
      - ACs satisfied (count per approach)
      - Edge cases handled (count per approach)
      - Token cost (total per approach)
      - Test coverage (lines/branches if measurable)
      - Time to running server (wall clock per approach)
  9.  FIND gaps in skills
      - Which skills produced weak output?
      - Which handoffs lost information?
      - Which ACs were missed?
  10. FIX: edit SKILL.md, re-run the skill, verify the fix
      - If the fix breaks something else, revert and try differently
      - Max 3 fix attempts per gap before flagging for human review
  11. COMMIT fixes with descriptive message
  12. SUGGEST next scenario based on coverage gaps
  13. CLOSE worktrees (merge or PR), clean up
  -> Repeat until completion criteria met or token budget exhausted
```

### What "Full Running App" Means

Phase 7 (plan-changeset) produces ALL 8 parts. Not just types. Not just a spec. The change set IS the codebase.

| Part | Contents | Required |
|------|----------|----------|
| `part-01-types` | TypeScript interfaces, enums, shared types | Yes |
| `part-02-data-model` | Database migrations, schema files, seed data | Yes |
| `part-03-tests-unit` | Unit tests written BEFORE implementation (TDD) | Yes |
| `part-04-services` | Backend business logic, domain services | Yes |
| `part-05-api-routes` | Route handlers, middleware, validation | Yes |
| `part-06-components` | Frontend components (if the scenario has UI) | If applicable |
| `part-07-tests-e2e` | Playwright E2E test files | Yes |
| `part-08-config` | package.json, tsconfig.json, docker-compose.yml, .env.example | Yes |

land-changeset writes ALL files into the worktree. Then:

```bash
cd /tmp/svc-test-{id}-svc
npm install
npm start &
# Wait for server
for i in $(seq 1 15); do
  curl -sf http://localhost:3000/health > /dev/null && break
  sleep 2
done
```

If the server does not start, that is a bug in the change set. Fix it:
1. Read the error output
2. Identify the failing file
3. Re-run plan-changeset for that part only
4. Try `npm start` again
5. Repeat up to 3 times. If still broken, log the failure with full error output.

### Multi-Approach Comparison

> **Orchestration requirement:** Comparison mode cannot be run as an automated script. Each approach must be a separate foreground conversation where the operator plays the user role. This is required for fairness — background agents bypass interactive skills entirely, producing an UNFAIR result (confirmed in the 2026-04-04 run: gstack received 0/10 skills invoked because the agent wrote code directly). If you cannot run three sequential foreground sessions, record the comparison as PARTIAL and note which approaches were run fairly.

Every scenario produces running applications from multiple approaches. The comparison is only valid if each approach uses its methodology's skills as designed.

#### Fairness Rules

Background agents CANNOT run interactive skills (AskUserQuestion, iterative review loops). Therefore:

1. **Each approach MUST be run in the FOREGROUND as a sequential conversation**, not as a background Agent. The operator plays the user role, answering skill questions naturally based on the scenario context.
2. **Every skill invocation MUST use the Skill tool**, not inline approximation. If an agent "brainstorms" without invoking `superpowers:brainstorming`, that is NOT a fair test of the superpowers methodology.
3. **Log every skill invoked** with: skill name, input summary (what was passed), output summary (what was produced), and whether the skill asked questions (and what the operator answered).
4. **If a methodology's skill cannot be invoked** (missing dependency, tool not available), record it as SKIPPED with reason — do not approximate it inline.

#### Approach Definitions

**Approach 1 -- Serious Vibe Coding (full 19-skill pipeline):**
- Run all pipeline skills in pipeline order using the Skill tool
- Each skill reads prior phase artifacts from the worktree
- Server runs on port 3000
- **Verification requirement:** Skills 14-18 (verify-promotion, sync-spec-code, test-journeys, write-e2e, analyze-marketing) MUST be run, not skipped

**Approach 2 -- gstack (office-hours + review pipeline):**
- Invoke `/office-hours` with the scenario prompt — answer the 6 forcing questions naturally
- Invoke `/design-consultation` to create DESIGN.md
- Invoke `/autoplan` OR `/plan-ceo-review` → `/plan-design-review` → `/plan-eng-review` sequentially
- Write code guided by the reviewed plan
- Invoke `/qa` against the running server
- Invoke `/review` on the diff
- Server runs on port 3001
- **Log:** Each skill invocation, what questions it asked, what the operator answered

**Approach 3 -- Obra/Superpowers (brainstorm-plan-execute):**
- Invoke `superpowers:brainstorming` — answer clarifying questions naturally, approve design
- Invoke `superpowers:writing-plans` with the brainstorm output
- Invoke `superpowers:test-driven-development` — write failing tests BEFORE implementation
- Invoke `superpowers:executing-plans` with the plan
- Invoke `superpowers:requesting-code-review` on the result
- Invoke `superpowers:verification-before-completion` before declaring done
- Server runs on port 3002
- **Log:** Each skill invocation and its output

**Approach 4 -- Raw (single prompt):**
- One prompt: "Build [scenario description]. Produce a complete, runnable Node.js application."
- No methodology, no phases, no review, no skills
- Server runs on port 3003

#### Universal Expectations (Phase 0)

BEFORE running any approach, derive a checklist of what a user who typed the scenario prompt would expect to see. This checklist must:
- Be derived ONLY from the user's sentence, not from any methodology's specs
- Include sub-items that are independently scorable (1 = met, 0 = not met)
- Cover: does it run, does it show the right data, does it do the core thing, does it address every explicit requirement in the prompt, is it usable on first visit
- Be written to `test-framework/results/{date}/phase-0-expectations.md` BEFORE any approach runs

#### Measurements (per approach)

| Metric | How to measure |
|--------|---------------|
| Universal score | Phase 0 checklist pass rate |
| Skills invoked | Count of methodology skills actually invoked via Skill tool |
| Skills skipped | Count of methodology skills not invoked, with reason |
| ACs satisfied | Check each AC from the svc spec against the running server |
| Vision-to-code traceability | Suite 9 score |
| First-time UX | Suite 8 pass/fail |
| Test coverage | Run unit tests, report pass/fail counts |
| Time to running server | Wall clock from first prompt to server responding |
| Code structure | Count files, modules, separation of concerns |
| Files produced | Total source files (src + views) |
| LOC | Lines of code in source files |

#### Methodology Usage Audit

After all approaches complete, produce `methodology-usage-audit.md` with:
- For each approach: recommended workflow (from that methodology's docs) vs actual workflow (what was invoked)
- Skill-by-skill table: recommended → invoked? → input → output
- Fairness verdict: FAIR / PARTIALLY FAIR / UNFAIR with explanation
- If any approach is UNFAIR, the comparison results for that approach carry a caveat

**Report format:** Side-by-side table in `comparison.json` and `comparison.md`. Include the methodology usage audit as a section. The comparison is only credible if the audit shows all approaches were fairly tested.
