// Live run-cap enforcement and the prepare() seed commit. No model: a fake claude on PATH
// prints usage lines, or writes a session transcript, then sleeps.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import * as oe from "../../scripts/outcome-eval.mjs";
import { history } from "../../scripts/quality-probes.mjs";

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

function tokensFor(usd) {
  const one = oe.priceUsage("claude-haiku-5-5", { outputTokens: 1 }).usd;
  assert.ok(one > 0);
  return Math.round(usd / one);
}

function usageLine(usd, sessionId) {
  return JSON.stringify({
    type: "assistant",
    sessionId,
    message: { id: "m1", model: "claude-haiku-5-5", usage: { input_tokens: 0, output_tokens: tokensFor(usd) } },
  });
}

function installFakeClaude(dir) {
  const bin = path.join(dir, "bin");
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "claude"), `#!/bin/sh
cat >/dev/null
# A transcript-only run leaves stdout empty so the watchdog's only price is the session file.
if [ -n "$USAGE_LINE" ] && [ "$USAGE_TRANSCRIPT" != 1 ]; then printf '%s\\n' "$USAGE_LINE"; fi
if [ "$USAGE_TRANSCRIPT" = 1 ]; then
  mkdir -p "$HOME/.claude/projects/p"
  printf '%s\\n' "$USAGE_LINE" > "$HOME/.claude/projects/p/s.jsonl"
fi
if [ "$USAGE_HOLD" = 1 ]; then
  sleep 120 &
  echo $! > "$HOME/child.pid"
  wait
fi
`, { mode: 0o755 });
  return bin;
}

function dead(pid) {
  try { process.kill(pid, 0); return false; }
  catch (e) { return e.code === "ESRCH"; }
}

async function waitDead(pid) {
  for (let i = 0; i < 40; i++) {
    if (dead(pid)) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

test("four half-dollar claims cannot all run past a two-dollar cap", () => {
  const live = new Map([["a", 1], ["b", 1], ["c", 1], ["d", 1]]);
  for (const key of live.keys()) {
    assert.equal(oe.runBudgetStop({ cap: 2, spent: 0, live, key, jobUsd: 1, ceiling: 1.5 }), "run-budget");
  }
  const even = new Map([["a", 0.5], ["b", 0.5], ["c", 0.5], ["d", 0.5]]);
  assert.equal(oe.runBudgetStop({ cap: 2, spent: 0, live: even, key: "a", jobUsd: 0.5, ceiling: 1.5 }), null);
  assert.equal(oe.runBudgetStop({ cap: 100, spent: 0, live: new Map([["a", 1.6]]), key: "a", jobUsd: 1.6, ceiling: 1.5 }), "run-budget");
  assert.equal(oe.runBudgetStop({ cap: 2, spent: 0, live: new Map([["a", 0]]), key: "a", jobUsd: 0, ceiling: 1.5 }), null);
});

test("the watchdog kills the process group when live usage would exceed --max-usd", async () => {
  const bin = installFakeClaude(tmp("oe-bw-"));
  const saved = process.env.PATH;
  process.env.PATH = `${bin}${path.delimiter}${saved}`;
  const budget = new oe.Budget(2, 4, 0.01, 0);
  const homes = [];
  try {
    const runs = ["a", "b", "c", "d"].map((id) => {
      const claim = budget.claim();
      assert.ok(Math.abs(claim.usd - 0.5) < 1e-9, String(claim.usd));
      const home = tmp("oe-bw-home-");
      homes.push(home);
      return oe.runAgent(tmp("oe-bw-work-"), "p", "haiku", 8000, undefined, 3, null, [], {
        env: { HOME: home, USAGE_LINE: usageLine(0.6, `s-${id}`), USAGE_HOLD: "1" },
      }, { budget, key: id, claimUsd: claim.usd, home, intervalMs: 40 });
    });
    const rows = await Promise.all(runs);
    let spent = 0;
    for (const row of rows) {
      assert.equal(row.stopped_by, "run-budget", JSON.stringify(row));
      assert.ok(row.cost_usd > 0.5 && row.cost_usd < 1, `spend ${row.cost_usd}`);
      spent += row.cost_usd;
      budget.settle({ usd: 0.5 }, row.cost_usd);
    }
    for (const id of ["a", "b", "c", "d"]) budget.clearLive(id);
    assert.ok(spent > 2 && spent < 4, `settled ${spent} (four uncapped 0.60 jobs would be 2.40, four full dollars would be 4)`);
    assert.ok(Math.abs(budget.spent - spent) < 1e-9);
    for (const home of homes) {
      const pid = Number(fs.readFileSync(path.join(home, "child.pid"), "utf8"));
      assert.equal(await waitDead(pid), true, `grandchild ${pid} still alive`);
    }
  } finally {
    process.env.PATH = saved;
    for (const home of homes) {
      try { process.kill(Number(fs.readFileSync(path.join(home, "child.pid"), "utf8")), "SIGKILL"); } catch { /* already stopped */ }
    }
  }
});

test("a job is killed at 3x its claim even when the run cap is higher", async () => {
  const bin = installFakeClaude(tmp("oe-ceil-"));
  const saved = process.env.PATH;
  process.env.PATH = `${bin}${path.delimiter}${saved}`;
  const budget = new oe.Budget(100, 1, 0.01, 0);
  const home = tmp("oe-ceil-home-");
  try {
    const row = await oe.runAgent(tmp("oe-ceil-work-"), "p", "haiku", 8000, undefined, 3, null, [], {
      env: { HOME: home, USAGE_LINE: usageLine(1.6, "s-ceil"), USAGE_HOLD: "1" },
    }, { budget, key: "ceil", claimUsd: 0.5, home, intervalMs: 40 });
    assert.equal(row.stopped_by, "run-budget", JSON.stringify(row));
    assert.ok(row.cost_usd > 1.5 && row.cost_usd < 2, String(row.cost_usd));
    const pid = Number(fs.readFileSync(path.join(home, "child.pid"), "utf8"));
    assert.equal(await waitDead(pid), true);
  } finally {
    process.env.PATH = saved;
    try { process.kill(Number(fs.readFileSync(path.join(home, "child.pid"), "utf8")), "SIGKILL"); } catch { /* already stopped */ }
  }
});

test("transcript usage is priced and counts when it is the only live signal", async () => {
  const bin = installFakeClaude(tmp("oe-txw-"));
  const saved = process.env.PATH;
  process.env.PATH = `${bin}${path.delimiter}${saved}`;
  // $0.80 of transcript usage against a $0.50 cap: under 3× the claim ($1.50), over the run cap.
  const budget = new oe.Budget(0.5, 1, 0.01, 0);
  const claim = budget.claim();
  assert.ok(Math.abs(claim.usd - 0.5) < 1e-9, String(claim.usd));
  const home = tmp("oe-txw-home-");
  try {
    const row = await oe.runAgent(tmp("oe-txw-work-"), "p", "haiku", 8000, undefined, 3, null, [], {
      env: { HOME: home, USAGE_LINE: usageLine(0.8, "nested-1"), USAGE_TRANSCRIPT: "1", USAGE_HOLD: "1" },
    }, { budget, key: "tx", claimUsd: claim.usd, home, intervalMs: 40 });
    assert.equal(row.stopped_by, "run-budget", JSON.stringify(row));
    const nested = oe.nestedUsage(home, new Set(row.session_id ? [row.session_id] : []));
    const counted = (row.cost_usd || 0) + nested.usd;
    assert.ok(counted > 0.7 && counted < 1, `counted ${counted}`);
    budget.clearLive("tx");
    budget.settle(claim, counted);
    assert.ok(budget.spent > 0.7);
  } finally {
    process.env.PATH = saved;
    try { process.kill(Number(fs.readFileSync(path.join(home, "child.pid"), "utf8")), "SIGKILL"); } catch { /* already stopped */ }
  }
});

test("a seed-only checkout reports 0 builder commits and null first_commit_min", () => {
  const dir = oe.prepare("cron");
  try {
    const seeded = spawnSync("git", ["log", "--format=%an%x1f%s"], { cwd: dir, encoding: "utf8" }).stdout;
    assert.match(seeded, /outcome-eval\x1fInitial commit/);
    const only = history(dir, Date.now());
    assert.equal(only.commits, 0);
    assert.equal(only.first_commit_min, null);
    assert.equal(only.commits_per_10_min, null);
    fs.writeFileSync(path.join(dir, "builder.txt"), "work\n");
    spawnSync("git", ["add", "-A"], { cwd: dir, encoding: "utf8" });
    const commit = spawnSync("git", ["-c", "user.name=builder", "-c", "user.email=builder@example.invalid", "commit", "-qm", "Initial commit"], { cwd: dir, encoding: "utf8" });
    assert.equal(commit.status, 0, commit.stderr);
    const h = history(dir, Date.now() - 60000);
    assert.equal(h.commits, 1, "a same-subject commit by someone else still counts");
    assert.ok(h.first_commit_min >= 0 && h.first_commit_min < 5, String(h.first_commit_min));
    assert.ok(h.commits_per_10_min > 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("history times builder commits by commit date, not author date (an old cherry-pick lands now)", () => {
  const dir = oe.prepare("cron");
  try {
    fs.writeFileSync(path.join(dir, "picked.txt"), "work\n");
    spawnSync("git", ["add", "-A"], { cwd: dir, encoding: "utf8" });
    const env = { ...process.env, GIT_AUTHOR_DATE: "2020-01-01T00:00:00Z" };
    const c = spawnSync("git", ["-c", "user.name=builder", "-c", "user.email=builder@example.invalid", "commit", "-qm", "picked"], { cwd: dir, encoding: "utf8", env });
    assert.equal(c.status, 0, c.stderr);
    const h = history(dir, Date.now() - 60000);
    assert.equal(h.commits, 1);
    assert.ok(h.first_commit_min >= 0 && h.first_commit_min < 5, `commit-date timing expected, got ${h.first_commit_min}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
