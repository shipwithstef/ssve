// @organism-suite
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  LOCK_NAME,
  MAX_BLOCK_BYTES,
  addRule,
  createFreshTemp,
  printForSession,
  resolveRoot,
} from "../../scripts/standing-rules.mjs";

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

test("a pre-existing temp symlink is not followed or installed as the store", () => {
  fixture((root) => {
    const outside = path.join(root, "outside.txt");
    fs.writeFileSync(outside, "OUTSIDE-SENTINEL\n");
    const svc = path.join(root, ".svc");
    fs.mkdirSync(svc);
    const planted = path.join(svc, `.standing-rules.md.${process.pid}.tmp`);
    const fresh = path.join(svc, "fresh.tmp");
    fs.symlinkSync(outside, planted);

    const written = createFreshTemp(svc, "body\n", [planted, fresh]);
    assert.equal(written, fresh);
    assert.equal(fs.lstatSync(fresh).isSymbolicLink(), false);
    assert.equal(fs.readFileSync(fresh, "utf8"), "body\n");
    assert.equal(fs.readFileSync(outside, "utf8"), "OUTSIDE-SENTINEL\n");
    assert.equal(fs.readlinkSync(planted), outside);
    fs.unlinkSync(fresh);

    addRule(root, RULE);
    const store = path.join(svc, "standing-rules.md");
    const storeStat = fs.lstatSync(store);
    assert.equal(storeStat.isSymbolicLink(), false);
    assert.equal(storeStat.isFile(), true);
    assert.match(fs.readFileSync(store, "utf8"), new RegExp(RULE));
    assert.doesNotMatch(fs.readFileSync(store, "utf8"), /OUTSIDE-SENTINEL/);
    assert.equal(fs.readFileSync(outside, "utf8"), "OUTSIDE-SENTINEL\n");
    assert.equal(fs.readlinkSync(planted), outside);
  });
});

function flockChildRunning(pid) {
  let text = "";
  try { text = fs.readFileSync(`/proc/${pid}/task/${pid}/children`, "utf8"); }
  catch { return false; }
  for (const childPid of text.trim().split(/\s+/)) {
    if (!childPid) continue;
    try {
      if (fs.readFileSync(`/proc/${childPid}/comm`, "utf8").trim() === "flock") return true;
    } catch { /* the child exited while we looked */ }
  }
  return false;
}

function addAsync(root, text) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, "add", "--root", root, "--text", text]);
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

test("an add blocked on the store lock re-reads rules committed while it waited", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "standing-rules-"));
  let fd;
  let child;
  try {
    addRule(root, "rule-alpha");
    const store = path.join(root, ".svc", "standing-rules.md");
    fd = fs.openSync(path.join(root, ".svc", LOCK_NAME), fs.constants.O_RDWR);
    const held = spawnSync("flock", ["-n", "-E", "75", "3"], { stdio: ["ignore", "ignore", "pipe", fd] });
    assert.equal(held.status, 0, held.stderr?.toString());

    child = spawn(process.execPath, [cli, "add", "--root", root, "--text", "rule-beta"]);
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const finished = new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ status: null, stdout, stderr: `${stderr}\nTIMEOUT` }), 8000);
      child.on("close", (status) => {
        clearTimeout(timer);
        resolve({ status, stdout, stderr });
      });
    });

    const started = Date.now();
    let sawFlock = false;
    while (Date.now() - started < 5000) {
      if (child.exitCode !== null) break;
      if (flockChildRunning(child.pid)) { sawFlock = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.equal(sawFlock, true, `add did not wait on the store lock: ${stderr}`);
    const mid = fs.readFileSync(store, "utf8");
    assert.match(mid, /rule-alpha/);
    assert.doesNotMatch(mid, /rule-beta/);
    fs.appendFileSync(store, "- rule-gamma\n");

    fs.closeSync(fd);
    fd = undefined;
    const result = await finished;
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "recorded: rule-beta\n");
    const listed = run(["list", "--root", root]);
    assert.equal(listed.stdout, "rule-alpha\nrule-gamma\nrule-beta\n");
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch { /* already closed */ }
    }
    if (child && child.exitCode === null) child.kill("SIGKILL");
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("parallel adds keep every recorded rule", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "standing-rules-"));
  try {
    const rules = ["rule-one", "rule-two", "rule-three", "rule-four", "rule-five", "rule-six"];
    const results = await Promise.all(rules.map((text) => addAsync(root, text)));
    for (const result of results) assert.equal(result.status, 0, result.stderr);
    const listed = run(["list", "--root", root]);
    assert.deepEqual(listed.stdout.trim().split("\n").sort(), [...rules].sort());
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("re-adding an earlier rule reports that normalized rule as a duplicate", () => {
  fixture((root) => {
    const first = "alpha invoices exclude VAT";
    const second = "beta shipping is free over ten";
    const recorded = run(["add", "--root", root, "--text", `  ${first}  `]);
    assert.equal(recorded.status, 0, recorded.stderr);
    assert.equal(recorded.stdout, `recorded: ${first}\n`);
    const later = run(["add", "--root", root, "--text", second]);
    assert.equal(later.status, 0, later.stderr);
    assert.equal(later.stdout, `recorded: ${second}\n`);
    const again = run(["add", "--root", root, "--text", `\t${first}\n`]);
    assert.equal(again.status, 0, again.stderr);
    assert.equal(again.stdout, `duplicate: ${first}\n`);
    assert.doesNotMatch(again.stdout, /beta shipping/);
    const listed = run(["list", "--root", root]);
    assert.equal(listed.stdout, `${first}\n${second}\n`);
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

test("the standing-rules regression file is in the organism suite", () => {
  const source = fs.readFileSync(fileURLToPath(import.meta.url), "utf8");
  assert.equal(source.startsWith("// @organism-suite\n"), true);
  assert.match(source, /\btest\s*\(/);
});

test("session start in a subdirectory prints the ancestor standing rules", () => {
  fixture((root) => {
    assert.equal(run(["add", "--root", root, "--text", RULE]).status, 0);
    const sub = path.join(root, "src", "app");
    fs.mkdirSync(sub, { recursive: true });
    assert.equal(resolveRoot(sub), resolveRoot(root));

    const started = spawnSync(process.execPath, [hook], {
      encoding: "utf8",
      input: JSON.stringify({ hook_event_name: "SessionStart", cwd: sub }),
    });
    assert.equal(started.status, 0, started.stderr);
    assert.match(started.stdout, new RegExp(RULE));
    assert.match(started.stdout, /STANDING RULES/);
    assert.equal(fs.existsSync(path.join(sub, ".svc")), false);
    assert.equal(fs.existsSync(path.join(root, "src", ".svc")), false);

    const second = "shipping labels use the warehouse address";
    const added = run(["add", "--root", sub, "--text", second]);
    assert.equal(added.status, 0, added.stderr);
    assert.equal(added.stdout, `recorded: ${second}\n`);
    assert.equal(run(["list", "--root", sub]).stdout, `${RULE}\n${second}\n`);
    assert.equal(run(["list", "--root", root]).stdout, `${RULE}\n${second}\n`);
    assert.equal(fs.existsSync(path.join(sub, ".svc")), false);
  });
});

test("a git subdirectory records rules at the repository root", () => {
  fixture((root) => {
    fs.mkdirSync(path.join(root, ".git"));
    const sub = path.join(root, "src", "app");
    fs.mkdirSync(sub, { recursive: true });
    assert.equal(resolveRoot(sub), fs.realpathSync(root));
    const added = run(["add", "--root", sub, "--text", RULE]);
    assert.equal(added.status, 0, added.stderr);
    assert.equal(fs.existsSync(path.join(sub, ".svc")), false);
    assert.match(fs.readFileSync(path.join(root, ".svc", "standing-rules.md"), "utf8"), new RegExp(RULE));
    assert.equal(run(["list", "--root", sub]).stdout.trim(), RULE);
    const printed = run(["print-for-session", "--root", sub]);
    assert.match(printed.stdout, new RegExp(RULE));
    assert.match(printed.stdout, /STANDING RULES/);
  });
});

test("a nested project keeps its own standing rules", () => {
  fixture((root) => {
    assert.equal(run(["add", "--root", root, "--text", "outer rule"]).status, 0);
    const inner = path.join(root, "packages", "app");
    const innerSub = path.join(inner, "src");
    fs.mkdirSync(path.join(inner, ".svc"), { recursive: true });
    fs.mkdirSync(innerSub);
    const added = run(["add", "--root", innerSub, "--text", "inner rule"]);
    assert.equal(added.status, 0, added.stderr);
    assert.equal(run(["list", "--root", innerSub]).stdout.trim(), "inner rule");
    assert.equal(run(["list", "--root", root]).stdout.trim(), "outer rule");
    assert.equal(fs.existsSync(path.join(innerSub, ".svc")), false);
  });
});

test("the home directory .svc is not the owning project", () => {
  fixture((root) => {
    const home = path.join(root, "home");
    const project = path.join(home, "project", "src");
    fs.mkdirSync(path.join(home, ".svc"), { recursive: true });
    fs.writeFileSync(path.join(home, ".svc", "standing-rules.md"), "- home rule\n");
    fs.mkdirSync(project, { recursive: true });
    const env = { ...process.env, HOME: home };
    const added = run(["add", "--root", project, "--text", RULE], { env });
    assert.equal(added.status, 0, added.stderr);
    assert.equal(fs.readFileSync(path.join(home, ".svc", "standing-rules.md"), "utf8"), "- home rule\n");
    assert.match(fs.readFileSync(path.join(project, ".svc", "standing-rules.md"), "utf8"), new RegExp(RULE));
    const printed = run(["print-for-session", "--root", project], { env });
    assert.match(printed.stdout, new RegExp(RULE));
    assert.doesNotMatch(printed.stdout, /home rule/);
  });
});

test("add rejects the home directory and the temp root when they are supplied directly", () => {
  fixture((root) => {
    const home = path.join(root, "home");
    const temp = path.join(root, "temp");
    fs.mkdirSync(path.join(home, ".svc"), { recursive: true });
    fs.mkdirSync(path.join(temp, ".git"), { recursive: true });
    fs.writeFileSync(path.join(home, ".svc", "standing-rules.md"), "- home rule\n");
    const env = { ...process.env, HOME: home, TMPDIR: temp };

    const homeAdd = run(["add", "--root", home, "--text", RULE], { env });
    assert.equal(homeAdd.status, 2, homeAdd.stderr);
    assert.match(homeAdd.stderr, /not project roots/);
    assert.equal(fs.readFileSync(path.join(home, ".svc", "standing-rules.md"), "utf8"), "- home rule\n");

    const tempAdd = run(["add", "--root", temp, "--text", RULE], { env });
    assert.equal(tempAdd.status, 2, tempAdd.stderr);
    assert.match(tempAdd.stderr, /not project roots/);
    assert.equal(fs.existsSync(path.join(temp, ".svc")), false);

    const project = path.join(home, "project");
    fs.mkdirSync(project);
    const nested = run(["add", "--root", project, "--text", RULE], { env });
    assert.equal(nested.status, 0, nested.stderr);
    assert.match(fs.readFileSync(path.join(project, ".svc", "standing-rules.md"), "utf8"), new RegExp(RULE));
    assert.equal(fs.readFileSync(path.join(home, ".svc", "standing-rules.md"), "utf8"), "- home rule\n");
  });
});

test("an unmarked temp subdirectory does not climb into the temp root", () => {
  fixture((root) => {
    const sub = path.join(root, "sub");
    fs.mkdirSync(sub);
    assert.equal(run(["add", "--root", sub, "--text", RULE]).status, 0);
    assert.equal(fs.existsSync(path.join(root, ".svc")), false);
    assert.match(fs.readFileSync(path.join(sub, ".svc", "standing-rules.md"), "utf8"), new RegExp(RULE));
    assert.equal(run(["list", "--root", sub]).stdout.trim(), RULE);
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
