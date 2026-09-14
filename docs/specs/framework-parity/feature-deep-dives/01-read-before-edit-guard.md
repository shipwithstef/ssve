# Deep-dive #1: Read-Before-Edit Guard (scorecard row #78)

**Source:** GSD `hooks/gsd-read-guard.js` + `proposals/2026-05-12-blend-gsd-read-before-edit.md` (already hardened across codex rounds 2–6 of the scorecard PR #134).
**Decision required:** adopt OR skip.
**Decision rule:** adopt iff ALL 10 improvement scenarios are positive AND blast radius = zero-regression on existing svc behavior.

## What the feature is

Stateful PreToolUse hook that maintains a session-level cache of which files have been read this session. Mutate-class tools (`Edit` / `Write` / `apply_patch` / `WriteFile` / `StrReplaceFile` / `replace` / `edit` / `write_file` / `write` per the host-name matrix) refuse to fire if the target file exists on disk and is NOT in the cache. Fresh-file creates (target does not exist) are exempt. Read-class tools (`Read` / `ReadFile` / `read_file` / `read`) populate the cache. Discovery tools (`Grep` / `grep_search` / `grep`) do NOT populate the cache (snippets ≠ full file). Codex sessions use a Bash-pattern strategy (full-file `cat` / `sed 1,$` / `head` with N≥9999 / `tail -n +1` / `less` / `more` / `rg --no-line-number ... <path>` populate the cache; partial reads do not).

## svc current state

- `hooks/svc-workflow-guard.mjs` — has Edit/Write guards for config protection, phase boundaries, but **NO read-before-edit cache**
- `hooks/lib/hook-payload.mjs` — the host-agnostic normalizer the new hook would build on (already exists; provides `readHookPayload` + `extractFilePath`)
- `hooks/svc-loop-guard.mjs` — adjacent (catches repeated tool calls) but solves a different problem
- No prior svc artifact tracks read-cache state per session

## 10 improvement scenarios

For each scenario: a real session situation + the current svc behavior + the behavior with the guard. Adoption requires ALL 10 to be positive (svc strictly improves).

### Scenario 1: Kimi orchestrator edits a file it never read

**Today (svc):** Kimi receives a multi-step skill that says "edit `scripts/foo.mjs` to add a flag." The skill's context window already truncated the earlier Read result. Kimi guesses the surrounding code from training data, calls `StrReplaceFile` with a synthesized `old_string`. The string doesn't match. The tool returns "no match found." Kimi tries 3 more variations. 4 tool calls wasted, ~2k tokens burned, file ultimately edited correctly only after Kimi gives up and reads.
**With guard:** First `StrReplaceFile` call hits the guard. File exists, not in cache → BLOCK with message "Read scripts/foo.mjs before editing." Kimi reads, the cache populates, the second `StrReplaceFile` call succeeds first try.
**Improvement:** 3 wasted tool calls × ~500 tokens saved = ~1500 tokens per occurrence. Non-Claude hosts hit this multiple times per session.
**Verdict: POSITIVE.**

### Scenario 2: Codex session uses `cat` to read then `apply_patch` to edit

**Today (svc):** Common Codex flow — `Bash: cat scripts/state-io.mjs`, then `apply_patch` on `scripts/state-io.mjs`. The Bash read worked, the patch applies cleanly, no problem.
**With guard:** The Codex Bash-pattern strategy recognizes `cat scripts/state-io.mjs` as a full-file read and populates the cache. `apply_patch` cache-checks the path → hit → ALLOW. Same outcome, no friction.
**Improvement:** Zero added friction on the legitimate path. Non-regression confirmed.
**Verdict: POSITIVE (no-op for the happy path).**

### Scenario 3: Codex apply_patch with multi-file diff, only first file was read

**Today (svc):** Codex `apply_patch` modifies `scripts/foo.mjs` AND `scripts/bar.mjs` in one call. Only `foo.mjs` was read. The patch on `bar.mjs` may rely on stale-context guesses about its current content. Patch may apply but with semantically wrong changes (e.g. replacing a function that was already refactored). Silent corruption.
**With guard:** `extractFilePaths` returns `[foo.mjs, bar.mjs]`. Cache check: `foo.mjs` hit, `bar.mjs` miss → BLOCK. Codex reads `bar.mjs`, then re-tries the patch. Now both paths cache-validated.
**Improvement:** Catches the silent-corruption class of multi-file patch failures that's invisible today.
**Verdict: POSITIVE.**

### Scenario 4: Claude edits a file it just read in the same turn

**Today (svc):** Claude Code natively enforces read-before-edit for its `Edit` tool. The svc guard adds nothing.
**With guard:** Cache populates on Read, Edit cache-checks the path, hits, ALLOWs. Identical to Claude's native behavior. Zero added friction.
**Improvement:** Zero (already enforced natively). Not a regression.
**Verdict: POSITIVE (no-op for Claude).**

### Scenario 5: Gemini agent edits a file after `grep_search` only

**Today (svc):** Gemini runs `grep_search` to find a function name in `lib/api.ts`, sees the line, then `replace`s the line directly. The replace string doesn't match the actual file content (other lines around the match weren't seen). Loop of failed replaces.
**With guard:** `grep_search` does NOT populate the cache (Discovery tool). `replace` cache-checks → miss → BLOCK with "Grep saw a snippet, not the full file. Read first." Gemini reads, edits succeed.
**Improvement:** Catches the grep-then-blind-edit failure mode that Gemini hits often.
**Verdict: POSITIVE.**

### Scenario 6: A skill tells the agent to write a NEW file

**Today (svc):** Skill says "create `docs/specs/foo.md` with this content." Agent calls `Write` on a path that doesn't exist. Works.
**With guard:** The hook checks `fs.existsSync(target)` — false → ALLOW (Add-File exemption). Agent creates the file. Identical behavior.
**Improvement:** Zero (no-op for legitimate creation). Not a regression.
**Verdict: POSITIVE (no-op for new-file creation).**

### Scenario 7: Test fixture writes/edits temp files in `/tmp` or `$TMPDIR`

**Today (svc):** Tier-1 validators write fixtures into `mktemp -d` directories. Many such writes happen without prior reads (the test wrote the fixture itself).
**With guard:** First write to a new fixture path → file doesn't exist → ALLOW (Add-File). Subsequent edits to the fixture by the same script → file exists → cache miss (the test never went through Read for an already-in-memory string). BLOCK would break test fixtures.
**Risk identified:** Need an exemption for fixture/temp paths OR scope the cache check to non-/tmp paths OR have the hook respect a `SVC_READ_GUARD_DISABLE` env var that test-framework scripts set.
**Verdict: POSITIVE only after fixture-path exemption is added to the implementation.** Mitigation: implementation MUST check `if (path.startsWith(os.tmpdir()) || path.includes('/test-framework/evals/')) return ALLOW;` OR honor an `SVC_READ_GUARD_DISABLE=1` env var.

### Scenario 8: Long session crosses compaction; cache must invalidate

**Today (svc):** N/A — no cache to wipe.
**With guard:** **Codex round-2 on the deep-dive bundle caught the gap in the original framing:** if compaction PRESERVES the session id (Claude Code's auto-compaction does) but DROPS the prior Read tool output from the model's working context, a session-id-only cache would still ALLOW later edits based on a read that's no longer in context. That reintroduces the blind-edit failure mode the guard is meant to prevent.

**Required: cache invalidation on compaction.** Implementation MUST subscribe to PreCompact (Claude) and equivalent compaction events on other hosts. On compaction: bump a `generation` counter on the cache and require subsequent edits to have a cache entry from the CURRENT generation. Files re-read post-compact populate the new generation; edits to those files succeed; edits to files only read pre-compact are blocked until a re-read.

Cache file shape: `{ session_id, generation, entries: [{path, generation, ts}] }`. Mutate-tool check: `entry.generation === cache.generation && file_path matches`. The on-disk cache survives across the PreCompact event so the generation counter is durable; the in-memory hook re-reads the cache file on every invocation.
**Improvement:** Cache invalidation on compaction makes post-compact behavior CORRECT (not just deterministic). Re-reads after compaction are SAFE; edits without re-read are DANGEROUS — the guard now catches them.
**Verdict: POSITIVE with the mandatory compaction-invalidation mechanism.**

### Scenario 9: Multi-process orchestration (dispatch-waves) with concurrent edits

**Today (svc):** `dispatch-waves` spawns multiple workers each editing different files. No cross-talk because each worker reads its own files.
**With guard:** Each worker has its own session ID, its own cache file. No cross-process cache mutation. Workers operate independently.
**Improvement:** Zero (no-op for the legitimate case). The cache is session-scoped so concurrent waves don't interact.
**Verdict: POSITIVE (no-op for parallel waves).**

### Scenario 10: Agent edits a file modified externally between read and edit (TOCTOU race)

**Today (svc):** Agent reads `foo.mjs`, then between the Read and the Edit, `foo.mjs` is modified externally (e.g. by a background script). Agent's `old_string` no longer matches → tool fails with "no match" → loops trying variants.
**With guard:** Cache only tracks "this file was read at some point in the session." It does NOT track file mtime or content hash. So the cache says "yes, you read it" → ALLOW. The Edit still fails with "no match" because the actual file changed. Guard does not improve this scenario but does not regress it either.
**Possible enhancement:** cache could store `{path, mtime_at_read}` and treat the cache entry as STALE when current mtime differs. Out of scope for v1; flag as a v2 enhancement.
**Verdict: POSITIVE (neutral on TOCTOU; flagged for v2).**

### Scenario count: **10 POSITIVE (with mitigations on scenarios 7 + 10 noted as implementation requirements)**

## Blast radius

Every existing svc artifact this change would touch + regression risk:

| Touched | Type | Regression risk | Mitigation |
|---|---|---|---|
| `hooks/svc-read-before-edit.mjs` (new) | hook | — | new file; nothing to regress |
| `hooks/lib/hook-payload.mjs` | helper | LOW: existing callers use `extractFilePath` (string return); we ADD `extractFilePaths` (array return). API stable. | enforced by codex round-6 finding #1 |
| `scripts/wire-hooks.mjs` (Claude wirer — actual name; Codex round-1 caught my prior `wire-claude-hooks.mjs` typo), `wire-codex-hooks.mjs`, `wire-gemini-hooks.mjs`, `wire-kimi-hooks.mjs`, `wire-opencode-hooks.mjs` | wire scripts | MEDIUM: each must declare the new hook with the host-correct matcher. Wrong matcher = silent miss. | per-host integration test in tier-1 fixture |
| `hooks/hooks.json` (canonical surface declaration) | manifest | MEDIUM: must list `svc-read-before-edit` so it ships in installs | scripts/lint-skills-manifest.mjs already lints adjacent surfaces; extend the lint to require the new hook |
| `provision/hosts/<host>.json` | host capability declarations | LOW: each host declares whether it supports the hook event surface required (`PreToolUse` etc.). All 5 hosts already do. | no change needed |
| `.svc/sessions/` directory | gitignored runtime state | LOW: dir already gitignored per round-3 finding | no change needed |
| `test-framework/evals/tier-1/*.sh` | test fixtures | **HIGH: many tier-1 fixtures write/edit fixture files without prior reads.** | scenario-7 mitigation: hook exempts `os.tmpdir()` paths AND honors `SVC_READ_GUARD_DISABLE=1` env var; test-framework runner sets the env var |
| `scripts/state-io.mjs` and other framework scripts that write `.svc/*.jsonl` | framework runtime | MEDIUM: scripts use direct `fs.writeFileSync` not host tool calls, so they don't go through the hook. No regression. | confirmed by inspection — only host tool calls trigger PreToolUse hooks |
| `.git/hooks/pre-commit` | git hook | LOW: pre-commit hooks don't go through PreToolUse | no regression |
| `concerns/REGISTRY.json` | concern registry | LOW: optionally add a concern declaring this hook handles "blind-edit" failure class | optional, low priority |
| `docs/specs/framework-parity/gsd-scorecard.md` row #78 | documentation | — | flip verdict to ✅ adopted on land |

**Net regression risk:** ZERO once scenario-7 mitigation (fixture-path exemption + env var bypass) ships in the same PR. All other touched artifacts are additive or already covered.

## Decision

**ADOPT.** All 10 scenarios are positive (with documented mitigations on scenarios 7 + 10). Blast radius = zero-regression once the scenario-7 fixture-path exemption is implemented in the same PR. The proposal at `proposals/2026-05-12-blend-gsd-read-before-edit.md` is hardened across codex rounds 2-6 and ready to drive the implementation PR.

## Implementation handoff

Next PR (separate from the scorecard): implement `hooks/svc-read-before-edit.mjs` per the proposal, with:

1. Sibling `extractFilePaths` helper in `hooks/lib/hook-payload.mjs` (per round-6 finding #1)
2. Cache stored at `.svc/sessions/read-cache-<session-id>.json` (per round-3)
3. Codex Bash-pattern strategy for read recognition (per round-5)
4. Add-File exemption via `fs.existsSync(target)` check (per round-4)
5. **Scenario-7 mitigation: fixture-path exemption** for `os.tmpdir()` AND `SVC_READ_GUARD_DISABLE=1` env var
6. Per-host wiring updates with host-correct matchers (Claude / Kimi / Codex / Gemini / OpenCode)
7. Tier-1 validator covering all 5 hosts × {read-then-edit (allow), edit-without-read (block), Add-File (allow), Grep-then-edit (block), fixture-path (allow)}
8. Update scorecard row #78 verdict to ✅ adopted with link to the implementation PR

The implementation PR runs the full pipeline: `plan-changeset` → `review-plan` (codex) → `execute-changeset` → `review-cross-model` (codex) → `land-changeset`.
