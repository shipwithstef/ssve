#!/usr/bin/env node
/** Materialize exact inline JSON, or check artifact drift without writing. */
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_MANIFEST = path.join(ROOT, "docs/plans/2026-08-25-wi-fw-swarm-coordination/manifest.md");
const INTRO = "The contract artifact content is fixed NOW by this inline block";
const USAGE = "Usage: extract-inline-plan-contract.mjs [--manifest PATH] [--output PATH] [--check]";

/** Validate options while retaining the historical no-argument paths. */
function parse(argv) {
  let manifest; let output; let check = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--check" && !check) { check = true; continue; }
    if (!["--manifest", "--output"].includes(arg) || !argv[i + 1] || argv[i + 1].startsWith("-")) throw new Error(USAGE);
    const value = path.resolve(argv[++i]);
    if (arg === "--manifest" && manifest === undefined) manifest = value;
    else if (arg === "--output" && output === undefined) output = value;
    else throw new Error(USAGE);
  }
  manifest ??= DEFAULT_MANIFEST;
  output ??= path.join(path.dirname(manifest), "plan-contract.json");
  if (manifest === output) throw new Error("manifest and output must be different files");
  return { manifest, output, check };
}

/** Resolve the parent once; reject links and any existing alias of the source. */
function checkedOutput(manifest, output) {
  const source = fs.realpathSync(manifest);
  const destination = path.join(fs.realpathSync(path.dirname(output)), path.basename(output));
  let entry;
  try { entry = fs.lstatSync(destination); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  if (entry?.isSymbolicLink()) throw new Error("output must not be a symlink");
  const sourceStat = fs.statSync(source);
  if (destination === source || (entry && entry.dev === sourceStat.dev && entry.ino === sourceStat.ino)) {
    throw new Error("manifest and output must be different files");
  }
  return destination;
}

/** Replace an output entry atomically instead of writing through a changed link. */
function writeOutput(destination, bytes) {
  const temporary = path.join(path.dirname(destination), `.${path.basename(destination)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`);
  try {
    fs.writeFileSync(temporary, bytes, { flag: "wx", mode: 0o600 });
    fs.renameSync(temporary, destination);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

/** Preserve the fenced JSON bytes, including indentation and line endings. */
function extract(manifest) {
  const start = manifest.indexOf(INTRO);
  if (start < 0) throw new Error("inline contract intro not found in manifest");
  const tail = manifest.slice(start);
  const opening = /(?:^|\n)[ \t]*```json[ \t]*\r?\n/.exec(tail);
  if (!opening) throw new Error("no json fence after inline contract intro");
  const bodyStart = start + opening.index + opening[0].length;
  const body = manifest.slice(bodyStart);
  const closing = /^[ \t]*```[ \t]*\r?$/m.exec(body);
  if (!closing) throw new Error("unclosed json fence");
  const bytes = body.slice(0, closing.index);
  JSON.parse(bytes);  // Validate before any output mutation.
  return bytes;
}

/** Check first, avoid identical rewrites, and preserve the existing success fields. */
function main(argv) {
  if (argv.length === 1 && ["--help", "-h"].includes(argv[0])) { console.log(USAGE); return; }
  const { manifest, output, check } = parse(argv);
  const destination = checkedOutput(manifest, output);
  const bytes = extract(fs.readFileSync(manifest, "utf8"));
  const equal = fs.existsSync(destination) && fs.readFileSync(destination, "utf8") === bytes;
  if (check && !equal) throw new Error(`artifact missing or differs: ${output}`);
  if (!check && !equal) writeOutput(destination, bytes);
  console.log(JSON.stringify({ ok: true, [check ? "checked" : "wrote"]: path.relative(ROOT, output), bytes: Buffer.byteLength(bytes), changed: !equal }));
}

try { main(process.argv.slice(2)); }
catch (error) { console.error(`extract-inline-plan-contract: ${error.message}`); process.exitCode = 1; }
