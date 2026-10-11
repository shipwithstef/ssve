import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { MAX_BLOCK_BYTES, printForSession } from "../../scripts/standing-rules.mjs";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const cli = path.resolve(testsDir, "../../scripts/standing-rules.mjs");
const hook = path.resolve(testsDir, "../../hooks/svc-learning-preload.mjs");
const RULE = "invoices show prices excluding VAT, rounded half up";

function fixture(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "standing-rules-"));
  try { return fn(root); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

function run(args, options = {}) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", ...options });
}

test("a rule written in one process is printed for a later session", () => {
  fixture((root) => {
    const added = run(["add", "--root", root, "--text", RULE]);
    assert.equal(added.status, 0, added.stderr);
    const stored = fs.readFileSync(path.join(root, ".svc", "standing-rules.md"), "utf8");
    assert.match(stored, new RegExp(RULE));
    assert.equal(fs.existsSync(path.join(root, "CLAUDE.md")), false);
    assert.equal(fs.existsSync(path.join(root, "AGENTS.md")), false);

    const printed = run(["print-for-session", "--root", root]);
    assert.equal(printed.status, 0, printed.stderr);
    assert.match(printed.stdout, new RegExp(RULE));
    assert.match(printed.stdout, /STANDING RULES/);
    assert.ok(Buffer.byteLength(printed.stdout.trimEnd(), "utf8") <= MAX_BLOCK_BYTES);

    const listed = run(["list", "--root", root]);
    assert.equal(listed.status, 0);
    assert.equal(listed.stdout.trim(), RULE);
  });
});

test("session start prints a rule recorded by an earlier process", () => {
  fixture((root) => {
    const added = run(["add", "--root", root, "--text", RULE]);
    assert.equal(added.status, 0, added.stderr);
    const started = spawnSync(process.execPath, [hook], {
      encoding: "utf8",
      input: JSON.stringify({ hook_event_name: "SessionStart", cwd: root }),
    });
    assert.equal(started.status, 0, started.stderr);
    assert.match(started.stdout, new RegExp(RULE));
    assert.match(started.stdout, /STANDING RULES/);
  });
});

test("empty project prints nothing and writes nothing", () => {
  fixture((root) => {
    assert.equal(printForSession(root), "");
    const printed = run(["print-for-session", "--root", root]);
    assert.equal(printed.status, 0);
    assert.equal(printed.stdout, "");
    assert.equal(fs.existsSync(path.join(root, ".svc")), false);
  });
});

test("a second process keeps the first rule when a later rule would exceed 2 KB", () => {
  fixture((root) => {
    assert.equal(run(["add", "--root", root, "--text", RULE]).status, 0);
    const huge = run(["add", "--root", root, "--text", "x".repeat(MAX_BLOCK_BYTES)]);
    assert.equal(huge.status, 2);
    assert.match(huge.stderr, /2 KB/);
    const printed = run(["print-for-session", "--root", root]);
    assert.match(printed.stdout, new RegExp(RULE));
    assert.doesNotMatch(printed.stdout, /x{20}/);
    assert.ok(Buffer.byteLength(printed.stdout.trimEnd(), "utf8") <= MAX_BLOCK_BYTES);
  });
});

test("duplicate add does not repeat the rule", () => {
  fixture((root) => {
    assert.equal(run(["add", "--root", root, "--text", `  ${RULE}  `]).status, 0);
    assert.equal(run(["add", "--root", root, "--text", RULE]).status, 0);
    const listed = run(["list", "--root", root]);
    assert.equal(listed.stdout.trim().split("\n").length, 1);
  });
});

test("a symlinked store is not read or replaced", () => {
  fixture((root) => {
    const outside = path.join(root, "outside.md");
    fs.mkdirSync(path.join(root, ".svc"));
    fs.writeFileSync(outside, "- secret outside\n");
    fs.symlinkSync(outside, path.join(root, ".svc", "standing-rules.md"));
    const added = run(["add", "--root", root, "--text", RULE]);
    assert.equal(added.status, 2);
    assert.equal(fs.readFileSync(outside, "utf8"), "- secret outside\n");
    const printed = run(["print-for-session", "--root", root]);
    assert.equal(printed.status, 0);
    assert.doesNotMatch(printed.stdout, /secret outside/);
    assert.doesNotMatch(printed.stdout, new RegExp(RULE));
  });
});

test("a copied session-start hook still runs when the standing-rules script is absent", () => {
  fixture((root) => {
    fs.mkdirSync(path.join(root, "hooks"), { recursive: true });
    fs.mkdirSync(path.join(root, "references"), { recursive: true });
    fs.mkdirSync(path.join(root, ".svc"), { recursive: true });
    fs.copyFileSync(hook, path.join(root, "hooks", "svc-learning-preload.mjs"));
    fs.writeFileSync(
      path.join(root, "references", "framework-learnings.jsonl"),
      `${JSON.stringify({
        date: "2026-04-01",
        skill: "test",
        type: "sentinel",
        key: "copied-hook-sentinel",
        insight: "Copied hook sentinel must still preload.",
        confidence: 9,
      })}\n`,
    );
    const started = spawnSync(process.execPath, [path.join(root, "hooks", "svc-learning-preload.mjs")], {
      encoding: "utf8",
      cwd: root,
      input: JSON.stringify({ hook_event_name: "SessionStart", cwd: root }),
    });
    assert.equal(started.status, 0, started.stderr);
    assert.match(started.stdout, /copied-hook-sentinel/);
    assert.doesNotMatch(started.stdout, /STANDING RULES/);
  });
});
