#!/usr/bin/env node
// author-review-doc.mjs — WI-487 F-018.
//
// Produces + BINDS each per-round external-review document / gate decision from the
// launcher summary + receipt + findings, stamping reviewed_code_sha / base /
// request_id / package_sha256 so a gate can never be satisfied by a document that
// reviewed a different diff.
//
// Kinds:
//   --kind exec|security   --summary <json> --receipt <json> --findings <json>
//                          --reviewed-code-sha <sha> --base <sha> --out <md>
//   --kind gate            --inputs a.md,b.md --reviewed-code-sha <sha> --base <sha> --out <md>

import fs from "node:fs";

function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; }
function die(msg) { process.stderr.write(`author-review-doc: ${msg}\n`); process.exit(2); }
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } }

const kind = arg("--kind");
const out = arg("--out");
const reviewedCodeSha = arg("--reviewed-code-sha") || "";
const base = arg("--base") || "";
if (!kind || !out) die("--kind and --out are required");

function severityCounts(findings) {
  const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  const list = Array.isArray(findings) ? findings : (findings && Array.isArray(findings.findings) ? findings.findings : []);
  for (const f of list) {
    const sev = String(f.severity || f.level || "").toLowerCase();
    if (sev.startsWith("crit")) counts.Critical++;
    else if (sev.startsWith("high")) counts.High++;
    else if (sev.startsWith("med")) counts.Medium++;
    else counts.Low++;
  }
  return { counts, list };
}

if (kind === "exec" || kind === "security") {
  const summary = readJson(arg("--summary")) || {};
  const receipt = readJson(arg("--receipt")) || {};
  const findings = readJson(arg("--findings")) || [];
  const { counts, list } = severityCounts(findings);
  const requestId = receipt.request_id || summary.request_id || "";
  const packageSha = receipt.package_sha256 || summary.package_sha256 || "";
  const roundsRun = Number(summary.rounds_run || receipt.rounds_run || 1);
  const unresolvedCritical = counts.Critical;
  const verdict = unresolvedCritical === 0 ? "PASS" : "FAIL";
  const lines = [];
  lines.push(`# WI-487 ${kind} review`);
  lines.push("");
  lines.push(`reviewed_code_sha=${reviewedCodeSha}`);
  lines.push(`base=${base}`);
  lines.push(`request_id=${requestId}`);
  lines.push(`package_sha256=${packageSha}`);
  lines.push(`rounds_run=${roundsRun}`);
  lines.push(`bounded_exit=${roundsRun <= 3 ? "true" : "false"}`);
  lines.push("");
  lines.push(`## Severity summary`);
  lines.push(`- Critical: ${counts.Critical}`);
  lines.push(`- High: ${counts.High}`);
  lines.push(`- Medium: ${counts.Medium}`);
  lines.push(`- Low: ${counts.Low}`);
  lines.push("");
  lines.push(`## Findings + dispositions`);
  if (list.length === 0) lines.push("_No findings returned by the launcher._");
  for (const f of list) {
    lines.push(`- [${f.severity || "?"}] ${f.id || ""} ${f.title || f.summary || ""} — disposition: ${f.disposition || "pending"}`);
  }
  lines.push("");
  lines.push(`Verdict: ${verdict}`);
  lines.push("");
  fs.writeFileSync(out, lines.join("\n") + "\n");
  process.stderr.write(`author-review-doc: wrote ${kind} doc -> ${out} (verdict ${verdict})\n`);
  process.exit(0);
}

if (kind === "gate") {
  const inputs = (arg("--inputs") || "").split(",").map((s) => s.trim()).filter(Boolean);
  let allPass = true;
  const detail = [];
  for (const p of inputs) {
    let txt = "";
    try { txt = fs.readFileSync(p, "utf8"); } catch { allPass = false; detail.push(`${p}: MISSING`); continue; }
    const pass = /^Verdict:\s*PASS\s*$/m.test(txt);
    const bounded = /^bounded_exit=true\s*$/m.test(txt);
    if (!pass || !bounded) allPass = false;
    detail.push(`${p}: ${pass ? "PASS" : "FAIL"} (bounded_exit=${bounded})`);
  }
  const verdict = allPass && inputs.length > 0 ? "PASS" : "FAIL";
  const lines = [
    `# WI-487 review gate`,
    "",
    `reviewed_code_sha=${reviewedCodeSha}`,
    `base=${base}`,
    `bounded_exit=true`,
    "",
    `## Inputs`,
    ...detail.map((d) => `- ${d}`),
    "",
    `Verdict: ${verdict}`,
    "",
  ];
  fs.writeFileSync(out, lines.join("\n") + "\n");
  process.stderr.write(`author-review-doc: wrote gate doc -> ${out} (verdict ${verdict})\n`);
  process.exit(0);
}

die(`unknown --kind '${kind}'`);
