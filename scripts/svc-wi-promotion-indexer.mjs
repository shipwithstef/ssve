#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { WI_ID_RE } from "../hooks/lib/wi-id.mjs";

const argv = process.argv.slice(2);
const command = argv[0];
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const fail = (message) => { console.error(JSON.stringify({ ok: false, error: message })); process.exit(1); };
const stateRoot = path.resolve(process.env.SVC_STATE_HOME || path.join(os.homedir(), ".svc"));
const indexPath = path.join(stateRoot, "wi-promotion-index.jsonl");
const runGit = (repo, args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const canonicalRepo = (input) => fs.realpathSync(runGit(path.resolve(input), ["rev-parse", "--show-toplevel"]));
const sleep = (ms) => { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch {} };
const promotedRefFor = (repo) => {
  const candidates = [];
  try { candidates.push(runGit(repo, ["symbolic-ref", "refs/remotes/origin/HEAD"])); } catch {}
  candidates.push("refs/remotes/origin/main", "refs/heads/main");
  for (const candidate of [...new Set(candidates)]) {
    try { return runGit(repo, ["rev-parse", "--verify", `${candidate}^{commit}`]); } catch {}
  }
  fail("default promotion branch is unavailable");
};
const readRows = () => {
  if (!fs.existsSync(indexPath)) return [];
  return fs.readFileSync(indexPath, "utf8").split("\n").filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); } catch { fail(`index line ${index + 1} is invalid JSON`); }
  });
};
const readVerificationEnvelope = (repo, sha) => {
  try { return { envelope: JSON.parse(runGit(repo, ["notes", "--ref=svc-receipts", "show", sha])), source: "refs/notes/svc-receipts" }; }
  catch {
    const mirror = path.join(repo, ".svc", "receipts", sha.slice(0, 7), "verify-promotion.json");
    try { return { envelope: { "verify-promotion": JSON.parse(fs.readFileSync(mirror, "utf8")) }, source: mirror }; }
    catch { fail("consolidated receipt note and development mirror are missing or invalid"); }
  }
};
const validVerificationReceipt = (receipt, wi, sha) => {
  const validTimestamp = typeof receipt?.timestamp === "string" && !Number.isNaN(Date.parse(receipt.timestamp));
  return receipt?.receipt_type === "verify-promotion" && Number.isInteger(receipt.schema_version) && receipt.schema_version >= 1 &&
    receipt.wi === wi && receipt.verdict === "pass" && receipt.passes && typeof receipt.passes === "object" && !Array.isArray(receipt.passes) &&
    ["smoke-http", "e2e-against-main", "install-validation"].includes(receipt.p3_target_type) && validTimestamp &&
    (!receipt.target_sha || receipt.target_sha === sha) && (!receipt.sha || receipt.sha === sha);
};
const withLock = (fn) => {
  fs.mkdirSync(stateRoot, { recursive: true, mode: 0o700 });
  const lock = `${indexPath}.lock`;
  try { if (fs.existsSync(lock) && Date.now() - fs.statSync(lock).mtimeMs > 30_000) fs.rmSync(lock, { force: true }); } catch {}
  let fd = null;
  for (let attempt = 0; attempt < 30 && fd === null; attempt++) {
    try { fd = fs.openSync(lock, "wx", 0o600); } catch { sleep(100); }
  }
  if (fd === null) fail("promotion index is locked");
  const release = () => { try { fs.closeSync(fd); } catch {} try { fs.unlinkSync(lock); } catch {} };
  process.on("exit", release);
  try { return fn(); } finally { release(); process.removeListener("exit", release); }
};

if (command === "index") {
  const wi = opt("--wi"); const shaInput = opt("--sha"); const summary = opt("--summary");
  if (!WI_ID_RE.test(wi || "") || !shaInput || !summary || summary.includes("\n") || summary.length > 500) fail("index requires a valid --wi, --sha, and a one-line --summary up to 500 characters");
  let repo;
  try { repo = canonicalRepo(opt("--repo") || process.cwd()); } catch { fail("--repo is not a Git repository"); }
  if (runGit(repo, ["status", "--porcelain"])) fail("target checkout is dirty");
  let sha;
  try { sha = runGit(repo, ["rev-parse", "--verify", `${shaInput}^{commit}`]); } catch { fail("promoted SHA is not a commit"); }
  const promotedRef = promotedRefFor(repo);
  try { execFileSync("git", ["-C", repo, "merge-base", "--is-ancestor", sha, promotedRef], { stdio: "ignore" }); } catch { fail("SHA is not promoted to origin/main"); }
  const { envelope, source } = readVerificationEnvelope(repo, sha);
  const receipt = envelope["verify-promotion"];
  if (!validVerificationReceipt(receipt, wi, sha)) fail("passing verify-promotion receipt does not match WI/SHA or schema");
  const id = crypto.createHash("sha256").update(`${repo}\0${wi}\0${sha}`).digest("hex");
  const entry = { schema_version: 1, id, repo_path: repo, wi, promoted_sha: sha, summary, receipt_ref: source, verified_at: receipt.timestamp, indexed_at: new Date().toISOString() };
  if (opt("--supersedes-id")) entry.supersedes_id = opt("--supersedes-id");
  withLock(() => {
    const rows = readRows();
    if (rows.some((row) => row.id === id)) { console.log(JSON.stringify({ ok: true, status: "already-indexed", id, path: indexPath })); return; }
    if (entry.supersedes_id && !rows.some((row) => row.id === entry.supersedes_id)) fail("supersedes_id is not present in the index");
    const temp = `${indexPath}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
    try {
      fs.writeFileSync(temp, [...rows, entry].map((row) => JSON.stringify(row)).join("\n") + "\n", { mode: 0o600, flag: "wx" });
      fs.renameSync(temp, indexPath);
    } finally { try { fs.unlinkSync(temp); } catch {} }
    console.log(JSON.stringify({ ok: true, status: "indexed", id, path: indexPath }));
  });
  process.exit(0);
}

if (command === "query") {
  const wi = opt("--wi"); const repoInput = opt("--repo"); const limit = Number.parseInt(opt("--limit") || "3", 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) fail("--limit must be 1..100");
  let repo = null;
  if (repoInput) { try { repo = canonicalRepo(repoInput); } catch { fail("--repo is not a Git repository"); } }
  const rows = readRows().filter((row) => (!wi || row.wi === wi) && (!repo || row.repo_path === repo)).slice(-limit).reverse();
  console.log(JSON.stringify({ ok: true, entries: rows }, null, 2));
  process.exit(0);
}

fail("use: index --repo <git-root> --wi WI-N --sha <sha> --summary <text> | query [--repo <root>] [--wi WI-N] [--limit N]");
