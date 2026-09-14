#!/usr/bin/env node
/**
 * company-memory: a LOCAL, zero-dependency search index over the whole company brain.
 * The "vector-like db for you" — built on Node's BUILT-IN SQLite (FTS5 ranked full-text), stored at
 * <state-dir>/.memory.db, 100% on your machine, NEVER cloud. The markdown/jsonl in the repo are the
 * source of truth; this index is a DERIVED, regenerable cache — delete it and `index` rebuilds it from
 * the files. Gives the fleet recall over everything it has learned: state, knowledge, decisions, outcomes,
 * per-brain ledgers + playbooks.
 *
 *   node scripts/company-memory.mjs index  --state-dir <dir>                       # (re)build from the repo files
 *   node scripts/company-memory.mjs search --state-dir <dir> --query "..." [--limit N] [--role <brain>] [--kind <md|decision|outcome|ledger>]
 *
 * Recall is FTS5/bm25 keyword today (plenty at company scale). For TRUE semantic vectors later, add a local
 * embedding sidecar (a vectors table + cosine, or sqlite-vec) keyed by the same doc rows — still no data leaves.
 */
const _emit = process.emitWarning.bind(process);                       // hush the node:sqlite experimental notice
process.emitWarning = (w, ...a) => (String(w).includes("SQLite is an experimental") ? undefined : _emit(w, ...a));
const { DatabaseSync } = await import("node:sqlite");
import { readFileSync, writeFileSync, existsSync, readdirSync, lstatSync, appendFileSync } from "node:fs";
import { join, resolve, relative, basename } from "node:path";

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const die = (m) => { console.error(`✗ ${m}`); process.exit(1); };
const stateDir = () => { const d = opt("--state-dir"); if (!d) die("need --state-dir <dir>"); return resolve(d); };
const dbPath = (dir) => join(dir, ".memory.db");

const INDEXABLE = /\.(md|txt|jsonl|json)$/i;
const SKIP_DIR = new Set([".git", "node_modules", "reviews"]); // reviews are big derived narratives; re-derivable from cards
const MAX_BYTES = 1_000_000;

function walk(dir, base, out) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".memory.db")) continue;
    const p = join(dir, name);
    let st; try { st = lstatSync(p); } catch { continue; }
    if (st.isSymbolicLink()) continue;                   // never follow a symlink out of the brain (Codex H4)
    if (st.isDirectory()) { if (!SKIP_DIR.has(name)) walk(p, base, out); continue; }
    if (st.isFile() && INDEXABLE.test(name) && st.size <= MAX_BYTES) out.push(p);
  }
  return out;
}
function roleOf(rel) { const top = rel.split("/")[0]; return /^[a-z-]+$/.test(top) && rel.includes("/") ? top : ""; }
function renderCard(o) {
  if (o && o.type === "outcome") return `OUTCOME ${o.decision_id}: ${o.result || ""} (worked:${o.worked ?? "?"}${o.metric ? `, ${o.metric}` : ""})`;
  if (o && (o.title || o.recommendation)) return [o.title, o.recommendation, o.outcome ? `→ outcome: ${o.outcome}` : "", o.proposed_by ? `(${o.proposed_by})` : ""].filter(Boolean).join(" — ");
  return JSON.stringify(o);
}
function chunksFor(p, rel) {
  const body = readFileSync(p, "utf8");
  const kindBase = /\.jsonl$/i.test(p) ? (/decisions-log/.test(rel) ? "decision-log" : /decisions-pending/.test(rel) ? "decision" : /ledger/.test(rel) ? "ledger" : /metrics/.test(rel) ? "metric" : "record") : "md";
  if (/\.jsonl$/i.test(p)) {
    return body.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { try { const o = JSON.parse(l); return { kind: o.type === "outcome" ? "outcome" : kindBase, text: renderCard(o) }; } catch { return { kind: kindBase, text: l }; } });
  }
  if (/\.json$/i.test(p)) return [{ kind: "json", text: body.slice(0, 4000) }];
  // md/txt: split on blank lines (paragraph chunks), keep non-trivial ones
  return body.split(/\n\s*\n/).map((s) => s.trim()).filter((s) => s.length > 2).map((s) => ({ kind: "md", text: s }));
}

if (cmd === "index") {
  const dir = stateDir();
  if (!existsSync(dir)) die(`no state dir: ${dir}`);
  // keep the regenerable cache out of git (newline-safe: never glue onto an unterminated last line — Codex r7)
  const gi = join(dir, ".gitignore");
  const cur = existsSync(gi) ? readFileSync(gi, "utf8") : "";
  if (!cur.includes(".memory.db")) appendFileSync(gi, ((cur.length && !cur.endsWith("\n")) ? "\n" : "") + ".memory.db\n.memory.db-*\n");
  const db = new DatabaseSync(dbPath(dir));
  db.exec("DROP TABLE IF EXISTS docs");
  db.exec("CREATE VIRTUAL TABLE docs USING fts5(source UNINDEXED, kind UNINDEXED, role UNINDEXED, body, tokenize='porter unicode61')");
  const ins = db.prepare("INSERT INTO docs(source, kind, role, body) VALUES(?,?,?,?)");
  let files = 0, rows = 0;
  for (const p of walk(dir, dir, [])) {
    const rel = relative(dir, p); files++;
    for (const c of chunksFor(p, rel)) { ins.run(rel, c.kind, roleOf(rel), c.text); rows++; }
  }
  db.close();
  console.log(`✓ indexed ${rows} chunks from ${files} files → ${dbPath(dir)} (local, gitignored, regenerable)`);
  process.exit(0);
}

if (cmd === "search") {
  const dir = stateDir();
  if (!existsSync(dbPath(dir))) die(`no index yet — run: company-memory.mjs index --state-dir ${dir}`);
  const q = opt("--query"); if (!q) die('need --query "..."');
  const limit = parseInt(opt("--limit") || "8", 10);
  const role = opt("--role"); const kind = opt("--kind");
  const match = q.split(/\s+/).filter(Boolean).map((t) => `"${t.replace(/"/g, "")}"`).join(" OR ");
  const db = new DatabaseSync(dbPath(dir), { readOnly: true });
  let sql = "SELECT source, kind, role, snippet(docs, 3, '«', '»', ' … ', 14) AS snip, bm25(docs) AS rank FROM docs WHERE docs MATCH ?";
  const args = [match];
  if (role) { sql += " AND role = ?"; args.push(role); }
  if (kind) { sql += " AND kind = ?"; args.push(kind); }
  sql += " ORDER BY rank LIMIT ?"; args.push(limit);
  const hits = db.prepare(sql).all(...args);
  db.close();
  console.log(`=== company-memory search: "${q}"${role ? ` [role:${role}]` : ""}${kind ? ` [kind:${kind}]` : ""} — ${hits.length} hits ===`);
  if (!hits.length) console.log("  (nothing — try broader terms, or re-run `index` if the brain changed)");
  hits.forEach((h, i) => console.log(`\n${i + 1}. [${h.kind}${h.role ? `/${h.role}` : ""}] ${h.source}\n   ${h.snip.replace(/\s+/g, " ").trim()}`));
  process.exit(0);
}

die(`unknown command '${cmd || ""}'. Use: index | search`);
