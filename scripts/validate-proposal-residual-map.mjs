#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { WI_ID_BODY } from "../hooks/lib/wi-id.mjs";

const args = process.argv.slice(2);
let mapPath = null;
let root = process.cwd();

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--map") {
    mapPath = args[++i];
  } else if (arg === "--root") {
    root = args[++i];
  } else if (arg === "--help" || arg === "-h") {
    console.log("usage: validate-proposal-residual-map.mjs [--map <path>] [--root <repo>]");
    process.exit(0);
  } else {
    console.error(`unknown argument: ${arg}`);
    process.exit(2);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function proposalPathForTriageName(fileName) {
  const donePath = `proposals/done/${fileName}`;
  if (exists(donePath)) return donePath;
  return `proposals/${fileName}`;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function collectWis() {
  const dir = path.join(root, "docs/specs/work-items");
  const out = new Set();
  for (const file of fs.readdirSync(dir)) {
    const match = file.match(new RegExp("^(" + WI_ID_BODY + ")\\.md$"));
    if (match) out.add(match[1]);
  }
  return out;
}

const errors = [];
const validClassifications = new Set(["covered", "invalid", "child-wi"]);
const validCoverageStatuses = new Set(["covered", "partial", "child-wi", "invalid", "superseded"]);
const wis = collectWis();
const mappedProposals = new Set();
let mappedFindings = 0;

function addError(message) {
  errors.push(message);
}

function normalizeProposalList(map) {
  const out = [];
  if (isNonEmptyString(map.source_proposal)) out.push(map.source_proposal);
  if (Array.isArray(map.source_proposals)) {
    for (const proposal of map.source_proposals) {
      if (isNonEmptyString(proposal)) out.push(proposal);
    }
  }
  if (Array.isArray(map.sources)) {
    for (const source of map.sources) {
      if (isNonEmptyString(source)) out.push(source);
      if (isNonEmptyString(source?.proposal)) out.push(source.proposal);
    }
  }
  if (Array.isArray(map.findings)) {
    for (const finding of map.findings) {
      if (isNonEmptyString(finding?.source)) out.push(finding.source);
    }
  }
  if (Array.isArray(map.coverage)) {
    for (const item of map.coverage) {
      if (isNonEmptyString(item?.source_proposal)) out.push(item.source_proposal);
    }
  }
  return [...new Set(out)];
}

function validateFlatFindingsMap(map, relMapPath) {
  const seenProposals = new Set(normalizeProposalList(map));
  const seenKeys = new Set();

  for (const proposal of seenProposals) {
    if (!exists(proposal)) addError(`${relMapPath}: ${proposal}: proposal file missing`);
  }
  if (!Array.isArray(map.findings) || map.findings.length === 0) {
    addError(`${relMapPath}: findings must be a non-empty array`);
    return { proposals: seenProposals, findings: seenKeys };
  }

  for (const [index, finding] of map.findings.entries()) {
    const key = `${finding.source ?? relMapPath}#${finding.id ?? index}`;
    if (!isNonEmptyString(finding.source)) addError(`${relMapPath}: findings[${index}] missing source`);
    if (isNonEmptyString(finding.source)) {
      seenProposals.add(finding.source);
      if (!exists(finding.source)) addError(`${relMapPath}: ${finding.source}: proposal file missing`);
    }
    if (!isNonEmptyString(finding.id)) addError(`${relMapPath}: findings[${index}] missing id`);
    if (seenKeys.has(key)) addError(`${relMapPath}: ${key}: duplicate finding id`);
    seenKeys.add(key);
    if (!validCoverageStatuses.has(finding.status)) addError(`${relMapPath}: findings[${index}] invalid status ${finding.status}`);
    if ((finding.status === "child-wi" || finding.status === "partial") && !isNonEmptyString(finding.owner_wi)) {
      addError(`${relMapPath}: findings[${index}] ${finding.status} requires owner_wi`);
    }
    if (isNonEmptyString(finding.owner_wi) && !wis.has(finding.owner_wi)) {
      addError(`${relMapPath}: findings[${index}] owner_wi ${finding.owner_wi} does not exist`);
    }
    if (!Array.isArray(finding.evidence) || finding.evidence.length === 0 || finding.evidence.some((entry) => !isNonEmptyString(entry))) {
      addError(`${relMapPath}: findings[${index}] evidence must be a non-empty string array`);
    }
  }

  return { proposals: seenProposals, findings: seenKeys };
}

function validateLegacySourcesMap(map, relMapPath, options = {}) {
  if (Array.isArray(map.findings)) {
    return validateFlatFindingsMap(map, relMapPath);
  }

  if (!Array.isArray(map.sources) || map.sources.length === 0) {
    addError(`${relMapPath}: sources must be a non-empty array`);
    return { proposals: new Set(), findings: new Set() };
  }

  const seenProposals = new Set();
  const seenKeys = new Set();

  for (const source of map.sources ?? []) {
    if (!isNonEmptyString(source.proposal)) {
      addError(`${relMapPath}: source missing proposal`);
      continue;
    }
    if (seenProposals.has(source.proposal)) {
      addError(`${relMapPath}: ${source.proposal}: duplicate source entry`);
    }
    seenProposals.add(source.proposal);

    if (!exists(source.proposal)) {
      addError(`${relMapPath}: ${source.proposal}: proposal file missing`);
    }
    if (!Array.isArray(source.findings) || source.findings.length === 0) {
      addError(`${relMapPath}: ${source.proposal}: findings must be a non-empty array`);
      continue;
    }

    for (const finding of source.findings) {
      const key = `${source.proposal}#${finding.id ?? ""}`;
      if (!isNonEmptyString(finding.id)) addError(`${relMapPath}: ${source.proposal}: finding missing id`);
      if (seenKeys.has(key)) addError(`${relMapPath}: ${key}: duplicate finding id`);
      seenKeys.add(key);

      if (!validClassifications.has(finding.classification)) {
        addError(`${relMapPath}: ${key}: invalid classification ${finding.classification}`);
      }

      if ((finding.classification === "covered" || finding.classification === "child-wi") && !isNonEmptyString(finding.owner_wi)) {
        addError(`${relMapPath}: ${key}: ${finding.classification} requires owner_wi`);
      }
      if (isNonEmptyString(finding.owner_wi) && !wis.has(finding.owner_wi)) {
        addError(`${relMapPath}: ${key}: owner_wi ${finding.owner_wi} does not exist`);
      }

      if (finding.classification === "invalid" && !isNonEmptyString(finding.reason)) {
        addError(`${relMapPath}: ${key}: invalid finding requires reason`);
      }
      if (!isNonEmptyString(finding.evidence)) {
        addError(`${relMapPath}: ${key}: evidence is required`);
      }
    }
  }

  if (options.requiredFixture) {
    const requiredProposals = [
      "proposals/done/2026-04-19-evolution.md",
      "proposals/done/2026-04-20-session-audit-capture-idea-wrong-repo.md",
      "proposals/done/2026-04-21-evolution.md",
      "proposals/done/2026-04-24-framework-cohesion-evolution.md",
      "proposals/done/2026-04-25-comprehensive-session-audit.md",
      "proposals/done/2026-05-04-session-audit-opencode-go-research.md",
      "proposals/done/2026-05-06-session-audit-catalog-skill.md",
      "proposals/done/2026-05-06-session-audit-fix-phase.md",
    ];

    for (const proposal of requiredProposals) {
      if (!seenProposals.has(proposal)) addError(`${relMapPath}: ${proposal}: missing from WI-311 residual map`);
    }

    if (!seenKeys.has("proposals/done/2026-04-20-session-audit-capture-idea-wrong-repo.md#F1")) {
      addError(`${relMapPath}: historical fixture proposal F1 is missing from WI-311 residual map`);
    }
  }

  return { proposals: seenProposals, findings: seenKeys };
}

function validateCoverageMap(map, relMapPath) {
  if (!Array.isArray(map.coverage) || map.coverage.length === 0) {
    addError(`${relMapPath}: coverage must be a non-empty array`);
    return { proposals: new Set(), findings: new Set() };
  }

  const seenProposals = new Set(normalizeProposalList(map));
  const seenKeys = new Set();

  for (const proposal of seenProposals) {
    if (!exists(proposal)) addError(`${relMapPath}: ${proposal}: proposal file missing`);
  }

  for (const [index, item] of map.coverage.entries()) {
    const key = `${item.source_proposal ?? relMapPath}#${index}:${item.proposal_item ?? ""}`;
    if (!isNonEmptyString(item.proposal_item)) addError(`${relMapPath}: coverage[${index}] missing proposal_item`);
    if (!validCoverageStatuses.has(item.status)) addError(`${relMapPath}: coverage[${index}] invalid status ${item.status}`);
    if (seenKeys.has(key)) addError(`${relMapPath}: ${key}: duplicate coverage item`);
    seenKeys.add(key);

    if (isNonEmptyString(item.source_proposal)) {
      seenProposals.add(item.source_proposal);
      if (!exists(item.source_proposal)) addError(`${relMapPath}: ${item.source_proposal}: proposal file missing`);
    }
    if (!Array.isArray(item.evidence) || item.evidence.length === 0 || item.evidence.some((entry) => !isNonEmptyString(entry))) {
      addError(`${relMapPath}: coverage[${index}] evidence must be a non-empty string array`);
    }
    if ((item.status === "child-wi" || item.status === "partial") && !isNonEmptyString(item.owner_wi)) {
      addError(`${relMapPath}: coverage[${index}] ${item.status} requires owner_wi`);
    }
    if (isNonEmptyString(item.owner_wi) && !wis.has(item.owner_wi)) {
      addError(`${relMapPath}: coverage[${index}] owner_wi ${item.owner_wi} does not exist`);
    }
    if (item.status === "invalid" && !isNonEmptyString(item.note) && !isNonEmptyString(item.reason)) {
      addError(`${relMapPath}: coverage[${index}] invalid status requires note or reason`);
    }
  }

  if (Array.isArray(map.residuals)) {
    for (const [index, residual] of map.residuals.entries()) {
      if (!isNonEmptyString(residual.wi)) addError(`${relMapPath}: residuals[${index}] missing wi`);
      if (isNonEmptyString(residual.wi) && !wis.has(residual.wi)) {
        addError(`${relMapPath}: residuals[${index}] wi ${residual.wi} does not exist`);
      }
      if (!isNonEmptyString(residual.title)) addError(`${relMapPath}: residuals[${index}] missing title`);
    }
  }

  return { proposals: seenProposals, findings: seenKeys };
}

function validateMap(relMapPath, options = {}) {
  if (!exists(relMapPath)) {
    addError(`${relMapPath}: residual map file missing`);
    return { proposals: new Set(), findings: new Set(), map: null };
  }

  const fullMapPath = path.isAbsolute(relMapPath) ? relMapPath : path.join(root, relMapPath);
  const map = readJson(fullMapPath);
  if (map.schema !== 1) addError(`${relMapPath}: schema must be 1`);
  if (!isNonEmptyString(map.wi) || !wis.has(map.wi)) addError(`${relMapPath}: wi must reference an existing WI`);

  let result;
  if (Array.isArray(map.sources)) {
    result = validateLegacySourcesMap(map, relMapPath, options);
  } else if (Array.isArray(map.coverage)) {
    result = validateCoverageMap(map, relMapPath);
  } else {
    addError(`${relMapPath}: expected sources or coverage array`);
    result = { proposals: new Set(), findings: new Set() };
  }

  return { ...result, map };
}

function validateTriageResidualMaps() {
  const triagePath = "proposals/triage.json";
  if (!exists(triagePath)) {
    addError("proposals/triage.json missing");
    return [];
  }

  const triage = readJson(path.join(root, triagePath));
  const mapPaths = new Set();
  const results = new Map();

  for (const [proposal, entry] of Object.entries(triage.entries ?? {})) {
    if (!isNonEmptyString(entry.residual_map)) continue;
    mapPaths.add(entry.residual_map);
    if (!exists(entry.residual_map)) {
      addError(`${proposal}: residual_map ${entry.residual_map} does not exist`);
    }
  }

  for (const relMapPath of [...mapPaths].sort()) {
    const result = validateMap(relMapPath, { requiredFixture: relMapPath === "docs/specs/work-items/WI-311-residual-map.json" });
    results.set(relMapPath, result);
    for (const proposal of result.proposals) mappedProposals.add(proposal);
    mappedFindings += result.findings.size;
  }

  for (const [proposal, entry] of Object.entries(triage.entries ?? {})) {
    if (!isNonEmptyString(entry.residual_map)) continue;
    const result = results.get(entry.residual_map);
    if (!result?.map) continue;
    if (result.map.wi !== entry.accepted_wi) {
      addError(`${proposal}: residual_map wi ${result.map.wi} does not match accepted_wi ${entry.accepted_wi}`);
    }
    const expectedProposalPath = proposalPathForTriageName(proposal);
    if (!result.proposals.has(expectedProposalPath)) {
      addError(`${proposal}: residual_map does not include ${expectedProposalPath} as a source`);
    }
  }

  return [...mapPaths];
}

if (mapPath) {
  const result = validateMap(mapPath, { requiredFixture: mapPath === "docs/specs/work-items/WI-311-residual-map.json" });
  for (const proposal of result.proposals) mappedProposals.add(proposal);
  mappedFindings += result.findings.size;
} else {
  validateTriageResidualMaps();
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

console.log(`proposal residual map: ${mappedProposals.size} proposal(s), ${mappedFindings} finding(s) mapped`);
