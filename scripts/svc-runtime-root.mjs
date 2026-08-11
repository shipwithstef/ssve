#!/usr/bin/env node
import { resolveRuntimeDirectory } from "../hooks/lib/svc-runtime-root.mjs";

const args = process.argv.slice(2);
let leaf = "";
let legacyCodex = false;
let json = false;
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--leaf") leaf = args[++index] || "";
  else if (args[index] === "--legacy-codex") legacyCodex = true;
  else if (args[index] === "--json") json = true;
  else {
    process.stderr.write(`svc-runtime-root: unknown argument ${args[index]}\n`);
    process.exit(2);
  }
}
if (!leaf) {
  process.stderr.write("svc-runtime-root: --leaf is required\n");
  process.exit(2);
}
try {
  const result = resolveRuntimeDirectory({ leaf, legacyCodexDirect: legacyCodex, legacyCodexHome: legacyCodex });
  process.stdout.write(json ? `${JSON.stringify(result)}\n` : `${result.path}\n`);
} catch (error) {
  process.stderr.write(`svc-runtime-root: ${error.message}\n`);
  process.exit(2);
}
