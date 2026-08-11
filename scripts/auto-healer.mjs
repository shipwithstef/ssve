#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const argv = process.argv.slice(2); const command = argv[0];
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const finish = (payload, code = 0) => { console.log(JSON.stringify(payload, null, 2)); process.exit(code); };
function readEvidence(input) {
  if (!input) return ""; const file = path.resolve(input); const stat = fs.statSync(file);
  if (stat.size > 10 * 1024 * 1024) throw new Error("evidence exceeds 10 MiB");
  if (/\.zip$/i.test(file)) {
    try { return execFileSync("unzip", ["-p", file], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }); }
    catch { throw new Error("insufficient_evidence: unzip unavailable or archive invalid"); }
  }
  if (!stat.isFile()) throw new Error("evidence must be a regular file");
  return fs.readFileSync(file, "utf8");
}
if (!["diagnose", "analyze"].includes(command)) finish({ ok: false, error: "use: diagnose [--trace file] [--dom-diff file]" }, 2);
let text; try {
  const trace = readEvidence(opt("--trace"));
  const domRaw = readEvidence(opt("--dom-diff"));
  const dom = domRaw ? JSON.stringify(JSON.parse(domRaw)) : "";
  text = `${trace}\n${dom}`.slice(0, 10 * 1024 * 1024);
} catch (error) { finish({ ok: false, classification: "insufficient_evidence", route: "diagnose-bug", error: error.message }, 2); }
const signals = [];
if (/locator|selector|strict mode|element.*not found|timeout.*click|assertion.*failed/i.test(text)) signals.push({ classification: "code_regression", route: "diagnose-bug", evidence: "trace contains selector, timing, or assertion failure" });
if (/dom[- ]?diff|expected.*(?:dom|screenshot)|visual mismatch|specification changed|acceptance criteria changed/i.test(text)) signals.push({ classification: "spec_drift", route: "sync-spec-code", evidence: "DOM or expectation evidence indicates contract drift" });
if (/HTTP\s*40[13]|unauthori[sz]ed|forbidden|net::ERR_|\bECONN[A-Z]+\b|network request failed|fetch failed|browser (?:is )?unavailable/i.test(text)) signals.push({ classification: "environment", route: "honest-diagnosis", evidence: "runtime, auth, network, or browser environment failed" });
const unique = [...new Map(signals.map((s) => [s.classification, s])).values()];
if (unique.length === 0) finish({ ok: false, classification: "insufficient_evidence", confidence: 0, evidence: [], route: "diagnose-bug", mutated: false }, 2);
const priority = { environment: 3, code_regression: 2, spec_drift: 1 };
unique.sort((a, b) => priority[b.classification] - priority[a.classification]);
const [{ evidence, ...diagnosis }] = unique;
finish({ ok: true, ...diagnosis, confidence: unique.length > 1 ? 0.55 : 0.75, evidence: unique.map((item) => item.evidence), candidates: unique.length > 1 ? unique.map(({ classification, route }) => ({ classification, route })) : undefined, mutated: false, recommendation: "Open the routed diagnostic workflow with this evidence; do not edit source automatically." });
