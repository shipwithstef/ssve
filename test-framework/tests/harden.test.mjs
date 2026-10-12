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
  assert.equal(report.mode, "static+own-tests+smoke");
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
  assert.match(shared, /fix or justify each finding/i);
  const skill = fs.readFileSync(new URL("../../skills/execute-changeset/SKILL.md", import.meta.url), "utf8");
  assert.doesNotMatch(skill, /harden\.mjs/, "execute-changeset stays byte-identical (plan X7)");
});

test("the harden command passes the task delivery profile", () => {
  const shared = fs.readFileSync(new URL("../../_shared/before-starting.md", import.meta.url), "utf8");
  assert.match(shared, /node "\$SVC_ROOT"\/scripts\/harden\.mjs --root \. --profile <delivery_profile>/);
  assert.match(shared, /task's delivery profile/);
  assert.match(shared, /delivery_profile/);
});

test("JSON.parse inside a template is flagged and a regex literal is not", () => {
  const dir = project({
    "util.js": [
      "const sample = \"JSON.parse(raw)\";",
      "const re = /JSON.parse/;",
      "export function read(raw) {",
      "  return `${JSON.parse(raw)}`;",
      "}",
      "export function other(raw) {",
      "  return `n=${",
      "    JSON.parse(raw)",
      "  }`;",
      "}",
    ].join("\n"),
  });
  const report = hardenProject({ root: dir });
  assert.deepEqual(rulesOf(report, "json-parse-without-try").map((f) => f.line), [4, 8]);
  assert.equal(report.findings.some((f) => f.line === 2), false);
});

test("prototype runs the project's own tests plus a smoke walk, not mutation probes", () => {
  const dir = project({
    "util.js": "export const n = 1;\n",
    "util.test.js": "import test from 'node:test'; import assert from 'node:assert/strict'; test('no', () => { assert.equal(1, 2); });\n",
  });
  const report = hardenProject({ root: dir, profile: "prototype" });
  assert.equal(report.mode, "static+own-tests+smoke");
  assert.deepEqual(report.checks, ["static-smoke", "smoke-walk", "ui-check", "own-tests"]);
  assert.equal(report.tests.ran, true);
  assert.equal(report.tests.ok, false);
  assert.equal(report.probes, null);
  assert.equal(report.smoke.ran, false);
  assert.equal(report.smoke.reason, "not-applicable");
  assert.equal(report.ui.ran, false);
  assert.equal(report.ui.reason, "not-applicable");
  assert.equal(report.ok, false);
  assert.deepEqual(rulesOf(report, "own-tests").map((f) => f.file), ["util.test.js"]);
  assert.equal(rulesOf(report, "mutation-threshold").length, 0);
});

test("mvp runs node --test when tests are present and skips when they are not", () => {
  const failing = project({
    "util.js": "export const n = 1;\n",
    "util.test.js": "import test from 'node:test'; import assert from 'node:assert/strict'; test('no', () => { assert.equal(1, 2); });\n",
  });
  const bad = hardenProject({ root: failing, profile: "mvp" });
  assert.deepEqual(bad.checks, ["static-smoke", "smoke-walk", "ui-check", "own-tests", "runtime-probes"]);
  assert.equal(bad.mode, "static+own-tests+smoke+probes");
  assert.equal(bad.tests.ran, true);
  assert.equal(bad.tests.ok, false);
  assert.equal(bad.probes.kind, "runtime");
  assert.equal(bad.probes.ran, true);
  assert.equal(bad.probes.ok, true);
  assert.equal(rulesOf(bad, "mutation-threshold").length, 0);
  assert.deepEqual(rulesOf(bad, "own-tests").map((f) => f.file), ["util.test.js"]);

  const passing = project({
    "util.js": "export const n = 1;\n",
    "util.test.js": "import test from 'node:test'; test('yes', () => {}); \n",
  });
  const good = hardenProject({ root: passing, profile: "mvp" });
  assert.equal(good.tests.ran, true);
  assert.equal(good.tests.ok, true);
  assert.equal(good.ok, true);

  const bare = project({ "util.js": "export const n = 1;\n" });
  const none = hardenProject({ root: bare, profile: "mvp" });
  assert.equal(none.tests.ran, false);
  assert.equal(none.tests.reason, "not-present");
  assert.equal(rulesOf(none, "own-tests").length, 0);
  assert.equal(none.ok, true);
});

test("production runs quality-probes when the probe script is present", () => {
  const weak = project({
    "src.mjs": "export const n = 1;\n",
    "src.test.mjs": "import test from 'node:test'; import assert from 'node:assert/strict'; test('trivial', () => { assert.ok(true); });\n",
  });
  const low = hardenProject({ root: weak, profile: "production" });
  assert.ok(low.checks.includes("quality-probes"));
  assert.ok(low.checks.includes("own-tests"));
  assert.ok(low.checks.includes("runtime-probes"));
  assert.ok(low.checks.includes("smoke-walk"));
  assert.ok(low.checks.includes("ui-check"));
  assert.equal(low.mode, "static+own-tests+smoke+probes");
  assert.equal(low.probes.ran, true);
  assert.equal(low.probes.ok, false);
  assert.equal(low.tests.ok, true);
  assert.equal(rulesOf(low, "mutation-threshold").length, 1);
  assert.equal(low.ok, false);

  const strong = project({
    "add.mjs": "export function add(a, b) {\n  return a + b;\n}\n",
    "add.test.mjs": "import assert from 'node:assert/strict'; import test from 'node:test'; import { add } from './add.mjs'; test('add', () => { assert.equal(add(2, 3), 5); });\n",
  });
  const high = hardenProject({ root: strong, profile: "production" });
  assert.equal(high.probes.ran, true);
  assert.equal(high.tests.ok, true);
  assert.ok(high.probes.mutation >= 0.6, `mutation ${high.probes.mutation} reason ${high.probes.reason}`);
  assert.equal(rulesOf(high, "mutation-threshold").length, 0);
  assert.equal(high.ok, true);

  const prototype = hardenProject({ root: weak, profile: "prototype" });
  assert.equal(prototype.probes, null);
  assert.equal(rulesOf(prototype, "mutation-threshold").length, 0);
});

test("a non-function rejection handler and an empty catch stay unhandled", () => {
  const dir = project({
    "util.js": [
      "export function go(p) {",
      "  p.then(v => v, false);",
      "  p.then(v => v).catch();",
      "  p.then(v => v, () => null);",
      "  p.then(v => v).catch(() => null);",
      "  p.then(v => v, handler);",
      "}",
    ].join("\n"),
  });
  const report = hardenProject({ root: dir });
  assert.deepEqual(rulesOf(report, "unhandled-promise").map((f) => f.line), [2, 3]);
});

test("an uncalled expression arrow or method does not authorize later routes", () => {
  const dir = project({
    "server.js": [
      "const setup = () => app.use(requireAuth);",
      "app.get(\"/open\", (req, res) => { res.end(\"nope\"); });",
      "const api = { setup() { app.use(requireAuth); } };",
      "app.get(\"/also\", (req, res) => { res.end(\"a\"); });",
      "app.use(requireAuth);",
      "app.get(\"/in\", (req, res) => { res.end(\"i\"); });",
    ].join("\n"),
  });
  const report = hardenProject({ root: dir });
  assert.deepEqual(rulesOf(report, "http-authz").map((f) => f.line), [2, 4]);
});

test("idempotency needs a usable key, not a mention or null", () => {
  const dir = project({
    "billing.js": [
      "export function chargeCustomer(sku) {",
      "  stripe.paymentIntents.create({ amount: 100, currency: \"usd\", description: idempotencyNote });",
      "  stripe.paymentIntents.create({ amount: 200, currency: \"usd\", idempotencyKey: null });",
      "  stripe.paymentIntents.create({ amount: 300, currency: \"usd\", idempotencyKey: sku });",
      "}",
    ].join("\n"),
  });
  const report = hardenProject({ root: dir });
  assert.deepEqual(rulesOf(report, "money-idempotency").map((f) => f.line), [2, 3]);
});

test("a regex literal after if () is not an unsafe JSON.parse", () => {
  const dir = project({
    "util.js": [
      "export function read(raw, ok) {",
      "  if (ok) /JSON.parse/.test(raw);",
      "  return JSON.parse(raw);",
      "}",
    ].join("\n"),
  });
  const report = hardenProject({ root: dir });
  assert.deepEqual(rulesOf(report, "json-parse-without-try").map((f) => f.line), [3]);
});

test("a string that mentions console.log(password) is not secret logging", () => {
  const dir = project({
    "server.js": [
      "const note = \"console.log(password)\";",
      "console.log(password);",
    ].join("\n"),
  });
  const report = hardenProject({ root: dir });
  assert.deepEqual(rulesOf(report, "http-secret-in-log").map((f) => f.line), [2]);
});

test("own tests execute the declared scripts.test command", () => {
  const dir = project({
    "package.json": JSON.stringify({ scripts: { test: "node --test only.test.js" } }),
    "only.test.js": "import test from 'node:test'; test('yes', () => {});\n",
    "other.test.js": "import test from 'node:test'; import assert from 'node:assert/strict'; test('no', () => { assert.equal(1, 2); });\n",
  });
  const report = hardenProject({ root: dir, profile: "prototype" });
  assert.equal(report.tests.ran, true);
  assert.equal(report.tests.command, "node --test only.test.js");
  assert.equal(report.tests.ok, true);
  assert.equal(rulesOf(report, "own-tests").length, 0);
});

test("mvp runs runtime probes and every profile walks routes and checks ui", () => {
  const boom = project({
    "boom.mjs": "throw new Error('load failed');\n",
    "ok.test.mjs": "import test from 'node:test'; test('yes', () => {});\n",
  });
  const failed = hardenProject({ root: boom, profile: "mvp" });
  assert.equal(failed.probes.ran, true);
  assert.equal(failed.probes.ok, false);
  assert.deepEqual(rulesOf(failed, "runtime-probe").map((f) => f.file), ["boom.mjs"]);
  assert.equal(rulesOf(failed, "mutation-threshold").length, 0);

  const ui = project({
    "server.js": "app.get(\"/home\", (req, res) => { res.end(\"ok\"); });\n",
    "App.jsx": "export function App() { return <div><a href=\"/home\">Home</a><a href=\"/missing\">Go</a></div>; }\n",
  });
  for (const profile of ["prototype", "mvp", "production"]) {
    const report = hardenProject({ root: ui, profile });
    assert.equal(report.smoke.ran, true, profile);
    assert.equal(report.ui.ran, true, profile);
    assert.equal(report.ui.ok, true, profile);
    assert.deepEqual(rulesOf(report, "smoke-dead-end").map((f) => f.file), ["App.jsx"], profile);
  }
});
