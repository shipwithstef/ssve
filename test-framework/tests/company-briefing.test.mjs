import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const cli = path.join(root, "scripts/company-state.mjs");
const TODAY = "2026-07-22";
// Matches the hook's byte cap in hooks/cos-briefing.mjs (MAX_OUTPUT_BYTES).
const HOOK_CAP = 16 * 1024;

function run(args) {
  const r = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}

function fixture() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "briefing-"));
  const state = path.join(repo, "company-state");
  run(["scaffold", "--repo", repo, "--state-dir", state, "--name", "Acme"]);
  return { repo, state };
}

function openItem(state, title, extra = []) {
  run(["open-item", "--state-dir", state, "--front", "f", "--owner", "o", "--direction", "d", "--title", title,
    "--opened", "2026-07-01", "--sla-days", "3", ...extra]);
}

function addCard(state, id, title) {
  run(["append-decision", "--state-dir", state, "--allow-ungrounded", "--card", JSON.stringify({
    id, proposed_by: "cos", title, door: "two-way", recommendation: "LEDGER_BODY_SECRET recommendation text",
    cost_of_delay: "low", ask: "approve", status: "pending",
  })]);
}

const PATHISH = /(^|[\s"'(=:])(\/[\w.-]+\/|\.{1,2}\/|~\/|[A-Za-z]:\\)/;

test("dashboard --json carries counts and pending asks, no path and no ledger body", () => {
  const { repo, state } = fixture();
  try {
    openItem(state, "Renew vendor contract", ["--ref", "/abs/private/contract.pdf", "--checklist", "CHECKLIST_BODY_SECRET"]);
    addCard(state, "D-2026-07-22-001", "Approve spend");
    fs.appendFileSync(path.join(state, "cos", "ledger.jsonl"), JSON.stringify({ note: "LEDGER_ROW_SECRET" }) + "\n");
    fs.appendFileSync(path.join(state, "decisions-log.jsonl"), JSON.stringify({ id: "D-old", note: "LOG_ROW_SECRET" }) + "\n");
    fs.appendFileSync(path.join(state, "state.md"), "\nSTATE_BODY_SECRET\n");
    const out = run(["dashboard", "--json", "--state-dir", state, "--today", TODAY]);
    const payload = JSON.parse(out);
    assert.equal(payload.counts.open_items, 1);
    assert.equal(payload.counts.overdue, 1);
    assert.equal(payload.counts.pending_decisions, 1);
    assert.deepEqual(Object.keys(payload.pending_decisions[0]).sort(), ["ask", "id", "proposed_by", "risk_domains", "title"]);
    assert.ok(!("state_dir" in payload));
    for (const secret of ["LEDGER_ROW_SECRET", "LOG_ROW_SECRET", "STATE_BODY_SECRET", "CHECKLIST_BODY_SECRET", "LEDGER_BODY_SECRET", "/abs/private"]) {
      assert.ok(!out.includes(secret), secret);
    }
    assert.ok(!out.includes(repo), "state dir path leaked");
    assert.ok(!out.includes(os.tmpdir()), "tmp path leaked");
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});

test("path-like text typed into a title is redacted in both views", () => {
  const { repo, state } = fixture();
  try {
    openItem(state, "Check /srv/example/secret/notes.txt and ../x/y and ~/z");
    addCard(state, "D-2026-07-22-001", "Review C:\\Users\\bob\\file and /var/log/app");
    for (const out of [run(["dashboard", "--json", "--state-dir", state, "--today", TODAY]), run(["briefing", "--state-dir", state, "--today", TODAY])]) {
      assert.doesNotMatch(out, PATHISH);
      assert.ok(!out.includes("someone"));
      assert.ok(out.includes("[path]"));
    }
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});

test("briefing text is rendered from the payload and has no path", () => {
  const { repo, state } = fixture();
  try {
    openItem(state, "Renew vendor contract");
    addCard(state, "D-2026-07-22-001", "Approve spend");
    const text = run(["briefing", "--state-dir", state, "--today", TODAY]);
    assert.ok(text.includes("OI-20260701-001"));
    assert.ok(text.includes("D-2026-07-22-001"));
    assert.ok(text.includes("pending decision"));
    assert.ok(!text.includes(repo));
    assert.doesNotMatch(text, PATHISH);
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});

test("a large briefing is cut by whole lines with a +N more marker, valid UTF-8, under the hook cap", () => {
  const { repo, state } = fixture();
  try {
    const rows = [];
    for (let i = 0; i < 400; i++) {
      rows.push(JSON.stringify({
        id: `OI-20260701-${String(i + 1).padStart(3, "0")}`, ts: "2026-07-01T00:00:00.000Z", front: "f", owner: "o", direction: "d",
        title: `Zażółć gęślą jaźń \u{1F680} ${"é".repeat(60)} item ${i}`, opened: "2026-07-01", sla_days: 3, due: "2026-07-04",
        next_check: "2026-07-01", ref: "", checklist: "", priority: "med", status: "open",
      }));
    }
    fs.writeFileSync(path.join(state, "open-items.jsonl"), rows.join("\n") + "\n");
    const buf = spawnSync(process.execPath, [cli, "briefing", "--state-dir", state, "--today", TODAY], { encoding: "buffer" }).stdout;
    assert.ok(buf.length <= HOOK_CAP, `briefing is ${buf.length} bytes`);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
    assert.ok(!text.includes("\uFFFD"));
    assert.ok(text.endsWith("\n"));
    const m = text.match(/\+(\d+) more/);
    assert.ok(m, "missing +N more marker");
    assert.ok(Number(m[1]) > 0);
    // every item line is whole: it ends with its full title suffix
    const itemLines = text.split("\n").filter((l) => l.includes("OI-2026"));
    assert.ok(itemLines.length > 10 && itemLines.length < 400);
    for (const line of itemLines) assert.match(line, / item \d+$/);
    // shown + hidden covers every item
    assert.equal(itemLines.length + Number(m[1]), 400);
    // counts line is always present and first-class
    assert.match(text, /400 open/);
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});

test("a small briefing is not truncated and has no marker", () => {
  const { repo, state } = fixture();
  try {
    openItem(state, "One item");
    const text = run(["briefing", "--state-dir", state, "--today", TODAY]);
    assert.doesNotMatch(text, /\+\d+ more/);
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});
