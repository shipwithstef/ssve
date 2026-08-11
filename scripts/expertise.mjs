#!/usr/bin/env node
/**
 * expertise (WI-430): the SME-agent run-start PRELOAD. Composes the FOUR expertise layers an agent reads
 * before it acts, so it builds on current/experienced knowledge instead of frozen training alone:
 *   L1 TRAINING    — the agent's own prompt (broad SME baseline, frozen at model training)
 *   L2 CURRENT     — references/knowledge/<domain>/ (CAPABILITIES.md), STALENESS-CHECKED against .version
 *   L3 EXPERIENCE  — <role>/ledger.jsonl (past decisions + real outcomes)   ┐ read INLINE (read-only; the same
 *   L4 HEURISTICS  — <role>/playbook.md (promoted patterns)                  ┘ files company-state.mjs `recall` reads)
 * Reuses the knowledge-protocol currency model (domain 30d / competitor 7d / market 3d). Invents NO new store.
 *
 *   node scripts/expertise.mjs preload --agent <name> [--state-dir <dir>] [--repo <abs>]
 *
 * Exit: 0 = composed (L2 may be [STALE] — that is a HANDLED state, not a failure); 3 = PARTIAL (a requested
 * layer could not load); 1 = the agent's SME contract is missing/incomplete (fail CLOSED, never fail-open to L1).
 */
import { readFileSync, existsSync, readdirSync, appendFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
const iso = () => new Date().toISOString();

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const die = (m) => { console.error(`✗ ${m}`); process.exit(1); };
const REPO = resolve(opt("--repo") || ".");
const WINDOW = { market: 3, competitor: 7, domain: 30 };   // date-currency class → staleness window (days)

function frontmatter(path) {
  const lines = readFileSync(path, "utf8").split("\n");
  if (lines[0].trim() !== "---") return { expertise: {} };
  const end = lines.indexOf("---", 1);
  const fm = lines.slice(1, end < 0 ? lines.length : end);
  const out = { expertise: {} };
  let inExp = false;
  for (const ln of fm) {
    const top = ln.match(/^domain:\s*(.+)$/);
    if (top) { out.domain = top[1].trim(); inExp = false; continue; }
    if (/^expertise:\s*$/.test(ln)) { inExp = true; continue; }
    if (inExp) {
      const sub = ln.match(/^\s+([a-z_]+):\s*(.+)$/);
      if (sub) { out.expertise[sub[1]] = sub[2].trim(); continue; }
      if (/^\S/.test(ln)) inExp = false;
    }
  }
  return out;
}
function daysSince(dateStr) {
  const m = String(dateStr).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return Math.floor((Date.now() - Date.UTC(+m[1], +m[2] - 1, +m[3])) / 86400000);
}
// L2 staleness verdict. Returns {verdict, stale}. Future-dated / unparseable / unknown-class all → STALE.
function currencyVerdict(kdir, cur) {
  const verPath = join(kdir, ".version");
  if (!existsSync(verPath)) return { verdict: "[STALE] no .version file — currency UNKNOWN; refresh", stale: true };
  const ver = readFileSync(verPath, "utf8").trim();
  if (cur === "repo" || cur === "stack") return { verdict: `[version-pinned] currency=${cur} — compare '${ver.slice(0, 40)}' to upstream SHA/version, not a date`, stale: false };
  const age = daysSince(ver), win = WINDOW[cur];
  if (age == null) return { verdict: `[STALE] .version has no parseable date — refresh`, stale: true };
  if (win == null) return { verdict: `[STALE] unknown date-currency class '${cur}' (expected market|competitor|domain)`, stale: true };
  if (age < 0) return { verdict: `[STALE] .version is FUTURE-dated (${ver.slice(0, 10)}, ${-age}d ahead) — bad stamp, refresh`, stale: true };
  if (age > win) return { verdict: `[STALE] as-of ${ver.slice(0, 10)} — ${age}d old, ${age - win}d past the ${win}d '${cur}' window → STALE; the framework's refresh-scan re-researches it`, stale: true };
  return { verdict: `[FRESH] as-of ${ver.slice(0, 10)} — ${age}d of ${win}d ('${cur}')`, stale: false };
}
// Read-only recall, INLINE (no nested node spawn): the same files company-state.mjs `recall` reads.
function recallInline(stateDir, role) {
  const base = join(resolve(stateDir), role);
  if (!existsSync(base)) return { ok: false, why: `no ledger dir for role '${role}' at ${base}` };
  const lp = join(base, "ledger.jsonl"), pb = join(base, "playbook.md");
  const rows = existsSync(lp) ? readFileSync(lp, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
  const closed = rows.filter((e) => e.outcome);
  return { ok: true, closed, openCount: rows.length - closed.length, playbook: existsSync(pb) ? readFileSync(pb, "utf8").trim() : null };
}

if (cmd === "preload") {
  const agent = opt("--agent"); if (!agent) die("need --agent <name>");
  const apath = join(REPO, "agents", `${agent}.md`);
  if (!existsSync(apath)) die(`no agent: ${apath}`);
  const fm = frontmatter(apath);
  if (!fm.domain) die(`agent '${agent}' has no 'domain:' declaration — not an SME agent yet`);
  const exp = fm.expertise || {};
  // FAIL CLOSED (Codex MED-2): a declared SME contract must be COMPLETE — never fail-open to L1-only output,
  // or a typo on any fanned-out agent would silently skip its actual knowledge bank.
  const KINDS = ["ledger", "source-heuristics"];
  const CURRENCIES = ["market", "competitor", "domain", "repo", "stack"];
  const miss = [];
  if (!exp.knowledge) miss.push("expertise.knowledge");
  if (!exp.currency) miss.push("expertise.currency");
  else if (!CURRENCIES.includes(exp.currency)) miss.push(`expertise.currency='${exp.currency}' not in [${CURRENCIES.join("|")}]`);
  if (!exp.memory_kind) miss.push("expertise.memory_kind");
  else if (!KINDS.includes(exp.memory_kind)) miss.push(`expertise.memory_kind='${exp.memory_kind}' not in [${KINDS.join("|")}]`);   // Codex r2: enum-validate, no typo fall-through
  if (exp.memory_kind === "ledger" && !exp.memory_role) miss.push("expertise.memory_role (required for memory_kind:ledger)");
  if (miss.length) die(`agent '${agent}' declares domain: but its expertise: block is INVALID — ${miss.join(", ")}. An SME contract must be complete + well-formed (fail-closed).`);
  const kdir = resolve(REPO, exp.knowledge);
  if (!existsSync(join(kdir, "CAPABILITIES.md"))) die(`agent '${agent}': declared knowledge bank has no CAPABILITIES.md at ${exp.knowledge} — seed the domain bank first.`);

  const layers = { l2: null, l34: null };
  console.log(`=== expertise preload: ${agent} (domain: ${fm.domain}) ===`);
  console.log(`\n[L1 TRAINING] baseline = this agent's own prompt (broad SME, frozen at model training). The floor; the layers below OVERRIDE it where more current or experienced.`);

  // L2
  const { verdict, stale } = currencyVerdict(kdir, exp.currency);
  layers.l2 = stale ? "STALE" : "FRESH";
  console.log(`\n[L2 CURRENT KNOWLEDGE] ${exp.knowledge}  ${verdict}`);
  console.log("--- CAPABILITIES.md ---\n" + readFileSync(join(kdir, "CAPABILITIES.md"), "utf8").trim());

  // L3/L4
  const stateDir = opt("--state-dir");
  const role = exp.memory_role || agent;
  console.log(`\n[L3/L4 EXPERIENCE+HEURISTICS] memory_kind=${exp.memory_kind}` + (exp.memory_kind === "ledger" ? ` role=${role}` : ""));
  if (exp.memory_kind === "source-heuristics") {
    // the protocol stores trusted-source rules in the GLOBAL file + an optional per-domain file (Codex r1)
    const paths = [join(REPO, "references/knowledge/source-heuristics.global.jsonl"), join(REPO, exp.knowledge || "", "source-heuristics.jsonl")];
    let rows = [];
    for (const p of paths) if (existsSync(p)) rows.push(...readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean));
    rows = rows.filter((r) => (r.confidence || 0) >= 7);
    if (rows.length) {
      console.log(`  trusted source-heuristics (confidence ≥7): ${rows.length}`);
      rows.slice(-8).forEach((r) => console.log(`  - [${r.confidence}] ${r.domain}/${r.claim_class}: ${r.rule}`));
      layers.l34 = `${rows.length} heuristics`;
    } else { console.log("  (no source-heuristics ≥7 yet — cold start)"); layers.l34 = "cold"; }
  } else if (stateDir) {
    const r = recallInline(stateDir, role);
    if (!r.ok) { console.log(`  PARTIAL — ${r.why}`); layers.l34 = "UNAVAILABLE"; }
    else {
      console.log(`  past decisions WITH outcomes: ${r.closed.length}` + (r.openCount ? ` · ${r.openCount} awaiting outcome` : ""));
      r.closed.slice(-8).forEach((e) => console.log(`  - [worked:${e.worked ?? "?"}] ${e.decision_id} ${e.title} → ${e.outcome}`));
      console.log(r.playbook ? `  playbook.md (promoted heuristics):\n${r.playbook.split("\n").map((l) => "    " + l).join("\n")}` : "  (no playbook.md yet — promote a pattern after ≥3 confirming outcomes)");
      layers.l34 = `${r.closed.length} outcomes${r.playbook ? "+playbook" : ""}`;
    }
  } else { console.log("  not loaded — pass --state-dir to load the experience+heuristics layers"); layers.l34 = "not-requested"; }

  // HONEST summary (Codex HIGH-1: never blanket-claim "all four composed")
  const partial = layers.l34 === "UNAVAILABLE";
  console.log(`\n=== preload ${partial ? "PARTIAL" : "complete"} — L1 ✓ · L2 ${layers.l2} · L3/L4 ${layers.l34}.` +
    `${stale ? " L2 is STALE → flag it (the framework's refresh-scan re-researches stale banks)." : ""}${partial ? " A requested layer did not load." : ""} Propose grounded in the freshest applicable layer. ===`);
  process.exit(partial ? 3 : 0);
}

if (cmd === "check") {
  // WI-431: parity between the expertiseRegistry spine (skills-manifest.json) and each SME agent's frontmatter
  // declaration. Every agent that declares domain: must have a matching registry row whose knowledge bank exists,
  // and every registry row must point at an agent that declares the same domain. Drift fails (like sync --check).
  const manifest = JSON.parse(readFileSync(join(REPO, "skills-manifest.json"), "utf8"));
  const reg = (manifest.expertiseRegistry && manifest.expertiseRegistry.entries) || [];
  const errs = [];
  const agentsDir = join(REPO, "agents");
  // reject duplicate agent rows (Codex r1: a dup could hide a bad row from the last-wins map)
  const seen = new Set();
  for (const e of reg) { if (e.agent && seen.has(e.agent)) errs.push(`duplicate expertiseRegistry row for agent '${e.agent}'`); if (e.agent) seen.add(e.agent); }
  const byAgent = new Map(reg.map((e) => [e.agent, e]));
  // every agent declaring domain: must have a matching, field-consistent row (stages live ONLY in the registry —
  // the dispatch spine — so there is no second place to drift, per Codex r1).
  for (const f of readdirSync(agentsDir).filter((x) => x.endsWith(".md"))) {
    const name = f.replace(/\.md$/, "");
    const fm = frontmatter(join(agentsDir, f));
    if (!fm.domain) continue;
    const e = byAgent.get(name);
    if (!e) { errs.push(`agent '${name}' declares domain:${fm.domain} but has NO expertiseRegistry row`); continue; }
    const exp = fm.expertise || {};
    if (e.domain !== fm.domain) errs.push(`agent '${name}' domain='${fm.domain}' != registry '${e.domain}'`);
    for (const k of ["knowledge", "currency", "memory_kind"]) if (e[k] !== exp[k]) errs.push(`agent '${name}' ${k}='${exp[k]}' != registry '${e[k]}'`);
    if (exp.memory_kind === "ledger" && e.memory_role !== exp.memory_role) errs.push(`agent '${name}' memory_role='${exp.memory_role}' != registry '${e.memory_role}'`);
  }
  // EVERY registry row (not just the last per agent) must be complete + point at an existing bank + matching agent
  for (const e of reg) {
    for (const k of ["agent", "domain", "knowledge", "currency", "memory_kind"]) if (!e[k]) errs.push(`registry row '${e.agent || "?"}' missing required field '${k}'`);
    if (e.memory_kind === "ledger" && !e.memory_role) errs.push(`registry row '${e.agent}' missing memory_role (required for memory_kind:ledger)`);
    if (e.knowledge && !existsSync(join(REPO, e.knowledge, "CAPABILITIES.md"))) errs.push(`registry '${e.agent}': knowledge bank has no CAPABILITIES.md at ${e.knowledge}`);
    const ap = join(agentsDir, `${e.agent}.md`);
    if (!existsSync(ap)) errs.push(`registry row '${e.agent}' has no agents/${e.agent}.md`);
    else { const fm = frontmatter(ap); if (fm.domain !== e.domain) errs.push(`registry '${e.agent}' domain='${e.domain}' but the agent declares '${fm.domain || "(none)"}'`); }
  }
  if (errs.length) { console.error(`✗ expertise registry: ${errs.length} parity error(s):`); errs.forEach((x) => console.error("  - " + x)); process.exit(1); }
  console.log(`✓ expertise registry parity: ${reg.length} SME agent(s) registered, all frontmatter↔registry declarations match.`);
  process.exit(0);
}

if (cmd === "refresh-scan") {
  // WI-432: the staleness→refresh closure. Scan every registered SME bank; for each STALE one, emit ONE
  // idempotent, PROPOSE-only refresh trigger to .svc/knowledge-refresh-triggers.jsonl (the framework's
  // "re-research these banks" queue — the owner / a scheduled job acts on it; this NEVER auto-refreshes).
  // Framework-level (not a company decision card): the knowledge is framework-shared and the .version lives
  // in references/knowledge/, outside any company state dir — so the company evidence gate would not fit.
  const manifest = JSON.parse(readFileSync(join(REPO, "skills-manifest.json"), "utf8"));
  const reg = (manifest.expertiseRegistry && manifest.expertiseRegistry.entries) || [];
  const trigPath = opt("--out") ? resolve(opt("--out")) : join(REPO, ".svc/knowledge-refresh-triggers.jsonl");
  const existing = existsSync(trigPath) ? readFileSync(trigPath, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
  const open = new Set(existing.filter((t) => !t.resolved).map((t) => t.domain));   // idempotency: one open trigger per domain
  let stale = 0, emitted = 0, skipped = 0;
  for (const e of reg) {
    const kdir = resolve(REPO, e.knowledge || "");
    if (!e.knowledge || !existsSync(join(kdir, "CAPABILITIES.md"))) { skipped++; console.log(`  ? ${e.agent}: registered bank ${e.knowledge||'(none)'} has no CAPABILITIES.md — skipped (run \`expertise.mjs check\` to fix)`); continue; }
    const { stale: s, verdict } = currencyVerdict(kdir, e.currency);
    if (!s) continue;
    stale++;
    if (open.has(e.domain)) { console.log(`  · ${e.domain} STALE — trigger already open (idempotent)`); continue; }
    if (!existsSync(dirname(trigPath))) mkdirSync(dirname(trigPath), { recursive: true });
    appendFileSync(trigPath, JSON.stringify({ ts: iso(), domain: e.domain, agent: e.agent, knowledge: e.knowledge, currency: e.currency, verdict, action: `re-research the volatile rows in ${e.knowledge}; update CAPABILITIES.md + .sources.jsonl; bump .version`, resolved: false }) + "\n");
    emitted++; console.log(`  + ${e.domain} STALE → refresh trigger emitted (${e.agent})`);
  }
  console.log(`refresh-scan: ${reg.length} SME banks · ${stale} stale · ${emitted} new trigger(s)` + (skipped?` · ${skipped} SKIPPED (missing bank — run check)`:``) + ` → ${opt("--out") || ".svc/knowledge-refresh-triggers.jsonl"} (propose-only; owner re-researches)`);
  process.exit(0);
}

if (cmd === "resolve") {
  // WI-435: resolve a STAGE or DOMAIN to the SME agent the framework should dispatch (route-workflow reads
  // this to sequence an SME agent into a lane, the way ownersRegistry resolves a task_class to a skill).
  const manifest = JSON.parse(readFileSync(join(REPO, "skills-manifest.json"), "utf8"));
  const reg = (manifest.expertiseRegistry && manifest.expertiseRegistry.entries) || [];
  const stage = opt("--stage"), domain = opt("--domain");
  if (!stage && !domain) die("need --stage <stage> or --domain <domain>");
  const matchStage = (stages, q) => (stages || []).some((s) => s === q || (s.startsWith("*.") && q.endsWith(s.slice(1))));
  const hits = reg.filter((e) => domain ? e.domain === domain : matchStage(e.stages, stage));
  if (!hits.length) { console.log(`no SME agent registered for ${domain ? `domain '${domain}'` : `stage '${stage}'`}`); process.exit(1); }
  console.log(`SME agent(s) for ${domain ? `domain '${domain}'` : `stage '${stage}'`}:`);
  hits.forEach((e) => console.log(`  ${e.agent}  (domain: ${e.domain}; preload: node scripts/expertise.mjs preload --agent ${e.agent})`));
  console.log(`AGENT=${hits[0].agent}`);   // machine-readable for route-workflow to capture
  process.exit(0);
}

die(`unknown command '${cmd || ""}'. Use: preload | check | refresh-scan | resolve`);
