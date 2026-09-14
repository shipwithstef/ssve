#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverControls, existingCoverage } from "../skills/write-journeys/scripts/auto-discover-chrome.mjs";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function parseArgs(argv) {
  const flags = { root: process.cwd(), now: Date.now() };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--root") flags.root = argv[++i];
    else if (token === "--now") flags.now = Date.parse(argv[++i]);
    else throw new Error(`Unknown argument: ${token}`);
  }
  if (!Number.isFinite(flags.now)) throw new Error("--now must be parseable as a date");
  return flags;
}

function readText(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function disabledByRegistry(root) {
  const registry = path.join(root, ".svc/capability-registry.json");
  if (!fs.existsSync(registry)) return false;
  try {
    const data = JSON.parse(fs.readFileSync(registry, "utf8"));
    return data["chrome-coverage-disabled"] === true || data.chrome_coverage_disabled === true;
  } catch {
    return false;
  }
}

function hasWaiver(root) {
  const svc = path.join(root, ".svc");
  if (!fs.existsSync(svc)) return false;
  for (const entry of fs.readdirSync(svc)) {
    if (!/^lane-tasks-.*\.json$/.test(entry)) continue;
    const text = readText(path.join(svc, entry));
    if (/concern-waived:\s*chrome-coverage\s*[-—:]/i.test(text)) return true;
  }
  return false;
}

function isBootstrap(root) {
  const projectState = readText(path.join(root, "docs/specs/project-state.md"));
  const repoModes = readText(path.join(root, "REPO_MODES.md"));
  return /repo[_ -]?mode:\s*bootstrap/i.test(projectState) || /active[_ -]?mode:\s*bootstrap/i.test(repoModes);
}

function installedAt(root, now) {
  const marker = path.join(root, ".svc/chrome-coverage-installed-at");
  if (!fs.existsSync(marker)) return now;
  const raw = fs.readFileSync(marker, "utf8").trim();
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return asNumber > 9999999999 ? asNumber : asNumber * 1000;
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : now;
}

export function validateChromeJourneyCoverage(options) {
  const root = path.resolve(options.root || process.cwd());
  if (isBootstrap(root)) {
    return { status: "skip", severity: "SKIP", issues: [], reason: "bootstrap_mode" };
  }
  if (disabledByRegistry(root)) {
    return { status: "skip", severity: "SKIP", issues: [], reason: "chrome_coverage_disabled" };
  }

  const controls = discoverControls(root);
  if (controls.length === 0) {
    return { status: "skip", severity: "SKIP", issues: [], reason: "no_chrome_controls" };
  }

  const covered = existingCoverage(root, path.join(root, "docs/specs/journeys"));
  const issues = controls.filter((control) => !covered.has(control.id));
  if (issues.length === 0 || hasWaiver(root)) {
    return { status: "pass", severity: "PASS", issues: [] };
  }

  const ageMs = options.now - installedAt(root, options.now);
  const severity = ageMs > THIRTY_DAYS_MS ? "HIGH" : "WARN";
  return { status: severity === "HIGH" ? "fail" : "warn", severity, issues };
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  const result = validateChromeJourneyCoverage(flags);
  for (const issue of result.issues) {
    console.log(
      `[chrome-coverage ${result.severity}] ${issue.source || `${issue.rel}:${issue.line}`} exposes ${issue.label} with no journey coverage. Run: write-journeys --auto-discover-chrome`
    );
  }
  if (result.issues.length === 0) {
    console.log(`[chrome-coverage ${result.severity}] ${result.reason || "covered"}`);
  }
  process.exit(result.status === "fail" ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
