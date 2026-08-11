#!/usr/bin/env node
// render-run-summary.mjs — visualize a decision OR a finished result as a self-contained
// HTML artifact: the result, the FLOW (steps), and each DECISION as choice → why →
// consequence → alternatives, all expandable. The human opens this instead of scrolling
// the terminal. Pairs with the `visualize-decisions` rule.
//
// Usage:
//   node scripts/render-run-summary.mjs --report <report.json> [--out docs/status/<run>.html]
//   node scripts/render-run-summary.mjs --run-id <WI/run_id> [--out ...]   # build from pipeline-decisions.jsonl
//
// report.json shape:
//   { "title": str, "result": str, "status": "done|blocked|partial",
//     "flow": [str, ...],
//     "decisions": [{ "choice": str, "why": str, "consequence": str, "alternatives": str }],
//     "issues": [{ "issue": str, "handled": str }] }
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const arg = (f) => { const i = process.argv.indexOf(f); return i !== -1 ? process.argv[i + 1] : null; };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

let report;
const reportPath = arg("--report");
const runId = arg("--run-id");
if (reportPath) {
  report = JSON.parse(readFileSync(path.resolve(ROOT, reportPath), "utf8"));
} else if (runId) {
  const lines = (() => { try { return readFileSync(path.join(ROOT, ".svc/pipeline-decisions.jsonl"), "utf8").trim().split("\n"); } catch { return []; } })();
  const decisions = [];
  for (const l of lines) { try { const e = JSON.parse(l); if (e.run_id === runId) decisions.push({ choice: e.decision || "", why: e.reasoning || "", consequence: `[${e.decision_type || e.type || "decision"}] ${e.skill || ""}`, alternatives: "" }); } catch { /* skip */ } }
  report = { title: `Run summary — ${runId}`, result: `${decisions.length} logged decisions for ${runId}.`, status: "done", flow: [], decisions, issues: [] };
} else {
  console.error("need --report <json> or --run-id <id>"); process.exit(2);
}

const OUT = arg("--out") || `docs/status/run-${String(report.title || "run").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.html`;
const now = new Date().toISOString().replace("T", " ").slice(0, 16);
const stCls = /block/i.test(report.status) ? "planned" : /partial/i.test(report.status) ? "active" : "done";

const flowHtml = (report.flow || []).map((s, i) => `<span class="step">${esc(s)}</span>${i < report.flow.length - 1 ? '<span class="arrow">to</span>' : ""}`).join("");
const decisionsHtml = (report.decisions || []).map((d, i) => `<div class="card"><details${i === 0 ? " open" : ""}><summary><span><b>Decision ${i + 1}:</b> ${esc(String(d.choice).slice(0, 100))}</span></summary><div class="body"><div class="why"><b>Why:</b> ${esc(d.why)}</div>${d.consequence ? `<div class="cons"><b>Consequence:</b> ${esc(d.consequence)}</div>` : ""}${d.alternatives ? `<div class="alt"><b>Alternatives considered:</b> ${esc(d.alternatives)}</div>` : ""}</div></details></div>`).join("") || "<div class='sub'>No decisions logged.</div>";
const issuesHtml = (report.issues || []).map((x) => `<div class="card issue"><div class="body"><b>! ${esc(x.issue)}</b>${x.handled ? `<div class="why"><b>Handled:</b> ${esc(x.handled)}</div>` : ""}</div></div>`).join("") || "<div class='sub'>No issues encountered.</div>";

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(report.title || "Run Summary")}</title><style>
:root{--bg:#0f1115;--card:#171a21;--line:#252a34;--fg:#e6e9ef;--mut:#9aa4b2;--done:#3fb950;--active:#58a6ff;--planned:#d29922;--warn:#f0883e}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.wrap{max-width:920px;margin:0 auto;padding:30px 22px 70px}
h1{font-size:23px;margin:0 0 4px}h2{font-size:13px;margin:30px 0 12px;color:var(--mut);text-transform:uppercase;letter-spacing:.07em}
.sub{color:var(--mut);font-size:13px}
.pill{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid var(--line)}
.pill.done{color:var(--done);background:#0e1f14;border-color:#1c3a23}.pill.active{color:var(--active);background:#0c1a2e}.pill.planned{color:var(--planned);background:#1f1809}
.result{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--done);border-radius:10px;padding:16px 18px;margin:14px 0;font-size:16px}
.flow{display:flex;flex-wrap:wrap;align-items:center;gap:7px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px}
.flow .step{padding:4px 11px;border-radius:7px;background:#10131a;border:1px solid var(--line);font-size:13px}.flow .arrow{color:var(--mut);font-size:12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;margin:8px 0;overflow:hidden}.card.issue{border-left:3px solid var(--warn)}
details>summary{cursor:pointer;padding:13px 16px;list-style:none}details>summary::-webkit-details-marker{display:none}details>summary:hover{background:#1b1f28}
.body{padding:4px 16px 16px;color:var(--fg)}.body>div{padding:6px 0;border-top:1px solid var(--line)}
.why{color:#bcd0ea}.cons{color:#e8d9b0}.alt{color:var(--mut)}
b{color:#fff}
</style></head><body><div class="wrap">
<h1>${esc(report.title || "Run Summary")}</h1>
<div class="sub">${esc(now)} - ${(report.decisions || []).length} decisions - open + expand each for the reasoning</div>
<div class="result">${esc(report.result || "")} <span class="pill ${stCls}">${esc(report.status || "done")}</span></div>
${flowHtml ? `<h2>The flow</h2><div class="flow">${flowHtml}</div>` : ""}
<h2>Decisions - choice, why, consequence</h2>
${decisionsHtml}
<h2>Issues on the way</h2>
${issuesHtml}
<div class="sub" style="margin-top:28px">Generated by scripts/render-run-summary.mjs - per the <code>visualize-decisions</code> rule</div>
</div></body></html>`;

mkdirSync(path.join(ROOT, path.dirname(OUT)), { recursive: true });
writeFileSync(path.join(ROOT, OUT), html);
console.log(`rendered ${OUT} - ${(report.decisions || []).length} decisions, ${(report.flow || []).length} flow steps, ${(report.issues || []).length} issues`);
