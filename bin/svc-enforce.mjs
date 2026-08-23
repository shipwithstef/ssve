#!/usr/bin/env node
// bin/svc-enforce.mjs — WI-487 durable enforcement launcher TEMPLATE.
//
// setup/migration COPY this file (real bytes, never a symlink) to
//   $LAUNCHER = ~/.svc/enforcement/<MIGRATION_VERSION>/bin/svc-enforce
// alongside a byte/hash-verified copy of the canonical enforcement-core at
//   ~/.svc/enforcement/<MIGRATION_VERSION>/lib/enforcement-core.mjs
// Every governed-mutation hook command is rewritten to invoke
//   node $LAUNCHER <hook-id>
// with the host's stdin.
//
// At run time the launcher:
//   1. resolves the real enforcement source for <hook-id>,
//   2. validates it (classifySource == durable-canonical + executable),
//   3. exec-delegates to the real hook when valid,
//   4. FAILS CLOSED (deny + actionable diagnostic + home-local receipt) when the
//      source is missing / dangling / non-executable — INCLUDING when the whole
//      source checkout was deleted (F-001).
//
// Its deny path imports the MATERIALIZED lib/enforcement-core.mjs sitting next to
// it (never the guarded checkout), so a deleted checkout still denies identically
// (F-016). The template also runs in-repo (fallback core resolution) for tests.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const THIS_FILE = fileURLToPath(import.meta.url);
const THIS_DIR = path.dirname(THIS_FILE);

// Default governed-hook registry. A sibling manifest.json may override
// `effective_source` and extend the registry, but the two governed-mutation
// guards are known even without a manifest so the launcher fails closed.
const DEFAULT_REGISTRY = {
  "svc-task-completion-guard": { relpath: "hooks/svc-task-completion-guard.sh", runner: "bash", event: "Stop" },
  "svc-codex-skill-load-enforcer": { relpath: "hooks/codex/svc-codex-skill-load-enforcer.mjs", runner: "node", event: "PreToolUse" },
  "svc-codex-pretool-dispatcher": { relpath: "hooks/codex/svc-codex-pretool-dispatcher.mjs", runner: "node", event: "PreToolUse" },
  // F-010: Kimi's governed Stop guard is a distinct wrapper script; it is known
  // in the DEFAULT registry so the launcher fails closed even without a manifest.
  "svc-kimi-task-completion-guard": { relpath: "hooks/kimi/svc-kimi-task-completion-guard.sh", runner: "bash", event: "Stop" },
  "svc-cursor-task-completion-guard": { relpath: "hooks/cursor/svc-cursor-task-completion-guard.sh", runner: "bash", event: "Stop" },
  "svc-grok-task-completion-guard": { relpath: "hooks/grok/svc-grok-task-completion-guard.sh", runner: "bash", event: "Stop" },
};

// ── BREAK-GLASS (WI-501) ────────────────────────────────────────────────────
// DEPENDENCY-FREE global escape hatch for the governed hooks routed through this
// launcher (the mutation enforcer + the Stop guards). Before this existed those
// hooks honored NO disable switch, which produced a deadlock class: when the
// enforcement itself misbehaved, the agent was blocked from mutating the very
// files needed to FIX it, so every enforcement bug escalated into a full framework
// WI (WI-494/496/497/498/499 were all one instance of this). This is that switch.
//
// Armed by EITHER:
//   SVC_BREAK_GLASS=1                       (one-off, this process/session)
//   ~/.svc/BREAK-GLASS                      (a file you touch; survives a session)
//
// It runs BEFORE the bootstrap/source/core checks on purpose: the states most in
// need of an escape hatch (checkout deleted, core missing, source dangling) are
// exactly the ones that fail closed further down.
//
// Safety rails that keep this from becoming a silent permanent hole:
//   * The FILE form AUTO-EXPIRES (default 4h from mtime, SVC_BREAK_GLASS_TTL_HOURS)
//     and then fails SAFE back to fully governed. `touch` again to re-arm.
//   * Every bypass appends an audit row to ~/.svc/break-glass-audit.jsonl.
//   * Every bypass prints a loud stderr banner — it is never silent.
// R1-F002: the env form is an explicit, process-scoped owner override and stays as-is.
// The FILE form is a persistent on-disk marker, so it is independently authenticated:
// it must be a regular non-symlink file owned by this UID, not group/other-writable,
// sitting in a same-UID non-world-writable directory, with a non-future mtime, and its
// TTL is clamped to a finite maximum so no env value can arm it indefinitely.
const BREAK_GLASS_MAX_TTL_HOURS = 24;

function breakGlassArmed() {
  const raw = String(process.env.SVC_BREAK_GLASS || "").toLowerCase();
  if (raw === "1" || raw === "true" || raw === "on") return { via: "env", remaining: "process-scoped" };
  try {
    const marker = path.join(os.homedir(), ".svc", "BREAK-GLASS");
    const st = fs.lstatSync(marker);                       // lstat: never follow a symlink
    if (!st.isFile() || st.isSymbolicLink()) return null;
    if (typeof process.getuid === "function") {
      if (st.uid !== process.getuid()) return null;        // foreign-owned marker
      const dst = fs.lstatSync(path.dirname(marker));
      if (!dst.isDirectory() || dst.isSymbolicLink()) return null;
      if (dst.uid !== process.getuid()) return null;
      if (dst.mode & 0o022) return null;                   // group/other-writable dir
    }
    if (st.mode & 0o022) return null;                      // group/other-writable marker
    const requested = Number(process.env.SVC_BREAK_GLASS_TTL_HOURS);
    const ttlHours = Math.min(
      Number.isFinite(requested) && requested > 0 ? requested : 4,
      BREAK_GLASS_MAX_TTL_HOURS,
    );
    const ageHours = (Date.now() - st.mtimeMs) / 3600000;
    if (ageHours < 0) return null;                         // future mtime → refuse
    if (ageHours < ttlHours) return { via: "file", remaining: `${(ttlHours - ageHours).toFixed(1)}h` };
    return null;                                           // EXPIRED → fail safe to governed
  } catch { return null; }
}

function breakGlassAllow(hookId, event, armed) {
  try {
    const dir = path.join(os.homedir(), ".svc");
    // Explicit 0700: a default-mode creation under umask 0002 yields 0775 and
    // the group-writable check below would reject our own directory. A
    // pre-existing insecure directory is still refused, never chmod-healed.
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    // R2-F002: the audit trail is evidence, so it must not be redirectable or
    // tamperable. Append with O_NOFOLLOW (a symlinked audit path is refused rather
    // than followed) and 0600, and refuse a pre-existing non-regular/foreign-owned file.
    // R3-F002: validate the PARENT directory too — a symlinked or world-writable
    // ~/.svc would let the whole audit trail be redirected regardless of how carefully
    // the leaf is opened.
    const dst = fs.lstatSync(dir);
    if (!dst.isDirectory() || dst.isSymbolicLink()) throw new Error("audit directory is not a real directory");
    if (typeof process.getuid === "function" && dst.uid !== process.getuid()) throw new Error("audit directory is foreign-owned");
    if (dst.mode & 0o022) throw new Error("audit directory is group/other-writable");
    const auditPath = path.join(dir, "break-glass-audit.jsonl");
    try {
      const ast = fs.lstatSync(auditPath);
      if (!ast.isFile() || ast.isSymbolicLink()) throw new Error("audit path is not a regular file");
      if (typeof process.getuid === "function" && ast.uid !== process.getuid()) throw new Error("audit file is foreign-owned");
    } catch (e) { if (e && e.code !== "ENOENT") throw e; }
    const afd = fs.openSync(auditPath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_APPEND | fs.constants.O_NOFOLLOW, 0o600);
    // R3-F002: re-validate the OPENED descriptor (defeats a TOCTOU swap between lstat
    // and open) and normalize permissions on a pre-existing permissive file.
    const fst = fs.fstatSync(afd);
    if (!fst.isFile()) { fs.closeSync(afd); throw new Error("audit descriptor is not a regular file"); }
    if (typeof process.getuid === "function" && fst.uid !== process.getuid()) { fs.closeSync(afd); throw new Error("audit descriptor is foreign-owned"); }
    if (fst.mode & 0o077) fs.fchmodSync(afd, 0o600);
    try {
      fs.writeFileSync(afd, JSON.stringify({
        ts: new Date().toISOString(), hook_id: hookId || null, event: event || null,
        via: armed.via, remaining: armed.remaining, cwd: process.cwd(),
        session_id: process.env.SVC_SESSION_ID || process.env.CODEX_SESSION_ID || process.env.CODEX_THREAD_ID || "",
      }) + "\n");
    } finally { fs.closeSync(afd); }
  } catch (e) {
    // R1-F002: auditing must never BLOCK the escape hatch, but a silent audit failure
    // would make the bypass unattributable — so surface it loudly instead of swallowing.
    try { process.stderr.write(`⚠️  SVC BREAK-GLASS: AUDIT WRITE FAILED (${e && e.message}) — bypass is proceeding UNRECORDED\n`); } catch {}
  }
  try {
    process.stderr.write(
      `\n⚠️  SVC BREAK-GLASS ACTIVE (${armed.via}) — enforcement BYPASSED for '${hookId}'. ` +
      `Remaining: ${armed.remaining}. Audit: ~/.svc/break-glass-audit.jsonl\n` +
      `   Re-arm: touch ~/.svc/BREAK-GLASS   Disarm now: rm ~/.svc/BREAK-GLASS\n\n`
    );
  } catch {}
  // Allow, in the shape each host expects.
  if (event === "Stop") { process.exit(0); }
  try { process.stdout.write("{}\n"); } catch {}
  process.exit(0);
}

// R3-F002: DEPENDENCY-FREE launcher bootstrap check. The materialized core is
// dynamically imported by loadCore() below — if any bundle ancestor from the real
// state root down to the launcher AND to the core file is a symlink, is
// group/other-writable, or is foreign-owned, a hostile party could REPLACE the core
// that performs every later validation. This inline check (no core import, no
// dependency) runs BEFORE the import and refuses such a bundle. Only the INSTALLED
// launcher (whose real path lives under ~/.svc) is checked; the in-repo TEMPLATE
// fallback (launcher not under the state root, core resolved inside the repo) is the
// self-referential test path and is exempt. Returns { ok } or { ok:false, ... }.
function launcherBootstrapSecure(env) {
  const home = env && typeof env.HOME === "string" ? env.HOME.trim() : "";
  if (!home) return { ok: false, reason: "SVC-ENFORCE-NO-HOME", why: "HOME is unset or empty" };
  let realHome;
  try { realHome = fs.realpathSync(home); } catch { return { ok: false, reason: "SVC-ENFORCE-BAD-HOME", why: `HOME '${home}' is not a readable directory` }; }
  const stateRoot = path.join(realHome, ".svc");
  const boundResolved = path.resolve(stateRoot);
  const launcher = path.resolve(THIS_FILE);
  // In-repo TEMPLATE fallback: the launcher is not under ~/.svc → not the installed
  // bundle; skip (its core lives in the repo, validated by the normal path).
  if (launcher !== boundResolved && !launcher.startsWith(boundResolved + path.sep)) {
    return { ok: true, inRepo: true };
  }
  // The materialized core sits next to the launcher: <bundle>/bin/svc-enforce and
  // <bundle>/lib/enforcement-core.mjs.
  const coreFile = path.resolve(path.join(THIS_DIR, "..", "lib", "enforcement-core.mjs"));
  const uid = typeof process.getuid === "function" ? process.getuid() : null;
  const checked = new Set();
  for (const leaf of [launcher, coreFile]) {
    // Build the chain from the leaf up to (and including) the state root.
    const chain = [];
    let cur = leaf;
    while (true) {
      chain.push(cur);
      if (cur === boundResolved) break;
      const parent = path.dirname(cur);
      if (parent === cur) {
        return { ok: false, reason: "SVC-ENFORCE-INSECURE-BUNDLE", comp: leaf, why: "resolves outside the trusted state root" };
      }
      cur = parent;
    }
    for (const comp of chain) {
      if (checked.has(comp)) continue;
      checked.add(comp);
      let lst;
      try { lst = fs.lstatSync(comp); } catch { continue; /* not-yet-existing → not a live seam */ }
      if (lst.isSymbolicLink()) return { ok: false, reason: "SVC-ENFORCE-INSECURE-BUNDLE", comp, why: "symlinked ancestor" };
      if ((lst.mode & 0o022) !== 0) return { ok: false, reason: "SVC-ENFORCE-INSECURE-BUNDLE", comp, why: "group/other-writable ancestor" };
      if (uid !== null && lst.uid !== uid) return { ok: false, reason: "SVC-ENFORCE-INSECURE-BUNDLE", comp, why: "foreign-owned ancestor" };
    }
  }
  return { ok: true };
}

// Core-free fail-closed denial for the bootstrap check (runs BEFORE any core import).
function bootstrapFailClosed(hookId, event, boot) {
  const detail = `${boot.why || boot.reason}${boot.comp ? ` at ${boot.comp}` : ""}`;
  const reason = `SVC DENIAL ${hookId || "svc-enforce"} ${boot.reason}: the installed enforcement bundle ancestry is insecure (${detail}); refusing to load the materialized core (fail-closed). Recovery: remove/repair the untrusted ~/.svc ancestor and re-run ./setup --host <host>.`;
  try { process.stderr.write(reason + "\n"); } catch { /* ignore */ }
  try {
    if (event === "Stop") process.stdout.write(JSON.stringify({ decision: "block", reason }) + "\n");
    else process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } }) + "\n");
  } catch { /* ignore */ }
  process.exit(2);
}

// Resolve the canonical enforcement-core: prefer the MATERIALIZED sibling copy
// (installed layout: <version>/lib/enforcement-core.mjs), fall back to the repo
// layout (bin/ -> ../hooks/lib) so the template is runnable in-repo for tests.
async function loadCore() {
  const candidates = [
    path.join(THIS_DIR, "..", "lib", "enforcement-core.mjs"),
    path.join(THIS_DIR, "..", "hooks", "lib", "enforcement-core.mjs"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return import(pathToFileURL(c).href);
    }
  }
  return null;
}

function readStdin() {
  try {
    return fs.readFileSync(0);
  } catch {
    return Buffer.alloc(0);
  }
}

// Read the sibling manifest (durable, outside the checkout) for effective_source
// + any registry ADDITIONS. F-002: it is validated as a securely-owned, non-symlink,
// non-group/other-writable, schema- and identity-bound file via the canonical
// enforcement-core validator — never trusted as raw JSON. Evidence only:
// effective_source is re-classified LIVE before delegation.
function readSiblingManifest(core, stateRoot) {
  const p = path.join(THIS_DIR, "..", "manifest.json");
  try {
    const parsed = core.validateReceiptFile(p, {
      requiredFields: ["effective_source", "migration_version"],
      fieldTypes: { effective_source: "string", migration_version: "string" },
      identity: { migration_version: core.MIGRATION_VERSION },
      boundary: stateRoot || null,
    });
    return parsed || null;
  } catch { /* absent / unreadable / rejected */ return null; }
}

// Resolve the effective enforcement source root (the durable canonical checkout).
// F-002: there is NO runtime source override. The ONLY trusted source of the
// installed effective source is the securely-validated sibling manifest. The
// in-repo template fallback (bin/.. == repo) is present ONLY so the template runs
// in-repo for tests where no manifest exists — it points at THIS launcher's own
// tree, never an attacker-selected env value.
function resolveEffectiveSource(manifest) {
  if (manifest && typeof manifest.effective_source === "string" && manifest.effective_source) {
    return manifest.effective_source;
  }
  // Template fallback (no manifest — in-repo test run only): the repo root that
  // contains this bin/. This is self-referential, never externally selectable.
  const repoRoot = path.resolve(THIS_DIR, "..");
  if (fs.existsSync(path.join(repoRoot, "hooks", "hooks.json"))) return repoRoot;
  return null;
}

// Emit a fail-closed denial in the correct host format, write the durable receipt,
// and exit non-zero. Self-contained: uses only the materialized core.
function failClosed(core, { hookId, event, reasonCode, cause, recovery, sourcePath, effectiveSource, sessionId, klass }) {
  const operation = event === "Stop" ? "session Stop" : "governed mutation (PreToolUse)";
  const state = {
    hook_id: hookId,
    reason_code: reasonCode,
    resolved_command_path: sourcePath || "",
    effective_source: effectiveSource || "",
    source_or_receipt_class: klass || "dangling",
    target_exists: klass !== "dangling",
    target_executable: klass === "durable-canonical",
  };
  let receiptPath = null;
  let deduped = false;
  if (core) {
    try {
      const r = core.writeDenialReceipt(
        { ...state, cause, operation, recovery, session_id: sessionId },
        { env: process.env }
      );
      receiptPath = r.receipt_path;
      deduped = r.deduped;
    } catch { /* receipt write must never convert deny -> allow */ }
  }
  const lookup = receiptPath ? ` [receipt: ${receiptPath}]` : "";
  // F-009: the FULL cause+recovery is emitted only on the FIRST occurrence. A
  // deduped repeat keeps the mandatory DENY but collapses the host-visible payload
  // to a stable reason code + receipt lookup path (the full diagnostic already
  // lives in the durable receipt). The deny is NEVER downgraded.
  const fullMessage = `SVC DENIAL ${hookId} ${reasonCode}: ${cause} Recovery: ${recovery}${lookup}`;
  const shortRepeat = `SVC DENIAL ${hookId} ${reasonCode} (repeat; see receipt)${lookup}`;
  const hostMessage = deduped ? shortRepeat : fullMessage;
  if (!deduped) {
    try {
      process.stderr.write(JSON.stringify({ svc_denial: true, hook_id: hookId, reason_code: reasonCode, cause, operation, recovery, receipt_path: receiptPath, denial_state_digest: core ? core.denialStateDigest(state) : null }) + "\n");
      process.stderr.write(fullMessage + "\n");
    } catch { /* ignore */ }
  }
  // Host-visible decision payload on stdout (always a DENY; payload size reduced on repeat).
  try {
    if (event === "Stop") {
      process.stdout.write(JSON.stringify({ decision: "block", reason: hostMessage }) + "\n");
    } else if (event === "PreToolUse") {
      process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: hostMessage } }) + "\n");
    }
  } catch { /* ignore */ }
  // Non-zero exit is the durable fail-closed signal for stderr-swallowing hosts.
  process.exit(2);
}

async function main() {
  const env = process.env;
  const argv = process.argv.slice(2);
  const hookId = argv[0];
  const passthroughArgs = argv.slice(1);
  const stdin = readStdin();
  const bootEvent = (DEFAULT_REGISTRY[hookId] && DEFAULT_REGISTRY[hookId].event) || "PreToolUse";

  // WI-501: break-glass runs FIRST — before bootstrap/source/core validation — so it
  // still works in the exact states that otherwise fail closed (deleted checkout,
  // missing core, dangling source). Auto-expiring + audited; see breakGlassArmed().
  const armed = breakGlassArmed();
  if (armed) breakGlassAllow(hookId, bootEvent, armed);


  // R3-F002: validate the bundle ancestry with a DEPENDENCY-FREE inline check BEFORE
  // dynamically importing the materialized core — a writable/symlinked/foreign-owned
  // ancestor could otherwise swap the core that runs the rest of the validation.
  const boot = launcherBootstrapSecure(env);
  if (!boot.ok) {
    bootstrapFailClosed(hookId, bootEvent, boot);
    return;
  }

  const core = await loadCore();
  // event/registry are resolved AFTER the manifest is validated below; seed a
  // conservative default for the no-core fail-closed message.
  const sessionId = env.SVC_SESSION_ID || env.CLAUDE_SESSION_ID || env.CODEX_SESSION_ID || env.CODEX_THREAD_ID || "";
  const defaultEvent = (DEFAULT_REGISTRY[hookId] && DEFAULT_REGISTRY[hookId].event) || "PreToolUse";

  // No canonical core available at all → cannot validate → fail closed with the
  // rawest possible message (does not depend on the core).
  if (!core) {
    try { process.stderr.write(`SVC DENIAL ${hookId || "svc-enforce"} SVC-ENFORCE-CORE-MISSING: the durable enforcement core is not present next to the launcher; refusing (fail-closed). Recovery: re-run ./setup --host <host>.\n`); } catch {}
    if (defaultEvent === "Stop") process.stdout.write(JSON.stringify({ decision: "block", reason: "SVC DENIAL: enforcement core missing (fail-closed)." }) + "\n");
    else process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "SVC DENIAL: enforcement core missing (fail-closed)." } }) + "\n");
    process.exit(2);
  }

  // HOME/state-root must resolve FIRST (fail-closed if not) — the manifest read,
  // receipt write, and ancestry checks all depend on a trusted state root.
  let stateRoot = null;
  try {
    stateRoot = core.resolveStateRoot(env);
  } catch (e) {
    failClosed(core, {
      hookId, event: defaultEvent,
      reasonCode: "SVC-ENFORCE-NO-HOME",
      cause: `HOME is unset or unreadable, so no durable state root can be resolved (${e && e.message}).`,
      recovery: "Set HOME to a readable directory owned by the current user, then re-run.",
      sessionId, klass: "dangling",
    });
    return;
  }

  // F-015: validate the state root itself (owner==uid, non-symlink, non-g/o-writable)
  // and — when running as the INSTALLED launcher UNDER that state root — validate our
  // OWN bundle's no-follow ancestry so a hostile/foreign-owned ~/.svc ancestor cannot
  // control which launcher executes. The in-repo TEMPLATE fallback (not under the
  // state root) skips the self-ancestry check — it is the self-referential test path.
  try {
    core.assertStateRootSecure(stateRoot);
  } catch (e) {
    failClosed(core, {
      hookId, event: defaultEvent,
      reasonCode: "SVC-ENFORCE-INSECURE-STATE-ROOT",
      cause: `The durable state root is not secure (${e && e.message}); refusing to materialize enforcement through an untrusted ancestor.`,
      recovery: "Ensure ~/.svc is a real directory you own with no group/other write bit, then re-run.",
      sessionId, klass: "dangling",
    });
    return;
  }
  const launcherUnderStateRoot = path.resolve(THIS_FILE).startsWith(path.resolve(stateRoot) + path.sep);
  if (launcherUnderStateRoot && !core.launcherRunnable(THIS_FILE, { boundary: stateRoot })) {
    failClosed(core, {
      hookId, event: defaultEvent,
      reasonCode: "SVC-ENFORCE-INSECURE-BUNDLE",
      cause: "The installed launcher's own bundle ancestry under ~/.svc is insecure (symlinked, foreign-owned, or writable); a hostile ancestor could control enforcement.",
      recovery: "Remove/repair the untrusted ~/.svc ancestor and re-run ./setup --host <host> to re-materialize the durable bundle.",
      sessionId, klass: "dangling",
    });
    return;
  }

  // F-002: bind the registry + effective source to the SECURELY-VALIDATED manifest.
  // DEFAULT_REGISTRY wins over manifest entries so the two governed guards cannot
  // be redefined by an installed manifest (manifest may only ADD entries).
  const manifest = readSiblingManifest(core, stateRoot);
  const registry = Object.assign({}, (manifest && manifest.registry) || {}, DEFAULT_REGISTRY);
  const entry = registry[hookId];
  const event = entry ? entry.event : defaultEvent;

  // Unknown hook-id is a wiring error → fail closed.
  if (!entry) {
    failClosed(core, {
      hookId: hookId || "svc-enforce",
      event,
      reasonCode: "SVC-ENFORCE-UNKNOWN-HOOK",
      cause: `The launcher was invoked with an unknown hook id '${hookId}'.`,
      recovery: "Re-run ./setup --host <host> to rewrite governed hook commands through the launcher with a known hook id.",
      sessionId,
      klass: "dangling",
    });
    return;
  }

  const effectiveSource = resolveEffectiveSource(manifest);
  if (!effectiveSource) {
    failClosed(core, {
      hookId, event,
      reasonCode: "SVC-ENFORCE-NO-SOURCE",
      cause: "No effective enforcement source is recorded for the launcher and none could be inferred.",
      recovery: "Re-run ./setup --host <host> to materialize the launcher with a durable effective source.",
      sessionId, klass: "dangling",
    });
    return;
  }

  // Re-classify the effective source LIVE (receipts are evidence only).
  const sourceKlass = core.classifySource(effectiveSource, { requireExecutable: false });
  if (sourceKlass !== "durable-canonical") {
    failClosed(core, {
      hookId, event,
      reasonCode: sourceKlass === "ephemeral" ? "SVC-ENFORCE-SOURCE-EPHEMERAL" : sourceKlass === "worktree-bound" ? "SVC-ENFORCE-SOURCE-WORKTREE" : "SVC-ENFORCE-SOURCE-DANGLING",
      cause: `The effective enforcement source '${effectiveSource}' is ${sourceKlass} (not a durable canonical checkout); the guarded checkout may have been moved or deleted.`,
      recovery: "Re-run ./setup --host <host> from your canonical svc checkout to repoint enforcement at a durable source.",
      sourcePath: effectiveSource, effectiveSource,
      sessionId, klass: sourceKlass,
    });
    return;
  }

  // Resolve + validate the real hook command inside the durable source.
  const hookPath = path.join(effectiveSource, entry.relpath);
  const requireExecutable = entry.runner === "bash"; // .sh must be executable; .mjs is run via `node`.
  const hookKlass = core.classifySource(hookPath, { requireExecutable });
  if (hookKlass !== "durable-canonical") {
    failClosed(core, {
      hookId, event,
      reasonCode: "SVC-ENFORCE-HOOK-DANGLING",
      cause: `The governed hook '${entry.relpath}' is missing / dangling / non-executable inside the enforcement source (classification: ${hookKlass}).`,
      recovery: "Re-run ./setup --host <host> to reinstall the governed hook from the durable source.",
      sourcePath: hookPath, effectiveSource,
      sessionId, klass: hookKlass,
    });
    return;
  }

  // Valid → exec-delegate to the real hook, forwarding stdin/stdout/stderr + exit code.
  const child = spawnSync(entry.runner, [hookPath, ...passthroughArgs], {
    input: stdin,
    stdio: ["pipe", "inherit", "inherit"],
    env: process.env,
  });
  process.exit(child.status == null ? 1 : child.status);
}

main().catch((e) => {
  // Any unexpected failure is fail-closed, not fail-open.
  try { process.stderr.write(`SVC DENIAL svc-enforce SVC-ENFORCE-INTERNAL: ${e && e.message} (fail-closed)\n`); } catch {}
  process.exit(2);
});
