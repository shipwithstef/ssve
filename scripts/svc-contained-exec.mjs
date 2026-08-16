#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HELPER_SOURCE = String.raw`
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <linux/landlock.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/stat.h>
#include <sys/syscall.h>
#include <unistd.h>

static int ll_create(const struct landlock_ruleset_attr *attr, size_t size, __u32 flags) {
  return syscall(__NR_landlock_create_ruleset, attr, size, flags);
}
static int ll_add(int fd, enum landlock_rule_type type, const void *attr, __u32 flags) {
  return syscall(__NR_landlock_add_rule, fd, type, attr, flags);
}
static int ll_restrict(int fd, __u32 flags) { return syscall(__NR_landlock_restrict_self, fd, flags); }

int main(int argc, char **argv) {
  int split = 1;
  while (split < argc && strcmp(argv[split], "--") != 0) split++;
  if (split == argc || split == 1 || split + 1 >= argc) {
    fprintf(stderr, "usage: landlock-helper ALLOWED_PATH... -- COMMAND...\n"); return 64;
  }
  int abi = ll_create(NULL, 0, LANDLOCK_CREATE_RULESET_VERSION);
  if (abi < 1) { perror("landlock ABI unavailable"); return 78; }
  __u64 handled = LANDLOCK_ACCESS_FS_WRITE_FILE | LANDLOCK_ACCESS_FS_REMOVE_DIR |
    LANDLOCK_ACCESS_FS_REMOVE_FILE | LANDLOCK_ACCESS_FS_MAKE_CHAR |
    LANDLOCK_ACCESS_FS_MAKE_DIR | LANDLOCK_ACCESS_FS_MAKE_REG |
    LANDLOCK_ACCESS_FS_MAKE_SOCK | LANDLOCK_ACCESS_FS_MAKE_FIFO |
    LANDLOCK_ACCESS_FS_MAKE_BLOCK | LANDLOCK_ACCESS_FS_MAKE_SYM;
#ifdef LANDLOCK_ACCESS_FS_REFER
  if (abi >= 2) handled |= LANDLOCK_ACCESS_FS_REFER;
#endif
#ifdef LANDLOCK_ACCESS_FS_TRUNCATE
  if (abi >= 3) handled |= LANDLOCK_ACCESS_FS_TRUNCATE;
#endif
#ifdef LANDLOCK_ACCESS_FS_IOCTL_DEV
  if (abi >= 5) handled |= LANDLOCK_ACCESS_FS_IOCTL_DEV;
#endif
  struct landlock_ruleset_attr ruleset = { .handled_access_fs = handled };
  int ruleset_fd = ll_create(&ruleset, sizeof(ruleset), 0);
  if (ruleset_fd < 0) { perror("landlock create ruleset"); return 78; }
  for (int i = 1; i < split; i++) {
    int parent_fd = open(argv[i], O_PATH | O_CLOEXEC);
    if (parent_fd < 0) { perror(argv[i]); return 66; }
    struct stat path_stat;
    if (fstat(parent_fd, &path_stat) < 0) { perror("fstat"); return 66; }
    __u64 allowed = handled;
    if (!S_ISDIR(path_stat.st_mode)) {
      allowed = LANDLOCK_ACCESS_FS_WRITE_FILE;
#ifdef LANDLOCK_ACCESS_FS_TRUNCATE
      if (abi >= 3) allowed |= LANDLOCK_ACCESS_FS_TRUNCATE;
#endif
    }
    struct landlock_path_beneath_attr rule = { .allowed_access = allowed, .parent_fd = parent_fd };
    if (ll_add(ruleset_fd, LANDLOCK_RULE_PATH_BENEATH, &rule, 0) < 0) { perror("landlock add rule"); return 78; }
    close(parent_fd);
  }
  if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) < 0) { perror("no_new_privs"); return 78; }
  if (ll_restrict(ruleset_fd, 0) < 0) { perror("landlock restrict"); return 78; }
  close(ruleset_fd);
  execvp(argv[split + 1], &argv[split + 1]);
  perror(argv[split + 1]); return errno == ENOENT ? 127 : 126;
}
`;

function secureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid()) throw new Error(`unsafe containment cache: ${directory}`);
  fs.chmodSync(directory, 0o700);
}

function helperPath() {
  const digest = crypto.createHash("sha256").update(HELPER_SOURCE).digest("hex").slice(0, 20);
  const cache = path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"), "svc", "containment");
  secureDirectory(cache);
  const helper = path.join(cache, `landlock-${digest}`);
  if (fs.existsSync(helper)) {
    const stat = fs.lstatSync(helper);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o022) !== 0) throw new Error("unsafe cached containment helper");
    return helper;
  }
  const source = path.join(cache, `.landlock-${process.pid}-${crypto.randomUUID()}.c`);
  const output = path.join(cache, `.landlock-${process.pid}-${crypto.randomUUID()}`);
  fs.writeFileSync(source, HELPER_SOURCE, { flag: "wx", mode: 0o600 });
  try {
    execFileSync(process.env.CC || "cc", ["-O2", "-Wall", "-Wextra", "-o", output, source], { stdio: ["ignore", "pipe", "pipe"] });
    fs.chmodSync(output, 0o700);
    try { fs.renameSync(output, helper); } catch (error) { if (error.code !== "EEXIST") throw error; }
  } finally {
    try { fs.unlinkSync(source); } catch {}
    try { fs.unlinkSync(output); } catch {}
  }
  return helper;
}

function canonicalDirectory(value, label) {
  if (!value) throw new Error(`${label} is required`);
  const resolved = fs.realpathSync(path.resolve(String(value)));
  if (!fs.statSync(resolved).isDirectory()) throw new Error(`${label} must be a directory`);
  return resolved;
}

function canonicalWritable(value, label) {
  if (!value) throw new Error(`${label} is required`);
  const lexical = path.resolve(String(value)); const stat = fs.lstatSync(lexical);
  if (stat.isSymbolicLink()) throw new Error(`${label} must not be a symlink`);
  const real = fs.realpathSync(lexical);
  if (real !== lexical || (!stat.isDirectory() && !stat.isFile())) throw new Error(`${label} must be a canonical file or directory`);
  return real;
}

function staticPrefix(pattern) {
  const normalized = String(pattern || "").replaceAll("\\", "/").replace(/^\.\//, "");
  if (!normalized || normalized.startsWith("/") || normalized.split("/").includes("..")) throw new Error(`unsafe containment grant: ${pattern}`);
  const wildcard = normalized.search(/[*?[{]/); const prefix = (wildcard < 0 ? normalized : normalized.slice(0, wildcard)).replace(/\/$/, "");
  if (wildcard < 0) throw new Error(`delegated containment requires directory/**; exact files remain controller-owned: ${pattern}`);
  if (!normalized.endsWith("/**")) throw new Error(`containment grant must be directory/**: ${pattern}`);
  if (!prefix) throw new Error(`containment grant is unbounded: ${pattern}`);
  return { prefix };
}

function policyWriteRoots(worktree, policyFile) {
  const policy = JSON.parse(fs.readFileSync(path.resolve(policyFile), "utf8"));
  if (policy.decision !== "delegated-wrapper" || !Array.isArray(policy.allowed_paths) || policy.allowed_paths.length === 0) throw new Error("containment policy is not a delegated-wrapper grant");
  const roots = [];
  for (const pattern of policy.allowed_paths) {
    const { prefix } = staticPrefix(pattern); const target = path.resolve(worktree, prefix); const rel = path.relative(worktree, target);
    if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error(`containment grant escapes worktree: ${pattern}`);
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true, mode: 0o700 });
    }
    roots.push(canonicalWritable(target, `containment grant ${pattern}`));
  }
  return roots;
}

export function probeContainment() {
  if (process.platform !== "linux") return { available: false, backend: "landlock", reason: "Landlock requires Linux" };
  try {
    const helper = helperPath();
    const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "svc-landlock-probe-"));
    try {
      const result = spawnSync(helper, [testRoot, "--", "sh", "-c", "touch allowed && ! touch /svc-landlock-probe-denied"], { cwd: testRoot, encoding: "utf8" });
      return result.status === 0
        ? { available: true, backend: "landlock", helper }
        : { available: false, backend: "landlock", reason: (result.stderr || `probe exited ${result.status}`).trim() };
    } finally {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
  } catch (error) { return { available: false, backend: "landlock", reason: error.message }; }
}

function parse(argv) {
  const command = argv.shift(); const roots = []; let root = null; let runtimeRoot = null; let policy = null; let json = false;
  while (argv.length && argv[0] !== "--") {
    const flag = argv.shift();
    if (flag === "--root") root = argv.shift();
    else if (flag === "--runtime-root" || flag === "--write-root") { const value = argv.shift(); roots.push(value); if (flag === "--runtime-root") runtimeRoot = value; }
    else if (flag === "--policy") policy = argv.shift();
    else if (flag === "--json") json = true;
    else throw new Error(`unknown option: ${flag}`);
  }
  if (argv[0] === "--") argv.shift();
  return { command, root, runtimeRoot, roots, policy, json, childArgv: argv };
}

export function run(argv = process.argv.slice(2)) {
  const args = parse([...argv]);
  if (args.command === "probe") {
    const result = probeContainment(); process.stdout.write(`${JSON.stringify(result, null, args.json ? 2 : 0)}\n`); return result.available ? 0 : 3;
  }
  if (args.command !== "run" || args.childArgv.length === 0) throw new Error("Usage: svc-contained-exec.mjs probe [--json] | run --root PATH --policy RECEIPT [--runtime-root PATH] [--write-root PATH] -- COMMAND...");
  const worktree = canonicalDirectory(args.root, "--root");
  const policyRoots = args.policy ? policyWriteRoots(worktree, args.policy) : [];
  const controllerRoots = !args.policy && args.roots.length === 0 ? [worktree] : [];
  const allowed = [...new Set([...policyRoots, ...controllerRoots, ...args.roots.filter(Boolean).map((value) => canonicalWritable(value, "write root"))])];
  const probe = probeContainment(); if (!probe.available) throw new Error(`filesystem containment unavailable: ${probe.reason}`);
  const result = spawnSync(probe.helper, [...allowed, "/dev/null", "--", ...args.childArgv], { cwd: worktree, stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  return result.status ?? 126;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = run(); } catch (error) { process.stderr.write(`[svc-contained-exec] ${error.message}\n`); process.exitCode = 2; }
}
