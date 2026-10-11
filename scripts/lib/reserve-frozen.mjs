// A reserve task must exist, be frozen in bar.json (grader_sha256 not null) and hash to the
// frozen value before anything is paid for. One implementation for `northstar plan` and
// `outcome-eval run`. Returns null for a task that is not a reserve task, { sha } when it checks
// out, or { problem } with the refusal text.
import fs from "node:fs";
import { dirSha } from "./dir-sha.mjs";

export function reserveFrozenCheck(task, dir, bar) {
  const entry = (bar?.reserve || []).find((r) => r.task === task);
  if (!entry) return null;
  if (!dir || !fs.existsSync(dir)) return { problem: `reserve task ${task} not found: pass --tasks-root <dir> holding ${task}/` };
  if (entry.grader_sha256 == null) return { problem: `reserve task ${task} has no frozen grader_sha256 in bar.json: freeze it first (node scripts/northstar.mjs reserve-hash <root>)` };
  let got;
  try { got = dirSha(dir); } catch (e) { return { problem: e.message, hashError: true }; }
  if (got !== entry.grader_sha256) return { problem: `reserve task ${task} differs from its frozen grader_sha256 (bar.json ${entry.grader_sha256.slice(0, 12)}, directory ${got.slice(0, 12)}): the reserve changed after it was frozen` };
  return { sha: got };
}
