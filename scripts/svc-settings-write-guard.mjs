#!/usr/bin/env node
/**
 * svc-settings-write-guard.mjs — WI-394 mechanism (b).
 *
 * PostToolUse hook on Edit|Write. When the target is the host's GLOBAL
 * ~/.claude/settings.json, parse what just landed on disk and shape-check it
 * against the known-valid schema. A malformed write is REJECTED and the prior
 * good settings are RESTORED from the most recent WI-359 `*.svc-backup-*`
 * sibling produced by scripts/wire-hooks.mjs.
 *
 * Lives under scripts/ (not hooks/) on purpose: hooks/svc-*.{js,mjs} is a
 * protected hot-path glob in svc-workflow-guard.mjs, so a brand-new file there
 * is blocked by config-protection. scripts/*.mjs is the un-gated home other
 * hook commands already use (eval-gate.mjs, preflight.mjs). The hooks.json
 * registration that turns this script into a live PostToolUse hook is a
 * separate, protected edit — see WI-394 deferred-wiring note.
 *
 * Mechanizes framework-learning `host-settings-schema-live-verify-before-write`
 * (c9, WI-365): a wrong `skillOverrides` SHAPE (object instead of the string
 * enum) made Claude refuse settings load in EVERY other folder — a live
 * user-facing regression caught by the user, not by any gate. Machine-local
 * edits bypass all repo gates; the backup+restore line is necessary but NOT
 * sufficient, so this hook is the fail-closed half that completes the pair.
 *
 * Why PostToolUse (not PreToolUse): the c9 contract is "write, then VALIDATE
 * by parsing"; on a bad write we must be able to RESTORE the prior good copy,
 * which only exists once the bad content has landed. PostToolUse is the only
 * event that can both observe the result and revert it in the same cycle.
 *
 * Schema-shape rules (verified against the c9 learning + live settings):
 *   - top level must be a JSON object
 *   - skillOverrides, if present, is an object whose VALUES are one of the
 *     string enums on|off|name-only|user-invocable-only  (NOT {nameOnly:true})
 *   - hooks, if present, is an object of event -> array  (the documented shape)
 *
 * Exit codes:
 *   0   — pass (target not settings.json, or valid, or fail-open on bad payload)
 *   2   — REJECTED (restored from backup if one existed; loud warn if not)
 *
 * Overrides (hermetic-test + escape hatches):
 *   SVC_SETTINGS_PATH=<abs>      — treat THIS file as the guarded settings.json
 *   SVC_SETTINGS_GUARD_OFF=1     — skip the entire check (human edits)
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// hook-payload.mjs is the established host-agnostic payload normalizer; it
// lives under hooks/lib/, one dir up from scripts/.
const { readHookPayload, extractFilePath } = await import(
  path.join(__dirname, "..", "hooks", "lib", "hook-payload.mjs")
);

const OVERRIDE_VALUES = new Set(["on", "off", "name-only", "user-invocable-only"]);

// Resolve the absolute path this machine treats as the guarded settings file.
// SVC_SETTINGS_PATH lets the tier-1 validator point the guard at a temp file
// without touching a real home dir (hermetic).
function guardedSettingsPath() {
  const ovr = process.env.SVC_SETTINGS_PATH;
  if (ovr) return path.resolve(ovr.replace(/^~/, os.homedir()));
  return path.join(os.homedir(), ".claude", "settings.json");
}

// Returns null when the on-disk content is schema-valid, else a one-line reason.
function shapeViolation(raw) {
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch (err) {
    return `not valid JSON (jq/parse failed: ${err.message})`;
  }
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return "top-level value is not a JSON object";
  }
  if ("skillOverrides" in obj) {
    const so = obj.skillOverrides;
    if (so === null || typeof so !== "object" || Array.isArray(so)) {
      return "skillOverrides must be an object of skill -> string-enum";
    }
    for (const [k, v] of Object.entries(so)) {
      // The exact c9 trap: {nameOnly:true} objects instead of the string enum.
      if (typeof v !== "string") {
        return `skillOverrides["${k}"] must be a string enum (on|off|name-only|user-invocable-only), got ${typeof v}`;
      }
      if (!OVERRIDE_VALUES.has(v)) {
        return `skillOverrides["${k}"]="${v}" is not one of on|off|name-only|user-invocable-only`;
      }
    }
  }
  if ("hooks" in obj) {
    const h = obj.hooks;
    if (h === null || typeof h !== "object" || Array.isArray(h)) {
      return "hooks must be an object of event -> array";
    }
    for (const [event, arr] of Object.entries(h)) {
      if (!Array.isArray(arr)) return `hooks["${event}"] must be an array`;
    }
  }
  return null;
}

// Most-recent `<settings>.svc-backup-*` sibling produced by wire-hooks.mjs.
// Timestamp suffix is ISO-8601 with `:`/`.` -> `-`, so lexical max == newest.
function newestBackup(settingsPath) {
  const dir = path.dirname(settingsPath);
  const base = path.basename(settingsPath);
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return null;
  }
  const prefix = `${base}.svc-backup-`;
  const bak = names.filter((n) => n.startsWith(prefix)).sort();
  return bak.length ? path.join(dir, bak[bak.length - 1]) : null;
}

function main() {
  if (process.env.SVC_SETTINGS_GUARD_OFF === "1") process.exit(0);

  const call = readHookPayload();
  if (!call) process.exit(0); // fail-open on ambiguous payload (loop-guard lesson)
  if (!["Edit", "Write", "Update"].includes(call.toolName)) process.exit(0);

  const filePath = extractFilePath(call.toolInput);
  if (!filePath) process.exit(0);

  const guarded = guardedSettingsPath();
  const cwd = call.cwd || process.cwd();
  // Gemini batch-G6 #2: expand a leading ~ BEFORE the isAbsolute test — a tilde
  // path is not "absolute", so without this `~/.claude/settings.json` (the very
  // file we guard) would be mis-joined under cwd and the guard would fail OPEN.
  const fpExp = String(filePath).replace(/^~(?=$|\/|\\)/, os.homedir());
  const targetAbs = path.resolve(path.isAbsolute(fpExp) ? fpExp : path.join(cwd, fpExp));
  if (targetAbs !== guarded) process.exit(0); // not the guarded settings file

  let onDisk;
  try {
    onDisk = fs.readFileSync(guarded, "utf8");
  } catch {
    process.exit(0); // can't read what we'd judge — fail open
  }

  const reason = shapeViolation(onDisk);
  if (!reason) process.exit(0); // valid — silent pass

  // Invalid write landed. Restore prior-good copy from the WI-359 backup.
  const bak = newestBackup(guarded);
  console.error("svc-settings-write-guard: REJECTED malformed ~/.claude/settings.json write");
  console.error(`   reason: ${reason}`);
  console.error(
    "   learning: host-settings-schema-live-verify-before-write (c9, WI-365) —"
  );
  console.error(
    "   a wrong skillOverrides shape makes Claude refuse settings load in EVERY folder."
  );
  if (bak) {
    try {
      fs.copyFileSync(bak, guarded);
      console.error(`   RESTORED prior settings from backup: ${bak}`);
      console.error(`   (manual re-restore if needed: cp "${bak}" "${guarded}")`);
    } catch (err) {
      console.error(`   backup found but restore FAILED: ${err.message}`);
      console.error(`   restore manually: cp "${bak}" "${guarded}"`);
    }
  } else {
    // Backup is necessary but not sufficient — say so loudly (per the c9 line).
    console.error(
      "   NO `*.svc-backup-*` sibling found — cannot auto-restore. The malformed"
    );
    console.error(
      "   file is still on disk. Fix it by hand or re-run scripts/wire-hooks.mjs"
    );
    console.error(
      "   (which backs up before writing) once a valid baseline is restored."
    );
  }
  process.exit(2);
}

try {
  main();
} catch (err) {
  console.error("DEBUG settings guard catch:", err);
  process.exit(0);
}
