// @organism-suite
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

function withCleanEnv(fn) {
  const saved = {};
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  try {
    return fn();
  } finally {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

function multiHarnessPolicy({ self, independent }) {
  const stations = [];
  if (self) {
    stations.push({
      id: "self",
      kind: "inline-self",
      required: true,
      authority: "advisory",
      tuple: self,
    });
  }
  stations.push({
    id: "external-review",
    kind: "external",
    required: true,
    authority: "independent",
    tuple: independent,
  });
  const phase = { release_authority: false, stations };
  return {
    schema_version: 1,
    authority: "repository-owner",
    default_mode: "multi-harness",
    modes: {
      "multi-harness": {
        review: {
          plan: structuredClone(phase),
          exec: structuredClone(phase),
        },
      },
    },
  };
}

test("organism suite marker is the first line so CI discovers this resolver regression", () => {
  const text = fs.readFileSync(fileURLToPath(import.meta.url), "utf8");
  assert.equal(text.startsWith("// @organism-suite\n"), true);
});

test("cursor and opencode take the author family from the inline-self tuple", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "svc-multi-family-"));
  const anthropicExternal = { host: "claude", family: "anthropic", model: "claude-opus-5-5", effort: "high" };
  const openaiExternal = { host: "codex", family: "openai", model: "gpt-5.6-sol", effort: "high" };
  withCleanEnv(() => {
    try {
      for (const orchestrator of ["cursor", "opencode"]) {
        const sameFamily = writePolicy(dir, `${orchestrator}-same.json`, multiHarnessPolicy({
          self: { host: orchestrator, family: "anthropic", model: "claude-opus-5-5", effort: "high" },
          independent: anthropicExternal,
        }));
        const crossFamily = writePolicy(dir, `${orchestrator}-cross.json`, multiHarnessPolicy({
          self: { host: orchestrator, family: "anthropic", model: "claude-opus-5-5", effort: "high" },
          independent: openaiExternal,
        }));
        const relabeled = writePolicy(dir, `${orchestrator}-relabel.json`, multiHarnessPolicy({
          self: { host: "claude", family: "openai", model: "claude-opus-5-5", effort: "high" },
          independent: anthropicExternal,
        }));
        const unknown = writePolicy(dir, `${orchestrator}-unknown.json`, multiHarnessPolicy({
          self: { host: orchestrator, family: "multi", model: "provider-unattested", effort: "high" },
          independent: openaiExternal,
        }));
        const missingSelf = writePolicy(dir, `${orchestrator}-noself.json`, multiHarnessPolicy({
          self: null,
          independent: openaiExternal,
        }));
        for (const phase of ["plan", "exec"]) {
          const base = { orchestrator, cwd: dir, phase };
          assert.throws(
            () => resolveDispatchReviewTopology({ ...base, configPath: sameFamily }),
            (error) => {
              assert.equal(error.code, "dispatch_policy_invalid");
              assert.match(error.message, /independent external authority must be different-family/);
              assert.match(error.message, /resolved family anthropic equals orchestrator family anthropic/);
              return true;
            },
          );
          assert.throws(
            () => resolveDispatchExternalReviewer({ ...base, configPath: sameFamily }),
            /independent external authority must be different-family/,
          );
          assert.throws(
            () => resolveExternalReviewer({ configPath: sameFamily, orchestrator, phase }),
            /independent external authority must be different-family/,
          );

          const resolved = resolveDispatchReviewTopology({ ...base, configPath: crossFamily });
          assert.equal(resolved.orchestrator_family, "anthropic");
          const selected = resolveDispatchExternalReviewer({ ...base, configPath: crossFamily });
          assert.equal(selected.station.authority, "independent");
          assert.equal(selected.station.tuple.host, "codex");
          assert.equal(selected.station.tuple.family, "openai");
          const viaLauncher = resolveExternalReviewer({ configPath: crossFamily, orchestrator, phase });
          assert.equal(viaLauncher.topology.orchestrator_family, "anthropic");
          assert.equal(viaLauncher.station.tuple.host, "codex");

          assert.throws(
            () => resolveDispatchReviewTopology({ ...base, configPath: relabeled }),
            /resolved family anthropic equals orchestrator family anthropic/,
          );

          for (const configPath of [unknown, missingSelf]) {
            assert.throws(
              () => resolveDispatchReviewTopology({ ...base, configPath }),
              (error) => {
                assert.equal(error.code, "dispatch_policy_invalid");
                assert.match(error.message, new RegExp(`orchestrator "${orchestrator}" family is unknown`));
                return true;
              },
            );
            assert.throws(
              () => resolveDispatchExternalReviewer({ ...base, configPath }),
              /family is unknown/,
            );
            assert.throws(
              () => resolveExternalReviewer({ configPath, orchestrator, phase }),
              /family is unknown/,
            );
          }
        }
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

test("an unmapped orchestrator without an attested self family cannot use an independent station", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "svc-unmapped-family-"));
  const openaiExternal = { host: "codex", family: "openai", model: "gpt-5.6-sol", effort: "high" };
  withCleanEnv(() => {
    try {
      const noSelf = writePolicy(dir, "kimi-noself.json", multiHarnessPolicy({ self: null, independent: openaiExternal }));
      const attested = writePolicy(dir, "kimi-attested.json", multiHarnessPolicy({
        self: { host: "kimi", family: "moonshot", model: "kimi-k3", effort: "high" },
        independent: openaiExternal,
      }));
      for (const phase of ["plan", "exec"]) {
        assert.throws(
          () => resolveDispatchReviewTopology({ orchestrator: "kimi", cwd: dir, phase, configPath: noSelf }),
          (error) => {
            assert.equal(error.code, "dispatch_policy_invalid");
            assert.match(error.message, /orchestrator "kimi" family is unknown/);
            return true;
          },
        );
        const ok = resolveDispatchReviewTopology({ orchestrator: "kimi", cwd: dir, phase, configPath: attested });
        assert.ok(ok);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
