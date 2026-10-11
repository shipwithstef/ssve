// @organism-suite
/**
 * No review-role invocation in the harness playbook may disable or bypass the sandbox.
 * A reviewer must not be able to write. Hermetic, no model calls.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { loadPlaybook } from "../../scripts/harness-playbook.mjs";

const pb = loadPlaybook();
const reviewRoles = Object.entries(pb.hosts).flatMap(([host, spec]) =>
  Object.entries(spec.roles || {}).filter(([role]) => /review|readonly/.test(role)).map(([role, argv]) => ({ host, role, argv })));

const BYPASS = /bypass|dangerously|danger-full-access|yolo|skip-permissions|workspace-write/i;

test("the playbook has review roles to check", () => {
  assert.ok(reviewRoles.some((r) => r.host === "codex" && r.role === "review"));
  assert.ok(reviewRoles.length >= 4);
});

test("no review-role argv contains a sandbox bypass or dangerous flag", () => {
  for (const { host, role, argv } of reviewRoles) {
    for (const a of argv) assert.ok(!BYPASS.test(a), `${host}.${role} contains ${a}`);
    const i = argv.indexOf("--sandbox");
    if (i >= 0) assert.ok(!/^(disabled|off|none)$/i.test(String(argv[i + 1])), `${host}.${role} disables the sandbox`);
  }
});

test("the codex review role runs in the read-only sandbox", () => {
  const argv = pb.hosts.codex.roles.review;
  const i = argv.indexOf("--sandbox");
  assert.ok(i >= 0 && argv[i + 1] === "read-only");
});

test("the cursor review role keeps its sandbox enabled", () => {
  const argv = pb.hosts.cursor.roles.review;
  assert.equal(argv[argv.indexOf("--sandbox") + 1], "enabled");
});

test("codex probe flags do not require the bypass flag", () => {
  assert.ok(!pb.hosts.codex.probe.flags.some((f) => BYPASS.test(f)));
  assert.ok(pb.hosts.codex.probe.flags.includes("--sandbox"));
});

test("the live review launcher does not use the Codex sandbox bypass flag", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../../scripts/run-external-review.mjs", import.meta.url), "utf8");
  assert.ok(!src.includes("--dangerously-bypass-approvals-and-sandbox"));
  assert.ok(src.includes("'--sandbox', 'read-only'"));
});
