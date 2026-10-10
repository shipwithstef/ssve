#!/usr/bin/env node
/**
 * overengineering-index.mjs — score a plan for work its acceptance criteria don't need.
 *
 *   node scripts/overengineering-index.mjs <plan.json | plan.md> [--chain <stage-activation.json>] [--profile prototype|mvp|production] [--json]
 *
 * Reads a plan-manifest body (JSON, or the SVC_PLAN_BODY block of a plan .md) and
 * reports an index from 0 (lean) to 100 (over-engineered) with the items behind it.
 * Each component scores 0..1 and is weighted:
 *
 *   unanchored  35  work items (blueprints, else task_graph entries) that cite no AC
 *   speculative 25  speculative-generality language ("pluggable", "framework", "future-proof", ...)
 *   surface     20  files created per acceptance criterion above 1.5
 *   deps        10  new dependencies declared in the plan
 *   chain       10  non-essential stages kept active without a mechanical trigger (--chain)
 *
 * Bands: <20 lean, <40 ok, <60 heavy, >=60 over-engineered. The weights are a
 * starting heuristic; a heavy or worse plan must cut the listed items or justify
 * each one against an AC in decision_trace. With --profile, the plan is also checked
 * against that delivery profile's max_index (references/delivery-profiles.json) and the
 * exit code is 1 when it is over. Without --profile, exit 0 always.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROFILES = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "references", "delivery-profiles.json");

export function checkProfile(result, profileName, file = PROFILES) {
  const profiles = JSON.parse(fs.readFileSync(file, "utf8")).profiles;
  const profile = profiles[profileName];
  if (!profile) throw new Error(`unknown profile "${profileName}" (known: ${Object.keys(profiles).join(", ")})`);
  return { profile: profileName, max_index: profile.max_index, over: result.index > profile.max_index };
}

const SPECULATIVE = /\b(framework|pluggable|plug-?in system|extensib\w*|generic\w*|registry|factory|strategy pattern|abstraction layer|future[- ]proof\w*|configurable|for future use|in case we|later we (?:can|could|might)|one day)\b/gi;
const AC_ID = /\bAC[-_ ]?\d+(?:\.\d+)?\b/gi;
const DEP = /\b(add(?:s|ing)? (?:a |the )?(?:new )?(?:dependency|dependencies|package|library)|npm (?:i|install) |pip install |go get |cargo add )/i;

export function loadPlan(file) {
  const text = fs.readFileSync(file, "utf8");
  if (/^\s*\{/.test(text)) return JSON.parse(text);
  const m = text.match(/SVC_PLAN_BODY[\s\S]*?```json\r?\n([\s\S]*?)\r?\n```/);
  if (!m) throw new Error("no JSON plan body found (expected a JSON file or an SVC_PLAN_BODY fenced json block)");
  return JSON.parse(m[1]);
}

const str = (v) => (typeof v === "string" ? v : JSON.stringify(v ?? ""));

export function acIds(plan) {
  const ids = new Set();
  const digests = plan.ac_digests;
  const scan = (s) => { for (const m of str(s).matchAll(AC_ID)) ids.add(m[0].toUpperCase().replace(/[-_ ]/, "-")); };
  if (digests && typeof digests === "object") {
    const list = digests.entries ?? digests.digests;
    if (Array.isArray(list)) for (const d of list) scan(d.ac_id ?? d.id ?? d.ac ?? d);
    else scan(Object.keys(digests).join(" "));
  }
  return ids;
}

export function workItems(plan) {
  if (Array.isArray(plan.changeset_blueprints) && plan.changeset_blueprints.length) {
    return plan.changeset_blueprints.map((b) => ({ id: b.file, action: b.action, text: str(b.blueprint) + " " + str(b.file) }));
  }
  if (Array.isArray(plan.task_graph) && plan.task_graph.length) {
    return plan.task_graph.map((t, i) => ({ id: t.id ?? t.title ?? `task ${i + 1}`, action: null, text: str(t) }));
  }
  return [];
}

export function score(plan, chain = null) {
  const acs = acIds(plan);
  const items = workItems(plan);
  const notes = [];
  const components = {};

  // unanchored: an item counts as anchored when it names an AC id (any id when the plan lists none).
  const blueprints = Array.isArray(plan.changeset_blueprints) && plan.changeset_blueprints.length > 0;
  const anyCited = items.some((it) => new RegExp(AC_ID.source, "i").test(str(it.text)));
  if (items.length && (blueprints || anyCited)) {
    const unanchored = items.filter((it) => {
      const cited = [...str(it.text).matchAll(AC_ID)].map((m) => m[0].toUpperCase().replace(/[-_ ]/, "-"));
      return acs.size ? !cited.some((c) => acs.has(c)) : cited.length === 0;
    });
    components.unanchored = { weight: 35, share: unanchored.length / items.length, items: unanchored.map((u) => u.id),
      fix: "cite the AC each item serves, or cut it" };
  } else notes.push(items.length ? "task_graph items cite no AC ids: unanchored not measured" : "no changeset_blueprints or task_graph: unanchored not measured");

  // speculative generality across the plan's own prose.
  const prose = [items.map((i) => i.text).join(" "), str(plan.decision_trace), str(plan.scope)].join(" ");
  const hits = [...new Set([...prose.matchAll(SPECULATIVE)].map((m) => m[0].toLowerCase()))];
  components.speculative = { weight: 25, share: Math.min(1, hits.length / (2 + acs.size)), items: hits,
    fix: "build the concrete case the AC needs; generalise when a second real case exists" };

  // surface: created files per AC.
  const creates = items.filter((i) => i.action === "CREATE").length;
  if (items.some((i) => i.action)) {
    const perAc = creates / Math.max(1, acs.size);
    components.surface = { weight: 20, share: Math.max(0, Math.min(1, (perAc - 1.5) / 3)), items: creates ? [`${creates} new files for ${acs.size || "unknown"} AC`] : [],
      fix: "extend existing files before adding new ones" };
  } else notes.push("no file actions: surface not measured");

  // deps: new dependencies named in work items or dependencies[].
  const depItems = items.filter((i) => DEP.test(i.text)).map((i) => i.id);
  components.deps = { weight: 10, share: Math.min(1, depItems.length * 0.5), items: depItems,
    fix: "use what the repo already depends on unless an AC needs the new one" };

  // chain: non-essential stages active with no mechanical trigger.
  if (Array.isArray(chain)) {
    const optional = chain.filter((s) => !/^essential/.test(s.condition || ""));
    const untriggered = optional.filter((s) => s.result === "active" && !(s.evaluated_against?.patterns || []).length && !s.evaluated_against?.capability_names_checked);
    components.chain = { weight: 10, share: optional.length ? untriggered.length / optional.length : 0, items: untriggered.map((s) => s.stage),
      fix: "drop stages nothing in the plan triggers" };
  } else notes.push("no --chain: chain weight not measured");

  const measured = Object.values(components);
  const maxWeight = measured.reduce((a, c) => a + c.weight, 0);
  const raw = measured.reduce((a, c) => a + c.weight * c.share, 0);
  const index = maxWeight ? Math.round((raw / maxWeight) * 100) : 0;
  const band = index < 20 ? "lean" : index < 40 ? "ok" : index < 60 ? "heavy" : "over-engineered";
  for (const c of measured) c.share = +c.share.toFixed(2);
  return { index, band, acceptance_criteria: acs.size, work_items: items.length, components, notes };
}

function main(argv) {
  const valued = new Set(["--chain", "--profile"]);
  const file = argv.find((a, i) => !a.startsWith("--") && !valued.has(argv[i - 1]));
  if (!file) { process.stderr.write("usage: overengineering-index.mjs <plan.json|plan.md> [--chain <stage-activation.json>] [--json]\n"); return 2; }
  const chainIdx = argv.indexOf("--chain");
  let result;
  try {
    const chain = chainIdx >= 0 ? JSON.parse(fs.readFileSync(argv[chainIdx + 1], "utf8")) : null;
    result = score(loadPlan(file), chain);
    const profileIdx = argv.indexOf("--profile");
    if (profileIdx >= 0) result.profile = checkProfile(result, argv[profileIdx + 1]);
  } catch (e) { process.stderr.write(`overengineering-index: ${e.message}\n`); return 2; }
  const code = result.profile?.over ? 1 : 0;
  if (argv.includes("--json")) { process.stdout.write(JSON.stringify(result, null, 2) + "\n"); return code; }
  process.stdout.write(`over-engineering index ${result.index}/100 (${result.band}) — ${result.work_items} work items, ${result.acceptance_criteria} AC\n`);
  for (const [name, c] of Object.entries(result.components)) {
    if (!c.share) continue;
    process.stdout.write(`  ${name} ${Math.round(c.share * 100)}% (weight ${c.weight}): ${c.items.slice(0, 8).join(", ")}${c.items.length > 8 ? ", …" : ""}\n    → ${c.fix}\n`);
  }
  for (const n of result.notes) process.stdout.write(`  note: ${n}\n`);
  if (result.profile) process.stdout.write(`  profile ${result.profile.profile}: max ${result.profile.max_index} — ${result.profile.over ? "OVER: cut the listed items or justify each against an AC" : "within budget"}\n`);
  return code;
}

// Main-module check that survives the symlinked install path (~/.claude/skills/...).
const isMain = (() => { try { return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) process.exit(main(process.argv.slice(2)));
