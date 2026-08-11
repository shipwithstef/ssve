#!/usr/bin/env node
/** sync-native-agents (WI-372): emit .claude/agents/<name>.md from canonical
 * agents/<name>.md sources. Native keys only (doc-verified set, WI-367):
 * name, description, model, tools (+ locked-policy: disallowedTools, maxTurns).
 * svc-only metadata (cognitive_label, host_resolution, fallback, harness)
 * moves into a body comment. permissionMode deliberately OMITTED (enum not
 * live-verified — c9 quote-not-recall discipline); the lock is enforced by
 * disallowedTools + maxTurns. --check verifies emitted files are in sync. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
const AGENTS = [
  "plan-reviewer", "strategic-reviewer", "summary-extractor",
  // WI-399 B1: the locked agents the WI-380/382 protocols reference by name
  "svc-stage-plan", "svc-stage-exec", "svc-stage-land",
  "svc-lens-correctness", "svc-lens-security", "svc-lens-spec-fidelity", "svc-lens-perf",
  "svc-journey-qa", "svc-state-janitor",
  // ad-video fleet (WI-401): pragmatic role agents — owner-accepted risk for a
  // private/trusted tool; key-separation safeguard (secrets only in producer).
  "ad-strategist", "ad-video-producer",
  // research capability (senior upgrade): the researcher role-agent that wields
  // the research skill and compounds source-heuristics over time.
  "researcher",
  // company operating fleet (WI-403..408): business role-agent brains that run a
  // company's operating cadence and emit a ranked owner-decision queue. All
  // executor-class, PROPOSE-only, hold no outward-facing secrets.
  "chief-of-staff", "financial-analyst", "growth-lead", "market-intel", "product-lead",
  // fleet expansion (WI-420): counsel — the legal/compliance + GRC brain. Not a lawyer
  // (decision-support only); propose-only; recommends claude-for-legal/Comp AI/OPA as cards.
  "counsel",
  // fleet expansion (WI-421): security-ops — continuous-security/SecOps brain.
  // Propose-only (never patches/rotates/deploys); wields review-security; recommends scanners as cards.
  "security-ops",
  // fleet expansion wave (WI-422..426): CS, RevOps, Comms, Data-Collection, People-Ops.
  // All propose-only; data-collection carries the owner-accepted trifecta (like market-intel).
  "customer-success", "revops", "comms", "data-collection", "people-ops",
];
// WI-399 B1: per-CLASS lock policies. The original single LOCK encodes the
// REVIEWER posture (G6-003: Bash is mutation-capable — never granted to
// review agents; mechanical outputs are supplied by the orchestrator). Stage
// EXECUTORS exist to mutate (edits, tests, commits) — a different class with
// its own lock: no nested agent spawns (official: unsupported), no web, no
// task-list mutation; maxTurns per WI-399 §Subagent design constraints.
// Canonical frontmatter selects via lock_class: reviewer|executor|janitor
// (default reviewer — fail-closed to the most restrictive class).
const LOCKS = {
  reviewer: {
    disallowedTools: ["Write", "Edit", "NotebookEdit", "Task", "Agent", "TodoWrite", "WebFetch", "WebSearch"],
    maxTurns: 12,
    stripBash: true,
  },
  executor: {
    disallowedTools: ["NotebookEdit", "Task", "Agent", "TodoWrite", "WebFetch", "WebSearch"],
    maxTurns: 80,
    stripBash: false,
  },
  janitor: {
    disallowedTools: ["NotebookEdit", "Task", "Agent", "TodoWrite", "WebFetch", "WebSearch"],
    maxTurns: 20,
    stripBash: false,
  },
};
const LOCK = {
  disallowedTools: LOCKS.reviewer.disallowedTools,
  maxTurns: LOCKS.reviewer.maxTurns,
};
// WI-414 review fix: tools the lock must ALWAYS deny regardless of an agent's tools[] (nested
// spawns + notebook + task-list mutation are never grantable per WI-399). Web tools, by contrast,
// ARE grantable per-agent (e.g. researcher), so they are removed from disallowed when granted —
// otherwise an agent ends up both GRANTED and DISALLOWED the same tool (disallow wins → broken).
const ALWAYS_DENY = new Set(["NotebookEdit", "Task", "Agent", "TodoWrite"]);
// WI-414 review fix: fold a YAML block-scalar description (`description: >` / `|`) into one line.
// The prior single-line regex captured only ">" and silently dropped the researcher's whole
// description, leaving it undiscoverable.
function getDescription(fm) {
  const lines = fm.split("\n");
  const i = lines.findIndex((l) => /^description:/.test(l));
  if (i < 0) return undefined;
  const trimmed = lines[i].replace(/^description:\s*/, "").trim();
  if (!/^[>|][+-]?$/.test(trimmed)) return trimmed || undefined;       // normal inline value
  const folded = [];
  for (let j = i + 1; j < lines.length; j++) {
    if (/^\S/.test(lines[j])) break;                                   // next top-level key ends the block
    const t = lines[j].trim();
    if (t) folded.push(t);
  }
  return folded.join(" ") || undefined;
}
const check = process.argv.includes("--check");
let drift = 0;
mkdirSync(".claude/agents", { recursive: true });
for (const a of AGENTS) {
  const src = readFileSync(`agents/${a}.md`, "utf8");
  const m = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) { console.error(`no frontmatter: agents/${a}.md`); process.exit(1); }
  const [, fm, body] = m;
  const get = (k) => (fm.match(new RegExp(`^${k}:\\s*(.+)$`, "m")) || [])[1]?.trim();
  const name = get("name"), model = get("model");
  const desc = getDescription(fm);
  // G6-001: respect an explicit empty list — never falsy-default it.
  const toolsMatch = fm.match(/^tools:\s*\[([^\]]*)\]/m);
  let toolsList = toolsMatch ? toolsMatch[1].split(",").map((t) => t.trim()).filter(Boolean) : ["Read", "Grep", "Glob"];
  // Lock class (WI-399 B1): reviewer (default, fail-closed) | executor | janitor.
  const lockClass = get("lock_class") || "reviewer";
  const lock = LOCKS[lockClass] || LOCKS.reviewer;
  // G6-003 (scoped to reviewer class): Bash is mutation-capable — never
  // granted to REVIEW agents; executors/janitor legitimately run commands.
  if (lock.stripBash) toolsList = toolsList.filter((t) => t !== "Bash");
  const tools = toolsList.join(", ");
  // WI-414 review fix: never disallow a tool the agent explicitly grants (except the always-deny set),
  // so researcher's WebFetch/WebSearch aren't simultaneously granted and disallowed.
  const disallowed = lock.disallowedTools.filter((t) => ALWAYS_DENY.has(t) || !toolsList.includes(t));
  // G6-002: COMPLETE serialization of every non-native canonical key (multi-line
  // block scalars included) — nothing silently dropped.
  const NATIVE = new Set(["name", "description", "model", "tools"]);
  const svcMetaLines = [];
  let inBlock = false;
  for (const line of fm.split("\n")) {
    const km = line.match(/^([A-Za-z_][\w-]*):/);
    if (km) { inBlock = !NATIVE.has(km[1]); if (inBlock) svcMetaLines.push(line); }
    else if (inBlock) svcMetaLines.push(line);
  }
  const svcMeta = svcMetaLines.join("\n");
  const label = (fm.match(/^cognitive_label:\s*"?\[?(\w+)/m) || [, "REVIEW"])[1];
  const out = `---
name: ${name}
description: ${desc}
model: ${model}
tools: [${tools}]
disallowedTools: [${disallowed.join(", ")}]
maxTurns: ${lock.maxTurns}
---
<!-- GENERATED from agents/${a}.md by scripts/sync-native-agents.mjs (WI-372).
     Edit the canonical source, then re-run the sync. svc metadata:
${svcMeta.split("\n").map((l) => "     " + l).join("\n")}
     model routing: bash scripts/resolve-model.sh ${label} -->
${body}`;
  const dest = `.claude/agents/${a}.md`;
  if (check) {
    if (!existsSync(dest) || readFileSync(dest, "utf8") !== out) { console.error(`stale: ${dest} — run node scripts/sync-native-agents.mjs`); drift++; }
  } else {
    writeFileSync(dest, out);
    console.log(`emitted ${dest}`);
  }
}
if (check) { console.log(drift ? `${drift} stale` : "native agents in sync"); process.exit(drift ? 1 : 0); }
