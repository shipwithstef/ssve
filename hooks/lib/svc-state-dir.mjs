// WI-452: resolve the .svc runtime-state directory for a hook write.
//
// Hooks must NEVER create `.svc/` in an arbitrary working directory. When a tool
// call's cwd (or the hook process cwd) is `/tmp` — scratchpad writes, subagent /
// sandbox processes — a cwd-relative `.svc/` seeds `/tmp/.svc`, which (with a
// stray `/tmp/.git`, e.g. the Codex sandbox tmpfs) makes `/tmp` look
// svc-governed and breaks `svc-session-contract-freshness` (it then hard-blocks
// /tmp writes; tier-1 A3 fails).
//
// resolveSvcStateDir walks up from startDir and returns `<root>/.svc` for the
// nearest ancestor that ALREADY has an existing `.svc/` directory — EXCEPT it
// never treats the system temp ROOT itself (os.tmpdir(), "/tmp") as a candidate.
// It returns null otherwise — so a hook can skip persistence rather than seed
// `.svc` in /tmp or a foreign cwd.
//
// Two guarantees together close the loop (Codex WI-452 review P1):
//  1. PRE-EXISTING `.svc/` required → hooks never create the FIRST `.svc` outside
//     an onboarded repo (the cycle-breaker for fresh scratch dirs).
//  2. The temp ROOT is never authoritative → an ALREADY-polluted `/tmp/.svc`
//     (from a prior buggy run / sandbox) is IGNORED, not perpetuated. A real
//     repo root is never the bare temp root, and legit fixtures live in
//     subdirs of it (e.g. /tmp/tmp.XXXX), which remain resolvable.
// `.svc` presence (not `.git`) is the marker — matches long-standing findSvcDir
// semantics (active-intent, stop-quality); test fixtures and some onboarded
// trees carry `.svc` without a sibling `.git`.
//
// Bulletproof by contract (runs on every tool event in every seeder hook):
// never throws, bounded by path depth, no allocation beyond the walk.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// System temp ROOTs that must never be treated as an svc repo (pollution lives
// directly at /tmp/.svc; legit work never has a repo root AT the temp root).
const TEMP_ROOTS = (() => {
  const s = new Set();
  for (const t of [os.tmpdir(), "/tmp", process.env.TMPDIR]) {
    if (!t) continue;
    try { s.add(path.resolve(t)); } catch {}
    try { s.add(fs.realpathSync(t)); } catch {}
  }
  return s;
})();

export function resolveSvcStateDir(startDir) {
  let dir;
  try {
    dir = path.resolve(startDir || process.cwd());
  } catch {
    return null;
  }
  while (true) {
    if (!TEMP_ROOTS.has(dir)) {
      try {
        if (fs.statSync(path.join(dir, ".svc")).isDirectory()) {
          return path.join(dir, ".svc");
        }
      } catch {
        // stat miss / permission — treat as "not here", keep walking.
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null; // reached filesystem root
    dir = parent;
  }
}

export default resolveSvcStateDir;
