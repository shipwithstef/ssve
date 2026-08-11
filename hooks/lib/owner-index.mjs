// owner-index — index task-class→owner mappings (the global manifest
// `ownersRegistry` + the project's `.svc/task-owners.json`) and match them to a
// Bash command or a touched path at action time (WI-392).
//
// WHY: the #1 measured friction in the usage report is wrong-approach (×11) —
// generic CLI deploys blocked by the permission classifier instead of the
// base44-environment skill; curl/admin-token probing instead of Playwright
// browse mode; manual discovery instead of the owning app. The framework HAS the
// right owners; it just never routed to them at the moment of action. This is
// the index the PreToolUse hook consults to inject "this task class is owned by
// X — route through it" as ADDITIVE context (never a block).
//
// DETERMINISTIC (WI-392 AC1 safety / golden-testable): matches are order-stable
// — project rows before global, then task_class ASC, then owner ASC — and
// deduped by task_class so a project owner SHADOWS a global one of the same
// class. No wall-clock, no randomness.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { norm } from "./normalize-path.mjs";

function pushOwner(out, e, origin) {
  if (!e || !e.task_class || !e.owner) return;
  const sig = e.signals || {};
  out.push({
    task_class: String(e.task_class),
    owner: String(e.owner),
    owner_kind: String(e.owner_kind || "skill"),
    message: String(e.message || ""),
    signals: {
      bash: Array.isArray(sig.bash) ? sig.bash.map(String) : [],
      paths: Array.isArray(sig.paths) ? sig.paths.map(String) : [],
    },
    origin,
  });
}

// Global registry (skills-manifest.json `ownersRegistry.entries`, AC3: one row
// per mapping) + project `.svc/task-owners.json` (AC2: exempt-class, same row
// shape — an array, or `{entries|owners:[...]}`). Both reads fail OPEN: a
// missing/malformed source yields no owners, never an exception.
export function loadOwners(repoRoot, manifestPathOverride) {
  const global = [];
  const project = [];
  const mp = manifestPathOverride || process.env.SVC_OWNERS_MANIFEST || join(repoRoot, "skills-manifest.json");
  try {
    const m = JSON.parse(readFileSync(mp, "utf8"));
    for (const e of (m && m.ownersRegistry && m.ownersRegistry.entries) || []) pushOwner(global, e, "global");
  } catch { /* fail-open: no global owners */ }
  const pp = join(repoRoot, ".svc", "task-owners.json");
  try {
    if (existsSync(pp)) {
      const p = JSON.parse(readFileSync(pp, "utf8"));
      const entries = Array.isArray(p) ? p : (p.entries || p.owners || []);
      for (const e of entries) pushOwner(project, e, "project");
    }
  } catch { /* fail-open: malformed project file ignored */ }
  // Codex G6 F3: a project row SHADOWS the global row of the same task_class
  // ENTIRELY — drop shadowed globals BEFORE signal evaluation. Otherwise a
  // project that NARROWS a class (e.g. deploy→only `base44 deploy`) would still
  // let the broad global `deploy` owner fire on `vercel deploy`, breaking the
  // one-owner-per-class shadow contract. Shadow at load time, not after filtering.
  const claimed = new Set(project.map((o) => o.task_class));
  return [...project, ...global.filter((o) => !claimed.has(o.task_class))];
}

// project-first, then task_class ASC, then owner ASC — stable, golden-testable.
const byOrder = (a, b) =>
  (a.origin === "project" ? 0 : 1) - (b.origin === "project" ? 0 : 1) ||
  (a.task_class < b.task_class ? -1 : a.task_class > b.task_class ? 1 : 0) ||
  (a.owner < b.owner ? -1 : a.owner > b.owner ? 1 : 0);

const MAX_TEST_LEN = 2000;   // bound the tested string (defense-in-depth for the trusted regex path)

// Gemini re-review (after Codex G6 F2): a regex heuristic for ReDoS is
// fundamentally bypassable — (a?)+$ and (a|aa)+$ slip past a nested-quantifier
// check yet still catastrophically backtrack. So we REMOVE the untrusted-regex
// surface instead of guarding it: signals from the project `.svc/task-owners.json`
// are matched as LITERAL substrings (never compiled to a regex), and only the
// GLOBAL framework-authored ownersRegistry (reviewed in-repo) uses regex — still
// passed through safeRe + the input cap as belt-and-suspenders.
function safeRe(rx) {
  if (typeof rx !== "string" || !rx || rx.length > 200) return null;
  // Reject ANY parenthesized group immediately quantified by * + ? { — that is
  // the catastrophic-backtracking class: (a+)+, (a?)+, (a|aa)+, (a|aa){2,}, ...
  // Legitimate owner signals never quantify a group (e.g. `(vercel|netlify)\s+deploy`).
  if (/\([^)]*\)\s*[*+?{]/.test(rx)) return null;
  try { return new RegExp(rx); } catch { return null; }
}

// A single signal hits the subject. PROJECT signals are LITERAL substrings (no
// untrusted regex execution — ReDoS-proof by construction); GLOBAL signals are
// trusted regex behind safeRe.
function signalHit(rx, origin, subject) {
  if (!subject || typeof rx !== "string" || !rx) return false;
  if (origin === "project") return subject.includes(rx);
  const re = safeRe(rx);
  return !!re && re.test(subject);
}

// Owners whose bash signals hit the command OR path signals hit the touched
// path. Ordered, deduped by task_class (project shadows global), capped.
export function matchOwners(owners, { command = "", touchedPath = "" } = {}, cap = 2) {
  const cmd = String(command).slice(0, MAX_TEST_LEN);
  const p = norm(touchedPath).slice(0, MAX_TEST_LEN);
  const hit = owners.filter((o) => {
    for (const rx of o.signals.bash) { if (signalHit(rx, o.origin, cmd)) return true; }
    for (const rx of o.signals.paths) { if (signalHit(rx, o.origin, p)) return true; }
    return false;
  });
  const seen = new Set();
  const uniq = [];
  for (const o of hit.sort(byOrder)) {
    if (seen.has(o.task_class)) continue;     // one owner per task_class (project wins)
    seen.add(o.task_class);
    uniq.push(o);
  }
  return uniq.slice(0, cap);
}

// Render matched owners as ADDITIVE context (allow + additionalContext — AC1).
// A routing reminder, never a block.
export function renderInjection(matched) {
  if (!matched.length) return "";
  let ctx = "[svc owner-router] The action you're about to take has a registered OWNER — route through it:\n";
  for (const o of matched) {
    ctx += `\n[${o.task_class} → ${o.owner}] (${o.owner_kind}${o.origin === "project" ? ", project" : ""})\n  ${o.message}\n`;
  }
  ctx += "\nThis is a routing reminder, not a block. If the owner genuinely does not apply here, proceed.\n";
  return ctx;
}
