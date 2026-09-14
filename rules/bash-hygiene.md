# Bash Hygiene

## No Background for Short Commands

Never use `run_in_background` for commands that complete in under 30 seconds (Node.js scripts, SDK calls, quick checks). Use foreground Bash with `timeout: 15000` instead. Background tasks leave orphan processes the user has to manually clean up.

## Background = Your Responsibility to Clean Up

If you DO use `run_in_background` (for builds, full test suites, long deploys), you OWN the cleanup. After reading the output, kill the process if it's still running. Don't leave stale background tasks for the user to discover.

## `until` Wait Loops MUST Be Bounded

Any `until ! pgrep -f "X"; do sleep N; done` pattern is a zombie generator if `X` never exits. The wait loop runs forever, the harness keeps reporting it as "running", and the user has to manually kill stale shells. Always bound the wait:

```bash
# ❌ Unbounded — zombies forever if target hangs
until ! pgrep -f "playwright test" >/dev/null; do sleep 8; done; tail -10 /tmp/log

# ✅ Bounded with kill-fallback
for i in {1..30}; do pgrep -f "playwright test" >/dev/null || break; sleep 8; done
pkill -9 -f "playwright test" 2>/dev/null || true
tail -10 /tmp/log
```

The bounded variant gives the target ~4 minutes to finish naturally, then kill-9s anything still alive. A reasonable upper bound for most operations.

If you genuinely need to wait longer than 5 minutes for a known-long task, use `Bash run_in_background: true` with the underlying command directly — let the harness manage the lifecycle. Don't wrap it in a synchronous `until` loop.

## Detecting and Cleaning Up Hung Probes

Long-running scripts that hang on SDK / network calls produce zombie processes that look "running" in the harness but make no progress. Detect them by:

```bash
# How long has each process been alive?
ps -eo pid,etime,cmd | grep -E "tsx probe|playwright test" | head
```

If a probe's `etime` exceeds 5x its expected runtime, it's hung. Kill -9 it without further investigation:

```bash
pkill -9 -f "tsx probe-rls" 2>&1 || true
```

When you start any background probe / test run, set yourself a mental budget: if you haven't seen output by 2x the expected runtime, kill and retry with explicit timeout / debugging. Don't let it accumulate into the next session's confusion.
