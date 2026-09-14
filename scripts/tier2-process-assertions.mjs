#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error("Usage: node scripts/tier2-process-assertions.mjs <scenario.md> <workspace> <output.txt>");
}

function extractProcessChecks(markdown) {
  const match = markdown.match(/^### Process Checks\s*\n```json\s*\n([\s\S]*?)\n```/m);
  if (!match) return [];
  return JSON.parse(match[1]);
}

function walk(root) {
  const out = [];
  if (!fs.existsSync(root)) return out;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function globToRegex(glob) {
  const escaped = glob
    .split("*")
    .map((part) => part.replace(/[|\\{}()[\]^$+?.]/g, "\\$&"))
    .join("[^/]*");
  return new RegExp(`^${escaped}$`);
}

function matchGlob(workspace, glob) {
  const re = globToRegex(glob);
  return walk(workspace)
    .map((file) => path.relative(workspace, file).replaceAll(path.sep, "/"))
    .filter((rel) => re.test(rel))
    .map((rel) => path.join(workspace, rel));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function hasPhaseReceipt(workspace, skill, phase) {
  const graphFiles = matchGlob(workspace, ".svc/lane-tasks-*.json");
  for (const file of graphFiles) {
    const graph = readJson(file);
    for (const task of graph.tasks || []) {
      const receipt = task.skill_receipt || {};
      if (receipt.skill !== skill) continue;
      if ((receipt.phases_executed || []).some((p) => p.id === phase)) return true;
    }
  }
  return false;
}

function check(assertion, workspace, outputText) {
  switch (assertion.type) {
    case "artifact_exists": {
      return matchGlob(workspace, assertion.glob).length > 0;
    }
    case "artifact_regex": {
      const files = matchGlob(workspace, assertion.glob);
      const re = new RegExp(assertion.regex, assertion.flags || "i");
      return files.some((file) => re.test(fs.readFileSync(file, "utf8")));
    }
    case "artifact_not_regex": {
      const files = matchGlob(workspace, assertion.glob);
      const re = new RegExp(assertion.regex, assertion.flags || "i");
      return files.every((file) => !re.test(fs.readFileSync(file, "utf8")));
    }
    case "output_regex": {
      return new RegExp(assertion.regex, assertion.flags || "i").test(outputText);
    }
    case "phase_receipt": {
      return hasPhaseReceipt(workspace, assertion.skill, assertion.phase);
    }
    default:
      throw new Error(`unknown process assertion type: ${assertion.type}`);
  }
}

function main() {
  const [scenarioFile, workspace, outputFile] = process.argv.slice(2);
  if (!scenarioFile || !workspace || !outputFile) {
    usage();
    process.exit(2);
  }

  const scenario = fs.readFileSync(scenarioFile, "utf8");
  const assertions = extractProcessChecks(scenario);
  if (assertions.length === 0) {
    console.log("PROCESS_ASSERTIONS none");
    return;
  }

  const outputText = fs.existsSync(outputFile) ? fs.readFileSync(outputFile, "utf8") : "";
  let pass = 0;
  let fail = 0;
  for (const assertion of assertions) {
    const ok = check(assertion, workspace, outputText);
    const label = assertion.label || `${assertion.type}:${assertion.glob || assertion.phase || assertion.regex}`;
    if (ok) {
      pass++;
      console.log(`  [PASS] process: ${label}`);
    } else {
      fail++;
      console.log(`  [FAIL] process: ${label}`);
    }
  }

  console.log(`PROCESS_ASSERTIONS ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main();
