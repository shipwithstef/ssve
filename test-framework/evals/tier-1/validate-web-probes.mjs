#!/usr/bin/env node
/** Tier 1: the design/UI, performance and security web probes are proven graders. On a
 * planted good build and a planted bad one (fixtures/web-probes/server.mjs), every metric
 * must score the good build better: axe violations, contrast, phone overflow, console
 * errors, frame time, memory growth, XSS, impersonation, security headers and throttling.
 * Where no browser is installed (CI's tier-1 runner), the probe must refuse with exit 3 and
 * say why, never report a pass. */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("web probes separate every planted defect from the good build, or refuse without a browser", () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts/web-probes.mjs"), "prove"], { encoding: "utf8", timeout: 300000 });
  if (r.status === 3) {
    assert.match(r.stderr, /playwright is not installed/);
    return;
  }
  assert.equal(r.status, 0, r.stderr.slice(0, 2000));
  const out = JSON.parse(r.stdout);
  assert.equal(out.ok, true);
  assert.deepEqual(out.checks.map((c) => c.metric).sort(), ["design.axe", "design.console_errors", "design.contrast", "design.phone_overflow", "performance.frame_p95_1p", "performance.memory_growth_mb", "security.headers", "security.impersonation", "security.throttled", "security.xss"]);
  assert.ok(out.checks.every((c) => c.separates));
});

test("the probe refuses a missing build instead of scoring it", () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts/web-probes.mjs")], { encoding: "utf8" });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage/);
});

test("without a browser the proof refuses with exit 3 instead of passing", () => {
  const empty = spawnSync("mktemp", ["-d"], { encoding: "utf8" }).stdout.trim();
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts/web-probes.mjs"), "prove"], { encoding: "utf8", env: { ...process.env, WEB_PROBES_NPM_ROOT: empty } });
  assert.equal(r.status, 3);
  assert.match(r.stderr, /playwright is not installed/);
});
