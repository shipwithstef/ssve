// @organism-suite
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { preloadKnowledge } from "../../scripts/k-preload.mjs";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const cli = path.resolve(testsDir, "../../scripts/k-preload.mjs");

function fixture(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "k-preload-"));
  try {
    return fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function write(root, rel, text) {
  const abs = path.join(root, ...rel.split("/"));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
  return abs;
}

test("empty project prints a stable empty digest and writes nothing", () => {
  fixture((root) => {
    const first = preloadKnowledge(root);
    const second = preloadKnowledge(root);
    assert.equal(first.text, second.text);
    assert.match(first.text, /^k-preload facts=0 bytes=\d+ cap=2048 truncated=0\n$/);
    assert.equal(Buffer.byteLength(first.text, "utf8"), first.bytes);
    assert.deepEqual(fs.readdirSync(root), []);
  });
});

test("owner notes, standing rules, NOTES, and decision logs become sourced requirements", () => {
  fixture((root) => {
    write(root, "OWNER-NOTES.md", [
      "# Owner",
      "- Games must use real art, never primitive placeholders.",
      "```",
      "- this fenced line is not a requirement",
      "```",
      "",
    ].join("\n"));
    write(root, "docs/owner-pricing.md", "- Prices are whole cents.\n");
    write(root, "docs/owner/voice.md", "- Voice stays plain and specific.\n");
    write(root, "docs/Owner-skip.md", "- This mixed-case name is not docs/owner*.\n");
    write(root, "NOTES.md", "- Ship the smallest complete journey.\n");
    write(root, "docs/notes-skip.md", "- lowercase notes are not NOTES*.\n");
    write(root, ".svc/standing-rules.md", "- A cancellation inside 6 hours is not refunded.\n");
    write(root, ".svc/pipeline-decisions.jsonl", [
      JSON.stringify({ decision: "Use sqlite because the product is local-first.", kind: "taste" }),
      "not json",
      JSON.stringify({ skill: "research", event: "skill_invocation" }),
      "",
    ].join("\n"));
    write(root, ".svc/agent-decisions.jsonl", JSON.stringify({
      decision_point: "auth library",
      choice: "use the platform session",
    }) + "\n");
    write(root, "docs/decisions/pricing.md", "- Founder price is a single public tier.\n");

    const digest = preloadKnowledge(root);
    assert.match(digest.text, /requirement: Games must use real art, never primitive placeholders\. \(OWNER-NOTES\.md\)/);
    assert.match(digest.text, /requirement: Prices are whole cents\. \(docs\/owner-pricing\.md\)/);
    assert.match(digest.text, /requirement: Voice stays plain and specific\. \(docs\/owner\/voice\.md\)/);
    assert.match(digest.text, /requirement: Ship the smallest complete journey\. \(NOTES\.md\)/);
    assert.match(digest.text, /requirement: A cancellation inside 6 hours is not refunded\. \(\.svc\/standing-rules\.md\)/);
    assert.match(digest.text, /requirement: Use sqlite because the product is local-first\. \(\.svc\/pipeline-decisions\.jsonl\)/);
    assert.match(digest.text, /requirement: auth library: use the platform session \(\.svc\/agent-decisions\.jsonl\)/);
    assert.match(digest.text, /requirement: Founder price is a single public tier\. \(docs\/decisions\/pricing\.md\)/);
    assert.doesNotMatch(digest.text, /fenced line/);
    assert.doesNotMatch(digest.text, /mixed-case/);
    assert.doesNotMatch(digest.text, /lowercase notes/);
    assert.equal(digest.text, preloadKnowledge(root).text);
    const sources = digest.facts.map((fact) => fact.source);
    assert.deepEqual(sources.slice(0, 2), [".svc/standing-rules.md", "OWNER-NOTES.md"]);
  });
});

test("the digest stays inside the byte cap by dropping whole lower-priority facts", () => {
  fixture((root) => {
    write(root, ".svc/standing-rules.md", "- Standing rule alpha must survive the cap.\n");
    write(root, ".svc/pipeline-decisions.jsonl", [
      JSON.stringify({ decision: "Oldest decision beta should be the first fact dropped." }),
      JSON.stringify({ decision: "Newer decision gamma may remain when the cap allows it." }),
    ].join("\n") + "\n");
    const digest = preloadKnowledge(root, { cap: 280 });
    assert.ok(digest.bytes <= 280);
    assert.equal(Buffer.byteLength(digest.text, "utf8"), digest.bytes);
    assert.match(digest.text, /Standing rule alpha must survive the cap/);
    assert.match(digest.text, /truncated=1/);
    assert.doesNotMatch(digest.text, /Oldest decision beta/);
    assert.match(digest.text, /Newer decision gamma/);
    for (const line of digest.text.trimEnd().split("\n")) {
      assert.match(line, /^(?:k-preload facts=\d+ bytes=\d+ cap=280 truncated=\d+|- requirement: .+ \(.+\))$/);
    }
  });
});

test("secret-shaped notes are redacted and symlinks are not read", () => {
  fixture((root) => {
    const secret = ["sk", "live", "notarealkeyvalue"].join("-");
    write(root, "OWNER-NOTES.md", `- Prices stay in whole cents and never log ${secret}.\n`);
    const outside = path.join(root, "outside.md");
    fs.writeFileSync(outside, "- Secret from outside the link target.\n");
    fs.symlinkSync(outside, path.join(root, "NOTES.md"));
    const digest = preloadKnowledge(root);
    assert.equal(digest.text.includes(secret), false);
    assert.match(digest.text, /\[redacted\]/);
    assert.match(digest.text, /whole cents/);
    assert.doesNotMatch(digest.text, /outside the link target/);
    assert.doesNotMatch(digest.text, /\(NOTES\.md\)/);
  });
});

test("prose owner notes with no bullets still yield a fact", () => {
  fixture((root) => {
    write(root, "OWNER-NOTES.md", "Games must look like a real game and use real art.\n");
    const digest = preloadKnowledge(root);
    assert.match(digest.text, /requirement: Games must look like a real game and use real art\. \(OWNER-NOTES\.md\)/);
  });
});

test("escaped quotes inside credential values stay inside the redaction", () => {
  fixture((root) => {
    const leaked = ["reef", "phrase"].join(" ");
    write(root, "OWNER-NOTES.md", [
      String.raw`Store "password": "coral \"${leaked}" and rotate it yearly.`,
      String.raw`The backup reads 'token': 'coral \'${leaked}' before anyone prints it.`,
      "",
    ].join("\n"));
    const digest = preloadKnowledge(root);
    assert.equal(digest.text.includes(leaked), false);
    assert.equal(digest.text.includes("reef"), false);
    assert.equal(digest.text.includes("coral"), false);
    assert.match(digest.text, /\[redacted\]/);
    assert.match(digest.text, /rotate it yearly/);
    assert.match(digest.text, /before anyone prints it/);
  });
});

test("execute-changeset keeps its byte-bound contract and loads k-preload from before-starting", () => {
  const skillPath = path.resolve(testsDir, "../../skills/execute-changeset/SKILL.md");
  const sharedPath = path.resolve(testsDir, "../../_shared/before-starting.md");
  const skill = fs.readFileSync(skillPath, "utf8");
  const shared = fs.readFileSync(sharedPath, "utf8");
  assert.equal(skill.includes("k-preload"), false);
  assert.match(skill, /_shared\/before-starting\.md/);
  assert.match(shared, /node "\$SVC_ROOT"\/scripts\/k-preload\.mjs --root \./);
  assert.match(shared, /treat each printed fact as a requirement/);
  assert.match(shared, /execute-changeset/);
  const blob = spawnSync("git", ["hash-object", skillPath], { encoding: "utf8" });
  assert.equal(blob.status, 0, blob.stderr);
  assert.equal(blob.stdout.trim(), "c8979cedb762d7e34e9619e110dd21e82c68b591");
});

test("quoted credential labels and spaced quoted values are fully redacted", () => {
  fixture((root) => {
    const password = ["orchid", "123456789"].join("");
    const spaced = ["coral", "reef", "phrase"].join(" ");
    write(root, "OWNER-NOTES.md", [
      `Store the admin credential as "password": "${password}" and rotate it yearly.`,
      `The backup reads password: "${spaced}" before anyone prints it.`,
      "",
    ].join("\n"));
    const digest = preloadKnowledge(root);
    assert.equal(digest.text.includes(password), false);
    assert.equal(digest.text.includes(spaced), false);
    assert.equal(digest.text.includes("reef"), false);
    assert.match(digest.text, /\[redacted\]/);
    assert.match(digest.text, /rotate it yearly/);
    assert.match(digest.text, /before anyone prints it/);
    assert.equal(digest.text, preloadKnowledge(root).text);
  });
});

test("prose facts survive beside bullets and multiline bullets stay joined", () => {
  fixture((root) => {
    write(root, "OWNER-NOTES.md", [
      "Games must look like a real game.",
      "",
      "- Use real art,",
      "  never primitive placeholders.",
      "- Ship the smallest journey.",
      "  Qualifier: every paid screen stays specific.",
      "",
      "Painters must keep the palette warm.",
    ].join("\n"));
    const digest = preloadKnowledge(root);
    assert.deepEqual(digest.facts.map((fact) => fact.text), [
      "Games must look like a real game.",
      "Use real art, never primitive placeholders.",
      "Ship the smallest journey. Qualifier: every paid screen stays specific.",
      "Painters must keep the palette warm.",
    ]);
  });
});

test("caps smaller than the digest header are rejected", () => {
  fixture((root) => {
    assert.throws(() => preloadKnowledge(root, { cap: 1 }), /smaller than the digest header/);
    const ran = spawnSync(process.execPath, [cli, "--root", root, "--cap", "1"], { encoding: "utf8" });
    assert.equal(ran.status, 1);
    assert.equal(ran.stdout, "");
    assert.match(ran.stderr, /smaller than the digest header/);

    write(root, "NOTES.md", "- Keep the journey runnable from a clean tree.\n");
    assert.throws(() => preloadKnowledge(root, { cap: 1 }), /smaller than the digest header/);
    const fitted = preloadKnowledge(root, { cap: 80 });
    assert.ok(fitted.bytes <= 80);
    assert.equal(fitted.bytes, Buffer.byteLength(fitted.text, "utf8"));
    assert.match(fitted.text, /^k-preload facts=\d+ bytes=\d+ cap=80 truncated=\d+\n/);
    for (const line of fitted.text.trimEnd().split("\n")) {
      assert.match(line, /^(?:k-preload facts=\d+ bytes=\d+ cap=80 truncated=\d+|- requirement: .+ \(.+\))$/);
    }
  });
});

test("quoted labels with unquoted credentials are redacted", () => {
  fixture((root) => {
    const password = ["orchid", "123456789"].join("");
    const token = ["pine", "99887766"].join("");
    write(root, "OWNER-NOTES.md", [
      `The refund desk stores "password": ${password} and rotates it yearly.`,
      `The backup reads 'token': ${token} before anyone prints it.`,
      "",
    ].join("\n"));
    const digest = preloadKnowledge(root);
    assert.equal(digest.text.includes(password), false);
    assert.equal(digest.text.includes(token), false);
    assert.equal(digest.text.includes("orchid"), false);
    assert.equal(digest.text.includes("99887766"), false);
    assert.match(digest.text, /\[redacted\]/);
    assert.match(digest.text, /refund desk stores/);
    assert.match(digest.text, /rotates it yearly/);
    assert.match(digest.text, /before anyone prints it/);
    assert.equal(digest.text, preloadKnowledge(root).text);
  });
});

test("a refund policy keeps its six-hour exclusion unless the whole fact is dropped", () => {
  fixture((root) => {
    const exclusion = "A cancellation inside six hours is not refunded.";
    const stem = "Refunds are issued for every paid booking when the guest cancels before the session. ";
    let policy = "";
    while (policy.length < 240) policy += stem;
    policy += exclusion;
    assert.ok(policy.length > 240);
    assert.ok(policy.indexOf("six hours") >= 240);
    write(root, ".svc/standing-rules.md", `- ${policy}\n`);

    const fitted = preloadKnowledge(root);
    assert.equal(fitted.truncated, 0);
    assert.equal(fitted.facts.length, 1);
    assert.equal(fitted.facts[0].text, policy);
    assert.match(fitted.text, /six hours is not refunded/);
    assert.equal(fitted.text.includes("…"), false);

    // 360 fits a 240-character slice of this fact and not the complete fact.
    const tight = preloadKnowledge(root, { cap: 360 });
    assert.ok(tight.bytes <= 360);
    assert.equal(tight.bytes, Buffer.byteLength(tight.text, "utf8"));
    assert.equal(tight.truncated, 1);
    assert.deepEqual(tight.facts, []);
    assert.equal(tight.text.includes("Refunds are issued"), false);
    assert.equal(tight.text.includes("six hours"), false);
    assert.equal(tight.text.includes("…"), false);
    assert.match(tight.text, /^k-preload facts=0 bytes=\d+ cap=360 truncated=1\n$/);
  });
});

test("cli --root prints the same digest", () => {
  fixture((root) => {
    write(root, "NOTES.md", "- Keep the journey runnable from a clean tree.\n");
    const ran = spawnSync(process.execPath, [cli, "--root", root, "--cap", "2048"], { encoding: "utf8" });
    assert.equal(ran.status, 0, ran.stderr);
    assert.equal(ran.stdout, preloadKnowledge(root).text);
    const missing = spawnSync(process.execPath, [cli, "--root", path.join(root, "missing")], { encoding: "utf8" });
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /root not found/);
  });
});
