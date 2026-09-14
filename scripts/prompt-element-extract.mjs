#!/usr/bin/env node
/**
 * prompt-element-extract.mjs — WI-411 adapter (the only net-new code).
 *
 * Turns a prompt's OUTPUT into the `{elements:[{key,content}]}` requirement-coverage shape
 * that scripts/blind-floor-check.mjs (reused verbatim from WI-410) consumes.
 *
 * Emits an element ONLY for requirements the output COVERS. So when the floor compares
 * baseline-coverage (B) vs craft-coverage (F):
 *   - a requirement B covered but F dropped  → REMOVE (a floor VIOLATION — never-worse breached)
 *   - a requirement F covered but B did not  → ADD (an improvement, always allowed)
 * No false ALTER: requirements are present-or-absent, never "changed".
 *
 * Objective-first keys are authored ONCE from the task brief and applied SYMMETRICALLY to the
 * baseline output and the craft output (no F-favoritism). Purely-subjective quality goes to the
 * cross-family judge (prompt-floor-judge.sh), never silently graded here.
 *
 * Purity (AC3): same {output, requirements} → identical elements JSON. No Date.now/Math.random.
 *
 * Usage:
 *   node scripts/prompt-element-extract.mjs --output out.txt --requirements reqs.json
 *
 * reqs.json: { "requirements": [ { "key": "req:cta-present", "type": "<type>", ...params } ] }
 *   types:
 *     max-words        { value: N }         covered iff word-count <= N
 *     min-words        { value: N }         covered iff word-count >= N
 *     present          { pattern: "re" }    covered iff regex matches (case-sensitive)
 *     forbidden-absent { pattern: "re" }    covered iff regex does NOT match
 */
import { readFileSync, existsSync } from "node:fs";

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--output") o.output = argv[++i];
    else if (a === "--requirements") o.requirements = argv[++i];
  }
  return o;
}
function fail(m) { process.stderr.write(`prompt-element-extract: ${m}\n`); process.exit(2); }

function wordCount(s) { return (s.trim().match(/\S+/g) || []).length; }

// Guard against a malformed requirement pattern: fail cleanly (exit 2) rather than crash with a stack trace.
function reTest(pattern, s, key) {
  let re;
  try { re = new RegExp(pattern); } catch (e) { fail(`invalid regex in requirement "${key}": ${e.message}`); }
  return re.test(s);
}

/** PURE: which requirements does this output cover? */
export function coverage(output, requirements) {
  const elements = [];
  for (const r of requirements) {
    if (!r || typeof r.key !== "string") fail(`requirement missing string "key"`);
    let covered = false;
    switch (r.type) {
      case "max-words": covered = wordCount(output) <= Number(r.value); break;
      case "min-words": covered = wordCount(output) >= Number(r.value); break;
      case "present": covered = reTest(r.pattern, output, r.key); break;
      case "forbidden-absent": covered = !reTest(r.pattern, output, r.key); break;
      default: fail(`unknown requirement type: ${r.type}`);
    }
    if (covered) elements.push({ key: r.key, content: "covered" });
  }
  // Deterministic order: sort by key (no clock, no input-order dependence).
  elements.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return { elements };
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  if (!a.output || !existsSync(a.output)) fail(`output file not found: ${a.output}`);
  if (!a.requirements || !existsSync(a.requirements)) fail(`requirements file not found: ${a.requirements}`);
  const output = readFileSync(a.output, "utf8");
  let reqs;
  try { reqs = JSON.parse(readFileSync(a.requirements, "utf8")).requirements; }
  catch (e) { fail(`requirements not valid JSON: ${e.message}`); }
  if (!Array.isArray(reqs)) fail(`requirements.requirements must be an array`);
  process.stdout.write(JSON.stringify(coverage(output, reqs), null, 2) + "\n");
}

if (import.meta.url === `file://${process.argv[1]}`) main();
