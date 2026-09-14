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
// WI-494 round-2 F-004: readMarker (and the writer's atomicWriteJson/mkdirSync)
// only ever inspect the LEAF path; worktree-safety elsewhere in the codebase was
// a lexical path.dirname string comparison. Neither notices a PRE-PLANTED symlink
// at an intermediate component (.svc, .svc/bootstrap-intent, .worktrees) that
// redirects a read or a create/write outside the repository. secureAncestors
// walks every EXISTING path segment between repoRoot and dirname(targetPath) and
// fails closed (false) if any segment is a symlink, a non-directory, or (when the
// platform exposes uid) owned by a different user. A segment that does not exist
// yet is fine -- it will be created fresh (0o700, same uid) by the caller's own
// mkdir immediately afterward; only an EXISTING foreign/symlinked component is a
// fence hit. Callers MUST invoke this before authorizing a marker read AND again
// immediately before the write/mkdir it protects (a symlink can be planted or
// swapped between the two).
//
// R2-F004: a residual same-uid TOCTOU race between this pathname-walk check and
// the caller's mkdir/write remains (a native openat/O_NOFOLLOW helper would be
// needed to close it fully). Accepted as-is for this WI, not gold-plated further
// -- the pre-planted-symlink vector this function targets is fully closed.
export function secureAncestors(repoRoot, targetPath) {
  let repoReal;
  try { repoReal = fs.realpathSync(repoRoot); } catch { return false; }
  const target = path.resolve(targetPath);
  const parent = path.dirname(target);
  const rel = path.relative(repoReal, parent);
  if (rel === "") return true;
  if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return false;
  let current = repoReal;
  for (const segment of rel.split(path.sep)) {
    if (!segment) continue;
    current = path.join(current, segment);
    let stat;
    try { stat = fs.lstatSync(current); } catch { continue; }
    if (!stat.isDirectory() || stat.isSymbolicLink()) return false;
    if (typeof process.getuid === "function" && stat.uid !== process.getuid()) return false;
  }
  return true;
}

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
