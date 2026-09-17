// WI-FW-HOOKS-SAFETY-01 T01/AC-1: one literal Git-ref validator + worktree
// identity helpers. Replaces every branch-regex copy (`[A-Za-z0-9._-]`) that
// made normal hierarchical branches such as `feat/wt-lane-fw-hooks-safety`
// impossible to bootstrap or recover (FP-01), while keeping path traversal
// impossible: the branch is validated as a GIT REF and never used directly as
// a filesystem path.
//
// Git rules, not a filesystem-name regex (git-scm.com/docs/git-check-ref-format):
//   - validate the full ref `refs/heads/<candidate>` with `git check-ref-format`
//     via execFileSync -- no shell, no --normalize, no --branch shorthand
//     expansion, no @{-N} checkout syntax.
//   - pre-reject NUL/control bytes and a leading `-` before invoking Git.
//   - require the candidate to survive an encoder/lexer round trip byte-exactly
//     before it may reach any shell argument position.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { lexSimpleCommand } from "../codex/lib/argv-lex.mjs";
import { encodeSimpleCommand } from "../codex/lib/argv-encode.mjs";
import { resolveApprovedRoots, resolveWorktreesRoot } from "./worktree-policy.mjs";

// Documented byte cap: far above every practical branch name, far below Git's
// own pathname limits, and cheap to enforce before any subprocess call.
export const MAX_BRANCH_BYTES = 200;

const PASS = (detail) => ({ ok: true, ...detail });

export function validateLiteralBranchName(candidate) {
  if (typeof candidate !== "string" || candidate.length === 0) {
    return { ok: false, reason_code: "BRANCH_REF_INVALID", reason: "branch must be a non-empty string" };
  }
  if (Buffer.byteLength(candidate, "utf8") > MAX_BRANCH_BYTES) {
    return { ok: false, reason_code: "BRANCH_REF_INVALID", reason: `branch exceeds the ${MAX_BRANCH_BYTES}-byte cap` };
  }
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(candidate)) {
    return { ok: false, reason_code: "BRANCH_REF_INVALID", reason: "branch contains control characters" };
  }
  if (candidate.startsWith("-")) {
    return { ok: false, reason_code: "BRANCH_REF_INVALID", reason: "branch must not start with '-'" };
  }
  let gitReason = "";
  try {
    execFileSync("git", ["check-ref-format", `refs/heads/${candidate}`], { stdio: ["ignore", "ignore", "pipe"] });
  } catch (error) {
    gitReason = String(error?.stderr || error?.message || "").trim().split(/\r?\n/)[0] || "rejected by git check-ref-format";
    return { ok: false, reason_code: "BRANCH_REF_INVALID", reason: gitReason };
  }
  const encoded = encodeSimpleCommand([candidate]);
  const lexed = lexSimpleCommand(encoded);
  if (!lexed.ok || lexed.argv.length !== 1 || lexed.argv[0] !== candidate) {
    return { ok: false, reason_code: "BRANCH_REF_INVALID", reason: "branch does not survive shell-argument round trip" };
  }
  return PASS({ branch: candidate });
}

// Convenience wrapper for callers that only need a boolean (parser shapes).
export function isValidLiteralBranchName(candidate) {
  return validateLiteralBranchName(candidate).ok;
}

// AC-1/FP-02: worktree identity is independent of the ref text. A slash-free,
// filesystem-safe branch keeps the legacy `.worktrees/<branch>` layout; any
// other Git-valid branch gets a deterministic collision-resistant leaf:
//   <wi-lower>-<readable-last-component>-<sha256(branch)[0:12]>
// Two distinct branches can therefore never collide on one directory even when
// their readable slugs match, and no branch byte reaches path construction
// unescaped (only [A-Za-z0-9._-] survive sanitization).
export function worktreeLeafFor(branch, wi = "") {
  const last = String(branch).split("/").filter(Boolean).pop() || "wt";
  const readable = last.replace(/[^A-Za-z0-9._-]/g, "-").replace(/^[.-]+|[.-]+$/g, "").slice(0, 48) || "wt";
  const hash = createHash("sha256").update(String(branch), "utf8").digest("hex").slice(0, 12);
  const wiLower = String(wi || "").toLowerCase();
  return `${wiLower ? `${wiLower}-` : ""}${readable}-${hash}`;
}

export function needsDerivedWorktreeLeaf(branch) {
  return typeof branch === "string" && branch.includes("/");
}

// AC-3/T03: approved canonical worktree roots. Includes the centralized
// policy root, the parent base (e.g. ~/worktrees), legacy in-repo `.worktrees`,
// project-specific roots, and SVC_APPROVED_WORKTREE_ROOTS. Each existing root
// must be a real directory owned by the current UID with no symlink component.
export function approvedWorktreeRoots(repoRoot, env = process.env) {
  const roots = [];
  for (const candidate of resolveApprovedRoots(repoRoot, env)) {
    let real;
    try { real = fs.realpathSync(path.resolve(candidate)); } catch { continue; }
    let stat;
    try { stat = fs.lstatSync(real); } catch { continue; }
    if (!stat.isDirectory() || stat.isSymbolicLink()) continue;
    if (typeof process.getuid === "function" && stat.uid !== process.getuid()) continue;
    let current = real;
    let symlinkRejected = false;
    while (current !== path.parse(current).root) {
      let ancestor;
      try { ancestor = fs.lstatSync(current); } catch { symlinkRejected = true; break; }
      if (ancestor.isSymbolicLink()) { symlinkRejected = true; break; }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
    if (symlinkRejected) continue;
    if (!roots.includes(real)) roots.push(real);
  }
  return roots;
}

function isRealpathContained(rootReal, candidateReal) {
  const rel = path.relative(rootReal, candidateReal);
  return rel === "" || (!!rel && !rel.startsWith("..") && !path.isAbsolute(rel));
}

// Same-UID + no-symlink ancestry walk (defense-in-depth mirror of the
// bootstrap's secureAncestors, usable without importing consumer-only code).
export function secureAncestorChain(fromReal, toReal) {
  const start = path.resolve(fromReal);
  const end = path.resolve(toReal);
  let current = end;
  for (;;) {
    let stat;
    try { stat = fs.lstatSync(current); } catch { return { ok: false, reason: `missing path ${current}` }; }
    if (stat.isSymbolicLink()) return { ok: false, reason: `symlinked ancestor ${current}` };
    if (stat.uid !== process.getuid()) return { ok: false, reason: `foreign-owned ancestor ${current}` };
    if (current === start || current === path.parse(current).root) break;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return { ok: true };
}

// Adoption eligibility for an EXISTING registered worktree outside the default
// root: its realpath must sit beneath one approved canonical root, and the
// chain from that root down to the worktree must be same-UID and symlink-free.
export function isApprovedExistingWorktreeRoot(worktreePath, repoRoot, env = process.env) {
  let real;
  try { real = fs.realpathSync(path.resolve(worktreePath)); } catch { return { ok: false, reason: "worktree path does not resolve" }; }
  for (const root of approvedWorktreeRoots(repoRoot, env)) {
    if (!isRealpathContained(root, real) || real === root) continue;
    const chain = secureAncestorChain(root, real);
    if (!chain.ok) return { ok: false, reason: chain.reason };
    return PASS({ root, realpath: real });
  }
  return { ok: false, reason_code: "WORKTREE_ROOT_UNAPPROVED", reason: `no approved canonical worktree root contains ${real}` };
}

export function defaultWorktreeRoot(repoRoot, env = process.env) {
  try {
    return resolveWorktreesRoot(repoRoot, env);
  } catch {
    return path.join(fs.realpathSync(repoRoot), ".worktrees");
  }
}

export function platformPathSeparatorNote() {
  return `paths use '${path.sep}' on ${os.platform()}`;
}
