#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { isValidWiId } from "../hooks/lib/wi-id.mjs";

const args = process.argv.slice(2);
let root = process.cwd();

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--root") {
    root = args[++i];
  } else if (arg === "--help" || arg === "-h") {
    console.log("usage: validate-proposal-promotion-closeout.mjs [--root <repo>]");
    process.exit(0);
  } else {
    console.error(`unknown argument: ${arg}`);
    process.exit(2);
  }
}

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, relPath), "utf8"));
}

function readText(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function listDatedMarkdown(relDir) {
  const dir = path.join(root, relDir);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((fileName) => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(fileName))
    .sort();
}

function collectProposalPaths(value, out = new Set()) {
  if (typeof value === "string") {
    if (/^proposals\/(?:done\/)?\d{4}-\d{2}-\d{2}-.+\.md$/.test(value)) out.add(value);
    return out;
  }
  if (!value || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    for (const item of value) collectProposalPaths(item, out);
    return out;
  }
  for (const item of Object.values(value)) collectProposalPaths(item, out);
  return out;
}

const errors = [];
const triagePath = "proposals/triage.json";

if (!exists(triagePath)) {
  errors.push("proposals/triage.json missing");
} else {
  const triage = readJson(triagePath);
  const entries = triage.entries ?? {};
  const openProposals = new Set(listDatedMarkdown("proposals"));
  const archivedProposals = new Set(listDatedMarkdown("proposals/done"));

  for (const openProposal of openProposals) {
    const entry = entries[openProposal];
    if (entry?.accepted_wi) {
      errors.push(`${openProposal}: accepted proposal must be archived under proposals/done/`);
    }
  }

  for (const [proposal, entry] of Object.entries(entries)) {
    const openPath = `proposals/${proposal}`;
    const donePath = `proposals/done/${proposal}`;
    const hasOpen = openProposals.has(proposal);
    const hasDone = archivedProposals.has(proposal);

    if (hasOpen && hasDone) {
      errors.push(`${proposal}: exists in both proposals/ and proposals/done/`);
    }
    if (!hasOpen && !hasDone) {
      errors.push(`${proposal}: triage entry has no matching proposal source file`);
    }

    if (Object.hasOwn(entry, "backlog_wi")) {
      if (entry.accepted_wi || entry.rejected_reason || entry.deferred_until) errors.push(`${proposal}: backlog_wi conflicts with another disposition`);
      if (!hasOpen) errors.push(`${proposal}: backlog_wi requires an open proposal source`);
      if (!isValidWiId(entry.backlog_wi) || !exists(`docs/specs/work-items/${entry.backlog_wi}.md`)) errors.push(`${proposal}: backlog_wi must name an existing canonical WI`);
      else {
        const status=readText(`docs/specs/work-items/${entry.backlog_wi}.md`).match(/^\*\*Status:\*\*\s*(.+)$/mi)?.[1] || "";
        if (!/^(backlog|pending|blocked|identified|in_progress|in-progress|in progress|planned|draft)\b/i.test(status)) errors.push(`${proposal}: backlog_wi must have an explicit unfinished status`);
      }
      if (!isNonEmptyString(entry.reason)) errors.push(`${proposal}: backlog_wi requires a reason`);
    }

    if (!isNonEmptyString(entry.accepted_wi)) continue;

    const wiPath = `docs/specs/work-items/${entry.accepted_wi}.md`;
    if (!exists(wiPath)) {
      errors.push(`${proposal}: accepted_wi ${entry.accepted_wi} does not exist`);
    }
    if (!hasDone) {
      errors.push(`${proposal}: accepted_wi ${entry.accepted_wi} requires archived source at ${donePath}`);
    }
    if (!isNonEmptyString(entry.residual_map)) {
      errors.push(`${proposal}: accepted_wi ${entry.accepted_wi} requires residual_map`);
      continue;
    }
    if (!exists(entry.residual_map)) {
      errors.push(`${proposal}: residual_map ${entry.residual_map} does not exist`);
      continue;
    }

    const residualMap = readJson(entry.residual_map);
    const proposalPaths = collectProposalPaths(residualMap);
    if (proposalPaths.has(openPath)) {
      errors.push(`${proposal}: residual_map still references open source ${openPath}`);
    }
    if (!proposalPaths.has(donePath)) {
      errors.push(`${proposal}: residual_map must reference archived source ${donePath}`);
    }
  }

  const ledgerPath = "docs/specs/work-items/PROPOSAL-PROMOTION-LEDGER.md";
  if (!exists(ledgerPath)) {
    errors.push(`${ledgerPath} missing`);
  } else {
    const ledger = readText(ledgerPath);
    for (const [proposal, entry] of Object.entries(entries)) {
      if (!isNonEmptyString(entry.accepted_wi)) continue;
      if (!ledger.includes(`\`${proposal}\``) || !ledger.includes(entry.accepted_wi)) {
        errors.push(`${proposal}: promotion ledger must list ${entry.accepted_wi}`);
      }
    }
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

console.log("proposal promotion closeout: PASS");
