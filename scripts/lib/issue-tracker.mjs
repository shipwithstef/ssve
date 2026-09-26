import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateReceipt } from "../check-chain-receipts.mjs";
import { WI_ID_RE } from "../../hooks/lib/wi-id.mjs";

const NOTE_REF = "refs/notes/svc-receipts";
const TICK = String.fromCharCode(96);
const SCHEMA_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../schemas/project-config.schema.json");
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const now = () => new Date().toISOString();
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
function fail(message) { throw new Error(message); }
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {cwd: options.cwd, encoding: "utf8", input: options.input,
    timeout: 30000, maxBuffer: 8 * 1024 * 1024, env: options.env || process.env,
    stdio: ["pipe", "pipe", "pipe"]});
  if (result.error || result.status !== 0) fail(command + " " + args[0] + (result.error?.code === "ETIMEDOUT" ? " timed out" : " failed"));
  return result.stdout.trim();
}
const git = (root, args) => run("git", args, {cwd: root});
function tryGit(root, args) { try { return git(root, args); } catch { return null; } }

export function resolveRoot(explicit) {
  const requested = path.resolve(explicit || process.cwd());
  const real = fs.realpathSync(requested);
  if (real !== requested || !fs.statSync(real).isDirectory()) fail("root must be a canonical directory");
  const top = git(real, ["rev-parse", "--show-toplevel"]);
  const root = fs.realpathSync(top);
  if (root !== top || (real !== root && !real.startsWith(root + path.sep))) fail("path is outside canonical Git worktree");
  const commonDir = fs.realpathSync(path.resolve(real, git(real, ["rev-parse", "--git-common-dir"])));
  return {root, commonDir};
}
function safePath(base, relative, createParents = false) {
  const target = path.resolve(base, relative);
  if (target !== base && !target.startsWith(base + path.sep)) fail("path escapes worktree");
  const parts = path.relative(base, target).split(path.sep);
  let cursor = base;
  for (let i = 0; i < parts.length; i++) {
    cursor = path.join(cursor, parts[i]);
    if (!fs.existsSync(cursor)) {
      if (i < parts.length - 1 && createParents) fs.mkdirSync(cursor, {mode: 0o700});
      else continue;
    }
    const stat = fs.lstatSync(cursor);
    if (stat.isSymbolicLink()) fail("symlink target refused: " + relative);
    if (i < parts.length - 1 && !stat.isDirectory()) fail("non-directory path component: " + relative);
    if (i === parts.length - 1 && !stat.isFile() && !stat.isDirectory()) fail("not a regular file: " + relative);
  }
  return target;
}
function readJson(file, fallback = null) {
  if (!fs.existsSync(file)) return fallback;
  if (!fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink()) fail("unsafe JSON file");
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { fail("invalid JSON file: " + path.basename(file)); }
}
function atomicWrite(file, content) {
  const parent = path.dirname(file);
  if (!fs.statSync(parent).isDirectory() || fs.lstatSync(parent).isSymbolicLink()) fail("unsafe write directory");
  if (fs.existsSync(file) && (!fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink())) fail("unsafe write target");
  const temp = path.join(parent, "." + path.basename(file) + "." + process.pid + "." + crypto.randomUUID());
  fs.writeFileSync(temp, content, {flag: "wx", mode: 0o600});
  try { fs.renameSync(temp, file); } catch (error) { try { fs.unlinkSync(temp); } catch {} throw error; }
}
const writeJson = (file, value) => atomicWrite(file, JSON.stringify(value, null, 2) + "\n");
function validateConfig(raw) {
  if (!object(raw)) fail("config must be a JSON object");
  const schema = readJson(SCHEMA_PATH);
  if (!schema?.properties?.issue_tracker) fail("project config schema unavailable");
  const settings = raw.issue_tracker;
  if (settings === undefined) return {mode: "local-only", repository: null, close_trigger: "manual"};
  if (!object(settings)) fail("issue_tracker must be an object");
  const fields = schema.properties.issue_tracker.properties;
  const allowed = new Set(Object.keys(fields));
  for (const key of Object.keys(settings)) if (!allowed.has(key)) fail("unknown issue_tracker setting: " + key);
  if (!new Set(fields.mode.enum).has(settings.mode)) fail("invalid issue tracker mode");
  if (settings.repository !== undefined && (typeof settings.repository !== "string" || !new RegExp(fields.repository.pattern).test(settings.repository) || settings.repository.endsWith(".git"))) fail("repository must be exact OWNER/NAME");
  if (settings.mode !== "local-only" && !settings.repository) fail("remote mode requires exact repository");
  if (settings.close_trigger !== undefined && !new Set(fields.close_trigger.enum).has(settings.close_trigger)) fail("invalid close_trigger");
  return {mode: settings.mode, repository: settings.repository || null, close_trigger: settings.close_trigger || "manual"};
}
export function loadConfig(ctx) {
  return validateConfig(readJson(safePath(ctx.root, ".svc/config.json"), {}));
}
export function configure(ctx, mode, repository, closeTrigger, dryRun = false) {
  const file = safePath(ctx.root, ".svc/config.json", !dryRun);
  const current = readJson(file, {});
  validateConfig(current);
  const next = {...current, issue_tracker: {mode,
    ...(repository ? {repository} : current.issue_tracker?.repository ? {repository: current.issue_tracker.repository} : {}),
    close_trigger: closeTrigger || current.issue_tracker?.close_trigger || "manual"}};
  validateConfig(next);
  if (!dryRun) writeJson(file, next);
  return next.issue_tracker;
}
function privateTerms(repository) {
  const file = path.join(os.homedir(), ".svc", "issue-tracker-private-terms.json");
  if (!fs.existsSync(file)) return [];
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o600) fail("private terms file must be owner-only mode 0600");
  const parsed = readJson(file);
  if (!object(parsed)) fail("private terms file must be a repository map");
  const terms = parsed[repository] || [];
  if (!Array.isArray(terms) || terms.some(term => typeof term !== "string" || !term)) fail("private terms must be non-empty strings");
  return terms;
}
function secretFound(value) {
  return /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----|(?:ghp_|gho_|ghu_|ghs_|ghr_|github_pat_)[A-Za-z0-9_]{15,}|AKIA[0-9A-Z]{16}|^\s*Authorization\s*:\s*\S+|(?:api[_-]?key|password|secret)\s*[:=]\s*["\x27]?[A-Za-z0-9_+\/=-]{12,}/im.test(value);
}
export function sanitize(value, ctx, repository) {
  if (typeof value !== "string") fail("public text must be a string");
  if (secretFound(value)) fail("recognizable credential or authorization header refused");
  let result = value;
  for (const root of new Set([os.homedir(), ctx.root])) result = result.split(root).join("[redacted path]");
  for (const term of privateTerms(repository)) result = result.replace(new RegExp(term.replace(/[.*+?^$()|[\]{}\\]/g, "\\$&"), "gi"), "[redacted]");
  if (secretFound(result)) fail("recognizable credential refused");
  return result;
}
function requireRemote(config, action, wi = null) {
  if (config.mode === "local-only") fail(action + " requires --configure github-backed or hybrid-governed");
  if (action === "publish" && config.mode === "github-backed" && !/^WI-GH-[1-9][0-9]*$/.test(wi)) fail("github-backed publishes adopted WI-GH-N only; switch to hybrid-governed");
}
function gh(ctx, config, method, apiPath, payload = null) {
  const prefix = "repos/" + config.repository;
  if (apiPath !== prefix && !apiPath.startsWith(prefix + "/")) fail("GitHub endpoint repository mismatch");
  const env = {...process.env};
  delete env.GH_HOST; delete env.GH_REPO; delete env.GH_ENTERPRISE_TOKEN;
  const args = ["api", "--hostname", "github.com", "-X", method, apiPath];
  if (payload !== null) args.push("--input", "-");
  const output = run("gh", args, {cwd: ctx.root, env, input: payload === null ? undefined : JSON.stringify(payload)});
  try { return JSON.parse(output); } catch { fail("GitHub returned invalid JSON"); }
}
const endpoint = (config, suffix = "") => "repos/" + config.repository + suffix;
const expectedUrl = (repository, number) => "https://github.com/" + repository + "/issues/" + number;
function validateIssue(issue, config, number) {
  if (!object(issue) || issue.pull_request || issue.number !== number || issue.html_url !== expectedUrl(config.repository, number)) fail("GitHub issue identity or type conflict");
  if (typeof issue.title !== "string" || !(typeof issue.body === "string" || issue.body === null)) fail("GitHub issue title/body malformed");
  if (issue.body === null) issue.body = "";
  return issue;
}
const getIssue = (ctx, config, number) => validateIssue(gh(ctx, config, "GET", endpoint(config, "/issues/" + number)), config, number);
function trackerDir(ctx) {
  const dir = safePath(ctx.commonDir, "svc-issue-tracker");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, {mode: 0o700});
  if (!fs.statSync(dir).isDirectory() || fs.lstatSync(dir).isSymbolicLink()) fail("unsafe tracker directory");
  return dir;
}
const mapPath = ctx => path.join(trackerDir(ctx), "map.json");
const emptyMap = () => ({schema_version: 2, repositories: {}});
function loadMap(ctx) {
  const dir = safePath(ctx.commonDir, "svc-issue-tracker");
  const map = fs.existsSync(dir) ? readJson(path.join(dir, "map.json"), emptyMap()) : emptyMap();
  if (!object(map) || map.schema_version !== 2 || !object(map.repositories)) fail("invalid shared issue map");
  return map;
}
const saveMap = (ctx, map) => writeJson(mapPath(ctx), map);
function issues(map, repository) {
  if (!object(map.repositories[repository])) map.repositories[repository] = {issues: {}};
  if (!object(map.repositories[repository].issues)) fail("invalid repository issue map");
  return map.repositories[repository].issues;
}
const lockPath = ctx => path.join(trackerDir(ctx), "lock");
function recoverLock(ctx) {
  const lock = lockPath(ctx);
  if (!fs.existsSync(lock)) return false;
  const stat = fs.lstatSync(lock);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== process.getuid()) fail("unsafe tracker lock");
  const value = readJson(lock);
  if (!object(value) || value.host !== os.hostname() || !Number.isInteger(value.pid) || value.pid < 1) fail("tracker lock owner cannot be proven dead");
  try { process.kill(value.pid, 0); fail("tracker lock holder is live"); }
  catch (error) { if (error.code !== "ESRCH") throw error; }
  const same = fs.lstatSync(lock);
  if (same.dev !== stat.dev || same.ino !== stat.ino) fail("tracker lock changed during recovery");
  fs.unlinkSync(lock);
  return true;
}
export const explicitRecoverLock = ctx => recoverLock(ctx);
function withLock(ctx, callback) {
  const lock = lockPath(ctx);
  let fd = null;
  // Recovery can use 120s, a final 30s request, then a 30s GET and PATCH.
  const deadline = Date.now() + 215000;
  while (fd === null) {
    try { fd = fs.openSync(lock, "wx", 0o600); }
    catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (Date.now() >= deadline) fail("tracker lock timeout; use --recover-lock only for a proven dead same-host PID");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
  }
  try {
    fs.writeFileSync(fd, JSON.stringify({pid: process.pid, host: os.hostname(), acquired_at: now()}));
    return callback();
  } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
const validateWI = wi => { if (typeof wi !== "string" || !WI_ID_RE.test(wi)) fail("invalid WI ID"); return wi; };
const marker = (repository, wi, edge) => "<!-- ssve-issue-tracker:" + repository + ":" + wi + ":" + edge + " -->";
const block = (repository, wi, inner) => marker(repository, wi, "begin") + "\n" + inner + "\n" + marker(repository, wi, "end");
function parseBlock(body, repository, wi) {
  const begin = marker(repository, wi, "begin");
  const end = marker(repository, wi, "end");
  const start = body.indexOf(begin), finish = body.indexOf(end);
  if (start < 0 && finish < 0) return null;
  if (start < 0 || finish < 0 || finish < start || body.indexOf(begin, start + begin.length) >= 0 || body.indexOf(end, finish + end.length) >= 0) fail("owned issue block is malformed or duplicated");
  return {before: body.slice(0, start), inner: body.slice(start + begin.length, finish).replace(/^\n/, "").replace(/\n$/, ""), after: body.slice(finish + end.length)};
}
function replaceBlock(body, repository, wi, inner) {
  const parsed = parseBlock(body, repository, wi);
  if (!parsed) return body + (body && !body.endsWith("\n") ? "\n\n" : "") + block(repository, wi, inner);
  return parsed.before + block(repository, wi, inner) + parsed.after;
}
const syncHash = (repository, wi, title, inner) => sha(JSON.stringify([repository, wi, title, inner]));
function assertRepoIsolation(ctx, config, map, wi) {
  for (const [repo, row] of Object.entries(map.repositories)) if (repo !== config.repository && row.issues?.[wi]) fail("WI is mapped to another repository");
  if (/^WI-GH-\d+$/.test(wi)) {
    const file = safePath(ctx.root, "docs/specs/work-items/" + wi + ".md");
    if (fs.existsSync(file)) {
      const source = fs.readFileSync(file, "utf8").match(/^\*\*GitHub Issue:\*\*\s*(\S+)/m)?.[1];
      if (source && !source.startsWith("https://github.com/" + config.repository + "/issues/")) fail("mirror belongs to another repository");
    }
  }
}
function migrateLegacy(ctx, config, map) {
  const legacy = readJson(safePath(ctx.root, ".svc/github-issues-map.json"));
  if (!legacy) return;
  if (!object(legacy) || legacy.repository !== config.repository || !object(legacy.issues)) fail("legacy map repository or shape conflict");
  const bucket = issues(map, config.repository);
  for (const [wi, entry] of Object.entries(legacy.issues)) {
    validateWI(wi);
    if (!object(entry) || !Number.isInteger(entry.number) || entry.number < 1 || entry.url !== expectedUrl(config.repository, entry.number) || typeof entry.title !== "string") fail("legacy map identity conflict");
    if (bucket[wi] && (bucket[wi].number !== entry.number || bucket[wi].url !== entry.url)) fail("legacy map disagrees with shared map");
    if (!bucket[wi]) bucket[wi] = {number: entry.number, url: entry.url, title: entry.title, state: entry.state || "open", marker: null, last_sync_sha256: null, owned_inner_sha256: null, origin: "legacy", updated_at: now()};
  }
}
function withMap(ctx, config, callback) {
  return withLock(ctx, () => {
    const map = loadMap(ctx);
    const priorBytes = JSON.stringify(map);
    if (config.repository) migrateLegacy(ctx, config, map);
    const value = callback(map);
    if (JSON.stringify(map) !== priorBytes) saveMap(ctx, map);
    return value;
  });
}
function wiFile(ctx, wi) { validateWI(wi); return safePath(ctx.root, "docs/specs/work-items/" + wi + ".md"); }
function localWI(ctx, wi) {
  const file = wiFile(ctx, wi);
  if (!fs.existsSync(file)) fail("work item not found: " + wi);
  return fs.readFileSync(file, "utf8");
}
function localStatus(content) {
  const front = content.match(/^---\n([\s\S]*?)\n---/);
  const fm = front?.[1].match(/^status:\s*["\x27]?([A-Za-z_-]+)/mi)?.[1];
  const bold = content.match(/^\*\*Status:\*\*\s*([A-Za-z_-]+)/mi)?.[1];
  return String(fm || bold || "").toLowerCase();
}

function sourceDigestAtTitle(issue, title) { return sha(JSON.stringify([issue.number, title, issue.body])); }
function sourceDigest(issue) { return sourceDigestAtTitle(issue, issue.title); }
function mirrorMarkdown(issue, config, ctx) {
  const wi = "WI-GH-" + issue.number;
  let title = sanitize(issue.title, ctx, config.repository).replace(/[\x00-\x1f\x7f]+/g, " ").trim();
  title = title.replace(/^#+/, match => "\\" + match);
  if (!title) fail("GitHub issue title is empty after sanitization");
  if (privateTerms(config.repository).some(term => (issue.title + issue.body).toLowerCase().includes(term.toLowerCase()))) fail("private term in imported issue");
  const source = sanitize(issue.body, ctx, config.repository);
  const longest = Math.max(2, ...Array.from(source.matchAll(new RegExp(TICK + "+", "g")), match => match[0].length));
  const fence = TICK.repeat(longest + 1);
  const quoted = source.split(/\r?\n/).map(line => "> " + line).join("\n");
  const filed = /^\d{4}-\d{2}-\d{2}/.test(issue.created_at || "") ? issue.created_at.slice(0, 10) : now().slice(0, 10);
  return ["# " + wi + ": " + title, "", "**Type:** Feature", "**Status:** backlog",
    "**Severity:** medium", "**Filed:** " + filed, "**Source:** GitHub Issue",
    "**GitHub Issue:** " + expectedUrl(config.repository, issue.number),
    "**Source SHA256:** " + sourceDigest(issue), "", "## Imported Issue (untrusted)", "",
    fence, quoted, fence, ""].join("\n");
}
function validateNumber(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || String(number) !== String(value)) fail("issue number must be a positive integer");
  return number;
}
function assertUniqueNumber(bucket, wi, number) {
  for (const [other, entry] of Object.entries(bucket)) if (other !== wi && entry.number === number) fail("issue number already mapped to " + other);
}
function checkMappedEntry(entry, config, wi) {
  if (!object(entry) || !Number.isInteger(entry.number) || entry.number < 1 || entry.url !== expectedUrl(config.repository, entry.number) || (entry.marker !== marker(config.repository, wi, "begin") && !(entry.origin === "github" && entry.marker === null) && !(entry.origin === "legacy" && entry.marker === null))) fail("shared map issue identity conflict");
}
export function pull(ctx, config, rawNumber, dryRun = false) {
  requireRemote(config, "pull");
  const number = validateNumber(rawNumber), wi = "WI-GH-" + number;
  const issue = getIssue(ctx, config, number);
  if (issue.body.includes("<!-- ssve-issue-tracker:") && !parseBlock(issue.body, config.repository, wi)) fail("issue contains another managed identity");
  const markdown = mirrorMarkdown(issue, config, ctx);
  const digest = sourceDigest(issue), mirrorDigest = sha(markdown);
  const work = map => {
    assertRepoIsolation(ctx, config, map, wi);
    const bucket = issues(map, config.repository), prior = bucket[wi];
    assertUniqueNumber(bucket, wi, number);
    const file = wiFile(ctx, wi);
    if (prior) {
      checkMappedEntry(prior, config, wi);
      if (prior.source_sha256 !== digest) fail("remote issue changed since adoption");
      if (!fs.existsSync(file) || sha(fs.readFileSync(file, "utf8")) !== prior.mirror_sha256) fail("local mirror changed since adoption");
      return {message: wi + " already current", wi};
    }
    if (fs.existsSync(file)) fail("local mirror exists without matching map");
    if (dryRun) return {message: "Would adopt " + wi + "\n" + markdown, wi};
    safePath(ctx.root, "docs/specs/work-items/" + wi + ".md", true);
    atomicWrite(file, markdown);
    bucket[wi] = {number, url: expectedUrl(config.repository, number), title: issue.title,
      state: issue.state === "closed" ? "closed" : "open", marker: null,
      last_sync_sha256: syncHash(config.repository, wi, issue.title, ""), owned_inner_sha256: null, origin: "github", source_sha256: digest, mirror_sha256: mirrorDigest, updated_at: now()};
    return {message: "Adopted " + wi, wi};
  };
  return dryRun ? work(loadMap(ctx)) : withMap(ctx, config, work);
}
function scanForMarker(ctx, config, wi) {
  const matching = [];
  const start = Date.now();
  let complete = false;
  for (let page = 1; page <= 10; page++) {
    if (Date.now() - start > 120000) fail("issue recovery scan exceeded operation budget");
    const rows = gh(ctx, config, "GET", endpoint(config, "/issues?state=all&per_page=100&page=" + page));
    if (!Array.isArray(rows)) fail("issue recovery list malformed");
    for (const issue of rows) {
      if (issue.pull_request) continue;
      if (!(typeof issue.body === "string" || issue.body === null) || typeof issue.number !== "number") fail("issue recovery row malformed");
      if (issue.body === null) issue.body = "";
      if (issue.body.includes(marker(config.repository, wi, "begin"))) matching.push(validateIssue(issue, config, issue.number));
    }
    if (rows.length < 100) { complete = true; break; }
  }
  if (!complete) fail("issue recovery scan incomplete at 10 pages");
  if (matching.length > 1) fail("duplicate owned issue marker; refusing identity choice");
  return matching[0] || null;
}
function adoptExact(ctx, config, map, wi, issue, origin = "adopted") {
  const parsed = parseBlock(issue.body, config.repository, wi);
  if (!parsed) fail("exact owned issue marker missing");
  const bucket = issues(map, config.repository);
  const prior = bucket[wi];
  assertUniqueNumber(bucket, wi, issue.number);
  if (prior && prior.number && prior.number !== issue.number) fail("existing WI mapping points to another issue");
  bucket[wi] = {number: issue.number, url: expectedUrl(config.repository, issue.number),
    title: issue.title, state: issue.state === "closed" ? "closed" : "open",
    marker: marker(config.repository, wi, "begin"), last_sync_sha256: syncHash(config.repository, wi, issue.title, parsed.inner),
    owned_inner_sha256: sha(parsed.inner), origin, updated_at: now()};
  return bucket[wi];
}
export function adoptIssue(ctx, config, rawNumber, wi, dryRun = false) {
  requireRemote(config, "adopt");
  validateWI(wi);
  localWI(ctx, wi);
  const number = validateNumber(rawNumber), issue = getIssue(ctx, config, number);
  if (!parseBlock(issue.body, config.repository, wi)) fail("exact owned issue marker missing");
  const work = map => {
    assertRepoIsolation(ctx, config, map, wi);
    const old = issues(map, config.repository)[wi];
    assertUniqueNumber(issues(map, config.repository), wi, number);
    if (old?.number && old.number !== number) fail("WI already mapped to another issue");
    if (old?.origin === "github") fail("GitHub mirror already mapped; use digest-confirmed --accept-remote to preserve its provenance");
    if (dryRun) return {message: "Would adopt issue #" + number + " for " + wi};
    adoptExact(ctx, config, map, wi, issue);
    return {message: "Adopted issue #" + number + " for " + wi};
  };
  return dryRun ? work(loadMap(ctx)) : withMap(ctx, config, work);
}
function assertExactManagedMarkers(issue, config, wi, expectOwned) {
  const prefix = "<!-- ssve-issue-tracker:";
  const count = issue.body.split(prefix).length - 1;
  const owned = parseBlock(issue.body, config.repository, wi);
  if (expectOwned) {
    if (!owned || count !== 2) fail("remote managed marker or owned block conflict");
  } else if (owned || count !== 0) fail("unexpected managed marker on markerless issue");
  return owned;
}
function assertLocalGithubProvenance(ctx, config, wi, entry) {
  if (entry.origin !== "github" || !/^[0-9a-f]{64}$/.test(entry.mirror_sha256 || "") ||
      !/^[0-9a-f]{64}$/.test(entry.source_sha256 || "")) fail("GitHub mirror provenance unavailable");
  const content = localWI(ctx, wi);
  const urls = [...content.matchAll(/^\*\*GitHub Issue:\*\*\s*(\S+)/gm)];
  const sources = [...content.matchAll(/^\*\*Source SHA256:\*\* ([0-9a-f]{64})\s*$/gm)];
  if (!content.startsWith("# " + wi + ": ") ||
      (content.match(/^\*\*GitHub Issue:\*\*/gm) || []).length !== 1 ||
      (content.match(/^\*\*Source SHA256:\*\*/gm) || []).length !== 1 ||
      urls.length !== 1 || urls[0][1] !== entry.url || sources.length !== 1)
    fail("local GitHub mirror provenance changed");
}
function assertObservedDigest(issue, expected, dryRun) {
  const digest = sourceDigest(issue);
  if (expected && digest !== expected) fail("remote title/body changed since preview; current source SHA256 is " + digest);
  if (!dryRun && !expected) fail("current full remote title/body SHA256 is required");
  return digest;
}
function remoteDecisionPreview(action, config, wi, issue, digest, effects) {
  return JSON.stringify({action, repository: config.repository, wi, issue: issue.number,
    source_sha256: digest, remote: {title: issue.title, body: issue.body, state: issue.state},
    map_effects: effects, remote_write: false, local_wi_write: false}, null, 2);
}
export function acceptRemote(ctx, config, rawNumber, wi, expectedDigest, dryRun = false) {
  requireRemote(config, "accept-remote");
  validateWI(wi);
  const number = validateNumber(rawNumber);
  if (wi !== "WI-GH-" + number) fail("accept-remote requires the matching WI-GH-N mirror");
  const work = map => {
    assertRepoIsolation(ctx, config, map, wi);
    const bucket = issues(map, config.repository), entry = bucket[wi];
    if (!entry) fail("GitHub mirror is not mapped");
    checkMappedEntry(entry, config, wi);
    if (entry.number !== number) fail("GitHub mirror issue number mismatch");
    assertUniqueNumber(bucket, wi, number);
    assertLocalGithubProvenance(ctx, config, wi, entry);
    if (entry.pending || entry.close_pending)
      fail("pending creation or close must be resolved before --accept-remote");
    const issue = getIssue(ctx, config, number);
    const digest = assertObservedDigest(issue, expectedDigest, dryRun);
    const pending = entry.pending_publish;
    const owned = assertExactManagedMarkers(issue, config, wi, Boolean(pending) || entry.marker !== null);
    if (pending) {
      if (typeof pending.title !== "string" || !/^[0-9a-f]{64}$/.test(pending.inner_sha256 || "") ||
          issue.title !== pending.title || sha(owned.inner) !== pending.inner_sha256)
        fail("pending publication title or owned block differs; accept-remote cannot resolve ambiguous publication");
    } else if (owned && (entry.marker !== marker(config.repository, wi, "begin") ||
        sha(owned.inner) !== entry.owned_inner_sha256))
      fail("remote owned block changed; accept-remote cannot take ownership of it");
    const effects = {source_sha256: digest, title: issue.title, state: issue.state,
      origin: "github", mirror_sha256: entry.mirror_sha256,
      ...(owned ? {marker: marker(config.repository, wi, "begin"),
        owned_inner_sha256: sha(owned.inner),
        last_sync_sha256: syncHash(config.repository, wi, issue.title, owned.inner)} : {}),
      ...(pending ? {clear: "pending_publish"} : {})};
    if (dryRun) return {message: remoteDecisionPreview("accept-remote", config, wi, issue, digest, effects)};
    entry.source_sha256 = digest;
    entry.title = issue.title;
    entry.state = issue.state === "closed" ? "closed" : "open";
    if (owned) {
      entry.marker = effects.marker;
      entry.owned_inner_sha256 = effects.owned_inner_sha256;
      entry.last_sync_sha256 = effects.last_sync_sha256;
    }
    if (pending) delete entry.pending_publish;
    entry.updated_at = now();
    return {message: "Accepted current remote title/body for " + wi + " at #" + number +
      (pending ? "; cleared matching pending publication" : "") + "; local mirror unchanged" +
      (issue.state === "closed" ? "; remote closure has no verified-close claim" : "")};
  };
  return dryRun ? work(loadMap(ctx)) : withMap(ctx, config, work);
}
export function abandonPending(ctx, config, wi, kind, expectedDigest, dryRun = false) {
  requireRemote(config, "abandon-pending");
  validateWI(wi);
  if (kind !== "publish" && kind !== "close") fail("invalid pending action");
  const work = map => {
    assertRepoIsolation(ctx, config, map, wi);
    const bucket = issues(map, config.repository), entry = bucket[wi];
    if (!entry?.number) fail("WI has no mapped GitHub issue");
    checkMappedEntry(entry, config, wi);
    assertUniqueNumber(bucket, wi, entry.number);
    localWI(ctx, wi);
    const pending = kind === "publish" ? entry.pending_publish : entry.close_pending;
    if (!pending) fail("no pending " + kind + " to abandon");
    if (kind === "publish" && entry.close_pending || kind === "close" && entry.pending_publish)
      fail("crossing pending actions require manual inspection");
    const issue = getIssue(ctx, config, entry.number);
    const digest = assertObservedDigest(issue, expectedDigest, dryRun);
    const owned = assertExactManagedMarkers(issue, config, wi, entry.marker !== null);
    if (owned && sha(owned.inner) !== entry.owned_inner_sha256) fail("remote owned block changed; pending action cannot be abandoned safely");
    if (entry.origin === "github") assertLocalGithubProvenance(ctx, config, wi, entry);
    if (kind === "publish") {
      if (issue.title === pending.title && sha(issue.body) === pending.body_sha256)
        fail("pending publish is applied; retry --publish to reconcile it");
      if (!owned && issue.body.includes(marker(config.repository, wi, "begin")))
        fail("pending publish may be partially applied; inspect remote issue");
    } else if (entry.pending_close_body_sha256 && sha(issue.body) === entry.pending_close_body_sha256)
      fail("pending close body is applied; retry --close-wi with its verified commit");
    const effects = {clear: kind === "publish" ? "pending_publish" : "close_pending",
      retained_source_sha256: entry.source_sha256 || null,
      retained_origin: entry.origin, retained_mirror_sha256: entry.mirror_sha256 || null};
    if (dryRun) return {message: remoteDecisionPreview("abandon-pending-" + kind, config, wi, issue, digest, effects)};
    if (kind === "publish") delete entry.pending_publish;
    else {
      delete entry.close_pending; delete entry.pending_close_sha256;
      delete entry.pending_close_body_sha256; delete entry.pending_close_commit;
    }
    entry.state = issue.state === "closed" ? "closed" : "open";
    entry.updated_at = now();
    return {message: "Abandoned unapplied pending " + kind + " for " + wi + "; remote baseline unchanged"};
  };
  return dryRun ? work(loadMap(ctx)) : withMap(ctx, config, work);
}
function publicText(ctx, config, title, bodyFile) {
  if (typeof title !== "string" || !title.trim() || /[\r\n]/.test(title)) fail("public title must be one line");
  const safeTitle = sanitize(title, ctx, config.repository).trim();
  if (safeTitle.length > 256) fail("public title exceeds GitHub limit");
  const file = path.resolve(ctx.root, bodyFile || "");
  if (!bodyFile || (file !== ctx.root && !file.startsWith(ctx.root + path.sep))) fail("public body file must be within worktree");
  safePath(ctx.root, path.relative(ctx.root, file));
  if (!fs.existsSync(file)) fail("public body file missing");
  const body = sanitize(fs.readFileSync(file, "utf8"), ctx, config.repository);
  if (Buffer.byteLength(body) > 65536) fail("public body exceeds GitHub issue limit");
  return {title: safeTitle, body};
}
function recoverPending(ctx, config, map, wi) {
  const match = scanForMarker(ctx, config, wi);
  if (!match) fail("pending creation unresolved; use --adopt-issue N --wi " + wi + " after finding the exact marker");
  return adoptExact(ctx, config, map, wi, match, "created");
}
function recordPublished(entry, config, wi, observed, inner) {
  if (entry.origin === "github") entry.source_sha256 = sourceDigest(observed);
  entry.title = observed.title;
  entry.marker = marker(config.repository, wi, "begin");
  entry.state = observed.state === "closed" ? "closed" : "open";
  entry.last_sync_sha256 = syncHash(config.repository, wi, observed.title, inner);
  entry.owned_inner_sha256 = sha(inner);
  delete entry.pending_publish;
  entry.updated_at = now();
}
export function publish(ctx, config, wi, title, bodyFile, dryRun = false) {
  validateWI(wi);
  requireRemote(config, "publish", wi);
  localWI(ctx, wi);
  const curated = publicText(ctx, config, title, bodyFile);
  const desiredInner = curated.body;
  const desiredBlock = block(config.repository, wi, desiredInner);
  const work = map => {
    assertRepoIsolation(ctx, config, map, wi);
    const bucket = issues(map, config.repository);
    let entry = bucket[wi];
    if (entry?.close_pending) fail("close pending; retry --close-wi " + wi + " --commit " + entry.pending_close_commit +
      " or explicitly --abandon-pending-close with the observed digest before publishing");
    if (entry?.pending) {
      if (dryRun) fail("pending creation requires explicit recovery");
      entry = recoverPending(ctx, config, map, wi);
      saveMap(ctx, map);
    }
    if (entry?.number) {
      checkMappedEntry(entry, config, wi);
      const issue = getIssue(ctx, config, entry.number);
      if (entry.pending_publish) {
        const pending = entry.pending_publish;
        if (issue.title === pending.title && sha(issue.body) === pending.body_sha256) {
          const applied = parseBlock(issue.body, config.repository, wi);
          if (!applied || sha(applied.inner) !== pending.inner_sha256) fail("pending publication owned block conflict");
          const sameRequest = curated.title === pending.title && sha(desiredInner) === pending.inner_sha256;
          if (dryRun && sameRequest) return {message: "Would reconcile confirmed pending publication for " + wi +
            (issue.state === "closed" ? "; remote issue remains closed without verified close evidence" : "")};
          recordPublished(entry, config, wi, issue, applied.inner);
          if (!dryRun) saveMap(ctx, map);
          if (sameRequest) return {message: "Reconciled published " + wi + " at #" + entry.number +
            (issue.state === "closed" ? "; remote issue remains closed without verified close evidence" : "")};
          if (issue.state !== "open") fail("reconciled earlier publication; remote issue is closed, so revised publish cannot proceed");
          // The earlier request is now durable. Continue this invocation through
          // the ordinary publish path, which records its own pending PATCH.
        } else if (sourceDigest(issue) !== pending.before_sha256 ||
            curated.title !== pending.title || sha(desiredInner) !== pending.inner_sha256)
          fail("pending publication conflict; inspect issue #" + entry.number +
            ", retry the same --publish command from its exact pre-write state, or explicitly --abandon-pending-publish with the observed digest");
      }
      if (issue.state !== "open") fail("mapped issue is closed; publish cannot reopen; reconcile or explicitly abandon any unapplied pending publication first");
      const owned = parseBlock(issue.body, config.repository, wi);
      if (entry.origin === "github" && entry.marker !== null && sourceDigest(issue) !== entry.source_sha256) fail("remote issue changed since adoption");
      if (entry.origin === "github" && entry.marker === null) {
        if (owned || issue.title !== entry.title || sourceDigest(issue) !== entry.source_sha256) fail("adopted issue changed before publication");
      } else if (entry.origin === "legacy" && entry.marker === null) {
        if (owned || issue.title !== entry.title) fail("legacy markerless identity conflict");
      } else if (!owned || syncHash(config.repository, wi, issue.title, owned.inner) !== entry.last_sync_sha256) fail("remote owned block or title changed; resolve conflict");
      const nextBody = replaceBlock(issue.body, config.repository, wi, desiredInner);
      if (issue.title === curated.title && issue.body === nextBody) return {message: wi + " already published"};
      const payload = {title: curated.title, body: nextBody};
      if (Buffer.byteLength(payload.body) > 65536) fail("composed issue body exceeds GitHub limit");
      assertNoSecrets(payload.body, config.repository);
      if (dryRun) return {message: JSON.stringify({method: "PATCH", endpoint: endpoint(config, "/issues/" + entry.number), payload}, null, 2)};
      entry.pending_publish = {title: curated.title, body_sha256: sha(nextBody),
        inner_sha256: sha(desiredInner), before_sha256: sourceDigest(issue)};
      saveMap(ctx, map);
      let updated;
      try { updated = validateIssue(gh(ctx, config, "PATCH", endpoint(config, "/issues/" + entry.number), payload), config, entry.number); }
      catch { fail("GitHub publish outcome unknown; pending publication retained for explicit retry"); }
      if (updated.state !== "open" || updated.title !== curated.title || updated.body !== nextBody)
        fail("GitHub publish response did not confirm exact open state, title and body; pending publication retained");
      recordPublished(entry, config, wi, updated, desiredInner);
      return {message: "Published " + wi + " to #" + entry.number};
    }
    if (config.mode === "github-backed" || /^WI-GH-[1-9][0-9]*$/.test(wi)) fail("WI-GH-N publication requires an adopted issue mirror");
    const payload = {title: curated.title, body: desiredBlock};
    if (Buffer.byteLength(payload.body) > 65536) fail("composed issue body exceeds GitHub limit");
    if (dryRun) return {message: JSON.stringify({method: "POST", endpoint: endpoint(config, "/issues"), payload}, null, 2)};
    bucket[wi] = {pending: true, marker: marker(config.repository, wi, "begin"), title: curated.title,
      pending_sha256: syncHash(config.repository, wi, curated.title, desiredInner), state: "pending",
      origin: "created", updated_at: now()};
    saveMap(ctx, map);
    let created;
    try { created = gh(ctx, config, "POST", endpoint(config, "/issues"), payload); }
    catch { fail("GitHub create outcome unknown; pending identity retained for explicit recovery"); }
    if (!object(created) || !Number.isInteger(created.number)) fail("GitHub create response invalid; pending identity retained");
    validateIssue(created, config, created.number);
    assertUniqueNumber(bucket, wi, created.number);
    bucket[wi] = {number: created.number, url: expectedUrl(config.repository, created.number),
      title: curated.title, state: created.state === "closed" ? "closed" : "open",
      marker: marker(config.repository, wi, "begin"), last_sync_sha256: bucket[wi].pending_sha256,
      owned_inner_sha256: sha(desiredInner), origin: "created", updated_at: now()};
    saveMap(ctx, map);
    return {message: "Published " + wi + " to #" + created.number};
  };
  return dryRun ? work(loadMap(ctx)) : withMap(ctx, config, work);
}

function assertNoSecrets(text, repository) {
  if (secretFound(text)) fail("recognizable credential in composed issue payload");
  for (const term of privateTerms(repository)) if (text.toLowerCase().includes(term.toLowerCase())) fail("private term in composed issue payload");
}
function originDefaultRef(ctx, config) {
  const metadata = gh(ctx, config, "GET", endpoint(config));
  const branch = metadata?.default_branch;
  if (typeof branch !== "string" || !branch || !tryGit(ctx.root, ["check-ref-format", "--branch", branch])) fail("configured repository default branch unavailable");
  if (metadata.full_name && metadata.full_name.toLowerCase() !== config.repository.toLowerCase()) fail("configured GitHub repository identity mismatch");
  const live = gh(ctx, config, "GET", endpoint(config, "/branches/" + encodeURIComponent(branch)));
  const remoteHead = live?.commit?.sha;
  if (!/^[0-9a-f]{40}$/.test(remoteHead || "")) fail("configured repository branch head unavailable");
  const ref = "refs/remotes/origin/" + branch;
  const localHead = tryGit(ctx.root, ["rev-parse", "--verify", ref + "^{commit}"]);
  if (!localHead || localHead !== remoteHead) fail("origin default branch differs from configured GitHub repository; fetch origin and check repository");
  return ref;
}
function verifiedReceipt(ctx, config, wi, commit, dryRun = false) {
  if (!/^[0-9a-f]{40}$/.test(commit || "")) fail("close requires a full 40-hex commit SHA");
  const resolved = tryGit(ctx.root, ["rev-parse", "--verify", commit + "^{commit}"]);
  if (resolved !== commit) fail("verification commit does not exist locally");
  let note;
  try { note = JSON.parse(git(ctx.root, ["notes", "--ref=" + NOTE_REF, "show", commit])); }
  catch { fail("durable verify-promotion note missing"); }
  const receipts = Object.values(note).filter(item => object(item) && item.receipt_type === "verify-promotion" && item.wi === wi);
  if (receipts.length !== 1) fail("exact WI verify-promotion receipt missing or ambiguous");
  const receipt = receipts[0];
  const validated = validateReceipt("verify-promotion", receipt, commit);
  if (!validated.valid) fail("verify-promotion receipt validation failed");
  if (!dryRun) {
    const checker = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../check-chain-receipts.mjs");
    const result = run(process.execPath, [checker, "--sha", commit, "--wi", wi, "--consumer", "verify-promotion"], {cwd: ctx.root});
    let check;
    try { check = JSON.parse(result); } catch { fail("receipt validator returned malformed output"); }
    if (!check.ok || check.results?.[0]?.ok !== true || check.results?.[0]?.receipt_source !== "note") fail("durable verify-promotion receipt did not pass");
  }
  const passes = receipt.passes || {};
  if (receipt.verdict !== "pass" || receipt.p3_outcome !== "pass" ||
      ["p1_promotion_evidence", "p2_spec_ac_verification", "p3_runtime_validation", "p4_state_closeout"].some(key => passes[key] !== "pass")) fail("verify-promotion receipt lacks all required PASS outcomes");
  if (receipt.target_sha && receipt.target_sha !== commit) fail("verify-promotion receipt target SHA mismatch");
  if (receipt.sha && receipt.sha !== commit) fail("verify-promotion receipt SHA mismatch");
  const tree = git(ctx.root, ["rev-parse", commit + "^{tree}"]);
  if (receipt.tree_hash && receipt.tree_hash !== tree) fail("verify-promotion receipt tree mismatch");
  const ref = originDefaultRef(ctx, config);
  try { run("git", ["merge-base", "--is-ancestor", commit, ref], {cwd: ctx.root}); }
  catch { fail("verified commit is not on configured repository default branch; fetch origin and check repository"); }
  return receipt;
}
export function closeIssue(ctx, config, wi, commit, dryRun = false) {
  validateWI(wi);
  requireRemote(config, "close");
  const content = localWI(ctx, wi);
  if (localStatus(content) !== "verified") fail("work item must be locally VERIFIED before closing");
  verifiedReceipt(ctx, config, wi, commit, dryRun);
  const facts = sanitize("## Verification\n\nVerified commit: https://github.com/" + config.repository + "/commit/" + commit +
    "\nReceipt: verify-promotion PASS\nP1-P4: PASS\nP3 outcome: PASS", ctx, config.repository);
  const work = map => {
    assertRepoIsolation(ctx, config, map, wi);
    const entry = issues(map, config.repository)[wi];
    if (!entry?.number) fail("WI has no mapped GitHub issue");
    checkMappedEntry(entry, config, wi);
    if (entry.pending_publish) fail("publication pending; retry the same --publish command for " + wi +
      " or explicitly --abandon-pending-publish with the observed digest before closing");
    const issue = getIssue(ctx, config, entry.number);
    const owned = parseBlock(issue.body, config.repository, wi);
    const ownedDigest = owned ? sha(owned.inner) : null;
    const pendingApplied = Boolean(entry.pending_close_sha256 && ownedDigest === entry.pending_close_sha256);
    if (pendingApplied && entry.pending_close_body_sha256 && sha(issue.body) !== entry.pending_close_body_sha256) fail("pending close body changed outside owned block");
    if (entry.origin === "github" && !pendingApplied && sourceDigestAtTitle(issue, entry.title) !== entry.source_sha256) fail("remote issue body changed since adoption");
    if (entry.pending_close_commit && entry.pending_close_commit !== commit) fail("close-pending belongs to another verified commit; retry with its exact commit");
    if (entry.origin === "legacy" && entry.marker === null && !pendingApplied && (owned || issue.title !== entry.title)) fail("legacy markerless identity conflict");
    if (entry.owned_inner_sha256) {
      if (!owned || (ownedDigest !== entry.owned_inner_sha256 && !pendingApplied)) fail("remote owned block changed; resolve conflict before close");
    } else if (owned && !pendingApplied) fail("unmapped owned block appeared; resolve conflict before close");
    if (pendingApplied && issue.state === "closed") {
      if (entry.pending_close_body_sha256 && sha(issue.body) !== entry.pending_close_body_sha256) fail("closed issue body differs from pending request");
      entry.state = "closed"; entry.marker = marker(config.repository, wi, "begin");
      entry.owned_inner_sha256 = ownedDigest;
      entry.last_sync_sha256 = syncHash(config.repository, wi, issue.title, owned.inner);
      if (entry.origin === "github") entry.source_sha256 = sourceDigestAtTitle(issue, entry.title);
      delete entry.pending_close_sha256; delete entry.pending_close_body_sha256;
      delete entry.pending_close_commit; delete entry.close_pending;
      entry.updated_at = now();
      return {message: wi + " already closed after pending retry"};
    }
    const inner = pendingApplied ? owned.inner :
      owned ? (owned.inner.endsWith("\n\n" + facts) ? owned.inner : owned.inner + "\n\n" + facts) : facts;
    const nextBody = replaceBlock(issue.body, config.repository, wi, inner);
    if (Buffer.byteLength(nextBody) > 65536) fail("composed issue body exceeds GitHub limit");
    assertNoSecrets(nextBody, config.repository);
    if (issue.state === "closed" && nextBody === issue.body) {
      if (entry.pending_close_body_sha256 && sha(issue.body) !== entry.pending_close_body_sha256) fail("closed issue body differs from pending request");
      entry.state = "closed"; entry.marker = marker(config.repository, wi, "begin");
      entry.owned_inner_sha256 = sha(inner);
      if (entry.origin === "github") entry.source_sha256 = sourceDigestAtTitle(issue, entry.title);
      delete entry.close_pending; delete entry.pending_close_sha256;
      delete entry.pending_close_body_sha256; delete entry.pending_close_commit;
      return {message: wi + " already closed"};
    }
    const payload = {body: nextBody, state: "closed", state_reason: "completed"};
    if (dryRun) return {message: JSON.stringify({method: "PATCH", endpoint: endpoint(config, "/issues/" + entry.number), payload}, null, 2)};
    entry.pending_close_sha256 = sha(inner);
    entry.pending_close_body_sha256 = sha(nextBody);
    entry.pending_close_commit = commit;
    entry.close_pending = true;
    entry.updated_at = now();
    saveMap(ctx, map);
    let updated;
    try { updated = validateIssue(gh(ctx, config, "PATCH", endpoint(config, "/issues/" + entry.number), payload), config, entry.number); }
    catch { fail("GitHub close failed; local VERIFIED state and retryable close-pending map retained"); }
    if (updated.state !== "closed" || updated.body !== nextBody) fail("GitHub did not confirm closed state and exact body; close-pending retained");
    entry.state = "closed"; entry.marker = marker(config.repository, wi, "begin"); entry.owned_inner_sha256 = sha(inner);
    entry.last_sync_sha256 = syncHash(config.repository, wi, issue.title, inner);
    if (entry.origin === "github") entry.source_sha256 = sourceDigestAtTitle(updated, entry.title);
    delete entry.pending_close_sha256; delete entry.pending_close_body_sha256;
    delete entry.pending_close_commit; delete entry.close_pending;
    entry.updated_at = now();
    return {message: "Closed " + wi + " at #" + entry.number + " with verify-promotion note " + commit};
  };
  return dryRun ? work(loadMap(ctx)) : withMap(ctx, config, work);
}
export function listItems(ctx, config) {
  const dir = safePath(ctx.root, "docs/specs/work-items");
  const names = fs.existsSync(dir) ? fs.readdirSync(dir).filter(name => /^WI-[A-Za-z0-9._-]+\.md$/.test(name)).sort() : [];
  const map = loadMap(ctx);
  const mapped = config.repository ? issues(map, config.repository) : {};
  const rows = names.map(name => {
    const wi = name.slice(0, -3), entry = mapped[wi];
    const content = fs.readFileSync(safePath(ctx.root, "docs/specs/work-items/" + name), "utf8");
    return wi + " " + localStatus(content).toUpperCase() +
      (entry ? " #" + (entry.number || "?") + " " + (entry.close_pending ? "close-pending" : entry.state || "unknown") : " local");
  });
  return {message: rows.length ? rows.join("\n") : "No local work items"};
}
