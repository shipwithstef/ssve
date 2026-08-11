# GSD-2 Built-in Agents and Extension System

## Mechanism

### Built-in Agents (`/tmp/gsd-2/src/resources/agents/`)

All agents are YAML-frontmatter markdown files with a system-prompt body. Frontmatter fields: `name`, `description`, optional `model`, optional `tools`, optional `conflicts_with`.

| Agent | File | Model | Key Constraints |
|-------|------|-------|-----------------|
| **worker** | `worker.md` | — (default) | Full capabilities, isolated context. **Must not** spawn subagents or orchestrate. Output format: `## Completed`, `## Files Changed`, `## Notes`. |
| **planner** | `planner.md` | `sonnet` | Outputs plans, **never code**. Conflicts with: `plan-milestone`, `plan-slice`, `plan-task`, `research-milestone`, `research-slice`. Plan quality criteria: every step references specific files/functions; dependencies explicit; trade-offs stated; risks flagged. |
| **reviewer** | `reviewer.md` | `sonnet` | Structured code review with severity ratings (Critical / High / Medium / Low) and concrete fixes. Verdict: `APPROVE` / `REQUEST_CHANGES` / `NEEDS_DISCUSSION`. |
| **researcher** | `researcher.md` | — | Web researcher using Brave Search. Tools: `search-the-web`, `bash`, `capture_thought`, `memory_query`, `gsd_graph`. Output: `## Summary`, `## Key Findings` (with URLs), `## Sources`. |
| **debugger** | `debugger.md` | `sonnet` | Hypothesis-driven bug investigation: Reproduce → Hypothesize (2-3) → Investigate → Narrow → Root cause (file:line) → Fix. Investigation tools: read source, grep, git blame, read tests, run tests. |

**Routing guard in worker:**
- The worker explicitly stops if the task looks like "GSD orchestration, planning, scouting, parallel dispatch, or review routing" and tells the caller to use the appropriate specialist agent instead.
- Forbidden self-initiated calls: `gsd_scout`, `subagent`, `launch_parallel_view`, `gsd_execute_parallel`.

### Skill Telemetry (`/tmp/gsd-2/src/resources/extensions/gsd/skill-telemetry.ts`)

Tracks which skills are loaded per execution unit (#599).

**Data flow:**
1. `captureAvailableSkills()` — reads skill directories (`~/.agents/skills/`, `~/.claude/skills/`, legacy `~/.gsd/agent/skills/`) and records all available skill names into `availableSkills[]`.
2. `recordSkillRead(skillName)` — called when a `SKILL.md` is read; adds to `activelyLoadedSkills` Set.
3. `getAndClearSkills()` — returns actively-loaded skills if any exist, else falls back to available skills; clears both stores.

**Stale-skill detection:**
- `getSkillLastUsed(units)` — builds a Map of skill → most recent `finishedAt` timestamp from unit metrics.
- `detectStaleSkills(units, thresholdDays)` — compares installed skills against last-used timestamps; returns skills not used within the threshold.
- Threshold is configurable via `skill_staleness_days` preference (default 60 per gitbook).

**Skill health dashboard commands:**
- `/gsd skill-health` — overview table
- `/gsd skill-health <name>` — detailed view
- `/gsd skill-health --stale 30` — skills unused 30+ days
- `/gsd skill-health --declining` — falling success rates

### Memory Ingest (`/tmp/gsd-2/src/resources/extensions/gsd/memory-ingest.ts`)

Four entry points for turning raw content into `memory_sources` rows:

| Function | Input | Kind |
|----------|-------|------|
| `ingestNote(note, ctx, opts)` | Inline text string | `"note"` |
| `ingestFile(path, ctx, opts)` | Local file path | `"file"` |
| `ingestUrl(url, ctx, opts)` | HTTP URL (fetched, HTML stripped) | `"url"` |
| `ingestArtifact(basePath, milestoneId, artifactType, ctx, opts)` | Named milestone artifact (e.g. `LEARNINGS`, `SUMMARY`) | `"artifact"` |

**Key behaviors:**
- All four functions are safe to call without an LLM — they still persist the source row.
- Default `maxBytes = 256 * 1024`; content is truncated with an ellipsis marker.
- Deduplication happens via `createMemorySource()` (implementation not read), which sets `duplicate: true` on hash match.
- If `opts.extract !== false` and an `ExtensionContext` is provided, `maybeExtract()` calls `buildMemoryLLMCall(ctx)` and then `extractMemoriesFromTranscript()`.
- `summarizeIngest(result)` produces a human-readable string: `"Ingested <kind> \"<title>\" as <id> (duplicate|new source, N memories applied)"`.

### Memory Extractor (`/tmp/gsd-2/src/resources/extensions/gsd/memory-extractor.ts`)

Background LLM extraction from session transcripts. Fire-and-forget, never blocks auto-mode.

**Concurrency & rate limiting:**
- Mutex guard `_extracting` boolean.
- `MIN_EXTRACTION_INTERVAL_MS = 30_000`.
- Skip conditions: unit types `complete-slice`, `rewrite-docs`, `triage-captures`; activity files < 1KB; already-processed units.

**Secret redaction:**
- 10 regex patterns in `SECRET_PATTERNS` covering: generic API keys/tokens, AWS AKIA keys, GitHub tokens, Stripe keys, JWTs, private keys, Bearer tokens, npm tokens, Anthropic keys, OpenAI keys.
- `redactSecrets(text)` runs all patterns with `[REDACTED]` replacement before LLM ingestion.

**LLM call builder (`buildMemoryLLMCall`):**
- Queries `ctx.modelRegistry.getAvailable()`.
- Prefers Haiku by ID substring; falls back to cheapest by input cost.
- Resolves API key via `modelRegistry.getApiKey()` to support OAuth tokens (Claude Max / Pro).
- Calls `@gsd/pi-ai`'s `completeSimple()` with `maxTokens: 2048`, `temperature: 0`.
- Exposes `apiKeyReady` promise on the returned function for test determinism.

**Extraction prompt (`EXTRACTION_SYSTEM`):**
- Categories: `architecture`, `convention`, `gotcha`, `preference`, `environment`, `pattern`.
- Actions: `CREATE`, `UPDATE`, `REINFORCE`, `SUPERSEDE`, `LINK`.
- Link relations: `related_to`, `depends_on`, `contradicts`, `elaborates`, `supersedes`.
- Rules: no one-off bug fixes, no duplicates, 1–3 sentences per memory, confidence 0.6–0.95, empty array `[]` if nothing worth remembering.

**Transcript parsing (`extractTranscriptFromActivity`):**
- Reads JSONL activity logs.
- Extracts only `role === 'assistant'` entries.
- Handles both array content blocks (`{type: 'text', text: string}`) and direct string content.
- Hard cap at 30,000 chars.

**Response parsing (`parseMemoryResponse`):**
- Strips markdown fences (` ```json ... ``` `).
- Validates action types and required fields; silently drops malformed items.
- Returns `[]` on any parse failure.

### Compaction Snapshot (`/tmp/gsd-2/src/resources/extensions/gsd/compaction-snapshot.ts`)

Writes a ≤2KB markdown digest of durable project state before context compaction.

**API:**
- `buildSnapshot(sources, opts)` — pure, no I/O. Tiers: (1) active context, (2) top memories by rank, (3) recent `gsd_exec` runs (failures highlighted). Guaranteed ≤ `opts.maxBytes` (default 2048).
- `writeCompactionSnapshot(baseDir, opts)` — writes to `.gsd/last-snapshot.md`. Returns `{path, bytes, memories, execRuns}`.
- `readCompactionSnapshot(baseDir)` — reads back the snapshot or returns `null`.

**Sources fed into `buildSnapshot`:**
- `memories`: from `getActiveMemoriesRanked(12)` (safe-wrapped).
- `execHistory`: from `listExecHistory(baseDir)` (safe-wrapped).
- `activeContext`: optional free-form string (e.g. active unit ID).

**Truncation:** `enforceByteCap(input, maxBytes)` walks backwards from the byte budget and appends `"\n…[truncated]"`.

### Rethink (`/tmp/gsd-2/src/resources/extensions/gsd/rethink.ts`)

Conversational project reorganization. Dispatches a prompt that turns Claude into a reorganization assistant.

**Entry point:** `handleRethink(args, ctx, pi)`
- Blocked if `isAutoActive()` returns true.
- Builds a snapshot via `buildRethinkData()` containing: summary stats (complete/active/pending/parked counts), execution-order table with slice progress, dependency validation violations.
- Loads a prompt template via `loadPrompt("rethink", {rethinkData, existingMilestonesContext, commitInstruction})`.
- Sends as a hidden message (`display: false`) with `triggerTurn: true` via `pi.sendMessage()`.

**Commit instruction logic:**
- If `.gsd/` is gitignored → "Do not commit planning artifacts"
- Else → instructs a manual `git add .gsd/ && git commit`

### Undo (`/tmp/gsd-2/src/resources/extensions/gsd/undo.ts`)

Three undo primitives:

| Function | Scope | Behavior |
|----------|-------|----------|
| `handleUndo(args, ctx, pi, basePath)` | Last completed unit | Reverts git commits, deletes summary artifacts, unchecks task in PLAN.md. Parses activity log filenames (`<seq>-<unitType>-<unitId>.jsonl`). Requires `--force`. |
| `handleUndoTask(args, ctx, pi, basePath)` | Single task | Sets DB status to `"pending"`, deletes task summary, re-renders plan checkboxes. Accepts `T01`, `S01/T01`, or `M001/S01/T01`. Resolves missing parts via `deriveState()`. |
| `handleResetSlice(args, ctx, pi, basePath)` | Single slice | Resets all tasks to `"pending"`, slice to `"active"`, deletes task/slice/UAT summaries, re-renders plan + roadmap checkboxes. |

**Git commit detection (`findCommitsForUnit`):**
- Scans activity JSONL for `tool_result` blocks containing commit SHAs.
- SHA regex: `/\[[\w/.-]+\s+([a-f0-9]{7,40})\]/g`.
- Reverts via `nativeRevertCommit()`; on conflict calls `nativeRevertAbort()`.

**Plan unchecking (`uncheckTaskInPlan`):**
- Regex: `/^(\s*-\s*)\[x\](\s*\**<tid>\**[:\s])/mi`
- Replaces `[x]` with `[ ]` and writes atomically via `atomicWriteSync()`.

## Analysis

- **Agent specialization is enforced at the prompt level.** The worker has an explicit routing guard; the planner has a `conflicts_with` list and a "never code" rule. This is a lightweight role-based access control (RBAC) implemented purely in system prompts.
- **Memory system is fully decoupled from execution.** Ingest persists sources regardless of LLM availability; extraction is fire-and-forget with mutex/rate-limit guards so it cannot stall auto-mode. The secret-redaction layer is comprehensive (10 patterns) but regex-based and therefore not cryptographically guaranteed.
- **Skill telemetry distinguishes "available" vs "actively loaded."** This is a subtle but important signal: if the agent read a skill, report that; otherwise report what was in the prompt. Stale detection uses a 60-day default but is configurable.
- **Compaction snapshot is inspired by `mksglu/context-mode`.** The 2KB hard cap ensures the snapshot fits in even tight context windows. The tiered construction (active context → memories → exec history) is a priority-ranked truncation strategy.
- **Rethink is explicitly interactive-only.** It is blocked during auto-mode because it requires a conversation with the user to reorder/park/unpark milestones. The prompt is sent as a hidden message (`display: false`) — the UI shows the effect, not the raw prompt.
- **Undo has three granularities:** unit-level (git + files + plan), task-level (DB + file + plan), slice-level (DB + all tasks + all files + plan + roadmap). The `--force` requirement on all three prevents accidental destructive actions.

## L4 Pointers

- **Agent model assignments:** Only `planner`, `reviewer`, and `debugger` specify `model: sonnet`. The worker and researcher use the default model. There is no dynamic model routing at the agent level — that lives elsewhere (e.g. `dynamic-model-routing` preference).
- **Memory store internals not read:** `memory-store.js` (functions: `getActiveMemories`, `applyMemoryActions`, `decayStaleMemories`, etc.) and `memory-source-store.js` (`createMemorySource`) were not in the read set. Their schema and persistence mechanism (SQLite? JSONL? File?) are unknown.
- **LLM call dependency:** `buildMemoryLLMCall` depends on `@gsd/pi-ai`'s `completeSimple()` and `@gsd/pi-coding-agent`'s `ExtensionContext.modelRegistry`. This ties the memory subsystem to the GSD plugin architecture.
- **Secret redaction gaps:** The regex list does not cover all secret formats (e.g. no Google Cloud service-account keys, no Azure keys). It also operates on the raw transcript string before JSON parsing, which means it may redact false positives inside code blocks.
- **Undo git commit extraction fragility:** `findCommitsForUnit` looks for SHAs inside `tool_result` content blocks with a bracket-prefix regex. If the agent formats commit output differently (e.g. without brackets), the SHA will not be found and the revert will skip it.
- **Native git bridge not read:** `native-git-bridge.js` (used by undo for `nativeRevertCommit` / `nativeRevertAbort`) and `atomic-write.js` were not read. Their error semantics and atomicity guarantees are unverified.
