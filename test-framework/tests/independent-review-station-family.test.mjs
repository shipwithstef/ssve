// A policy rewriter that pins the required review station onto the orchestrator's
// own host and family must not satisfy authority=independent. The default policy
// keeps release_authority false, so the fence has to live on the station itself.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDispatchExternalReviewer, resolveDispatchReviewTopology } from "../../scripts/resolve-dispatch.mjs";
import { resolveExternalReviewer } from "../../scripts/review-topology-v2.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_POLICY = path.join(ROOT, "references", "default-dispatch-policy.json");
const ENV_KEYS = [
  "SVC_DISPATCH_POLICY",
  "SVC_DISPATCH_OVERRIDE",
  "SVC_DISPATCH_OVERRIDE_REQUESTED",
  "SVC_DISPATCH_OVERRIDE_RECEIPT",
  "SVC_DISPATCH_WORK_OVERLAY",
  "SVC_DISPATCH_UNAVAILABLE_STATIONS",
  "SVC_DISPATCH_EXPLICIT_ASK",
  "SVC_WI",
  "SVC_SESSION_ID",
];

function writePolicy(dir, name, document) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, name);
  fs.writeFileSync(file, `${JSON.stringify(document, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  return file;
}

function pinIndependentToClaude(policy) {
  const copy = structuredClone(policy);
  for (const mode of Object.values(copy.modes)) {
    for (const phase of ["plan", "exec"]) {
      for (const station of mode.review?.[phase]?.stations || []) {
        if (station.kind === "external" && station.authority === "independent") {
          station.tuple = { ...station.tuple, host: "claude", family: "anthropic" };
        }
      }
    }
  }
  return copy;
}

test("independent review station is refused when it resolves to the orchestrator family", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "svc-indep-family-"));
  const saved = {};
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  try {
    const original = JSON.parse(fs.readFileSync(DEFAULT_POLICY, "utf8"));
    const clean = writePolicy(dir, "default-dispatch-policy.json", original);
    const pinned = writePolicy(path.join(dir, "pinned"), "dispatch-policy.json", pinIndependentToClaude(original));
    const base = { orchestrator: "claude", cwd: dir };

    for (const phase of ["plan", "exec"]) {
      const resolved = resolveDispatchExternalReviewer({ ...base, configPath: clean, phase });
      assert.equal(resolved.station.authority, "independent");
      assert.equal(resolved.station.tuple.host, "codex");
      assert.equal(resolved.station.tuple.family, "openai");
      assert.equal(resolved.station.id, "codex-sol-high");

      const viaLauncher = resolveExternalReviewer({ configPath: clean, orchestrator: "claude", phase });
      assert.equal(viaLauncher.station.tuple.host, "codex");
      assert.equal(viaLauncher.station.authority, "independent");

      assert.throws(
        () => resolveDispatchReviewTopology({ ...base, configPath: pinned, phase }),
        (error) => {
          assert.equal(error.code, "dispatch_policy_invalid");
          assert.match(error.message, /independent external authority must be different-family/);
          assert.match(error.message, /resolved family anthropic equals orchestrator family anthropic/);
          return true;
        },
      );
      assert.throws(
        () => resolveDispatchExternalReviewer({ ...base, configPath: pinned, phase }),
        /independent external authority must be different-family/,
      );
      assert.throws(
        () => resolveExternalReviewer({ configPath: pinned, orchestrator: "claude", phase }),
        /independent external authority must be different-family/,
      );
    }
  } finally {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
