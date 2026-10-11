// S: security and data. Deterministic probes against the BUILT artifact, spec-driven.
//
//   export async function grade(dir, task, spec) -> { score, checks: [{ name, pass, detail }] }
//
// The spec (northstar/specs/<task>/S.json) lists what to probe; this file holds no
// task-specific knowledge. The probes are the svc-lens-security / review-security hunt
// list turned into requests and file scans:
//   secrets          key-like strings, committed .env values, literal credentials, secret fallbacks
//   http_noauth      protected routes answer 401/403 (never 2xx) without credentials
//   http_crossuser   another user's credentials, or a client-sent id, cannot reach the first user's data
//   http_injection   XSS reflection, SQL error leakage, command execution, path traversal
//   http_disclosure  source, .env, .git and package files are not served
//   http_errors      malformed input gives no stack trace and does not kill the server
//   migration_scan   destructive data statements carry a guard
//   report_valid / files_unchanged / report_severity   a written security review is well formed,
//                    the reviewed code was left alone, the serious findings are rated serious
//   script           a task-specific probe (exit 0 = pass), optionally satisfied by a matching
//                    finding in SECURITY.json ("reported or fixed")
// A check whose server did not start, or whose module cannot load, FAILS. Nothing passes
// vacuously because nothing was built.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { taskDirFor, check, finish, getPath, jsonOf, loadSpec, readText, request, runScript, specDirOf, startServer, walk } from "./sk-shared.mjs";

export { loadSpec };

// ---------------------------------------------------------------------------------------
// secrets
// ---------------------------------------------------------------------------------------
const KEY_PATTERNS = [
  ["AWS access key id", /\bAKIA[0-9A-Z]{16}\b/],
  ["Stripe-style secret key", /\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}\b/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ["Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["JSON web token", /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  ["URL with embedded credentials", /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/"'`]+:[^\s@/"'`]{3,}@[^\s"'`]+/i],
];
const SECRET_NAME = "(?:secret|passw(?:or)?d|passwd|pwd|api[_-]?key|apikey|private[_-]?key|access[_-]?key|token|hmac|signing[_-]?key|credential)";
const LITERAL = new RegExp(`\\b([A-Za-z_$][\\w$-]*${SECRET_NAME}[\\w$-]*|${SECRET_NAME}[\\w$-]*)["']?\\s*[:=]\\s*(["'\`])([^"'\`\\n]{8,})\\2`, "i");
const FALLBACK = new RegExp(`${SECRET_NAME}[^\\n]{0,80}?(?:\\|\\||\\?\\?)\\s*(["'\`])([^"'\`\\n]{6,})\\1`, "i");
const PLACEHOLDER = /^(?:change.?me|changeme|example|your[\s_-]|<.*>|\$\{|%\w+%|x{3,}|\*{3,}|todo|dummy|placeholder|sample|replace|none$|null$|undefined$|secret$|password$|token$|bearer\s*$)|placeholder|example|your[_-]/i;
const IGNORED_FILES = [/\.md$/i, /\.lock$/i, /package-lock\.json$/, /(^|\/)__hidden\.test\.mjs$/, /(^|\/)visible\.test\.mjs$/, /\.test\.[mc]?[jt]s$/, /(^|\/)spec\.md$/i, /\.(png|jpe?g|gif|ico|woff2?|ttf|pdf|zip|gz|mp4|webm)$/i];
const isEnvFile = (rel) => /(^|\/)\.env(\.[\w-]+)?$/.test(rel) && !/\.(example|sample|template|dist)$/.test(rel);

export function scanSecrets(dir, { allow = [] } = {}) {
  const found = [];
  const allowed = (s) => allow.some((a) => s.includes(a));
  for (const rel of walk(dir, { skipTests: true, skip: IGNORED_FILES })) {
    const text = readText(path.join(dir, rel));
    if (text == null) continue;
    const lines = text.split("\n");
    if (isEnvFile(rel)) {
      lines.forEach((line, i) => {
        const m = /^\s*(?:export\s+)?([A-Za-z_][\w]*)\s*=\s*(.*?)\s*$/.exec(line);
        const v = m && m[2].replace(/^["']|["']$/g, "");
        if (m && v && !PLACEHOLDER.test(v) && !allowed(line)) found.push(`${rel}:${i + 1} committed .env value (${m[1]})`);
      });
      continue;
    }
    lines.forEach((line, i) => {
      if (allowed(line)) return;
      for (const [kind, re] of KEY_PATTERNS) if (re.test(line)) { found.push(`${rel}:${i + 1} ${kind}`); return; }
      const lit = LITERAL.exec(line);
      if (lit && !PLACEHOLDER.test(lit[3]) && !/process\.env|import\.meta\.env/.test(lit[3])) { found.push(`${rel}:${i + 1} literal credential (${lit[1]})`); return; }
      const fb = FALLBACK.exec(line);
      if (fb && !PLACEHOLDER.test(fb[2])) found.push(`${rel}:${i + 1} secret fallback literal`);
    });
  }
  return found;
}

// ---------------------------------------------------------------------------------------
// migration scan
// ---------------------------------------------------------------------------------------
function migrationScan(dir, c) {
  const destructive = (c.destructive || []).map((s) => new RegExp(s, "i"));
  const guards = (c.guards || []).map((s) => new RegExp(s, "i"));
  const files = walk(dir, { skipTests: true, skip: IGNORED_FILES }).filter((f) => !c.files || c.files.some((g) => new RegExp(g).test(f)));
  const unguarded = [];
  for (const rel of files) {
    const text = readText(path.join(dir, rel));
    if (text == null) continue;
    // Guards count only in code: a comment that mentions a backup protects nothing.
    const lines = text.split("\n").map((l) => l.replace(/\/\*.*?\*\//g, "").replace(/(^|\s)\/\/.*$/, "$1").replace(/^\s*(--|#).*$/, ""));
    lines.forEach((line, i) => {
      if (!destructive.some((re) => re.test(line))) return;
      const window = lines.slice(Math.max(0, i - 3), i + 3).join("\n");
      if (!guards.some((re) => re.test(window))) unguarded.push(`${rel}:${i + 1}`);
    });
  }
  return check(c.name || "migration_safety", !unguarded.length, unguarded.length ? `destructive data statement without a guard at ${unguarded.slice(0, 4).join(", ")}` : `${files.length} source files scanned, no unguarded destructive statement`);
}

// ---------------------------------------------------------------------------------------
// security review report
// ---------------------------------------------------------------------------------------
const RANK = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
export function readReport(dir, file = "SECURITY.json") {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    const findings = Array.isArray(j) ? j : Array.isArray(j?.findings) ? j.findings : null;
    return findings ? { findings } : { error: `${file} is not a JSON array of findings` };
  } catch (e) { return { error: e.code === "ENOENT" ? `${file} was not written` : `${file} is not valid JSON` }; }
}
export function matchFinding(findings, m) {
  const words = m.words ? new RegExp(m.words, "i") : null;
  return findings.find((x) => x && String(x.file || "").endsWith(m.file) && Math.abs(Number(x.line) - m.line) <= (m.tol ?? 3) && (!words || words.test(`${x.issue || ""} ${x.title || ""}`)));
}
// The finding's file as a path relative to the build, or null when it is not a plain file
// inside the build (absolute path, "..", or a symlink that leaves it).
function insideBuild(dir, file) {
  if (typeof file !== "string" || !file || file.includes("\0") || path.isAbsolute(file)) return null;
  const abs = path.resolve(dir, file);
  const rel = path.relative(dir, abs);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return null;
  try {
    const real = path.relative(fs.realpathSync(dir), fs.realpathSync(abs));
    if (real.startsWith("..") || path.isAbsolute(real)) return null;
  } catch { return null; }
  return rel.split(path.sep).join("/");
}
// Why a finding is not credible, or null. A finding earns credit only when it points at a
// real line of a real source file of the reviewed project (inside the build, and, when the
// task has a baseline, a file the baseline has), carries a known severity and describes the attack.
function findingProblem(dir, f, c = {}) {
  if (!f || typeof f !== "object") return "is not an object";
  const sev = (c.severities || Object.keys(RANK)).map((s) => s.toUpperCase());
  const rel = insideBuild(dir, f.file);
  if (!rel) return `names a path outside the build: ${String(f.file).slice(0, 60)}`;
  if (c.reviewed?.length && !c.reviewed.some((p) => rel === p || rel.startsWith(p.endsWith("/") ? p : `${p}/`))) return `${rel} is not part of the reviewed code (${c.reviewed.join(", ")})`;
  if (c.baselineDir && !fs.existsSync(path.join(c.baselineDir, rel))) return `${rel} is not a file of the reviewed project`;
  const file = path.join(dir, rel);
  const text = fs.existsSync(file) && fs.statSync(file).isFile() ? readText(file) : null;
  if (text == null) return `names a file that does not exist: ${rel}`;
  if (!Number.isInteger(f.line) || f.line < 1 || f.line > text.split("\n").length) return `line ${f.line} is outside ${rel}`;
  if (!sev.includes(String(f.severity || "").toUpperCase())) return `severity "${f.severity}" is not one of ${sev.join("|")}`;
  if (typeof f.issue !== "string" || !f.issue.trim()) return "is missing the required issue text";
  if (String(f.issue || "").trim().length < (c.min_issue_chars ?? 15)) return "has no real description of the attack";
  return affirmativeProblem(f.issue);
}

// A finding is a claim that something is exploitable. A note that a place was checked and is
// fine ("not vulnerable", "safe", "mitigated", "properly validated", "no issue") is not one,
// whatever keywords it shares with the planted defect, and a statement with no attack or
// impact in it does not describe a defect either. Genuine findings often contain negations
// ("is not properly validated, so an attacker can ..."): a negation inside a statement that
// also states an impact is not a denial, only a whole-statement denial is.
//
// 1. WHOLE_DENIAL: unambiguous, decides the finding on its own, impact or not.
const WHOLE_DENIAL = [
  /\bfalse positive\b/i,
  /\b(?:not|isn'?t|aren'?t|never)\s+(?:\w+\s+){0,2}?(?:vulnerable|exploitable|injectable|affected)\b/i,
  /\b(?:cannot|can'?t|can not)\s+be\s+(?:exploited|abused|bypassed|forged|tampered|injected)\b/i,
  /\b(?:not|never)\s+(?:be\s+)?(?:logged|leaked|exposed|reflected|written to the logs)\b/i,
  /\bno\s+(?:\w+\s+)?(?:issues?|vulnerabilit(?:y|ies)|problems?|risks?|findings?)\s+(?:found|here|identified|detected|present|to report)\b/i,
  /\b(?:there\s+(?:is|are)\s+)?no\s+(?:security\s+)?(?:issues?|vulnerabilit(?:y|ies))\b(?!\s+(?:with|in|on|of|from)\b[^.]*,\s*so\b)/i,
  /\bnot\s+(?:an?\s+)?(?:issue|problem|risk|concern)\b/i,
  /\b(?:nothing\s+(?:to report|wrong|found)|by design|looks good|all good|no action (?:needed|required)|working as intended)\b/i,
];
// 2. SOFT_DENIAL: "it is fine" claims, which only count when not themselves negated
//    ("is not properly validated", "never correctly checked", "without proper escaping").
const SOFT_DENIAL = [
  /\b(?:properly|correctly|safely|securely|adequately|already)\s+(?:validated|handled|escaped|sanitised|sanitized|authenticated|authorised|authorized|verified|signed|checked|parameterised|parameterized|mitigated|protected|enforced)\b/gi,
  /\b(?:is|are|was|were|appears|seems|looks|remains|found|deemed|considered)\s+(?:to be\s+)?(?:\w+\s+and\s+)?(?:safe|secure|fine|ok|okay|mitigated|validated|handled|protected|sanitised|sanitized|sound|correct|adequate)\b/gi,
  /\b(?:parameteri[sz]ed|sanitis?zed|escaped|validated)\b[^.;\n]{0,30}\b(?:and|,)\s*(?:safe|secure)\b/gi,
];
const NEGATION = /\b(?:not|never|no|without|improperly|incorrectly|inadequately|insufficiently|isn'?t|aren'?t|wasn'?t|weren'?t|doesn'?t|don'?t|didn'?t|cannot|can'?t|lacks?|lacking|missing|fails? to|failed to|un(?:validated|checked|verified|saniti[sz]ed|escaped|protected|guarded|handled|safe|secured)|insecure)\b|n't\b/i;
function softDenial(text) {
  for (const re of SOFT_DENIAL) {
    for (const m of text.matchAll(re)) {
      const clause = text.slice(0, m.index).split(/[.;:!?\n]/).pop().split(",").pop();
      const lead = clause.split(/\s+/).slice(-6).join(" ");
      if (!NEGATION.test(lead) && !NEGATION.test(m[0].replace(/^\w+\s+/, "").split(/\s+/).slice(0, 1).join(" "))) return true;
    }
  }
  return false;
}
const IMPACT = /\b(?:attackers?|attack\w*|exploit\w*|forg\w+|bypass\w*|steal\w*|tamper\w*|leak\w*|expos\w+|impersonat\w+|unauthori[sz]ed|arbitrary|inject\w*|escalat\w+|replay\w*|spoof\w*|abus\w+|take ?over|anyone|any (?:user|customer|client|caller|person)|(?:another|other) (?:user|customer|account|person)s?|for free|pay(?:s|ing)? (?:less|nothing|1|a cent|only)|without (?:paying|authenticat\w+|authori[sz]\w+|a valid|any|the signature|a signature|checking)|can (?:be )?(?:read|refund\w*|obtain\w*|trigger\w*|pay|cancel\w*|reuse\w*|access\w*|modif\w+|delet\w+|overwrit\w+|forg\w+|steal\w*|see|view)|allows?|lets?|written to (?:the )?(?:logs?|console|stdout)|crash\w*|denial[- ]of[- ]service|\bdos\b|tak(?:es?|ing) (?:the )?\w*\s?(?:\w+ )?down|\bhang\w*|unhandled (?:exception|error|rejection)s?|\b500s?\b|\bstuck\b|left (?:in|with)\b[^.\n]{0,40}\bstate|never (?:rolled back|reverted|restored|released|cleaned up)|\blost\b|double[- ](?:charg\w+|refund\w*|book\w*|spen\w+|count\w*|pay\w*)|corrupt\w*|inconsisten\w+|\brace\b|\brace condition|overdr\w+|negative balance|(?:secret|signing material|credential|password|token|key|hmac)\b[^.\n]{0,60}\b(?:logs?|logged)|\blogs?\b[^.\n]{0,60}\b(?:secret|signing material|credential|password|token|key|hmac))/i;
const DENIES = "denies a defect (it says the code is safe, mitigated or not vulnerable) instead of describing an exploit";
const NO_IMPACT = "does not state an attack or its impact";
const HEDGED = "is a question or a hedge, not an affirmative statement";
// Only a double hedge ("might possibly", "could maybe") or an admission of not knowing is not a
// claim; a single hedge ("may crash", "could allow") is ordinary phrasing in an honest report.
const HEDGE = /\b(?:might|could|may)\s+(?:possibly|maybe|perhaps)\b|\b(?:maybe|perhaps|possibly)\s+(?:might|could|may)\b|\bnot sure\b|\bunsure\b|\bno idea\b/i;
// A "?" inside code, a URL, a query string, optional chaining or a ternary is not a question.
const stripCode = (t) => t.replace(/`[^`]*`/g, " ").replace(/https?:\/\/\S+/gi, " ").replace(/\S\?[\w=&./%-]\S*/g, " ").replace(/\?\./g, ".").replace(/\s\?\s[^?]*?\s:\s/g, " ");
// A finding is a question when it ends with "?", or when it asks something and no other
// sentence of it states an impact.
function isQuestion(text) {
  const t = stripCode(text).trim();
  if (!t) return false;
  if (t.endsWith("?")) return true;
  const sentences = t.split(/(?<=[.!?])\s+/).filter((x) => x.trim());
  const asked = sentences.some((x) => /\?$/.test(x.trim()));
  return asked && !sentences.some((x) => !/\?$/.test(x.trim()) && hasImpact(x));
}
// An impact counts only when not negated: no negator among the 2 words before it, in its own
// clause. An impact joined to a negated one by or/and/a comma ("no race, never double charges
// or double refunds") is negated with it.
const NEGATOR = /^(?:not|no|never|nor|without|cannot|neither|nothing)$|n't$/i;
const FILLER = /\b(?:subject|vulnerable|susceptible|prone|open|exposed)\s+to\b/gi;
function hasImpact(text) {
  const t = text.replace(FILLER, " ");
  let prev = null;
  for (const m of t.matchAll(new RegExp(IMPACT.source, "gi"))) {
    const clause = t.slice(0, m.index).split(/[;:.!?\n]/).pop();
    const own = clause.split(",").pop();
    const before = own.split(/\s+/).filter((w) => w && !/^(?:or|nor)$/i.test(w)).slice(-2);
    let negated = before.some((w) => NEGATOR.test(w));
    if (!negated && prev && prev.negated && /^[\s,]*(?:(?:or|and|nor)\s*)?$/i.test(t.slice(prev.end, m.index))) negated = true;
    prev = { end: m.index + m[0].length, negated };
    if (!negated) return true;
  }
  return false;
}
const CLAUSE_SPLIT = /\b(?:but|however|although|though|except)\b|;/i;
export function affirmativeProblem(issue) {
  const t = String(issue || "");
  if (WHOLE_DENIAL.some((re) => re.test(t))) return DENIES;
  // "properly mitigated" and friends deny a defect whatever impact words sit beside them, but
  // per clause: a denying clause does not suppress an affirmative exploit clause beside it.
  const clauses = t.split(CLAUSE_SPLIT);
  const denying = clauses.some((c) => softDenial(c));
  if (denying && !clauses.some((c) => !softDenial(c) && hasImpact(c))) return DENIES;
  if (HEDGE.test(t) || isQuestion(t)) return HEDGED;
  if (hasImpact(t)) return null;
  return NO_IMPACT;
}
const credible = (dir, findings, c) => findings.filter((f) => !findingProblem(dir, f, c)).map((f) => ({ ...f, file: insideBuild(dir, f.file) }));
// A report is valid when it is well formed, holds no denial and has at least one credited
// finding. A finding that states no impact (or only hedges) is not credited and does not
// invalidate the report, but a report with nothing credited earns no point, so a vague-only
// report cannot raise a stub's score.
const UNCREDITED_ONLY = new Set([NO_IMPACT, HEDGED, "has no real description of the attack"]);
function reportValid(dir, c) {
  const rep = readReport(dir, c.file);
  if (rep.error) return check(c.name || "report_valid", false, rep.error);
  let credited = 0;
  for (const [i, f] of rep.findings.entries()) {
    const p = findingProblem(dir, f, c);
    if (!p) { credited++; continue; }
    const denial = UNCREDITED_ONLY.has(p) && affirmativeProblem(f.issue) === DENIES;
    if (!UNCREDITED_ONLY.has(p) || denial) return check(c.name || "report_valid", false, `finding ${i + 1} ${denial ? DENIES : p}`);
  }
  if (!credited) return check(c.name || "report_valid", false, "no finding in the report is credible (each needs a real file and line, a severity and a stated attack or impact)");
  return check(c.name || "report_valid", true, `${rep.findings.length} findings, ${credited} credited`);
}
function hashTree(root, rel) {
  const base = path.join(root, rel);
  const files = fs.existsSync(base) ? (fs.statSync(base).isDirectory() ? walk(base, { skipTests: false }).map((f) => path.join(rel, f)) : [rel]) : [];
  return Object.fromEntries(files.map((f) => [f.split(path.sep).join("/"), crypto.createHash("sha256").update(fs.readFileSync(path.join(root, f))).digest("hex")]));
}
const baselineOf = (task, spec) => (path.isAbsolute(spec.baseline || "") ? spec.baseline : path.join(taskDirFor(task), spec.baseline || "repo"));
function filesUnchanged(dir, task, spec, c) {
  const baseline = baselineOf(task, spec);
  const diffs = [];
  for (const p of c.paths || []) {
    const a = hashTree(baseline, p); const b = hashTree(dir, p);
    for (const f of new Set([...Object.keys(a), ...Object.keys(b)])) if (a[f] !== b[f]) diffs.push(`${f} ${a[f] ? (b[f] ? "edited" : "deleted") : "added"}`);
  }
  return check(c.name || "files_unchanged", !diffs.length, diffs.length ? `the reviewed code was changed: ${diffs.slice(0, 4).join(", ")}` : `${(c.paths || []).join(", ")} untouched`);
}
function reportSeverity(dir, c) {
  const rep = readReport(dir, c.file);
  if (rep.error) return check(c.name || "report_severity", false, rep.error);
  const bad = [];
  const real = credible(dir, rep.findings, c);
  for (const m of c.must || []) {
    const f = matchFinding(real, m);
    if (!f) bad.push(`${m.file}:${m.line} not reported`);
    else if ((RANK[String(f.severity).toUpperCase()] || 0) < RANK[m.min]) bad.push(`${m.file}:${m.line} rated ${f.severity}, expected ${m.min} or higher`);
  }
  return check(c.name || "report_severity", !bad.length, bad.length ? bad.join("; ") : "serious findings are rated serious");
}

// ---------------------------------------------------------------------------------------
// http probes
// ---------------------------------------------------------------------------------------
const STATIC_EXT = /\.(css|js|mjs|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|map|json|txt|xml|webmanifest)$/i;
async function discover(srv, cfg = {}) {
  const seen = new Set(); const texts = [];
  const fetchText = async (p) => { const r = await request(srv.base, { path: p, timeoutMs: 3000 }); if (r.status) texts.push(r.text); return r.text || ""; };
  for (const p of cfg.from || ["/"]) {
    const html = await fetchText(p);
    for (const m of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) if (m[1].startsWith("/") && !m[1].startsWith("//")) await fetchText(m[1]);
  }
  for (const t of texts) {
    for (const m of t.matchAll(/(["'`])(\/[A-Za-z0-9_\-./:{}$]*)(?:\?[^"'`]*)?\1/g)) {
      const p = m[2].replace(/\$\{[^}]*\}/g, "1").replace(/:\w+/g, "1").replace(/\{[^}]*\}/g, "1");
      if (p.length > 1 && !p.startsWith("//") && !STATIC_EXT.test(p)) seen.add(p);
    }
  }
  return [...seen].slice(0, cfg.limit || 40);
}

const denied = (r) => r.status === 401 || r.status === 403;
const loginRedirect = (r) => r.status >= 300 && r.status < 400 && /login|sign.?in|auth/i.test(String(r.headers.location || ""));
const emptyBody = (r) => { const j = jsonOf(r); return j == null ? !String(r.text).trim() : Array.isArray(j) ? j.length === 0 : typeof j === "object" ? Object.keys(j).filter((k) => !/^(error|message|ok)$/i.test(k)).length === 0 : false; };

async function httpNoauth(ctx, c) {
  const routes = [...(c.routes || [])];
  if (c.protected_patterns?.length) {
    const re = new RegExp(c.protected_patterns.join("|"), "i");
    for (const p of await ctx.discovered()) if (re.test(p)) for (const method of c.methods || ["POST", "PUT", "PATCH", "DELETE"]) routes.push({ method, path: p, body: {} });
  }
  const bad = []; let absent = 0;
  const home = await request(ctx.srv.base, { path: ctx.srv.ready });
  for (const r of routes) {
    const res = await request(ctx.srv.base, { method: r.method || "GET", path: r.path, body: r.body, headers: r.headers });
    const read = (r.method || "GET") === "GET";
    let ok = denied(res) || loginRedirect(res);
    // A catch-all that answers every path with the home page did not run the action.
    if (!ok && (c.absent_ok ?? !c.strict) && res.status === 200 && home.status === 200 && res.text === home.text) { ok = true; absent++; }
    if (!ok && (c.absent_ok ?? !c.strict) && (res.status === 404 || res.status === 405 || res.status === 501)) { ok = true; absent++; }
    if (!ok && !c.strict && res.status >= 400 && res.status < 500) ok = true;
    if (!ok && read && r.leak_if_nonempty && res.status >= 200 && res.status < 300 && emptyBody(res)) ok = true;
    if (!ok) bad.push(`${r.method || "GET"} ${r.path} answered ${res.status || res.error} without credentials`);
  }
  if (!ctx.srv.alive()) bad.push("the server died");
  return check(c.name || "authz_no_credentials", !bad.length, bad.length ? bad.slice(0, 4).join("; ") : `${routes.length} protected routes refused anonymous access (${absent} not present)`);
}

async function login(base, u) {
  if (!u?.login) return { headers: u?.headers || {} };
  const r = await request(base, { method: u.login.method || "POST", path: u.login.path, body: u.login.body, headers: u.login.headers });
  const headers = { ...(u.headers || {}) };
  const cookie = [].concat(r.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");
  if (u.login.cookie && cookie) headers.cookie = cookie;
  if (u.login.token_path) {
    const t = getPath(jsonOf(r), u.login.token_path);
    if (t == null) return { error: `login as ${u.login.body ? JSON.stringify(u.login.body) : "user"} gave no ${u.login.token_path} (status ${r.status})` };
    headers[u.login.header || "authorization"] = `${u.login.prefix ?? "Bearer "}${t}`;
  }
  return { headers };
}
const fill = (v, ids) => (typeof v === "string" ? v.replace(/\{(\w+)\}/g, (_, k) => ids[k] ?? "") : Array.isArray(v) ? v.map((x) => fill(x, ids)) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x, ids)])) : v);

async function httpCrossuser(ctx, c) {
  const users = { none: { headers: {} } };
  for (const [k, u] of Object.entries(c.users || {})) { users[k] = await login(ctx.srv.base, u); if (users[k].error) return check(c.name || "authz_cross_user", false, users[k].error); }
  const bad = []; let attacks = 0;
  for (const flow of c.flows || []) {
    const ids = {};
    const cr = flow.create;
    const res = await request(ctx.srv.base, { method: cr.method || "POST", path: cr.path, body: cr.body, headers: users[cr.as].headers });
    if (res.status < 200 || res.status >= 300) { bad.push(`could not create the first user's data (${cr.method || "POST"} ${cr.path} answered ${res.status || res.error})`); continue; }
    for (const [k, p] of Object.entries(cr.capture || {})) ids[k] = String(getPath(jsonOf(res), p) ?? "");
    if (flow.control) {
      const ctl = await request(ctx.srv.base, { method: flow.control.method || "GET", path: fill(flow.control.path, ids), body: fill(flow.control.body, ids), headers: users[flow.control.as].headers });
      if (ctl.status < 200 || ctl.status >= 300) bad.push(`the owner cannot reach their own data (${ctl.status}), so a refusal proves nothing`);
    }
    for (const a of flow.attack || []) {
      attacks++;
      const r = await request(ctx.srv.base, { method: a.method || "GET", path: fill(a.path, ids), body: fill(a.body, ids), headers: users[a.as].headers });
      const allowed = a.expect || flow.expect || [401, 403, 404];
      if (!allowed.includes(r.status)) bad.push(`${a.as} ${a.method || "GET"} ${fill(a.path, ids)} answered ${r.status || r.error}, expected ${allowed.join("/")}`);
    }
  }
  return check(c.name || "authz_cross_user", !bad.length && attacks > 0, bad.length ? bad.slice(0, 4).join("; ") : `${attacks} cross-user and anonymous attempts refused`);
}

const PAYLOADS = {
  xss: ["<script>alert(7331)</script>", "\"><img src=x onerror=alert(7331)>", "'\"><svg onload=alert(7331)>"],
  sqli: ["' OR '1'='1", "1; DROP TABLE users;--", "\" OR \"\"=\"", "1' UNION SELECT NULL--"],
  cmd: [";touch CANARY", "$(touch CANARY)", "`touch CANARY`", "|touch CANARY", "&& touch CANARY"],
  traversal: ["../../../../../../etc/passwd", "..%2f..%2f..%2f..%2f..%2fetc%2fpasswd", "/etc/passwd", "....//....//....//etc/passwd"],
};
const RAW_TRAVERSAL = ["/../../../../../../etc/passwd", "/..%2f..%2f..%2f..%2f..%2fetc%2fpasswd", "/%2e%2e/%2e%2e/%2e%2e/etc/passwd", "/..%5c..%5c..%5cetc%5cpasswd", "/static/../../../../etc/passwd", "/....//....//....//etc/passwd", "/%2e%2e%2f%2e%2e%2fserver.mjs", "/../server.mjs"];
const SQL_ERROR = /SQLITE_|sqlite3?:|syntax error|unrecognized token|SQLSTATE|ORA-\d{5}|mysql_|unterminated quoted string|near ".*": syntax/i;
const STACK = /\n\s+at\s+\S+.*:\d+:\d+|node:internal|\bat Object\.<anonymous>|\/(?:home|Users|tmp|var|app|usr)\/\S+\.(?:m?js|ts):\d+/;

async function targetsOf(ctx, c) {
  const out = [];
  for (const t of c.targets || []) {
    if (t.from === "discovered") for (const p of await ctx.discovered()) out.push({ ...t, path: p, from: undefined });
    else out.push(t);
  }
  return out;
}
const send = (ctx, t, value) => {
  const params = [].concat(t.param ?? []);
  const method = t.method || "GET";
  let p = t.path.replace("__PAYLOAD__", encodeURIComponent(value));
  if (t.where === "rawpath") return request(ctx.srv.base, { method, path: value });
  if (t.where === "path") return request(ctx.srv.base, { method, path: t.path.includes("__PAYLOAD__") ? p : `${t.path.replace(/\/$/, "")}/${encodeURIComponent(value)}` });
  if (t.where === "body") return request(ctx.srv.base, { method, path: p, body: Object.fromEntries(params.map((k) => [k, value])) });
  return request(ctx.srv.base, { method, path: `${p}${p.includes("?") ? "&" : "?"}${params.map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(value)}`).join("&")}` });
};

async function httpInjection(ctx, c) {
  const cls = c.class;
  const name = c.name || `injection_${cls}`;
  const targets = await targetsOf(ctx, c);
  if (!PAYLOADS[cls]) return check(name, false, `unknown injection class ${cls}`);
  const bad = []; let sent = 0;
  const marker = c.source_markers?.length ? new RegExp(c.source_markers.join("|")) : null;
  for (const t of targets) {
    const payloads = t.where === "rawpath" ? c.payloads || RAW_TRAVERSAL : c.payloads || PAYLOADS[cls];
    for (const raw of payloads) {
      const canary = cls === "cmd" ? path.join(os.tmpdir(), `sk-canary-${crypto.randomBytes(6).toString("hex")}`) : null;
      const value = canary ? raw.replaceAll("CANARY", canary) : raw;
      const r = await send(ctx, t, value);
      sent++;
      const at = `${t.method || "GET"} ${t.where === "rawpath" ? value : t.path}${t.param ? ` ${[].concat(t.param).join(",")}` : ""}`;
      const ct = String(r.headers["content-type"] || "");
      if (cls === "xss" && (/html/i.test(ct) || !ct) && r.text.includes(raw)) bad.push(`${at} reflects ${raw.slice(0, 24)} unescaped in ${ct || "an untyped"} response`);
      if (cls === "sqli" && (r.status >= 500 || SQL_ERROR.test(r.text))) bad.push(`${at} with ${raw.slice(0, 18)} gave ${r.status >= 500 ? r.status : "an SQL error message"}`);
      if (cls === "cmd" && fs.existsSync(canary)) { bad.push(`${at} ran a shell command from input`); fs.rmSync(canary, { force: true }); }
      if (cls === "traversal" && r.status >= 200 && r.status < 300 && (/root:[x*!]?:0:0:/.test(r.text) || (marker && marker.test(r.text)))) bad.push(`${at} served a file outside the public directory`);
    }
  }
  const stillUp = ctx.srv.alive() && (await request(ctx.srv.base, { path: ctx.srv.ready, timeoutMs: 3000 })).status > 0;
  if (!stillUp) bad.push("the server stopped answering after these inputs");
  return check(name, !bad.length && sent > 0, bad.length ? [...new Set(bad)].slice(0, 4).join("; ") : `${sent} ${cls} inputs handled safely`);
}

const DATA_FILE = /\.(json|jsonl|ndjson|csv|tsv|txt|log|db|sqlite3?|ya?ml|ini|conf|bak|sql|dump)$/i;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;
const PHONE = /(?:\+\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]\d{3,4}[\s.-]\d{3,4}\b/;
const TOKEN = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}|\b[sr]k_(?:live|test)_[A-Za-z0-9]{12,}|\b[0-9a-f]{40,}\b|"(?:token|session|sessionId|accessToken|apiKey|secret|password|passwordHash|hash|salt)"\s*:\s*"[^"]{12,}"/;
function luhn(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) { let d = Number(digits[digits.length - 1 - i]); if (i % 2) { d *= 2; if (d > 9) d -= 9; } sum += d; }
  return sum % 10 === 0;
}
const hasCard = (t) => [...t.matchAll(/\b(?:\d[ -]?){13,19}\b/g)].some((m) => { const d = m[0].replace(/\D/g, ""); return d.length >= 13 && d.length <= 19 && luhn(d); });
// What a served file leaks: the probe user's own canaries (any file), or personal data and
// tokens (files that are data, not pages).
function sensitiveIn(rel, text, canaries) {
  const hits = [];
  for (const [kind, v] of Object.entries(canaries || {})) if (v && text.includes(v)) hits.push(`the test ${kind}`);
  if (DATA_FILE.test(rel)) {
    if (EMAIL.test(text)) hits.push("email addresses");
    if (PHONE.test(text)) hits.push("phone numbers");
    if (hasCard(text)) hits.push("card-like numbers");
    if (TOKEN.test(text)) hits.push("tokens or credentials");
  }
  if (/createServer|node:http|require\(["']http["']\)/.test(text) && /\.(m?js|ts)$/i.test(rel)) hits.push("server source");
  return hits;
}
async function httpDisclosure(ctx, c) {
  const home = await request(ctx.srv.base, { path: ctx.srv.ready });
  const markers = new RegExp((c.markers || ["createServer", "^import .* from", "require\\(", "\\[core\\]", "^[A-Z][A-Z0-9_]*=.+"]).join("|"), "m");
  const bad = [];
  for (const p of c.paths || []) {
    const r = await request(ctx.srv.base, { path: p });
    if (r.status >= 200 && r.status < 300 && r.text !== home.text && markers.test(r.text)) bad.push(`${p} is served`);
  }
  // Every file of the build, requested by its own path and by its path inside a public folder.
  let scanned = 0;
  if (c.scan_served) {
    for (const rel of walk(ctx.dir, { skipTests: false, skip: [/(^|\/)__hidden\.test\.mjs$/, /(^|\/)spec\.md$/] })) {
      const text = readText(path.join(ctx.dir, rel));
      if (text == null || !text.trim()) continue;
      const urls = new Set([`/${rel}`]);
      const parts = rel.split("/");
      if (parts.length > 1 && /^(public|static|dist|www|web|assets|client|site)$/i.test(parts[0])) urls.add(`/${parts.slice(1).join("/")}`);
      for (const u of urls) {
        const r = await request(ctx.srv.base, { path: u.split("/").map(encodeURIComponent).join("/") });
        scanned++;
        if (r.status < 200 || r.status >= 300 || r.text === home.text) continue;
        const hits = sensitiveIn(rel, r.text, ctx.canaries);
        if (hits.length) bad.push(`${u} is served and contains ${hits.join(", ")}`);
      }
    }
  }
  return check(c.name || "no_source_disclosure", !bad.length, bad.length ? bad.slice(0, 4).join("; ") : `${(c.paths || []).length} sensitive paths and ${scanned} served-file candidates leak nothing`);
}

// ---- functional controls: a gate that exists, data that is served, a session that works ----
async function httpGateExists(ctx, c) {
  const routes = [...(c.routes || [])].filter((r) => (r.method || "GET") !== "GET");
  if (c.protected_patterns?.length) {
    const re = new RegExp(c.protected_patterns.join("|"), "i");
    for (const p of await ctx.discovered()) if (re.test(p)) for (const method of ["POST", "PUT", "PATCH", "DELETE"]) routes.push({ method, path: p, body: {} });
  }
  const gates = [];
  for (const r of routes) {
    const res = await request(ctx.srv.base, { method: r.method, path: r.path, body: r.body, headers: r.headers });
    if (denied(res) || loginRedirect(res)) gates.push(`${r.method} ${r.path} ${res.status}`);
  }
  const need = c.min ?? 1;
  return check(c.name || "protected_route_exists", gates.length >= need, gates.length >= need ? `${gates.length} write routes refuse anonymous callers (${gates.slice(0, 2).join(", ")})` : `none of ${routes.length} owner routes answered 401/403 without credentials: an absent or open gate is not a control`);
}

async function httpDataServed(ctx, c) {
  const paths = [...(c.paths || []), ...(c.discover ? await ctx.discovered() : [])];
  for (const p of paths) {
    const r = await request(ctx.srv.base, { path: p });
    const j = r.status >= 200 && r.status < 300 ? jsonOf(r) : undefined;
    const list = Array.isArray(j) ? j : j && typeof j === "object" ? Object.values(j).find(Array.isArray) : null;
    if (list?.length && list.some((x) => x && typeof x === "object" && Object.keys(x).length >= (c.min_fields ?? 2))) { ctx.schedule = { path: p, list }; return check(c.name || "data_served", true, `GET ${p} returns ${list.length} records`); }
  }
  return check(c.name || "data_served", false, `none of ${paths.length} candidate paths returned a JSON list of records`);
}

const TOKEN_KEYS = ["token", "accessToken", "access_token", "jwt", "sessionId", "session_id", "sid", "sessionToken"];
function tokenFrom(j) {
  if (!j || typeof j !== "object") return null;
  for (const k of TOKEN_KEYS) if (typeof j[k] === "string" && j[k].length > 8) return j[k];
  for (const k of ["data", "session", "user", "auth"]) { const t = tokenFrom(j[k]); if (t) return t; }
  return null;
}
const fillBody = (b, vars) => JSON.parse(JSON.stringify(b).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? "").replace(/"/g, "")));
const sessionHeaders = (res) => {
  const h = {};
  const cookie = [].concat(res.headers["set-cookie"] || []).map((x) => x.split(";")[0]).join("; ");
  if (cookie) h.cookie = cookie;
  const t = tokenFrom(jsonOf(res));
  if (t) h.authorization = `Bearer ${t}`;
  return { headers: h, token: t };
};

// Registers a probe customer through any of the usual routes, signs in, and proves the
// session is a real control: an account route is 2xx with the session and refused without
// it, and the owner's write routes still refuse that customer session.
async function httpSession(ctx, c) {
  const vars = { ...ctx.account.vars };
  let headers = null; let regVia = null; let loginVia = null;
  const tryAll = async (list, bodies) => {
    for (const p of list || []) for (const b of bodies || []) {
      const body = fillBody(b, vars);
      const res = await request(ctx.srv.base, { method: "POST", path: p, body });
      if (res.status >= 200 && res.status < 300) return { res, via: p, body };
    }
    return null;
  };
  const reg = await tryAll(c.register, c.register_bodies);
  if (reg) { regVia = reg.via; const s = sessionHeaders(reg.res); if (Object.keys(s.headers).length) headers = s; }
  const login = await tryAll(c.login, c.login_bodies);
  if (login) { loginVia = login.via; ctx.account.login = { path: login.via, body: login.body }; const s = sessionHeaders(login.res); if (Object.keys(s.headers).length) headers = s; }
  if (!headers) return check(c.name || "session_works", false, `could not register and sign in a customer (register ${regVia || "refused everywhere"}, login ${loginVia || "refused everywhere"}); no session means no control to verify`);
  ctx.account.headers = headers.headers; ctx.account.token = headers.token;
  if (headers.token) ctx.canaries.token = headers.token;
  const me = [];
  for (const p of c.me || []) {
    const authed = await request(ctx.srv.base, { path: p, headers: headers.headers });
    if (authed.status < 200 || authed.status >= 300) continue;
    const anon = await request(ctx.srv.base, { path: p });
    if (denied(anon) || loginRedirect(anon)) { me.push(p); if (!ctx.account.identity && authed.text.includes(vars.email)) ctx.account.identity = p; }
  }
  if (login) {
    const wrong = { ...login.body, ...Object.fromEntries(Object.keys(login.body).filter((k) => /pass/i.test(k)).map((k) => [k, `wrong-${vars.password}`])) };
    const w = await request(ctx.srv.base, { method: "POST", path: login.via, body: wrong });
    if (w.status >= 200 && w.status < 300) return check(c.name || "session_works", false, `${login.via} signs in with a wrong password (answered ${w.status}): the login does not check credentials`);
  }
  if (!me.length) return check(c.name || "session_works", false, `signed in, but no account route (${(c.me || []).slice(0, 4).join(", ")}...) is 2xx with the session and 401/403 without it`);
  ctx.account.me = me[0];
  ctx.account.mode = "account";
  const bad = [];
  for (const r of c.owner_routes || []) {
    const res = await request(ctx.srv.base, { method: r.method, path: r.path, body: r.body, headers: headers.headers });
    if (res.status >= 200 && res.status < 300 && !(res.text === (await request(ctx.srv.base, { path: ctx.srv.ready })).text)) bad.push(`${r.method} ${r.path} answered ${res.status} to a customer session`);
  }
  return check(c.name || "session_works", !bad.length, bad.length ? bad.slice(0, 3).join("; ") : `customer registered via ${regVia || "login"}, signed in via ${loginVia}, ${ctx.account.me} is session-gated, owner routes refuse the customer`);
}

const uniq = () => crypto.randomBytes(4).toString("hex");
const listHas = async (ctx, paths, needle) => {
  for (const p of paths) { const r = await request(ctx.srv.base, { path: p, headers: ctx.owner?.headers }); if (r.status >= 200 && r.status < 300 && r.text.includes(needle)) return p; }
  return null;
};

// The owner can change the schedule, and only the owner. With the owner credentials the
// probe supplies (env variables the spec sets, then common defaults), an authenticated
// request must create a class that then shows in the schedule; the same request without
// credentials must be refused; the login must reject a wrong password.
async function httpOwnerAction(ctx, c) {
  const o = c.owner || {};
  const vars = { ...(o.vars || {}), rnd: uniq() };
  const name = `Probe Class ${vars.rnd}`;
  const sessions = [];
  const logins = [];
  for (const t of o.tokens || []) sessions.push({ headers: { [t.header]: `${t.prefix ?? ""}${vars.owner_token}` }, via: `${t.header} header` });
  for (const p of o.login || []) for (const b of [...(o.bodies || []), ...(o.default_bodies || [])]) {
    const body = fillBody(b, vars);
    const res = await request(ctx.srv.base, { method: "POST", path: p, body });
    if (res.status >= 200 && res.status < 300) { const sh = sessionHeaders(res); if (Object.keys(sh.headers).length) { sessions.push({ headers: sh.headers, via: `login ${p}` }); logins.push({ path: p, body }); } }
  }
  if (logins.length) {
    const wrong = { ...logins[0].body, ...Object.fromEntries(Object.keys(logins[0].body).filter((k) => /pass/i.test(k)).map((k) => [k, `wrong-${uniq()}`])) };
    const w = await request(ctx.srv.base, { method: "POST", path: logins[0].path, body: wrong });
    if (w.status >= 200 && w.status < 300) return check(c.name || "owner_action_works", false, `${logins[0].path} accepts a wrong password (answered ${w.status}): the owner login does not check credentials`);
  }
  const listPaths = [...(c.list || []), ...(ctx.schedule ? [ctx.schedule.path] : [])];
  const tried = [];
  for (const route of c.create || []) {
    const body = (extra = "") => fillBody(route.body, { ...vars, name: `${name}${extra}`, starts: "2031-02-03T09:00:00Z" });
    const method = route.method || "POST";
    const anon = await request(ctx.srv.base, { method, path: route.path, body: body("-anon") });
    if (anon.status >= 200 && anon.status < 300 && anon.text !== (await request(ctx.srv.base, { path: ctx.srv.ready })).text) {
      if (await listHas({ ...ctx, owner: null }, listPaths, `${name}-anon`)) return check(c.name || "owner_action_works", false, `${method} ${route.path} changed the schedule for an anonymous caller`);
    }
    for (const sess of sessions) {
      const res = await request(ctx.srv.base, { method, path: route.path, body: body(), headers: sess.headers });
      tried.push(`${method} ${route.path} via ${sess.via}: ${res.status || res.error}`);
      if (res.status < 200 || res.status >= 300) continue;
      const seen = await listHas({ ...ctx, owner: { headers: sess.headers } }, listPaths, name);
      if (!seen) continue;
      const again = await request(ctx.srv.base, { method, path: route.path, body: body("-again") });
      if (!(denied(again) || loginRedirect(again))) return check(c.name || "owner_action_works", false, `the owner action works with credentials but ${method} ${route.path} answered ${again.status} without them: it is not refused`);
      ctx.owner = { headers: sess.headers, login: logins[0], listPath: seen, name, via: sess.via };
      return check(c.name || "owner_action_works", true, `${method} ${route.path} via ${sess.via} added "${name}" to ${seen}; refused (${again.status}) without credentials; wrong password rejected`);
    }
  }
  return check(c.name || "owner_action_works", false, `no authenticated owner action changed the schedule (${sessions.length} owner sessions found: ${sessions.map((x) => x.via).join(", ") || "none"}; ${tried.slice(0, 3).join("; ") || "no create route answered"}). The owner login must work with the OWNER_/ADMIN_ environment variables the probe sets or a documented default.`);
}

// A visitor can book. Either the build has customer accounts (register, sign in, a session
// that gates an account route and rejects wrong passwords), or it supports guest checkout:
// a booking with no account, after which an anonymous caller can neither read nor alter
// anyone's booking (two guests are booked so there is someone else's data to find).
async function httpBuyer(ctx, c) {
  const acct = await httpSession(ctx, c);
  if (acct.pass) return { ...acct, name: c.name || "buyer_flow_works" };
  const g = await guestFlow(ctx, c.guest || {});
  const name = c.name || "buyer_flow_works";
  return check(name, g.pass, g.pass ? g.detail : `no account flow (${acct.detail}); no guest flow (${g.detail})`);
}
const idFrom = (j) => { const x = j?.booking || j?.data || j; for (const k of ["id", "_id", "bookingId", "booking_id", "reference", "ref", "code"]) if (x && (typeof x[k] === "string" || typeof x[k] === "number")) return String(x[k]); return null; };
async function guestFlow(ctx, g) {
  const rec = ctx.schedule?.list?.find((x) => x && typeof x === "object");
  const classId = rec && ["id", "_id", "classId", "slug", "uuid"].map((k) => rec[k]).find((v) => v !== undefined);
  if (classId === undefined) return { pass: false, detail: "no schedule record has an id to book" };
  const homeText = (await request(ctx.srv.base, { path: ctx.srv.ready })).text;
  const scheduleText = async () => (await request(ctx.srv.base, { path: ctx.schedule.path })).text;
  const before = await scheduleText();
  const people = [0, 1].map((i) => ({ classId, name: `Guest ${i} ${ctx.account.vars.username}`, email: i ? ctx.account.vars.email.replace("probe-", "probe2-") : ctx.account.vars.email, phone: i ? "+1 202 555 0199" : ctx.account.vars.phone }));
  const made = [];
  for (const who of people) {
    let ok = null; let sawOk = false;
    for (const p of g.create || []) { for (const b of g.bodies || []) {
      const res = await request(ctx.srv.base, { method: "POST", path: p, body: fillBody(b, who) });
      if (res.status >= 200 && res.status < 300 && res.text !== homeText) {
        sawOk = true;
        const id = idFrom(jsonOf(res));
        if (id) { ok = { who, id, path: p, token: tokenFrom(jsonOf(res)) }; break; }
      }
    } if (ok) break; }
    if (!ok) return { pass: false, detail: sawOk ? "a booking request was accepted but no booking identifier came back (a bare {ok:true} is not a booking): nothing can be retrieved, so nothing can be shown to be protected" : `a booking without an account was refused or unavailable on ${(g.create || []).slice(0, 4).join(", ")}...` };
    made.push(ok);
  }
  const ids = made.map((m) => m.id);
  if (new Set(ids).size !== ids.length) return { pass: false, detail: `two different guests were given the same booking identifier (${ids[0]})` };
  const [a, b2] = made;
  const mentions = (t, m) => t.includes(m.id) || t.includes(m.who.email);
  // The bookings must exist: visible to the owner, or reflected in the schedule.
  let seenAt = null;
  if (ctx.owner?.headers) {
    for (const tpl of g.read || []) {
      const pth = tpl.replace("{id}", encodeURIComponent(a.id)).replace("{email}", encodeURIComponent(a.who.email));
      const r = await request(ctx.srv.base, { path: pth, headers: ctx.owner.headers });
      if (r.status >= 200 && r.status < 300 && made.every((m) => mentions(r.text, m)) ) { seenAt = pth; break; }
      if (r.status >= 200 && r.status < 300 && mentions(r.text, a) && tpl.includes("{id}")) { seenAt = pth; }
    }
  }
  const after = await scheduleText();
  const inSchedule = after !== before;
  if (!seenAt && !inSchedule) return { pass: false, detail: `two bookings were accepted (${ids.join(", ")}) but neither the owner's views nor the schedule show them: no booking was recorded` };
  const bad = [];
  const leaks = (t) => made.some((m) => t.includes(m.who.email) || t.includes(m.who.phone));
  for (const tpl of g.read || []) {
    for (const id of ids) {
      const pth = tpl.replace("{id}", encodeURIComponent(id)).replace("{email}", encodeURIComponent(a.who.email));
      const r = await request(ctx.srv.base, { path: pth });
      if (r.status >= 200 && r.status < 300 && leaks(r.text)) bad.push(`GET ${pth} shows other guests' details`);
    }
  }
  for (const alt of g.alter || []) {
    for (const id of ids) {
      const pth = alt.path.replace("{id}", encodeURIComponent(id));
      const r = await request(ctx.srv.base, { method: alt.method, path: pth, body: alt.body });
      if (r.status >= 200 && r.status < 300 && r.text !== homeText) bad.push(`${alt.method} ${pth} changed a booking with no credentials (${r.status})`);
    }
  }
  ctx.account.mode = "guest";
  ctx.guest = { ids, emails: made.map((m) => m.who.email), ownerPath: seenAt, scheduleAfter: after, scheduleChanged: inSchedule };
  ctx.canaries.email2 = b2.who.email;
  return { pass: !bad.length, detail: bad.length ? [...new Set(bad)].slice(0, 3).join("; ") : `two guests booked without accounts (${a.path}, ids ${ids.join(", ")}), recorded (${seenAt ? "owner view" : "schedule"}); anonymous reads show nothing of theirs and anonymous changes are refused` };
}

// Data written before a restart is still there after it, on a freshly started server (the
// second run of whatever initialisation the build has): the owner can sign in again and
// still rejects a wrong password, the class the owner added is still in the schedule, and
// (with accounts) the probe customer signs in again and the account route returns that
// customer's own identity, not a placeholder.
async function httpRestart(ctx, c) {
  const nm = c.name || "restart_keeps_data";
  if (!ctx.owner) return check(nm, false, "no owner action was verified, so there is no seeded data to survive a restart");
  await ctx.srv.stopGracefully();
  const next = await ctx.restart();
  if (!next.ok) return check(nm, false, `the server did not start a second time on the same data: ${next.error}`);
  const owner = { ...ctx.owner };
  if (owner.login) {
    const res = await request(next.base, { method: "POST", path: owner.login.path, body: owner.login.body });
    if (res.status < 200 || res.status >= 300) return check(nm, false, `the owner cannot sign in after the restart (${res.status || res.error})`);
    owner.headers = sessionHeaders(res).headers;
    const wrong = { ...owner.login.body, ...Object.fromEntries(Object.keys(owner.login.body).filter((k) => /pass/i.test(k)).map((k) => [k, `wrong-${uniq()}`])) };
    const w = await request(next.base, { method: "POST", path: owner.login.path, body: wrong });
    if (w.status >= 200 && w.status < 300) return check(nm, false, "after the restart the login accepts a wrong password");
  }
  const sched = await request(next.base, { path: owner.listPath, headers: owner.headers });
  if (!(sched.status >= 200 && sched.status < 300 && sched.text.includes(owner.name))) return check(nm, false, `the class the owner added ("${owner.name}") is gone from ${owner.listPath} after the restart`);
  if (ctx.account.mode === "guest" && ctx.guest) {
    const gone = [];
    if (ctx.guest.ownerPath) {
      const r = await request(next.base, { path: ctx.guest.ownerPath, headers: owner.headers });
      if (!(r.status >= 200 && r.status < 300 && [...ctx.guest.ids, ...ctx.guest.emails].some((x) => r.text.includes(x)))) gone.push(`${ctx.guest.ownerPath} no longer shows the guest bookings`);
    } else {
      const r = await request(next.base, { path: ctx.schedule.path });
      if (r.text !== ctx.guest.scheduleAfter) gone.push("the schedule no longer reflects the guest bookings");
    }
    if (gone.length) return check(nm, false, `the guest bookings did not survive the restart: ${gone.join("; ")}`);
  }
  if (ctx.account.mode === "account") {
    if (!ctx.account.identity) return check(nm, false, "no account route returns the probe customer's identity, so persistence of the account cannot be read back");
    const res = await request(next.base, { method: "POST", path: ctx.account.login.path, body: ctx.account.login.body });
    if (res.status < 200 || res.status >= 300) return check(nm, false, `the customer account created before the restart cannot sign in after it (login answered ${res.status || res.error})`);
    const me = await request(next.base, { path: ctx.account.identity, headers: sessionHeaders(res).headers });
    if (!(me.status >= 200 && me.status < 300 && me.text.includes(ctx.account.vars.email))) return check(nm, false, `signed in again but ${ctx.account.identity} does not return the probe customer's email (answered ${me.status})`);
  }
  return check(nm, true, `the owner login and the owner's class survived a second start${ctx.account.mode === "account" ? "; the customer account signed in again and its identity was read back" : "; the guest bookings are still there"}`);
}

async function httpErrors(ctx, c) {
  const bad = [];
  const probes = [...(c.routes || []), { method: "GET", path: "/%" }, { method: "GET", path: "/%E0%A4%A" }];
  for (const r of probes) {
    const res = await request(ctx.srv.base, { method: r.method || "POST", path: r.path, body: r.body_raw ?? r.body, headers: r.headers });
    if (STACK.test(res.text)) bad.push(`${r.method || "POST"} ${r.path} leaks a stack trace`);
  }
  const up = ctx.srv.alive() && (await request(ctx.srv.base, { path: ctx.srv.ready, timeoutMs: 3000 })).status > 0;
  if (!up) bad.push("malformed input killed the server");
  return check(c.name || "errors_do_not_leak", !bad.length, bad.length ? bad.slice(0, 4).join("; ") : `${probes.length} malformed requests handled without a stack trace`);
}

// ---------------------------------------------------------------------------------------
// grade
// ---------------------------------------------------------------------------------------
const SERVER_TYPES = new Set(["server_starts", "http_noauth", "http_crossuser", "http_injection", "http_disclosure", "http_errors", "http_gate_exists", "http_data_served", "http_session", "http_restart", "http_owner_action", "http_buyer"]);

export async function grade(dir, task, spec) {
  spec ??= loadSpec(task, "S");
  const specDir = specDirOf(task, spec);
  const checks = [];
  if (spec.secrets !== false) {
    const found = scanSecrets(dir, spec.secrets || {});
    checks.push(check("secrets", !found.length, found.length ? `${found.length} committed secrets: ${found.slice(0, 3).join("; ")}` : "no committed secrets or literal credentials"));
  }
  let srv = null; let started = false; let discovered = null;
  const rnd = crypto.randomBytes(4).toString("hex");
  const ctx = {
    dir,
    get srv() { return srv; },
    discovered: async () => (discovered ??= await discover(srv, spec.discover)),
    // The probe customer. Its email, phone and session token are canaries: if a served file
    // contains one, the build leaks the customer data it was given.
    account: { vars: { email: `probe-${rnd}@example.test`, username: `probe${rnd}`, password: `Pr0be-${rnd}-Pass`, name: "Probe Customer", phone: `+1 202 555 01${rnd.slice(0, 2).replace(/\D/g, "7")}` } },
    canaries: {},
    restart: async () => { srv = await startServer(dir, spec.server, specDir); return srv; },
  };
  ctx.canaries.email = ctx.account.vars.email;
  ctx.canaries.phone = ctx.account.vars.phone;
  const failed = new Set();
  try {
    for (const c of spec.checks || []) {
      const label = c.name || c.type;
      // A probe that finds nothing because nothing functional was built is not a pass: it
      // is credited only when the named controls were verified first.
      const unmet = (c.requires || []).filter((n) => failed.has(n) || !checks.some((x) => x.name === n));
      if (unmet.length) { checks.push(check(label, false, `not credited: nothing verified to probe (${unmet.join(", ")} failed)`)); failed.add(label); continue; }
      const before = checks.length;
      await runOne(c, label);
      if (checks.slice(before).some((x) => !x.pass)) failed.add(label);
    }
  } finally { srv?.stop?.(); }
  return finish(checks);

  function withBaseline(c) { return { ...c, reviewed: spec.reviewed, baselineDir: spec.reviewed ? baselineOf(task, spec) : undefined }; }
  async function runOne(c, label) {
    {
      if (SERVER_TYPES.has(c.type)) {
        if (!started) { srv = await startServer(dir, spec.server, specDir); started = true; }
        if (!srv.ok) { checks.push(check(label, false, srv.error)); return; }
        if (c.type === "server_starts") { checks.push(check(label, true, `answered on port ${srv.port}`)); return; }
        const fn = { http_noauth: httpNoauth, http_crossuser: httpCrossuser, http_injection: httpInjection, http_disclosure: httpDisclosure, http_errors: httpErrors, http_gate_exists: httpGateExists, http_data_served: httpDataServed, http_session: httpSession, http_restart: httpRestart, http_owner_action: httpOwnerAction, http_buyer: httpBuyer }[c.type];
        try { checks.push(await fn(ctx, c)); } catch (e) { checks.push(check(label, false, `probe error: ${e.message}`)); }
      } else if (c.type === "migration_scan") checks.push(migrationScan(dir, c));
      else if (c.type === "report_valid") checks.push(reportValid(dir, withBaseline(c)));
      else if (c.type === "files_unchanged") checks.push(filesUnchanged(dir, task, spec, c));
      else if (c.type === "report_severity") checks.push(reportSeverity(dir, withBaseline(c)));
      else if (c.type === "script") {
        const rep = c.or_reported ? readReport(dir, c.report_file) : null;
        const hit = rep?.findings && matchFinding(credible(dir, rep.findings, withBaseline(c)), c.or_reported);
        if (hit) checks.push(check(label, true, `reported at ${hit.file}:${hit.line}`));
        else { const r = runScript(c.file, dir, { specDir, args: c.args, timeoutMs: c.timeoutMs }); checks.push(check(label, r.pass, r.detail)); }
      } else checks.push(check(label, false, `unknown check type ${c.type}`));
    }
  }
}
