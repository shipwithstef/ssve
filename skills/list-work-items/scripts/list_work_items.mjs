import fs from 'fs';
import path from 'path';

const WORK_ITEMS_DIR = process.env.SVC_WORK_ITEMS_DIR || 'docs/specs/work-items';
const DONE_FILE = path.join(WORK_ITEMS_DIR, 'DONE.md');

// Status buckets — case-insensitive match against the **Status:** field.
// Anything matching DONE_STATUSES is treated as closed and routed to DONE.md.
// Anything else (or missing) is treated as open backlog.
const DONE_STATUSES = new Set([
  'verified', 'done', 'closed', 'baselined', 'shipped',
  'completed', 'implemented', 'resolved', 'merged', 'released'
]);

const PRIORITY_WEIGHT = { critical: 4, high: 3, medium: 2, low: 1 };

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return {};

  const out = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function fieldValue(content, frontmatter, markdownNames, frontmatterNames = markdownNames) {
  for (const name of markdownNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = content.match(new RegExp(`^\\*\\*${escaped}:\\*\\*\\s*(.+?)\\s*$`, 'im'));
    if (m) return m[1].trim();
  }

  for (const name of frontmatterNames) {
    if (frontmatter[name] !== undefined && frontmatter[name] !== '') return frontmatter[name];
  }
  return null;
}

function activeFieldValue(raw) {
  return String(raw ?? '').replace(/~~[\s\S]*?~~/g, ' ').trim();
}

function parseArgs(argv) {
  const args = { all: false, detail: null, json: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all') args.all = true;
    else if (a === '--json') args.json = true;
    else if (a === '--detail') args.detail = argv[++i];
    else if (a.startsWith('--detail=')) args.detail = a.split('=')[1];
  }
  return args;
}

function readWorkItem(file) {
  const content = fs.readFileSync(file, 'utf-8');
  const frontmatter = parseFrontmatter(content);
  const id = path.basename(file, '.md');

  // Subject: tolerate `# WI-NNN: title`, `# WI-NNN — title`, `# WI-NNN - title`,
  // or a plain `# Title` (capture-idea output, no WI prefix in heading).
  let subject = '';
  let labeled = content.match(/^# (WI-[\w-]+)[\s:—–-]+(.+?)\s*$/m);
  if (labeled) {
    subject = labeled[2].trim();
  } else {
    const h1 = content.match(/^# (.+?)\s*$/m);
    subject = h1 ? h1[1].trim() : '(no heading)';
  }

  // Status: read the literal field. Default to 'backlog' if absent.
  const statusRaw = fieldValue(content, frontmatter, ['Status'], ['status']) ?? 'backlog';
  // First word, stripped of surrounding markdown/punctuation, is the bucket key.
  const statusKey = activeFieldValue(statusRaw).split(/[\s—–\-(,]/)[0].toLowerCase();
  const isDone = DONE_STATUSES.has(statusKey);

  // Priority: accept either **Priority:** or **Severity:** (newer WIs use Severity).
  const priorityRaw = fieldValue(content, frontmatter, ['Priority', 'Severity'], ['priority', 'severity']) ?? 'low';
  const priorityKey = activeFieldValue(priorityRaw).toLowerCase().match(/critical|high|medium|low/)?.[0] ?? 'low';
  const priorityWeight = PRIORITY_WEIGHT[priorityKey];

  // Dependencies: legacy `**Dependencies:**` field. Modern WIs use Related/Blocks/etc.
  // Accept any of those when present.
  const dependencyRaw = fieldValue(
    content,
    frontmatter,
    ['Dependencies', 'Depends on', 'Blocked by'],
    ['dependencies', 'depends_on', 'blocked_by']
  );
  const dependencies = dependencyRaw ? (dependencyRaw.match(/WI-[\w-]+/g) ?? []) : [];

  // Filed / Closed dates — useful for ordering done items.
  const filedRaw = fieldValue(content, frontmatter, ['Filed'], ['filed']);
  const closedRaw = fieldValue(content, frontmatter, ['Closed'], ['closed']);

  return {
    id,
    file,
    subject,
    statusRaw,
    statusKey,
    isDone,
    priority: priorityKey,
    priorityWeight,
    dependencies,
    filed: filedRaw?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null,
    closed: closedRaw?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null,
    raw: content
  };
}

function sortOpen(items) {
  // Open items: priority desc, then ID natural-ish.
  return [...items].sort((a, b) => {
    if (b.priorityWeight !== a.priorityWeight) return b.priorityWeight - a.priorityWeight;
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });
}

function sortDone(items) {
  // Done items: most recently closed first; missing closed dates go last.
  return [...items].sort((a, b) => {
    if (a.closed && b.closed) return b.closed.localeCompare(a.closed);
    if (a.closed) return -1;
    if (b.closed) return 1;
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });
}

function pad(s, n) {
  // Pad to width n without ever truncating — short strings get spaces,
  // long strings are returned as-is so metadata is never lost.
  s = String(s ?? '');
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function truncate(s, n) {
  s = String(s ?? '');
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

const STATUS_DISPLAY_MAX = 28;
const SUBJECT_DISPLAY_MAX = 80;

function renderTable(items) {
  // Compute column widths from actual content so nothing gets clipped — except
  // status, which is capped to keep the table readable. Full status is always
  // available via --detail and in DONE.md.
  const idW = Math.max(2, ...items.map(i => i.id.length));
  const statusW = Math.min(
    STATUS_DISPLAY_MAX,
    Math.max(6, ...items.map(i => i.statusRaw.length))
  );
  const priW = Math.max(3, ...items.map(i => i.priority.length));
  const lines = [];
  lines.push(`| ${pad('ID', idW)} | ${pad('Status', statusW)} | ${pad('Pri', priW)} | Subject`);
  lines.push(`|${'-'.repeat(idW + 2)}|${'-'.repeat(statusW + 2)}|${'-'.repeat(priW + 2)}|${'-'.repeat(SUBJECT_DISPLAY_MAX + 2)}`);
  for (const it of items) {
    lines.push(`| ${pad(it.id, idW)} | ${pad(truncate(it.statusRaw, statusW), statusW)} | ${pad(it.priority, priW)} | ${truncate(it.subject, SUBJECT_DISPLAY_MAX)}`);
  }
  return lines.join('\n');
}

function writeDoneFile(doneItems) {
  const header = [
    '# Closed Work Items',
    '',
    `_Generated by list-work-items on ${new Date().toISOString().slice(0, 10)}._`,
    '',
    `Total closed: **${doneItems.length}**`,
    '',
    '| ID | Status | Closed | Subject |',
    '|----|--------|--------|---------|'
  ];
  const rows = doneItems.map(it =>
    `| [${it.id}](${path.basename(it.file)}) | ${it.statusRaw} | ${it.closed ?? '—'} | ${it.subject.replace(/\|/g, '\\|')} |`
  );
  fs.writeFileSync(DONE_FILE, header.concat(rows).join('\n') + '\n');
}

function renderDetail(item) {
  return `# ${item.id}\n\n` +
    `**Status:** ${item.statusRaw}\n` +
    `**Priority:** ${item.priority}\n` +
    (item.dependencies.length ? `**Dependencies:** ${item.dependencies.join(', ')}\n` : '') +
    (item.filed ? `**Filed:** ${item.filed}\n` : '') +
    (item.closed ? `**Closed:** ${item.closed}\n` : '') +
    `\n---\n\n${item.raw}`;
}

function main() {
  const args = parseArgs(process.argv);

  if (!fs.existsSync(WORK_ITEMS_DIR)) {
    console.error(`Directory ${WORK_ITEMS_DIR} not found.`);
    process.exit(1);
  }

  const files = fs.readdirSync(WORK_ITEMS_DIR)
    .filter(f => /^WI-.*\.md$/.test(f))
    .map(f => path.join(WORK_ITEMS_DIR, f));

  if (files.length === 0) {
    console.log('No work items found in docs/specs/work-items/');
    return;
  }

  const items = files.map(readWorkItem);

  if (args.detail) {
    const target = args.detail.toUpperCase();
    const found = items.find(i => i.id.toUpperCase() === target);
    if (!found) {
      console.error(`No work item matching "${args.detail}". Try one of: ${items.map(i => i.id).slice(0, 5).join(', ')}…`);
      process.exit(1);
    }
    process.stdout.write(renderDetail(found));
    return;
  }

  if (args.json) {
    process.stdout.write(JSON.stringify(items, null, 2));
    return;
  }

  const open = sortOpen(items.filter(i => !i.isDone));
  const done = sortDone(items.filter(i => i.isDone));

  // Always refresh the done file so it stays in sync with the WI dir.
  writeDoneFile(done);

  const out = [];
  out.push(`# Open Backlog (${open.length} items)`);
  out.push('');
  out.push('Sorted by priority (critical → low), then ID.');
  out.push('');
  out.push(renderTable(open));
  out.push('');
  out.push('---');
  out.push(`Closed items: **${done.length}** — written to \`${DONE_FILE}\`.`);
  out.push(`Re-run with \`--all\` to also list closed items inline, or \`--detail WI-NNN\` for a single item's full body.`);

  if (args.all) {
    out.push('');
    out.push(`# Closed Work Items (${done.length})`);
    out.push('');
    out.push(renderTable(done));
  }

  process.stdout.write(out.join('\n') + '\n');
}

try {
  main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
