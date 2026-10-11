// Mutation score of a build's own tests, run inside the grader's jail.
//   node mutation-ep.mjs <options.json>      (cwd = the build copy)  prints one JSON line
// scripts/quality-probes.mjs copies the build without node_modules into a fresh temporary
// directory. Node resolves packages by walking up from the importing file, so that directory
// is made a child of a holder that carries a node_modules link to the build's installed
// dependencies: dependency-backed tests then run as shipped before any mutation.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const opts = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const work = process.cwd();
const holder = fs.mkdtempSync(path.join(os.tmpdir(), "mut-"));
if (fs.existsSync(path.join(work, "node_modules"))) fs.symlinkSync(path.join(work, "node_modules"), path.join(holder, "node_modules"), "dir");
process.env.TMPDIR = holder;
try {
  const { mutation } = await import(pathToFileURL(path.join(opts.scripts_root, "quality-probes.mjs")).href);
  const r = mutation(work, { mutants: opts.mutants, timeoutMs: opts.timeoutMs });
  process.stdout.write(`\n${JSON.stringify({ ok: true, ...r })}\n`, () => process.exit(0));
} catch (e) {
  process.stdout.write(`\n${JSON.stringify({ ok: false, error: String(e.message).slice(0, 200) })}\n`, () => process.exit(0));
} finally { fs.rmSync(holder, { recursive: true, force: true }); }
