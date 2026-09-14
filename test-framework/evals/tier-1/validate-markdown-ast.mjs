#!/usr/bin/env node
/**
 * Tier 1: AST-based Markdown structure validation.
 *
 * Parses Markdown into a heading tree and validates:
 * - Required sections exist (Self-Verify, Pipeline Continuation, etc.)
 * - Section nesting is correct (no H4 under H1 with no H2/H3)
 * - Self-verify tables have required columns (# | Check | How | PASS/FAIL)
 * - Self-verify tables have at least 1 row
 * - Cross-references to reference files point to existing files
 * - Announce pattern exists for non-meta skills
 *
 * No LLM, <5s. Exit 0 if all pass, 1 if any fail.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const MANIFEST = JSON.parse(readFileSync(resolve(REPO_ROOT, 'skills-manifest.json'), 'utf8'));

let pass = 0;
let fail = 0;
const errors = [];

function ok() { pass++; }
function bad(skill, msg) { fail++; errors.push(`  FAIL: ${skill} — ${msg}`); }

// Skills exempt from Pipeline Continuation
const EXEMPT_PIPELINE = ['route-workflow', 'test-framework'];

// Skills exempt from announce pattern (meta/framework skills)
const EXEMPT_ANNOUNCE = [
  'route-workflow', 'test-framework', 'evolve-framework', 'blend-external',
  'improve-framework', 'quick-fix', 'wsl2-audio'
];

// Skills that must have Audit Mode
const AUDIT_SKILLS = [
  'write-vision', 'validate-feature', 'write-spec', 'write-journeys',
  'design-ux', 'design-ui', 'design-tech', 'write-e2e',
  'analyze-domain', 'analyze-competitors', 'define-code-style',
  'explore-solutions', 'audit-implementation', 'track-visuals',
  'extract-bootstrap'
];

/**
 * Parse Markdown into a heading tree.
 * Returns array of { level, title, lineNum, content }
 */
function parseHeadingTree(content) {
  const lines = content.split('\n');
  const headings = [];
  let inFrontmatter = false;
  let frontmatterCount = 0;
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track frontmatter
    if (line.trim() === '---') {
      frontmatterCount++;
      if (frontmatterCount <= 2) {
        inFrontmatter = frontmatterCount === 1;
        if (frontmatterCount === 2) inFrontmatter = false;
        continue;
      }
    }
    if (inFrontmatter) continue;

    // Track code blocks — accumulate content but don't parse headings inside
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      if (headings.length > 0) headings[headings.length - 1].content += line + '\n';
      continue;
    }
    if (inCodeBlock) {
      if (headings.length > 0) headings[headings.length - 1].content += line + '\n';
      continue;
    }

    // Match headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      headings.push({
        level: headingMatch[1].length,
        title: headingMatch[2].trim(),
        lineNum: i + 1,
        content: ''
      });
    } else if (headings.length > 0) {
      headings[headings.length - 1].content += line + '\n';
    }
  }

  return headings;
}

/**
 * Extract self-verify table from content under a heading.
 */
function parseSelfVerifyTable(content) {
  const lines = content.split('\n');
  let inTable = false;
  let headerLine = null;
  let separatorFound = false;
  let rows = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!inTable && trimmed.startsWith('|') && trimmed.endsWith('|')) {
      headerLine = trimmed;
      inTable = true;
      continue;
    }
    if (inTable && !separatorFound) {
      if (trimmed.match(/^\|[-| :]+\|$/)) {
        separatorFound = true;
        continue;
      } else {
        inTable = false;
        headerLine = null;
        continue;
      }
    }
    if (inTable && separatorFound) {
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        rows++;
      } else {
        break;
      }
    }
  }

  if (!headerLine || !separatorFound) return null;
  const columns = headerLine.split('|').filter(c => c.trim()).map(c => c.trim());
  return { columns, rows };
}

/**
 * Find cross-references to reference files in content.
 * Only matches `references/<name>.md` patterns that are clearly file references.
 */
function findCrossRefs(content) {
  const refs = new Set();
  // Match references/*.md in backticks, parens, or after @
  const patterns = content.matchAll(/(?:`|@|\()references\/([a-z0-9/_-]+\.md)/gi);
  for (const m of patterns) {
    refs.add(`references/${m[1]}`);
  }
  return [...refs];
}

// --- Run validation ---

for (const skill of MANIFEST.includedSkills) {
  const skillFile = resolve(REPO_ROOT, 'skills', skill, 'SKILL.md');
  let content;
  try {
    content = readFileSync(skillFile, 'utf8');
  } catch {
    bad(skill, 'SKILL.md not found');
    continue;
  }

  const headings = parseHeadingTree(content);
  const headingTitles = headings.map(h => h.title);

  // 1. Must have at least one H1 (the skill title)
  const h1s = headings.filter(h => h.level === 1);
  if (h1s.length === 0) {
    bad(skill, 'no H1 heading found');
  } else if (h1s.length > 1) {
    bad(skill, `multiple H1 headings: ${h1s.map(h => h.title).join(', ')}`);
  } else {
    ok();
  }

  // 2. Heading nesting: no jumps > 1 level (H1 → H3 without H2)
  let prevLevel = 0;
  let nestingOk = true;
  for (const h of headings) {
    if (h.level > prevLevel + 1 && prevLevel > 0) {
      bad(skill, `heading jump from H${prevLevel} to H${h.level} at line ${h.lineNum}: "${h.title}"`);
      nestingOk = false;
    }
    prevLevel = h.level;
  }
  if (nestingOk) ok();

  // 3. Pipeline Continuation section
  if (!EXEMPT_PIPELINE.includes(skill)) {
    if (!headingTitles.includes('Pipeline Continuation')) {
      bad(skill, 'missing "## Pipeline Continuation" section');
    } else {
      ok();
    }
  } else {
    ok();
  }

  // 4. Self-Verify section (check frontmatter self_verify flag)
  const fmStr = content.match(/^---\n([\s\S]*?)\n---/)?.[1] || '';
  const hasSelfVerifyFlag = fmStr.includes('self_verify: true');

  if (hasSelfVerifyFlag) {
    const svHeading = headings.find(h => h.title === 'Self-Verify' || h.title.startsWith('Self-Verify'));
    if (!svHeading) {
      bad(skill, 'self_verify: true but missing "## Self-Verify" section');
    } else {
      ok();

      // 5. Self-verify table must have required columns
      const table = parseSelfVerifyTable(svHeading.content);
      if (!table) {
        bad(skill, 'Self-Verify section has no valid table');
      } else {
        ok();

        const requiredColumns = ['#', 'Check', 'How', 'PASS/FAIL'];
        for (const col of requiredColumns) {
          if (!table.columns.some(c => c.includes(col) || c === col)) {
            bad(skill, `Self-Verify table missing column: ${col} (has: ${table.columns.join(', ')})`);
          } else {
            ok();
          }
        }

        if (table.rows < 1) {
          bad(skill, 'Self-Verify table has no data rows');
        } else {
          ok();
        }
      }
    }
  }

  // 6. Audit Mode section for skills that need it
  if (AUDIT_SKILLS.includes(skill)) {
    if (!headingTitles.includes('Audit Mode')) {
      bad(skill, 'missing "## Audit Mode" section');
    } else {
      ok();
    }
  }

  // 7. Announce pattern — should contain "I'm using" or "Announce at start"
  if (!EXEMPT_ANNOUNCE.includes(skill)) {
    const bodyContent = content.replace(/^---[\s\S]*?---/, '');
    if (!bodyContent.includes("I'm using") && !bodyContent.includes('Announce at start')) {
      bad(skill, 'no announce pattern found ("I\'m using" or "Announce at start")');
    } else {
      ok();
    }
  } else {
    ok();
  }

  // 8. Cross-references to reference files should exist
  //    Check both repo-root and skill-directory relative paths
  const bodyContent = content.replace(/^---[\s\S]*?---/, '');
  const refs = findCrossRefs(bodyContent);
  for (const ref of refs) {
    const repoPath = resolve(REPO_ROOT, ref);
    const skillPath = resolve(REPO_ROOT, 'skills', skill, ref);
    if (!existsSync(repoPath) && !existsSync(skillPath)) {
      bad(skill, `cross-reference to non-existent file: ${ref}`);
    } else {
      ok();
    }
  }

  // 9. No truly empty H2 sections (H2 with no content AND no child H3 headings)
  for (let i = 0; i < headings.length - 1; i++) {
    const current = headings[i];
    const next = headings[i + 1];
    if (current.level === 2) {
      const hasContent = current.content.trim().length >= 10;
      const hasChildHeading = next.level > 2; // H3+ is a child section
      if (!hasContent && !hasChildHeading) {
        bad(skill, `H2 "${current.title}" at line ${current.lineNum} is empty (no content or child sections)`);
      } else {
        ok();
      }
    }
  }
}

// Summary
console.log('=== Tier 1: Markdown AST Validation ===');
console.log(`  ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('');
  errors.forEach(e => console.log(e));
  process.exit(1);
} else {
  console.log('  PASS — all markdown structure valid');
  process.exit(0);
}
