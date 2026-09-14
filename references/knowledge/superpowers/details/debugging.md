# superpowers — Debugging & Techniques Details

## systematic-debugging (4-phase process)

### Phase 1: Root Cause Investigation
- Read errors completely, reproduce consistently
- Check recent changes (git log, git diff)
- **Layer-by-layer diagnostic instrumentation** — the highest-value technique:
  - Add logging at EACH component boundary (what enters, what exits)
  - Run once to gather evidence across all layers simultaneously
  - THEN analyze — don't guess between runs
- Trace data flow backward from symptom to source

### Phase 2: Pattern Analysis
- Find working examples of similar behavior
- Compare working vs. broken
- Identify exactly what's different

### Phase 3: Hypothesis
- Single hypothesis at a time
- Minimal test to verify/falsify
- One variable at a time
- **3+ failed fixes → question architecture** (not try fix #4)

### Phase 4: Implementation
- Failing test first (invokes TDD skill)
- Single fix targeting root cause
- Verify fix resolves original symptom

### Iron Laws
- NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
- Claims: "15-30 min systematic vs. 2-3 hrs random, 95% first-fix rate"

### Human Partner Signal Translation
| Signal | Meaning |
|---|---|
| "Stop guessing" | Return to Phase 1 |
| "Have you tried..." | Phase 2 pattern analysis |
| "What's your theory?" | Phase 3 hypothesis |

## root-cause-tracing.md

**5-step backward trace:**
1. Observe symptom
2. Find immediate cause
3. Ask "what called this?"
4. Trace up call chain
5. Find where invalid value originated → fix at source

**Real example:** empty `projectDir` → git init in wrong location → traced
through call chain → source was missing parameter at origin

**Key rules:**
- NEVER fix just the symptom
- Add stack trace instrumentation when manual tracing fails
- Use `console.error` not logger in tests (loggers may be mocked)
- Log BEFORE operation, include directory/cwd/env/timestamp
- After finding source: add defense-in-depth (4 layers)

## defense-in-depth.md

**4-layer validation after finding root cause:**

| Layer | Purpose | Example |
|---|---|---|
| Layer 1: Entry | Reject invalid input at API boundary | Type check, empty string check |
| Layer 2: Business Logic | Validate data makes sense for operation | Path normalization, range check |
| Layer 3: Environment Guard | Refuse dangerous ops in specific contexts | `if (NODE_ENV === 'test')` with path check |
| Layer 4: Debug Instrumentation | Capture context for forensics | Structured error with full context |

**Key insight:** "Single validation: 'We fixed the bug'. Multiple layers: 'We made the bug impossible'"
Different paths bypass different layers — all four are necessary.

## condition-based-waiting.md

**Replace arbitrary `setTimeout`/`sleep` with condition polling:**

```typescript
async function waitFor(condition, description, timeoutMs = 5000) {
  const start = Date.now();
  while (!(await condition())) {
    if (Date.now() - start > timeoutMs) throw new Error(`Timeout: ${description}`);
    await new Promise(r => setTimeout(r, 10)); // 10ms poll interval
  }
}
```

**Quick reference:**
| Scenario | Pattern |
|---|---|
| Wait for event | `waitFor(() => events.length > 0, 'event received')` |
| Wait for state | `waitFor(() => component.state === 'ready')` |
| Wait for count | `waitFor(() => items.length >= 3, '3 items')` |
| Wait for file | `waitFor(() => fs.existsSync(path))` |
| Complex condition | `waitFor(() => a.ready && b.connected)` |

**Anti-patterns:**
- Polling too fast (1ms) — wastes CPU
- No timeout — hangs forever
- Stale data (caching value before loop)

**Legitimate arbitrary timeout:** First wait for triggering condition, THEN wait based on
known timing (e.g., debounce interval). Document why with comment.

**TypeScript implementations provided:** `waitForEvent`, `waitForEventCount`, `waitForEventMatch`
— all use 10ms polling with descriptive timeout errors.

## find-polluter.sh

**Bisection script for test pollution:**
- Takes file/dir to check and test pattern
- Runs each test file individually
- Checks if pollution appears after each run
- Stops at first polluter with diagnostic output
- Uses `npm test` per-file execution

## Pressure Test Scenarios

Three scenarios specifically target the three highest-probability rationalization paths:

### test-pressure-1.md — Emergency
- $15k/minute loss, production down
- Forces A/B/C choice between systematic (35+ min) vs. quick retry (5 min)
- Tests: time pressure + authority + economic stakes

### test-pressure-2.md — Sunk Cost
- 4 hours debugging, 8pm, dinner plans, 6 failed attempts
- Tests: sunk cost + exhaustion + social plans

### test-pressure-3.md — Authority
- Senior engineer + tech lead present, everyone wants call to end
- Tests: deference to authority + social pressure

**These require "choose and act" — not hypothetical responses.**

## Analysis — What's valuable for svc

The layer-by-layer diagnostic instrumentation pattern is directly applicable to
the investigate skill. The 3-fixes stopping rule provides a concrete escalation
point. The condition-based waiting patterns would improve E2E test reliability.
The pressure testing methodology could strengthen test-framework skill evals.

## L4 Pointers

- Phase process: `skills/systematic-debugging/SKILL.md`
- Tracing: `skills/systematic-debugging/root-cause-tracing.md`
- Defense layers: `skills/systematic-debugging/defense-in-depth.md`
- Waiting patterns: `skills/systematic-debugging/condition-based-waiting.md` + `condition-based-waiting-example.ts`
- Polluter detection: `skills/systematic-debugging/find-polluter.sh`
- Pressure tests: `skills/systematic-debugging/test-pressure-{1,2,3}.md`
- Creation process: `skills/systematic-debugging/CREATION-LOG.md`
