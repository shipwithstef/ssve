#!/usr/bin/env node
// addon-index.mjs — list add-on pack skills (name + short description) found on
// disk, or print one skill's SKILL.md path. Used by the addon-gateway skill so
// add-on packs cost one listing entry instead of one per skill.
//
// Usage:
//   node addon-index.mjs                 # compact index of every pack on disk
//   node addon-index.mjs --path <name>   # absolute path of <name>/SKILL.md
//   node addon-index.mjs --json          # machine-readable index
//
// Roots: $SVC_ADDON_ROOTS (":"-separated dirs that contain <skill>/SKILL.md),
// else ~/.svc/external-skills/*/skills and ~/.agents/skills.

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";

const MAX_DESC = 110;

export function addonRoots(env = process.env, home = os.homedir()) {
  if (env.SVC_ADDON_ROOTS) return env.SVC_ADDON_ROOTS.split(":").filter(Boolean);
  const roots = [];
  const ext = path.join(home, ".svc", "external-skills");
  try {
    for (const pack of fs.readdirSync(ext).sort()) roots.push(path.join(ext, pack, "skills"));
  } catch { /* no external packs installed */ }
  roots.push(path.join(home, ".agents", "skills"));
  return roots;
}

export function readFrontmatter(text) {
  const m = text.replace(/^\uFEFF/, "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const fm = m[1];
  const name = fm.match(/^name:\s*["']?([^"'\n]+)["']?\s*$/m)?.[1]?.trim();
  let desc = "";
  const d = fm.match(/^description:\s*(.*)$/m);
  if (d) {
    const first = d[1].trim();
    const block = /^[>|][-+]?$/.test(first);
    const lines = block ? [] : [first];
    // Folded/literal blocks and plain multi-line scalars both continue on indented lines.
    for (const line of fm.slice(d.index + d[0].length).split(/\r?\n/).slice(1)) {
      if (!/^\s+\S/.test(line)) break;
      lines.push(line.trim());
    }
    desc = lines.join(" ").trim().replace(/^["']|["']$/g, "");
  }
  return { name, description: desc };
}

export function buildIndex(roots) {
  const packs = [];
  const seen = new Set();
  for (const root of roots) {
    let dirs;
    try { dirs = fs.readdirSync(root).sort(); } catch { continue; }
    const skills = [];
    for (const dir of dirs) {
      const file = path.join(root, dir, "SKILL.md");
      let text;
      try {
        // A SKILL.md that resolves outside its pack root (a symlink elsewhere) is not listed.
        const real = fs.realpathSync(file);
        if (!real.startsWith(fs.realpathSync(root) + path.sep)) continue;
        text = fs.readFileSync(real, "utf8");
      } catch { continue; }
      const { name, description } = readFrontmatter(text);
      const id = name || dir;
      if (seen.has(id)) continue;
      seen.add(id);
      skills.push({ name: id, description: description || "", path: file });
    }
    if (skills.length) packs.push({ root, pack: path.basename(path.dirname(root)) || root, skills });
  }
  return packs;
}

function short(s) {
  const one = s.replace(/\s+/g, " ").trim()
    .replace(/^When the user wants (?:help with |to )?/i, "")
    .replace(/^(?:\w)/, (c) => c.toUpperCase());
  return one.length > MAX_DESC ? one.slice(0, MAX_DESC - 1) + "…" : one;
}

function main(argv) {
  const packs = buildIndex(addonRoots());
  if (argv[0] === "--json") {
    process.stdout.write(JSON.stringify(packs, null, 2) + "\n");
    return 0;
  }
  if (argv[0] === "--path") {
    const want = argv[1];
    for (const p of packs) for (const s of p.skills) if (s.name === want) { process.stdout.write(s.path + "\n"); return 0; }
    process.stderr.write(`addon-index: no add-on skill named "${want}"\n`);
    return 1;
  }
  if (!packs.length) {
    process.stdout.write("No add-on packs found. Install one per EXTERNAL_ADDONS.md (e.g. clone coreyhaines31/marketingskills to ~/.svc/external-skills/marketingskills), or set SVC_ADDON_ROOTS.\n");
    return 0;
  }
  for (const p of packs) {
    process.stdout.write(`### ${p.pack} (${p.skills.length}) — ${p.root}\n`);
    for (const s of p.skills) process.stdout.write(`- ${s.name}: ${short(s.description)}\n`);
  }
  return 0;
}

// Main-module check that survives the symlinked install path (~/.claude/skills/...).
const isMain = (() => { try { return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) process.exit(main(process.argv.slice(2)));
