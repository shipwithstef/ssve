#!/usr/bin/env node
// skills/ingest-guide/scripts/validate-ingest-report.mjs
// Validate an ingest-guide report for structural completeness and consistency.
//
// USAGE:
//   node skills/ingest-guide/scripts/validate-ingest-report.mjs --report <path>
//
// EXIT: 0 = pass, 1 = fail (details to stderr + JSON to stdout)

import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_SECTIONS = [
  '## Upstream Fetch',
  '## Extracted Claims',
  '## Catalog Cross-Check',
  '## Addon Dedup Check',
  '## Claim Classification',
  '## Benefit Framing',
  '## Project Fit',
  '## Decision Matrix',
  '## Validation Rubric',
  '## Routing Decisions',
  '## Summary',
];

const OPTIONAL_SECTIONS = [
  '## Experiments',
];

function parseArgs(argv) {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--report') return argv[i + 1];
  }
  return null;
}

function fail(details) {
  const out = { verdict: 'fail', details };
  console.error(JSON.stringify(out, null, 2));
  process.exit(1);
}

function pass(details) {
  const out = { verdict: 'pass', details };
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

function extractSection(text, heading) {
  const regex = new RegExp('^' + heading.replace(/#/g, '\\#') + '\\s*$', 'm');
  const match = text.match(regex);
  if (!match) return null;
  const start = match.index + match[0].length;
  // Find next ## heading at line start (not inside code blocks)
  // We scan line by line to avoid false matches inside code blocks
  const lines = text.slice(start).split('\n');
  let endOffset = 0;
  let inCodeBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
    }
    if (!inCodeBlock && line.match(/^##\s/)) {
      break;
    }
    endOffset += line.length + 1; // +1 for the newline
  }
  const end = start + endOffset;
  return text.slice(start, end).trim();
}

function countTableRows(sectionText) {
  if (!sectionText) return 0;
  // Count data rows (lines that start with | and are not header or separator)
  const lines = sectionText.split('\n').filter(l => l.trim().startsWith('|'));
  // Skip first line (header) and any separator lines
  const dataLines = lines.slice(1).filter(l => {
    const trimmed = l.trim();
    const inner = trimmed.replace(/\|/g, '').replace(/\s/g, '');
    return inner.length > 0 && !/^[-:]+$/.test(inner);
  });
  return dataLines.length;
}

function countListItems(sectionText) {
  if (!sectionText) return 0;
  return sectionText.split('\n').filter(l => /^\s*\d+\./.test(l.trim())).length;
}

function hasUpstreamStatus(sectionText) {
  if (!sectionText) return false;
  return /\*\*Fetch status:\*\*\s*(ok|failed|n\/a)/i.test(sectionText);
}

function hasProjectFitColumns(sectionText) {
  if (!sectionText) return false;
  const headerLine = sectionText.split('\n').find(l => l.includes('|') && l.includes('applicable_projects'));
  return !!headerLine && headerLine.includes('project_fit_strength');
}

function main() {
  const reportPath = parseArgs(process.argv.slice(2));
  if (!reportPath) fail([{ check: 'args', reason: 'missing --report <path>' }]);
  if (!fs.existsSync(reportPath)) fail([{ check: 'exists', reason: 'report not found: ' + reportPath }]);

  let text;
  try {
    const stat = fs.statSync(reportPath);
    if (!stat.isFile()) {
      fail([{ check: 'exists', reason: 'path is not a file: ' + reportPath }]);
    }
    text = fs.readFileSync(reportPath, 'utf-8');
  } catch (e) {
    fail([{ check: 'read', reason: 'cannot read report: ' + e.message }]);
  }
  const details = [];
  let ok = true;

  // Check required sections exist
  for (const section of REQUIRED_SECTIONS) {
    const body = extractSection(text, section);
    if (!body) {
      details.push({ check: 'section', section, reason: 'missing' });
      ok = false;
    }
  }

  // Count extracted claims
  const claimsSection = extractSection(text, '## Extracted Claims');
  const claimCount = countListItems(claimsSection);
  details.push({ check: 'claim-count', count: claimCount });

  if (claimCount === 0) {
    details.push({ check: 'claims', reason: 'no extracted claims found' });
    ok = false;
  }

  // Check upstream fetch status
  const upstreamSection = extractSection(text, '## Upstream Fetch');
  if (!hasUpstreamStatus(upstreamSection)) {
    details.push({ check: 'upstream-fetch', reason: 'missing or invalid Fetch status (must be ok|failed|n/a)' });
    ok = false;
  }

  // Check catalog cross-check has rows matching claim count
  const catalogSection = extractSection(text, '## Catalog Cross-Check');
  const catalogRows = countTableRows(catalogSection);
  if (catalogRows !== claimCount) {
    details.push({ check: 'catalog-cross-check', reason: `row count (${catalogRows}) != claim count (${claimCount})`, catalogRows, claimCount });
    ok = false;
  }

  // Check claim classification has rows matching claim count
  const classifySection = extractSection(text, '## Claim Classification');
  const classifyRows = countTableRows(classifySection);
  if (classifyRows !== claimCount) {
    details.push({ check: 'claim-classification', reason: `row count (${classifyRows}) != claim count (${claimCount})`, classifyRows, claimCount });
    ok = false;
  }

  // Check project fit has correct columns
  const projectFitSection = extractSection(text, '## Project Fit');
  if (!hasProjectFitColumns(projectFitSection)) {
    details.push({ check: 'project-fit', reason: 'missing applicable_projects or project_fit_strength columns' });
    ok = false;
  }
  const fitRows = countTableRows(projectFitSection);
  if (fitRows !== claimCount) {
    details.push({ check: 'project-fit-rows', reason: `row count (${fitRows}) != claim count (${claimCount})`, fitRows, claimCount });
    ok = false;
  }

  // Check decision matrix has rows matching claim count
  const matrixSection = extractSection(text, '## Decision Matrix');
  const matrixRows = countTableRows(matrixSection);
  if (matrixRows !== claimCount) {
    details.push({ check: 'decision-matrix', reason: `row count (${matrixRows}) != claim count (${claimCount})`, matrixRows, claimCount });
    ok = false;
  }

  // Check validation rubric has rows matching claim count
  const rubricSection = extractSection(text, '## Validation Rubric');
  const rubricRows = countTableRows(rubricSection);
  if (rubricRows !== claimCount) {
    details.push({ check: 'validation-rubric', reason: `row count (${rubricRows}) != claim count (${claimCount})`, rubricRows, claimCount });
    ok = false;
  }

  // Check routing decisions has rows matching claim count
  const routingSection = extractSection(text, '## Routing Decisions');
  const routingRows = countTableRows(routingSection);
  if (routingRows !== claimCount) {
    details.push({ check: 'routing-decisions', reason: `row count (${routingRows}) != claim count (${claimCount})`, routingRows, claimCount });
    ok = false;
  }

  // Check summary has counts
  const summarySection = extractSection(text, '## Summary');
  if (!summarySection || !summarySection.includes('Claims extracted:')) {
    details.push({ check: 'summary', reason: 'missing "Claims extracted:" line' });
    ok = false;
  }

  if (ok) {
    pass(details);
  } else {
    fail(details);
  }
}

main();
