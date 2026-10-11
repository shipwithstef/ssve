// Hidden component graders for the northstar bar. They score the BUILT ARTIFACT of either
// arm from 0 to 1 per component; they are not the framework's own checks.
//
//   gradeComponents(dir, task, { components: ["E", "P"] })
//     -> { E?, S?, P?, K?, details: { E: { checks }, ... } }
//
// Each component lives in its own module (E.mjs, S.mjs, P.mjs, K.mjs) exporting
//   async grade(dir, task, spec) -> { score: 0..1, checks: [{ name, pass, detail }] }
// and reads specs/<task>/<component>.json (for a task kept outside the repo, under
// NORTHSTAR_TASK_ROOTS: <task dir>/specs/<component>.json; see task-roots.mjs). Only the requested modules are imported. A
// missing module, a missing spec or a thrown error scores 0 for that component with the
// error in details: a grader that cannot run never passes a build.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { specDirFor } from "./task-roots.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SPECS_DIR = path.resolve(HERE, "..", "specs");
export const COMPONENTS = ["E", "S", "P", "K"];

export function readSpec(task, component, specsDir = SPECS_DIR) {
  // An explicit specsDir (tests) is a root of <task>/ subdirectories; the default follows the task.
  const file = path.join(specsDir === SPECS_DIR ? specDirFor(task) : path.join(specsDir, task), `${component}.json`);
  if (!fs.existsSync(file)) throw new Error(`no ${component} spec for task "${task}"`);
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { throw new Error(`${component} spec for "${task}" is not valid JSON: ${e.message}`); }
}

export function clamp01(x) {
  return typeof x === "number" && Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0;
}

export async function gradeComponents(dir, task, { components = [], specsDir = SPECS_DIR, graderDir = HERE } = {}) {
  const out = { details: {} };
  for (const c of components) {
    if (!COMPONENTS.includes(c)) { out[c] = 0; out.details[c] = { error: `unknown component "${c}"`, checks: [] }; continue; }
    try {
      const mod = await import(pathToFileURL(path.join(graderDir, `${c}.mjs`)).href);
      if (typeof mod.grade !== "function") throw new Error(`${c}.mjs does not export grade()`);
      const spec = readSpec(task, c, specsDir);
      const r = await mod.grade(path.resolve(dir), task, spec);
      out[c] = clamp01(r?.score);
      out.details[c] = { checks: Array.isArray(r?.checks) ? r.checks : [] };
    } catch (e) {
      out[c] = 0;
      out.details[c] = { error: String(e?.message || e).slice(0, 400), checks: [] };
    }
  }
  return out;
}
