# Changeset Manifest — WI-494: Codex enforcer zero-state deadlock + read misclassification

**WI:** WI-494 | **Lane:** framework | **Tier:** full | **Mode:** `dispatch`
**Branch:** wi494-codex-enforcer-bootstrap-deadlock | **Base:** f6804b78
**Inputs:** `docs/specs/work-items/WI-494.md`, `docs/specs/bugfix/wi-494-codex-enforcer-brief.md`

---

## 1. Problem archetype

**Archetype: Broken Invariant** (not Missing Feature). The enforcer's intended
invariant — *"governed mutation requires an owned in_progress task; zero-state has
exactly one authorized exit"* — is not implemented: zero-state has **zero** exits.
The fix restores the intended invariant rather than adding capability. Consequence
for planning: the bar is not "does the new path work" but "**does the new path admit
exactly one thing and nothing else**." Every blueprint below is written negative-first.

## 2. Upstream lane compliance

`skills-manifest.json laneDefinitions.framework.notes` — "Broken framework behavior
may start in `diagnose-bug`." WI-494 is broken behavior; `diagnose-bug` is the
legitimate entry. `design-tech` is recorded as an explicit `skipped` task with a
`skip_reason` (Broken-Invariant archetype: no new component/boundary/data model; the
real design decisions live in §4 and §6 and are under adversarial review at task 4).

**F-007 — mechanical lane-compliance ledger.** The mandatory upstream set is the **9**
skills in `skills-manifest.json laneDefinitions.framework.skills` (verify against that
key). Denominator = **9 mandatory lane skills → 0 completed + 9 skipped-with-cited-
justification** in `upstream_skipped_with_justification`. `diagnose-bug` is NOT one of the
9 — it is the lane ENTRY authorized by `laneDefinitions.framework.notes` ("broken
framework behavior may start in diagnose-bug") and is tracked in `upstream_completed`.
`design-tech` is a separate phase-gate skip (task 10). So: 9/9 mandatory-lane skills
resolved, +1 lane-entry completed, +1 phase skill skipped. No unnamed mandatory skill:

| Skill | In the 9? | Status | Artifact / cited justification |
|---|---|---|---|
| `diagnose-bug` | no (lane entry) | **completed** | `docs/specs/bugfix/wi-494-codex-enforcer-brief.md` (task 2) |
| `test-framework` | yes | skipped | ledger: extends EXISTING tier-1 `validate-codex-execution-integrity.sh` (task 5); no new eval tier |
| `evolve-framework` | yes | skipped | ledger: broken BEHAVIOR not capability gap; entry is diagnose-bug per lane notes |
| `improve-framework` | yes | skipped | ledger: defect repair vs authored intake CED-01..07; no capability ideation surface |
| `blend-external` | yes | skipped | ledger: no external source blended |
| `blend-private` | yes | skipped | ledger: no private source blended |
| `recall-stack-knowledge` | yes | skipped | ledger: host-capability research done in-task vs codex.json + live hook source |
| `plan-blast-radius` | yes | skipped | ledger: subsumed by change_impact tier infra-path + triad owned by task 3 |
| `track-topology-diff` | yes | skipped | ledger: no topology change — three existing files edited + two new libs, no boundary shift |
| `refresh-competitors` | yes | skipped | ledger: N/A to an internal enforcement defect |
| `design-tech` | no (phase) | skipped | task 10, `skip_reason` on graph — Broken-Invariant archetype |

**Citation (round-3 F-004):** the authoritative skip ledger is the STRUCTURED
`upstream_skipped_with_justification[]` array in `.svc/lane-tasks-WI-494.json` — each
element is `{skill, reason}`, which is the record the phase-gate
(`hooks/svc-workflow-guard.mjs` `getSkillStatus`) and `task-graph.mjs validate` actually
enforce; the `ledger:` prose in the table above is a verbatim transcription of each
`.reason`. This graph ledger is the sanctioned skip-citation mechanism for the framework
lane (skips recorded as `skip_reason`/`upstream_skipped_with_justification`, not as free
`.svc/pipeline-decisions.jsonl` entries). Mechanical audit command (fails on missing,
extra, or duplicate names — run at review and in tier-1):

```bash
node -e '
const m=require("./skills-manifest.json").laneDefinitions.framework.skills;   // the 9
const g=require("./.svc/lane-tasks-WI-494.json");
const done=new Set(g.upstream_completed||[]);
const skipped=new Set((g.upstream_skipped_with_justification||[]).map(s=>s.skill));
const missing=m.filter(s=>!done.has(s)&&!skipped.has(s));
const uncited=(g.upstream_skipped_with_justification||[]).filter(s=>!String(s.reason||"").trim()).map(s=>s.skill);
if(missing.length||uncited.length){console.error("LANE FAIL missing=",missing,"uncited=",uncited);process.exit(1)}
console.log("lane OK: 9/9 mandatory resolved, all skips cited");'
```

## 3. Change-impact triad

- **`change_impact.tier`: `infra-path`** — `hooks/codex/*` runs on **every Codex tool
  call**; it is the governed-mutation decision boundary.
- **`triad_owner_task`: 3** (this task).

| Leg | Assessment |
|---|---|
| **Blast radius** | Every Codex-host tool call in every repo — the hot path. 5 code files (2 new libs `argv-lex`+`bootstrap-marker`, 3 edited: `codex-hook-context`, the enforcer, and `svc-ensure-worktree.mjs` for the shared-marker import) + the tier-1 validator. The `svc-ensure-worktree.mjs` edit is behavior-preserving (marker read single-sourced), covered by existing bootstrap vectors. A regression that *over-allows* silently disables governance framework-wide; one that *over-denies* reproduces the WI-494 outage. No Claude-host impact (no port — §9). |
| **Reversibility** | High. The classification/bootstrap changes are pure functions behind existing call sites (`isReadOnlyTool`, plus a new sibling of `isSkillLoaderShape`); the `svc-ensure-worktree.mjs` change is an import swap. Revert = drop the two new libs + restore the three predicates and the local marker helpers. No migration, no state format change, no on-disk artifact. |
| **Detection** | Over-deny: loud and immediate (agent blocked, as in the live incident). Over-allow: **silent** — governance simply stops firing with no error. Asymmetric, so tier-1 negative fixtures (CED-05/06) are the primary detector, not the positive ones. This asymmetry sets the review posture in §10. |

## 4. Design constraints (binding)

1. **Zero runtime dependencies.** No `package.json`, no `node_modules` in this repo;
   hooks execute inside *arbitrary* user repos via the WI-487 durable launcher. Per
   `rules/common/research-before-build.md` the registry was checked — `shell-quote` is
   the proven prior art — but it is **not adoptable**: an npm import in a hook would
   throw `ERR_MODULE_NOT_FOUND` in every consumer repo. We therefore **port its
   tokenizer semantics** (quote-state machine, reject-on-expansion) into a vendored
   zero-dep module rather than invent a scheme. This is the "port a proven approach"
   branch, and the constraint is why we are not taking the dependency.
2. **Fail-closed is the default, not the fallback.** Both new predicates return
   `false` on ANY unrecognized input, parse failure, or thrown exception.
3. **No new authority source.** The bootstrap exception must not invent a second way
   to be "owned"; it reuses WI-486's `.svc/bootstrap-intent/<WI>.json` marker
   (`svc-ensure-worktree.mjs:196-229`). The AUTHORITATIVE marker schema
   (`newMarker`, L213-229) is: `schema_version, session_id, owner_token, pid,
   process_start_token, hostname, wi, branch, target_worktree, base_sha,
   created_paths, started_at, renewed_at`. **`wi` and `branch` ARE present** (F-003
   corrected an earlier under-listing here) — so the enforcer's `wi`/`branch` cross-
   checks bind against real fields and a valid same-session rerun passes. `session_id`
   is the ownership-identity axis (the same axis `isSkillLoaderShape` binds through
   `laneGraphs`→tuple); `owner_token`/`pid`/`process_start_token` are process-liveness,
   not session identity, and the enforcer deliberately does not gate on them (a marker
   whose writer process has exited is still a legitimate same-session rerun anchor).
   The enforcer reads the marker via the SAME `readMarker` accessor
   (`svc-ensure-worktree.mjs:201-211`, uid+regular-file+non-symlink checks) rather than
   a re-derived reader, so validation stays consistent with the writer (F-003).
4. **The exception is zero-state-only.** It must evaporate the moment a graph is
   owned, so it can never race or override `isSkillLoaderShape`.

## 5. Files planned

| # | File | Change | AC | Task |
|---|---|---|---|---|
| 1 | `hooks/codex/lib/argv-lex.mjs` | **NEW** — zero-dep POSIX-subset tokenizer | CED-04, CED-05 | 5 |
| 2 | `hooks/codex/lib/bootstrap-marker.mjs` | **NEW** — shared `markerPathFor` + tri-state `readMarker` (F-003) | CED-02 | 5 |
| 3 | `hooks/codex/lib/codex-hook-context.mjs` | rewrite `isReadOnlyTool`; add read verb tables | CED-03, CED-04, CED-05 | 5 |
| 4 | `hooks/codex/svc-codex-skill-load-enforcer.mjs` | add `isBootstrapShape`; wire at the `else` branch; fix dead-end diagnostic | CED-01, CED-02, CED-06 | 5 |
| 5 | `scripts/svc-ensure-worktree.mjs` | **MODIFY (F-003)** — replace module-local `markerPathFor`/`readMarker` with imports from the shared lib; behavior-preserving | CED-02 | 5 |
| 6 | `test-framework/evals/tier-1/validate-codex-execution-integrity.sh` | extend: 4 new vector groups + concurrency + marker tri-state | CED-07 | 5 |

**F-003 scope note:** the shared-marker extraction (file 2) means WI-494 now touches
**5 code files** (2 new libs + 3 edited: codex-hook-context, enforcer, ensure-worktree)
plus the validator. §3 blast radius, §8 rollback, and §6.4 tests are updated to match.
`svc-ensure-worktree.mjs` is a `scripts/` infra path — its edit is behavior-preserving
(same path derivation + secure-read semantics, now single-sourced) and covered by the
existing bootstrap tier-1 vectors, which MUST stay green (no bootstrap-behavior change).

## 6. Blueprints

### 6.1 NEW — `hooks/codex/lib/argv-lex.mjs`

Single export. Returns `{ok:true, argv}` **only** for commands that are a single
simple command with no shell control/expansion. Everything else → `{ok:false, reason}`.

```js
// WI-494 (CED-04/05): zero-dep POSIX-subset tokenizer. Replaces the lexical
// metacharacter bail in isReadOnlyTool, which classified EVERY quoted command as a
// governed mutation (WI-494 defect B, incl. `cat "my file.txt"`).
//
// Contract: this is NOT a shell. It accepts ONE simple command built from literals,
// single-quoted strings, and double-quoted strings free of expansion. It REJECTS --
// never "best-effort parses" -- every construct that could execute or redirect:
// substitution, expansion, pipes, lists, redirects, background, newlines.
// Rejection is the safe direction: a rejected read merely requires a receipt.
const REJECT = (reason) => ({ ok: false, reason });

export function lexSimpleCommand(input) {
  const src = String(input ?? "");
  if (!src.trim()) return REJECT("empty");
  if (src.length > 4096) return REJECT("oversized");
  // Control chars (incl. newline, CR, NUL) are never part of a simple command.
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(src)) return REJECT("control character");

  const argv = [];
  let cur = "";
  let has = false;          // current token exists (so `""` yields an empty arg)
  let i = 0;
  const push = () => { if (has) { argv.push(cur); cur = ""; has = false; } };

  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t") { push(); i += 1; continue; }
    // Unquoted shell-active characters: reject outright. `\` is rejected too --
    // escaping is legal shell but adds a second quoting grammar for no read-path
    // benefit, and rejecting keeps the accepted language small enough to audit.
    // WI-494 F-001 (critical): the reject set MUST cover EVERY unquoted construct a
    // real shell expands or strips before exec, or the returned argv differs from
    // what runs. Beyond control operators/redirects/substitution we therefore also
    // reject: glob (`* ? [ ]`), brace expansion (`{ }`), tilde (`~`), history (`!`),
    // and comment (`#`). Over-approximation is safe -- a rejected read costs a
    // receipt; an accepted glob/comment is a classification bypass (`cat *.md`,
    // `cat file # note`, `cat ~`). These chars are legal ONLY inside quotes, where
    // the quote branches below consume them literally.
    if (c === "|" || c === "&" || c === ";" || c === "<" || c === ">" ||
        c === "(" || c === ")" || c === "`" || c === "\\" ||
        c === "*" || c === "?" || c === "[" || c === "]" ||
        c === "{" || c === "}" || c === "~" || c === "!" || c === "#") {
      return REJECT(`unquoted shell-active character ${c}`);
    }
    if (c === "$") return REJECT("unquoted expansion");
    if (c === "'") {
      const end = src.indexOf("'", i + 1);
      if (end === -1) return REJECT("unterminated single quote");
      // Single quotes: everything literal, no expansion possible. `$` and backticks
      // inside are INERT -- this is precisely why `-o jsonpath='{.status}'` is a read.
      cur += src.slice(i + 1, end); has = true; i = end + 1; continue;
    }
    if (c === '"') {
      let j = i + 1; let body = "";
      for (;;) {
        if (j >= src.length) return REJECT("unterminated double quote");
        const d = src[j];
        if (d === '"') break;
        // Inside double quotes $ ` and \ REMAIN active in real shells -> reject.
        if (d === "$" || d === "`" || d === "\\") return REJECT("expansion inside double quotes");
        body += d; j += 1;
      }
      cur += body; has = true; i = j + 1; continue;
    }
    cur += c; has = true; i += 1;
  }
  push();
  if (!argv.length) return REJECT("no argv");
  return { ok: true, argv };
}
```

**Why `\` is rejected:** admitting it means implementing escape semantics in three
contexts (bare, double-quoted, `$'...'`), each a place to be subtly wrong. Rejecting
costs a receipt on rare commands; accepting risks a bypass. Reject.

### 6.2 `hooks/codex/lib/codex-hook-context.mjs` — read classification

Replace `isReadOnlyTool` (L227-236). `SAFE_BASH` (L188-191) and `isSafeGit`/`isSafeRg`/
`isSafeFind` are **re-expressed over argv** — their current regexes embed the same
metacharacter bail this WI removes, so leaving them string-based would preserve the bug.

```js
import { lexSimpleCommand } from "./argv-lex.mjs";

// Bare read binaries: any argv is a read (their flags cannot write).
const READ_BINARIES = new Set(["ls","pwd","cat","head","tail","wc","sha256sum","test","basename","dirname"]);

// Verb-gated read tools: ALLOWLIST of subcommands (never a denylist -- an unknown
// future subcommand must fail closed to "needs a receipt", not to "allowed").
const READ_SUBCOMMANDS = {
  kubectl: new Set(["get","describe","logs","top","explain","api-resources","api-versions","version","cluster-info","auth"]),
  gh:      new Set(["api","run","pr","issue","repo","release","search","workflow"]),
  argocd:  new Set(["app","proj","cluster","repo","version"]),
};

// Second-level gate for tools whose subcommand alone is not sufficient.
// null  => explicitly no second level required (e.g. `gh api`)
// Set   => second token MUST be a member
const READ_SUBSUB = {
  // F-004: `kubectl auth reconcile` WRITES; handled here. `kubectl cluster-info dump`
  // WRITES FILES; handled in HAZARD_FLAGS.kubectl below (it needs "deny when a specific
  // third token OR a write flag is present, else allow bare" — semantics the
  // required-member Set here cannot express).
  kubectl: { auth: new Set(["can-i"]) },
  // F-002 (round 3): `gh run download` WRITES artifacts to disk — removed from the read
  // set. Only `view`/`list` are reads under `gh run`.
  gh:     { run:new Set(["view","list"]), pr:new Set(["view","list","diff","checks","status"]),
            issue:new Set(["view","list","status"]), repo:new Set(["view","list"]),
            release:new Set(["view","list"]), workflow:new Set(["view","list"]), search:null, api:null },
  argocd: { app:new Set(["get","list","diff","history","manifests","logs","resources"]),
            proj:new Set(["get","list"]), cluster:new Set(["get","list"]), repo:new Set(["list"]), version:null },
};

// Flags that turn an otherwise-read invocation into a write or an exec.
// WI-494 F-002 (high): gh accepts every value-bearing flag in THREE spellings --
// separate (`-f k=v`), fused/attached (`-fk=v`, `-XDELETE`), and equals
// (`--field=k=v`, `--method=POST`, `--input=file`). Checking only exact tokens
// (`-f`, `-F`, `--input`) let the attached/equals forms evade the hazard gate and
// switch `gh api` from GET to a body-carrying mutation while classified read-only.
// The predicate below matches all three via startsWith on the short-flag stems and
// startsWith on the long `--flag=` stems. Executor MUST still capture `gh api --help`
// (rules/no-fabrication) and add ONE deny fixture per accepted spelling (F-002 fix).
const HAZARD_FLAGS = {
  gh: (argv) => argv.some((t) =>
         t === "-X" || t.startsWith("-X") ||            // -X POST | -XPOST
         t === "--method" || t.startsWith("--method=") ||
         t === "-f" || t.startsWith("-f") ||            // -f k=v | -fk=v
         t === "-F" || t.startsWith("-F") ||            // -F k=@f | -Fk=@f
         t === "--field" || t.startsWith("--field=") ||
         t === "--raw-field" || t.startsWith("--raw-field=") ||
         t === "--input" || t.startsWith("--input=")),
  // F-004: watch in ALL spellings (`--watch`, `-w`, `--watch=true`, `--watch-only=true`)
  // is a long-lived stream; `cluster-info dump` and any `--output-directory` write files.
  kubectl: (argv) => argv.some((t) =>
         t === "-w" || t === "--watch" || t.startsWith("--watch=") ||
         t === "--watch-only" || t.startsWith("--watch-only=") ||
         t === "--output-directory" || t.startsWith("--output-directory="))
         // sub===cluster-info: allow ONLY the bare form; deny `dump` and any writer flag.
         || (argv[1] === "cluster-info" && argv.length > 2),
  argocd: () => false,
};
// NOTE on gh short-flag collision: `gh api` has no benign read-only flag whose stem
// is `-f`/`-F`/`-X` (the global `--jq`/`-q`, `--paginate`, `--cache`, `--hostname`,
// `-H`/`--header` carry different stems), so startsWith("-f"|"-F"|"-X") cannot
// false-deny a real read. Executor: confirm against `gh api --help` before freeze.

function isReadCommand(argv) {
  const [bin, sub, subsub] = argv;
  if (READ_BINARIES.has(bin)) return true;
  if (bin === "git") return isSafeGitArgv(argv);
  if (bin === "rg")  return isSafeRgArgv(argv);
  if (bin === "find") return isSafeFindArgv(argv);
  const verbs = READ_SUBCOMMANDS[bin];
  if (!verbs) return false;
  if (!sub || !verbs.has(sub)) return false;
  if (HAZARD_FLAGS[bin]?.(argv)) return false;
  const second = READ_SUBSUB[bin]?.[sub];
  if (second === undefined) return true;   // no second level defined for this verb
  if (second === null) return true;        // explicitly no second level (e.g. `gh api`)
  return Boolean(subsub) && second.has(subsub);
}

export function isReadOnlyTool(ctx) {
  const name = toolName(ctx);
  if (READ_ONLY_TOOLS.has(name)) return true;
  if (name !== "Bash") return false;
  // WI-494 (CED-04/05): classify by PARSED argv. Quoting no longer promotes a read
  // to a governed mutation; unparseable / expansion-bearing / redirecting / piped
  // commands still fail closed to "requires a receipt".
  const lexed = lexSimpleCommand(mutationPayload(ctx).trim());
  if (!lexed.ok) return false;
  return isReadCommand(lexed.argv);
}
```

**F-004 (high): the three subordinate predicates are given in full — dispatch mode
requires copy-ready blueprints, and regex→argv is a security translation, not a
mechanical copy.** They preserve the EXACT denied-flag sets of the current
`isSafeGit`/`isSafeRg`/`isSafeFind` (`codex-hook-context.mjs:197-225`); the only
intended behavior change is that quoting no longer forces a receipt. Note the argv
form is STRICTER than the old regex on one axis — the old `find` regex allowed any
tail matching `[^;&|`$<>]*`; over argv we reject unknown/action primaries explicitly.

```js
// git: only status|log|diff|show, and none of the config-exec escape flags. Ported
// verbatim from L197-207; `--output`/`-o`/`--ext-diff`/`--textconv` can run a pager
// or external diff driver, so they are denied. `=`-forms of --output covered.
function isSafeGitArgv(argv) {
  if (argv[0] !== "git" || !new Set(["status","log","diff","show"]).has(argv[1])) return false;
  return !argv.slice(2).some((t) =>
    t === "-o" || t === "--output" || t.startsWith("--output=") ||
    t === "--ext-diff" || t === "--textconv");
}
// rg: deny the preprocessor / decompression escape flags (L209-220). Attached `=`
// forms of --pre / --hostname-bin covered; `-z`/`--search-zip` decompress via helpers.
function isSafeRgArgv(argv) {
  if (argv[0] !== "rg") return false;
  return !argv.slice(1).some((t) =>
    t === "--pre" || t.startsWith("--pre=") ||
    t === "--hostname-bin" || t.startsWith("--hostname-bin=") ||
    t === "-z" || t === "--search-zip");
}
// find: deny every primary that executes or writes (L222-224). The old regex denied
// -delete/-exec*/-ok*/-fprint*/-fls; argv form denies the same set as exact tokens
// (leading-dash primaries) so no `-execdir`-style variant slips a fused form.
function isSafeFindArgv(argv) {
  if (argv[0] !== "find") return false;
  const banned = new Set(["-delete","-exec","-execdir","-ok","-okdir","-fprint","-fprint0","-fprintf","-fls"]);
  return !argv.slice(1).some((t) => banned.has(t));
}
```

**Executor verification duties (do NOT resolve from memory — `rules/no-fabrication.md`):**
- `gh api --help` — confirm the fused `-XPOST`/`-fk=v`/`--input=` forms and the exact
  write-implying flag set (F-002). Add one deny fixture per accepted spelling.
- `kubectl auth --help` — confirm `can-i` is read and `reconcile` writes.
- `argocd app --help` — confirm `manifests`/`resources` are read-only in the installed
  version.
- Parity: for git/rg/find, run every currently-allowed and currently-denied form from
  the existing tier-1 corpus through BOTH old and new predicates; only the quoting
  axis may differ (F-004 parity fixtures).

**Deliberate exclusions, for the reviewer:**
- `-w/--watch` excluded: a long-lived stream in a PreToolUse-gated context.
- **Residual risk (accepted, argued in review):** `kubectl --kubeconfig=<path>` can
  name a config whose `exec` credential plugin runs an arbitrary binary. A genuine
  RCE-shaped surface that survives argv parsing. NOT mitigated here — the threat model
  is an *ungoverned-but-cooperative* agent, not an attacker choosing its own kubeconfig
  (an attacker with that power already has execution). Rejecting `--kubeconfig` would
  break ordinary multi-cluster reads. Logged as risk-acceptance per
  `rules/private-tool-security-pragmatism`; reviewer may overturn.

### 6.3 `hooks/codex/svc-codex-skill-load-enforcer.mjs` — zero-state exit

```js
// WI-494 (CED-01/02): the SECOND and FINAL bootstrap exception. WI-486 authorized the
// first skill LOAD with no in_progress task; it never authorized first graph CREATION,
// so `laneGraphs()` returned [] forever and isSkillLoaderShape could never pass --
// the graph could not exist until it existed (WI-494 defect A).
//
// This authorizes EXACTLY ONE command shape: the canonical worktree bootstrap. It is
// strictly narrower than isSkillLoaderShape in the dimension that matters: it applies
// ONLY in zero-state (no owned graph at all). The instant a graph is owned this
// returns false and isSkillLoaderShape governs -- the two can never both apply.
//
// F-001: the ENTIRE body is wrapped so any fs/graph/path/marker exception returns
// false (fail-closed per §4 constraint 2), and a valid session identity is REQUIRED
// before any authorization — a missing/blank ctx.session_id can never bootstrap.
function isBootstrapShape(payload, ctx, env = process.env) {
  try { return bootstrapShapeInner(payload, ctx, env); } catch { return false; }
}
function bootstrapShapeInner(payload, ctx, env) {
  if (toolName(payload) !== "Bash") return false;
  // F-001: a format-valid, non-empty session identity is a precondition. Codex session
  // ids are non-trivial tokens; require the same minimum the receipt path enforces.
  if (!ctx.session_id || String(ctx.session_id).length < 8) return false;
  const lexed = lexSimpleCommand(mutationPayload(payload).trim());
  if (!lexed.ok) return false;
  const argv = lexed.argv;
  if (argv[0] !== "node") return false;

  // The script must be THIS repo's canonical bootstrap -- not a shadowed copy.
  if (argv[1] !== "scripts/svc-ensure-worktree.mjs") return false;
  let scriptReal, canonicalReal;
  try { scriptReal = fs.realpathSync(path.resolve(ctx.repo_root, argv[1])); } catch { return false; }
  try { canonicalReal = fs.realpathSync(path.join(ctx.repo_root, "scripts", "svc-ensure-worktree.mjs")); } catch { return false; }
  if (scriptReal !== canonicalReal) return false;
  if (!scriptReal.startsWith(`${ctx.repo_root}${path.sep}`)) return false;

  // Flags: --wi and --branch REQUIRED; --from optional. Nothing else. An unknown flag
  // is a refusal, so a future ensure-worktree flag cannot silently widen this exit.
  const flags = Object.create(null);
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (key !== "--wi" && key !== "--branch" && key !== "--from") return false;
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) return false;
    if (flags[key]) return false;               // no duplicate flags
    flags[key] = value; i += 1;
  }
  if (!flags["--wi"] || !flags["--branch"]) return false;
  // Mirror svc-ensure-worktree.mjs:510-511 (WI_RE / BRANCH_RE). Executor: import or
  // re-derive from that file rather than hand-copying -- these MUST NOT drift apart.
  if (!/^WI-\d+$/.test(flags["--wi"])) return false;
  if (!/^[A-Za-z0-9._-]+$/.test(flags["--branch"])) return false;   // slash-free per L511
  if (flags["--branch"].includes("..")) return false;
  if (flags["--from"] && !/^[A-Za-z0-9._\/-]+$/.test(flags["--from"])) return false;
  if (flags["--from"] && flags["--from"].includes("..")) return false;

  // ZERO-STATE ONLY: if any graph is owned, this exception does not exist.
  if (laneGraphs(ctx.repo_root, env).length !== 0) return false;

  // CED-02 + F-001 TRI-STATE marker: the shared readMarker returns {state, marker}
  // where state ∈ absent | valid | invalid. Only `absent` (true zero-state, script
  // will create it under its lock) or a `valid` SAME-SESSION marker may authorize.
  // `invalid` (malformed JSON, symlink, non-regular file, wrong uid, read error) is a
  // DENY — never conflated with ENOENT (the F-001 fail-closed requirement). session_id/
  // wi/branch/target_worktree are real marker fields (§4 constraint 3); owner_token/pid
  // are process-liveness, so a same-session rerun after the writer exited still passes.
  const { state, marker } = readMarker(markerPathFor(ctx.repo_root, flags["--wi"]));
  if (state === "invalid") return false;
  if (state === "valid") {
    if (String(marker.session_id) !== String(ctx.session_id)) return false;   // both proven non-empty above
    if (String(marker.wi || "") !== flags["--wi"]) return false;
    if (String(marker.branch || "") !== flags["--branch"]) return false;
    let tReal;
    try { tReal = fs.realpathSync(String(marker.target_worktree || "")); } catch { return false; }
    if (tReal !== ctx.repo_root && !tReal.startsWith(`${ctx.repo_root}${path.sep}`)) return false;
  }
  // state === "absent" falls through to allow.
  return true;
}
```

**Concurrency — the correct invariant is per-(repo,WI,session), NOT repo-wide single-
winner (round-3 F-001, dispositioned).** This PreToolUse hook is a GATE, not a mutex: it
returns a decision and the command runs later, so the `laneGraphs()==0` + marker read
here are necessarily non-atomic. The atomicity that matters is supplied by the executed
script's pre-existing bootstrap lock in `svc-ensure-worktree.mjs`, keyed on
**canonical-repo-identity + WI** (WI-486 SIB-09/11; see the lock comment at
`svc-ensure-worktree.mjs:70-71`). What this guarantees:

- **Same (repo, WI):** the per-(repo,WI) lock serializes; exactly one graph
  `lane-tasks-<WI>.json` is created; concurrent same-WI callers converge on it.
- **Different WIs:** each bootstraps its OWN `lane-tasks-<WI>.json` **independently and
  concurrently — this is intended.** WI-486 is *session-isolated multi-WI bootstrap*; a
  repo legitimately hosts several WI graphs at once. **There is NO "one graph per repo"
  invariant, so a repo-wide single-winner lock is the WRONG fix — it would REGRESS
  WI-486's multi-WI model.** Round-3 F-001 assumed a single-repo-winner requirement;
  that requirement was mis-stated in this plan's round-2 revision and is withdrawn.

The enforcer's `laneGraphs()==0` gate is repo-wide only in the narrow sense that
`laneGraphs` returns the **session-owned** graph via the resolver tuple — a second WI in
a *different* session sees zero owned graphs and is correctly allowed to bootstrap its
own. WI-494's actual invariant — *"zero-state has exactly one authorized command
SHAPE"* — is about the command grammar (only the canonical `svc-ensure-worktree.mjs`
invocation), not about serializing graph count.

**Execution constraint (verify at task 5):** confirm `svc-ensure-worktree.mjs` performs
its graph/marker recheck INSIDE the per-(repo,WI) lock (not before it) and defines
stale-lock handling; if not, add that recheck there (do not add a new repo-wide lock).
**Fixtures:** (a) same-(repo,WI) race — two concurrent bootstrap executions, assert
exactly one graph created, the other converges without a duplicate/second graph;
(b) distinct-WI concurrency — two bootstraps for WI-A and WI-B, assert BOTH graphs are
created and neither is denied (proves multi-WI isolation is preserved, not broken).

**F-003 — shared marker module blueprint (`hooks/codex/lib/bootstrap-marker.mjs`, NEW):**
extracts `markerPathFor` + a tri-state `readMarker` from `svc-ensure-worktree.mjs`
(currently module-local, L197-211) so writer and enforcer share ONE definition.
`svc-ensure-worktree.mjs` is edited to import these (file 5 in §5). Copy-ready:

```js
// WI-494 F-001/F-003: single-sourced bootstrap-intent marker path + secure tri-state
// read. Shared by scripts/svc-ensure-worktree.mjs (writer) and the Codex enforcer.
import fs from "node:fs";
import path from "node:path";

export function markerPathFor(repoRoot, wi) {
  return path.join(repoRoot, ".svc", "bootstrap-intent", `${wi}.json`);
}

// Tri-state so callers can distinguish "no marker yet" (ENOENT -> absent, a legitimate
// zero-state) from "a marker exists but is not trustworthy" (-> invalid, fail closed).
// NEVER returns invalid as absent. Ownership/type/uid checks mirror the WI-486 writer,
// AND (F-003 round 3) the authoritative required fields are validated — an object that
// parses but lacks a required field or has a wrong-typed field is `invalid`, not `valid`.
const REQUIRED_STRING_FIELDS = ["session_id", "wi", "branch", "target_worktree"];
export function readMarker(markerPath) {
  let stat;
  try { stat = fs.lstatSync(markerPath); }
  catch (e) { return e && e.code === "ENOENT" ? { state: "absent", marker: null } : { state: "invalid", marker: null }; }
  if (!stat.isFile() || stat.isSymbolicLink()) return { state: "invalid", marker: null };
  if (typeof process.getuid === "function" && stat.uid !== process.getuid()) return { state: "invalid", marker: null };
  let value;
  try { value = JSON.parse(fs.readFileSync(markerPath, "utf8")); }
  catch { return { state: "invalid", marker: null }; }
  if (!value || typeof value !== "object" || Array.isArray(value)) return { state: "invalid", marker: null };
  if (value.schema_version !== 1) return { state: "invalid", marker: null };
  for (const f of REQUIRED_STRING_FIELDS) {
    if (typeof value[f] !== "string" || value[f].length === 0) return { state: "invalid", marker: null };
  }
  return { state: "valid", marker: value };
}
```

`svc-ensure-worktree.mjs` edit (F-003 round 3 — invalid must NOT be downgraded to
absence in the writer either): delete its local `markerPathFor`/`readMarker` (L197-211),
`import { markerPathFor, readMarker } from "../hooks/codex/lib/bootstrap-marker.mjs"`
(resolve the exact relative path at task 5), and update its call sites to branch on the
tri-state explicitly: `absent` → create; `valid` (+ownership match) → renew/reuse;
**`invalid` → HARD ERROR / abort, never overwrite or treat as absent** (a malformed or
foreign marker at bootstrap time is a conflict the operator must resolve, matching the
existing SIB "ambiguous bootstrap conflict; nothing was deleted" posture). This closes
the round-3 F-003 downgrade path at the post-lock recheck. The existing bootstrap tier-1
vectors MUST stay green (behavior-preserving for the absent/valid paths).

Wired at L131, ahead of the existing deny:

```js
} else {
  if (isSkillLoaderShape(payload, ctx, process.env)) { allow(); process.exit(0); }
  if (isBootstrapShape(payload, ctx, process.env)) { allow(); process.exit(0); }   // WI-494 CED-01
  if (active.diagnostic === "ambiguous active tasks") { deny(active.diagnostic, active); process.exit(0); }
  deny(...); process.exit(0);
}
```

**Also fix the dead-end diagnostic** (`deny()` L10-11). In zero-state the recovery
string is `resolve the active task graph before mutation` — advice that cannot be
followed, which is what left the live agent looping for ~6 turns. Make it name the exit:

```js
function deny(reason, active) {
  const command = active?.ok
    ? `node scripts/codex-load-skill.mjs --graph ${active.graph_path} --task ${active.task.id} --skill ${active.task.metadata?.skill || active.task.skill}`
    : "node scripts/svc-ensure-worktree.mjs --wi WI-<N> --branch <branch>   # no task graph yet -- bootstrap one (WI-494)";
  ...
}
```

### 6.4 `test-framework/evals/tier-1/validate-codex-execution-integrity.sh`

Extends the existing file (harness at L22/L251 already drives the hook). Four groups.

**F-005/F-006 — zero-state is an END-TO-END sequence run from a REAL checkout, not an
empty temp repo.** A PreToolUse hook only RETURNS a decision; it does not run the
command. AND `isBootstrapShape` requires the invoked `scripts/svc-ensure-worktree.mjs`
to `realpath`-equal `ctx.repo_root/scripts/svc-ensure-worktree.mjs` — an empty
`git init` temp repo has no `scripts/` tree, so the predicate could never pass there
(the F-005 defect). The fixture must therefore be an **isolated checkout of THIS
repository at HEAD** so the canonical script tree exists at the canonical relative path.

```
CED-01 zero-state end-to-end (must be RE-RUNNABLE with identical asserts):
 1. Use a DISPOSABLE CLONE, never `git worktree add` against this repo (round-3 F-005:
    a worktree registers a branch + admin state in the SOURCE repo that outlives the
    temp dir). A --local clone is fully self-contained — removing its dir removes all
    state, so no source mutation and no cross-run collision:
       REPO=$(mktemp -d); git clone --local --no-hardlinks . "$REPO"   # scripts/ at HEAD
       rm -rf "$REPO/.svc"/lane-tasks-*.json "$REPO/.svc/bootstrap-intent"  # TRUE zero-state
       git -C "$REPO" config user.email t@t; git -C "$REPO" config user.name t
       export SVC_CODEX_RUNTIME_DIR=$(mktemp -d); chmod 700 "$SVC_CODEX_RUNTIME_DIR"
    Use a UNIQUE WI + branch per invocation so a leaked artifact can never mask a
    collision: WI="WI-$RANDOM$RANDOM"; BR="wi-boot-$$-$RANDOM" (both regex-valid).
 2. drive hook, cwd=$REPO, session=sess-Alonger-than-8, tool=Bash,
    command=`node scripts/svc-ensure-worktree.mjs --wi $WI --branch $BR` -> assert allow
 3. ACTUALLY RUN that exact command in $REPO (SVC_SESSION_ID=sess-Alonger-than-8);
    assert exit 0. Determine the CREATED graph + marker paths from the script's own
    `--json`/stdout (do NOT hard-assume $REPO/.svc/…; the bootstrap may target a
    worktree it creates). Assert the lane-tasks graph and the $WI bootstrap-intent
    marker exist at the reported paths.
 4. drive hook with the canonical loader for the REPORTED graph path
    -> assert allow (isSkillLoaderShape now governs; deadlock exits in one hop)
 5. drive hook AGAIN with the step-2 bootstrap command -> assert DENY
    (a graph is now owned -> isBootstrapShape returns false; the exit closed behind it)
 6. rm -rf "$REPO" "$SVC_CODEX_RUNTIME_DIR"   # clone is self-contained; nothing leaks
    to the source repo. Assert `git worktree list` on THIS repo is unchanged.
```
Disposable self-contained clone + unique per-run WI/branch + private 0700 runtime dir +
full cleanup make the block re-runnable with identical asserts and zero source-repo
mutation.

| Group | Vector | Expect | AC |
|---|---|---|---|
| **Zero-state (e2e above)** | step 2 bootstrap, empty `.svc/` | **allow** | CED-01 |
| | step 4 loader on the graph the bootstrap actually created | **allow** | CED-01 |
| | step 5 second bootstrap once graph owned | **deny** | CED-02 |
| | `--branch ../../../etc/evil`, `--wi ../WI-1`, `--branch a/b` | **deny** | CED-02 |
| | marker for WI-999 owned by `sess-OTHER` (F-003) | **deny** | CED-02 |
| | marker with wrong `wi` / wrong `branch` / `target_worktree` outside repo (F-003) | **deny** | CED-02 |
| | marker same-session, writer pid dead — valid rerun (F-003) | **allow** | CED-01 |
| | `node scripts/task-graph.mjs init ...` (non-canonical creation) | **deny** | CED-02 |
| | unknown flag `--wi WI-9 --branch b --evil x`; duplicate `--wi` | **deny** | CED-02 |
| | `cat *.md`, `cat file # note`, `cat ~`, `ls {a,b}` (glob/comment/tilde/brace, F-001) | **deny** | CED-05 |
| **Quoted read** | `cat "my file.txt"` | **allow** | CED-04 |
| | `kubectl get pod x -o jsonpath='{.status}'` | **allow** | CED-03/04 |
| | `gh api /repos/o/r/pulls -q '.[].number'` | **allow** | CED-03/04 |
| | `argocd app get myapp`, `kubectl describe pod x`, `kubectl logs x` | **allow** | CED-03 |
| **Injection-negative** | `kubectl get pods $(rm -rf /)` | **deny** | CED-05 |
| | `` kubectl get pods `id` `` | **deny** | CED-05 |
| | `kubectl get pods | tee /etc/x` | **deny** | CED-05 |
| | `kubectl get pods > /etc/x`, `... >> ~/.bashrc` | **deny** | CED-05 |
| | `kubectl get pods; rm -rf /` and `... && rm -rf /` | **deny** | CED-05 |
| | `cat "$(id)"` and `cat "\`id\`"` (expansion in dquotes) | **deny** | CED-05 |
| | gh mutation spellings (F-002) — one row EACH: `gh api -X DELETE /r`, `gh api -XDELETE /r`, `gh api -f x=1 /u`, `gh api -fx=1 /u`, `gh api --field=x=1 /u`, `gh api -F k=@f /u`, `gh api --input=body.json /u`, `gh api --method=POST /u` | **deny** | CED-05 |
| | `kubectl exec pod -- sh`, `kubectl delete pod x`, `argocd app sync x`, `kubectl auth reconcile` | **deny** | CED-05 |
| | `gh run download` / `gh run download --dir /x` (writes artifacts, F-002 r3); `kubectl cluster-info dump --output-directory /x`; `kubectl get pods --watch=true` | **deny** | CED-05 |
| **Still-denies** | `rm -rf x`, `git push`, Edit/Write payloads, no owned task | **deny** | CED-06 |

**TDD — two distinct claims, kept separate (F-006).**

*(1) RED-before-green applies ONLY to net-new POSITIVE behavior.* The vectors that
change from deny→allow under this WI — quoted reads (`cat "my file.txt"`), the new
read verbs (`kubectl get … -o jsonpath='…'`, `gh api … -q`, `argocd app get`), and the
zero-state bootstrap allow — are authored and observed **RED against the current hook**
first, then GREEN after the edit. The injection-negative and still-denies vectors
already deny today and are NOT expected to be RED; claiming so was the F-006
contradiction. They are the **regression net**: assert they stay DENY across the change.

*(2) Mutation adequacy — prove each negative is a real detector WITHOUT patching tracked
production files in place (F-006: in-place edit of a tier-1 source is race-prone and can
leave the worktree dirty on interrupt).* Use an **isolated mutant copy** of the relevant
module(s), never `sed` on the real file. **The mutation matrix is PARTITIONED BY THE
LAYER THAT OWNS THE DECISION (round-3 F-006) — a vector is mapped to a mutant that can
actually flip ITS decision; the universal-kill claim is bounded to vectors for which
such a mutant exists:**

| Decision layer | Module(s) copied | Vectors it owns | Mutation that flips the decision |
|---|---|---|---|
| Lexer | `argv-lex.mjs` | substitution/backtick, pipe, redirect, list, dquote-expansion, glob/comment/tilde/brace | copy's `lexSimpleCommand` returns `{ok:true, argv: src.split(/\s+/)}` |
| Read classifier | `codex-hook-context.mjs` | `gh -X…/-f…/run download`, `kubectl exec/delete/auth reconcile/cluster-info dump/--watch`, `argocd sync` | copy's `isReadCommand` returns true (or hazard predicate returns false) |
| Bootstrap predicate | `svc-codex-skill-load-enforcer.mjs` | wrong canonical script path, bad `--wi`/`--branch`, unknown/dup flag, `laneGraphs!=0`, missing session id | copy's `isBootstrapShape` returns true |
| Marker reader | `bootstrap-marker.mjs` | foreign-session marker, invalid/malformed/symlink/wrong-owner/missing-field marker, `target_worktree` outside repo | copy's `readMarker` returns `{state:"valid", marker:<attacker>}` |
| Enforcer top-level (no mutant) | — | Edit/Write payloads with no owned task; genuine `rm -rf`/`git push` (CED-06) | **NOT killed by a pure-fn mutant** — these are denied by the enforcer's top-level `active.ok` gate, unchanged by this WI. They are REGRESSION vectors, asserted deny; the universal-kill rule does NOT apply to them (they have no WI-494-introduced allow path to falsify). |
| Concurrency (script) | — | same-WI / distinct-WI races | proven by the §6.3 concurrency FIXTURES, not by a classifier mutant. |

```
For each negative vector V in a mutant-bearing layer:
  1. cp the owning module(s) to $MUT=$(mktemp -d); trap 'rm -rf "$MUT"' EXIT
  2. apply the ONE mutation for V's layer to the COPY only
  3. run V through a harness importing the MUTANT copy; assert it now ALLOWS (killed)
  4. cleanup via the trap (guaranteed on interrupt — production hook never touched)
Record one mutant-killed line per mutant-bearing vector. FAIL the eval if any such
vector's mutant was NOT killed. CED-06 regression vectors + concurrency vectors are
tracked separately (assert-deny / fixture-proven), NOT under the kill rule.
```

## 7. Task graph → AC mapping

| Task | Skill | AC covered |
|---|---|---|
| 2 | diagnose-bug | reproduction of A + B (**done** — brief) |
| 10 | design-tech | **skipped** (reason on graph) |
| 3 | plan-changeset | this manifest; triad |
| 4 | review-plan | adversarial, 3-round cap |
| 5 | execute-changeset | CED-01..CED-07 |
| 6 | review-exec | CED-05/06 emphasis |
| 7 | audit-implementation | CED-02/05 — "did the exit open a bypass" |
| 8 | land-changeset | — |
| 9 | verify-promotion | CED-07 against promoted main |

## 8. External State

Walked `references/external-state-lifecycle-protocol.md` (15-environment taxonomy).

**Round-3 F-008 — the CHANGE authorizes writes, even though the enforcer only reads.**
The enforcer's own access to `.svc/bootstrap-intent/<WI>.json` is read-only, but WI-494
exists specifically to *authorize execution* of `svc-ensure-worktree.mjs`, whose write
lifecycle is therefore COUPLED external state this plan must name:

| Coupled state (written by the authorized command) | Writer / lock | Cleanup + rollback |
|---|---|---|
| `.svc/bootstrap-intent/<WI>.json` marker | `svc-ensure-worktree.mjs` under per-(repo,WI) lock; tri-state read (this WI) | production: persists as the bootstrap anchor; test: created + removed per fixture (disposable clone) |
| `.svc/lane-tasks-<WI>.json` graph | same, post-lock create | production: the WI's task graph; test: lives only in the disposable clone |
| linked worktree + branch (when the bootstrap creates one) | `git worktree add` inside the script | production: managed by worktree lifecycle; **test: NEVER against the source repo — disposable `--local` clone only (round-3 F-005), asserted `git worktree list` unchanged** |

| Environment | Applies | Action |
|---|---|---|
| Local filesystem — bootstrap-intent / lane-task / worktree / branch | **yes, WRITE (coupled, downstream)** | Enumerated in the coupled-state table above. The enforcer reads; the authorized command writes under the WI-486 lock. WI-494 adds **no new marker schema** — it single-sources the reader (§6.3) and tightens it to tri-state + field validation. |
| Runtime dir (`XDG_RUNTIME_DIR` / `~/.cache/svc-codex-runtime`) | **yes** | Unchanged. Session dirs/receipts keep their 0700/0600 discipline. |
| Git refs / notes | no | No receipt-schema change. |
| CI | no | No cloud CI (private repo). Tier-1 is local. |
| Cloud / k8s / DB / queues / secrets / DNS / CDN / feature flags / 3P APIs / mail / mobile stores | no | `kubectl`/`gh`/`argocd` appear **only as strings in an allowlist**; nothing invokes them. Fixtures never contact a cluster or a live API. |
| Installed host config (`~/.codex`) | **yes, read-only** | `setup` re-symlinks unchanged; no `provision/hosts/*.json` edit (no capability change). |

**Migration:** none. **Idempotency:** both predicates are pure; fixtures create/destroy
their own temp repos.

**F-008 — rollback runbook (host-wide enforcement hook; over-allow fails SILENT, so a
source-only revert is insufficient — the INSTALLED copy must be verified too).**

Round-3 F-007 — copy-pasteable, fail-closed on empty/ambiguous derived values (no
`<placeholders>`). Run from `REPO=$(git rev-parse --show-toplevel)`:

```bash
set -euo pipefail
REPO="$(git rev-parse --show-toplevel)"
# 1. TARGET: resolve the WI-494 land SHA from its receipt (not by eyeballing history).
LAND_SHA="$(node "$REPO/scripts/emit-receipt.mjs" --lookup --wi WI-494 --type land-record --print-sha 2>/dev/null || true)"
[ -z "$LAND_SHA" ] && LAND_SHA="$(git -C "$REPO" log --grep='WI-494' --format=%H -1 origin/main)"
[ -z "$LAND_SHA" ] && { echo 'rollback: cannot resolve WI-494 land SHA; abort'; exit 1; }
git -C "$REPO" checkout -b revert-wi494 origin/main
git -C "$REPO" revert --no-edit "$LAND_SHA"
# 2. SOURCE PROOF: targeted validator returns to PRE-WI-494 baseline (zero-state -> DENY;
#    the deadlock returns — expected, which is why revert is a last resort).
bash "$REPO/test-framework/evals/tier-1/validate-codex-execution-integrity.sh"
# 3. INSTALLED REFRESH (a drift CHECK is not a refresh). Derive the installed enforcer
#    path from the Codex host farm; refresh unless already a live symlink to reverted src.
INSTALLED="${CODEX_HOME:-$HOME/.codex}/hooks/codex/svc-codex-skill-load-enforcer.mjs"
SRC="$REPO/hooks/codex/svc-codex-skill-load-enforcer.mjs"
[ -e "$INSTALLED" ] || { echo "rollback: installed enforcer not found at $INSTALLED; abort"; exit 1; }
if [ "$(readlink -f "$INSTALLED")" != "$(readlink -f "$SRC")" ]; then
  "$REPO/setup" --host codex
  [ "$(readlink -f "$INSTALLED")" = "$(readlink -f "$SRC")" ] || { echo 'rollback: install still stale after setup; abort'; exit 1; }
fi
# 4. BEHAVIORAL SMOKE through the INSTALLED launcher (catches silent over-allow a
#    source-only revert misses). Exact JSON fixtures + decision assertions:
smoke() { printf '%s' "$2" | node "$INSTALLED" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const d=(JSON.parse(s||"{}").hookSpecificOutput||{}).permissionDecision||"allow";process.exit(d===process.argv[1]?0:1)})' "$3" || { echo "rollback smoke FAIL: $1"; exit 1; }; }
smoke "read allowed" '{"session_id":"s","cwd":"'"$REPO"'","tool_name":"Bash","tool_input":{"command":"cat README.md"}}' allow
smoke "mutation denied" '{"session_id":"s","cwd":"'"$REPO"'","tool_name":"Bash","tool_input":{"command":"rm -rf x"}}' deny
# 5. RECEIPT: record $LAND_SHA + the 4 checks above in the rollback receipt.
```
Every derived value (`LAND_SHA`, `INSTALLED`) fails closed when empty or ambiguous.

## 9. Host parity — settled, not re-litigated

Claude gets **no** port. Decided in `docs/specs/work-items/WI-494.md` §Host parity and
logged as a `taste` decision in `.svc/pipeline-decisions.jsonl`. **Not a code change in
this WI**; out of scope for review. Reviewers must not reopen it.

## 10. Review surface (where to aim)

Detection asymmetry (§3) says over-allow is the silent failure. Concentrate on:

1. **`argv-lex.mjs` completeness** — any accepted string that a real shell would
   execute differently than the returned argv is a **critical** bypass. Attack it.
2. **`isBootstrapShape` zero-state fence** — can it be reached with a graph owned? Can
   `--wi`/`--branch` escape the worktree? Can a foreign marker pass? Is the marker
   check TOCTOU-exposed (marker read at hook time, script run later)?
3. **Read-verb allowlist** — any listed verb that mutates. `gh api -X POST` is the
   known trap.
4. **CED-06 non-regression** — governed mutation still denied.

## 11. Dry run

`cat "my file.txt"` → lex → `["cat","my file.txt"]` → `READ_BINARIES.has("cat")` →
**allow** (today: deny). `kubectl get pod x -o jsonpath='{.status}'` → lex →
`["kubectl","get","pod","x","-o","jsonpath={.status}"]` → verb `get` ∈ set, no hazard
flag → **allow** (today: deny). `kubectl get pods $(rm -rf /)` → lex rejects at
unquoted `$` → **deny** (unchanged). Zero-state
`node scripts/svc-ensure-worktree.mjs --wi WI-999 --branch wi999-x` → lex ok → script
realpath == canonical → flags valid → `laneGraphs()` == 0 → no marker → **allow**
(today: deny) → script creates graph + marker → next call `laneGraphs()` == 1 →
`isBootstrapShape` now returns false, `isSkillLoaderShape` governs. **Deadlock exits
in exactly one hop, and the exit closes behind itself.**

## 12. What this plan does NOT do

- No Claude port (§9). No `provision/hosts/*.json` change. No receipt-schema change.
- No `laneGraphs`/`resolveWI` change — the ownership tuple stays the sole authority
  for *consumption*; the marker is consulted only for *creation*, only in zero-state.
- No widening of `isSkillLoaderShape`.
- Does not mitigate `--kubeconfig` exec-plugin RCE (§6.2 risk-acceptance).
