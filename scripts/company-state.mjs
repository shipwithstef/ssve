#!/usr/bin/env node
/**
 * company-state (WI-408): the runtime for the company operating fleet
 * (references/company-operating-fleet.md). Scaffolds + reads + appends the
 * company-state ledger under COMPANY_STATE_DIR. Dependency-free.
 *
 *   node scripts/company-state.mjs scaffold --repo <abs> [--state-dir <dir>] [--name <co>]
 *   node scripts/company-state.mjs read     --state-dir <dir>
 *   node scripts/company-state.mjs append-decision --state-dir <dir> (--card '<json>' | --file <f>) [--allow-ungrounded]
 *   node scripts/company-state.mjs resolve  --state-dir <dir> --id <D-...> --verdict approved|rejected|deferred [--note <t>]
 *   node scripts/company-state.mjs record-outcome --state-dir <dir> --id <D-...> --result "<what happened>" [--worked true|false|partial] [--metric name=value] [--amend]
 *   node scripts/company-state.mjs recall   --state-dir <dir> --role <brain>   # compounding read-back before a brain proposes
 *   node scripts/company-state.mjs grade    --state-dir <dir> [--id <D-...>]   # WI-414 fresh-context grade
 *   node scripts/company-state.mjs score    --state-dir <dir> [--min N] [--all] # WI-415 0-100 queue quality
 *   node scripts/company-state.mjs preflight --state-dir <dir> [--min N]         # WI-415 cadence self-check (grade+score)
 *   node scripts/company-state.mjs rank     --state-dir <dir>
 *   node scripts/company-state.mjs resolve-state-dir --repo <abs>
 *
 * State location: default <COMPANY_REPO>/company-state (the owner chose in-app for the
 * private example-marketplace app); override with --state-dir. For a repo that may go PUBLIC,
 * point --state-dir at a private sibling — never leak runway/decisions into a public repo.
 */
import { readFileSync, writeFileSync, existsSync, statSync, realpathSync, mkdirSync, appendFileSync, readdirSync, renameSync, rmSync, openSync, fsyncSync, closeSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const die = (m) => { console.error(`✗ ${m}`); process.exit(1); };

const ROLES = [
  "cos", "growth-lead", "fin-analyst", "product-lead", "market-intel", "counsel",
  "security-ops", "customer-cs", "revops", "comms", "tax-auditor", "privacy-dpo",
  "infra-sre", "procurement", "growth-eng",
  // Backward-compatible ledger roles. No migration is required.
  "chief-of-staff", "financial-analyst", "customer-success", "data-collection", "people-ops",
];
const SCHEMA_VERSION = "1";
const ENUMS = {
  door: ["one-way", "two-way"], cost_of_delay: ["high", "med", "low"],
  ask: ["approve", "pick", "fyi"], status: ["pending", "approved", "rejected", "deferred"],
  proposed_by: ROLES, actionability: ["ready", "needs-owner", "needs-data"],
};
const REQUIRED = ["id", "ts", "proposed_by", "title", "door", "recommendation", "cost_of_delay", "ask", "status"];
// WI-414 review fix: writer must reject unknown keys too (the schema is additionalProperties:false),
// so append-decision and the standalone validator cannot disagree about a card.
const ALLOWED = new Set([
  "id", "ts", "proposed_by", "title", "door", "recommendation", "options", "reversibility",
  "cost_of_delay", "confidence", "rice", "deadline", "ask", "evidence", "evidence_gate",
  "evidence_resolved", "status", "scope", "actionability", "risk_domains", "peer_reviews",
]);

const LINK_VERSION = "1.0.0";
const APP_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MESH_REVIEWERS = {
  finance: "fin-analyst",
  legal: "counsel",
  security: "security-ops",
  privacy: "privacy-dpo",
  reliability: "infra-sre",
};

function gitRoot(candidate) {
  try {
    return realpathSync(execFileSync("git", ["-C", resolve(candidate), "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim());
  } catch { return null; }
}

function parseJsonFile(file, label) {
  try { return JSON.parse(readFileSync(file, "utf8")); }
  catch (error) { die(`${label} is not valid JSON: ${error.message}`); }
}

function validateCompanyLink(link, repoRoot) {
  if (!link || typeof link !== "object" || Array.isArray(link)) die("company link must be a JSON object");
  const keys = Object.keys(link).sort();
  const expected = ["app_id", "company_repo", "schema_version"];
  if (JSON.stringify(keys) !== JSON.stringify(expected)) die(`company link fields must be exactly: ${expected.join(", ")}`);
  if (link.schema_version !== LINK_VERSION) die(`unsupported company link schema_version '${link.schema_version || ""}'`);
  if (!APP_ID_RE.test(String(link.app_id || ""))) die("company link app_id is invalid");
  if (typeof link.company_repo !== "string" || !link.company_repo.startsWith(sep)) die("company link company_repo must be absolute");
  let companyRepo;
  try { companyRepo = realpathSync(link.company_repo); } catch { die(`company link repository not found: ${link.company_repo}`); }
  if (gitRoot(companyRepo) !== companyRepo) die(`company link target is not a Git repository root: ${companyRepo}`);
  const stateDir = join(companyRepo, "company-state");
  try { if (!statSync(stateDir).isDirectory()) die(`company link target has no company-state directory: ${stateDir}`); }
  catch { die(`company link target has no company-state directory: ${stateDir}`); }
  return { stateDir: realpathSync(stateDir), companyRepo, appId: link.app_id, source: "company-link", repoRoot };
}

function resolveCompanyContext() {
  const explicit = opt("--state-dir");
  if (explicit) {
    const stateDir = resolve(explicit);
    return { stateDir, companyRepo: stateDir.endsWith(`${sep}company-state`) ? resolve(stateDir, "..") : null, appId: null, source: "explicit" };
  }
  const requested = opt("--repo") || process.cwd();
  const repoRoot = gitRoot(requested);
  if (!repoRoot) {
    if (opt("--repo")) die(`not inside a Git repository: ${requested}`);
    return { stateDir: join(resolve(requested), "company-state"), companyRepo: null, appId: null, source: "directory-local", repoRoot: null };
  }
  const linkPath = join(repoRoot, ".svc", "company-link.json");
  if (existsSync(linkPath)) return validateCompanyLink(parseJsonFile(linkPath, linkPath), repoRoot);
  return { stateDir: join(repoRoot, "company-state"), companyRepo: repoRoot, appId: null, source: "repository-local", repoRoot };
}

function resolveStateDir() {
  return resolveCompanyContext().stateDir;
}

function validateMesh(card, dir = null) {
  const errs = [];
  if (card.risk_domains === undefined && card.peer_reviews === undefined) return errs;
  if (!Array.isArray(card.risk_domains) || !card.risk_domains.length) return ["risk_domains must be a non-empty array when Immune Mesh fields are present"];
  if (!Array.isArray(card.peer_reviews)) return ["peer_reviews must be an array"];
  const domains = [...new Set(card.risk_domains)];
  if (domains.length !== card.risk_domains.length) errs.push("risk_domains must be unique");
  for (const domain of domains) {
    const requiredReviewer = MESH_REVIEWERS[domain];
    if (!requiredReviewer) { errs.push(`unknown risk domain '${domain}'`); continue; }
    const reviews = card.peer_reviews.filter((r) => r && r.reviewer === requiredReviewer);
    if (reviews.length !== 1) { errs.push(`risk domain '${domain}' requires exactly one ${requiredReviewer} review`); continue; }
    const review = reviews[0];
    if (review.reviewer === card.proposed_by) errs.push(`${requiredReviewer} cannot review its own proposal`);
    if (!["pass", "concern", "block"].includes(review.verdict)) errs.push(`${requiredReviewer} verdict must be pass|concern|block`);
    if (!Array.isArray(review.evidence) || !review.evidence.length || review.evidence.some((e) => typeof e !== "string" || !e.trim())) errs.push(`${requiredReviewer} review requires evidence`);
    else if (dir) {
      const roots = companyRoots(dir);
      const metrics = readJsonl(join(dir, "metrics.jsonl"));
      if (!review.evidence.some((entry) => resolveEvidenceEntry(entry, roots, metrics).ok)) errs.push(`${requiredReviewer} review evidence does not resolve inside company state`);
    }
    if (review.verdict === "block") errs.push(`${requiredReviewer} review blocks the decision card`);
  }
  for (const review of card.peer_reviews) {
    if (!review || typeof review !== "object" || !Object.values(MESH_REVIEWERS).includes(review.reviewer)) errs.push("peer review has an unknown reviewer");
  }
  return errs;
}

function validateCard(c, dir = null) {
  const errs = [];
  for (const k of REQUIRED) if (c[k] === undefined || c[k] === "") errs.push(`missing '${k}'`);
  for (const [k, vals] of Object.entries(ENUMS)) if (c[k] !== undefined && !vals.includes(c[k])) errs.push(`${k}='${c[k]}' not in [${vals.join(", ")}]`);
  if (c.id && !/^D-\d{4}-\d{2}-\d{2}-\d{3}$/.test(c.id)) errs.push(`id '${c.id}' != D-YYYY-MM-DD-NNN`);
  if (c.confidence !== undefined && (typeof c.confidence !== "number" || c.confidence < 0 || c.confidence > 1)) errs.push("confidence must be 0..1");
  for (const k of Object.keys(c)) if (!ALLOWED.has(k)) errs.push(`unknown property '${k}'`);
  errs.push(...validateMesh(c, dir));
  return errs;
}

// --- WI-414: Default-FAIL evidence gate (ported from anthropics/cwc-long-running-agents) ---
// A brain may NOT file a decision card unless it is grounded: >=1 evidence entry resolves to a real
// FILE the brain could have read — and ONLY inside the company's own state dir or repo (never an
// absolute system path, a directory, a '..' escape, or process.cwd()) — OR the card is an explicit
// owner-ask (ask:pick|approve) naming the missing figure as "<TBD: ...>". HARDENED after the WI-414
// self-review (the first cut grounded on ANY existing path — /etc/hostname, a dir, '' — defeating
// the gate). BOUNDARY (cross-model review): brains are lock_class:executor (they hold Write), so this gate
// stops accidental/lazy/non-existent/out-of-bounds citations — it is NOT tamper-proof against a brain that
// deliberately writes a fake file/metric inside the company dirs and cites it. That residual is the WI-409
// boundary, bounded by secret-separation + owner review + the fresh-context grader (doctrine §5), not here.
function insideRoot(p, root) { const r = resolve(root); const x = resolve(p); return x === r || x.startsWith(r + sep); }
function companyRoots(dir) {
  // evidence lives in the state dir OR the company repo (default: the state dir's parent when it is .../company-state).
  const roots = [resolve(dir)];
  const repo = opt("--repo");
  if (repo) roots.push(resolve(repo));
  else if (resolve(dir).endsWith(sep + "company-state")) roots.push(resolve(dir, ".."));
  return roots;
}
function resolveEvidenceEntry(e, roots, metrics) {
  if (typeof e !== "string" || !e.trim()) return { e, kind: "empty", ok: false };
  const s = e.trim();
  if (/<\s*TBD/i.test(s)) return { e: s, kind: "owner-ask", ok: false }; // a stated unknown, not grounding
  const bare = s.replace(/^metric:/i, "").trim();
  if (bare) {
    for (const root of roots) {
      const p = resolve(root, bare);
      if (!insideRoot(p, root)) continue;                              // reject lexical '..' escapes / abs paths outside the company
      try {
        if (!existsSync(p)) continue;
        // resolve symlinks and RE-check containment so a symlink can't escape the company dirs (Codex H1).
        const real = realpathSync(p), realRoot = realpathSync(root);
        if ((real === realRoot || real.startsWith(realRoot + sep)) && statSync(real).isFile())
          return { e: s, kind: "file", ok: true, at: real };
      } catch { /* bad path */ }
    }
  }
  // A metric grounds ONLY if its row cites a SOURCE that itself resolves to a real file — else a brain could
  // append a fabricated metric to metrics.jsonl and cite it (Codex H2). Empty metrics arg breaks the recursion.
  if (bare && Array.isArray(metrics) && metrics.length) {
    const mname = bare.split(/[:=\s]/)[0];
    const m = metrics.find((mm) => mm && (mm.metric === bare || mm.metric === mname));
    if (m && m.source && resolveEvidenceEntry(String(m.source), roots, []).ok)
      return { e: s, kind: "metric", ok: true, at: String(m.source) };
  }
  return { e: s, kind: "unresolved", ok: false };
}
function evidenceGate(card, dir) {
  const metrics = readJsonl(join(dir, "metrics.jsonl"));
  const roots = companyRoots(dir);
  const ev = Array.isArray(card.evidence) ? card.evidence : (card.evidence ? [card.evidence] : []);
  const checks = ev.map((e) => resolveEvidenceEntry(e, roots, metrics));
  const grounded = checks.filter((c) => c.ok);
  const ownerAsk = checks.some((c) => c.kind === "owner-ask") && ["pick", "approve"].includes(card.ask);
  return { ev, checks, grounded, ownerAsk, pass: grounded.length > 0 || (ev.length > 0 && ownerAsk) };
}

// WI-414/415: shared scoring helpers so `grade`, `score`, and `preflight` cannot drift.
function cardReasons(c, dir) {
  const reasons = [];
  reasons.push(...validateCard(c, dir).map((e) => `schema: ${e}`));
  if (!evidenceGate(c, dir).pass) reasons.push("ungrounded: no evidence file/metric resolves and not an owner-ask");
  if (!c.recommendation || /<\s*TBD/i.test(String(c.recommendation))) reasons.push("no concrete recommendation (the default action if owner stays silent)");
  if (c.door === "one-way" && typeof c.confidence !== "number") reasons.push("one-way door without a stated confidence");
  return reasons;
}
function queueScore(cards, dir) {
  const frac = (n) => n / cards.length;
  const oneWay = cards.filter((c) => c.door === "one-way");
  const ranked = rankCards(cards);
  let inversions = 0;
  for (let i = 1; i < ranked.length; i++) if (ranked[i - 1].door === "two-way" && ranked[i].door === "one-way") inversions++;
  const dims = [
    // Quality grounding = REAL file/metric evidence only. An owner-ask (<TBD>) card passes the GATE (it is
    // honest about not knowing) but is a punt, NOT board-grade — so it earns no grounding-quality credit, and an
    // owner-ask-heavy queue scores low (Codex re-review M1; consistent with doctrine §4 "<TBD>-heavy scores low").
    ["grounded (real file/metric evidence, not owner-ask)", frac(cards.filter((c) => evidenceGate(c, dir).grounded.length > 0).length), 3],
    ["decisive (concrete recommendation, no TBD)", frac(cards.filter((c) => c.recommendation && !/<\s*TBD/i.test(String(c.recommendation))).length), 2],
    ["schema-valid", frac(cards.filter((c) => validateCard(c, dir).length === 0).length), 2],
    ["one-way doors carry confidence", oneWay.length ? oneWay.filter((c) => typeof c.confidence === "number").length / oneWay.length : 1, 1.5],
    ["prioritized (one-way ahead of two-way)", ranked.length > 1 ? 1 - inversions / (ranked.length - 1) : 1, 1],
  ];
  const wsum = dims.reduce((s, [, , w]) => s + w, 0);
  const total = Math.round(dims.reduce((s, [, v, w]) => s + v * w, 0) / wsum * 100);
  return { total, dims };
}

const COST_W = { high: 3, med: 2, low: 1 };
function rankCards(cards) {
  return cards.slice().sort((a, b) => {
    const doorA = a.door === "one-way" ? 1 : 0, doorB = b.door === "one-way" ? 1 : 0;
    if (doorA !== doorB) return doorB - doorA;                       // one-way floats to top
    const cdA = COST_W[a.cost_of_delay] || 0, cdB = COST_W[b.cost_of_delay] || 0;
    if (cdA !== cdB) return cdB - cdA;                               // then cost-of-delay
    return (b.rice?.score || 0) - (a.rice?.score || 0);             // then RICE
  });
}

function readJsonl(p) {
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
// STRICT read for the REWRITE paths (resolve/record-outcome): abort rather than silently drop a line we
// can't parse — a lenient filter+rewrite would delete a malformed-but-important row (Codex H1).
function readJsonlStrict(p) {
  if (!existsSync(p)) return [];
  const out = [];
  readFileSync(p, "utf8").split("\n").forEach((l, i) => {
    const t = l.trim(); if (!t) return;
    try { out.push(JSON.parse(t)); } catch { die(`${p}:${i + 1} is not valid JSON — refusing to rewrite (it would drop this line). Fix the line, then retry.`); }
  });
  return out;
}
// ATOMIC write (temp + fsync + rename) so a crash mid-write can't truncate a ledger (Codex H1/H2).
function writeJsonl(p, rows) {
  const tmp = `${p}.tmp-${process.pid}`;
  writeFileSync(tmp, rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""));
  try { const fd = openSync(tmp, "r+"); fsyncSync(fd); closeSync(fd); } catch { /* fsync best-effort */ }
  renameSync(tmp, p);
}
function writeJsonAtomic(p, value) {
  mkdirSync(resolve(p, ".."), { recursive: true });
  const tmp = `${p}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  try { const fd = openSync(tmp, "r+"); fsyncSync(fd); closeSync(fd); } catch { /* fsync best-effort */ }
  renameSync(tmp, p);
}

function materializeOpenItems(dir) {
  const rows = readJsonlStrict(join(dir, "open-items.jsonl"));
  const byId = new Map();
  const order = [];
  for (const [index, event] of rows.entries()) {
    if (!event || typeof event !== "object" || typeof event.id !== "string" || !event.id) die(`open-items.jsonl event ${index + 1} has no id`);
    if (!byId.has(event.id)) { byId.set(event.id, {}); order.push(event.id); }
    byId.set(event.id, { ...byId.get(event.id), ...event });
  }
  return order.map((id) => byId.get(id));
}

function appendOpenItemEvent(dir, event) {
  const file = join(dir, "open-items.jsonl");
  readJsonlStrict(file); // fail before append when historical bytes are malformed
  appendFileSync(file, JSON.stringify(event) + "\n");
}

function addDays(day, count) {
  validateCalendarDate(day);
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function validateCalendarDate(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || ""))) die(`invalid date '${day}'`);
  const parsed = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) die(`invalid date '${day}'`);
}

function validateAppsDocument(doc) {
  const errors = [];
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return ["apps registry must be an object"];
  if (doc.schema_version !== LINK_VERSION) errors.push(`schema_version must equal ${LINK_VERSION}`);
  if (!Array.isArray(doc.apps)) return [...errors, "apps must be an array"];
  const ids = new Set();
  const paths = new Set();
  for (const [index, app] of doc.apps.entries()) {
    const at = `apps[${index}]`;
    if (!app || typeof app !== "object" || Array.isArray(app)) { errors.push(`${at} must be an object`); continue; }
    if (!APP_ID_RE.test(String(app.id || ""))) errors.push(`${at}.id is invalid`);
    if (ids.has(app.id)) errors.push(`${at}.id is duplicated`); else ids.add(app.id);
    if (typeof app.owner !== "string" || !app.owner.trim()) errors.push(`${at}.owner is required`);
    if (!["active", "paused", "retired"].includes(app.status)) errors.push(`${at}.status is invalid`);
    let repoPath = null;
    if (typeof app.repo_path !== "string" || !app.repo_path.startsWith(sep)) errors.push(`${at}.repo_path must be absolute`);
    else {
      try { repoPath = realpathSync(app.repo_path); } catch { errors.push(`${at}.repo_path does not exist`); }
      if (repoPath && gitRoot(repoPath) !== repoPath) errors.push(`${at}.repo_path is not a Git repository root`);
      if (repoPath && paths.has(repoPath)) errors.push(`${at}.repo_path is duplicated`); else if (repoPath) paths.add(repoPath);
    }
    if (!Array.isArray(app.contracts)) { errors.push(`${at}.contracts must be an array`); continue; }
    const contractNames = new Set();
    for (const [contractIndex, contract] of app.contracts.entries()) {
      const ct = `${at}.contracts[${contractIndex}]`;
      if (!contract || typeof contract.name !== "string" || !contract.name.trim()) { errors.push(`${ct}.name is required`); continue; }
      if (contractNames.has(contract.name)) errors.push(`${ct}.name is duplicated`); else contractNames.add(contract.name);
      if (typeof contract.path !== "string" || !contract.path || contract.path.startsWith(sep)) { errors.push(`${ct}.path must be relative`); continue; }
      if (repoPath) {
        const candidate = resolve(repoPath, contract.path);
        if (!insideRoot(candidate, repoPath)) { errors.push(`${ct}.path escapes repository`); continue; }
        try {
          const real = realpathSync(candidate);
          if (!insideRoot(real, repoPath) || !statSync(real).isFile()) errors.push(`${ct}.path is not a contained regular file`);
        } catch { errors.push(`${ct}.path does not exist`); }
      }
    }
  }
  const sorted = [...doc.apps].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  if (JSON.stringify(doc.apps) !== JSON.stringify(sorted)) errors.push("apps must be sorted by id");
  return errors;
}

function loadApps(dir, allowMissing = false) {
  const file = join(dir, "apps.json");
  if (!existsSync(file)) {
    if (allowMissing) return { schema_version: LINK_VERSION, apps: [] };
    die(`apps registry not found: ${file}`);
  }
  const doc = parseJsonFile(file, file);
  const errors = validateAppsDocument(doc);
  if (errors.length) die(`invalid apps registry:\n    ${errors.join("\n    ")}`);
  return doc;
}
// Advisory lock around state mutations so concurrent resolve/record-outcome can't race (Codex H2).
const sleep = (ms) => { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch { /* fallback: no-op */ } };
function withLock(dir, fn) {
  const lock = join(dir, ".state.lock");
  try { if (existsSync(lock) && Date.now() - statSync(lock).mtimeMs > 30000) rmSync(lock, { recursive: true, force: true }); } catch { /* stale-steal best-effort */ }
  let held = false;
  for (let i = 0; i < 30 && !held; i++) { try { mkdirSync(lock); held = true; } catch { sleep(100); } }
  if (!held) die("state is locked by another run (.state.lock) — retry shortly, or remove a stale .state.lock");
  const release = () => { try { rmSync(lock, { recursive: true, force: true }); } catch { /* unlock best-effort */ } };
  process.on("exit", release);   // releases even when die()→process.exit aborts mid-section, so no lock leaks
  try { return fn(); } finally { release(); process.removeListener("exit", release); }
}

function iso() { return new Date().toISOString(); }
function ymd() { return iso().slice(0, 10); }

if (cmd === "resolve" && !opt("--id")) {
  const context = resolveCompanyContext();
  if (argv.includes("--json")) console.log(JSON.stringify(context, null, 2));
  else console.log(context.stateDir);
  process.exit(0);
}

if (cmd === "resolve-state-dir") { console.log(resolveStateDir()); process.exit(0); }

if (cmd === "open-item") {
  const dir = resolveStateDir();
  if (!existsSync(dir)) die(`no state dir: ${dir} (run: scaffold)`);
  const required = ["--front", "--owner", "--direction", "--title"];
  for (const flag of required) if (!opt(flag)) die(`need ${flag} <value>`);
  const opened = opt("--opened") || ymd();
  const slaDays = Number.parseInt(opt("--sla-days") || "7", 10);
  if (!Number.isInteger(slaDays) || slaDays < 0 || slaDays > 3650) die("--sla-days must be an integer from 0 to 3650");
  const due = opt("--due") || addDays(opened, slaDays);
  const nextCheck = opt("--next-check") || opened;
  validateCalendarDate(opened); validateCalendarDate(due); validateCalendarDate(nextCheck);
  withLock(dir, () => {
    const items = materializeOpenItems(dir);
    const prefix = `OI-${opened.replaceAll("-", "")}`;
    const max = items.map((item) => String(item.id || "")).filter((id) => id.startsWith(prefix)).reduce((n, id) => Math.max(n, Number.parseInt(id.slice(-3), 10) || 0), 0);
    const event = {
      id: `${prefix}-${String(max + 1).padStart(3, "0")}`,
      ts: iso(), front: opt("--front"), owner: opt("--owner"), direction: opt("--direction"),
      title: opt("--title"), opened, sla_days: slaDays, due, next_check: nextCheck,
      ref: opt("--ref") || "", checklist: opt("--checklist") || "", priority: opt("--priority") || "med", status: "open",
    };
    appendOpenItemEvent(dir, event);
    console.log(JSON.stringify(event, null, argv.includes("--json") ? 2 : 0));
  });
  process.exit(0);
}

if (cmd === "check-item") {
  const dir = resolveStateDir();
  const id = opt("--id"); if (!id) die("need --id <open-item-id>");
  withLock(dir, () => {
    const item = materializeOpenItems(dir).find((entry) => entry.id === id);
    if (!item) die(`open item not found: ${id}`);
    if (item.status === "closed") die(`open item is already closed: ${id}`);
    const event = { id, ts: iso(), status: "checking" };
    if (opt("--next-check")) event.next_check = opt("--next-check");
    if (opt("--note")) event.note = opt("--note");
    appendOpenItemEvent(dir, event);
    console.log(`✓ checked ${id}`);
  });
  process.exit(0);
}

if (cmd === "close-item") {
  const dir = resolveStateDir();
  const id = opt("--id"); if (!id) die("need --id <open-item-id>");
  const outcome = opt("--outcome"); if (!outcome) die("need --outcome <text>");
  withLock(dir, () => {
    const item = materializeOpenItems(dir).find((entry) => entry.id === id);
    if (!item) die(`open item not found: ${id}`);
    if (item.status === "closed") {
      if (item.outcome === outcome) { console.log(`· ${id} already closed with the same outcome`); return; }
      die(`${id} is already closed with a different outcome`);
    }
    appendOpenItemEvent(dir, { id, ts: iso(), status: "closed", closed: opt("--closed") || ymd(), outcome });
    console.log(`✓ closed ${id}`);
  });
  process.exit(0);
}

if (cmd === "briefing" || cmd === "dashboard") {
  const context = resolveCompanyContext();
  const dir = context.stateDir;
  if (!existsSync(dir)) die(`no state dir: ${dir} (run: scaffold)`);
  const today = opt("--today") || ymd();
  const dueSoonLimit = addDays(today, Number.parseInt(opt("--due-soon-days") || "7", 10));
  const items = materializeOpenItems(dir).filter((item) => item.status !== "closed").sort((a, b) => String(a.due || "9999").localeCompare(String(b.due || "9999")) || a.id.localeCompare(b.id));
  const overdue = items.filter((item) => item.due && item.due < today);
  const dueSoon = items.filter((item) => item.due && item.due >= today && item.due <= dueSoonLimit);
  const onTrack = items.filter((item) => !item.due || item.due > dueSoonLimit);
  const pending = readJsonlStrict(join(dir, "decisions-pending.jsonl")).filter((card) => card.status === "pending");
  const registryPath = join(dir, "apps.json");
  let registryHealth = "missing";
  if (existsSync(registryPath)) {
    try { registryHealth = validateAppsDocument(JSON.parse(readFileSync(registryPath, "utf8"))).length ? "invalid" : "healthy"; }
    catch { registryHealth = "invalid"; }
  }
  const meshBlocked = pending.filter((card) => validateMesh(card).length > 0).length;
  const payload = {
    schema_version: 1, state_dir: realpathSync(dir), source: context.source,
    counts: { open_items: items.length, overdue: overdue.length, due_soon: dueSoon.length, on_track: onTrack.length, pending_decisions: pending.length },
    open_items: items, pending_decisions: pending.map(({ id, title, proposed_by, ask, risk_domains }) => ({ id, title, proposed_by, ask, risk_domains: risk_domains || [] })),
    registry_health: registryHealth, mesh_health: meshBlocked ? { status: "blocked", blocked_cards: meshBlocked } : { status: "healthy", blocked_cards: 0 },
  };
  if (cmd === "dashboard" && argv.includes("--json")) console.log(JSON.stringify(payload, null, 2));
  else {
    const printGroup = (name, rows) => {
      console.log(`\n${name} (${rows.length})`);
      if (!rows.length) console.log("  none");
      rows.slice(0, 20).forEach((item) => console.log(`  ${item.id} [${item.priority || "med"}] due:${item.due || "?"} owner:${item.owner || "?"} — ${item.title || ""}`));
    };
    console.log(`=== company briefing @ ${payload.state_dir} ===`);
    printGroup("OVERDUE", overdue); printGroup("DUE SOON", dueSoon); printGroup("ON TRACK", onTrack);
    console.log(`\nNEXT ACTIONS\n  check ${items.filter((item) => item.next_check && item.next_check <= today).length} item(s); review ${pending.length} pending decision(s); registry ${registryHealth}; mesh ${payload.mesh_health.status}`);
  }
  process.exit(0);
}

if (cmd === "validate-apps") {
  const dir = resolveStateDir();
  const doc = loadApps(dir);
  console.log(argv.includes("--json") ? JSON.stringify({ ok: true, count: doc.apps.length, path: join(dir, "apps.json") }, null, 2) : `✓ apps registry valid (${doc.apps.length} apps)`);
  process.exit(0);
}

if (cmd === "list-apps") {
  const doc = loadApps(resolveStateDir());
  if (argv.includes("--json")) console.log(JSON.stringify(doc, null, 2));
  else doc.apps.forEach((app) => console.log(`${app.id}\t${app.status}\t${app.repo_path}\t${app.owner}`));
  process.exit(0);
}

if (cmd === "register-app") {
  const dir = resolveStateDir();
  const id = opt("--id"); const repoInput = opt("--repo-path"); const owner = opt("--owner");
  if (!id || !repoInput || !owner) die("need --id, --repo-path, and --owner");
  if (!APP_ID_RE.test(id)) die("--id is invalid");
  let contracts = [];
  if (opt("--contracts")) {
    try { contracts = JSON.parse(opt("--contracts")); } catch { die("--contracts must be a JSON array"); }
  }
  const repoPath = gitRoot(repoInput);
  if (!repoPath || repoPath !== realpathSync(repoInput)) die("--repo-path must be an existing Git repository root");
  const entry = { id, repo_path: repoPath, owner, status: opt("--status") || "active", contracts };
  withLock(dir, () => {
    const current = loadApps(dir, true);
    const sameId = current.apps.find((app) => app.id === id);
    if (sameId && JSON.stringify(sameId) === JSON.stringify(entry)) { console.log(`· app ${id} already current`); return; }
    if (sameId) die(`app id '${id}' already exists with different content`);
    if (current.apps.some((app) => { try { return realpathSync(app.repo_path) === repoPath; } catch { return false; } })) die(`repository path already registered: ${repoPath}`);
    const next = { ...current, schema_version: LINK_VERSION, apps: [...current.apps, entry].sort((a, b) => a.id.localeCompare(b.id)) };
    const errors = validateAppsDocument(next);
    if (errors.length) die(`invalid app registration:\n    ${errors.join("\n    ")}`);
    writeJsonAtomic(join(dir, "apps.json"), next);
    console.log(`✓ registered app ${id}`);
  });
  process.exit(0);
}

if (cmd === "scaffold") {
  const repo = opt("--repo");
  if (repo && !existsSync(resolve(repo))) die(`--repo not found: ${repo}`);
  const dir = resolveStateDir();
  const name = opt("--name") || (repo ? resolve(repo).split("/").pop() : "company");
  if (existsSync(dir) && readdirSync(dir).length && !argv.includes("--force")) die(`state dir not empty: ${dir} (use --force to add missing files only)`);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, "reviews"), { recursive: true });
  for (const r of ROLES) mkdirSync(join(dir, r), { recursive: true });
  const put = (rel, body) => { const p = join(dir, rel); if (!existsSync(p)) { writeFileSync(p, body); return `+ ${rel}`; } return `· ${rel} (kept)`; };
  const made = [];
  made.push(put("SCHEMA_VERSION", SCHEMA_VERSION + "\n"));
  made.push(put("state.md", `# ${name} — company state\n\n> Owner: fill the <TBD>s, then run a cadence. Brains read this FIRST and never invent metrics.\n\n- **Stage:** <TBD>\n- **North Star metric:** <TBD: the one number that = delivered value>\n- **Runway-to-zero date:** <TBD>\n- **Top KPIs:** <TBD>\n- **Active OKRs:** see okrs.md\n- **Open risks:** <TBD>\n\n_Updated: ${ymd()} (scaffold)_\n`));
  made.push(put("okrs.md", `# ${name} — OKRs\n\n## Objective 1: <TBD>\n- KR1: <TBD>  — status: <R/Y/G>\n`));
  made.push(put("metrics.jsonl", ""));
  made.push(put("decisions-pending.jsonl", ""));
  made.push(put("decisions-log.jsonl", ""));
  made.push(put("open-items.jsonl", ""));
  console.log(`scaffolded company-state for '${name}' at:\n  ${dir}\n` + made.map((m) => "  " + m).join("\n"));
  console.log(`\nSTOP — owner review: fill the <TBD>s in state.md + okrs.md, then run a cadence.`);
  console.log(`(Left uncommitted; this is your repo. company-state holds business-sensitive data —`);
  console.log(` keep this repo private or gitignore company-state/ before the repo goes public.)`);
  process.exit(0);
}

if (cmd === "read") {
  const dir = resolveStateDir();
  if (!existsSync(dir)) die(`no state dir: ${dir} (run: scaffold)`);
  const ver = existsSync(join(dir, "SCHEMA_VERSION")) ? readFileSync(join(dir, "SCHEMA_VERSION"), "utf8").trim() : "?";
  console.log(`=== company-state @ ${dir} (schema v${ver}) ===`);
  if (existsSync(join(dir, "state.md"))) console.log("\n--- state.md ---\n" + readFileSync(join(dir, "state.md"), "utf8").trim());
  const metrics = readJsonl(join(dir, "metrics.jsonl"));
  console.log(`\n--- metrics: ${metrics.length} recorded` + (metrics.length ? `, latest:\n  ` + metrics.slice(-5).map((m) => `${m.ts || "?"} ${m.metric}=${m.value}${m.unit || ""}`).join("\n  ") : "") + " ---");
  const pending = readJsonl(join(dir, "decisions-pending.jsonl")).filter((d) => d.status === "pending");
  console.log(`\n--- decisions pending: ${pending.length} ---`);
  rankCards(pending).slice(0, 10).forEach((d, i) => console.log(`  ${i + 1}. ${d.actionability ? `[${d.actionability}] ` : ""}[${d.door}/${d.cost_of_delay}/RICE ${d.rice?.score ?? "?"}] ${d.title}  (ask:${d.ask}, by:${d.proposed_by})`));
  process.exit(0);
}

if (cmd === "append-decision") {
  const dir = resolveStateDir();
  if (!existsSync(dir)) die(`no state dir: ${dir} (run: scaffold)`);
  const f = opt("--file");
  if (f && !existsSync(f)) die(`--file not found: ${f}`);   // WI-414 review fix: clean error, not an ENOENT stack
  const raw = f ? readFileSync(f, "utf8") : opt("--card");
  if (!raw) die("need --card '<json>' or --file <path>");
  let card; try { card = JSON.parse(raw); } catch { die("card is not valid JSON"); }
  if (!card.ts) card.ts = iso();
  if (!card.status) card.status = "pending";
  if (!card.id) {
    // WI-414 review fix: unique across BOTH pending AND the resolved log, so trimming the pending
    // queue (daily standup refresh) cannot reissue an id already in the audit trail.
    const today = `D-${ymd()}`;
    const seen = [...readJsonl(join(dir, "decisions-pending.jsonl")), ...readJsonl(join(dir, "decisions-log.jsonl"))]
      .map((d) => (d.id || "")).filter((id) => id.startsWith(today));
    const maxN = seen.reduce((m, id) => { const n = parseInt(id.slice(-3), 10); return Number.isFinite(n) && n > m ? n : m; }, 0);
    card.id = `${today}-${String(maxN + 1).padStart(3, "0")}`;
  }
  const errs = validateCard(card, dir);
  if (errs.length) die(`invalid card:\n    ${errs.join("\n    ")}`);
  // WI-414 Default-FAIL evidence gate — no ungrounded card reaches the owner queue.
  const gate = evidenceGate(card, dir);
  const bypass = argv.includes("--allow-ungrounded");
  if (!gate.pass && !bypass) {
    const shown = gate.checks.length ? gate.checks.map((c) => `      - ${c.kind}: ${JSON.stringify(c.e)}`).join("\n") : "      (no evidence[] provided)";
    die(`evidence gate (WI-414): card '${card.id}' is NOT grounded — refused.\n` +
        `    A decision card must cite >=1 real evidence file/metric, OR be an owner-ask (ask:pick|approve) naming the unknown as "<TBD: ...>".\n` +
        `    evidence checked:\n${shown}\n` +
        `    Fix: point evidence[] at a real file under the state dir / company repo, or a metric in metrics.jsonl;\n` +
        `    if the figure is genuinely unknown, set ask:pick and add "<TBD: need <x> from owner>" to evidence.\n` +
        `    Sanctioned override (logged, not silent): re-run with --allow-ungrounded — stamps evidence_gate:"bypassed".`);
  }
  card.evidence_gate = (!gate.pass && bypass) ? "bypassed" : (gate.grounded.length ? "passed" : "owner-ask");
  if (gate.grounded.length) card.evidence_resolved = gate.grounded.map((c) => c.e);
  appendFileSync(join(dir, "decisions-pending.jsonl"), JSON.stringify(card) + "\n");
  console.log(`✓ appended ${card.id} (${card.door}/${card.cost_of_delay}) [evidence:${card.evidence_gate}] — ${card.title}`);
  process.exit(0);
}

if (cmd === "rank") {
  const dir = resolveStateDir();
  const pending = readJsonl(join(dir, "decisions-pending.jsonl")).filter((d) => d.status === "pending");
  if (!pending.length) { console.log("no pending decisions"); process.exit(0); }
  console.log(`=== ranked decision queue (${pending.length}) ===`);
  rankCards(pending).forEach((d, i) => {
    console.log(`\n${i + 1}. ${d.title}`);
    console.log(`   ${d.actionability ? `[${d.actionability}] ` : ""}${d.door} · cost_of_delay:${d.cost_of_delay} · RICE:${d.rice?.score ?? "?"} · ask:${d.ask} · by:${d.proposed_by}`);
    if (d.recommendation) console.log(`   → ${d.recommendation}`);
  });
  process.exit(0);
}

if (cmd === "grade") {
  // WI-414 fresh-context grader: re-check every pending card from scratch (no writes) and
  // return PASS / NEEDS_WORK. Deterministic structural half of cwc's fresh-context evaluator;
  // the LLM "virgin context" grade is the companion agent-side step (doctrine §1).
  const dir = resolveStateDir();
  if (!existsSync(dir)) die(`no state dir: ${dir} (run: scaffold)`);
  const id = opt("--id");
  let cards = readJsonl(join(dir, "decisions-pending.jsonl")).filter((d) => d.status === "pending");
  if (id) cards = cards.filter((d) => d.id === id);
  if (!cards.length) { console.log("no pending cards to grade"); process.exit(0); }
  let fails = 0;
  console.log(`=== fresh-context grade (${cards.length} pending) ===`);
  for (const c of cards) {
    const reasons = cardReasons(c, dir);
    if (reasons.length) fails++;
    console.log(`\n${reasons.length ? "NEEDS_WORK" : "PASS      "}  ${c.id}  ${c.title}`);
    reasons.forEach((r) => console.log(`   - ${r}`));
  }
  console.log(`\n${cards.length - fails}/${cards.length} PASS`);
  process.exit(fails ? 2 : 0);
}

if (cmd === "score") {
  // WI-415 (native, $0): deterministic 0-100 quality score of a decision queue — the measure-then-
  // promote scoreboard the fleet's §4 cost gate assumes but never had. Scores MEASURABLE properties of
  // the brain's OUTPUT (grounding, decisiveness, schema, prioritization), not the truth of its content.
  const dir = resolveStateDir();
  const file = opt("--file") || join(dir, "decisions-pending.jsonl");
  if (!existsSync(file)) die(`no queue file: ${file}`);
  const cards = readJsonl(file).filter((d) => (argv.includes("--all") ? true : d.status === "pending"));
  if (!cards.length) { console.log("score: 0/100 — EMPTY queue; a run that produces no decisions has FAILED its job (doctrine §6.3)"); process.exit(2); }
  const { total, dims } = queueScore(cards, dir);
  const min = parseInt(opt("--min") || "70", 10);
  console.log(`=== decision-queue quality score: ${total}/100 (${cards.length} cards, threshold ${min}) ===`);
  for (const [name, v, w] of dims) console.log(`  ${String(Math.round(v * 100)).padStart(3)}%  ${name}  (weight ${w})`);
  console.log(total >= min ? `PASS (>= ${min}) — promotable` : `BELOW THRESHOLD (< ${min}) — improve the brain before promoting its cadence`);
  process.exit(total >= min ? 0 : 2);
}

if (cmd === "preflight") {
  // WI-415: the cadence self-check. A brain runs this BEFORE handing its queue to the owner —
  // BLOCKS if any card NEEDS_WORK (grade) OR the queue quality is below threshold (score). One call,
  // one verdict: the daily standup gates on it so an ungrounded/low-grade queue never reaches you.
  const dir = resolveStateDir();
  const file = opt("--file") || join(dir, "decisions-pending.jsonl");
  if (!existsSync(file)) die(`no queue file: ${file}`);
  const cards = readJsonl(file).filter((d) => (argv.includes("--all") ? true : d.status === "pending"));
  if (!cards.length) { console.log("preflight: BLOCK — EMPTY queue; a cadence that hands the owner no decisions has failed its job (doctrine §6.3)"); process.exit(2); }
  const min = parseInt(opt("--min") || "80", 10);
  const needsWork = cards.filter((c) => cardReasons(c, dir).length);
  const { total } = queueScore(cards, dir);
  const ok = needsWork.length === 0 && total >= min;
  console.log(`=== cadence pre-flight: ${cards.length} cards | quality ${total}/100 (min ${min}) | ${needsWork.length} NEEDS_WORK ===`);
  needsWork.forEach((c) => console.log(`   ✗ ${c.id} ${c.title} — ${cardReasons(c, dir)[0]}`));
  console.log(ok ? "PASS — queue is board-grade; OK to hand to the owner" : "BLOCK — fix the flagged cards / raise quality before this queue reaches the owner");
  process.exit(ok ? 0 : 2);
}

// ── The compounding loop (the fleet's missing wire): resolve → record-outcome → recall ──────────────
// A card was proposed (append-decision) and ranked. These three close the learning loop so the brains
// COMPOUND instead of rediscover: the owner's verdict + the real-world outcome become per-brain episodic
// memory the brain reads back BEFORE it proposes again. All repo-preserved jsonl/md (git-durable, no DB).

if (cmd === "resolve") {
  // Owner's verdict on a pending decision → moves it from the live queue into the durable decisions-log
  // AND opens an episodic-memory entry in the proposing brain's ledger (outcome filled later). Half the loop.
  const dir = resolveStateDir();
  if (!existsSync(dir)) die(`no state dir: ${dir} (run: scaffold)`);
  const id = opt("--id"); if (!id) die("need --id D-YYYY-MM-DD-NNN");
  const verdict = opt("--verdict");
  if (!["approved", "rejected", "deferred"].includes(verdict)) die("need --verdict approved|rejected|deferred");
  withLock(dir, () => {
    const pendingPath = join(dir, "decisions-pending.jsonl");
    const pending = readJsonlStrict(pendingPath);                            // strict: never silently drop a row
    const card = pending.find((d) => d.id === id);
    if (!card) die(`no pending decision '${id}' (already resolved? check decisions-log.jsonl)`);
    const role = card.proposed_by;
    const logPath = join(dir, "decisions-log.jsonl");
    // IDEMPOTENT + DURABLE-FIRST (Codex H2 round 2): if a prior run already logged this id (a crash between
    // the log-append and the pending-trim), DON'T duplicate the log/ledger entry — just complete the move by
    // trimming pending. So a crash-retry converges instead of leaving a ghost "awaiting outcome" ledger row.
    const alreadyResolved = readJsonl(logPath).some((d) => d.id === id && d.type !== "outcome");
    if (!alreadyResolved) {
      card.status = verdict; card.resolved_ts = iso();
      if (opt("--note")) card.verdict_note = opt("--note");
      appendFileSync(logPath, JSON.stringify(card) + "\n");                  // durable audit FIRST
    }
    // ENSURE the brain's episodic-memory entry exists (idempotent — create only if missing): covers the normal
    // path AND a crash that logged the card but died before the ledger append (Codex r4 — no lost reminder).
    if (ROLES.includes(role)) {
      mkdirSync(join(dir, role), { recursive: true });
      const lp = join(dir, role, "ledger.jsonl");
      if (!readJsonl(lp).some((r) => r.decision_id === id))
        appendFileSync(lp, JSON.stringify({ ts: iso(), decision_id: id, title: card.title, recommendation: card.recommendation, verdict, outcome: null }) + "\n");
    }
    writeJsonl(pendingPath, pending.filter((d) => d.id !== id));             // ALWAYS complete the move, atomically
    console.log(alreadyResolved
      ? `✓ ${id} was already in decisions-log — completed the interrupted move (ledger ensured; pending trimmed)`
      : `✓ ${id} resolved: ${verdict} → decisions-log + ${role}/ledger (outcome pending — close it with record-outcome)`);
  });
  process.exit(0);
}

if (cmd === "record-outcome") {
  // Close the loop: attach the REAL-WORLD result to a resolved decision. This is the signal a brain learns
  // from — recall surfaces it next time. Appends to the brain's ledger (fills the open entry) + an append-only
  // outcome event in decisions-log + (optionally) a sourced metric. THIS is what turns rediscovery into learning.
  const dir = resolveStateDir();
  if (!existsSync(dir)) die(`no state dir: ${dir} (run: scaffold)`);
  const id = opt("--id"); if (!id) die("need --id D-YYYY-MM-DD-NNN");
  const result = opt("--result"); if (!result) die('need --result "what actually happened"');
  const worked = opt("--worked") || "unknown";   // true | false | partial | unknown
  if (!["true", "false", "partial", "unknown"].includes(worked)) die("--worked must be true|false|partial|unknown");
  const metric = opt("--metric");                 // "name=value"
  const amend = argv.includes("--amend");
  withLock(dir, () => {
    const logPath = join(dir, "decisions-log.jsonl");
    const log = readJsonl(logPath);
    const card = [...log].reverse().find((d) => d.id === id && d.type !== "outcome");
    if (!card) die(`no RESOLVED decision '${id}' in decisions-log — run: resolve --id ${id} --verdict <...> first`);
    // idempotency: refuse a second outcome for the same id unless --amend (outcomes can evolve) — Codex M3.
    const role = card.proposed_by;
    if (ROLES.includes(role)) mkdirSync(join(dir, role), { recursive: true });
    const lp = ROLES.includes(role) ? join(dir, role, "ledger.jsonl") : null;
    // Strict-read the ledger BEFORE any write (Codex r2 #1): a malformed ledger aborts the WHOLE command
    // up-front, not after the log event is appended.
    const rows = lp ? readJsonlStrict(lp) : null;
    const logHasOutcome = log.some((d) => d.type === "outcome" && d.decision_id === id);
    // reconcileLedger(ev): set the LATEST ledger entry for this id to ev's outcome (IDEMPOTENT — overwrites,
    // never dups), or append a closed row if the brain has no entry yet (e.g. a resolve that crashed before
    // its ledger append). Takes the outcome EVENT so the reconcile path can use the DURABLE logged event, not
    // possibly-different retry args.
    const reconcileLedger = (ev) => {
      if (!lp) return;
      let t = null; for (let i = rows.length - 1; i >= 0; i--) if (rows[i].decision_id === id) { t = rows[i]; break; }
      if (t) { t.outcome = ev.result; t.worked = ev.worked; t.outcome_ts = iso(); if (ev.metric) t.metric = ev.metric; writeJsonl(lp, rows); }
      else appendFileSync(lp, JSON.stringify({ ts: iso(), decision_id: id, title: card.title, verdict: card.status, outcome: ev.result, worked: ev.worked, metric: ev.metric || null }) + "\n");
    };
    // ensureMetricFrom(ev): append ev's sourced metric to metrics.jsonl ONLY if not already present (idempotent),
    // so a crash between the outcome-log append and the metric append can't lose it on retry (Codex r5/r6).
    const ensureMetricFrom = (ev) => {
      if (!ev.metric) return;
      const eq = ev.metric.indexOf("="); const mn = (eq >= 0 ? ev.metric.slice(0, eq) : ev.metric).trim(); const mv = (eq >= 0 ? ev.metric.slice(eq + 1) : "").trim();
      const src = `decisions-log.jsonl#${id}`;
      if (readJsonl(join(dir, "metrics.jsonl")).some((m) => m && m.source === src && m.metric === mn && String(m.value) === mv)) return;
      appendFileSync(join(dir, "metrics.jsonl"), JSON.stringify({ ts: iso(), metric: mn, value: mv, source: src }) + "\n");
    };
    if (logHasOutcome && !amend) {
      // already in the log — a re-run OR a crash mid-record. Reconcile the ledger + metric from the DURABLE
      // LOGGED outcome (the source of truth), NOT the retry args — an omitted/changed --metric on retry can't
      // lose or diverge it. Do NOT add a 2nd log event (Codex r3/r5/r6).
      const logged = [...log].reverse().find((d) => d.type === "outcome" && d.decision_id === id);
      reconcileLedger(logged); ensureMetricFrom(logged);
      console.log(`· ${id} outcome already logged — ledger/metric reconciled from the durable log (idempotent; --amend to add an evolved outcome)`);
      return;
    }
    const ev = { type: "outcome", decision_id: id, ts: iso(), result, worked, metric: metric || null };
    appendFileSync(logPath, JSON.stringify(ev) + "\n");
    reconcileLedger(ev); ensureMetricFrom(ev);
    console.log(`✓ outcome recorded for ${id} (worked:${worked}) → ${role}/ledger + decisions-log` + (metric ? " + metrics.jsonl" : ""));
  });
  process.exit(0);
}

if (cmd === "recall") {
  // The compounding READ-BACK: a brain reads its OWN past decisions + their outcomes + its promoted
  // playbook BEFORE proposing, so it builds on what worked instead of starting cold. The other half of the
  // loop. Fleet prompts call this at the top of every run. (Semantic search over the whole brain = company-memory.mjs.)
  const dir = resolveStateDir();
  if (!existsSync(dir)) die(`no state dir: ${dir} (run: scaffold)`);
  const role = opt("--role");
  if (!role || !ROLES.includes(role)) die(`need --role <${ROLES.join("|")}>`);
  const ledger = readJsonl(join(dir, role, "ledger.jsonl"));
  const pb = join(dir, role, "playbook.md");
  console.log(`=== recall for ${role} (${ledger.length} past decisions on record) ===`);
  console.log(existsSync(pb)
    ? `\n--- ${role}/playbook.md (promoted heuristics — confidence bump on agreement, decay on contradiction) ---\n` + readFileSync(pb, "utf8").trim()
    : `\n(no playbook.md yet — once a pattern holds across >=3 outcomes, promote it here so it stops being rediscovered)`);
  const closed = ledger.filter((e) => e.outcome);
  console.log(`\n--- past decisions WITH outcomes (${closed.length}) — what actually happened ---`);
  if (!closed.length) console.log("  (none yet — the loop is empty; record-outcome on resolved decisions to start compounding)");
  closed.slice(-12).forEach((e) => console.log(`  [worked:${e.worked ?? "?"}] ${e.decision_id} — ${e.title}\n      → ${e.outcome}`));
  const open = ledger.filter((e) => !e.outcome);
  if (open.length) console.log(`\n--- ${open.length} awaiting outcome (close with: record-outcome --id <id> --result "...") ---\n` + open.slice(-8).map((e) => `  ${e.decision_id} ${e.title}`).join("\n"));
  process.exit(0);
}

if (cmd === "promote") {
  // WI-436: the heuristic-promotion scan. A pattern that has held across >=3 CONFIRMED (worked:true) outcomes
  // is promotable — surface the candidates (the brain GENERALIZES them into a playbook heuristic; the runtime
  // measures readiness, it does not invent the heuristic). --apply appends a candidate stub to playbook.md.
  const dir = resolveStateDir();
  if (!existsSync(dir)) die(`no state dir: ${dir} (run: scaffold)`);
  const role = opt("--role");
  if (!role || !ROLES.includes(role)) die(`need --role <${ROLES.join("|")}>`);
  const ledger = readJsonl(join(dir, role, "ledger.jsonl"));
  const closed = ledger.filter((e) => e.outcome);
  const worked = closed.filter((e) => e.worked === "true" || e.worked === true);
  console.log(`=== promote-scan for ${role}: ${closed.length} closed outcome(s), ${worked.length} CONFIRMED (worked:true) ===`);
  if (worked.length < 3) { console.log(`  < 3 confirmed outcomes — no promotion candidate yet (a heuristic must hold across >=3).`); process.exit(0); }
  // honest framing (Codex MED): >=3 confirmed wins may be UNRELATED — this only surfaces a REVIEW set; the
  // brain decides if a pattern recurs + writes the heuristic + assigns its own confidence. No auto-confidence.
  console.log(`  REVIEW FOR HEURISTICS: ${worked.length} confirmed (worked:true) outcomes — these may be UNRELATED wins; only promote a heuristic that GENUINELY RECURS across them. The brain reads + writes the heuristic; this scan surfaces readiness, it does not invent the pattern or assign confidence.`);
  worked.slice(-6).forEach((e) => console.log(`  - ${e.decision_id} ${e.title} -> ${e.outcome}`));
  if (argv.includes("--apply")) {
    mkdirSync(join(dir, role), { recursive: true });
    const pb = join(dir, role, "playbook.md");
    const cid = "cand-" + createHash("sha1").update(worked.map((e) => e.decision_id).sort().join("+")).digest("hex").slice(0, 12);   // fixed-length content hash of the full decision set (Codex: no truncation collision)
    const existing = existsSync(pb) ? readFileSync(pb, "utf8") : "";
    if (existing.includes(cid)) { console.log(`  · candidate [${cid}] already in ${role}/playbook.md — idempotent no-op`); }
    else {
      const stub = `\n## Heuristic-review candidate [${cid}] (${ymd()})\nThese ${worked.length} confirmed outcomes are a REVIEW set — if a pattern recurs, write ONE generalized heuristic below (you assign the confidence):\n` + worked.slice(-6).map((e) => `- ${e.decision_id} (${e.title}): ${e.outcome}`).join("\n") + `\n`;
      appendFileSync(pb, stub);
      console.log(`  + appended a heuristic-review candidate [${cid}] to ${role}/playbook.md — write the heuristic if a pattern recurs.`);
    }
  }
  process.exit(0);
}

die(`unknown command '${cmd || ""}'. Use: scaffold | read | append-decision | resolve | resolve-state-dir | open-item | check-item | close-item | briefing | dashboard | register-app | list-apps | validate-apps | record-outcome | recall | promote | grade | score | preflight | rank`);
