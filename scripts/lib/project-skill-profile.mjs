import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { loadIndex, route } from "./skill-router.mjs";

const CORE = ["route-workflow", "research"];
const FRAMEWORK = ["improve-framework", "evolve-framework", "test-framework", "audit-implementation"];
const PRODUCT = ["write-spec", "design-tech", "diagnose-bug", "plan-capabilities"];
const DELIVERY = ["plan-changeset", "review-plan", "execute-changeset", "review-exec", "land-changeset", "verify-promotion"];
const UI = ["design-ux", "design-ui", "page-ux-improve", "propose-ux-improvements", "explore-ux"];
const COMPARISON = ["analyze-competitors"];
const HOSTS = new Set(["codex", "grok", "claude", "cursor"]);

function exists(root, rel) { return fs.existsSync(path.join(root, rel)); }
function words(value) { return String(value || "").toLowerCase(); }
function list(value) { return Array.isArray(value) ? value.filter((x) => typeof x === "string") : []; }

export function detectProjectType(projectRoot) {
  const framework = exists(projectRoot, "skills-manifest.json") && exists(projectRoot, "DOCTRINE.md") && exists(projectRoot, "skills/route-workflow/SKILL.md");
  if (framework) return { type: "framework", signals: ["skills-manifest.json", "DOCTRINE.md", "skills/route-workflow/SKILL.md"] };
  const signals = [];
  if (exists(projectRoot, "package.json")) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (["react", "next", "vite", "vue", "svelte", "@angular/core"].some((x) => Object.hasOwn(deps, x))) signals.push("web-package");
    } catch { /* malformed package data cannot enable a capability */ }
  }
  if (["src/App.tsx", "src/App.jsx", "app/page.tsx", "pages/index.tsx", "index.html"].some((x) => exists(projectRoot, x))) signals.push("web-entry");
  return { type: signals.length ? "web-product" : "general", signals };
}

export function readSkillPreferences(projectRoot) {
  const empty = (diagnostic = null) => diagnostic ? { include: [], exclude: [], diagnostic } : { include: [], exclude: [] };
  const svcDir = path.join(projectRoot, ".svc");
  const file = path.join(svcDir, "project-preferences.json");
  let fd;
  try {
    if (!fs.lstatSync(svcDir).isDirectory()) return empty("preferences-directory-not-regular");
    if (!fs.lstatSync(file).isFile()) return empty("preferences-file-not-regular");
    fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > 16 * 1024) return empty("preferences-file-not-regular-or-oversize");
    const data = JSON.parse(fs.readFileSync(fd, "utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data)) return empty("preferences-invalid-json-object");
    if (data.skills === undefined) return empty();
    const cfg = data.skills;
    if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)
      || (cfg.include !== undefined && (!Array.isArray(cfg.include) || cfg.include.some((x) => typeof x !== "string")))
      || (cfg.exclude !== undefined && (!Array.isArray(cfg.exclude) || cfg.exclude.some((x) => typeof x !== "string")))) return empty("preferences-invalid-skills");
    return { include: cfg.include || [], exclude: cfg.exclude || [] };
  } catch (error) {
    return empty(error.code === "ENOENT" ? null : "preferences-unreadable-or-invalid");
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

export function selectProjectSkills({ frameworkRoot, projectRoot, intent = "", files = [], activeSkill = null, nextSkill = null, explicitSkills = [], host = "codex", preferences = null }) {
  if (!HOSTS.has(host)) throw new Error(`unsupported host: ${host}`);
  const project = path.resolve(projectRoot);
  const framework = path.resolve(frameworkRoot);
  const { index, byName } = loadIndex(framework);
  const detected = detectProjectType(project);
  let prefs = preferences || readSkillPreferences(project);
  const diagnostics = prefs.diagnostic ? [prefs.diagnostic] : [];
  if ([...list(prefs.include), ...list(prefs.exclude)].some((name) => !byName.has(name))) {
    prefs = { include: [], exclude: [] };
    diagnostics.push("preferences-unknown-skill");
  }
  const eligible = new Map();
  const add = (names, reason) => {
    for (const name of names) if (byName.has(name)) {
      const reasons = eligible.get(name) || new Set();
      reasons.add(reason);
      eligible.set(name, reasons);
    }
  };
  add(CORE, "routing-kernel");
  add(detected.type === "framework" ? FRAMEWORK : PRODUCT, `project:${detected.type}`);
  const q = words(intent);
  const fileHints = list(files).join(" ").toLowerCase();
  if (/\b(implement|build|execute|review|merge|ship|release|changeset|plan)\b/.test(q)) add(DELIVERY, "task:delivery");
  if (/\b(bug|broken|regression|debug|failure|fix)\b/.test(q)) add(["diagnose-bug"], "task:bug");
  const interfaceTask = /\b(ui|ux|page|screen|layout|homepage|landing|visual|design|responsive|styling)\b/.test(q) || /\.(tsx|jsx|css|scss)$/.test(fileHints);
  if (interfaceTask) {
    add(UI, "task:interface");
    if (detected.type === "web-product") add(["analyze-competitors"], "task:same-job-reference");
  }
  const comparisonTask = /\b(competitor|compare|comparison|benchmark|reference|same.job)\b/.test(q) && /\b(ui|ux|page|screen|landing|homepage|design|product)\b/.test(q);
  if (comparisonTask) add(COMPARISON, "task:interface-comparison");
  const marketingPageTask = /\b(landing(?: page)?|pricing page|marketing page|home ?page)\b/.test(q)
    && !/\b(app|dashboard|settings|authenticated)\b/.test(q);
  if (marketingPageTask) {
    add(["landing-page"], "task:marketing-page");
    add(["benchmark-landing"], "task:marketing-page-reference");
  }
  if (/\b(security|threat|owasp|auth|credential)\b/.test(q)) add(["review-security"], "task:security");
  // Namespaced slash/$ mentions are explicit; ordinary prose is left to the router.
  const requested = [...explicitSkills];
  for (const match of intent.matchAll(/(?:^|\s)[/$]([a-z0-9]+(?:-[a-z0-9]+)*)\b/g)) if (byName.has(match[1])) requested.push(match[1]);
  for (const name of requested) {
    if (!byName.has(name)) throw new Error(`unknown explicitly requested skill: ${name}`);
    add([name], "explicit-request");
  }
  for (const name of list(prefs.include)) {
    add([name], "project-preference");
  }
  const taskRoute = route({
    root: framework, intent, files: list(files), activeSkill, nextSkill,
    mode: "suggest", receipts: false, eligibleSkills: [...eligible.keys()],
  });
  for (const name of taskRoute.required) add([name], "required-router-pin");
  const protectedNames = new Set([...taskRoute.required, ...requested]);
  for (const name of list(prefs.exclude)) {
    if (!protectedNames.has(name)) eligible.delete(name);
  }
  const skills = [...eligible].sort(([a], [b]) => a.localeCompare(b)).map(([name, reasons]) => ({
    name,
    canonical_path: path.join(framework, byName.get(name).path),
    reasons: [...reasons].sort(),
  }));
  return {
    schema_version: 1,
    project_type: detected.type,
    project_signals: detected.signals,
    diagnostics,
    host,
    framework_root: framework,
    catalog: { first_party: index.skills.length, selected: skills.length, outside_profile: index.skills.length - skills.length },
    selected: skills,
    required: taskRoute.required,
    suggestions: taskRoute.suggestions.filter((x) => eligible.has(x.skill)).map((x) => x.skill),
    exposure: host === "codex"
      ? { status: "available-with-launch-wrapper", mechanism: "per-process skills.config path exclusions" }
      : host === "claude"
        ? { status: "project-settings-supported", mechanism: "skillOverrides; plugin skills excluded from control" }
        : host === "grok"
          ? { status: "unfiltered-native-catalog", mechanism: "project-aware guidance only; no proven per-project native skill filter" }
          : { status: "unfiltered-native-catalog", mechanism: "project-aware guidance only; global compatibility roots remain" },
  };
}

function nativeSkillOrProfileConfigPresent(raw) {
  // Refuse any skills key/section, including inline tables and quoted TOML keys.
  // A selected default profile can add skills.config later, so preserve it too.
  const uncommented = raw.split("\n").map((line) => {
    let quote = null;
    let escaped = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (quote) {
        if (quote === '"' && char === "\\" && !escaped) { escaped = true; continue; }
        if (char === quote && !escaped) quote = null;
        escaped = false;
      } else if (char === '"' || char === "'") quote = char;
      else if (char === "#") return line.slice(0, i);
    }
    return line;
  }).join("\n");
  return /(?:^|[\[,{.])\s*["']?skills["']?\s*(?:[.=,\]])/m.test(uncommented)
    || /^\s*["']?profile["']?\s*=/m.test(uncommented);
}

function conflictingNativeOverride(value) {
  const key = String(value).split("=", 1)[0].trim().replace(/["']/g, "");
  return /(?:^|\.)skills(?:\.|$)/.test(key) || key === "profile";
}
function ownedSkillFile(file, name) {
  try {
    const source = fs.realpathSync(file);
    const sourceRoot = path.dirname(path.dirname(path.dirname(source)));
    if (source !== path.join(sourceRoot, "skills", name, "SKILL.md")) return false;
    const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, "skills-manifest.json"), "utf8"));
    return manifest.includedSkills?.includes(name) && fs.existsSync(path.join(sourceRoot, "DOCTRINE.md"));
  } catch { return false; }
}

function projectConfigFiles(projectRoot) {
  const out = [];
  let dir = path.resolve(projectRoot);
  while (true) {
    out.push(path.join(dir, ".codex", "config.toml"));
    if (exists(dir, ".git")) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return out;
}
export function codexLaunchArgs({ profile, userArgs = [], codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), projectRoot, ownedSkillsRoot = null }) {
  if (profile.host !== "codex") throw new Error("Codex launch requires a Codex profile");
  if (!Array.isArray(userArgs)) throw new Error("userArgs must be an array");
  const hostFlags = userArgs.slice(0, userArgs.indexOf("--") < 0 ? undefined : userArgs.indexOf("--"));
  for (let i = 0; i < hostFlags.length; i++) {
    const arg = hostFlags[i];
    if (arg === "-p" || /^-p.+/.test(arg) || arg === "--profile" || arg.startsWith("--profile=")) throw new Error("Codex profile may contain skills.config; launch directly or merge it explicitly");
    if (arg === "-c" || arg === "--config") {
      const value = hostFlags[++i] || "";
      if (conflictingNativeOverride(value)) throw new Error("existing CLI skills.config or profile cannot be safely replaced");
    }
    if ((arg.startsWith("--config=") && conflictingNativeOverride(arg.slice(9)))
      || (arg.startsWith("-c") && arg.length > 2 && conflictingNativeOverride(arg.slice(2)))) throw new Error("existing CLI skills.config or profile cannot be safely replaced");
    if (arg === "-C" || arg === "--cd" || arg.startsWith("--cd=")) {
      const directory = arg.startsWith("--cd=") ? arg.slice(5) : hostFlags[++i];
      if (!directory || path.resolve(projectRoot, directory) !== path.resolve(projectRoot)) throw new Error("Codex -C/--cd differs from selected project");
    }
  }
  const configFiles = [path.join(codexHome, "config.toml"), ...projectConfigFiles(projectRoot)];
  for (const file of configFiles) {
    try {
      if (nativeSkillOrProfileConfigPresent(fs.readFileSync(file, "utf8"))) throw new Error(`native skills or default profile config exists in ${file}; refusing to replace user choices`);
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const skillsRoot = ownedSkillsRoot || path.join(codexHome, "skills");
  const manifest = JSON.parse(fs.readFileSync(path.join(profile.framework_root, "skills-manifest.json"), "utf8"));
  const selected = new Set(profile.selected.map((x) => x.name));
  const excluded = manifest.includedSkills.filter((name) => !selected.has(name))
    .map((name) => path.join(skillsRoot, name, "SKILL.md"))
    .filter((file) => ownedSkillFile(file, path.basename(path.dirname(file))));
  const entries = excluded.map((file) => `{path=${JSON.stringify(file)},enabled=false}`);
  const config = `skills.config=[${entries.join(",")}]`;
  return { argv: excluded.length ? ["-c", config, ...userArgs] : [...userArgs], excluded_count: excluded.length };
}

export function runCodex({ argv, binary = "codex", cwd }) {
  const result = spawnSync(binary, argv, { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

export function usageReport(projectRoot) {
  const svc = path.join(projectRoot, ".svc");
  const counts = { graph_files: 0, graph_tasks: 0, completed: 0, skipped: 0, router_decisions: 0, required_mentions: 0, suggested_mentions: 0 };
  const bySkill = new Map();
  const row = (name) => {
    if (!bySkill.has(name)) bySkill.set(name, { skill: name, graph_tasks: 0, completed: 0, skipped: 0, required_mentions: 0, suggested_mentions: 0 });
    return bySkill.get(name);
  };
  try {
    for (const name of fs.readdirSync(svc).filter((x) => /^lane-tasks-.*\.json$/.test(x))) {
      let data;
      try { data = JSON.parse(fs.readFileSync(path.join(svc, name), "utf8")); } catch { continue; }
      if (!Array.isArray(data.tasks)) continue;
      counts.graph_files++;
      for (const task of data.tasks) {
        if (!task || typeof task.skill !== "string") continue;
        counts.graph_tasks++;
        row(task.skill).graph_tasks++;
        const skipped = task.status === "skipped" || (task.status === "completed" && typeof task.skip_reason === "string" && task.skip_reason.trim().length > 0);
        if (skipped) { counts.skipped++; row(task.skill).skipped++; }
        else if (task.status === "completed") { counts.completed++; row(task.skill).completed++; }
      }
    }
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  try {
    const lines = fs.readFileSync(path.join(svc, "skill-router", "decisions.jsonl"), "utf8").split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      let d; try { d = JSON.parse(line); } catch { continue; }
      if (d.schema_version !== 1) continue;
      counts.router_decisions++;
      for (const name of list(d.required)) { counts.required_mentions++; row(name).required_mentions++; }
      for (const suggestion of Array.isArray(d.suggestions) ? d.suggestions : []) {
        const name = typeof suggestion === "string" ? suggestion : suggestion?.skill;
        if (typeof name !== "string") continue;
        counts.suggested_mentions++;
        row(name).suggested_mentions++;
      }
    }
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  const skillRows = [...bySkill.values()].sort((a, b) => a.skill.localeCompare(b.skill));
  const inspectSuggestions = skillRows.filter((x) => x.suggested_mentions > 0 && x.completed === 0)
    .sort((a, b) => b.suggested_mentions - a.suggested_mentions || a.skill.localeCompare(b.skill))
    .slice(0, 8).map((x) => x.skill);
  return { schema_version: 1, counts, by_skill: skillRows, inspect_suggestions: inspectSuggestions,
    limits: ["Counts describe recorded routing and task status only; inspection is not an automatic disable recommendation.", "No token savings, output quality, causal follow-through, or unrecorded host invocation is inferred."] };
}
