# Manifest: WI-359 — wire-hooks variant-aware dedup + live settings cleanup + async observational hooks + latency/count validator

- **Feature spec:** `docs/specs/work-items/WI-359.md` (framework WI — the WI doc is the spec)
- **Branch:** `feature-wi-359-wire-hooks-dedup`
- **Status:** SIMULATED
- **Base branch / SHA:** `main` @ `f6f251ba` (origin-synced)
- **Created:** 2026-06-07T00:55Z
- **Lane:** framework (full mandatory chain; worktree at execution)
- **Archetype:** Incremental extension (extends the existing WI-076 dedup pass + migration block inside scripts/wire-hooks.mjs)

## Implementation Summary

Four coupled deliverables on the hook-wiring hot path:

1. **Argv-payload canonicalization (migration-pass extension):** strip stale `$TOOL_INPUT` payload tokens from svc hook commands during the existing migration block — the stdin-first contract (conf-10 learning, hooks/lib/hook-payload.mjs) makes them dead weight, and they create variant-class duplicates.
2. **Variant-aware dedup (dedup-v2):** after the WI-076 exact-string pass, collapse entries with identical `(matcher, per-hook [interpreter-stripped script basename | sorted bare-subcommands | sorted --flags])` identity. Canonical-keep = the entry WITHOUT payload tokens.
3. **Async observational hooks:** add `"async": true` to exactly 3 emitted entries — `svc-vibe-auditor` (PostToolUse), `svc-auto-capture-learnings` (PostToolUse `--trigger post-tool-use`), `svc-auto-capture-learnings` (Stop `--trigger stop`) — mirrored in `hooks/hooks.json`. Docs-verified 2026-06-07 (claude-code-guide agent, code.claude.com/docs/en/hooks): `async`/`asyncRewake` are command-hook entry-level fields; PostToolUse + Stop = SAFE; PreToolUse = NOT RECOMMENDED; no schema changes last 2 releases.
4. **Tier-1 validator + fixture:** hermetic fixture-driven validator proving collapse/survival/idempotency/count/async/backup properties via the existing `--settings <tmp>` flag.

Plus **safety rail:** timestamped backup + printed restore one-liner before ANY settings write (no backup mechanism exists today — grep-verified).

**Existing-implementation grounding (read 2026-06-07):**
- `isAlreadyWired` (wire-hooks.mjs:403+) per-hookId substring switch — the `svc-loop-guard` check matches ANY variant → never re-adds, stale variant survives forever.
- WI-076 generic dedup (wire-hooks.mjs:590-618) keys on `matcher + exact type:command` — variant-blind by design (its own comment says "exact command string").
- Live repro (captured to fixture): `PreToolUse Bash|Edit|Write|StrReplaceFile|Agent` carries BOTH `svc-loop-guard.mjs` with a `$TOOL_INPUT` payload token AND the bare form. Also one solo stale form: `svc-stop-quality.js --accumulate` with payload token.
- The 3 `svc-workflow-guard` variants (plain / `--phase-boundary` / `--bash-guard`) are intentional distinct hookIds — MUST survive.
- `eval-gate.mjs pre` vs `post` and `svc-stop-quality.js --accumulate` vs `--check` differ by bare subcommand / flag — MUST stay distinct (identity keeps bare non-`$` args + flags).
- Migration block (543-564) already rewrites RENAMED_FILES + CANONICAL_COMMANDS — canonicalization extends this block.
- Merge strips `id` before writing (582) — settings entries have no ids; identity must derive from commands.
- `--settings` + `--dry-run` + `--list-all` flags exist (453-461) — validator drives a tmp fixture copy hermetically.
- `svc-spec-index-update` exists ONLY in hooks.json registry (never emitted by buildHookEntries, absent from live settings) → its async mark is registry-doc intent only; NOT an emission change.
- `svc-edit-accumulator` EXCLUDED from async: its output file is read by the synchronous Stop-time `svc-stop-quality --check`; async accumulate could still be running at Stop → lost-record race. Correctness over latency.
- PreCompact `svc-auto-capture-learnings` stays sync (docs verdict did not cover PreCompact async semantics; compaction race risk).

**Invariants:** the 3 workflow-guard variants survive; `eval-gate pre`/`post` distinct; `stop-quality --accumulate`/`--check` distinct; kimi hook entries untouched; WI-076 pass untouched (dedup-v2 runs AFTER it); blocking semantics of all PreToolUse + Stop `--check` hooks unchanged; `hooks/hooks.json` stays the registry truth for count assertions.

## Files Planned

| # | File | Action | Task | Purpose |
|---|---|---|---|---|
| 1 | test-framework/evals/tier-1/fixtures/wire-hooks-variant-dup.json | CREATE | task-1 (TDD RED input) | Anonymized capture of the live duplicated settings (the real repro) |
| 2 | test-framework/evals/tier-1/validate-wire-hooks-variant-dedup.sh | CREATE | task-1 (TDD RED) | Fixture-driven validator: collapse/survival/idempotency/counts/async/backup |
| 3 | `scripts/wire-hooks.mjs` | MODIFY | task-2 (GREEN) | Canonicalization + dedup-v2 + async emission + backup-before-write |
| 4 | `hooks/hooks.json` | MODIFY | task-2 (GREEN) | Mirror async:true on exactly the 3 emitted observational entries (G2 F-006: spec-index-update dropped) |

**Tier-1 validator promotion note (per `rules/tier-1-promotion.md`):**
- `validator_path`: file 2 in Files Planned (tier-1 validator created under test-framework/evals/tier-1/)
- `failure_class`: hook-wiring duplicate accumulation / canonical-form drift in the global settings writer (measured live: duplicate loop-guard ≈91ms wasted on nearly every tool call; conf-10 learning records 37 historical duplicates)
- `promotion_signal`: signal 1 (same failure class observed repeatedly — learnings + this WI's live repro) AND signal 3 (hot path: wire-hooks runs on every install/setup; regression re-pollutes every session on the machine)
- `expected_runtime_budget`: <5s hermetic (tmp-copied fixture + two wire-hooks runs + JSON assertions; no network, no LLM, no live-settings dependency)
- `why_tier_2_or_targeted_is_insufficient`: the writer mutates GLOBAL machine state consumed by every session; silent re-pollution must surface on every validation run

## Changeset Blueprints

### 1. CREATE test-framework/evals/tier-1/fixtures/wire-hooks-variant-dup.json (full contents)

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "node /home/user/.claude/skills/hooks/svc-workflow-guard.mjs \"$TOOL_INPUT\"" }]
      },
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "node /home/user/.claude/skills/hooks/svc-workflow-guard.mjs \"$TOOL_INPUT\" --phase-boundary" }]
      },
      {
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "node /home/user/.claude/skills/hooks/svc-workflow-guard.mjs \"$TOOL_INPUT\" --bash-guard" }]
      },
      {
        "matcher": "Bash|Edit|Write|StrReplaceFile|Agent",
        "hooks": [{ "type": "command", "command": "node /home/user/.claude/skills/hooks/svc-loop-guard.mjs \"$TOOL_INPUT\"" }]
      },
      {
        "matcher": "Bash|Edit|Write|StrReplaceFile|Agent",
        "hooks": [{ "type": "command", "command": "node /home/user/.claude/skills/hooks/svc-loop-guard.mjs" }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write|StrReplaceFile",
        "hooks": [{ "type": "command", "command": "node /home/user/.claude/skills/hooks/svc-stop-quality.js --accumulate \"$TOOL_INPUT\"" }]
      },
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "node /home/user/.claude/skills/hooks/svc-vibe-auditor.js" }]
      },
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "node /home/user/.claude/skills/hooks/svc-auto-capture-learnings.mjs --trigger post-tool-use" }]
      }
    ],
    "Stop": [
      {
        "matcher": "*",
        "hooks": [{ "type": "command", "command": "node /home/user/projects/alpha/deploy.js" }]
      },
      {
        "matcher": "*",
        "hooks": [{ "type": "command", "command": "node /home/user/projects/beta/deploy.js" }]
      },
      {
        "matcher": "*",
        "hooks": [{ "type": "command", "command": "node /home/user/.claude/skills/hooks/svc-stop-quality.js --check" }]
      },
      {
        "matcher": "*",
        "hooks": [{ "type": "command", "command": "node /home/user/.claude/skills/hooks/svc-auto-capture-learnings.mjs --trigger stop" }]
      }
    ]
  }
}
```

(Fixture intent: PreToolUse rows 4+5 are the live loop-guard variant-pair → must collapse to ONE entry in canonical form. The two Stop `deploy.js` rows are DISTINCT user hooks sharing a basename across different paths — both MUST survive (T3-001 regression row). The 3 workflow-guard rows must survive as 3 — payload tokens stripped, flags intact. The `--accumulate` solo entry → canonicalized, NOT deleted. eval-gate/kimi rows intentionally absent — the merge step re-adds emitted hooks; count assertions run against post-merge output.)

### 2. CREATE test-framework/evals/tier-1/validate-wire-hooks-variant-dedup.sh (full contents)

```bash
#!/usr/bin/env bash
# validate-wire-hooks-variant-dedup.sh — Tier-1 validator for WI-359.
# Fixture-driven proof that wire-hooks.mjs canonicalizes argv-payload variants,
# collapses variant-class duplicates, preserves intentional flag-variants,
# emits async on observational hooks, is idempotent, and backs up before write.
# Promotion note: docs/plans/2026-06-07-wi-359-wire-hooks-dedup/manifest.md

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$REPO_ROOT" || exit 1

FIXTURE="test-framework/evals/tier-1/fixtures/wire-hooks-variant-dup.json"
WIRER="scripts/wire-hooks.mjs"
TMP="$(mktemp -d /tmp/wi359-dedup.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT
S1="$TMP/settings.json"
cp "$FIXTURE" "$S1"

PASS=0
FAIL=0
check() {
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then
    echo "  ✓ $label"; PASS=$((PASS+1))
  else
    echo "  ✗ $label"; FAIL=$((FAIL+1))
  fi
}

# jq-free JSON probe: q <event> <py-expr-over-entries> ; entries = settings.hooks[event]
q() {
  python3 - "$S1" "$1" "$2" <<'PY'
import json,sys
s=json.load(open(sys.argv[1]))
entries=s.get("hooks",{}).get(sys.argv[2],[])
cmds=[(r.get("matcher",""),h) for r in entries for h in r.get("hooks",[])]
print(int(eval(sys.argv[3])))
PY
}

echo "=== Tier 1: wire-hooks variant dedup (WI-359) ==="

env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE \
  node "$WIRER" --skills-path "$REPO_ROOT" --settings "$S1" > "$TMP/run1.log" 2>&1
check "wire run 1 exits 0" test "$?" = "0"

check "loop-guard collapsed to exactly 1" test "$(q PreToolUse "sum('svc-loop-guard.mjs' in h.get('command','') for _,h in cmds)")" = "1"
check "surviving loop-guard is canonical (no payload token)" test "$(q PreToolUse "sum('svc-loop-guard.mjs' in h.get('command','') and 'TOOL_INPUT' in h.get('command','') for _,h in cmds)")" = "0"
check "workflow-guard trio survived (3 entries)" test "$(q PreToolUse "sum('svc-workflow-guard.mjs' in h.get('command','') for _,h in cmds)")" = "3"
check "trio flag sets intact (plain+phase-boundary+bash-guard)" test "$(q PreToolUse "sum('svc-workflow-guard.mjs' in h.get('command','') and '--phase-boundary' in h.get('command','') for _,h in cmds) + sum('svc-workflow-guard.mjs' in h.get('command','') and '--bash-guard' in h.get('command','') for _,h in cmds)")" = "2"
check "no payload tokens on any svc hook" test "$(q PreToolUse "sum('TOOL_INPUT' in h.get('command','') for _,h in cmds)")" = "0"
check "accumulate entry survived canonicalized" test "$(q PostToolUse "sum('--accumulate' in h.get('command','') and 'TOOL_INPUT' not in h.get('command','') for _,h in cmds)")" = "1"
check "eval-gate pre+post both present (distinct identities)" test "$(q PreToolUse "sum('eval-gate.mjs pre' in h.get('command','') for _,h in cmds)")$(q PostToolUse "sum('eval-gate.mjs post' in h.get('command','') for _,h in cmds)")" = "11"
check "vibe-auditor is async" test "$(q PostToolUse "sum('svc-vibe-auditor' in h.get('command','') and h.get('async') is True for _,h in cmds)")" = "1"
check "capture-learnings PostToolUse is async" test "$(q PostToolUse "sum('svc-auto-capture-learnings' in h.get('command','') and h.get('async') is True for _,h in cmds)")" = "1"
check "capture-learnings Stop is async" test "$(q Stop "sum('svc-auto-capture-learnings' in h.get('command','') and h.get('async') is True for _,h in cmds)")" = "1"
check "stop-quality --check stays synchronous" test "$(q Stop "sum('--check' in h.get('command','') and h.get('async') is True for _,h in cmds)")" = "0"
check "backup created + restore line printed" bash -c "ls \"$TMP\"/settings.json.svc-backup-* >/dev/null 2>&1 && grep -q 'restore:' \"$TMP/run1.log\""

check "user hooks with same basename both survive (no fuzzy collapse)" test "$(q Stop "sum('deploy.js' in h.get('command','') for _,h in cmds)")" = "2"
check "all 3 write sites are backup-guarded (static)" bash -c "test \"\$(grep -B1 'fs.writeFileSync(settingsPath' '$WIRER' | grep -c 'backupSettingsOnce();')\" = \"3\""

cp "$S1" "$TMP/snap1.json"
env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE \
  node "$WIRER" --skills-path "$REPO_ROOT" --settings "$S1" > "$TMP/run2.log" 2>&1
check "run 2 idempotent (byte-identical)" cmp -s "$S1" "$TMP/snap1.json"

echo ""
if [ "$FAIL" = 0 ]; then
  echo "  PASS — all $PASS wire-hooks dedup checks passed"
  exit 0
else
  echo "  $FAIL failed, $PASS passed"
  exit 1
fi
```

(18 assertions — +single-quoted-variant collapse, +user-embedded-token survival at G6. RED expectation against unmodified wirer: assertions 2/3/6/9/10/11/13/15 fail; user-hook survival (14) passes both pre and post — it is a never-regress invariant — loop-guard stays 2, payload tokens persist, no async, no backup. Counts-vs-emission assertion is covered transitively by idempotency + the existing `validate-settings-no-duplicate-hooks.sh`; keeping this validator focused on the variant/async/backup property family.)

### 3. MODIFY `scripts/wire-hooks.mjs` (four diff blueprints)

**3a — canonicalization in the migration block (extends 543-564):**

```markdown
<<<<<<< BEFORE
      for (const { id, from, to } of CANONICAL_COMMANDS) {
        if (h.command.trim() === from) {
          h.command = to;
          migrated.push(`${hookType}:${id}:legacy-path→skills-path`);
        }
      }
=======
      for (const { id, from, to } of CANONICAL_COMMANDS) {
        if (h.command.trim() === from) {
          h.command = to;
          migrated.push(`${hookType}:${id}:legacy-path→skills-path`);
        }
      }
      // WI-359: strip stale argv-payload tokens from svc hooks. All svc hooks
      // read stdin first (hooks/lib/hook-payload.mjs, conf-10 learning) — a
      // payload argv token is dead weight AND creates variant-class
      // duplicates that the exact-string dedup below cannot collapse.
      if (/svc-[a-z-]+\.(mjs|js|sh)/.test(h.command) && h.command.includes("$TOOL_INPUT")) {
        const before = h.command;
        // Token-level strip (G6 EXEC-002): remove ONLY standalone payload argv
        // tokens (bare, double- or single-quoted); embedded forms
        // (--arg=$TOOL_INPUT) intentionally untouched.
        h.command = before
          .split(/\s+/)
          .filter((t) => !/^["']?\$TOOL_INPUT["']?$/.test(t))
          .join(" ")
          .trim();
        if (h.command !== before) migrated.push(`${hookType}:argv-payload-canonicalized`);
      }
      // WI-359 (3e, found at GREEN): adopt async on the 3 observational svc
      // hooks for EXISTING installs — emission carries async for fresh wires,
      // but isAlreadyWired skips re-emission, so already-wired entries would
      // stay synchronous forever without this migration.
      for (const a of [
        { ev: "PostToolUse", re: /svc-vibe-auditor\.js$/ },
        { ev: "PostToolUse", re: /svc-auto-capture-learnings\.mjs --trigger post-tool-use$/ },
        { ev: "Stop", re: /svc-auto-capture-learnings\.mjs --trigger stop$/ },
      ]) {
        if (hookType === a.ev && a.re.test(h.command) && h.async !== true) {
          h.async = true;
          migrated.push(`${hookType}:async-adopted`);
        }
      }
>>>>>>> AFTER
```

**Blueprint 3e provenance:** discovered at GREEN — fixture's pre-wired observational entries proved that emission-level async never reaches existing installs (isAlreadyWired skips). Async-adoption migration added in the same migration loop, after canonicalization (so signatures match post-strip). RED→GREEN cycle: 13/16 → 16/16.

**3b — dedup-v2 after the WI-076 pass (anchor: the pass's closing lines at 614-618):**

```markdown
<<<<<<< BEFORE
    seen.set(key, entry);
    deduped.push(entry);
  }
  settings.hooks[hookType] = deduped;
}
=======
    seen.set(key, entry);
    deduped.push(entry);
  }
  settings.hooks[hookType] = deduped;
}

// ---------------------------------------------------------------------------
// Variant-aware dedup (WI-359, dedup-v2) — runs AFTER the WI-076 exact pass.
// Identity per entry: matcher + per-hook [interpreter-stripped script basename
// | sorted bare (non-flag, non-$) args | sorted --flags]. Collapses pairs that
// differ only by payload tokens or path spelling; intentional flag/subcommand
// variants (workflow-guard trio, eval-gate pre/post, stop-quality
// accumulate/check) hash distinctly and survive. Canonical-keep: prefer the
// entry without a payload token; first wins otherwise (deterministic).
// ---------------------------------------------------------------------------
function hookIdentity(cmd) {
  const toks = (cmd || "").trim().split(/\s+/);
  let i = 0;
  if (toks[0] && /^(node|bash|sh)$/.test(path.basename(toks[0]))) i = 1;
  const base = toks[i] ? path.basename(toks[i]) : "";
  // Fuzzy (basename|subs|flags) identity ONLY for framework-owned scripts —
  // two distinct USER hooks may legitimately share a basename across paths
  // (tier-3 WI-359-T3-001). Non-framework hooks: exact-string identity, never
  // fuzzy-collapsed.
  if (!/^(svc-|eval-gate\.|preflight\.)/.test(base)) return (cmd || "").trim();
  const rest = toks.slice(i + 1);
  const flags = rest.filter((t) => t.startsWith("--")).sort().join(",");
  const subs = rest.filter((t) => !t.startsWith("--") && !/^"?\$/.test(t)).sort().join(",");
  return `${base}|${subs}|${flags}`;
}
const dedupedV2Counts = {};
for (const hookType of Object.keys(settings.hooks)) {
  if (!Array.isArray(settings.hooks[hookType])) continue;
  const seenV2 = new Map();
  const dedupedV2 = [];
  for (const entry of settings.hooks[hookType]) {
    const matcher = entry.matcher || "";
    const ident = (entry.hooks || []).map((h) => hookIdentity(h.command)).sort().join("||");
    const key = `${matcher}||${ident}`;
    const prev = seenV2.get(key);
    if (prev) {
      const prevHasPayload = (prev.hooks || []).some((h) => (h.command || "").includes("$TOOL_INPUT"));
      const curHasPayload = (entry.hooks || []).some((h) => (h.command || "").includes("$TOOL_INPUT"));
      if (prevHasPayload && !curHasPayload) {
        dedupedV2[dedupedV2.indexOf(prev)] = entry;
        seenV2.set(key, entry);
      }
      dedupedV2Counts[hookType] = (dedupedV2Counts[hookType] || 0) + 1;
      continue;
    }
    seenV2.set(key, entry);
    dedupedV2.push(entry);
  }
  settings.hooks[hookType] = dedupedV2;
}
>>>>>>> AFTER
```

**3c — async emission on the 3 observational entries (exact push-site edits):**

```markdown
<<<<<<< BEFORE
      id: "svc-vibe-auditor",
      matcher: "Edit|Write",
      hooks: [{ type: "command", command: `node ${hooksDir}/svc-vibe-auditor.js` }],
=======
      id: "svc-vibe-auditor",
      matcher: "Edit|Write",
      // async: observational auditor — never blocks (docs-verified 2026-06-07)
      hooks: [{ type: "command", command: `node ${hooksDir}/svc-vibe-auditor.js`, async: true }],
>>>>>>> AFTER
```

```markdown
<<<<<<< BEFORE
      id: "svc-auto-capture-learnings",
      matcher: "Edit|Write",
      hooks: [{ type: "command", command: `node ${hooksDir}/svc-auto-capture-learnings.mjs --trigger post-tool-use` }],
=======
      id: "svc-auto-capture-learnings",
      matcher: "Edit|Write",
      // async: observational capture — never blocks (docs-verified 2026-06-07)
      hooks: [{ type: "command", command: `node ${hooksDir}/svc-auto-capture-learnings.mjs --trigger post-tool-use`, async: true }],
>>>>>>> AFTER
```

```markdown
<<<<<<< BEFORE
    entries.Stop.push({
      id: "svc-auto-capture-learnings",
      matcher: "*",
      hooks: [{ type: "command", command: `node ${hooksDir}/svc-auto-capture-learnings.mjs --trigger stop` }],
    });
=======
    entries.Stop.push({
      id: "svc-auto-capture-learnings",
      matcher: "*",
      // async: observational capture at stop — Stop is docs-verified async-safe;
      // the blocking svc-stop-quality --check entry stays synchronous.
      hooks: [{ type: "command", command: `node ${hooksDir}/svc-auto-capture-learnings.mjs --trigger stop`, async: true }],
    });
>>>>>>> AFTER
```

(svc-edit-accumulator intentionally NOT async — its output feeds the synchronous Stop-time check; race documented in grounding. PreCompact capture stays sync.)

**3d — backup-before-write (shared helper + 3 one-line call insertions):**

```markdown
(anchor = the unique WI-076 report comment + its const line; helper inserts immediately before)
<<<<<<< BEFORE
}

// Report dedup stats (WI-076)
const totalDeduped = Object.values(dedupedCounts).reduce((a, b) => a + b, 0);
=======
}

// ---------------------------------------------------------------------------
// Backup before any write (WI-359) — wire-hooks mutates the GLOBAL settings
// consumed by every session on this machine; no backup existed before.
// ---------------------------------------------------------------------------
let backupDone = false;
function backupSettingsOnce() {
  if (backupDone || dryRun || !fs.existsSync(settingsPath)) return;
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const bak = `${settingsPath}.svc-backup-${ts}`;
  fs.copyFileSync(settingsPath, bak);
  process.stdout.write(`  ✓ backup: ${bak}\n`);
  process.stdout.write(`    restore: cp "${bak}" "${settingsPath}"\n`);
  backupDone = true;
}

// Report dedup stats (WI-076)
const totalDeduped = Object.values(dedupedCounts).reduce((a, b) => a + b, 0);
>>>>>>> AFTER
```

…and each of the 3 `fs.writeFileSync(settingsPath, …)` sites (648/661/693) gains a preceding `backupSettingsOnce();` line (mechanical identical one-line insertion ×3). Dedup-v2 stats join the report: `dedup-v2: removed N variant duplicates from <event>`.

### 4. MODIFY `hooks/hooks.json` (registry mirror)

Add `"async": true` after the `"command"` line on exactly the 3 EMITTED entries: `svc-vibe-auditor` (PostToolUse), `svc-auto-capture-learnings` (PostToolUse AND Stop) — matching AC-04 scope 1:1 (G2 F-006: `svc-spec-index-update` registry-intent dropped from this WI; never emitted, its async mark belongs to the WI that wires it). Executor anchors each edit on the entry's unique `"id"` + `"command"` pair; shape:

```markdown
<<<<<<< BEFORE
        "id": "svc-vibe-auditor",
        "matcher": "Edit|Write",
        "command": "node hooks/svc-vibe-auditor.js"
=======
        "id": "svc-vibe-auditor",
        "matcher": "Edit|Write",
        "command": "node hooks/svc-vibe-auditor.js",
        "async": true
>>>>>>> AFTER
```

## Amendment Log (G6 review-exec, 2026-06-07)

- **EXEC-001 (medium, codex):** pure dedup-v2 removals invisible to write gate (totalDeduped counted only the exact pass) → totalDedupedV2 computed, reported (`dedup-v2: removed N variant duplicate entries`), OR'd into the dedup-only write condition.
- **EXEC-002 (medium, codex):** regex canonicalizer left quote-husks on single-quoted tokens and could partially erase embedded forms → token-level filter (standalone bare/quoted tokens only; embedded forms untouched by design). Fixture +2 rows; validator 18 assertions.

## Task Graph

| Task | Title | Files | Deps | AC coverage | Validation | Checkpoint |
|---|---|---|---|---|---|---|
| task-1-fixture-validator | TDD RED: fixture + 14-assertion validator (FAILS vs current wirer) | 1,2 | — | AC-05 | validator exits NON-zero against unmodified wire-hooks (assertions 2/3/6/9/10/11/13 RED) | `checkpoint-1-red` |
| task-2-wirer-green | GREEN: canonicalization + dedup-v2 + async + backup + registry mirror | 3,4 | task-1 | AC-01..04 | validator exits 0 (14/14) | `checkpoint-2-green` |
| task-3-live-rewire | Live settings cleanup (machine state, NOT committed): backup → wire → assert | — | task-2 | AC-06 | live settings: loop-guard==1, trio==3, async×3, no payload tokens; backup + restore line captured to `.svc/wi-359-live-rewire.log` | (External State row 1) |
| task-4-branch-validation | Full-branch validation | — | 1-3 | AC-07 | full tier-1 (196 incl. new) PASS in worktree; lint PASS; diff == exactly the 4 planned files; `git status --porcelain --untracked-files=all` residue classified per leftover-disposition (G2 F-005) | (gate before G5) |

## AC-to-Task / AC-to-Test Mapping

| AC | Statement | Task | Test type |
|---|---|---|---|
| AC-01 | Stale payload-token argv variants canonicalized on every wire run | task-2 | Unit-equivalent (assertions 3/6/9) |
| AC-02 | Variant-class duplicate pair collapses to one canonical entry | task-2 | Unit-equivalent (assertion 2) + live (task-3) |
| AC-03 | Intentional flag/subcommand variants survive (trio ×3, pre/post, accumulate/check) | task-2 | Unit-equivalent (assertions 4/5/8) |
| AC-04 | 3 observational entries emitted async; blocking hooks untouched | task-2 | Unit-equivalent (assertions 10-13) + docs-verdict evidence |
| AC-05 | Validator RED against pre-change wirer (real TDD) | task-1 | Process proof (checkpoint-1 log) |
| AC-06 | Live settings cleaned with backup + restore line; rollback path proven | task-3 | Live machine-state assertion + `.svc/wi-359-live-rewire.log` |
| AC-07 | Suite 196/196 with new validator; idempotency (run-2 byte-identical) | task-4 | Tier-1 suite + assertion 14 |

## Prerequisite Alignment Matrix

| Task | UX | UI | Tech design | Style contract | Persona/competitor |
|---|---|---|---|---|---|
| all | N/A (framework tooling, no UI surface) | N/A | WI-359 guardrails 1-7 + pressure-test §3 carry the design; docs-verified async semantics (claude-code-guide agent report 2026-06-07) | wire-hooks existing idiom (parseArgs, migrated[] reporting, WI-076 pass structure) — extensions match file patterns | P0 (framework operator): latency + reliability of every session on this machine |

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|-------------|------------|----------|------------------|
| 1 | ~/.claude/settings.json (GLOBAL machine state, every session) | MUTATED at task-3: canonicalization + dedup + async fields | coupled | timestamped backup `settings.json.svc-backup-<ts>` + printed restore one-liner BEFORE write (blueprint 3d); rollback criterion (WI guardrail 7): any guard that should fire doesn't → cp-restore; evidence at `.svc/wi-359-live-rewire.log` |
| 2 | ~/.claude/settings.json.svc-backup-<ts> (backup artifact) | CREATED at task-3 | decoupled-justified | retained for manual rollback; path recorded in live-rewire log + restore line; pruning at owner discretion (small JSON) |
| 3 | `/tmp/wi359-dedup.*` validator tmpdirs | CREATED per validator run | decoupled-justified | `trap rm -rf` on EXIT; OS tmp cleanup backstop |
| 4 | `.svc/wi-359-live-rewire.log` (live-rewire evidence) | CREATED at task-3 | decoupled-justified | gitignored `.svc/*.log`; consumed into exec-record receipt; leftover-disposition at landing |
| 5 | Next-session hook behavior (async activation) | RELIED ON: settings apply to sessions started AFTER rewire | decoupled-justified | in-session observation structurally impossible (settings read at session start); mitigation = structural assertion on the written live file (task-3) + docs verdict + standing rollback criterion with tested restore path |
| 6 | worktree-local .svc/wi-359-checkpoints.log | CREATED at checkpoints (G2 F-005) | decoupled-justified | dies with worktree removal; durable rollback anchor = checkpoint-named commit subjects (log-grep fallback in RECOVERY block); never enters tracked diff |

**Decoupled-justified prose (rows 2-5):** rows 2-4 are evidence/rollback artifacts with explicit consumers (restore one-liner, exec-record receipt, leftover-disposition ledger). Row 5 is a platform constraint — a session cannot reload its own settings; the async claim is carried by the structural write assertion + the docs-verified field semantics, and the rollback criterion (restore from the proven backup) covers the misfire case; verify-promotion documents this as the V2 limit with the next-session check as follow-through.

Untouched taxonomy environments (walked, nothing): package registries, DBs, CI providers, browser state, OAuth stores, cloud infra, schedulers, MCP state, containers, OS services, webhooks, marketplaces, host symlink surfaces.

## Lane Compliance (artifact-cited per G2 F-001)

Framework lane, WI-bound. Mandatory chain = CLAUDE.md "Mandatory Plan-Exec-Review Chain" members, tracked in `.svc/lane-tasks-WI-359.json`:

| Chain skill | Status | Artifact / citation |
|---|---|---|
| route-workflow (task 1) | completed | graph + phases P1-P6 evidence logs (.svc/route-workflow-*.log) + pipeline-decisions entry ts=2026-06-07T03:11:18.002Z (run_id WI-359, routing + design-tech-skip reasoning) + session contract entry (bound_to: wi-backlog, end_to_end) |
| WI/spec acceptance | completed | docs/specs/work-items/WI-359.md IS the spec (header line 3; convention accepted at WI-358 G2 round-2; landed precedents PR #29/#30) |
| plan-changeset (task 2) | completed | this manifest; phases P1-P6 recorded; receipt validation_output: SIMULATED 11/11, adversarial 10/10, mechanical exit 0 |
| review-plan (task 3) | in progress | docs/plans/2026-06-07-wi-359-wire-hooks-dedup/review-log.yaml (this review, written at P5) |
| execute-changeset → verify-promotion (tasks 4-8) | pending | dispatched in graph order after G2 verdict |
| design-tech (task 9) | skipped | top-level skip_reason in graph + pipeline-decisions ts=2026-06-07T03:11:18.002Z reasoning ("design pre-baked in WI guardrails 1-7 + pressure-test §3") |

`evolve-framework` / `improve-framework` are not chain members for WI-bound framework work (CLAUDE.md chain definition; identical rebuttal accepted by the Tier-2 reviewer at WI-358 round-2).

## Validation Plan

Task-level commands in §Task Graph. **Final branch-level:** full tier-1 (196 incl. new) in worktree · `node scripts/lint-skills-manifest.mjs` · diff == exactly the 4 planned files · live-rewire evidence log complete.

**Live-rewire procedure (task-3, machine state — runs AFTER GREEN, from the worktree using the NEW wirer):**

```bash
# 1. pre-state count (expect 2 loop-guard entries — the live repro)
python3 -c "import json,os; s=json.load(open(os.path.expanduser('~/.claude/settings.json'))); print(sum('svc-loop-guard' in h.get('command','') for r in s['hooks']['PreToolUse'] for h in r.get('hooks',[])))" | tee -a .svc/wi-359-live-rewire.log
# 2. rewire (backup + restore line printed by the new wirer itself)
node scripts/wire-hooks.mjs --skills-path ~/.claude/skills --settings ~/.claude/settings.json 2>&1 | tee -a .svc/wi-359-live-rewire.log
# 3. post-assertions (G2 F-007 — exact predicates, exit non-zero on failure, appended to log)
python3 - <<'PY' 2>&1 | tee -a .svc/wi-359-live-rewire.log
import json,os
s=json.load(open(os.path.expanduser('~/.claude/settings.json')))
def cmds(ev): return [h for r in s['hooks'].get(ev,[]) for h in r.get('hooks',[])]
lg=sum('svc-loop-guard' in h.get('command','') for h in cmds('PreToolUse'))
trio=sum('svc-workflow-guard' in h.get('command','') for h in cmds('PreToolUse'))
asy=sum(h.get('async') is True and ('svc-vibe-auditor' in h.get('command','') or 'svc-auto-capture-learnings' in h.get('command','')) for ev in ('PostToolUse','Stop') for h in cmds(ev))
tok=sum('TOOL_INPUT' in h.get('command','') and 'svc-' in h.get('command','') for ev in list(s['hooks']) for h in cmds(ev))   # scoped to svc hooks, matching canonicalization (T3-002)
print(f'post: loop-guard={lg} trio={trio} async={asy} payload-tokens={tok}')
assert lg==1 and trio==3 and asy==3 and tok==0, 'LIVE POST-ASSERTION FAILED'
print('LIVE POST-ASSERTIONS PASS')
PY
# 4. rollback path = the printed restore line; grep 'restore:' .svc/wi-359-live-rewire.log
```

## Execution Command Sequence

```bash
bash scripts/worktree.sh create feature-wi-359-wire-hooks-dedup
# task-1 (RED): write fixture + validator per blueprints §1-2; chmod +x; run → expect NON-zero
set +e; bash test-framework/evals/tier-1/validate-wire-hooks-variant-dedup.sh; RED_STATUS=$?; set -e
test "$RED_STATUS" -ne 0 && echo "RED exit=$RED_STATUS (non-zero as required)"   # gate: RED must fail (G2 F-002)
git add test-framework/evals/tier-1/fixtures/wire-hooks-variant-dup.json test-framework/evals/tier-1/validate-wire-hooks-variant-dedup.sh
git commit -m "test(WI-359): checkpoint-1-red — variant-dedup validator RED vs current wirer" && mkdir -p .svc && git rev-parse HEAD >> .svc/wi-359-checkpoints.log   # worktree-local (G2 F-003); durable anchor = checkpoint commit subjects
# task-2 (GREEN): apply blueprints §3a-3d + §4; validator → 0
bash test-framework/evals/tier-1/validate-wire-hooks-variant-dedup.sh; echo "GREEN exit=$? (want 0)"
git add scripts/wire-hooks.mjs hooks/hooks.json
git commit -m "feat(WI-359): checkpoint-2-green — canonicalization + dedup-v2 + async + backup" && git rev-parse HEAD >> .svc/wi-359-checkpoints.log
# task-3: live rewire per §Validation Plan procedure (machine state, not committed)
# task-4: full validation
EVALS=0 bash test-framework/evals/run-all-evals.sh --tier1
node scripts/lint-skills-manifest.mjs
git diff --name-only main...HEAD | sort
# RECOVERY_IF_FAIL (explicit, absolute-path, status-gated — G2 F-003):
#   WT="$(git rev-parse --show-toplevel)"                                  # absolute worktree root
#   if [ -n "$(git -C "$WT" status --porcelain)" ]; then
#     git -C "$WT" switch -c "rescue/wi-359-$(date +%s)"                   # preserve uncommitted work
#     git -C "$WT" add -A && git -C "$WT" commit -m "rescue(WI-359): preserve pre-rollback state"
#     git -C "$WT" switch feature-wi-359-wire-hooks-dedup
#   fi
#   CKPT=$(tail -1 "$WT/.svc/wi-359-checkpoints.log" 2>/dev/null)
#   [ -n "$CKPT" ] || CKPT=$(git -C "$WT" log --format=%H --grep='checkpoint-' -1)   # durable fallback anchor
#   git -C "$WT" reset --keep "$CKPT"   # tree is clean here (rescue branch above); --keep aborts rather than overwrite if not
#   LIVE SETTINGS rollback (independent of repo state): use the restore line from .svc/wi-359-live-rewire.log
```

## Checkpoint Plan

1. `checkpoint-1-red` — fixture + validator, RED proof anchor
2. `checkpoint-2-green` — wirer + registry, GREEN anchor
SHAs appended to `.svc/wi-359-checkpoints.log`; live rewire AFTER GREEN only; rollback = restore line + status-gated reset (absolute-path `git -C` ops per WI-358 learning).

## Loop-Back Targets

- Async field rejected live / guard misfire post-rewire → IMMEDIATE restore from backup (guardrail 7), revert async emission, keep dedup (independent layers)
- Identity function collides two intentional variants in tier-1 → halt, fix `hookIdentity`, re-run RED/GREEN
- hooks.json linter objection to `async` key → ship emission only (behavior), move registry mirror to follow-up (documentation)

## Promotion Readiness Checklist

- [x] 2 CREATE + 2 MODIFY accounted; live machine state in External State (not Files Planned)
- [x] Every task has validation; real TDD red-green
- [x] 7 ACs mapped to tasks + test types
- [x] Checkpoints named; final diff == 4 files enforced in task-4
- [x] No ORM/Base44 — N/A
- [x] No banned scope-reduction phrases
- [x] Tier-1 promotion note carried (5 fields)
- [x] Async scope docs-verified (PostToolUse/Stop SAFE; PreToolUse excluded; accumulator excluded for race-correctness; PreCompact excluded)

## Simulation Report (2026-06-07)

| # | Check | Result | Action |
|---|-------|--------|--------|
| 1 | CREATE target 1 (fixture) absent on disk | PASS (CREATE) | — |
| 2 | CREATE target 2 (validator) absent on disk | PASS (CREATE) | — |
| 3 | fixtures/ dir exists under tier-1 | PASS | no mkdir step needed |
| 4 | 3a anchor (`CANONICAL_COMMANDS` loop) present | PASS | 2 refs (decl + loop) — loop context unique |
| 5 | 3b anchor (`settings.hooks[hookType] = deduped;`) unique | PASS | — |
| 6 | 3c anchors (vibe-auditor id; capture-learnings post-tool-use command; Stop push block) unique | PASS | — |
| 7 | 3d anchor (WI-076 report comment trio) unique | PASS | widened to 3-line context |
| 8 | 3 write sites for `backupSettingsOnce()` insertion | PASS (count=3) | — |
| 9 | hooks.json anchors (`"command": "node hooks/svc-vibe-auditor.js"`) present | PASS | per-id anchoring documented |
| 10 | `path` module imported in wire-hooks (hookIdentity uses path.basename) | PASS (line 24) | — |
| 11 | `--settings`/`--dry-run`/`--list-all` flags exist for hermetic validator | PASS (453-461) | — |

## Scenario Walkthrough (framework lane — behavioral scenarios)

| Scenario | Implementing task | Proof point |
|---|---|---|
| S1 stale payload-token variant canonicalized | task-2 (3a) | assertions 3/6/9 on fixture |
| S2 loop-guard variant pair collapses to one | task-2 (3b) | assertion 2 + live task-3 (pre-count 2 → post-count 1) |
| S3 workflow-guard trio + pre/post + accumulate/check all survive | task-2 (3b identity) | assertions 4/5/7/8 |
| S4 async on exactly 3 observational entries; blockers stay sync | task-2 (3c) | assertions 10-13 |
| S5 backup + restore line before ANY write | task-2 (3d) | assertion 14 (backup glob + restore grep) |
| S6 idempotent second run | task-2 | assertion 14b (cmp byte-identical) |
| S7 live machine-state cleanup with rollback path | task-3 | .svc/wi-359-live-rewire.log (pre/post counts + restore line) |

## Adversarial Self-Pass (10-check, inline)

| # | Lens | Verdict |
|---|---|---|
| 1 | Archetype fit (extends migration block + WI-076 pass in-file) | PASS — 2 CREATE + 2 MODIFY |
| 2 | Invariants (trio, pre/post, accumulate/check, kimi rows, WI-076 untouched) | PASS — identity function keeps flags + bare subcommands |
| 3 | TDD real (validator RED vs current wirer: 7 assertions fail) | PASS — checkpoint-1 captures RED |
| 4 | Rollback (settings: timestamped backup + printed restore; repo: checkpoint SHAs) | PASS — backup is created by code under test, asserted by validator |
| 5 | Scope creep | PASS — no edits to isAlreadyWired switch, no kimi wirer changes, accumulator/PreCompact async explicitly excluded |
| 6 | Hermeticity (validator: tmp fixture, env -u GIT_* per LF-001 class, no live-settings reads) | PASS |
| 7 | False-collapse risk (intentional variants) | LOW — flags + bare-subcommand discriminators in identity; assertion 4/5/8 regression net |
| 8 | False-survive risk (payload variants with path differences) | MITIGATED — basename strip + payload-token filter; canonical-keep deterministic |
| 9 | Machine-state blast radius (every session on machine) | MITIGATED — guardrails 1/2/7: fixture-first (committed), backup-before-write (code), rollback criterion (restore line); async misfire → restore + revert emission independently of dedup |
| 10 | Async semantics risk (docs vs reality) | MITIGATED — docs-verified via claude-code-guide (PostToolUse/Stop SAFE, entry-level field); excluded events documented; next-session verification at G7 with V2-limit honesty |
