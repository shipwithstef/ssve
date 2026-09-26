#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { selectProjectSkills, codexLaunchArgs, runCodex, usageReport } from "./lib/project-skill-profile.mjs";

const frameworkRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const commands = new Set(["select", "usage", "load", "codex-args", "launch-codex"]);
function parse(argv) {
  const out = { files: [], explicitSkills: [], passthrough: [] };
  const sep = argv.indexOf("--");
  const flags = sep < 0 ? argv : argv.slice(0, sep);
  if (sep >= 0) out.passthrough = argv.slice(sep + 1);
  out.command = flags.shift();
  if (!commands.has(out.command)) throw new Error("expected select, usage, load, codex-args, or launch-codex");
  const names = { "--project": "projectRoot", "--intent": "intent", "--files": "files", "--active-skill": "activeSkill", "--next-skill": "nextSkill", "--explicit-skill": "explicitSkills", "--host": "host", "--skill": "skill", "--codex-home": "codexHome", "--codex-bin": "codexBin" };
  for (let i = 0; i < flags.length; i++) {
    const flag = flags[i];
    const key = names[flag];
    if (!key) throw new Error(`unknown option: ${flag}`);
    const value = flags[++i];
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
    if (key === "files") out.files.push(...value.split(",").filter(Boolean));
    else if (key === "explicitSkills") out.explicitSkills.push(value);
    else out[key] = value;
  }
  if (!out.projectRoot) throw new Error("--project is required");
  if (sep < 0 && out.command === "launch-codex") out.passthrough = [];
  return out;
}
try {
  const a = parse(process.argv.slice(2));
  const projectRoot = fs.realpathSync(a.projectRoot);
  if (a.command === "usage") {
    process.stdout.write(JSON.stringify(usageReport(projectRoot), null, 2) + "\n");
  } else if (a.command === "load") {
    if (!a.skill || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.skill)) throw new Error("load requires a valid --skill");
    const profile = selectProjectSkills({ frameworkRoot, projectRoot, explicitSkills: [a.skill], host: a.host || "codex" });
    const item = profile.selected.find((x) => x.name === a.skill);
    if (!item) throw new Error(`unknown skill: ${a.skill}`);
    process.stdout.write(fs.readFileSync(item.canonical_path, "utf8"));
  } else {
    const host = a.command === "codex-args" || a.command === "launch-codex" ? "codex" : a.host || "codex";
    const profile = selectProjectSkills({ frameworkRoot, projectRoot, intent: a.intent || "", files: a.files, activeSkill: a.activeSkill || null, nextSkill: a.nextSkill || null, explicitSkills: a.explicitSkills, host });
    if (a.command === "select") process.stdout.write(JSON.stringify(profile, null, 2) + "\n");
    else {
      const launch = codexLaunchArgs({ profile, userArgs: a.passthrough, codexHome: a.codexHome, projectRoot });
      if (a.command === "codex-args") process.stdout.write(JSON.stringify({ argv: launch.argv, excluded_count: launch.excluded_count, selected_count: profile.selected.length }, null, 2) + "\n");
      else process.exitCode = runCodex({ argv: launch.argv, binary: a.codexBin || "codex", cwd: projectRoot });
    }
  }
} catch (error) {
  process.stderr.write(`skill-profile: ${error.message}\n`);
  process.exitCode = 2;
}
