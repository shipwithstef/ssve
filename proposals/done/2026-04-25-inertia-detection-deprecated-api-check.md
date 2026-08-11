# Framework Evolution — 2026-04-25 — Inertia Detection: Catch "extending legacy code" during planning

## The triggering example (concrete)

In example-marketplace session 2026-04-25 the agent shipped WI-108/109/110 extending two backend functions (`placesDetailsLookup`, `placesNearbyLookup`) that use Google Places **legacy API** (`maps.googleapis.com/maps/api/place/...`). The agent never asked "should we migrate to Places API New (v1) instead of extending legacy?" — even though:

1. Google has explicitly deprecated those endpoints with a sunset track
2. The original WI-108 design doc referenced "Places v1 API"
3. The agent's own EV cost model used v1 SKU pricing ($0.020/req Pro)
4. The new v1 has cleaner field-masking, better ergonomics, and the only API Google adds new features to

The agent saw legacy code, mirrored its style, and added more legacy callers. **Inertia.** When the user asked "why not migrate just to the new?" the agent had no good answer — the migration is ~2-3h of work and would have eliminated downstream tech debt. The agent simply never paused to ask the question.

This is a generic anti-pattern, not a Google-Places-specific one.

## The generic anti-pattern

**Inertia: extending code without checking whether the underlying foundation is the right one to build on.**

Sub-patterns that share this shape:

| Sub-pattern | Real-world example | Cost of inertia |
|---|---|---|
| Extending code that uses a deprecated API | This session: legacy Places API | Forced migration in 12-24 months under deadline pressure |
| Adding a Nth caller to an already-deprecated component | Adding consumer to old `<Modal>` when codebase migrated to `<Dialog>` | Migration becomes O(N callers) instead of O(1) |
| Mirroring a legacy state-management pattern | Adding `connect(mapStateToProps)` when codebase migrated to hooks | Ratchet of legacy patterns; harder to fully migrate later |
| Adding to a 1500-LOC file instead of decomposing | Bug fix on `secureOperation/entry.ts` that's 30KB | Continued violation of file-size discipline; reviewer fatigue |
| Reaching for a "we'll migrate later" placeholder one more time | Adding another `TODO: migrate to v2` comment | The "later" never arrives because each individual addition is small |
| Implementing a feature on an internal-only API marked "preview" | Building on undocumented Base44 endpoint | Endpoint changes break us silently |
| Adding tests using a deprecated test runner | Adding Jest tests when codebase migrated to Vitest | Two test runners to maintain |

The user's gut sense ("why are we on legacy though?") is the discipline the framework should encode mechanically.

## What the agent should have done

At the moment of writing the FIRST line of code that called a deprecated API, the agent should have:

1. **Detected** that the file/function/pattern being extended is on a deprecation track
2. **Surfaced** a one-line decision to the user: *"This file uses `maps.googleapis.com/maps/api/place/...` (legacy, deprecated). Recommended migration target: `places.googleapis.com/v1/...`. Estimated migration cost: ~2-3h. Continue with legacy [shorter PR, more debt] OR migrate first [longer PR, no debt]?"*
3. **Logged** the decision (whichever way) in `pipeline-decisions.jsonl` with `type: taste`
4. **Documented** in WI artifact: "extends legacy API by deliberate choice — migration filed as WI-N"

It cost zero brain cycles to do this. The agent just didn't have a checkpoint that fired here.

## Proposed fix

### F-A. P0 — `references/deprecated-foundations.json` registry

A curated, project-local + framework-shared registry of deprecation signals:

```json
{
  "external_apis": [
    {
      "id": "google-places-legacy",
      "match_patterns": [
        "maps\\.googleapis\\.com/maps/api/place/",
        "from\\s+['\"].*google-places\\b"
      ],
      "successor": {
        "id": "google-places-v1",
        "url_pattern": "places.googleapis.com/v1/",
        "docs": "https://developers.google.com/maps/documentation/places/web-service/op-overview"
      },
      "sunset_status": "deprecated",
      "sunset_eta_months": "12-24",
      "migration_size_hint": "small",
      "added_to_registry": "2026-04-25",
      "discovered_during": "WI-108-finish session"
    }
  ],
  "internal_patterns": [
    {
      "id": "old-modal-component",
      "match_patterns": ["import\\s+.*Modal\\s+from"],
      "successor": {"id": "shadcn-dialog", "match_patterns": ["import\\s+.*Dialog\\s+from"]},
      "sunset_status": "soft-deprecated",
      "migration_size_hint": "callsite-by-callsite"
    }
  ],
  "size_limits": [
    {
      "id": "file-size-discipline",
      "kind": "file-loc",
      "match_patterns": [".*\\.(ts|tsx|js|jsx)$"],
      "soft_limit_loc": 800,
      "action_when_extending": "warn",
      "rule_ref": "rules/common/code-review.md#file-size-discipline"
    }
  ]
}
```

The registry is the canonical source of "things you should ask about before extending."

### F-B. P0 — PreToolUse hook `svc-inertia-check.mjs`

```javascript
// matcher: Edit|Write
// Read TOOL_INPUT.file_path + TOOL_INPUT.content
// For each entry in deprecated-foundations.json:
//   if file_path matches AND new_content references deprecated pattern:
//     emit BLOCKING message:
//       [svc-inertia-check] PAUSE: extending file ${file} which uses ${entry.id}
//       (deprecated, sunset_eta_months=${eta}). Successor: ${successor.id}.
//       Migration size hint: ${size_hint}.
//       To continue:
//         (a) write a 1-line decision in .svc/pipeline-decisions.jsonl with
//             type=taste, decision=extend-on-${entry.id}-because-X, OR
//         (b) file a follow-on WI for the migration with link to this current WI
//             AND set SVC_INERTIA_ACK=${entry.id} in env, OR
//         (c) migrate first (recommended).
```

Hook fires BEFORE the edit lands. The agent must make a decision; can't just slide forward.

### F-C. P0 — `design-tech` and `plan-changeset` skills scan the registry

When `design-tech` produces an architecture-options table, it MUST surface (as Pillar-level concern):

> ⚠️ This design extends `<deprecated-foundation-id>`. Predecessor migration alternative: `<successor-id>`, est `<size>`. Decision-as-Synthesis section MUST address why extending vs migrating.

Same for `plan-changeset`'s Risk Register — entries where the manifest touches deprecated foundations must include "deprecation-debt" as a row.

### F-D. P1 — Periodic registry refresh skill

Vendor deprecations don't ping us. New entries land in vendor changelogs we never read.

`scripts/refresh-deprecation-registry.mjs`:
- Scans vendor changelogs (Google Maps, Stripe, Supabase, Base44, etc.) using already-installed `research` skill primitives
- Adds new entries to `deprecated-foundations.json` with proposed match patterns
- Runs monthly via SessionStart prompt or external cron

### F-E. P1 — Auto-scan codebase on first hit

When the inertia hook fires for a foundation NOT yet in the registry, agent runs:
```bash
grep -rn "<inferred match>" --include="*.{ts,tsx,js,jsx}" .
```
And adds the count of existing callers to the warning message:
> ⚠️ This API is used in 17 other places. Migrating means O(17) caller updates.

Drives the "let's migrate now while it's 2 callers, not 17" decision.

### F-F. P2 — Memory promotion

When user catches an inertia mistake (like this session), automatically promote a memory entry of the form:
```
feedback_check_deprecation_before_extending.md (confidence: bumped per occurrence)
"Before adding code that uses an external API or internal pattern, grep
for deprecation/sunset/legacy markers in vendor docs OR project comments.
If found, surface migration option to user before mirroring the legacy
choice."
```

Tier-1 validator: if user message contains "why" + "legacy/deprecated/old" markers, AND the agent committed code touching matching pattern in last 30 minutes, write the memory entry automatically.

## Where the check fires (3 levels)

| Level | When | Cost | Catches |
|---|---|---|---|
| 1. Plan time | `design-tech` + `plan-changeset` scan registry while authoring | 5 sec | 80% — most cases |
| 2. Edit time | PreToolUse hook on Edit|Write checks file path + content | 100ms | The 20% that slip past planning |
| 3. Review time | `audit-implementation` checks final diff against registry | 30 sec | The "how did this get here" cases |

All three must exist; any one alone leaks.

## Comparison delta

- ESLint plugins like `eslint-plugin-deprecation` exist for type-level deprecation. The framework adds: (a) pattern-level (URLs, file paths, not just types), (b) cross-language, (c) connection to migration-cost estimation.
- gstack and superpowers don't have an equivalent inertia-check.
- The closest svc skill is `evolve-framework` — but that runs on framework code, not on project code being shipped.

## Effort estimate

| # | Item | Hours |
|---|---|---|
| F-A | Initial `deprecated-foundations.json` (seed entries: google-places-legacy, jest-vs-vitest, react-class-vs-hooks, etc.) | 1.5 |
| F-B | `svc-inertia-check.mjs` PreToolUse hook | 2 |
| F-C | `design-tech` + `plan-changeset` skills updated to scan registry | 1.5 |
| F-D | `refresh-deprecation-registry.mjs` (research-skill-driven) | 2 |
| F-E | Auto-scan codebase + caller-count warning | 1 |
| F-F | Memory promotion + tier-1 validator | 1 |
| **Total** | | **~9 hours** |

## Replay test

After implementation, replay the WI-108 session through the new hook:

1. Agent attempts to write `await fetch('https://maps.googleapis.com/maps/api/place/details/json?...')` → hook fires
2. Agent must either (a) log the decision OR (b) file migration WI OR (c) migrate
3. Confirms the inertia path is structurally blocked

## User actions required

1. Review this proposal
2. Approve / modify / reject
3. After approval: implement F-A + F-B first (highest leverage, ~3.5h), file as PR using framework discipline (worktree, plan-changeset, no self-merge)

## Note on this being the FOURTH proposal today

PRs merged earlier today: #26 (verification gates), #27 (12 operational findings), #28 (deterministic hooks). This is companion to #28 — adds a specific hook category (inertia-detection) the previous proposal didn't enumerate. Could be folded into #28's implementation if convenient; filed standalone for review independence.
