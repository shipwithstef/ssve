import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const MAX_TTL_MS = 10 * 60_000;
const OPERATIONS = new Set(["local-land", "remote-promotion", "production-verify"]);
const TUPLE_FIELDS = ["repo_id", "repo_root", "wi", "branch", "worktree_root", "session_id", "generation", "task_id", "head_sha", "tree_sha", "environment", "operation", "command_sha256"];
const sha = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const git = (root, args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const capabilityDir = (stateRoot) => path.join(path.resolve(stateRoot), "promotion-capabilities");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function exactCapabilityId(id) { if (!UUID.test(String(id || ""))) throw new Error("promotion capability id must be a UUID"); return String(id); }
const capabilityPath = (stateRoot, id) => path.join(capabilityDir(stateRoot), `${exactCapabilityId(id)}.json`);
const issuancePath = (stateRoot, id) => path.join(path.resolve(stateRoot), "promotion-issuance", `${exactCapabilityId(id)}.json`);

function ownedRegular(file, label, { privateMode = true } = {}) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || (privateMode && (stat.mode & 0o077) !== 0) || fs.realpathSync(file) !== path.resolve(file) || (typeof process.getuid === "function" && stat.uid !== process.getuid())) throw new Error(`${label} is insecure or foreign-owned`);
}
function secureDirectory(directory, label) {
  const lexical = path.resolve(directory); const lexicalStat = fs.lstatSync(lexical); const real = fs.realpathSync(lexical); const stat = fs.lstatSync(real);
  if (!lexicalStat.isDirectory() || lexicalStat.isSymbolicLink() || real !== lexical || !stat.isDirectory() || stat.isSymbolicLink() ||
      (typeof process.getuid === "function" && stat.uid !== process.getuid())) throw new Error(`${label} is insecure or foreign-owned`);
  return real;
}
function atomicExclusive(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const fd = fs.openSync(file, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + "\n"); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function exactTuple(value) {
  const tuple = value?.tuple || value;
  for (const field of ["repo_id", "repo_root", "wi", "branch", "worktree_root", "session_id", "task_id", "head_sha", "tree_sha", "environment", "operation"]) {
    if (typeof tuple?.[field] !== "string" || !tuple[field].trim()) throw new Error(`promotion tuple missing ${field}`);
  }
  if (!Number.isInteger(tuple.generation) || tuple.generation < 1) throw new Error("promotion tuple requires a positive generation");
  if (!/^[0-9a-f]{40}$/.test(tuple.head_sha) || !/^[0-9a-f]{40}$/.test(tuple.tree_sha)) throw new Error("promotion tuple requires exact 40-hex head/tree SHAs");
  if (!/^[0-9a-f]{64}$/.test(tuple.command_sha256)) throw new Error("promotion tuple requires an exact command SHA-256");
  if (!OPERATIONS.has(tuple.operation)) throw new Error(`unsupported promotion operation: ${tuple.operation}`);
  return Object.fromEntries(TUPLE_FIELDS.map((field) => [field, field === "repo_root" || field === "worktree_root" ? path.resolve(tuple[field]) : tuple[field]]));
}
function exactRepositoryScript(tuple, argument, relative) {
  const expected = fs.realpathSync(path.join(tuple.worktree_root, relative));
  const candidate = path.isAbsolute(argument) ? fs.realpathSync(argument) : fs.realpathSync(path.resolve(tuple.worktree_root, argument));
  ownedRegular(candidate, `promotion executable ${relative}`, { privateMode: false });
  if (candidate !== expected) throw new Error(`promotion executable must be the canonical in-worktree ${relative}`);
}
function remoteRepository(worktree) {
  const remote = git(worktree, ["remote", "get-url", "origin"]);
  const match = remote.match(/github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?$/);
  if (!match) throw new Error("promotion requires a canonical GitHub origin repository");
  return `${match[1]}/${match[2]}`;
}
function exactPromotionCommand(operation, argv, tuple) {
  if (!Array.isArray(argv) || argv.some((arg) => typeof arg !== "string") || argv.length === 0) throw new Error("promotion requires an exact executable argv");
  if (operation === "local-land") {
    if (!(argv.length === 4 && argv[0] === "git" && argv[1] === "commit" && argv[2] === "-m" && argv[3].trim())) {
      throw new Error("local-land permits only: git commit -m <non-empty-message>");
    }
  } else if (operation === "remote-promotion") {
    const exactPush = argv.length === 4 && argv[0] === "git" && argv[1] === "push" && argv[2] === "origin" && argv[3] === `${tuple.head_sha}:refs/heads/${tuple.branch}`;
    let exactMerge = argv.length === 12 && argv[0] === "node" && argv[2] === "--pr" && /^\d+$/.test(argv[3]) && argv[4] === "--squash" && argv[5] === "--delete-branch" && argv[6] === "--expected-repo" && argv[7] === remoteRepository(tuple.worktree_root) && argv[8] === "--expected-head" && argv[9] === tuple.branch && argv[10] === "--expected-head-sha" && argv[11] === tuple.head_sha;
    if (exactMerge) exactRepositoryScript(tuple, argv[1], "scripts/merge-pr-with-review-receipt.mjs");
    if (!exactPush && !exactMerge) throw new Error("remote-promotion permits only an exact branch push or review-receipt-bound squash PR merge argv");
  } else if (operation === "production-verify") {
    if (!(argv.length === 3 && argv[0] === "node" && argv[2] === tuple.head_sha)) {
      throw new Error("production-verify permits only: node scripts/svc-auto-drive.mjs <exact-head-sha>");
    }
    exactRepositoryScript(tuple, argv[1], "scripts/svc-auto-drive.mjs");
  } else throw new Error(`unsupported promotion operation: ${operation}`);
  return [...argv];
}
function repositoryId(worktree) {
  const common = git(worktree, ["rev-parse", "--git-common-dir"]); const absolute = path.resolve(worktree, common);
  return `sha256:${sha(fs.realpathSync(absolute))}`;
}
function bindingFor(worktree, tuple) {
  const dir = path.join(worktree, ".svc", "bindings");
  const matches = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".json")) continue; const file = path.join(dir, name); ownedRegular(file, "promotion binding");
    const row = JSON.parse(fs.readFileSync(file, "utf8"));
    if (row.session_id === tuple.session_id && !row.released_at) matches.push(row);
  }
  if (matches.length !== 1) throw new Error(`promotion requires exactly one current session binding, found ${matches.length}`);
  return matches[0];
}
function verifyAuthority(tuple, { now = Date.now() } = {}) {
  const exact = exactTuple(tuple); const repo = secureDirectory(exact.repo_root, "promotion repository"); const worktree = secureDirectory(exact.worktree_root, "promotion worktree");
  const rows = git(repo, ["worktree", "list", "--porcelain"]).split(/\r?\n/).filter((line) => line.startsWith("worktree ")).map((line) => fs.realpathSync(line.slice(9)));
  if (!rows.includes(worktree)) throw new Error("promotion worktree is not registered in the repository");
  if (git(worktree, ["branch", "--show-current"]) !== exact.branch) throw new Error("promotion branch mismatch");
  if (git(worktree, ["rev-parse", "HEAD"]) !== exact.head_sha) throw new Error("promotion HEAD changed");
  if (git(worktree, ["write-tree"]) !== exact.tree_sha) throw new Error("promotion candidate tree changed");
  if (repositoryId(worktree) !== exact.repo_id) throw new Error("promotion repository identity mismatch");
  const claimFile = path.join(worktree, ".svc", "claims", `${exact.wi}.claim.json`); ownedRegular(claimFile, "promotion claim");
  const claim = JSON.parse(fs.readFileSync(claimFile, "utf8"));
  if (claim.wi !== exact.wi || claim.session_id !== exact.session_id || claim.generation !== exact.generation || claim.branch !== exact.branch ||
      fs.realpathSync(claim.repo_root) !== repo || fs.realpathSync(claim.worktree_root) !== worktree || claim.role !== "mutating") throw new Error("promotion claim tuple mismatch");
  const renewed = Date.parse(claim.renewed_at || claim.started_at); const ttl = Number(claim.ttl_hours || 0) * 60 * 60_000;
  if (!Number.isFinite(renewed) || !Number.isFinite(ttl) || ttl <= 0 || renewed + ttl <= now) throw new Error("promotion claim expired");
  const binding = bindingFor(worktree, exact);
  if (binding.wi !== exact.wi || binding.generation !== exact.generation || binding.branch !== exact.branch ||
      fs.realpathSync(binding.repo_root) !== repo || fs.realpathSync(binding.worktree_root) !== worktree) throw new Error("promotion binding tuple mismatch");
  const graphFile = path.join(worktree, ".svc", `lane-tasks-${exact.wi}.json`); ownedRegular(graphFile, "promotion task graph", { privateMode: false });
  const graph = JSON.parse(fs.readFileSync(graphFile, "utf8")); const task = (graph.tasks || []).find((row) => String(row.id) === exact.task_id);
  const expectedSkill = exact.operation === "production-verify" ? "verify-promotion" : "land-changeset";
  const taskSkill = task?.metadata?.skill || task?.skill;
  if (!task || taskSkill !== expectedSkill || task.status !== "in_progress") throw new Error(`promotion task must be in_progress ${expectedSkill}`);
  return exact;
}
function validateStateRoot(stateRoot, tuple) {
  const root = secureDirectory(stateRoot, "promotion state root"); const svc = fs.realpathSync(path.join(tuple.worktree_root, ".svc"));
  const rel = path.relative(svc, root); if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("promotion state root must be inside the operation worktree .svc directory");
  return root;
}

export function currentPromotionTuple({ repoRoot, worktreeRoot, wi, sessionId, generation, taskId, environment, operation, commandArgv }) {
  const repo = secureDirectory(repoRoot, "promotion repository"); const worktree = secureDirectory(worktreeRoot, "promotion worktree");
  const partial = { repo_id: repositoryId(worktree), repo_root: repo, wi, branch: git(worktree, ["branch", "--show-current"]), worktree_root: worktree,
    session_id: sessionId, generation: Number(generation), task_id: String(taskId), head_sha: git(worktree, ["rev-parse", "HEAD"]), tree_sha: git(worktree, ["write-tree"]), environment, operation };
  const exactArgv = exactPromotionCommand(operation, commandArgv, partial);
  return verifyAuthority({ ...partial, command_sha256: sha(JSON.stringify(exactArgv)) });
}

export function mintPromotionCapability({ stateRoot, tuple, ttlMs = 120_000, now = Date.now() }) {
  const exact = verifyAuthority(tuple, { now }); const state = validateStateRoot(stateRoot, exact); const id = crypto.randomUUID(); const token = crypto.randomBytes(32).toString("hex");
  const record = { schema_version: 2, capability_id: id, tuple: exact, token_sha256: sha(token), issued_at: new Date(now).toISOString(),
    expires_at: new Date(now + Math.min(Math.max(1, ttlMs), MAX_TTL_MS)).toISOString(), state: "issued" };
  const file = capabilityPath(state, id); atomicExclusive(file, record);
  atomicExclusive(issuancePath(state, id), { schema_version: 1, capability_id: id, record_sha256: sha(fs.readFileSync(file)), issued_at: record.issued_at });
  return { capability: record, token };
}

export function consumePromotionCapability({ stateRoot, capabilityId, token, expected, now = Date.now() }) {
  const wanted = verifyAuthority(expected, { now }); const state = validateStateRoot(stateRoot, wanted); const file = capabilityPath(state, capabilityId);
  if (!fs.existsSync(file)) throw new Error("promotion capability missing or already consumed");
  ownedRegular(file, "promotion capability");
  const consumed = `${file}.consumed.${process.pid}.${crypto.randomBytes(6).toString("hex")}`;
  try { fs.renameSync(file, consumed); } catch (error) { throw new Error(error.code === "ENOENT" ? "promotion capability missing or already consumed" : error.message); }
  try {
    ownedRegular(consumed, "promotion capability"); const bytes = fs.readFileSync(consumed); const record = JSON.parse(bytes);
    if (record.capability_id !== exactCapabilityId(capabilityId) || record.state !== "issued") throw new Error("promotion capability identity/state mismatch");
    const issuedAt = Date.parse(record.issued_at); const expiresAt = Date.parse(record.expires_at);
    if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= issuedAt || expiresAt - issuedAt > MAX_TTL_MS || issuedAt > now + 60_000 || expiresAt <= now) throw new Error("promotion capability lifetime is invalid or expired");
    const issueFile = issuancePath(state, capabilityId); ownedRegular(issueFile, "promotion issuance marker"); const issuance = JSON.parse(fs.readFileSync(issueFile, "utf8"));
    if (issuance.capability_id !== capabilityId || issuance.record_sha256 !== sha(bytes)) throw new Error("promotion capability was not minted by the authority boundary");
    const actualToken = Buffer.from(sha(token), "hex"); const expectedToken = Buffer.from(record.token_sha256, "hex");
    if (actualToken.length !== expectedToken.length || !crypto.timingSafeEqual(expectedToken, actualToken)) throw new Error("promotion token mismatch");
    if (TUPLE_FIELDS.some((field) => record.tuple?.[field] !== wanted[field])) throw new Error("promotion tuple mismatch");
    const accepted = { ...record, state: "consumed", consumed_at: new Date(now).toISOString() };
    fs.writeFileSync(consumed, JSON.stringify(accepted, null, 2) + "\n", { mode: 0o600 }); return accepted;
  } catch (error) { try { fs.renameSync(consumed, `${consumed}.rejected`); } catch {} throw error; }
}

export const PROMOTION_CAPABILITY_MAX_MS = MAX_TTL_MS;
