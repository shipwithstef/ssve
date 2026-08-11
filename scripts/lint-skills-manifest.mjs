#!/usr/bin/env node

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  listSourceSkillNames,
  skillSourceFile,
  skillsSourceRoot,
  validateSkillSource,
} from "./lib/skill-source-layout.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const errors = [];

function readFile(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

function section(text, startMarker, endMarkers) {
  const start = text.indexOf(startMarker);
  if (start === -1) {
    errors.push(`Missing section start: "${startMarker}"`);
    return "";
  }

  let end = text.length;
  for (const marker of endMarkers) {
    const idx = text.indexOf(marker, start + startMarker.length);
    if (idx !== -1 && idx < end) {
      end = idx;
    }
  }
  return text.slice(start, end);
}

function extractByRegex(text, regex) {
  const out = [];
  for (const match of text.matchAll(regex)) {
    out.push(match[1]);
  }
  return out;
}

function compareList(label, actual, expected) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    errors.push(
      `${label} mismatch.\n  expected: ${expectedJson}\n  actual:   ${actualJson}`
    );
  }
}

function assertIncludes(label, text, snippet) {
  if (!text.includes(snippet)) {
    errors.push(`${label} missing expected snippet: ${JSON.stringify(snippet)}`);
  }
}

function assertNotIncludes(label, text, snippet) {
  if (text.includes(snippet)) {
    errors.push(`${label} contains forbidden snippet: ${JSON.stringify(snippet)}`);
  }
}

function assertIncludedSkillPaths(includedSkills) {
  for (const skill of includedSkills) {
    const skillPath = skillSourceFile(repoRoot, skill);
    const validation = validateSkillSource(repoRoot, skill);
    if (!validation.ok) {
      errors.push(`Included skill has invalid packaged source (${validation.reason}): skills/${skill}/SKILL.md`);
    }
  }
}

function assertPackagedSkillDirsIncluded(includedSkills) {
  const expected = [...includedSkills].sort();
  const actual = listSourceSkillNames(repoRoot);
  compareList("packaged source skill directories", actual, expected);

  for (const entry of fs.readdirSync(repoRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "skills" || entry.name === ".worktrees") continue;
    const skillPath = path.join(repoRoot, entry.name, "SKILL.md");
    if (fs.existsSync(skillPath)) {
      errors.push(`Root-level skill directory forbidden; move it under ${path.relative(repoRoot, skillsSourceRoot(repoRoot))}/: ${entry.name}`);
    }
  }
}

function assertManifestArrayRoles(manifest) {
  const roles = manifest.manifestArrayRoles;
  const requiredRoles = [
    "includedSkills",
    "corePackForRouting",
    "bootstrapStartSequence",
    "pipeline",
    "laneDefinitions.*.skills",
  ];
  if (!roles || typeof roles !== "object") {
    errors.push("manifestArrayRoles missing; document manifest array boundaries before editing skill-order arrays");
    return;
  }
  for (const roleName of requiredRoles) {
    const role = roles[roleName];
    if (!role || typeof role.role !== "string" || role.role.length < 20) {
      errors.push(`manifestArrayRoles.${roleName} missing substantive role description`);
    }
    if (!Array.isArray(role?.source_of_truth_for) || role.source_of_truth_for.length === 0) {
      errors.push(`manifestArrayRoles.${roleName} missing source_of_truth_for list`);
    }
  }

  const included = new Set(manifest.includedSkills ?? []);
  const assertSubset = (label, values) => {
    if (!Array.isArray(values)) {
      errors.push(`${label} must be an array`);
      return;
    }
    for (const skill of values) {
      if (!included.has(skill)) {
        errors.push(`${label} contains ${skill}, which is not present in includedSkills`);
      }
    }
  };

  assertSubset("corePackForRouting", manifest.corePackForRouting);
  assertSubset("bootstrapStartSequence", manifest.bootstrapStartSequence);
  assertSubset("pipeline", manifest.pipeline);

  const laneDefinitions = manifest.laneDefinitions ?? {};
  for (const [laneName, lane] of Object.entries(laneDefinitions)) {
    if (Array.isArray(lane.skills)) {
      assertSubset(`laneDefinitions.${laneName}.skills`, lane.skills);
    }
  }
}

const manifest = JSON.parse(readFile("skills-manifest.json"));
const workflowRoutingRules = readFile("skills/route-workflow/references/routing-rules.md");
const externalAddons = readFile("EXTERNAL_ADDONS.md");
const writeJourneys = fs.readFileSync(skillSourceFile(repoRoot, "write-journeys"), "utf8");
const designUi = fs.readFileSync(skillSourceFile(repoRoot, "design-ui"), "utf8");
const executeChangeset = fs.readFileSync(skillSourceFile(repoRoot, "execute-changeset"), "utf8");
const reviewSecurity = fs.readFileSync(skillSourceFile(repoRoot, "review-security"), "utf8");
const reviewCrossModel = fs.readFileSync(skillSourceFile(repoRoot, "review-cross-model"), "utf8");

const externalCoreySection = section(
  externalAddons,
  "Use these only when installed:",
  ["Recommended integration point:"]
);
const externalCorey = extractByRegex(externalCoreySection, /^-\s+`([^`]+)`/gm);

const workflowCoreySection = section(
  workflowRoutingRules,
  "- **coreyhaines-marketing-pack (optional):**",
  ["- **planning add-on (optional):**"]
);
const workflowCorey = extractByRegex(workflowCoreySection, /`([^`]+)`/g);

// WI-364: README included-skills, EXTERNAL_ADDONS core pack, route-workflow core
// pack, REPO_MODES bootstrap sequence, and the model tables are GENERATED into
// marker blocks by scripts/generate-manifest-mirrors.mjs. The linter validates
// freshness via --check instead of re-parsing each mirror (generate-don't-lint).
try {
  execSync(
    `node ${JSON.stringify(path.join(scriptDir, "generate-manifest-mirrors.mjs"))} --check`,
    { stdio: "pipe" }
  );
} catch (err) {
  const out = [err.stdout, err.stderr].filter(Boolean).map(String).join("\n").trim();
  // WI364-G6-001: distinguish real drift (generator ran, exit 1, drift lines) from a
  // spawn/environment failure (EPERM, ENOENT, signal) so restricted sandboxes get an
  // honest error instead of a misleading "stale" verdict. Both fail the lint (fail-closed).
  const ranWithDrift = err.status === 1 && /stale content|markers missing|marker pair/.test(out);
  errors.push(
    ranWithDrift
      ? `generated mirrors stale — run: node scripts/generate-manifest-mirrors.mjs --write\n${out}`
      : `generated-mirror freshness check could not run (${err.code || err.signal || `status ${err.status}`}) — fix the environment or run: node scripts/generate-manifest-mirrors.mjs --check\n${out}`
  );
}

compareList(
  "EXTERNAL_ADDONS coreyhaines pack",
  externalCorey,
  manifest.externalAddOns["coreyhaines-marketing-pack"]
);
compareList(
  "route-workflow coreyhaines pack",
  workflowCorey,
  manifest.externalAddOns["coreyhaines-marketing-pack"]
);

assertIncludedSkillPaths(manifest.includedSkills);
assertPackagedSkillDirsIncluded(manifest.includedSkills);
assertManifestArrayRoles(manifest);

function assertRulesRegistry(registry) {
  if (!registry || !Array.isArray(registry.entries)) {
    errors.push('rulesRegistry missing or malformed (expected { entries: [...] })');
    return;
  }
  const validScopes = new Set(["project", "global"]);
  const validTypes = new Set(["correction", "steering"]);
  const registeredPaths = new Set();
  const pathCounts = new Map();
  for (const entry of registry.entries) {
    if (!entry.path || typeof entry.path !== "string") {
      errors.push(`rulesRegistry entry missing path: ${JSON.stringify(entry)}`);
      continue;
    }
    if (!validScopes.has(entry.scope)) {
      errors.push(`rulesRegistry entry ${entry.path}: scope must be project|global (got ${JSON.stringify(entry.scope)})`);
    }
    if (!validTypes.has(entry.type)) {
      errors.push(`rulesRegistry entry ${entry.path}: type must be correction|steering (got ${JSON.stringify(entry.type)})`);
    }
    if (typeof entry.stack !== "string" || !entry.stack) {
      errors.push(`rulesRegistry entry ${entry.path}: stack required (language or "universal")`);
    }
    if (typeof entry.source !== "string" || !(entry.source === "local" || entry.source.startsWith("blended:"))) {
      errors.push(`rulesRegistry entry ${entry.path}: source must be "local" or "blended:<key>"`);
    }
    // WI-361: auto_inject classification — identity-pinned (G2 PLAN-006)
    const AUTO_INJECT = new Set(["always", "signal", "lazy"]);
    // WI-393: long-output-to-file demoted always→signal (injects on output-heavy
    // skill signals instead of riding every session). Allowlist now 5.
    const ALWAYS_ALLOWLIST = new Set([
      "rules/common/question-fatigue.md",
      "rules/tool-selection.md",
      "rules/verify-state-before-context.md",
      "rules/learning-preload.md",
      "rules/common/research-before-build.md",
    ]);
    if (!AUTO_INJECT.has(entry.auto_inject)) {
      errors.push(`rulesRegistry entry ${entry.path}: missing/invalid auto_inject (always|signal|lazy)`);
    }
    if (entry.auto_inject === "always") {
      if (!ALWAYS_ALLOWLIST.has(entry.path)) errors.push(`rulesRegistry: ${entry.path} marked always but not in ALWAYS_ALLOWLIST — change BOTH deliberately`);
      if (entry.signals) errors.push(`rulesRegistry: ${entry.path} always-mode must not carry signals`);
    }
    if (entry.auto_inject === "lazy") {
      if (entry.signals) errors.push(`rulesRegistry: ${entry.path} lazy-mode must not carry signals`);
      if (!/twin:|consumer:/.test(entry.notes || "")) errors.push(`rulesRegistry: ${entry.path} lazy-mode needs a twin:/consumer: citation in notes`);
    }
    if (entry.auto_inject === "signal") {
      const sig = entry.signals || {};
      const hasSignal = (sig.paths && sig.paths.length) || (sig.bash && sig.bash.length) || (sig.keywords && sig.keywords.length) || /concern-bridge/.test(entry.notes || "");
      if (!hasSignal) errors.push(`rulesRegistry: ${entry.path} signal-mode without signals`);
      for (const rx of [...(sig.paths || []), ...(sig.bash || []), ...(sig.keywords || [])]) {
        try { new RegExp(rx); } catch { errors.push(`rulesRegistry: ${entry.path} invalid signal regex: ${rx}`); }
      }
    }
    pathCounts.set(entry.path, (pathCounts.get(entry.path) ?? 0) + 1);
    // Project-scoped rules must point to a file in the repo.
    if (entry.scope === "project") {
      const abs = path.join(repoRoot, entry.path);
      if (!fs.existsSync(abs)) {
        errors.push(`rulesRegistry entry ${entry.path}: file not found`);
      }
    }
    // ALL registered entries (project + global) count as registered for the
    // disk-vs-registry check. Global-scope rules live in the repo but apply
    // beyond it; they're still registered when present in entries[].
    registeredPaths.add(entry.path);
  }
  // WI-361: every allowlisted always-rule must actually be marked always
  {
    const wantAlways = [
      "rules/common/question-fatigue.md",
      "rules/tool-selection.md",
      "rules/verify-state-before-context.md",
      "rules/learning-preload.md",
      "rules/common/research-before-build.md",
    ];
    const got = new Set(registry.entries.filter((e) => e.auto_inject === "always").map((e) => e.path));
    for (const w of wantAlways) if (!got.has(w)) errors.push(`rulesRegistry: allowlisted always rule ${w} not marked always`);
    if (got.size !== wantAlways.length) errors.push(`rulesRegistry: always-on set must be exactly ${wantAlways.length} (got ${got.size})`);
  }
  for (const [rulePath, count] of pathCounts.entries()) {
    if (count > 1) {
      errors.push(`rulesRegistry duplicate path: ${rulePath} appears ${count} times`);
    }
  }
  // Every file under rules/ must be registered.
  const rulesDir = path.join(repoRoot, "rules");
  if (fs.existsSync(rulesDir)) {
    const walk = (dir) => {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) walk(full);
        else if (name.endsWith(".md")) {
          const rel = path.relative(repoRoot, full);
          if (!registeredPaths.has(rel)) {
            errors.push(`rules/ file not registered in rulesRegistry: ${rel}`);
          }
        }
      }
    };
    walk(rulesDir);
  }
}

assertRulesRegistry(manifest.rulesRegistry);
assertIncludes(
  "write-journeys brownfield handoff",
  writeJourneys,
  "brownfield-feature: { position: 4, prev: write-spec, next: design-ux }"
);
assertIncludes(
  "design-ui visual sidecar handoff",
  designUi,
  "track-visuals --mode baseline"
);
assertIncludes(
  "execute-changeset visual diff handoff",
  executeChangeset,
  "track-visuals --mode diff"
);
assertNotIncludes(
  "review-security automatic progressive claim",
  reviewSecurity,
  "automatically in\n  progressive mode"
);
assertNotIncludes(
  "review-cross-model automatic progressive claim",
  reviewCrossModel,
  "automatically in progressive mode"
);

// WI-137 meta-rule: every top-level shared-content dir referenced from any
// SKILL.md must appear in infra_dirs of every host manifest. Source of truth
// for which dirs are shared content: references/shared-content-dirs.json.
// Source of truth for host install paths to override at test time:
// SVC_HOSTS_DIR env var (defaults to provision/hosts/).
{
  const registryPath = path.join(repoRoot, "references/shared-content-dirs.json");
  if (!fs.existsSync(registryPath)) {
    errors.push("WI137 meta-rule: missing references/shared-content-dirs.json registry");
  } else {
    const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
    const sharedDirs = Array.isArray(registry.shared_dirs) ? registry.shared_dirs : [];
    const exceptionDirs = new Set(Array.isArray(registry.exception_dirs) ? registry.exception_dirs : []);

    const hostsDir = process.env.SVC_HOSTS_DIR
      ? path.resolve(process.env.SVC_HOSTS_DIR)
      : path.join(repoRoot, "provision/hosts");

    const HOSTS = fs
      .readdirSync(hostsDir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.replace(/\.json$/, ""))
      .sort();

    const skillFiles = listSourceSkillNames(repoRoot).map((skill) => skillSourceFile(repoRoot, skill));

    // For each shared dir D in registry, find all references in skill content,
    // then assert D is in every host manifest's infra_dirs (unless D ∈ exceptions).
    for (const dir of sharedDirs) {
      if (exceptionDirs.has(dir)) continue;

      // Concrete extraction regex: negative-lookbehind for [\w/.] then <dir>/<filename>.<ext>
      const escapedDir = dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const refRegex = new RegExp(
        `(?<![\\w/.])${escapedDir}/[A-Za-z0-9_.-]+\\.md`,
        "g"
      );

      const refsByFile = [];
      for (const sf of skillFiles) {
        const content = fs.readFileSync(sf, "utf8");
        const matches = content.match(refRegex);
        if (matches && matches.length > 0) {
          refsByFile.push({ file: path.relative(repoRoot, sf), count: matches.length });
        }
      }

      // Sanity assertion (per F1 review): if registry includes _shared, content must reference it
      if (refsByFile.length === 0) {
        errors.push(
          `WI137 meta-rule extractor self-test failed: registry includes "${dir}" but no SKILL.md content matches the extraction regex. Either the regex regressed or the registry is stale.`
        );
        continue;
      }

      // For each host, assert dir is in infra_dirs
      const missingHosts = [];
      for (const host of HOSTS) {
        const hostManifestPath = path.join(hostsDir, `${host}.json`);
        if (!fs.existsSync(hostManifestPath)) {
          errors.push(`WI137 meta-rule: missing host manifest ${hostManifestPath}`);
          continue;
        }
        const hostManifest = JSON.parse(fs.readFileSync(hostManifestPath, "utf8"));
        const infraDirs = Array.isArray(hostManifest.infra_dirs) ? hostManifest.infra_dirs : [];
        if (!infraDirs.includes(dir)) {
          missingHosts.push(host);
        }
      }

      if (missingHosts.length > 0) {
        const firstRef = refsByFile[0];
        errors.push(
          `WI137 META-CHECK FAIL: top-level dir "${dir}" is referenced from ${refsByFile.length} SKILL.md file(s) ` +
            `but missing from infra_dirs of host manifest(s): [${missingHosts.join(", ")}]. ` +
            `First reference: ${firstRef.file} (${firstRef.count} occurrence(s)). ` +
            `Fix: add "${dir}" to provision/hosts/{${missingHosts.join(",")}}.json infra_dirs.`
        );
      }
    }
  }
}

if (errors.length > 0) {
  console.error("skills-manifest lint failed:");
  for (const err of errors) {
    console.error(`- ${err}`);
  }
  process.exit(1);
}

console.log("skills-manifest lint passed");
console.log(`- included skills: ${manifest.includedSkills.length}`);
console.log(`- routing core skills: ${manifest.corePackForRouting.length}`);
console.log(
  `- coreyhaines add-on skills: ${manifest.externalAddOns["coreyhaines-marketing-pack"].length}`
);
