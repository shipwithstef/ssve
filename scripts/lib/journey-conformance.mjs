// Journey conformance: did a framework run actually walk the journey the task intends?
// A spec lists steps (skills, checks, reviews, receipts, state, commits); each step has a
// predicate over the run's session transcripts and its kept build. No model is called.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const MUSTS = ["MUST", "CONDITIONAL", "OPTIONAL"];
const PRED_KEYS = ["skill", "bash", "tool", "file", "file_matches", "git_notes", "commits", "all", "any", "not"];

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const e of entries) {
    if (e.name === ".git" || e.name === "node_modules") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile()) out.push(p);
  }
  return out;
}

// One entry per session transcript file, in the order the sessions started (first
// timestamp in the file; file name breaks ties), so a step can be bound to its session.
export function readSessions(dir) {
  if (!dir || !fs.existsSync(dir)) return [];
  const sessions = [];
  for (const f of walk(dir).filter((p) => p.endsWith(".jsonl"))) {
    let text;
    try { text = fs.readFileSync(f, "utf8"); } catch { continue; }
    const events = [];
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try { events.push(JSON.parse(line)); } catch { /* tolerate bad lines */ }
    }
    const first = events.map((e) => Date.parse(e?.timestamp)).find((t) => Number.isFinite(t));
    sessions.push({ file: f, started: Number.isFinite(first) ? first : Infinity, events });
  }
  return sessions.sort((a, b) => a.started - b.started || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
}

export function readTranscripts(dir) {
  return readSessions(dir).flatMap((s) => s.events);
}

export function toolUses(events) {
  const out = [];
  for (const ev of events || []) {
    const content = ev?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const b of content) if (b && b.type === "tool_use") out.push({ name: b.name, input: b.input && typeof b.input === "object" ? b.input : {} });
  }
  return out;
}

// glob -> RegExp: ** crosses directories, * and ? stay inside one path segment.
export function globToRegex(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") { i++; re += "(?:.*/)?"; } else re += ".*";
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

function matchingFiles(buildDir, glob) {
  if (!buildDir || !fs.existsSync(buildDir)) return [];
  const re = globToRegex(glob);
  return walk(buildDir).filter((p) => re.test(path.relative(buildDir, p).split(path.sep).join("/")));
}

function git(buildDir, args) {
  if (!buildDir || !fs.existsSync(path.join(buildDir, ".git"))) return null;
  const r = spawnSync("git", ["-C", buildDir, ...args], { encoding: "utf8", timeout: 20000 });
  return r.status === 0 ? r.stdout : null;
}

const short = (s, n = 80) => (s.length > n ? `${s.slice(0, n)}...` : s);

export function evalPredicate(pred, ctx = {}) {
  if (!pred || typeof pred !== "object" || Array.isArray(pred)) throw new Error(`journey predicate must be an object, got ${JSON.stringify(pred)}`);
  const keys = Object.keys(pred);
  if (keys.length !== 1) throw new Error(`journey predicate must have exactly one key, got [${keys.join(", ")}]`);
  const key = keys[0], arg = pred[key];
  if (!PRED_KEYS.includes(key)) throw new Error(`unknown journey predicate key "${key}"`);
  const tools = ctx.tools || [], buildDir = ctx.buildDir;
  switch (key) {
    case "skill": {
      const hit = tools.find((t) => t.name === "Skill" && (t.input.skill === arg || String(t.input.skill ?? "").endsWith(`:${arg}`)));
      return { hit: Boolean(hit), evidence: hit ? `Skill ${hit.input.skill}` : `no Skill use of ${arg}` };
    }
    case "bash": {
      const re = new RegExp(arg, "m");
      const hit = tools.find((t) => t.name === "Bash" && re.test(String(t.input.command ?? "")));
      return { hit: Boolean(hit), evidence: hit ? `Bash: ${short(String(hit.input.command).split("\n")[0])}` : `no Bash command matching /${arg}/` };
    }
    case "tool": {
      const n = tools.filter((t) => t.name === arg).length;
      return { hit: n > 0, evidence: n ? `${arg} used ${n}x` : `no ${arg} use` };
    }
    case "file": {
      const f = matchingFiles(buildDir, arg);
      return { hit: f.length > 0, evidence: f.length ? `file ${path.relative(buildDir, f[0]).split(path.sep).join("/")}` : `no file matching ${arg}` };
    }
    case "file_matches": {
      const re = new RegExp(arg.regex, "m");
      for (const f of matchingFiles(buildDir, arg.glob)) {
        let text; try { text = fs.readFileSync(f, "utf8"); } catch { continue; }
        if (re.test(text)) return { hit: true, evidence: `${path.relative(buildDir, f).split(path.sep).join("/")} matches /${arg.regex}/` };
      }
      return { hit: false, evidence: `no file matching ${arg.glob} with /${arg.regex}/` };
    }
    case "git_notes": {
      const ref = arg.ref;
      const list = git(buildDir, ["notes", "--ref", ref, "list"]);
      if (list == null) return { hit: false, evidence: `no notes on ${ref}` };
      const re = arg.regex != null ? new RegExp(arg.regex, "m") : null;
      const rows = list.split("\n").map((l) => l.trim().split(/\s+/)).filter((p) => p.length >= 2);
      if (!rows.length) return { hit: false, evidence: `no notes on ${ref}` };
      if (!re) return { hit: true, evidence: `${rows.length} note(s) on ${ref}` };
      for (const [, obj] of rows) {
        const text = git(buildDir, ["notes", "--ref", ref, "show", obj]);
        if (text != null && re.test(text)) return { hit: true, evidence: `note on ${obj.slice(0, 8)} matches /${arg.regex}/` };
      }
      return { hit: false, evidence: `no note on ${ref} matches /${arg.regex}/` };
    }
    case "commits": {
      const out = git(buildDir, ["rev-list", "--count", "HEAD"]);
      const n = out == null ? 0 : Number(out.trim()) || 0;
      return { hit: n >= arg.min, evidence: `${n} commit(s), need >= ${arg.min}` };
    }
    case "all": {
      const rs = arg.map((p) => evalPredicate(p, ctx));
      return { hit: rs.every((r) => r.hit), evidence: rs.map((r) => r.evidence).join("; ") };
    }
    case "any": {
      const rs = arg.map((p) => evalPredicate(p, ctx));
      return { hit: rs.some((r) => r.hit), evidence: rs.map((r) => r.evidence).join("; ") };
    }
    case "not": {
      const r = evalPredicate(arg, ctx);
      return { hit: !r.hit, evidence: `not (${r.evidence})` };
    }
  }
}

// Structural problems of one predicate (unknown keys, wrong argument shapes, bad regexes).
function predicateProblems(pred, where) {
  const out = [];
  if (!pred || typeof pred !== "object" || Array.isArray(pred)) return [`${where}: predicate must be an object`];
  const keys = Object.keys(pred);
  if (keys.length !== 1) return [`${where}: predicate must have exactly one key, got [${keys.join(", ")}]`];
  const key = keys[0], arg = pred[key];
  if (!PRED_KEYS.includes(key)) return [`${where}: unknown predicate key "${key}"`];
  const str = (v) => typeof v === "string" && v.length > 0;
  const re = (v, label) => { try { new RegExp(v); } catch { out.push(`${where}: ${label} is not a valid regex`); } };
  switch (key) {
    case "skill": case "tool": case "file": if (!str(arg)) out.push(`${where}: "${key}" needs a non-empty string`); break;
    case "bash": if (!str(arg)) out.push(`${where}: "bash" needs a non-empty regex string`); else re(arg, "bash"); break;
    case "file_matches":
      if (!arg || !str(arg.glob) || !str(arg.regex)) out.push(`${where}: "file_matches" needs {glob, regex}`); else re(arg.regex, "file_matches.regex");
      break;
    case "git_notes":
      if (!arg || !str(arg.ref)) out.push(`${where}: "git_notes" needs {ref, regex?}`);
      else if (arg.regex != null) { if (!str(arg.regex)) out.push(`${where}: git_notes.regex must be a string`); else re(arg.regex, "git_notes.regex"); }
      break;
    case "commits": if (!arg || !Number.isInteger(arg.min) || arg.min < 0) out.push(`${where}: "commits" needs {min: integer >= 0}`); break;
    case "all": case "any":
      if (!Array.isArray(arg) || !arg.length) out.push(`${where}: "${key}" needs a non-empty array`);
      else arg.forEach((p, i) => out.push(...predicateProblems(p, `${where}.${key}[${i}]`)));
      break;
    case "not": out.push(...predicateProblems(arg, `${where}.not`)); break;
  }
  return out;
}

export function validateSpec(spec) {
  const problems = [];
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) return ["spec must be an object"];
  if (typeof spec.task !== "string" || !spec.task) problems.push("spec.task missing");
  if (spec.version == null) problems.push("spec.version missing");
  if (!Array.isArray(spec.steps) || !spec.steps.length) { problems.push("spec.steps must be a non-empty array"); return problems; }
  const seen = new Set();
  spec.steps.forEach((s, i) => {
    const id = s && typeof s.id === "string" && s.id ? s.id : null;
    const where = `step ${id ?? `#${i}`}`;
    if (!s || typeof s !== "object") { problems.push(`${where}: not an object`); return; }
    if (!id) problems.push(`${where}: missing id`);
    else if (seen.has(id)) problems.push(`${where}: duplicate id`);
    else seen.add(id);
    if (!MUSTS.includes(s.must)) problems.push(`${where}: must is ${JSON.stringify(s.must)}, expected MUST, CONDITIONAL or OPTIONAL`);
    if (s.session !== undefined && !(Number.isInteger(s.session) && s.session >= 1)) problems.push(`${where}: session must be a positive integer`);
    if (s.evidence === undefined) problems.push(`${where}: missing evidence predicate`);
    else problems.push(...predicateProblems(s.evidence, `${where}.evidence`));
    if (s.when !== undefined) problems.push(...predicateProblems(s.when, `${where}.when`));
  });
  return problems;
}

const canonical = (v) => {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
};
export const specSha = (spec) => crypto.createHash("sha256").update(canonical(spec)).digest("hex").slice(0, 12);

// Events grouped by the session they belong to: the event's own sessionId, else the transcript
// file's name. A subagent's transcript carries its parent's sessionId, so it joins the outer
// session it ran in instead of becoming a session of its own.
export function eventsBySessionId(dir) {
  const by = new Map();
  for (const s of readSessions(dir)) {
    const fileId = path.basename(s.file, ".jsonl");
    for (const e of s.events) {
      const id = (typeof e?.sessionId === "string" && e.sessionId) || fileId;
      if (!by.has(id)) by.set(id, []);
      by.get(id).push(e);
    }
  }
  return by;
}

// sessionIds: the outer session id of each run step, in step order (the runner records them).
// With them, "session n" is that session's events (its subagents included); without them each
// transcript file is a numbered session, in start order.
export function checkJourney(spec, { transcriptsDir = null, buildDir = null, sessionIds = null } = {}) {
  let sessions = readSessions(transcriptsDir);
  if (Array.isArray(sessionIds) && sessionIds.length) {
    const by = eventsBySessionId(transcriptsDir);
    sessions = sessionIds.map((id) => ({ events: (id && by.get(id)) || [] }));
  }
  const all = { tools: toolUses(readSessions(transcriptsDir).flatMap((x) => x.events)), buildDir };
  // A step with `session: n` sees only the n-th session's tool uses, so one session's
  // work never counts for another (continuity: session 2 must walk its own journey).
  const ctxFor = (s) => (s.session == null ? all : { tools: toolUses(sessions[s.session - 1]?.events || []), buildDir });
  const steps = [];
  for (const s of spec.steps) {
    const ctx = ctxFor(s);
    let applies = true;
    if (s.must === "CONDITIONAL" && s.when !== undefined) applies = evalPredicate(s.when, ctx).hit;
    const r = evalPredicate(s.evidence, ctx);
    steps.push({ id: s.id, must: s.must, ...(s.session != null ? { session: s.session } : {}), applies, hit: r.hit, evidence: r.evidence });
  }
  const required = steps.filter((s) => s.must !== "OPTIONAL" && s.applies);
  const missing = required.filter((s) => !s.hit).map((s) => s.id);
  return {
    spec_sha: specSha(spec),
    steps,
    must_total: required.length,
    must_hit: required.filter((s) => s.hit).length,
    conformant: missing.length === 0,
    missing,
  };
}
