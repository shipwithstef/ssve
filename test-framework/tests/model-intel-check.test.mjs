// @organism-suite
// model-intel check: drift vs stub CLIs on a temp PATH. No model calls.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { checkModelIntel, isProbeArgv, reportedModelIds, reportedAliases } from "../../scripts/model-intel.mjs";

const SCRIPT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../scripts/model-intel.mjs");
const SCHEDULE = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../docs/ops/model-intel-check-schedule.md");

const MODELS = {
  updated: "2026-10-10",
  max_age_days: 45,
  models: {
    haiku: { id: "claude-haiku-5-5", price_out: 0.5 },
    sonnet: { id: "claude-sonnet-5-5", price_out: 10 },
  },
};

function host(binary, flags, help) {
  return {
    name: binary,
    binary,
    provision_host: binary,
    roles: { review: ["--print"] },
    probe: { help, flags },
  };
}

function layout() {
  return {
    hosts: {
      alpha: host("alpha", ["--print", "--model"], ["--help"]),
      beta: host("beta", ["--print"], ["--help"]),
      delta: host("delta", ["--print", "--model"], ["--help"]),
      epsilon: host("epsilon", ["--print"], ["--help"]),
      gamma: host("gamma", ["--print"], ["--help"]),
      openish: host("openish", ["--pure"], ["run", "--help"]),
      unsafe: {
        name: "unsafe",
        binary: "unsafe",
        provision_host: "unsafe",
        roles: { review: ["--print"] },
        probe: { help: ["--model", "claude-haiku-5-5"], flags: ["--print"] },
      },
    },
  };
}

function baseline() {
  const tuned = (v) => ({ version_cmd: ["unused", "--version"], tuned_version: v });
  return {
    hosts: {
      alpha: tuned("1.0.0"),
      delta: tuned("1.0.0"),
      epsilon: tuned("1.0.0"),
      gamma: tuned("1.0.0"),
      openish: tuned("1.0.0"),
      unsafe: tuned("1.0.0"),
    },
  };
}

const STUBS = {
  alpha: {
    version: "alpha 1.0.0\nmodels: claude-haiku-5-5\nalias: haiku=claude-haiku-5-5\n",
    help: "--print --model\n",
  },
  delta: { version: "delta 1.0.0\n", help: "--print\n" },
  epsilon: {
    version: "epsilon 1.0.0\nmodels: claude-haiku-5-5 claude-new-9\nalias: haiku=claude-haiku-4-5\nalias: sonnet=claude-sonnet-5-5\n",
    help: "--print\n",
  },
  gamma: { version: "gamma 2.0.0\n", help: "--print\n" },
  openish: { version: "openish 1.0.0\n", help: "--pure\n" },
  unsafe: { version: "unsafe 1.0.0\n", help: "--print\n" },
};

function writeTree(dir) {
  fs.mkdirSync(path.join(dir, "references", "model-intel"), { recursive: true });
  fs.writeFileSync(path.join(dir, "references", "model-intel", "models.json"), JSON.stringify(MODELS, null, 2));
  fs.writeFileSync(path.join(dir, "references", "harness-playbook.json"), JSON.stringify(layout(), null, 2));
  fs.writeFileSync(path.join(dir, "references", "harness-baseline.json"), JSON.stringify(baseline(), null, 2));
}

function writeStubs(binDir, cfgPath, names) {
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(cfgPath, JSON.stringify(STUBS));
  for (const name of names) {
    const file = path.join(binDir, name);
    const src = `#!${process.execPath}
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.STUB_LOG, JSON.stringify({ bin: ${JSON.stringify(name)}, args }) + "\\n");
const cfg = JSON.parse(fs.readFileSync(process.env.STUB_CFG, "utf8"))[${JSON.stringify(name)}];
if (args.includes("--version")) process.stdout.write(cfg.version);
else if (args.includes("--help")) process.stdout.write(cfg.help);
else { process.stderr.write("refused\\n"); process.exit(9); }
`;
    fs.writeFileSync(file, src, { mode: 0o755 });
    fs.chmodSync(file, 0o755);
  }
}

function snapshot(dir) {
  return ["references/model-intel/models.json", "references/harness-playbook.json", "references/harness-baseline.json"]
    .map((rel) => fs.readFileSync(path.join(dir, rel), "utf8")).join("\0");
}

function calls(logPath) {
  if (!fs.existsSync(logPath)) return [];
  return fs.readFileSync(logPath, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

test("probe argv allows help and version only", () => {
  assert.equal(isProbeArgv(["--help"]), true);
  assert.equal(isProbeArgv(["--version"]), true);
  assert.equal(isProbeArgv(["run", "--help"]), true);
  assert.equal(isProbeArgv(["--model", "claude-haiku-5-5"]), false);
  assert.equal(isProbeArgv(["--help", "--model"]), false);
  assert.equal(isProbeArgv(["exec"]), false);
  assert.deepEqual(reportedModelIds("models: a, b\nmodel-id: c\n"), ["a", "b", "c"]);
  assert.deepEqual(reportedAliases("alias: haiku=claude-haiku-5-5\n"), [{ alias: "haiku", id: "claude-haiku-5-5" }]);
});

test("stub CLIs on a temp PATH: drift JSON, exit 1, pins unchanged, no model argv", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "model-intel-"));
  const binDir = path.join(dir, "bin");
  const cfgPath = path.join(dir, "stub.json");
  const logPath = path.join(dir, "calls.log");
  try {
    writeTree(dir);
    writeStubs(binDir, cfgPath, Object.keys(STUBS));
    const before = snapshot(dir);
    const env = { PATH: binDir, STUB_LOG: logPath, STUB_CFG: cfgPath };
    const { code, report } = checkModelIntel({ root: dir, env });
    assert.equal(code, 1);
    assert.equal(report.drift, true);
    assert.equal(report.read_only, true);
    assert.equal(snapshot(dir), before);

    const byHost = Object.fromEntries(report.harnesses.map((h) => [h.host, h]));
    assert.equal(byHost.alpha.installed, true);
    assert.equal(byHost.alpha.version_drift, false);
    assert.equal(byHost.alpha.flag_drift, false);
    assert.equal(byHost.alpha.model_drift, false);
    assert.equal(byHost.beta.installed, false);
    assert.equal(byHost.beta.version_drift, false);
    assert.equal(byHost.gamma.version_drift, true);
    assert.equal(byHost.gamma.version, "2.0.0");
    assert.deepEqual(byHost.delta.missing_flags, ["--model"]);
    assert.equal(byHost.delta.flag_drift, true);
    assert.deepEqual(byHost.epsilon.unknown_models, ["claude-new-9"]);
    assert.deepEqual(byHost.epsilon.alias_drift, [{ alias: "haiku", reported: "claude-haiku-4-5", pinned: "claude-haiku-5-5" }]);
    assert.equal(byHost.openish.flag_drift, false);
    assert.equal(byHost.unsafe.probe_drift, true);

    const kinds = report.findings.map((f) => `${f.host}:${f.kind}`).sort();
    assert.deepEqual(kinds, [
      "delta:flag",
      "epsilon:alias",
      "epsilon:model",
      "gamma:version",
      "unsafe:probe",
    ]);

    const seen = calls(logPath);
    assert.ok(seen.length > 0);
    for (const c of seen) {
      assert.ok(c.args.every((a) => a === "--version" || a === "--help" || a === "run"), JSON.stringify(c));
      assert.ok(!c.args.includes("--model"));
    }
    assert.deepEqual(seen.filter((c) => c.bin === "unsafe").map((c) => c.args), [["--version"]]);
    assert.ok(seen.some((c) => c.bin === "openish" && c.args[0] === "run" && c.args[1] === "--help"));
    assert.equal(seen.some((c) => c.bin === "beta"), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("clean stubs exit 0", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "model-intel-ok-"));
  const binDir = path.join(dir, "bin");
  const cfgPath = path.join(dir, "stub.json");
  const logPath = path.join(dir, "calls.log");
  try {
    fs.mkdirSync(path.join(dir, "references", "model-intel"), { recursive: true });
    fs.writeFileSync(path.join(dir, "references", "model-intel", "models.json"), JSON.stringify(MODELS));
    fs.writeFileSync(path.join(dir, "references", "harness-playbook.json"), JSON.stringify({
      hosts: { alpha: host("alpha", ["--print", "--model"], ["--help"]) },
    }));
    fs.writeFileSync(path.join(dir, "references", "harness-baseline.json"), JSON.stringify({
      hosts: { alpha: { tuned_version: "1.0.0" } },
    }));
    writeStubs(binDir, cfgPath, ["alpha"]);
    const cli = spawnSync(process.execPath, [SCRIPT, "check", "--root", dir], {
      encoding: "utf8",
      env: { PATH: binDir, STUB_LOG: logPath, STUB_CFG: cfgPath },
    });
    assert.equal(cli.status, 0, cli.stderr);
    const report = JSON.parse(cli.stdout);
    assert.equal(report.ok, true);
    assert.equal(report.drift, false);
    assert.equal(report.findings.length, 0);
    assert.equal(report.harnesses[0].version, "1.0.0");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI exit 1 on drift and exit 2 on bad usage", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "model-intel-cli-"));
  const binDir = path.join(dir, "bin");
  const cfgPath = path.join(dir, "stub.json");
  const logPath = path.join(dir, "calls.log");
  try {
    writeTree(dir);
    writeStubs(binDir, cfgPath, Object.keys(STUBS));
    const cli = spawnSync(process.execPath, [SCRIPT, "check", "--root", dir], {
      encoding: "utf8",
      env: { PATH: binDir, STUB_LOG: logPath, STUB_CFG: cfgPath },
    });
    assert.equal(cli.status, 1);
    assert.equal(JSON.parse(cli.stdout).drift, true);
    const usage = spawnSync(process.execPath, [SCRIPT, "nope"], { encoding: "utf8" });
    assert.equal(usage.status, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("check never writes the store", () => {
  const src = fs.readFileSync(SCRIPT, "utf8");
  assert.equal(/\b(writeFile|unlink|rmSync|renameSync|appendFile|truncate|mkdirSync)\b/.test(src), false);
});

test("daily schedule is documented and not an installed unit", () => {
  const doc = fs.readFileSync(SCHEDULE, "utf8");
  assert.match(doc, /cron/);
  assert.match(doc, /systemd|OnCalendar/);
  assert.match(doc, /launchd|StartCalendarInterval/);
  assert.match(doc, /model-intel\.mjs check/);
  assert.match(doc, /Documented only/);
  assert.equal(fs.existsSync(path.resolve(path.dirname(SCHEDULE), "../../scripts/orch/systemd/model-intel-check.service")), false);
  assert.equal(fs.existsSync("/etc/cron.d/model-intel-check"), false);
});
