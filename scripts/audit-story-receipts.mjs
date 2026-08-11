#!/usr/bin/env node
/**
 * Story-receipts validator — the forward alignment gate.
 * Ported from example-marketplace (main, scripts/audit-story-receipts.mjs) for WI-521 Batch A
 * and parameterized against the svc-canonical stage registry (references/stage-registry.json)
 * instead of an embedded stage table — a second embedded vocabulary is exactly the G4 drift
 * class this port exists to close, so there is no fallback copy here: a missing/invalid
 * registry is a hard exit 2, never a silently-used default.
 * Contract: references/story-receipts.md
 *
 * Usage: node scripts/audit-story-receipts.mjs docs/specs/receipts/<WI>.receipts.json [--wip] [--json]
 *
 * Exit 0 only when every REQUIRED stage for the story type is `done` with evidence
 * that exists, or `na` with a written note. `--wip` reports without failing, for
 * mid-story runs. `--json` additionally (or instead, alongside the printed matrix)
 * emits a machine-readable per-stage verdict + overall summary. Exit codes are
 * unchanged by `--json` — it is additive output only.
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { WI_ID_RE, WI_ID_BODY } from '../hooks/lib/wi-id.mjs';

// ---- Registry path — NEVER project-overridable (see below), unlike the paths block ----
// A per-project override here would be a supported route to a second stage vocabulary —
// exactly the drift class this whole port exists to close. If project-registry substitution
// is ever genuinely wanted, it must be an explicit, reviewed SUBSTITUTION of the canonical
// file's role, never a silent fallback path threaded through the same config a project also
// uses to relocate its UI-specs root — so it does not live in DEFAULT_PATHS/loadPaths below.
const REGISTRY_PATH = 'references/stage-registry.json';

// ---- Paths block — overridable via .svc/story-receipts-config.json, defaults unchanged ----
// CONFORMANCE_PATH holds a DIRECTORY prefix (not a full file path) — it is combined with
// `${data.wi}.md` per receipt, since the conformance report's filename varies by WI. Kept
// the original A2 spec's name (not the `CONFORMANCE_DIR` this file briefly used mid-port).
const DEFAULT_PATHS = {
  UI_SPECS_ROOT: 'docs/specs/ui/',
  CONFORMANCE_PATH: 'docs/specs/design-conformance',
  DECISIONS_GLOB: 'docs/specs/decisions/*/DECISION.md',
};
function loadPaths() {
  const configPath = '.svc/story-receipts-config.json';
  if (!fs.existsSync(configPath)) return { ...DEFAULT_PATHS };
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    console.error(`${configPath} is invalid JSON — ${e.message}`);
    process.exit(2);
  }
  const merged = { ...DEFAULT_PATHS, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  delete merged.REGISTRY_PATH; // never honored, even if a project's config tries to set it
  return merged;
}
const PATHS = loadPaths();

// ---- Registry load + sanity check (no embedded fallback — G4 is the disease this cures) ----
function loadRegistry() {
  let raw;
  try {
    raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
  } catch (e) {
    console.error(`stage registry not found or unreadable: ${REGISTRY_PATH} — ${e.message}`);
    process.exit(2);
  }
  let reg;
  try {
    reg = JSON.parse(raw);
  } catch (e) {
    console.error(`stage registry is invalid JSON: ${REGISTRY_PATH} — ${e.message}`);
    process.exit(2);
  }
  if (!Array.isArray(reg.stages) || !reg.stages.length) {
    console.error(`stage registry has no "stages" array: ${REGISTRY_PATH}`);
    process.exit(2);
  }
  const seen = new Set();
  for (const s of reg.stages) {
    if (!s || typeof s.key !== 'string' || !s.key) {
      console.error(`stage registry has an entry with no "key": ${REGISTRY_PATH}`);
      process.exit(2);
    }
    if (seen.has(s.key)) {
      console.error(`stage registry has a duplicate stage key "${s.key}": ${REGISTRY_PATH}`);
      process.exit(2);
    }
    seen.add(s.key);
    if (!['essential', 'conditional', 'situational'].includes(s.class)) {
      console.error(`stage registry entry "${s.key}" has class "${s.class}" — must be essential|conditional|situational`);
      process.exit(2);
    }
  }
  const classByKey = new Map(reg.stages.map((s) => [s.key, s.class]));
  const profiles = reg.story_type_profiles;
  if (!profiles || typeof profiles !== 'object' || Array.isArray(profiles)) {
    console.error(`stage registry has no "story_type_profiles" object: ${REGISTRY_PATH}`);
    process.exit(2);
  }
  for (const [profile, list] of Object.entries(profiles)) {
    if (!Array.isArray(list)) {
      console.error(`stage registry profile "${profile}" is not an array: ${REGISTRY_PATH}`);
      process.exit(2);
    }
    for (const key of list) {
      if (!seen.has(key)) {
        console.error(`stage registry profile "${profile}" references unknown stage key "${key}": ${REGISTRY_PATH}`);
        process.exit(2);
      }
      // A profile may never REQUIRE a situational stage: situational stages are
      // "receiptable when triggered", not part of any story type's unconditional
      // floor. Allowing this here would let the registry assert a requirement the
      // validator's core print loop silently never checks (fixed defense-in-depth
      // below too, but the authoring-time rule is the one that should never let this
      // exist in the first place).
      if (classByKey.get(key) === 'situational') {
        console.error(`stage registry profile "${profile}" requires situational stage "${key}" — situational stages cannot be a profile's unconditional floor`);
        process.exit(2);
      }
    }
  }
  return reg;
}
const REGISTRY = loadRegistry();
// Core print loop = every non-situational stage, IN REGISTRY ORDER — that order is the
// canonical stage order (references/stage-registry.json `_comment`); situational stages
// are receiptable when triggered but are not part of every story's unconditional matrix.
const STAGES = REGISTRY.stages.filter((s) => s.class !== 'situational').map((s) => s.key);
const CORE_STAGE_SET = new Set(STAGES);
const REQUIRED = REGISTRY.story_type_profiles;

// Template staleness sentinel (A3): warn (never fail) when references/receipts-TEMPLATE.json
// carries a stage key the registry no longer recognizes — this is exactly the example-marketplace
// 17-vs-28 staleness class the registry-backed port exists to prevent from recurring.
const TEMPLATE_PATH = 'references/receipts-TEMPLATE.json';
if (fs.existsSync(TEMPLATE_PATH)) {
  try {
    const tpl = JSON.parse(fs.readFileSync(TEMPLATE_PATH, 'utf8'));
    const registryKeys = new Set(REGISTRY.stages.map((s) => s.key));
    const staleKeys = [...new Set((tpl.stages || []).map((s) => s.stage).filter((k) => !registryKeys.has(k)))];
    if (staleKeys.length) {
      console.error(`WARNING: ${TEMPLATE_PATH} has stage keys not in the registry (stale — regenerate it): ${staleKeys.join(', ')}`);
    }
  } catch (e) {
    console.error(`WARNING: ${TEMPLATE_PATH} could not be checked for drift — ${e.message}`);
  }
}

const [, , file, ...flags] = process.argv;
const wip = flags.includes('--wip');
const jsonOut = flags.includes('--json');
if (!file) { console.error('usage: audit-story-receipts.mjs <receipts.json> [--wip] [--json]'); process.exit(2); }

let data;
try {
  data = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (e) {
  // A raw ENOENT stack reads like a validator bug; the usual cause is running
  // from a branch/worktree that predates the receipts file (caught 2026-07-30).
  console.error(e.code === 'ENOENT'
    ? `receipts file not found: ${file} — are you on the right branch/worktree?`
    : `receipts file unreadable: ${file} — ${e.message}`);
  process.exit(2);
}
const required = REQUIRED[data.story_type];
if (!required) { console.error(`unknown story_type "${data.story_type}" — one of: ${Object.keys(REQUIRED).join(', ')}`); process.exit(2); }

// Pre-stage-registry product receipts sometimes carried a complete local validation
// matrix but no `stages[]`. They are not canonical closeout evidence and still fail
// this integration gate. They also must not be described as unfinished feature code:
// preserve the product's declared local-completion state and name receipt migration as
// the blocker/next action. This is a projection only; it never synthesizes stage proof.
const legacyValidationMatrix = (!Array.isArray(data.stages) || data.stages.length === 0)
  && data.status === 'VALIDATION_MATRIX_DECLARED'
  && data.audit?.mode === 'implementation-ready'
  && Array.isArray(data.validation_runs)
  && data.validation_runs.length > 0;
const deliveryProjection = legacyValidationMatrix
  ? {
      status: 'INTEGRATION_BLOCKED',
      locally_completed: true,
      proof_level: 'legacy-declared',
      blocker: 'canonical-stage-receipts-missing',
      dependencies: Array.isArray(data.dependency_reds) ? data.dependency_reds : [],
      next_permitted_action: 'migrate or adopt existing proof into canonical stage receipts; do not restart feature implementation',
    }
  : null;

const byStage = Object.fromEntries((data.stages || []).map((s) => [s.stage, s]));
let failures = 0;
const rows = [];

// All git calls go through argument ARRAYS (no shell) — receipt-controlled strings
// must never reach a shell line (Codex R1 finding 5: quotes don't stop $()/backticks).
function gitRun(args) {
  return execFileSync('git', args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
}
// true/false for tracked-ness; INFRASTRUCTURE errors (git missing, not a repo)
// propagate — callers decide, and the close gate fails CLOSED on them (R1 finding 2).
function gitTracked(p) {
  try { gitRun(['ls-files', '--error-unmatch', '--', p]); return true; }
  catch (e) { if (e.status === 1) return false; throw e; }
}

function evidenceOk(ev) {
  if (/^https?:\/\//.test(ev)) return true; // external run links: trust but visible
  if (ev.startsWith('commit:')) {
    const sha = ev.slice(7);
    if (!/^[0-9a-f]{4,40}$/i.test(sha)) return false;
    try { gitRun(['cat-file', '-t', sha]); return true; }
    catch { return false; } // unknown sha OR git unavailable — both fail closed
  }
  const path = ev.split('#')[0].replace(/:\d+(-\d+)?$/, '');
  // TRACKED, not merely present: a blanket gitignore silently dropped the receipts
  // JSONs themselves on 2026-07-29 — evidence that exists only on one machine's
  // disk is not evidence the repo holds.
  try { return gitTracked(path); }
  catch { return false; } // git unavailable — fail closed, never "assume tracked"
}

function verdictFor(stage, s, req) {
  let verdict, detail = '';
  if (!s) {
    verdict = req ? '❌ MISSING' : '· optional';
    if (req) failures++;
  } else if (s.status === 'done') {
    const evs = s.evidence || [];
    const bad = evs.filter((e) => !evidenceOk(e));
    const gnd = s.grounded_on || [];
    if (!evs.length) { verdict = '❌ done-without-evidence'; failures++; }
    else if (bad.length) { verdict = '❌ evidence-not-found'; detail = bad.join(', '); failures++; }
    // Provenance: a done receipt must name the INPUT truths it was derived from
    // (kind-prefixed: code:/artifact:/external:/ruling:/sweep:), distinct from the
    // OUTPUT evidence. "How was this calculated" must be answerable from the receipt.
    else if (!gnd.length) { verdict = '❌ done-without-grounding'; failures++; }
    else { verdict = '✅ done'; detail = `⚓${gnd.length} · ` + evs.join(', '); }
  } else if (s.status === 'na') {
    if (!s.note) { verdict = '❌ na-without-note'; failures++; }
    else { verdict = '➖ n/a'; detail = s.note; }
  } else {
    verdict = req ? '⏳ pending' : '⏳ pending (optional)';
    if (req) failures++;
    detail = s.note || '';
  }
  return { verdict, detail };
}

for (const stage of STAGES) {
  const s = byStage[stage];
  // A story may pin extra stages beyond its type's floor with `"required": true`
  // (e.g. a bug whose root cause is a spec conflict pins spec/personas).
  const req = required.includes(stage) || s?.required === true;
  const { verdict, detail } = verdictFor(stage, s, req);
  rows.push({ stage, req: req ? 'REQ' : '   ', verdict, detail });
}
// Situational stages (registry class "situational") are NOT part of the unconditional
// matrix above — they print only when the story actually triggered them (present in the
// receipt's own `stages` array). Escalation to required works two ways, belt and braces:
// `required.includes()` (in case a profile is ever allowed to name one directly — loadRegistry
// forbids this today, but this check must not silently rely on that alone) OR the story's own
// `"required": true` pin. Dropping the `required.includes()` half here was the exact fail-open
// a fixture with a bogus profile once demonstrated: the registry said required, this loop said
// nothing, and the story closed "aligned" with the stage in no row at all.
const printedStages = new Set(STAGES);
for (const s of data.stages || []) {
  if (CORE_STAGE_SET.has(s.stage)) continue;
  const req = required.includes(s.stage) || s.required === true;
  const { verdict, detail } = verdictFor(s.stage, s, req);
  rows.push({ stage: s.stage, req: req ? 'REQ' : '   ', verdict, detail });
  printedStages.add(s.stage);
}
// A required situational stage that never even got a receipt entry (not caught by either
// loop above, since the core loop only walks non-situational STAGES and the loop above only
// walks entries the receipt already has) is a MISSING row, same as any other required stage.
for (const stage of required) {
  if (printedStages.has(stage)) continue;
  rows.push({ stage, req: 'REQ', verdict: '❌ MISSING', detail: '' });
  failures++;
}

// ---- Design-conformance close gate (2026-07-29 — the chain's UI blind spot) ----
// Stages 5a/5b/5c certify the spec BEFORE the code; no stage above re-checks the CODE
// against the screen spec (feature specs get closure via spec-sync; screen specs had none —
// 5 mismatches, 2 on a SIGNED decision clause, survived 26 green stages on
// WI-QUIET-FOLLOW-01). If the story has a screen spec, closing additionally requires a
// graded conformance report: 1:1 coverage of the spec's UI-<WI>-NN row IDs, exact grade
// enum, tracked path:line citations on every MET, zero MISSING, and a walked
// Signed-clauses section when a DECISION card covers the WI.
// Structural parse per Codex R1 (2026-07-29): the first version matched loose tokens and
// was gameable by fences/empty reports/prose; this version parses table rows and fails
// CLOSED on git errors. Contract: references/story-receipts.md §Mechanics 6; rationale:
// proposals/2026-07-29-design-conformance-gate.md (example-marketplace)

// Markdown table row -> trimmed cells (drops the empty edges of `| a | b |`).
// 4+ spaces / tab indent = an INDENTED CODE BLOCK in Markdown, not a table row —
// without this check a code-block "row" would count as a real grade (Codex R2).
function tableCells(line) {
  if (/^(?: {4,}|\t)/.test(line)) return null;
  if (!line.trim().startsWith('|')) return null;
  const cells = line.split('|').map((c) => c.trim());
  return cells.slice(1, cells.length - 1);
}
const isSeparatorRow = (cells) => cells.every((c) => /^:?-{3,}:?$/.test(c));
// Fenced code blocks must not feed the parser (R1: a fenced "## Signed clauses"
// or a fenced fake row must not count for OR against the report).
function stripFences(text) {
  let inFence = false;
  return text.split('\n').filter((ln) => {
    if (/^\s*(```|~~~)/.test(ln)) { inFence = !inFence; return false; }
    return !inFence;
  }).join('\n');
}
// A MET grade needs at least one git-TRACKED `path.ext:line` citation.
function citedTrackedPathLine(cell) {
  for (const m of (cell || '').matchAll(/([A-Za-z0-9_@./-]+\.[A-Za-z0-9]{1,5}):\d+/g)) {
    try { if (gitTracked(m[1])) return true; }
    catch { return false; } // git down mid-check: fail closed
  }
  return false;
}

let conformance = '· no screen spec — conformance gate n/a';
try {
  const fileBase = file.replace(/\\/g, '/').split('/').pop();
  // WI_ID_RE is svc-canonical (hooks/lib/wi-id.mjs, WI-497) — uppercase A-Z0-9 segments
  // hyphen-joined only, accepts both numeric (WI-9) and named (WI-SOCIAL-01) ids.
  if (!WI_ID_RE.test(data.wi || '') || fileBase !== `${data.wi}.receipts.json`) {
    // The gate keys spec discovery on data.wi — an unvalidated or mismatched wi
    // silently empties the discovery (R1 finding 3).
    conformance = `❌ receipt "wi" (${JSON.stringify(data.wi)}) must be a WI id matching the filename (${fileBase})`;
    failures++;
  } else {
    const screenSpecs = gitRun(['ls-files', '--', PATHS.UI_SPECS_ROOT])
      .split('\n').filter(Boolean)
      .filter((p) => { const b = p.split('/').pop(); return b.startsWith(data.wi) && b.endsWith('.md'); });
    if (screenSpecs.length) {
      const report = `${PATHS.CONFORMANCE_PATH}/${data.wi}.md`;
      if (!gitTracked(report)) {
        conformance = `❌ screen spec exists (${screenSpecs[0]}) but ${report} is missing/untracked`;
        failures++;
      } else {
        const problems = [];
        const body = stripFences(fs.readFileSync(report, 'utf8'));
        // 1:1 coverage source: the IDs the screen spec itself declares (row 5b).
        const idRe = new RegExp(`UI-${data.wi}-\\d+`, 'g');
        const specIds = new Set();
        for (const sf of screenSpecs) {
          for (const m of stripFences(fs.readFileSync(sf, 'utf8')).match(idRe) || []) specIds.add(m);
        }
        if (!specIds.size) problems.push(`screen spec declares no UI-${data.wi}-NN row IDs (row 5b: what has no ID does not exist for the chain)`);
        // Graded design rows: | UI-<WI>-NN | requirement | grade | citation |
        // WI_ID_BODY (unanchored, hooks/lib/wi-id.mjs) composed here rather than a
        // hand-rolled pattern — a second WI-id vocabulary inside this file's own grade
        // parser would be the G4 disease in miniature, inside the batch that cures it.
        const gradeRe = new RegExp(`^(MET|MISSING|(?:PARTIAL|FILED)\\s+[—-]\\s+${WI_ID_BODY})$`);
        const rowIdRe = new RegExp(`^UI-${data.wi}-\\d+$`);
        const signedIdx = body.search(/^## Signed clauses/m);
        const designPart = signedIdx === -1 ? body : body.slice(0, signedIdx);
        // The signed section ends at the NEXT `## ` heading (e.g. the Verdict summary
        // table must not parse as signed-clause rows).
        let signedPart = null;
        if (signedIdx !== -1) {
          const rest = body.slice(signedIdx);
          const afterHeading = rest.indexOf('\n') + 1;
          // Any following ATX heading of level <= 2 ends the section (space OR tab
          // after the hashes, up to 3 leading spaces — Codex R2: `##\tVerdict` and
          // H1 headings must not be swallowed into the signed walk).
          const next = rest.slice(afterHeading).search(/^ {0,3}#{1,2}[ \t]/m);
          signedPart = next === -1 ? rest : rest.slice(0, afterHeading + next);
        }
        const designRows = new Map();
        for (const ln of designPart.split('\n')) {
          const cells = tableCells(ln);
          if (!cells || cells.length < 4 || isSeparatorRow(cells) || !rowIdRe.test(cells[0])) continue;
          if (designRows.has(cells[0])) problems.push(`duplicate row ${cells[0]}`);
          designRows.set(cells[0], { grade: cells[2], cite: cells[3] });
        }
        const uncovered = [...specIds].filter((id) => !designRows.has(id));
        if (uncovered.length) problems.push(`spec rows with no graded report row: ${uncovered.join(', ')}`);
        // Surplus rows are rejected too — coverage is 1:1 BOTH ways, so a report
        // cannot pad itself with invented IDs the spec never declared (Codex R2).
        const surplus = [...designRows.keys()].filter((id) => !specIds.has(id));
        if (surplus.length) problems.push(`report grades IDs the screen spec does not declare: ${surplus.join(', ')}`);
        let designMet = 0;
        for (const [id, r] of designRows) {
          if (!gradeRe.test(r.grade)) { problems.push(`${id}: grade "${r.grade}" is not MET / MISSING / PARTIAL — WI-x / FILED — WI-x`); continue; }
          if (r.grade === 'MISSING') { problems.push(`${id}: MISSING (blocker — implement or re-sign, never silently file)`); continue; }
          if (r.grade === 'MET') {
            if (!citedTrackedPathLine(r.cite)) { problems.push(`${id}: MET without a tracked path:line citation`); continue; }
            designMet++;
          }
        }
        // Signed-clauses exit-walk, required when a DECISION card covers the WI.
        let cardFiles = [];
        try {
          cardFiles = gitRun(['grep', '-l', '-e', data.wi, '--', PATHS.DECISIONS_GLOB])
            .split('\n').filter(Boolean);
        } catch (e) { if (e.status !== 1) throw e; } // 1 = no match; anything else = infra, fail closed
        let signedMet = 0;
        if (cardFiles.length) {
          if (!signedPart) problems.push(`DECISION card (${cardFiles[0]}) covers this WI but the report has no "## Signed clauses" exit-walk`);
          else {
            const signedRows = [];
            for (const ln of signedPart.split('\n')) {
              const cells = tableCells(ln);
              if (!cells || cells.length < 4 || isSeparatorRow(cells) || cells[2] === 'Grade' || !cells[0]) continue;
              signedRows.push(cells);
            }
            if (!signedRows.length) problems.push('"## Signed clauses" section has no graded clause rows');
            for (const cells of signedRows) {
              if (cells[2] === 'RE-SIGN') { problems.push(`signed clause ${cells[0]} awaiting RE-SIGN — blocked on the founder`); continue; }
              if (cells[2] !== 'MET') { problems.push(`signed clause ${cells[0]}: grade must be exactly MET or RE-SIGN, got "${cells[2]}"`); continue; }
              if (!citedTrackedPathLine(cells[3])) { problems.push(`signed clause ${cells[0]}: MET without a tracked path:line citation`); continue; }
              signedMet++;
            }
          }
        }
        if (problems.length) { conformance = `❌ ${report}: ${problems.join('; ')}`; failures++; }
        else conformance = `✅ ${report} (${designMet}/${designRows.size} design rows MET, ${signedMet} signed clauses MET)`;
      }
    }
  }
} catch (e) {
  // Infrastructure failure (git missing, not a repo) is a CLOSURE failure, not "n/a":
  // required stages can be validly `na`, so nothing else is guaranteed to fail loudly.
  conformance = `❌ conformance gate could not run (${e.code || `git exit ${e.status}` || 'error'}) — failing closed`;
  failures++;
}

if (jsonOut) {
  console.log(JSON.stringify({
    wi: data.wi,
    story_type: data.story_type,
    scope: data.scope || '',
    stages: rows.map((r) => ({ stage: r.stage, required: r.req.trim() === 'REQ', verdict: r.verdict, detail: r.detail })),
    conformance,
    failures,
    receipt_shape: legacyValidationMatrix ? 'legacy-validation-matrix' : 'canonical-stage-receipts',
    delivery_projection: deliveryProjection,
    status: failures ? (wip ? 'wip' : 'not-closable') : 'aligned',
  }, null, 2));
} else {
  console.log(`\nSTORY RECEIPTS — ${data.wi} (${data.story_type}) — ${data.scope || ''}\n`);
  for (const r of rows) {
    console.log(`  ${r.req}  ${r.stage.padEnd(21)} ${r.verdict}${r.detail ? '  — ' + r.detail.slice(0, 100) : ''}`);
  }
  console.log(`\n  design-conformance close gate: ${conformance}`);
  if (deliveryProjection) {
    console.log(`\n  delivery projection: ${deliveryProjection.status} (LOCALLY_COMPLETED, ${deliveryProjection.proof_level})`);
    console.log(`  blocked by: ${deliveryProjection.blocker}${deliveryProjection.dependencies.length ? `; product dependencies: ${deliveryProjection.dependencies.join(', ')}` : ''}`);
    console.log(`  next: ${deliveryProjection.next_permitted_action}`);
  }
  console.log(failures
    ? `\n${wip ? '⏳ WIP' : '❌ NOT CLOSABLE'}: ${failures} closure failure(s).`
    : '\n✅ STORY ALIGNED — every required stage receipted.');
}
process.exit(failures && !wip ? 1 : 0);
