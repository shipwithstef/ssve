// @organism-suite
// Owner rule: cross-family adversarial review is mandatory. A fresh install's default dispatch
// policy must therefore require an external reviewer of a different family for plan and exec
// review; an optional one lets the review gate find zero required external stations.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const policy = JSON.parse(fs.readFileSync(path.join(ROOT, "references", "default-dispatch-policy.json"), "utf8"));

test("the default policy requires a cross-family external reviewer for plan and exec review", () => {
  for (const [name, mode] of Object.entries(policy.modes)) {
    for (const phase of ["plan", "exec"]) {
      const stations = mode.review?.[phase]?.stations || [];
      const author = mode.plan?.tuple?.family || "anthropic";
      const required = stations.filter((s) => s.kind === "external" && s.required === true && s.tuple?.family && s.tuple.family !== author);
      assert.ok(required.length >= 1, `${name}/${phase}: needs a required external reviewer of a family other than ${author}`);
    }
  }
});
