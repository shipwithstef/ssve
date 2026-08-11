# Framework Evolution — 2026-04-21

**Status:** P0 IMPLEMENTED 2026-04-21 (see `proposals/done/2026-04-21-framework-improvement-list-work-items.md`). P1-F006 (canonical WI schema across authoring skills) IMPLEMENTED 2026-04-21 (see `proposals/done/2026-04-21-framework-improvement-wi-schema.md`). P1-F005 (audit-coverage enforcement hook) and P2-F007 (general output-size rule in DOCTRINE) remain open.


## Method

Triggered by user complaint in example-marketplace session: "list-work-items is fully broken, doesn't differentiate between done and open items." Reproduced firsthand by invoking `/list-work-items` against `docs/specs/work-items/` (92 WI files). Output was 537KB; ~70/92 items rendered as `No subject / Priority: Low / Status: Ready` — including items with explicit `**Status:** VERIFIED` headers (WI-081, WI-087) and `**Status:** backlog` headers (WI-091).

Evidence sources read:
- `list-work-items/scripts/list_work_items.mjs` (the parser, 125 lines)
- 4 representative WI files: `WI-001.md`, `WI-081.md`, `WI-087.md`, `WI-091.md` from example-marketplace `docs/specs/work-items/`
- `FRAMEWORK-STATE.md` (only mention of list-work-items is the install-drift fix; no prior work on the parser itself)
- `proposals/` listing — no pending proposal addresses this

## Findings (by priority)

### P0 — Fix now (blocks quality)

#### F-001 — Parser ignores `**Status:**` field entirely; VERIFIED items pollute the "current backlog"

**Evidence:** `list-work-items/scripts/list_work_items.mjs:62`
```js
process.stdout.write(`**Status:** ${wi.dependencies.length > 0 ? 'Blocked by ' + wi.dependencies.join(', ') : 'Ready'}\n`);
```
Status is computed purely from dependency presence. The actual `**Status:**` line in every WI file (`VERIFIED`, `BASELINED`, `backlog`, `in-progress`, etc.) is never read. Confirmed:
- `docs/specs/work-items/WI-001.md:4` → `**Status:** VERIFIED` — script renders "Ready"
- `docs/specs/work-items/WI-081.md:5` → `**Status:** VERIFIED` — script renders "Ready"
- `docs/specs/work-items/WI-087.md:4` → `**Status:** VERIFIED` — script renders "Ready"

Direct user impact: roadmap decisions (`roadmap-evaluation`, `find-opportunity`) and any human reviewing the backlog cannot tell shipped from open work. The list overstates remaining work by an unknown but large multiple. This is the exact complaint that triggered this evolution run.

**Fix:**
1. Parse `**Status:** (.*)` from file body.
2. Treat `VERIFIED|DONE|CLOSED|BASELINED|SHIPPED` as "done" — exclude from default output, or render in a separate "Done" section after the open backlog.
3. Render the actual status string for open items (`backlog`, `in-progress`, `BLOCKED`, `READY`) instead of synthesizing one from dependencies.
4. Keep dependency-based blocking as a secondary signal: an item with `Status: backlog` AND unresolved dependencies → "Blocked by WI-X". An item with `Status: in-progress` → keep that label even if dependencies exist.
5. Add an `--include-done` / `--all` flag for the rare case the user wants the historical view.

#### F-002 — Subject regex assumes obsolete `# WI-NNN: title` format; ~70/92 items render as "No subject"

**Evidence:** `list-work-items/scripts/list_work_items.mjs:26`
```js
const subjectMatch = content.match(/# (WI-\d+): (.*)/);
```
This requires literal `# WI-NNN: ` with a colon. Real headers in production today:
- `WI-001.md:1` → `# WI-001: J29 remaining 20 AC E2E coverage` ← matches (colon form)
- `WI-081.md:1` → `# WI-081 — sop_friendly field missing from Location edit form (J30 producer gap)` ← em-dash, no match
- `WI-087.md:1` → `# WI-087 — LocationProfile SOP toggle click does not flip aria-checked (UI save-path blocker)` ← em-dash, no match
- `WI-091.md:1` → `# Voice-Driven Deal & Event Generation` ← no WI-NNN at all (capture-idea skill output), no match

Result observed in this session: WI-016a/b/c/d, WI-021–025, WI-027, WI-032, WI-034–058, WI-060–088 all show "No subject."

**Fix:** Use a tolerant regex that accepts `:`, `—`, `-`, `–`, or pure-title forms:
```js
// Try labeled form first
let m = content.match(/^# (WI-[\w-]+)[\s:—–-]+(.+)$/m);
if (!m) {
  // Fall back to first H1, use filename as ID
  m = content.match(/^# (.+)$/m);
  if (m) m = [null, id, m[1]];
}
```

#### F-003 — Priority regex looks for `**Priority:**` but new WIs use `**Severity:**`; everything defaults to Low

**Evidence:** `list-work-items/scripts/list_work_items.mjs:27`
```js
const priorityMatch = content.match(/\*\*Priority:\*\* (.*)/);
```
Sampled WI files use `**Severity:** medium` / `**Severity:** low` (WI-001:5, WI-081:4, WI-087:6, WI-091:5). None of the 4 sampled files have a `**Priority:**` line. Default branch at `:74` returns weight `1` (Low), so every modern item collapses to Low and the topological sort effectively becomes file-order.

**Fix:** Match either field, prefer Severity for newer files:
```js
const priorityMatch = content.match(/\*\*(?:Priority|Severity):\*\* (.*)/i);
```
Treat `critical|high|medium|low` case-insensitively (existing weight function already does this).

#### F-004 — Output is ungrokkable: 92 items × full description = 537KB; defeats the purpose of a "list" command

**Evidence:** Reproduced this session — `node list_work_items.mjs > out.txt; wc -c out.txt` → 537,711 bytes. Per-item rendering (`:60-65`) emits the full body between `**Dependencies:**` and `**Revenue connection:**`, which on modern WIs (no `**Dependencies:**` line) falls through to `content.split('\n').slice(5).join('\n')` — i.e., almost the entire file. Two-tool-call pattern observed: invoke skill → output truncated → grep file separately to actually read it. The skill is producing data the user can't consume.

**Fix:** Two output modes:
1. **Default — table mode**: one line per WI: `WI-NNN | status | priority | one-line subject` truncated to 100 chars. Designed to fit ~92 items in a single screen / single tool result.
2. **`--detail <WI-NNN>` mode**: dump the full body for one item.
3. Drop the per-item description from the default output entirely. If the user wants the body, they read the file.

### P1 — Fix soon (degrades quality)

#### F-005 — `**Dependencies:**` field doesn't exist in modern WIs; topological sort is a no-op

**Evidence:** `list-work-items/scripts/list_work_items.mjs:28, 84-117`. None of WI-001/081/087/091 contain a `**Dependencies:**` line; `parseDependencies` returns `[]` for all of them, so `visit()` walks each item with no children and the order collapses to whatever `prioritySorted` produces (currently all-Low → file-system order).

This is partially upstream of write-spec/capture-idea: those skills don't emit a Dependencies field. Two ways to fix:
- (a) Detect dependency-like phrasing in `Related:` / `Blocks:` / `Depends on:` lines (WI-081 has `**Related:** J30 (...), P8 (...)` and `**Follow-up:** WI-081-followup`).
- (b) Update `write-spec` / `capture-idea` SKILL.md to require `**Dependencies:**` in the WI template, then enforce it via audit-coverage.

Recommend (b) — schema enforcement is more durable than parser heuristics. File this as a follow-up WI in svc itself, not just a parser patch.

#### F-006 — No schema contract for WI files; every author skill emits a different shape

**Evidence:** Compare the four sampled headers:
- `WI-001` (`onboard-repo`): `# WI-NNN: title`, has `**Status: VERIFIED**`, `**Priority:** ...`-shaped fields, has `**Source Skill:**` / `**Source Artifact:**`
- `WI-081` (filed by drift hunt): `# WI-NNN — title`, `**Status:**`, `**Severity:**`, `**Filed:**`, `**Closed:**`, `**Source:**`, `**Related:**`, `**Follow-up:**`
- `WI-087` (filed by E2E gate): same shape as WI-081
- `WI-091` (`capture-idea`): no WI-NNN in heading at all, `**Type:**`, `**Status: backlog**`, `**Severity:**`, `**Lane: TBD**`, `**Source: capture-idea**`, `**Captured: ...**`

There is no canonical `work-item-schema.md` in `references/`. Every authoring skill invented its own format, and `list-work-items` was written against the first one. This is the root cause of F-001/F-002/F-003 — fixing the parser only patches symptoms.

**Fix:** Create `references/work-item-schema.md` with required + optional fields and accepted formats. Have `audit-coverage` flag WI files that don't conform. Have authoring skills (`onboard-repo`, `capture-idea`, `write-spec`, `diagnose-bug`, `validate-feature`) reference the schema.

### P2 — Improve when possible

#### F-007 — Skill output should respect the host's tool-result truncation limit

The 537KB output triggered Claude Code's "output too large" persisted-file fallback this session. Other svc list/audit skills should also be checked for this — a skill whose output is auto-truncated is a skill the orchestrator can't reason about. Suggest a shared rule in DOCTRINE: "List/audit skills MUST keep default output under 25KB; gate detail behind a flag."

### P3 — Track (not actionable yet)

(none new this run)

## Comparison delta

Not relevant for this run — the bug is svc-internal and competitor frameworks don't have an equivalent local-WI listing skill to compare against.

## Stale proposal audit

- `2026-04-14-blocking-discovery-halt-protocol.md` — not reviewed this pass (out of scope)
- `2026-04-14-parallel-wi-dispatch.md` — not reviewed this pass (out of scope)
- `2026-04-19-evolution.md` — not reviewed this pass (predecessor evolution proposal)
- `2026-04-20-session-audit-capture-idea-wrong-repo.md` — relevant to F-006: capture-idea is one of the skills emitting non-conforming WI files. If it's already in flight, fold the schema-conformance requirement in.

## Next step

P0 items F-001 through F-004 are a single ~30-line patch to `list_work_items.mjs` plus a schema-tolerance pass on the regexes. Should be one `improve-framework` pass. P1 items F-005 and F-006 need a small downstream change (WI-template schema doc + audit hook) and should be filed as a separate framework WI.
