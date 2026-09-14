#!/usr/bin/env node
// skills/research/scripts/deep-extraction-check.mjs
//
// Validates a deep-extraction file (one block per URL) for completeness.
// Each `## URL: <url>` block must have:
//   - **Status:** read | error <code> | redirect ...
//   - **Body text (verbatim):** with at least one non-empty quote line
//
// USAGE:
//   node skills/research/scripts/deep-extraction-check.mjs <extraction.md>
//
// Exit 0 = pass; non-zero = block(s) with missing body or error status.

import { readFile } from 'node:fs/promises';

const file = process.argv[2];
if (!file) { console.error('usage: deep-extraction-check.mjs <extraction.md>'); process.exit(2); }

const text = await readFile(file, 'utf8');
// Split on URL or External headings
const blocks = text.split(/^## (URL|External):/m).slice(1);
// blocks alternate: type, body, type, body, ...
const parsed = [];
for (let i = 0; i < blocks.length; i += 2) {
  const type = blocks[i];
  const rest = blocks[i + 1] || '';
  const headerLine = rest.split('\n')[0].trim();
  parsed.push({ type, target: headerLine, body: rest });
}

let pass = 0, fail = 0;
const failures = [];
for (const b of parsed) {
  const hasStatus = /\*\*Status:\*\*/m.test(b.body);
  const hasBody = /\*\*Body text[^*]*\*\*/m.test(b.body) || /\*\*Returned data[^*]*\*\*/m.test(b.body);
  // Body must contain at least one quote line `> "..."`
  const bodyQuotes = b.body.match(/^>\s+["«].+["»]/gm) || [];
  const isError = /\*\*Status:\*\*\s*(error|inaccessible)|\*\*Verdict:\*\*\s*(inaccessible|differs)|Redirects/i.test(b.body);
  const acceptable = hasStatus && (hasBody || isError) && (bodyQuotes.length > 0 || isError);
  if (acceptable) pass++;
  else { fail++; failures.push({ type: b.type, target: b.target, hasStatus, hasBody, bodyQuotes: bodyQuotes.length }); }
}

const result = { verdict: fail === 0 ? 'pass' : 'fail', total_blocks: parsed.length, pass, fail, failures };
console.log(JSON.stringify(result, null, 2));
process.exit(fail === 0 ? 0 : 1);
