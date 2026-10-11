// The empty task (organism plan §4 "Cost is money"): it measures the fixed catalog
// overhead an arm pays before any work. Nothing is to be built, so the only check is that
// nothing changed. Agent-harness state directories (.svc/, .claude/) are bookkeeping.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const HARNESS = new Set(["spec.md", "visible.test.mjs", "__hidden.test.mjs"]);
// The harness writes package.json when it prepares the build; any other bytes are a change.
const PACKAGE_JSON = '{"type":"module"}\n';
const HARNESS_DIRS = [".svc/", ".claude/"];
function files(dir = ".") {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name === "node_modules" || e.name === ".git") return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : [p.split(path.sep).join("/").replace(/^\.\//, "")];
  });
}

test("nothing changed", () => {
  assert.equal(fs.readFileSync("README.md", "utf8"), "# notes\n\nA placeholder project. It is finished.\n");
  assert.equal(fs.readFileSync("package.json", "utf8"), PACKAGE_JSON, "package.json changed");
  const extra = files().filter((f) => f !== "README.md" && f !== "package.json" && !HARNESS.has(f) && !HARNESS_DIRS.some((d) => f.startsWith(d)));
  assert.deepEqual(extra, [], `unexpected files: ${extra.join(", ")}`);
});
