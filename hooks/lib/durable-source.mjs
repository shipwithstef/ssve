// durable-source.mjs — WI-487 source-durability service.
//
// Pure classify + canonical-resolve + fail-closed enforcement guard. Imports the
// canonical resolveStateRoot / classifySource from enforcement-core (NO own copy
// — F-016). No writes.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  classifySource,
  resolveStateRoot,
  denialStateDigest,
} from "./enforcement-core.mjs";

export { classifySource, resolveStateRoot, denialStateDigest };

// ---------------------------------------------------------------------------
// resolveDurableCanonical(fromDir) — wrap `setup`'s git-common-dir resolution so
// the definition of "canonical main checkout" is single-sourced. From any
// worktree this resolves to the main checkout (the parent of the shared .git).
// Returns { root, isWorktree } or null when it cannot be resolved.
// ---------------------------------------------------------------------------
export function resolveDurableCanonical(fromDir) {
  const dir = fromDir || process.cwd();
  let common;
  try {
    common = execFileSync("git", ["rev-parse", "--git-common-dir"], {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
  if (!common) return null;
  let commonAbs = common;
  if (!path.isAbsolute(commonAbs)) commonAbs = path.resolve(dir, common);
  let root;
  try {
    root = fs.realpathSync(path.resolve(commonAbs, ".."));
  } catch {
    root = path.resolve(commonAbs, "..");
  }
  const isWorktree = path.resolve(dir).split(path.sep).includes(".worktrees");
  return { root, isWorktree };
}

// A reason code enum for enforcement-source loss (machine-readable).
export const REASON = {
  DANGLING: "SVC-ENFORCE-SOURCE-DANGLING",
  EPHEMERAL: "SVC-ENFORCE-SOURCE-EPHEMERAL",
  WORKTREE: "SVC-ENFORCE-SOURCE-WORKTREE",
  NO_HOME: "SVC-ENFORCE-NO-HOME",
};

// ---------------------------------------------------------------------------
// guardEnforcementSource(ctx) — the fail-closed check the governed-mutation
// guards (and the launcher) call. ctx:
//   { hook_id, source_path, operation, session_id, effective_source }
// `source_path` is the installed enforcement command/source the host actually
// invoked.
//
// It DENIES on the "enforcement genuinely lost" classes — `ephemeral`
// (source resolves under a temp prefix and can vanish) and `dangling` (missing /
// non-executable) — matching D-2's "dangling / non-executable / ephemeral-vanished"
// fail-closed default, with NO fail-open flag. A `worktree-bound` source that is
// PRESENT and runnable is NOT a fail-closed situation for this invocation (the
// source still enforces); repointing a worktree source to the canonical main
// checkout is setup/migration's job (AC-487-4), so it is allowed here with an
// advisory. A `durable-canonical` source passes straight through.
// ---------------------------------------------------------------------------
export function guardEnforcementSource(ctx = {}) {
  const sourcePath = ctx.source_path || "";
  const klass = classifySource(sourcePath);
  const base = {
    hook_id: ctx.hook_id || "svc-enforce",
    operation: ctx.operation || "governed mutation",
    session_id: ctx.session_id || "",
    resolved_command_path: safeReal(sourcePath),
    effective_source: ctx.effective_source || "",
    source_or_receipt_class: klass,
    target_exists: klass !== "dangling",
    target_executable: klass === "durable-canonical",
  };
  if (klass === "durable-canonical" || klass === "worktree-bound") {
    return { decision: "allow", classification: klass, advisory: klass === "worktree-bound" ? REASON.WORKTREE : undefined, ...base };
  }
  let reason_code = REASON.DANGLING;
  let cause = `The installed enforcement source '${sourcePath}' is dangling or non-executable; a previously-active safety guard would otherwise silently stop enforcing.`;
  if (klass === "ephemeral") {
    reason_code = REASON.EPHEMERAL;
    cause = `The installed enforcement source '${sourcePath}' resolves under an ephemeral prefix (e.g. /tmp) and can vanish; enforcement must not depend on a temporary directory.`;
  }
  const recovery = "Re-run `./setup --host <host>` from your canonical svc checkout (or `node scripts/svc-migrate-install.mjs --resume --host <host>`) to repoint enforcement at a durable source.";
  return {
    decision: "deny",
    classification: klass,
    reason_code,
    cause,
    recovery,
    ...base,
  };
}

function safeReal(p) {
  if (!p) return "";
  try { return fs.realpathSync(p); } catch { return p; }
}

export default {
  classifySource,
  resolveStateRoot,
  resolveDurableCanonical,
  guardEnforcementSource,
  denialStateDigest,
  REASON,
};
