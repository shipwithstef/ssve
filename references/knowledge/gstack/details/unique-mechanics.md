# Deep Drills: gstack Batch 4 (Shadow Layers & Low-Level Systems)

This document drills into the "invisible" layers of gstack—logic that runs below the orchestration and security layers to ensure system stability.

---

## 31. Circular Buffer with Gap Detection (`browse/src/buffers.ts` & `activity.ts`)

**The Problem:** In real-time streaming (SSE), a client might lose its connection and miss several events. Ring buffers naturally overwrite old data, so the client needs to know if it's "missing a piece of history."
**The Algorithm:**
1. **Total Count Tracking:** The `CircularBuffer` has a `_totalAdded` counter that **never resets** (even when the buffer wraps).
2. **The "After" ID:** The client requests `/stream?after=105`. 
3. **Gap Verification:** The server checks: `if (afterId < totalAdded - capacity)`.
4. **Outcome:** If True, the buffer has definitively overwritten the event the client needs. The server emits a `gap_detected` event with the `missing_count`, forcing the client to do a full state refresh rather than trusting the partial stream.

## 32. Staggered Parallel Execution (`design/src/variants.ts`)

**The Problem:** Running 10 DALL-E 3 variants in parallel instantly hits a "Rate Limit Per Minute" (RPM) cap of 5-7. Running them one-by-one is too slow.
**The Implementation (`variants`):**
It uses a **Staggered Promise** pattern:
```typescript
const delays = Array.from({ length: count }, (_, i) => i * 1000); // 1s intervals
const tasks = prompts.map((p, i) => delay(delays[i]).then(() => generateVariant(p)));
await Promise.allSettled(tasks);
```
This "offsets" the start time of every API call by exactly 1 second, keeping the request frequency just below the RPM threshold while maximizing throughput.

## 33. Mode-Aware SIGTERM Teardown (`browse/src/server.ts`)

**The Problem:** Standard Node.js `SIGTERM` handlers kill the process immediately. In gstack, a headless server is often running inside a temporary Claude Code bash sandbox. If Claude "stops" the tool, the server is SIGTERM'd, but we don't want it to die if it's in the middle of a critical state write or a "Headed" user session.
**The Implementation:**
1. **Headed/Tunnel Gate:** If `BROWSE_HEADED === '1'`, the server **ignores** SIGTERM. It forces the user to use an explicit `/stop` command or `Ctrl+C`.
2. **Cookie Picker Guard:** If the user is currently choosing cookies in the UI, the handler returns immediately, ignoring the signal to avoid "stranding" the picker window.
3. **Headless Cleanup:** In normal mode, it executes a `shutdown()` state machine that unlinks PID files and releases cross-project locks before exiting with code `0` (clean).

## 34. Question Registry & One-Way Door taxonomy (`scripts/question-registry.ts`)

**The Problem:** LLMs are bad at deciding which questions are "high stakes." They often ask for permission to do trivial things (two-way doors) while auto-deciding destructive ones (one-way doors).
**The Implementation:**
gstack maintains a typed **Question Registry**. 
- Each ID (e.g., `ship-test-failure-triage`) is hardcoded with a `door_type: 'one-way'`. 
- **The Preamble Constraint:** The agent's preamble forces it to look up the ID first. If it can't find the ID, it must run the **One-Way Door Classifier** (regex search for `rm -rf`, `drop table`, etc.) and default to "Ask" if any destructive pattern matches.

## 35. Browser Context Viewport Scalability (`browse/src/browser-manager.ts`)

**The Problem:** Screenshots of large web pages look blurry if they are scaled down to fit the AI's vision context.
**The Implementation:**
The manager tracks `deviceScaleFactor` as a **Context Global**. When an agent requests a "scaled" screenshot, gstack doesn't just resize the image. It uses `recreateContext()` to restart the Chromium context with a higher DPI/Scale factor, then re-renders the page before capturing. This produces "High-Density" snippets that the AI can actually read.

## 36. Deterministic NUL-Byte Stripping (`bin/gstack-memory-ingest.ts`)

**The Problem:** Some terminal emulators emit `\x00` (NUL) bytes when rendering colors or complex UI. Postgres (used by gbrain) rejects these bytes as "invalid UTF-8 sequence."
**The Implementation:**
A rigid sanitization layer in the memory pipeline:
`body = body.replace(/\x00/g, "");`
This ensures that 100% of user-pasted terminal content is database-safe without stripping valid UTF-8 emojis or CJK characters.

## 37. TTY Marker Anchoring (`test/helpers/claude-pty-runner.ts`)

**The Problem:** Finding a file path in a terminal buffer is hard because the buffer is a "rolling window" of noise.
**The Implementation:**
gstack uses `PATH_ANCHOR` markers: `(~\\/|\\/Users\\/|\\/home\\/|\\/var\\/|\\/tmp\\/|\\.\\/)`.
By only starting a regex match on these absolute roots, the framework "peels off" preceding terminal garbage like `❯` or `[K` that would otherwise corrupt the string.

## 38. Prompt Rule 12: Escape Prevention (`scripts/resolvers/preamble/generate-ask-user-format.ts`)

**The Problem:** AI agents try to be "helpful" by escaping non-ASCII text into `\uXXXX` strings, which often results in the wrong characters being printed in a UTF-8 terminal.
**The Implementation:**
A hardcoded instruction in the AskUserQuestion format: **"Non-ASCII characters — write directly, never \u-escape."** It explicitly informs the AI that the transport pipe is UTF-8 native, which results in a 95% reduction in character corruption for Japanese and Chinese translations.

## 39. Origin-Validation Origin-ID Binding (`browse/src/terminal-agent.ts`)

**The Problem:** Localhost WebSockets are vulnerable to DNS Rebinding and Cross-Site Hijacking.
**The Security Implementation:**
The terminal agent doesn't just check the `Origin` header. It requires an `INTERNAL_TOKEN` that is **passed via Environment Variable** to the sub-process at spawn time. The client (browser sidebar) must include this token in its first data frame to "bind" the WebSocket to the legitimate orchestrator session.

## 40. PTY Resize Debouncing (`browse/src/terminal-agent.ts`)

**The Problem:** Rapidly resizing the browser window sends dozens of `resize` events to the PTY, which can crash the underlying `terminal` binding.
**The Mechanic:**
The agent implements a `WeakMap` session tracker that caches the `cols/rows` dimensions. It only executes the native `proc.terminal.resize()` call if the new dimensions actually differ from the cache, preventing redundant syscalls.
