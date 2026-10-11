import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { classifyFile, hardenProject } from "../../scripts/harden.mjs";

const SCRIPT = fileURLToPath(new URL("../../scripts/harden.mjs", import.meta.url));

function project(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harden-"));
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  return dir;
}

function rulesOf(report, rule) {
  return report.findings.filter((finding) => finding.rule === rule);
}

test("clean files of each type produce no findings", () => {
  const dir = project({
    "util.js": "export function read(raw) {\n  try {\n    return JSON.parse(raw);\n  } catch (e) {\n    return null;\n  }\n}\nexport function go(p) {\n  return p.then((v) => v).catch(() => null);\n}\n",
    "server.js": "app.get(\"/health\", requireAuth, (req, res) => { res.end(\"ok\"); });\n",
    "billing.js": "export function chargeCustomer(sku) {\n  const amount = 1999;\n  return stripe.paymentIntents.create({ amount, currency: \"usd\", idempotencyKey: sku });\n}\n",
    "App.jsx": "export function App() {\n  return (\n    <form>\n      <img src=\"x.png\" alt=\"\" />\n      <button type=\"submit\">Save</button>\n      <label htmlFor=\"email\">Email</label>\n      <input id=\"email\" type=\"email\" />\n      <div role=\"button\" onClick={() => {}} onKeyDown={() => {}}>Go</div>\n    </form>\n  );\n}\n",
  });
  const report = hardenProject({ root: dir });
  assert.equal(report.ok, true);
  assert.equal(report.mode, "static");
  assert.deepEqual(report.findings, []);
  assert.deepEqual(report.selection.find((row) => row.file === "server.js").categories, ["http", "js"]);
  assert.deepEqual(report.selection.find((row) => row.file === "billing.js").categories, ["money", "js"]);
  assert.deepEqual(report.selection.find((row) => row.file === "App.jsx").categories, ["ui", "js"]);
});

test("js checks flag JSON.parse outside try and a bare .then", () => {
  const dir = project({
    "util.js": [
      "const sample = \"JSON.parse(raw)\";",
      "// JSON.parse(raw)",
      "export function read(raw) {",
      "  return JSON.parse(raw);",
      "}",
      "export function go(p) {",
      "  p.then((v) => v);",
      "}",
      "export function handled(p) {",
      "  p.then((v) => v, () => null);",
      "}",
    ].join("\n"),
  });
  const report = hardenProject({ root: dir });
  assert.deepEqual(rulesOf(report, "json-parse-without-try").map((f) => f.line), [4]);
  assert.deepEqual(rulesOf(report, "unhandled-promise").map((f) => f.line), [7]);
  assert.match(report.findings[0].location, /^util\.js:\d+$/);
  assert.ok(report.findings.every((f) => f.fix.length > 0));
});

test("http checks cover validation, authz, crashes, and secrets", () => {
  const secret = ["sk", "live"].join("_") + "_" + "abcd1234";
  const dir = project({
    "server.js": [
      `const api_key = "${secret}";`,
      "app.get(\"/a\", requireAuth, (req, res) => { res.end(\"a\"); });",
      "app.post(\"/ok\", requireAuth, (req, res) => {",
      "  if (typeof req.body.name !== \"string\") return res.end(\"bad\");",
      "  res.end(\"ok\");",
      "});",
      "app.post(\"/bad\", requireAuth, (req, res) => {",
      "  res.end(req.body.name);",
      "});",
      "app.get(\"/open\", (req, res) => { res.end(\"nope\"); });",
      "// public",
      "app.get(\"/health\", (req, res) => { res.end(\"ok\"); });",
      "app.get(\"/boom\", requireAuth, async (req, res) => {",
      "  const rows = await db.list();",
      "  res.end(String(rows.length));",
      "});",
      "console.log(password);",
      "console.log(\"password required\");",
    ].join("\n"),
  });
  const report = hardenProject({ root: dir });
  assert.equal(rulesOf(report, "http-secret-in-code").length, 1);
  assert.equal(rulesOf(report, "http-secret-in-code")[0].line, 1);
  assert.deepEqual(rulesOf(report, "http-input-validation").map((f) => f.line), [8]);
  assert.deepEqual(rulesOf(report, "http-authz").map((f) => f.line), [10]);
  assert.deepEqual(rulesOf(report, "http-error-handling").map((f) => f.line), [14]);
  assert.deepEqual(rulesOf(report, "http-secret-in-log").map((f) => f.line), [17]);
});

test("money checks cover cents, client prices, and idempotency", () => {
  const dir = project({
    "billing.js": [
      "export function chargeCustomer(req) {",
      "  const amount = 19.99;",
      "  return stripe.paymentIntents.create({ amount: req.body.amount, currency: \"usd\" });",
      "}",
    ].join("\n"),
    "priced.js": [
      "export function chargeCustomer(sku) {",
      "  const amount = 1999;",
      "  return stripe.paymentIntents.create({ amount, currency: \"usd\", idempotencyKey: sku });",
      "}",
    ].join("\n"),
  });
  const dirty = hardenProject({ root: dir, files: ["billing.js"] });
  assert.deepEqual(rulesOf(dirty, "money-integer-cents").map((f) => f.line), [2]);
  assert.deepEqual(rulesOf(dirty, "money-server-price").map((f) => f.line), [3]);
  assert.deepEqual(rulesOf(dirty, "money-idempotency").map((f) => f.line), [3]);
  const clean = hardenProject({ root: dir, files: ["priced.js"] });
  assert.equal(clean.ok, true);
  assert.deepEqual(clean.scanned, ["priced.js"]);
});

test("ui checks cover alt text, names, labels, and click targets", () => {
  const dir = project({
    "App.jsx": [
      "export function App() {",
      "  return (",
      "    <div>",
      "      <img src=\"x.png\" />",
      "      <button></button>",
      "      <input type=\"text\" />",
      "      <div onClick={() => {}}>Go</div>",
      "      <label>Name <input type=\"text\" /></label>",
      "    </div>",
      "  );",
      "}",
    ].join("\n"),
  });
  const report = hardenProject({ root: dir });
  assert.deepEqual(rulesOf(report, "ui-img-alt").map((f) => f.line), [4]);
  assert.deepEqual(rulesOf(report, "ui-button-name").map((f) => f.line), [5]);
  assert.deepEqual(rulesOf(report, "ui-input-label").map((f) => f.line), [6]);
  assert.deepEqual(rulesOf(report, "ui-click-target").map((f) => f.line), [7]);
  assert.equal(classifyFile("App.jsx", fs.readFileSync(path.join(dir, "App.jsx"), "utf8")).includes("http"), false);
});

test("cli exits 0 when clean and 1 when a finding is reported", () => {
  const cleanDir = project({ "util.js": "export const n = 1;\n" });
  const dirtyDir = project({ "util.js": "export const data = JSON.parse(raw);\n" });
  const clean = spawnSync(process.execPath, [SCRIPT, "--root", cleanDir], { encoding: "utf8" });
  const dirty = spawnSync(process.execPath, [SCRIPT, "--root", dirtyDir], { encoding: "utf8" });
  assert.equal(clean.status, 0, clean.stderr);
  assert.equal(JSON.parse(clean.stdout).findings.length, 0);
  assert.equal(dirty.status, 1, dirty.stderr);
  const body = JSON.parse(dirty.stdout);
  assert.equal(body.findings[0].rule, "json-parse-without-try");
  assert.equal(body.findings[0].location, "util.js:1");
  assert.match(body.findings[0].fix, /try\/catch/);
});

test("a path outside the project root is rejected", () => {
  const dir = project({ "util.js": "export const n = 1;\n" });
  const escaped = spawnSync(process.execPath, [SCRIPT, "--root", dir, "--file", "../outside.js"], { encoding: "utf8" });
  assert.equal(escaped.status, 2);
  assert.match(escaped.stderr, /escapes root|not a file|ENOENT/);
});

test("jsx expression children count as button names", () => {
  const dir = project({
    "App.jsx": [
      "export function App({ label }) {",
      "  return (",
      "    <div>",
      "      <button>{\"Save\"}</button>",
      "      <button>{label}</button>",
      "      <button>{null}</button>",
      "      <button></button>",
      "    </div>",
      "  );",
      "}",
    ].join("\n"),
  });
  const report = hardenProject({ root: dir });
  assert.deepEqual(rulesOf(report, "ui-button-name").map((f) => f.line), [6, 7]);
});

test("preceding app.use(requireAuth) authorizes later routes on that receiver", () => {
  const dir = project({
    "server.js": [
      "app.get(\"/open\", (req, res) => { res.end(\"nope\"); });",
      "app.use(\"/admin\", requireAuth);",
      "app.get(\"/admin/users\", (req, res) => { res.end(\"u\"); });",
      "app.get(\"/health\", (req, res) => { res.end(\"h\"); });",
      "app.use(requireAuth);",
      "app.get(\"/a\", (req, res) => { res.end(\"a\"); });",
      "router.get(\"/z\", (req, res) => { res.end(\"z\"); });",
    ].join("\n"),
  });
  const report = hardenProject({ root: dir });
  assert.deepEqual(rulesOf(report, "http-authz").map((f) => f.line), [1, 4, 7]);
});

test("http checks match executable code and honor public comments", () => {
  const dir = project({
    "server.js": [
      "// app.post(\"/old\", (req, res) => { res.end(req.body.z); throw new Error(\"z\"); });",
      "app.post(\"/open\", async (req, res) => {",
      "  const note = \"requireAuth missing\";",
      "  const retry = \"try again\";",
      "  res.end(req.body.name);",
      "  const rows = await db.list();",
      "  res.end(retry);",
      "});",
      "// public",
      "app.get(\"/health\", (req, res) => { res.end(\"ok\"); });",
    ].join("\n"),
  });
  const report = hardenProject({ root: dir });
  assert.deepEqual(rulesOf(report, "http-authz").map((f) => f.line), [2]);
  assert.deepEqual(rulesOf(report, "http-input-validation").map((f) => f.line), [5]);
  assert.deepEqual(rulesOf(report, "http-error-handling").map((f) => f.line), [6]);
  assert.equal(report.findings.some((f) => f.line === 1 || f.line === 10), false);
});

test("idempotency is checked on each charge, not once per file", () => {
  const dir = project({
    "billing.js": [
      "export function chargeCustomer(sku) {",
      "  stripe.paymentIntents.create({ amount: 100, currency: \"usd\", idempotencyKey: sku });",
      "  stripe.paymentIntents.create({",
      "    amount: 200,",
      "    currency: \"usd\",",
      "  });",
      "}",
    ].join("\n"),
  });
  const report = hardenProject({ root: dir });
  assert.deepEqual(rulesOf(report, "money-idempotency").map((f) => f.line), [3]);
});

test("commas inside a then callback object are not a rejection handler", () => {
  const dir = project({
    "util.js": [
      "export function go(p) {",
      "  p.then(v => { const x = {a:1,b:2}; throw Error(); });",
      "  p.then(v => v, () => null);",
      "  p.then(v => [1, 2]);",
      "}",
    ].join("\n"),
  });
  const report = hardenProject({ root: dir });
  assert.deepEqual(rulesOf(report, "unhandled-promise").map((f) => f.line), [2, 4]);
});

test("harden runs before execute-changeset finishes, without changing execute-changeset's bound bytes (X7)", () => {
  const shared = fs.readFileSync(new URL("../../_shared/before-starting.md", import.meta.url), "utf8");
  assert.match(shared, /node "\$SVC_ROOT"\/scripts\/harden\.mjs --root \./);
  assert.match(shared, /fix or justify each finding/);
  const skill = fs.readFileSync(new URL("../../skills/execute-changeset/SKILL.md", import.meta.url), "utf8");
  assert.doesNotMatch(skill, /harden\.mjs/, "execute-changeset stays byte-identical (plan X7)");
});
