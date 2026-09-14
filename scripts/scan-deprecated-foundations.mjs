#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  collectScanFiles,
  defaultRegistryPath,
  formatFindings,
  loadRegistry,
  scanFiles
} from "./lib/deprecated-foundations.mjs";
import { appendJsonlLine } from "./state-io.mjs";

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    paths: [],
    registry: null,
    json: false,
    failOnFindings: false,
    firstHitCodebaseScan: false,
    promoteFindings: null,
    source: "scan-deprecated-foundations"
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") args.root = path.resolve(argv[++i]);
    else if (arg === "--registry") args.registry = path.resolve(argv[++i]);
    else if (arg === "--path") args.paths.push(path.resolve(args.root, argv[++i]));
    else if (arg === "--json") args.json = true;
    else if (arg === "--fail-on-findings") args.failOnFindings = true;
    else if (arg === "--first-hit-codebase-scan") args.firstHitCodebaseScan = true;
    else if (arg === "--promote-findings") args.promoteFindings = path.resolve(args.root, argv[++i]);
    else if (arg === "--source") args.source = argv[++i];
    else if (arg === "-h" || arg === "--help") args.help = true;
    else args.paths.push(path.resolve(args.root, arg));
  }

  return args;
}

function usage() {
  return [
    "Usage: node scripts/scan-deprecated-foundations.mjs [--root <dir>] [--registry <file>] [--path <file-or-dir> ...] [--json] [--fail-on-findings]",
    "       [--first-hit-codebase-scan --promote-findings <jsonl>] [--source <label>]",
    "",
    "Scans code files for APIs and framework patterns listed in references/deprecated-foundations.json."
  ].join("\n");
}

function readJsonl(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        throw new Error(`Invalid JSONL at ${filePath}:${index + 1}: ${err.message}`);
      }
    });
}

function uniqueFoundationIds(findings) {
  return [...new Set(findings.map((finding) => finding.id))].sort();
}

function priorFoundationIds(ledgerPath) {
  return new Set(readJsonl(ledgerPath).map((entry) => entry.foundation_id).filter(Boolean));
}

function rel(root, filePath) {
  return path.isAbsolute(filePath) ? path.relative(root, filePath) : filePath;
}

function appendPromotionRows({ ledgerPath, findings, root, registryPath, source, scanScope, firstHit, triggerIds }) {
  const rows = [];
  const ts = new Date().toISOString();
  for (const finding of findings) {
    const row = {
      schema: 1,
      ts,
      source,
      state: "confirmed",
      project_root: path.resolve(root),
      registry: rel(root, registryPath),
      foundation_id: finding.id,
      title: finding.title,
      scan_scope: scanScope,
      first_hit: Boolean(firstHit && triggerIds.has(finding.id)),
      file: finding.file,
      line: finding.line,
      match: finding.match,
      successor: finding.successor,
      decision_required: finding.decision_required,
      promotion_targets: [
        rel(root, ledgerPath),
        "docs/learnings/deprecated-foundations.md when the finding is recurring or cross-project"
      ]
    };
    appendJsonlLine(ledgerPath, row);
    rows.push(row);
  }
  return rows;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(usage());
  process.exit(0);
}

const registryPath = args.registry || defaultRegistryPath(args.root);
const registry = loadRegistry(registryPath);
const files = collectScanFiles(args.paths, args.root);
const findings = scanFiles({ files, root: args.root, registry });
let promoted = [];
let firstHitScan = { triggered: false, foundation_ids: [], files_scanned: 0, findings: [] };

if (args.promoteFindings && findings.length > 0) {
  const priorIds = priorFoundationIds(args.promoteFindings);
  const hitIds = uniqueFoundationIds(findings);
  const firstIds = hitIds.filter((id) => !priorIds.has(id));
  const triggerIds = new Set(firstIds);

  if (args.firstHitCodebaseScan && firstIds.length > 0) {
    const allFiles = collectScanFiles([], args.root);
    const allFindings = scanFiles({ files: allFiles, root: args.root, registry })
      .filter((finding) => triggerIds.has(finding.id));
    firstHitScan = {
      triggered: true,
      foundation_ids: firstIds,
      files_scanned: allFiles.length,
      findings: allFindings
    };
    promoted = appendPromotionRows({
      ledgerPath: args.promoteFindings,
      findings: allFindings,
      root: args.root,
      registryPath,
      source: args.source,
      scanScope: "whole-codebase",
      firstHit: true,
      triggerIds
    });
  } else {
    promoted = appendPromotionRows({
      ledgerPath: args.promoteFindings,
      findings,
      root: args.root,
      registryPath,
      source: args.source,
      scanScope: "targeted",
      firstHit: false,
      triggerIds
    });
  }
}

if (args.json) {
  console.log(JSON.stringify({
    schema: 1,
    registry: registryPath,
    files_scanned: files.length,
    findings,
    first_hit_scan: firstHitScan,
    promoted_count: promoted.length,
    promotion_ledger: args.promoteFindings || null
  }, null, 2));
} else {
  console.log(formatFindings(findings));
  if (firstHitScan.triggered) {
    console.log("");
    console.log(
      `First-hit whole-codebase scan triggered for ${firstHitScan.foundation_ids.join(", ")}: ` +
        `${firstHitScan.findings.length} finding(s) across ${firstHitScan.files_scanned} file(s).`
    );
    console.log(`Promotion ledger: ${args.promoteFindings}`);
  }
}

if (args.failOnFindings && findings.length > 0) {
  process.exit(2);
}
