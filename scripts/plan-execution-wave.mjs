#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planExecutionGraph } from "../hooks/lib/delegation-authority.mjs";

function flags(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) throw new Error(`unexpected argument: ${key}`);
    out[key] = argv[++index];
  }
  return out;
}

export function run(argv = process.argv.slice(2)) {
  const args = flags(argv);
  if (!args["--wi"] || !args["--base-sha"] || !args["--tasks"] || !args["--out"]) {
    throw new Error("Usage: plan-execution-wave.mjs --wi WI-N --base-sha SHA --tasks tasks.json --out execution-graph.json");
  }
  const tasks = JSON.parse(fs.readFileSync(path.resolve(args["--tasks"]), "utf8"));
  if (!Array.isArray(tasks)) throw new Error("--tasks must contain a JSON array");
  const graph = planExecutionGraph({ wi: args["--wi"], baseSha: args["--base-sha"], tasks });
  const out = path.resolve(args["--out"]); fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(graph, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ out, waves: graph.waves.length, tasks: Object.keys(graph.tasks).length })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { run(); } catch (error) { process.stderr.write(`[plan-execution-wave] ${error.message}\n`); process.exit(2); }
}
