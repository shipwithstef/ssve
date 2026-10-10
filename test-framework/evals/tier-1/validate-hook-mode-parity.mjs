#!/usr/bin/env node
/** Tier 1: every host resolves the hook mode the same way (review of PR #127). The
 * OpenCode plugin (also installed for MiMo) carries its own resolver; it must match
 * hooks/lib/hook-policy.mjs: owner file first, the environment may raise advisory to
 * enforce but never lower an owner's enforce. The plugin's functions are extracted from
 * its TypeScript source and run with Node's type stripping, so the shipped code is what
 * is tested. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveHookMode } from "../../../hooks/lib/hook-policy.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const src = fs.readFileSync(path.join(ROOT, "hooks/opencode/svc-opencode-plugin.ts"), "utf8");
const grab = (name) => {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} not found in the plugin`);
  let depth = 0, i = src.indexOf("{", start);
  for (; i < src.length; i++) { if (src[i] === "{") depth++; else if (src[i] === "}" && --depth === 0) break; }
  return src.slice(start, i + 1);
};
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hook-parity-"));
const harness = path.join(dir, "harness.ts");
fs.writeFileSync(harness, `import fs from "node:fs";\nimport os from "node:os";\nimport path from "node:path";\n${grab("ownerHookMode")}\n${grab("hookMode")}\nprocess.stdout.write(hookMode());\n`);

function plugin(home, envMode) {
  const env = { ...process.env, HOME: home };
  delete env.SVC_HOOK_MODE;
  if (envMode !== undefined) env.SVC_HOOK_MODE = envMode;
  const r = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", harness], { env, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}

for (const owner of [null, "advisory", "enforce"]) {
  for (const envMode of [undefined, "advisory", "enforce", "bogus"]) {
    test(`owner ${owner ?? "absent"}, SVC_HOOK_MODE ${envMode ?? "unset"}: OpenCode matches the shared resolver`, () => {
      const home = fs.mkdtempSync(path.join(dir, "home-"));
      if (owner) { fs.mkdirSync(path.join(home, ".svc")); fs.writeFileSync(path.join(home, ".svc", "hook-policy.json"), JSON.stringify({ mode: owner })); }
      const env = { HOME: home, ...(envMode !== undefined ? { SVC_HOOK_MODE: envMode } : {}) };
      assert.equal(plugin(home, envMode), resolveHookMode(env, home).mode);
    });
  }
}
