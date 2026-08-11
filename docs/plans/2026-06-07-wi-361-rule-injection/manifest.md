# Manifest: WI-361 — context diet ph.1: signal-gated rule injection (~6 always-on)

- **Feature spec:** `docs/specs/work-items/WI-361.md` (framework WI — the WI doc is the spec)
- **Branch:** `feature-wi-361-rule-injection`
- **Status:** SIMULATED
- **Base branch / SHA:** `main` @ `f325e00f` (origin-synced)
- **Created:** 2026-06-07T07:05Z
- **Lane:** framework (full mandatory chain; worktree; FULL review armor — critical severity)
- **Archetype:** Cross-cutting concern (one behavior — "the right rule arrives when its subject matter is touched" — wired across registry, hook, installer, linter, wirer; entry points enumerated below)

## Implementation Summary

Stop injecting ~30K tokens of rules into every session. Three layers:

1. **Registry:** every `rulesRegistry` entry gains `auto_inject: always|signal|lazy`; signal entries gain `signals: {paths?: [...], keywords?: [...], bash?: [...]}` (path regexes vs touched files; keyword regexes vs diff/file content N/A in hook context — paths + bash-command keywords are the live signals; concern bridge supplies the rest).
2. **Injector hook (`hooks/svc-rule-injector.mjs`)** — one module, three triggers:
   - **PreToolUse(Edit|Write) — PRIMARY (docs-verified 2026-06-07):** `additionalContext` + `permissionDecision:"allow"` in one response, 10K-char cap — matched rules arrive BEFORE the first edit. Closes the first-edit residual entirely (the WI's PreToolUse upgrade clause fires).
   - **PreToolUse(Bash):** command-string keyword matching (destructive-git / gh-workflow / docker classes whose subject is the command, not a file).
   - **PostToolUse(Read|Grep|Glob):** earlier-arrival optimization while exploring (additionalContext docs-verified on PostToolUse too).
   - Per-session memo .svc/rule-injections-<session_id>.json → steady-state cost = one JSON parse + set lookup; concern bridge: on memo-miss, matched concerns' `required_rules` join the injection set via in-process registry match (no nested node spawn).
3. **Installer trim — CLAUDE HOST ONLY (G2 PLAN-001 CRITICAL):** `setup --host claude` installs ONLY `auto_inject: always` rules into the global dir (6 files ≈ 18KB, was 36 files / 121.5KB incl. 3 IDENTICAL twin pairs — measured); stale non-always + twin leftovers removed with timestamped backup + restore line. **kimi/gemini/opencode/codex hosts keep the FULL rules install unchanged** — they have no injector yet; trimming them would lose 30 rules with no replacement. Host-parity injectors = explicit follow-up (noted for the WI-365/367 window). PLAN-008 (stale @-imports on file-target hosts) is therefore out of blast radius: their install paths are untouched.

**Host-capability verification (claude-code-guide agent, 2026-06-07, code.claude.com/docs/en/hooks):** PreToolUse output supports `{hookSpecificOutput: {permissionDecision: "allow", additionalContext: "..."}}`; PostToolUse supports `additionalContext`; both capped 10,000 chars, injected as system-reminder for the next model turn; multiple hooks' contexts concatenate; most-restrictive permissionDecision wins. PreToolUse = verdict-primary.

**Existing-implementation grounding (read 2026-06-07):**
- `rulesRegistry.entries` (skills-manifest.json): 42 entries `{path, type: correction(30)|steering(12), scope: global(13)|project(29), stack, source, last_evaluated, source_sha, notes}` — `auto_inject`/`signals` are additive fields.
- `setup:258-300`: correction+universal AND steering+universal → global rules dir; steering+stack → per-project @-imports. Live dir: 36 files, 121,502 bytes, 3 byte-identical twin pairs (`svc-base44-auth-refresh.md`==`base44-auth-refresh.md`, `svc-bash-hygiene.md`==`bash-hygiene.md`, `svc-github-projects.md`==`github-projects.md`) — historical prefix migration leftovers, injected twice today.
- `scan-concerns.mjs`: `--paths <files...> --json --project <root>` → `{matches: [{name, severity, required_rules, ...}]}`; project-merge path is how Example Marketplace gets base44 concerns.
- `wire-hooks.mjs`: post-WI-359 (canonicalization, dedup-v2, async emission, backup) — injector entries are ADDITIVE emission + isAlreadyWired cases + hooks.json mirror rows.
- **Authenticity gate:** `skills-manifest.json` is protected — the manifest edit requires an `improve-framework` skill-load receipt <90 min before the edit in the executing session (precedent: WI-357 closeout protocol). Execution sequence emits it FIRST.
- No existing `additionalContext` usage in any svc hook (grep-verified) — this is the first; pattern documented for WI-370.
- `evaluate-rule` SKILL has no static always-on list — selection criteria below are the WI guardrail ("mechanical twin ⇒ lazy-safe; advisory-only ⇒ always or documented miss") applied per-rule with twin citations.

**Invariants:** rule FILES unchanged (this WI moves injection, not content); `concerns/` registry untouched; per-project @-import path for stack steering rules unchanged; `setup` host-manifest contract unchanged; wire-hooks WI-359 layers untouched (additive emission only); the 6 always-on rules behave exactly as today.

## The 42-entry classification (registry deltas — task-2 applies as data)

**ALWAYS (6 — behavioral, universal, no mechanical twin):**

| Rule | Why always |
|---|---|
| rules/common/question-fatigue.md | pure conversational behavior, fires every turn |
| rules/tool-selection.md | every-turn tool economics, no twin |
| rules/verify-state-before-context.md | per-action discipline vs stale context, no complete twin |
| rules/learning-preload.md | session-start habit; gates everything else |
| rules/long-output-to-file.md | output discipline on any long artifact |
| rules/common/research-before-build.md | default posture before any new implementation |

**LAZY (6 — mechanical twin enforces the behavior; rule text loads only when its consumer skill runs; documented first-touch miss accepted):**

| Rule | Twin |
|---|---|
| rules/destructive-git-ops.md | `svc-destructive-git-preamble` PreToolUse guard (hard-block) |
| rules/common/neversay-fix-if-needed.md | `svc-workflow-guard` commit-msg regex block |
| rules/common/git-pre-commit-hygiene.md | pre-commit drift hooks + commit-quality guard |
| rules/bash-hygiene.md | `svc-loop-guard` + bounded-wait validators + harness sleep-block |
| rules/common/code-review.md | review-gate/audit skills load it as consumer; severity taxonomy embedded in their SKILL.md flows |
| rules/common/model-selection.md | `scripts/resolve-model.sh` IS the behavior; tables mirror registry |

**SIGNAL (30 — injected on subject-matter touch; signal sets below are the registry data):**

| Rule | signals.paths (regex) | signals.bash (regex) |
|---|---|---|
| rules/base44/auth-refresh.md | `base44|\.base44/` | `base44|app\.base44\.com` |
| rules/base44/e2e-otp-connector.md | `e2e/.*auth|otp` | — |
| rules/base44/function-deploy-404-check-secrets.md | `functions/|base44` | `base44.*deploy` |
| rules/base44/rls-policy.md | `rls|policies|base44` | — |
| rules/base44/schema.md | `entities|base44` | `coding/write` |
| rules/base44/static-assets-public-dir.md | `public/|assets/` (project base44 stack) | — |
| rules/build-and-ship-alignment.md | `android/|ios/|build\.gradle|Info\.plist` | `gradle|versionCode|aab|ipa` |
| rules/common/gh-workflow-validation.md | `\.github/workflows/` | `gh (workflow|run) ` |
| rules/common/regex-identifier-conventions.md | — | `re\.compile|IGNORECASE|grep -i` |
| rules/common/skill-output-visibility.md | `(^|/)SKILL\.md$` | — |
| rules/concern-routing.md | `^concerns/|scan-concerns` | `scan-concerns` |
| rules/cross-ref-workflow-dispatch-coherence.md | `\.github/workflows/` | `gh workflow run.*--ref` |
| rules/distribution-vs-launch-blocker.md | `docs/specs/features/` | — |
| rules/docker-local-dev.md | `docker-compose|Dockerfile` | `docker |supabase start` |
| rules/github-projects.md | — | `gh (issue|project) ` |
| rules/golang/patterns.md | `\.go$` | — |
| rules/helper-app-query-parity.md | `e2e/helpers/|tests/fixtures/` | — |
| rules/host-capability-research.md | `^hooks/|wire-.*hooks|provision/hosts/` | — |
| rules/plan-changeset-trigger.md | `^hooks/|^scripts/|^test-framework/` (svc repo) | — |
| rules/post-fix-evidence-before-next-fix.md | `test-results/|error-context` (+ concern bridge `required_rules`) | — |
| rules/provider-fidelity-test-contract.md | `provider|generation|/ai/` (+ concern bridge) | — |
| rules/python/patterns.md | `\.py$` | — |
| rules/react/coding-style.md | `\.(tsx|jsx)$` | — |
| rules/research-must-use-gemini-cli.md | `research-prescope|references/knowledge/` | `gemini` |
| rules/rust/patterns.md | `\.rs$` | — |
| rules/tenant-scoped-test-seeding.md | `e2e/|\.spec\.` | — |
| rules/tier-1-promotion.md | `test-framework/evals/tier-1/` | — |
| rules/transient-ui-assertion-pattern.md | `e2e/|\.spec\.` | — |
| rules/web/design-quality.md | `src/components/|\.css$` | — |
| rules/web/performance.md | `src/|\.css$|vite\.config` | — |

(Per-entry severity of injection = registry `type`: correction injects full text first; steering packs after corrections under the 10K cap.)

## Files Planned

| # | File | Action | Task | Purpose |
|---|---|---|---|---|
| 1 | test-framework/evals/tier-1/validate-rule-injection.sh | CREATE | task-1 (TDD RED) | Fixture-driven: signal match injects once, memo suppresses repeat, always never signal-listed, twins-clean install plan, linter schema, 10K packing, Example Marketplace-style project bridge |
| 2 | hooks/svc-rule-injector.mjs | CREATE | task-2 (GREEN) | Triple-trigger injector (stdin payload; memo; concern bridge; cap-aware packing; allow+additionalContext) |
| 3 | `skills-manifest.json` | MODIFY | task-3 (improve-framework receipt FIRST) | 42 `auto_inject` classifications + 30 `signals` sets (data above) |
| 4 | `scripts/lint-skills-manifest.mjs` | MODIFY | task-3 | Schema: auto_inject enum required on every entry; signals shape; exactly-N always check (6); signal entries must have ≥1 signal source (paths/bash/concern-bridge note) |
| 5 | `setup` | MODIFY | task-4 | Install only `always` entries to global rules dir; remove stale non-always + twin leftovers with timestamped backup + printed restore line |
| 6 | `scripts/wire-hooks.mjs` | MODIFY | task-4 | Emit injector entries: PreToolUse(Edit|Write), PreToolUse(Bash), PostToolUse(Read|Grep|Glob); isAlreadyWired cases; async NOT set (PreToolUse must block to inject pre-edit) |
| 7 | `hooks/hooks.json` | MODIFY | task-4 | Registry mirror rows (3 events) |
| 8 | `CLAUDE.md` | MODIFY | task-4 | Discoverability: how rules load on demand + always-on list pointer |
| 9 | `research/SKILL.md` | MODIFY | task-4 | `context: fork` frontmatter (docs-verified field) on the heavy extraction skill — stops burning parent context |

**Tier-1 validator promotion note (per `rules/tier-1-promotion.md`):**
- `validator_path`: file 1 (under test-framework/evals/tier-1/)
- `failure_class`: context-diet regression — signal rules silently failing to arrive (instruction-miss class) or always-set re-bloating (the 121KB/36-file state this WI removes; 3 live twin pairs measured)
- `promotion_signal`: signal 3 (hot path: registry+installer+wirer feed every session on every machine) AND signal 2 (context-budget doctrine: `references/context-budget.md`)
- `expected_runtime_budget`: <5s hermetic (tmp fixture registry + simulated stdin payloads into the injector via node; sanitized GIT_*; no live settings/rules-dir reads)
- `why_tier_2_or_targeted_is_insufficient`: a silent injector regression = rules stop arriving everywhere with zero error surface; must be caught on every validation run

## Changeset Blueprints

### 2. CREATE hooks/svc-rule-injector.mjs (full contents)

```javascript
#!/usr/bin/env node
/**
 * svc-rule-injector — WI-361 context diet ph.1.
 *
 * Injects subject-matter rules ON DEMAND instead of always-on. Three triggers
 * (wired by wire-hooks.mjs):
 *   PreToolUse  Edit|Write        — PRIMARY: rules arrive BEFORE the first edit
 *   PreToolUse  Bash              — command-keyword rules (git/gh/docker classes)
 *   PostToolUse Read|Grep|Glob    — earlier arrival while exploring
 *
 * Output (docs-verified 2026-06-07): PreToolUse responds
 *   { hookSpecificOutput: { hookEventName, permissionDecision: "allow",
 *     additionalContext } }  — allow + inject in one response, 10K-char cap.
 * PostToolUse responds { hookSpecificOutput: { hookEventName, additionalContext } }.
 *
 * Cost model: memo hit = one JSON parse + Set lookup, no further work.
 * Memo: .svc/rule-injections-<session_id>.json (gitignored .svc/*.json class).
 * Fail-open: ANY error → exit 0 with no output (never blocks tooling).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// G2 PLAN-002: the established payload normalizer (conf-10 stdin-first learning)
// handles tool_name/toolName, tool_input/toolInput/arguments, payload cwd,
// file_path/path variants across hosts.
import { readHookPayload, extractFilePath, extractCommand } from "./lib/hook-payload.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SVC_ROOT = path.join(__dirname, "..");
const CAP = 10000;          // documented additionalContext cap
const BUDGET = 8500;        // full-text packing budget; remainder listed as pointers

function readStdin() {
  try { return readFileSync(0, "utf8"); } catch { return ""; }
}

function safeJson(s) { try { return JSON.parse(s); } catch { return null; } }

function loadRegistry() {
  // SVC_RULES_MANIFEST override exists for hermetic validator fixtures (PLAN-004)
  const mp = process.env.SVC_RULES_MANIFEST || path.join(SVC_ROOT, "skills-manifest.json");
  const m = safeJson(readFileSync(mp, "utf8"));
  return (m && m.rulesRegistry && m.rulesRegistry.entries) || [];
}

function globToRe(g) {
  // glob→regex for concern file_path_patterns — ANCHORED, with zero-dir `**/`
  // support (tier-3 WI-361-T3-002: unanchored version over-excluded via
  // fires_off substring hits and missed top-level `**/x/**` matches).
  // placeholder tokens keep injected regex text immune to later passes
  const esc = g.replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, "\u0001")
    .replace(/\*\*/g, "\u0002")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .replace(/\u0001/g, "(?:.*/)?")
    .replace(/\u0002/g, ".*");
  return new RegExp("^" + esc + "$");
}

function loadConcernBridge(paths) {
  // In-process mini-match against concerns REGISTRY (real shape verified
  // 2026-06-07: signals.file_path_patterns are GLOBS; rules live at
  // handled_by.required_rules; fires_off globs exclude). No nested node
  // spawn (latency budget per WI-359).
  try {
    const rp = process.env.SVC_CONCERNS_REGISTRY || path.join(SVC_ROOT, "concerns", "REGISTRY.json");
    const reg = safeJson(readFileSync(rp, "utf8"));
    const out = new Set();
    for (const c of (reg && reg.concerns) || []) {
      const rules = (c.handled_by && c.handled_by.required_rules) || [];
      if (!rules.length) continue;
      const offs = (c.fires_off || []).map(globToRe);
      const ons = ((c.signals && c.signals.file_path_patterns) || []).map(globToRe);
      const hit = paths.some((p) => ons.some((re) => re.test(p)) && !offs.some((re) => re.test(p)));
      if (hit) for (const r of rules) out.add(r);
    }
    return out;
  } catch { return new Set(); }
}

function main() {
  const payload = readHookPayload();           // normalized across hosts (PLAN-002)
  if (!payload) process.exit(0);
  const event = payload.hook_event_name || payload.hookEventName || "";
  const tool = payload.tool_name || payload.toolName || "";
  const input = payload.tool_input || payload.toolInput || payload.arguments || {};
  const session = (payload.session_id || payload.sessionId || "nosession").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);

  // Extract match subjects per trigger (helper-first, field fallbacks second)
  let paths = [];
  let bashCmd = "";
  let content = "";
  if (tool === "Edit" || tool === "Write") {
    paths = [extractFilePath(payload) || input.file_path || ""].filter(Boolean);
    // G2 PLAN-005: content keywords — new content is a live signal source
    content = String(input.new_string || input.content || "");
  } else if (tool === "Read") paths = [extractFilePath(payload) || input.file_path || ""].filter(Boolean);
  else if (tool === "Grep" || tool === "Glob") paths = [input.path || input.pattern || ""].filter(Boolean);
  else if (tool === "Bash") bashCmd = extractCommand(payload) || input.command || "";
  if (paths.length === 0 && !bashCmd && !content) process.exit(0);

  // Repo-relative-ize vs payload cwd first (PLAN-002), process.cwd() fallback
  const cwd = payload.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  paths = paths.map((p) => (path.isAbsolute(p) ? path.relative(cwd, p) : p));

  const entries = loadRegistry().filter((e) => e.auto_inject === "signal");
  const bridgeRules = paths.length ? loadConcernBridge(paths) : new Set();

  const matched = [];
  for (const e of entries) {
    const sig = e.signals || {};
    let hit = false;
    for (const rx of sig.paths || []) {
      let re; try { re = new RegExp(rx); } catch { continue; }
      if (paths.some((p) => re.test(p))) { hit = true; break; }
    }
    if (!hit && bashCmd) {
      for (const rx of sig.bash || []) {
        let re; try { re = new RegExp(rx); } catch { continue; }
        if (re.test(bashCmd)) { hit = true; break; }
      }
    }
    if (!hit && content) {
      // PLAN-005: subject-in-content rules (e.g. IGNORECASE regexes being written)
      for (const rx of sig.keywords || []) {
        let re; try { re = new RegExp(rx); } catch { continue; }
        if (re.test(content)) { hit = true; break; }
      }
    }
    if (!hit && bridgeRules.size) {
      const base = path.basename(e.path, ".md");
      if (bridgeRules.has(base) || bridgeRules.has(e.path)) hit = true;
    }
    if (hit) matched.push(e);
  }
  if (matched.length === 0) process.exit(0);

  // Memo (PLAN-003): two-state — "full" suppresses forever; "pointer" rules
  // stay eligible for FULL injection on later touches (overflow must not
  // permanently downgrade a rule to a one-line pointer).
  const memoPath = path.join(cwd, ".svc", `rule-injections-${session}.json`);
  let memoRaw = {};
  if (existsSync(memoPath)) {
    const m = safeJson(readFileSync(memoPath, "utf8"));
    memoRaw = Array.isArray(m) ? Object.fromEntries(m.map((k) => [k, "full"])) : (m || {});
  }
  const fresh = matched.filter((e) => memoRaw[e.path] !== "full");
  if (fresh.length === 0) process.exit(0);

  // Cap-aware packing: corrections first (full text), then steering; overflow → pointer lines
  fresh.sort((a, b) => (a.type === "correction" ? 0 : 1) - (b.type === "correction" ? 0 : 1));
  let ctx = "[svc rule-injector] Subject-matter rules for this change:\n";
  const pointers = [];
  for (const e of fresh) {
    let text = "";
    const rulesRoot = process.env.SVC_RULES_ROOT || SVC_ROOT;
    try { text = readFileSync(path.join(rulesRoot, e.path), "utf8"); } catch { continue; }
    if (ctx.length + text.length + 64 <= BUDGET) {
      ctx += `\n--- ${e.path} ---\n${text}\n`;
      memoRaw[e.path] = "full";
    } else {
      pointers.push(e.path);
      if (memoRaw[e.path] !== "pointer") memoRaw[e.path] = "pointer";  // re-eligible for full later
    }
  }
  if (pointers.length) {
    ctx += `\nAlso applicable (Read before relying): ${pointers.join(", ")}\n`;
  }
  ctx = ctx.slice(0, CAP);

  try {
    mkdirSync(path.dirname(memoPath), { recursive: true });
    writeFileSync(memoPath, JSON.stringify(memoRaw));
  } catch { /* fail-open */ }

  const out = { hookSpecificOutput: { hookEventName: event, additionalContext: ctx } };
  if (event === "PreToolUse") out.hookSpecificOutput.permissionDecision = "allow";
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

main();
```

### 1. CREATE test-framework/evals/tier-1/validate-rule-injection.sh (full contents)

```bash
#!/usr/bin/env bash
# validate-rule-injection.sh — Tier-1 validator for WI-361.
# Hermetic: drives hooks/svc-rule-injector.mjs with synthetic stdin payloads
# against the REAL registry; asserts classification invariants + linter schema.
# Promotion note: docs/plans/2026-06-07-wi-361-rule-injection/manifest.md

set -u
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$REPO_ROOT" || exit 1
TMP="$(mktemp -d /tmp/wi361-inject.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT
INJ="hooks/svc-rule-injector.mjs"

PASS=0; FAIL=0
check() { local l="$1"; shift; if "$@" >/dev/null 2>&1; then echo "  ✓ $l"; PASS=$((PASS+1)); else echo "  ✗ $l"; FAIL=$((FAIL+1)); fi; }

payload() { # tool file session -> stdin JSON
  python3 -c "import json,sys;print(json.dumps({'hook_event_name':sys.argv[1],'tool_name':sys.argv[2],'tool_input':{sys.argv[3]:sys.argv[4]},'session_id':sys.argv[5]}))" "$1" "$2" "$3" "$4" "$5"
}
run_inj() { env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE node "$INJ"; }

echo "=== Tier 1: rule injection (WI-361) ==="

check "injector exists + node syntax" node --check "$INJ"

# I1: registry classification invariants
check "every entry has auto_inject" python3 -c "
import json;m=json.load(open('skills-manifest.json'))
assert all(e.get('auto_inject') in ('always','signal','lazy') for e in m['rulesRegistry']['entries'])"
check "exactly 6 always entries" python3 -c "
import json;m=json.load(open('skills-manifest.json'))
assert sum(e['auto_inject']=='always' for e in m['rulesRegistry']['entries'])==6"
check "every signal entry has >=1 signal source" python3 -c "
import json;m=json.load(open('skills-manifest.json'))
for e in m['rulesRegistry']['entries']:
    if e['auto_inject']=='signal':
        s=e.get('signals',{}) or {}
        assert s.get('paths') or s.get('bash') or 'concern-bridge' in (e.get('notes','') or ''), e['path']"

# I2: PreToolUse(Edit) on a react file injects react rule with allow (fresh session s1)
rm -f .svc/rule-injections-wi361s1.json
OUT1=$(payload PreToolUse Edit file_path src/components/App.tsx wi361s1 | run_inj)
printf '%s' "$OUT1" > "$TMP/o1.json"
check "I2 react rule injected pre-edit" grep -q "react/coding-style" "$TMP/o1.json"
check "I2 permissionDecision allow present" grep -q '"permissionDecision":"allow"' "$TMP/o1.json"
check "I2 under 10K cap" python3 -c "
import json;d=json.load(open('$TMP/o1.json'));assert len(d['hookSpecificOutput']['additionalContext'])<=10000"

# I3: memo suppresses second touch (same session) — single-rule path (.go)
# so the cap cannot pointer anything (pointer rules re-arrive BY DESIGN, I11b)
rm -f .svc/rule-injections-wi361s1b.json
OUTg=$(payload PreToolUse Edit file_path src/main.go wi361s1b | run_inj)
printf '%s' "$OUTg" | grep -q "golang/patterns" || echo "  (warn: golang not injected first?)"
OUT2=$(payload PreToolUse Edit file_path src/util.go wi361s1b | run_inj)
check "I3 memo suppresses repeat (empty output)" test -z "$OUT2"

# I4: Bash keyword trigger (gh workflow class)
rm -f .svc/rule-injections-wi361s2.json
OUT3=$(payload PreToolUse Bash command "gh workflow run build.yml --ref main" wi361s2 | run_inj)
printf '%s' "$OUT3" > "$TMP/o3.json"
check "I4 bash-keyword rule injected" grep -q "gh-workflow-validation\|cross-ref-workflow" "$TMP/o3.json"

# I5: explore trigger (PostToolUse Read) — no permissionDecision on PostToolUse
rm -f .svc/rule-injections-wi361s3.json
OUT4=$(payload PostToolUse Read file_path e2e/specs/j1.spec.ts wi361s3 | run_inj)
printf '%s' "$OUT4" > "$TMP/o4.json"
check "I5 e2e rules injected on explore" grep -q "transient-ui-assertion\|tenant-scoped" "$TMP/o4.json"
check "I5 no permissionDecision on PostToolUse" bash -c "! grep -q permissionDecision '$TMP/o4.json'"

# I6: non-matching path → silent exit 0
OUT5=$(payload PreToolUse Edit file_path README.md wi361s4 | run_inj); RC=$?
check "I6 non-match silent" bash -c "test -z '$OUT5' && test $RC -eq 0"

# I7: always-set never appears in injector output (they live in global dir)
check "I7 always rules not signal-classified" python3 -c "
import json;m=json.load(open('skills-manifest.json'))
always={e['path'] for e in m['rulesRegistry']['entries'] if e['auto_inject']=='always'}
sig={e['path'] for e in m['rulesRegistry']['entries'] if e['auto_inject']=='signal'}
assert not (always & sig)"

# I8: linter passes with new schema
check "I8 lint-skills-manifest green" node scripts/lint-skills-manifest.mjs

# I9: setup installs only always (static)
check "I9 setup filters auto_inject==always" grep -q "auto_inject" setup
check "I9b setup backs up before trim" grep -q "rules-backup\|svc-backup" setup

# I10 (PLAN-004): bridge-ONLY proof — fixture registries where the rule has NO
# direct path/bash/keyword signal; only the concern's handled_by.required_rules
# can produce the injection.
rm -f .svc/rule-injections-wi361s5.json
python3 - "$TMP" <<'PY'
import json,sys
t=sys.argv[1]
json.dump({"rulesRegistry":{"entries":[{"path":"rules/post-fix-evidence-before-next-fix.md","type":"correction","auto_inject":"signal","notes":"concern-bridge only (fixture)","signals":{}}]}},open(f"{t}/fixture-manifest.json","w"))
json.dump({"concerns":[{"name":"fixture-bridge","signals":{"file_path_patterns":["**/bridge-target/**"]},"handled_by":{"required_rules":["post-fix-evidence-before-next-fix"]},"fires_off":[]}]},open(f"{t}/fixture-concerns.json","w"))
PY
OUT6=$(payload PreToolUse Edit file_path src/bridge-target/x.js wi361s5 |   SVC_RULES_MANIFEST="$TMP/fixture-manifest.json" SVC_CONCERNS_REGISTRY="$TMP/fixture-concerns.json" run_inj)
printf '%s' "$OUT6" > "$TMP/o6.json"
check "I10 bridge-ONLY injection (no direct signals possible)" grep -q "post-fix-evidence" "$TMP/o6.json"

# I11 (PLAN-003): pointer-state rules stay eligible for FULL injection later
rm -f .svc/rule-injections-wi361s6.json
python3 - "$TMP" <<'PY'
import json,sys,os
t=sys.argv[1]
os.makedirs(f"{t}/bigrules/rules",exist_ok=True)
open(f"{t}/bigrules/rules/big-a.md","w").write("A"*6000)
open(f"{t}/bigrules/rules/big-b.md","w").write("B"*6000)
json.dump({"rulesRegistry":{"entries":[
 {"path":"rules/big-a.md","type":"correction","auto_inject":"signal","signals":{"paths":["overflow-target"]}},
 {"path":"rules/big-b.md","type":"correction","auto_inject":"signal","signals":{"paths":["overflow-target"]}}]}},open(f"{t}/fixture-overflow.json","w"))
PY
O1=$(payload PreToolUse Edit file_path src/overflow-target/a.js wi361s6 |   SVC_RULES_MANIFEST="$TMP/fixture-overflow.json" SVC_RULES_ROOT="$TMP/bigrules" run_inj)
printf '%s' "$O1" > "$TMP/o7.json"
check "I11a first big rule full, second pointered" bash -c "grep -q 'AAAA' '$TMP/o7.json' && grep -q 'rules/big-b.md' '$TMP/o7.json' && ! grep -q 'BBBB' '$TMP/o7.json'"
O2=$(payload PreToolUse Edit file_path src/overflow-target/b.js wi361s6 |   SVC_RULES_MANIFEST="$TMP/fixture-overflow.json" SVC_RULES_ROOT="$TMP/bigrules" run_inj)
printf '%s' "$O2" > "$TMP/o8.json"
check "I11b pointered rule arrives FULL on next touch" grep -q "BBBB" "$TMP/o8.json"

# cleanup memo fixtures
rm -f .svc/rule-injections-wi361s*.json

echo ""
if [ "$FAIL" = 0 ]; then echo "  PASS — all $PASS rule-injection checks passed"; exit 0
else echo "  $FAIL failed, $PASS passed"; exit 1; fi
```

### 3. MODIFY `skills-manifest.json` — data change; content BUILT programmatically but APPLIED via the Write tool (G2 PLAN-007: the authenticity hook matches Edit|Write tool calls — bash/node writes would bypass the gate): every entry gains `auto_inject` per the classification table; the 30 signal entries gain `signals` objects with the regex sets from the table (stored as plain strings). Twin-citation for lazy entries appended to `notes`. **Sequencing: improve-framework skill-load receipt emitted in the worktree session BEFORE this edit (authenticity gate).**

### 4. MODIFY `scripts/lint-skills-manifest.mjs` — add rulesRegistry checks (anchored at the existing rulesRegistry validation block; executor pins exact context at apply time):

```javascript
// WI-361: auto_inject classification — identity-pinned, not just counted (G2 PLAN-006)
const AUTO_INJECT = new Set(["always", "signal", "lazy"]);
const ALWAYS_ALLOWLIST = new Set([
  "rules/common/question-fatigue.md",
  "rules/tool-selection.md",
  "rules/verify-state-before-context.md",
  "rules/learning-preload.md",
  "rules/long-output-to-file.md",
  "rules/common/research-before-build.md",
]);
const alwaysSeen = new Set();
for (const e of rulesEntries) {
  if (!AUTO_INJECT.has(e.auto_inject)) fail(`rulesRegistry: ${e.path} missing/invalid auto_inject`);
  if (e.auto_inject === "always") {
    alwaysSeen.add(e.path);
    if (!ALWAYS_ALLOWLIST.has(e.path)) fail(`rulesRegistry: ${e.path} marked always but not in ALWAYS_ALLOWLIST — change BOTH deliberately`);
    if (e.signals) fail(`rulesRegistry: ${e.path} always-mode must not carry signals`);
  }
  if (e.auto_inject === "lazy") {
    if (e.signals) fail(`rulesRegistry: ${e.path} lazy-mode must not carry signals`);
    if (!/twin:|consumer:/.test(e.notes || "")) fail(`rulesRegistry: ${e.path} lazy-mode needs a twin:/consumer: citation in notes`);
  }
  if (e.auto_inject === "signal") {
    const s = e.signals || {};
    const hasSignal = (s.paths && s.paths.length) || (s.bash && s.bash.length) || (s.keywords && s.keywords.length) || /concern-bridge/.test(e.notes || "");
    if (!hasSignal) fail(`rulesRegistry: ${e.path} signal-mode without signals`);
    for (const rx of [...(s.paths || []), ...(s.bash || []), ...(s.keywords || [])]) {
      try { new RegExp(rx); } catch { fail(`rulesRegistry: ${e.path} invalid signal regex: ${rx}`); }
    }
  }
}
for (const want of ALWAYS_ALLOWLIST) if (!alwaysSeen.has(want)) fail(`rulesRegistry: allowlisted always rule ${want} not marked always`);
```

### 5. MODIFY `setup` — in the rules-install block (anchored at the existing `# --- Install framework rules ---` section): filter installable global rules to registry entries with `auto_inject == "always"`; before first removal/copy, `cp -r` the existing target dir to `<dir>.svc-backup-<ts>` and print `restore: cp -r "<bak>/." "<dir>/"`; remove stale files in target not in the always-set (covers the 3 twin pairs + the 30 signal files).

### 6. MODIFY `scripts/wire-hooks.mjs` — additive emission (3 entries) + isAlreadyWired cases:

```javascript
// WI-361: rule injector — PRIMARY pre-edit injection (NOT async: must respond
// before the tool call so additionalContext lands pre-edit)
if (!DISABLED.has("svc-rule-injector-edit")) {
  entries.PreToolUse.push({
    id: "svc-rule-injector-edit",
    matcher: "Edit|Write",
    hooks: [{ type: "command", command: `node ${hooksDir}/svc-rule-injector.mjs` }],
  });
}
if (!DISABLED.has("svc-rule-injector-bash")) {
  entries.PreToolUse.push({
    id: "svc-rule-injector-bash",
    matcher: "Bash",
    hooks: [{ type: "command", command: `node ${hooksDir}/svc-rule-injector.mjs` }],
  });
}
if (!DISABLED.has("svc-rule-injector-explore")) {
  entries.PostToolUse.push({
    id: "svc-rule-injector-explore",
    matcher: "Read|Grep|Glob",
    hooks: [{ type: "command", command: `node ${hooksDir}/svc-rule-injector.mjs`, async: false }],
  });
}
```

(isAlreadyWired cases keyed on `svc-rule-injector.mjs` + matcher disambiguation via the three ids; explore entry stays sync — async PostToolUse injection would race the next model turn. hooks.json mirror rows added with descriptions.)

### 8. MODIFY `CLAUDE.md` — after the chain-mode paragraph: one line — "Rules load on demand (WI-361): 6 always-on behavioral rules live globally; the other 36 inject via `hooks/svc-rule-injector.mjs` when their path/command signals match (registry: `rulesRegistry.auto_inject`/`signals`)."

### 9. MODIFY `research/SKILL.md` — frontmatter gains `context: fork` (docs-verified v2.1.117+ field) so extraction runs in a forked subagent context.

## G2 Amendment Log (codex round-1, 2026-06-07 — 8 findings, all accepted; recovered from codex session transcript after its 5th output-corruption)

- **PLAN-001 CRITICAL:** setup trim was host-generic while the injector is Claude-only → kimi/gemini/opencode would lose 30 rules with no replacement. FIX: trim scoped to `--host claude` exclusively; other hosts keep full install; host-parity injectors = explicit follow-up. PLAN-008 (file-target host stale imports) subsumed — their paths untouched.
- **PLAN-002 HIGH:** injector bypassed the established `hooks/lib/hook-payload.mjs` normalizer and used process.cwd() → cross-host/absolute-path under-fire. FIX: readHookPayload/extractFilePath/extractCommand + payload.cwd-first relativization.
- **PLAN-003 HIGH:** overflow rules were memoized after pointer-only emission → full text permanently suppressed. FIX: two-state memo (full|pointer); pointer rules re-eligible; I11a/b fixtures force overflow and prove later full arrival.
- **PLAN-004 HIGH:** I10 was a false-positive (path also hit direct signals). FIX: SVC_RULES_MANIFEST/SVC_CONCERNS_REGISTRY/SVC_RULES_ROOT env overrides; I10 now bridge-ONLY fixture registries.
- **PLAN-005 HIGH:** content keywords dismissed as unavailable — Edit/Write payloads carry new_string/content. FIX: signals.keywords matched against edit content; regex-identifier-conventions class covered.
- **PLAN-006 MEDIUM:** exactly-6 count was identity-blind. FIX: ALWAYS_ALLOWLIST identity pinning both directions + always/lazy must not carry signals + lazy needs twin:/consumer: citation.
- **PLAN-007 MEDIUM:** "programmatic" manifest edit would BYPASS the authenticity hook (PreToolUse Edit|Write matcher). FIX: content built in /tmp but APPLIED via the Write tool so the gate fires after the improve-framework receipt.
- **PLAN-008 MEDIUM:** subsumed by PLAN-001 Claude-scoping.

## Tier-3 Amendment (gemini round-1, 2026-06-07)

- **T3-002 HIGH ACCEPTED:** globToRe was unanchored with broken `**` slash semantics (fires_off `tests/**` would substring-exclude `src/tests/...`; `**/x/**` missed top-level matches). Fixed verbatim per proposal: anchored `^…$`, `**/`→`(?:.*/)?`, `?`→`[^/]`.
- **T3-001 CRITICAL REJECTED with empirical evidence:** node resolves module `__dirname` via REALPATH — `~/.claude/skills/hooks` is a symlink to `<repo>/hooks` (verified live: module realpath = `<repo>/hooks/...`; `SVC_ROOT` = repo root; `~/.claude/skills/skills-manifest.json` resolves; the injector reads rule texts from the UNTRIMMED repo `rules/`, never from the trimmed `~/.claude/rules/`). The trim affects only the host's auto-read dir. Residual dependency (repo checkout must exist at symlink target) is identical for every existing svc hook. Cross-project case also covered: realpath is cwd-independent.

## Task Graph

| Task | Title | Files | Deps | AC | Validation | Checkpoint |
|---|---|---|---|---|---|---|
| task-1-validator | TDD RED: 15-check validator vs absent injector/classifications | 1 | — | AC-06 | validator exits NON-zero (injector absent; auto_inject absent; linter lacks schema) | `checkpoint-1-red` |
| task-2-injector | GREEN-1: the injector module | 2 | task-1 | AC-01,02,03 | I2-I6,I10 pass once registry lands (interim: node --check) | `checkpoint-2-injector` |
| task-3-registry-linter | GREEN-2: improve-framework receipt → manifest classifications → linter schema | 3,4 | task-2 | AC-04 | I1,I7,I8 pass; full validator 15/15 | `checkpoint-3-registry` |
| task-4-wiring-docs | GREEN-3: setup trim + wirer emission + hooks.json + CLAUDE.md + context:fork | 5,6,7,8,9 | task-3 | AC-05,07 | I9 pass; wire-hooks --list-all shows 3 injector entries; suite green | `checkpoint-4-wiring` |
| task-5-live-rewire | Machine state: setup-driven trim of global rules dir + settings rewire | — | task-4 | AC-08 | live: global rules dir == 6 always files; backup + restore line; injector wired in live settings; post-assertions logged | (External State row 1-2) |
| task-6-branch-validation | Full validation | — | 1-5 | AC-09 | suite 199/199; lint; diff == 9 planned files; residue classified | (gate before G5) |

## AC-to-Task / AC-to-Test Mapping

| AC | Statement | Task | Test |
|---|---|---|---|
| AC-01 | Signal rules arrive BEFORE first edit (PreToolUse allow+context) | task-2 | I2 + live spot-check |
| AC-02 | Memo: one injection per rule per session; steady-state = set lookup | task-2 | I3 |
| AC-03 | Bash-keyword + explore triggers work; PostToolUse shape correct | task-2 | I4, I5 |
| AC-04 | Registry fully classified (6/30/6); linter enforces schema + regex validity + always-count | task-3 | I1, I7, I8 |
| AC-05 | setup installs only always-set with backup/restore; wirer emits 3 entries | task-4 | I9 + --list-all probe |
| AC-06 | Validator RED pre-change (real TDD) | task-1 | checkpoint-1 log |
| AC-07 | CLAUDE.md discoverability + research context:fork | task-4 | grep probes |
| AC-08 | Live machine state: 6-file global dir; injector live; rollback proven | task-5 | live assertions log |
| AC-09 | Suite 199/199 (incl. new validator); Example Marketplace-class bridge works (I10) | task-6 | suite + I10 |

## Prerequisite Alignment Matrix

| Task | UX | UI | Tech design | Style contract | Persona |
|---|---|---|---|---|---|
| all | N/A (framework) | N/A | WI text (tri-model-reviewed) + docs-verified additionalContext matrix + this manifest's classification table | hook idiom: stdin payload via readFileSync(0), fail-open exit 0, hooks/lib pattern; wire-hooks WI-359 idiom for emission | P0 operator: every session on every project gains ~25-30K tokens/turn |

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|-------------|------------|----------|------------------|
| 1 | global Claude rules dir (machine state) | TRIMMED at task-5: 36 files/121.5KB → 6 always files (~18KB); 3 twin pairs removed | coupled | setup performs trim with timestamped dir backup + printed restore line; registry is source of truth; validator I9 greps the filter + backup |
| 2 | global Claude settings.json | injector entries wired at task-5 (via WI-359-hardened wire-hooks: backup + dedup + canonical) | coupled | wire-hooks backup mechanism (shipped WI-359); restore line printed |
| 3 | .svc/rule-injections-<session>.json memos | CREATED per session at runtime | decoupled-justified | gitignored .svc/*.json class; stale memos are inert (keyed by session id); WI-369 telemetry may sweep |
| 4 | /tmp validator fixtures | CREATED per run | decoupled-justified | trap rm -rf |
| 5 | Next-session behavior (injector + trimmed always-set activation) | RELIED ON | decoupled-justified | settings/rules read at session start — in-session observation impossible (platform constraint, same as WI-359 row 5); mitigation: structural assertions on written state + 15-check validator + docs-verified field semantics + rollback (2 independent restore lines) |
| 6 | worktree-local .svc/wi-361-checkpoints.log | CREATED at checkpoints | decoupled-justified | dies with worktree; commit-subject anchors |

**Decoupled-justified prose (rows 3-6):** memos are session-keyed inert caches; fixtures trap-cleaned; next-session activation is the same platform constraint accepted at WI-359 with the same mitigation pattern (structural assertion + docs verdict + tested restore); checkpoint ledger has commit-subject fallback.

Untouched taxonomy environments (walked, nothing): package registries, DBs, CI, browser, OAuth, cloud, schedulers, MCP, containers, OS services, webhooks, marketplaces, git notes (no receipt-schema change).

## Lane Compliance (artifact-cited)

| Chain skill | Status | Artifact / citation |
|---|---|---|
| route-workflow (task 1) | completed | graph + P1-P6 logs + pipeline-decisions WI-361 routing entry (2026-06-07, full-armor declared) + session contract |
| WI/spec acceptance | completed | docs/specs/work-items/WI-361.md IS the spec (precedent PR #29-#32) |
| plan-changeset (task 2) | completed | this manifest; phases P1-P6; receipt |
| review-plan (task 3) | in progress | docs/plans/2026-06-07-wi-361-rule-injection/review-log.yaml (written at P5) |
| improve-framework (manifest-edit gate) | scheduled inside task-3 | skill-load receipt emitted in worktree session <90min before skills-manifest.json edit (authenticity hook requirement) |
| execute → verify (4-8) | pending | graph order |
| design-tech (9) | skipped | top-level skip_reason + routing decision entry (design pre-baked: tri-model-reviewed WI text + docs-verified event matrix) |

## Validation Plan

Task-level in §Task Graph. **Final:** suite 199/199 · lint · diff == 9 files · residue classified per leftover-disposition. **Speed levers (declared):** landing push's gate run reused as post-merge evidence on tree-identity; codex-once-then-gemini on review corruption.

**Live-rewire procedure (task-5; AFTER GREEN; backups first):**

```bash
# 1. pre-state: count global rules files + bytes (expect 36 / ~121.5KB)
ls ~/.claude/rules/*.md | wc -l | tee -a .svc/wi-361-live-rewire.log
# 2. re-run setup for claude host from the worktree (trim happens inside w/ backup)
./setup --host claude 2>&1 | tee -a .svc/wi-361-live-rewire.log
# 3. wire hooks (injector entries; WI-359 backup fires)
node scripts/wire-hooks.mjs --skills-path ~/.claude/skills --settings ~/.claude/settings.json 2>&1 | tee -a .svc/wi-361-live-rewire.log
# 4. post-assertions: exactly 6 rule files; injector wired x3; backups exist; restore lines captured
python3 - <<'PY' 2>&1 | tee -a .svc/wi-361-live-rewire.log
import json,os,glob
files=glob.glob(os.path.expanduser('~/.claude/rules/*.md'))
assert len(files)==6, f'rules dir has {len(files)} files, want 6'
s=json.load(open(os.path.expanduser('~/.claude/settings.json')))
inj=sum('svc-rule-injector' in h.get('command','') for ev in s['hooks'] for r in s['hooks'][ev] for h in r.get('hooks',[]))
assert inj==3, f'injector wired {inj}x, want 3'
print('LIVE POST-ASSERTIONS PASS: 6 rules,', inj, 'injector entries')
PY
# 5. rollback paths: grep 'restore:' .svc/wi-361-live-rewire.log  (two independent lines)
```

## Execution Command Sequence

```bash
bash scripts/worktree.sh create feature-wi-361-rule-injection
# task-1 RED (status-gated)
set +e; bash test-framework/evals/tier-1/validate-rule-injection.sh; RED=$?; set -e
test "$RED" -ne 0 && echo "RED=$RED ok"
git add test-framework/evals/tier-1/validate-rule-injection.sh
git commit -m "test(WI-361): checkpoint-1-red" && mkdir -p .svc && git rev-parse HEAD >> .svc/wi-361-checkpoints.log
# task-2 injector
git add hooks/svc-rule-injector.mjs && git commit -m "feat(WI-361): checkpoint-2-injector" && git rev-parse HEAD >> .svc/wi-361-checkpoints.log
# task-3: improve-framework receipt FIRST (authenticity gate), then registry + linter
node scripts/task-graph.mjs load-skill .svc/lane-tasks-WI-361.json 4 improve-framework   # skill-load receipt in-session
# G2 PLAN-007: the manifest edit MUST go through the Write tool (authenticity
# hook is PreToolUse Edit|Write — a bash/node file write would BYPASS the gate).
# Procedure: build the classified JSON in /tmp, READ it, then Write the full
# skills-manifest.json via the host Write tool so the hook fires and verifies
# the receipt. NEVER apply this edit via bash redirection or node fs.write.
git add skills-manifest.json scripts/lint-skills-manifest.mjs
git commit -m "feat(WI-361): checkpoint-3-registry" && git rev-parse HEAD >> .svc/wi-361-checkpoints.log
# task-4: setup + wirer + hooks.json + CLAUDE.md + research fork
git add setup scripts/wire-hooks.mjs hooks/hooks.json CLAUDE.md research/SKILL.md
git commit -m "feat(WI-361): checkpoint-4-wiring" && git rev-parse HEAD >> .svc/wi-361-checkpoints.log
# task-5 live rewire per §Validation Plan
# task-6 full validation
EVALS=0 bash test-framework/evals/run-all-evals.sh --tier1
node scripts/lint-skills-manifest.mjs
git diff --name-only main...HEAD | sort
# RECOVERY_IF_FAIL: WT="$(git rev-parse --show-toplevel)"; rescue-branch if dirty;
#   CKPT from worktree ledger or log --grep checkpoint-; git -C "$WT" reset --keep "$CKPT"
#   LIVE rollback: two restore lines in .svc/wi-361-live-rewire.log (rules dir + settings)
```

## Checkpoint Plan

1. `checkpoint-1-red` · 2. `checkpoint-2-injector` · 3. `checkpoint-3-registry` · 4. `checkpoint-4-wiring` — worktree ledger + commit-subject anchors; live rewire only after all four.

## Loop-Back Targets

- additionalContext not visible in live next-session spot-check → restore both backups; re-verify docs (the field matrix is agent-verified, not hand-tested — G7 carries the first live observation)
- A signal regex over-fires (noise) or under-fires (miss) in live use → registry data fix via quick-fix? NO — manifest is denylisted; signal tuning = small follow-up chain runs (documented; WI-369 telemetry informs)
- Linter always-count constraint blocks a legitimate future always-rule → adjust constant in same change that adds the rule (the check is a tripwire, not a cap doctrine)

## Promotion Readiness Checklist

- [x] 2 CREATE + 7 MODIFY accounted; machine state in External State
- [x] Real TDD; 15-assertion validator incl. Example Marketplace-class bridge (I10)
- [x] 9 ACs mapped
- [x] Final diff == 9 files enforced
- [x] Promotion note (5 fields)
- [x] Authenticity gate sequenced (improve-framework receipt before manifest edit)
- [x] Host-capability verification embedded (additionalContext matrix, agent-verified 2026-06-07)
- [x] No banned scope-reduction phrases

## Simulation Report (2026-06-07)

| # | Check | Result |
|---|-------|--------|
| 1-2 | Both CREATE targets absent on disk | PASS |
| 3 | concerns/REGISTRY.json real shape pinned: `signals.file_path_patterns` = GLOBS; rules at `handled_by.required_rules`; `fires_off` exclusions — bridge blueprint corrected to real shape (glob→regex in-process) | PASS (initial blueprint assumption falsified and fixed pre-review) |
| 4 | setup anchor `# --- Install framework rules ---` present (line 258) | PASS |
| 5 | linter has existing rulesRegistry block (10 refs) — schema additions anchor there | PASS |
| 6 | research/SKILL.md frontmatter present, no existing `context:` key conflict | PASS |
| 7 | additionalContext per-event matrix agent-verified against live docs (PreToolUse allow+context confirmed; 10K cap) | PASS |
| 8 | Live rules dir measured: 36 files / 121,502 bytes / 3 identical twin pairs | PASS (evidence for trim claims) |

## Adversarial Self-Pass (10-check, inline)

| # | Lens | Verdict |
|---|---|---|
| 1 | Archetype fit (cross-cutting: entry points enumerated — registry/hook/installer/linter/wirer/docs) | PASS — 2 CREATE + 7 MODIFY |
| 2 | Invariants (rule files unchanged; concerns untouched; @-import path intact; WI-359 wirer layers additive-only) | PASS |
| 3 | TDD real (15-check validator RED: injector absent, classifications absent, linter schema absent) | PASS |
| 4 | Rollback (TWO independent restore lines: rules-dir backup + settings backup; repo checkpoints ×4) | PASS |
| 5 | Scope creep | WATCH — 9 files is the largest WI yet, but each maps to a WI-text deliverable; context:fork is WI-guardrail-mandated |
| 6 | Injection correctness risk (rules not arriving) | MITIGATED — PRIMARY PreToolUse pre-edit (docs-verified), explore+bash triggers, concern bridge, 15 assertions incl. Example Marketplace-class I10 |
| 7 | Noise risk (over-injection) | MITIGATED — per-session memo (one shot per rule), 10K cap with pointer overflow, signal regexes narrow per rule |
| 8 | First-miss risk on lazy set | ACKNOWLEDGED — each lazy rule cites its mechanical twin; doctrine: twin enforces even when text absent |
| 9 | Machine-state blast radius (rules dir + settings, every session) | MITIGATED — trim only via setup with backup; injector fail-open (any error → exit 0 silent); next-session activation = WI-359-precedent constraint with structural assertions |
| 10 | Hook latency (3 new spawns on hot matchers) | ACKNOWLEDGED — memo-hit path = parse+lookup (~10-20ms); net session economics massively positive (~30K tokens saved vs 3 spawns); WI-370 consolidation absorbs spawn count next |
