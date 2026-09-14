#!/usr/bin/env node
// render-status.mjs — render svc plan/status/flows as a self-contained HTML artifact.
// Reads existing structured state (no new data), bakes it into one offline .html the
// user opens in a browser / Claude Code artifact viewer. Regenerate per pipeline step.
// Usage: node scripts/render-status.mjs [--out docs/status/svc-status.html]
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const outArg = process.argv.indexOf("--out");
const OUT = outArg !== -1 ? process.argv[outArg + 1] : "docs/status/svc-status.html";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const read = (p) => { try { return readFileSync(path.join(ROOT, p), "utf8"); } catch { return ""; } };

// --- 1. WI status roll-up from INDEX.md ---
function parseIndex() {
  const txt = read("docs/specs/work-items/INDEX.md");
  const rows = [];
  for (const line of txt.split("\n")) {
    const m = line.match(/^- \[(WI-[A-Za-z0-9-]+)\]\([^)]*\)\s*[—-]\s*(.*?)\s*\(?severity[^)]*\)?\s*[—-]?\s*status:([A-Za-z0-9_-]+)/i)
      || line.match(/^- \[(WI-[A-Za-z0-9-]+)\][^—-]*[—-]\s*(.*?)\s*[—-]\s*status:([A-Za-z0-9_-]+)/i);
    if (m) rows.push({ id: m[1], title: m[2].replace(/`/g, ""), status: m[3].toLowerCase() });
  }
  return rows;
}

// --- 2. The Plan: FRAMEWORK-STATE Known Gaps table ---
function parseKnownGaps() {
  const txt = read("FRAMEWORK-STATE.md");
  const seg = txt.split(/## Known Gaps[^\n]*\n/)[1] || "";
  const block = seg.split(/\n## /)[0] || "";
  const gaps = [];
  for (const line of block.split("\n")) {
    if (!line.startsWith("| ") || /^\|\s*Gap\s*\|/.test(line) || /^\|-+/.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length >= 4 && cells[0]) gaps.push({ gap: cells[0], why: cells[1], effort: cells[2], impact: cells[3] });
  }
  return gaps;
}

// --- 3. Recent analysis history (### date: title) ---
function parseAnalysis() {
  const txt = read("FRAMEWORK-STATE.md");
  const seg = txt.split(/## Analysis History/)[1] || "";
  const block = seg.split(/\n## /)[0] || "";
  const out = [];
  const re = /^### (\d{4}-\d{2}-\d{2}):?\s*(.*)$/gm;
  let m;
  while ((m = re.exec(block)) && out.length < 8) out.push({ date: m[1], title: m[2] });
  return out;
}

// --- 4. Lane pipeline flow from skills-manifest laneDefinitions ---
function laneFlow(lane = "greenfield") {
  try {
    const man = JSON.parse(read("skills-manifest.json"));
    return (man.laneDefinitions?.[lane]?.skills) || [];
  } catch { return []; }
}

// --- 5. Active task graphs (.svc/lane-tasks-*.json not completed) ---
function activeGraphs() {
  const dir = path.join(ROOT, ".svc");
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of readdirSync(dir)) {
    if (!/^lane-tasks-.*\.json$/.test(f)) continue;
    try {
      const g = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
      if (g.status === "completed") continue;
      const tasks = Array.isArray(g.tasks) ? g.tasks : [];
      const done = tasks.filter((t) => t.status === "completed").length;
      out.push({ wi: g.wi || f, lane: g.lane || "?", status: g.status || "?", done, total: tasks.length,
        tasks: tasks.map((t) => ({ id: t.id, subject: t.subject || t.metadata?.skill || "", status: t.status, skill: t.metadata?.skill || "" })) });
    } catch { /* skip */ }
  }
  return out.sort((a, b) => String(a.wi).localeCompare(String(b.wi)));
}

// --- 6. Recent commits ---
function recentCommits() {
  try { return execSync("git log --oneline -14", { cwd: ROOT }).toString().trim().split("\n").map((l) => { const i = l.indexOf(" "); return { sha: l.slice(0, i), msg: l.slice(i + 1) }; }); }
  catch { return []; }
}

const idx = parseIndex();
const gaps = parseKnownGaps();
const analysis = parseAnalysis();
const flow = laneFlow("greenfield");
const active = activeGraphs();
const commits = recentCommits();

const norm = (s) => /verif|complete|done|closed/.test(s) ? "done" : /backlog|pending|open/.test(s) ? "planned" : /progress|review/.test(s) ? "active" : "other";
const counts = idx.reduce((a, r) => { a[norm(r.status)] = (a[norm(r.status)] || 0) + 1; return a; }, {});
const pill = (label, cls) => `<span class="pill ${cls}">${esc(label)}</span>`;
const impactCls = (s) => /HIGH/i.test(s) ? "high" : /MEDIUM/i.test(s) ? "med" : "low";

const now = new Date().toISOString().replace("T", " ").slice(0, 16);

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>svc — Plan & Status</title><style>
:root{--bg:#0f1115;--card:#171a21;--line:#252a34;--fg:#e6e9ef;--mut:#9aa4b2;--done:#3fb950;--active:#58a6ff;--planned:#d29922;--high:#f85149;--med:#d29922;--low:#6e7681}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.wrap{max-width:1100px;margin:0 auto;padding:28px 20px 60px}
h1{font-size:22px;margin:0 0 2px}h2{font-size:15px;margin:30px 0 12px;color:var(--mut);text-transform:uppercase;letter-spacing:.06em}
.sub{color:var(--mut);font-size:13px;margin-bottom:20px}
.metrics{display:flex;gap:12px;flex-wrap:wrap}.metric{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 16px;min-width:110px}
.metric .n{font-size:24px;font-weight:700}.metric .l{color:var(--mut);font-size:12px}
.pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid var(--line)}
.pill.done{color:var(--done);border-color:#1c3a23;background:#0e1f14}.pill.active{color:var(--active);border-color:#163055;background:#0c1a2e}
.pill.planned{color:var(--planned);border-color:#3a2e10;background:#1f1809}.pill.high{color:var(--high);border-color:#3a1715;background:#1f0d0c}
.pill.med{color:var(--med)}.pill.low{color:var(--low)}
.flow{display:flex;flex-wrap:wrap;align-items:center;gap:6px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px}
.flow .step{padding:3px 10px;border-radius:7px;background:#10131a;border:1px solid var(--line);font-size:12px}
.flow .arrow{color:var(--mut)}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;margin:8px 0;overflow:hidden}
details>summary{cursor:pointer;padding:12px 16px;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:10px}
details>summary::-webkit-details-marker{display:none}details>summary:hover{background:#1b1f28}
.body{padding:0 16px 14px;color:var(--mut)}.body b{color:var(--fg)}
.row{display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-top:1px solid var(--line)}
code{background:#10131a;padding:1px 5px;border-radius:5px;color:#b9c4d4}
.prog{height:6px;background:#10131a;border-radius:4px;overflow:hidden;min-width:90px;flex:1}.prog>i{display:block;height:100%;background:var(--active)}
a{color:var(--active);text-decoration:none}
</style></head><body><div class="wrap">
<h1>Serious Vibe Coding — Plan &amp; Status</h1>
<div class="sub">Generated ${esc(now)} · self-contained snapshot · open in any browser · expand any row for detail</div>

<div class="metrics">
<div class="metric"><div class="n">${idx.length}</div><div class="l">work items</div></div>
<div class="metric"><div class="n" style="color:var(--done)">${counts.done || 0}</div><div class="l">shipped</div></div>
<div class="metric"><div class="n" style="color:var(--active)">${active.length}</div><div class="l">active graphs</div></div>
<div class="metric"><div class="n" style="color:var(--planned)">${gaps.length}</div><div class="l">roadmap items</div></div>
</div>

<h2>The Plan — roadmap (FRAMEWORK-STATE known gaps)</h2>
${gaps.map((g) => `<div class="card"><details><summary><span>${esc(g.gap.replace(/`/g, "").slice(0, 110))}</span>${pill(g.impact.split("(")[0].trim() || "—", impactCls(g.impact))}</summary><div class="body"><b>Why / status:</b> ${esc(g.why.replace(/`/g, ""))}<div class="row"><span>Effort</span><span>${esc(g.effort)}</span></div><div class="row"><span>Impact</span><span>${esc(g.impact)}</span></div></div></details></div>`).join("") || "<div class='sub'>No open roadmap items.</div>"}

<h2>Greenfield lane — the pipeline flow</h2>
<div class="flow">${flow.map((s, i) => `<span class="step">${esc(s)}</span>${i < flow.length - 1 ? '<span class="arrow">→</span>' : ""}`).join("")}</div>

<h2>Active task graphs</h2>
${active.map((a) => `<div class="card"><details><summary><span>${esc(a.wi)} · <span style="color:var(--mut)">${esc(a.lane)}</span></span><span style="display:flex;align-items:center;gap:8px">${pill(a.status, norm(a.status))}<span class="prog"><i style="width:${a.total ? Math.round(100 * a.done / a.total) : 0}%"></i></span><span style="color:var(--mut);font-size:12px">${a.done}/${a.total}</span></span></summary><div class="body">${a.tasks.map((t) => `<div class="row"><span>${pill(t.status || "?", norm(t.status || ""))} ${esc(String(t.subject).slice(0, 90))}</span><code>${esc(t.skill)}</code></div>`).join("") || "no tasks"}</div></details></div>`).join("") || "<div class='sub'>No active (non-completed) task graphs.</div>"}

<h2>Recent framework analyses</h2>
${analysis.map((a) => `<div class="row"><span><b>${esc(a.date)}</b> ${esc(a.title.slice(0, 120))}</span></div>`).join("") || "<div class='sub'>none</div>"}

<h2>Recent commits</h2>
<div class="card"><div class="body" style="padding:12px 16px">${commits.map((c) => `<div class="row"><code>${esc(c.sha)}</code><span style="flex:1;text-align:left;margin-left:12px">${esc(c.msg.slice(0, 100))}</span></div>`).join("") || "none"}</div></div>

<div class="sub" style="margin-top:30px">Sources: docs/specs/work-items/INDEX.md · FRAMEWORK-STATE.md · .svc/lane-tasks-*.json · skills-manifest.json · git log. Regenerate: <code>node scripts/render-status.mjs</code></div>
</div></body></html>`;

mkdirSync(path.join(ROOT, path.dirname(OUT)), { recursive: true });
writeFileSync(path.join(ROOT, OUT), html);
console.log(`rendered ${OUT} — ${idx.length} WIs, ${gaps.length} roadmap items, ${active.length} active graphs, ${commits.length} commits`);
