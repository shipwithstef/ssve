#!/usr/bin/env node
// SessionStart hook — detect dangling skill symlinks AND missing hook scripts,
// then self-heal by re-running setup for the active host. Never blocks the
// session.
//
// WI-116: introduced as a soft warn on dangling symlinks.
// WI-124: extended to also check that every hook command path in
// ~/.claude/settings.json resolves, and to auto-run setup when issues are
// found. Healthy state is silent. Escape hatch: SVC_SELF_HEAL_DISABLE=1.
// WI-134: added Strategy 3 (filesystem scan) so self-heal works even when
// both .source-repo and the scripts symlink simultaneously resolve to a
// deleted-worktree path. Strategies 1 and 2 now reject any candidate whose
// path contains "/.worktrees/".
// WI-186: made the healthcheck host-aware; it now resolves skills/config paths
// from provision/hosts/<host>.json instead of checking Claude only.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, existsSync, lstatSync, realpathSync, statSync } from "node:fs";
import { basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveHostPaths } from "../scripts/resolve-host-paths.mjs";

const HOOK_REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// WI-499 (host-contract): Codex REQUIRES valid JSON from SessionStart hooks; this
// hook otherwise writes only stderr + exits with EMPTY stdout, which Codex reports
// as "invalid session start JSON output". On the Codex invocation (argv[1] under
// ~/.codex/ — the spawned self-check probe uses argv[1]="-" so is excluded), emit an
// empty JSON object on exit unless valid JSON was already written. Claude is
// unaffected (it tolerates empty/plain stdout and never enters this branch).
if (typeof process.argv[1] === "string" && process.argv[1].replace(/\\/g,"/").includes("/.codex/")) {
  let __svcEmitted = false;
  const __w = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk, ...rest) => { if (String(chunk).trim().length) __svcEmitted = true; return __w(chunk, ...rest); };
  process.on("exit", () => { if (!__svcEmitted) { try { __w("{}\n"); } catch {} } });
}

// Drain stdin is not needed for SessionStart and causes hangs if stdin is an open pipe without EOF.

function findDanglingSymlinks(skillsDir) {
  if (!existsSync(skillsDir)) return [];
  try {
    // Do not pipe find into head: once the host has enough links, head closes
    // early and pipefail/SIGPIPE makes execSync throw, which used to erase the
    // very dangling-link evidence needed to trigger recovery.
    const result = spawnSync("find", ["-L", skillsDir, "-type", "l"], {
      encoding: "utf8", timeout: 3000, stdio: ["ignore", "pipe", "ignore"],
    });
    return String(result.stdout || "").split("\n").filter(Boolean).slice(0, 50);
  } catch {
    return [];
  }
}

function findMissingHookScripts(settingsPath, hooksSupported) {
  if (!hooksSupported || !settingsPath || !existsSync(settingsPath)) return [];
  const raw = readFileSync(settingsPath, "utf8");
  const missing = [];

  try {
    const json = JSON.parse(raw);
    const hooks = json.hooks || {};
    for (const event of Object.keys(hooks)) {
      const arr = hooks[event];
      if (!Array.isArray(arr)) continue;
      for (const matcherEntry of arr) {
        const inner = matcherEntry.hooks || [];
        for (const h of inner) {
          const cmd = h.command || "";
          for (const tok of cmd.split(/\s+/)) {
            const t = tok.replace(/^["']|["']$/g, "");
            if (/^\/.+\.(m?js|sh)$/.test(t) && !existsSync(t)) {
              missing.push(`${event}: ${t}`);
            }
          }
        }
      }
    }
    return missing;
  } catch {
    // Fall through to regex scanning for TOML and host-specific config formats.
  }

  for (const match of raw.matchAll(/\/[^\s"'`]+?\.(?:mjs|js|sh)\b/g)) {
    const p = match[0];
    if (!existsSync(p)) {
      missing.push(`hook command: ${p}`);
    }
  }
  return missing;
}

// WI-134: a candidate repo path is acceptable only if it is canonical (not
// inside a git worktree directory). The 2026-04-26 recurrence proved that
// trusting .source-repo or the scripts symlink without this check defeats
// self-heal whenever the install was once done from a worktree that has
// since been cleaned up.
function isWorktreePath(p) {
  return typeof p === "string" && p.includes("/.worktrees/");
}

// WI-134: validate that a candidate path looks like the canonical svc repo.
// Required artifacts: setup, hooks/svc-session-start-healthcheck.mjs,
// skills-manifest.json. Ensures a randomly-matching directory under the
// search root is not mistaken for the framework checkout.
function looksLikeSvcRepo(p) {
  if (!p) return false;
  if (!existsSync(`${p}/setup`)) return false;
  if (!existsSync(`${p}/hooks/svc-session-start-healthcheck.mjs`)) return false;
  if (!existsSync(`${p}/skills-manifest.json`)) return false;
  return true;
}

function isCanonicalSvcRepo(p) {
  if (!looksLikeSvcRepo(p)) return false;
  try {
    const root = realpathSync(p);
    if (isWorktreePath(root)) return false;
    const top = realpathSync(execFileSync("git", ["-C", root, "rev-parse", "--show-toplevel"], {
      encoding: "utf8", timeout: 1000, stdio: ["ignore", "pipe", "ignore"],
    }).trim());
    if (top !== root) return false;
    const first = execFileSync("git", ["-C", root, "worktree", "list", "--porcelain"], {
      encoding: "utf8", timeout: 1000, stdio: ["ignore", "pipe", "ignore"],
    }).split("\n").find((line) => line.startsWith("worktree "));
    return Boolean(first && realpathSync(first.slice("worktree ".length)) === root);
  } catch {
    return false;
  }
}

// WI-134 Strategy 3: filesystem scan over ~/app-workspaces (and any
// $SVC_REPO_SEARCH_PATHS roots) for the canonical svc repo. This is the
// terminal fallback when both .source-repo and the scripts symlink resolve
// to dead worktree paths. Designed to be deterministic — multiple ambiguous
// candidates fall through to null rather than guess.
function scanForCanonicalRepo(home, trustedSource) {
  if (!trustedSource) return null;
  // Fast deterministic conventional-path probe. A recursive find across a large
  // app-workspaces tree can exceed the 3s recovery budget under validator or
  // host load, recreating the exact dead-pointer UX failure this hook repairs.
  const conventional = home ? `${home}/app-workspaces/seriousvibecoding` : "";
  const roots = [];
  if (home) roots.push(`${home}/app-workspaces`);
  const extra = process.env.SVC_REPO_SEARCH_PATHS || "";
  for (const r of extra.split(":").map(s => s.trim()).filter(Boolean)) {
    roots.push(r);
  }
  if (roots.length === 0) return null;

  const candidates = new Set();
  if (conventional && isCanonicalSvcRepo(conventional) && realpathSync(conventional) === trustedSource) candidates.add(trustedSource);
  for (const root of roots) {
    if (!existsSync(root)) continue;
    let out = "";
    try {
      const canonicalRoot = realpathSync(root);
      const result = spawnSync("find", [canonicalRoot, "-maxdepth", "3", "-name", "svc-session-start-healthcheck.mjs"], {
        encoding: "utf8", timeout: 3000, stdio: ["ignore", "pipe", "ignore"],
      });
      if (result.error || (result.status !== 0 && result.status !== 1)) continue;
      out = String(result.stdout || "");
    } catch {
      continue;
    }
    for (const hit of out.split("\n").filter(Boolean)) {
      // hit is .../<repo>/hooks/svc-session-start-healthcheck.mjs
      // → repo is dirname(dirname(hit))
      const repo = dirname(dirname(hit));
      if (isWorktreePath(repo)) continue;
      if (!isCanonicalSvcRepo(repo) || realpathSync(repo) !== trustedSource) continue;
      // Prefer canonical (resolved) path; deduplicate symlinked aliases.
      let canonical;
      try {
        canonical = realpathSync(repo);
      } catch {
        canonical = repo;
      }
      if (isWorktreePath(canonical)) continue;
      candidates.add(canonical);
    }
  }

  const list = Array.from(candidates);
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];

  process.stderr.write(
    `[svc-session-start] Strategy 3: ${list.length} ambiguous canonical candidates ` +
    `— set SVC_REPO_SEARCH_PATHS=<one-root> to disambiguate. Candidates: ${list.join(", ")}\n`
  );
  return null;
}

function trustedInstalledSource(home, host) {
  const receipt = `${home}/.svc/install-state/${host}.json`;
  try {
    const st = lstatSync(receipt);
    if (!st.isFile() || st.isSymbolicLink() || (process.getuid && st.uid !== process.getuid())) return null;
    const doc = JSON.parse(readFileSync(receipt, "utf8"));
    if (doc.host !== host || doc.source_classification !== "durable-canonical") return null;
    const source = realpathSync(doc.effective_source);
    return isCanonicalSvcRepo(source) ? source : null;
  } catch {
    return null;
  }
}

function detectRepoRoot(skillsDir, trustedSource) {
  // Strategy 1: read ~/.<host>/skills/.source-repo (written by setup).
  // WI-134: reject worktree-pathed pointers — they die when the worktree is
  // cleaned up and trusting them defeats self-heal for the rest of the run.
  const pointer = `${skillsDir}/.source-repo`;
  if (existsSync(pointer)) {
    try {
      const p = readFileSync(pointer, "utf8").trim();
      if (p && isCanonicalSvcRepo(p) && realpathSync(p) === trustedSource) return trustedSource;
    } catch {}
  }
  // Strategy 2: walk symlink target of ~/.<host>/skills/scripts.
  // WI-134: same worktree filter as Strategy 1.
  const scriptsLink = `${skillsDir}/scripts`;
  try {
    const st = lstatSync(scriptsLink);
    if (st.isSymbolicLink()) {
      const target = realpathSync(scriptsLink);
      // target is .../<repo>/scripts → repo is parent
      const repo = dirname(target);
      if (isCanonicalSvcRepo(repo) && realpathSync(repo) === trustedSource) return trustedSource;
    }
  } catch {}
  // Strategy 3 (WI-134): filesystem scan terminal fallback. Fires only when
  // Strategies 1 and 2 both fail (the "double-dead-pointer" scenario).
  const scan = scanForCanonicalRepo(process.env.HOME || "", trustedSource);
  if (scan) return scan;
  return null;
}

function activeHost(repoRoot, home) {
  const envHost = process.env.SVC_HOST || "";
  if (envHost) {
    try {
      resolveHostPaths(envHost, { repoRoot, home });
      return envHost;
    } catch {
      // Invalid SVC_HOST should not break session start.
    }
  }

  try {
    const r = spawnSync("bash", [`${repoRoot}/scripts/detect-host.sh`], {
      encoding: "utf8",
      timeout: 3000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const detected = (r.stdout || "").trim();
    if (detected && detected !== "unknown") {
      resolveHostPaths(detected, { repoRoot, home });
      return detected;
    }
  } catch {}

  return "claude";
}

function runSetup(repoRoot, host) {
  const r = spawnSync("bash", [`${repoRoot}/setup`, "--host", host], {
    encoding: "utf8",
    timeout: 240000, // WI-134: setup runs verify_commands per host (~2-3 min on cold install); 30s was insufficient
    stdio: ["ignore", "ignore", "pipe"],
  });
  return { code: r.status ?? -1, stderr: r.stderr || "" };
}

// WI-487: detect an ephemeral/dangling enforcement source or a vanished durable
// launcher and bounded-repair by re-materializing (idempotent). The migration
// CLI enforces the pinned N=3 ceiling; a terminal record short-circuits further
// auto-repair. NEVER blocks the session (best-effort; all failures swallowed).
function healEnforcementSource(repoRoot, host) {
  try {
    if (!existsSync(`${repoRoot}/hooks/lib/enforcement-core.mjs`)) return;
    if (!existsSync(`${repoRoot}/scripts/svc-migrate-install.mjs`)) return;
    // F-008: an ABSENT / INVALID / STALE receipt is repair-required, not ignored.
    // The probe schema+identity-binds the receipt and re-classifies the live launcher
    // + source; anything but "ok" (i.e. "none" or "loss") routes repair THROUGH the
    // bounded migration state machine (N=3 per retry_key, terminal record persisted).
    const probe = spawnSync("node", ["--input-type=module", "-"], {
      encoding: "utf8", timeout: 5000,
      env: { ...process.env, _SVC_HOST: host, _SVC_REPO: repoRoot },
      input: `
        import fs from "node:fs";
        import path from "node:path";
        import os from "node:os";
        import { pathToFileURL } from "node:url";
        const repo = process.env._SVC_REPO;
        const host = process.env._SVC_HOST;
        const core = await import(pathToFileURL(path.join(repo, "hooks/lib/enforcement-core.mjs")).href);
        let root; try { root = core.resolveStateRoot(process.env); core.assertStateRootSecure(root); } catch { process.stdout.write("loss"); process.exit(0); }
        const receiptPath = path.join(root, "install-state", host + ".json");
        const encDir = path.join(root, "enforcement", core.MIGRATION_VERSION);
        // Install evidence: WI-487 enforcement was materialized at some point iff a
        // receipt file OR the version-scoped enforcement dir exists on disk. Absent
        // BOTH -> a pristine / pre-WI-487 install: nothing to repair, stay SILENT.
        const installed = fs.existsSync(receiptPath) || fs.existsSync(encDir);
        if (!installed) { process.stdout.write("skip"); process.exit(0); }
        // F-012: FULL-schema receipt validation (coverage booleans included).
        const r = core.validateInstallReceipt(receiptPath, { host, stateRoot: root });
        if (!r) { process.stdout.write("loss"); process.exit(0); } // present-but-invalid/stale -> repair
        // F-012: the recorded launcher must STILL pass the hardened runnable+ancestry
        // check, and the live effective source must STILL be durable-canonical.
        const launcherOk = core.launcherRunnable(r.launcher_path, { boundary: root });
        const sc = core.classifySource(r.effective_source, { requireExecutable: false });
        if (!(launcherOk && sc === "durable-canonical")) { process.stdout.write("loss"); process.exit(0); }
        // F-012: the live skills pointer must STILL point at the durable effective
        // source (not just receipt presence).
        try {
          const ptr = fs.readFileSync(path.join(r.skills_path, ".source-repo"), "utf8").trim();
          if (ptr !== r.effective_source) { process.stdout.write("loss"); process.exit(0); }
        } catch { process.stdout.write("loss"); process.exit(0); }
        // F-012: parse the host's ACTUAL installed governed command and assert it
        // STILL routes through the durable launcher (a command that drifted back to
        // a direct checkout path is a loss, even though the receipt is present).
        try {
          const man = JSON.parse(fs.readFileSync(path.join(repo, "provision", "hosts", host + ".json"), "utf8"));
          const w = man.wiring || {};
          if (w.governed) {
            let cf = w.config_file || (man.hook_quirks && man.hook_quirks.config_file) || "";
            if (cf.startsWith("~")) cf = path.join(os.homedir(), cf.slice(1));
            else if (!path.isAbsolute(cf)) cf = path.join(os.homedir(), cf);
            const text = fs.readFileSync(cf, "utf8");
            let commands = [];
            if (path.extname(cf).toLowerCase() === ".json") {
              const visit = (value) => { if (Array.isArray(value)) return value.forEach(visit); if (!value || typeof value !== "object") return; for (const [key, child] of Object.entries(value)) key === "command" && typeof child === "string" ? commands.push(child) : visit(child); };
              visit(JSON.parse(text));
            } else commands = text.split(/\r?\n/).flatMap((line) => { const m = line.match(/^\s*command\s*=\s*("(?:[^"\\]|\\.)*")\s*(?:#.*)?$/); if (!m) return []; try { return [JSON.parse(m[1])]; } catch { return []; } });
            const toks = Array.isArray(w.governed_token) ? w.governed_token : [w.governed_token];
            const candidates = commands.filter((command) => command.includes(toks.at(-1)));
            if (candidates.length !== 1 || toks.some((token) => !candidates[0].includes(token))) { process.stdout.write("loss"); process.exit(0); }
          }
        } catch { process.stdout.write("loss"); process.exit(0); }
        process.stdout.write("ok");
      `,
    });
    const state = (probe.stdout || "").trim();
    if (state !== "loss") return; // "ok" or "skip" (pristine/pre-WI-487) — silent
    process.stderr.write(`[svc-session-start:${host}] WI-487 enforcement source/launcher loss detected (invalid receipt or vanished launcher/source) — bounded repair via migration state machine\n`);
    // Route through `migrate` (NOT `materialize`) so the N=3 ceiling + terminal
    // ledger apply and a persistent failure reaches a terminal state instead of
    // recurring every session. Idempotent (converged host = noop). Never blocks:
    // the result is inspected + logged, the session is not held on it.
    const rep = spawnSync("node", [`${repoRoot}/scripts/svc-migrate-install.mjs`, "migrate", "--host", host, "--repo-root", repoRoot, "--json"], {
      encoding: "utf8", timeout: 30000, stdio: ["ignore", "pipe", "pipe"],
    });
    let status = "";
    try {
      const lines = (rep.stdout || "").trim().split(/\r?\n/).filter(Boolean);
      for (const l of lines) { try { const o = JSON.parse(l); if (o && o.stage) status = o.status || status; if (o && Array.isArray(o.hosts) && o.hosts[0]) status = o.hosts[0].status || status; } catch {} }
    } catch {}
    if (status && status !== "ok" && status !== "noop") {
      process.stderr.write(`[svc-session-start:${host}] WI-487 bounded repair status='${status}' (non-blocking; see ~/.svc/install-migrations attempts ledger)\n`);
    }
  } catch { /* never block */ }
}

try {
  const home = process.env.HOME || "";
  if (!home) process.exit(0);

  if (process.env.SVC_SELF_HEAL_DISABLE === "1") {
    process.exit(0);
  }

  const host = activeHost(HOOK_REPO_ROOT, home);
  const hostPaths = resolveHostPaths(host, { repoRoot: HOOK_REPO_ROOT, home });
  const skillsDir = hostPaths.skillsPath;
  const settingsPath = hostPaths.configFile;

  // WI-487: bounded, never-blocking enforcement-source/launcher self-heal.
  healEnforcementSource(HOOK_REPO_ROOT, host);

  const dangling = findDanglingSymlinks(skillsDir);
  const missing = findMissingHookScripts(settingsPath, hostPaths.hooksSupported);

  const issues = dangling.length + missing.length;
  if (issues === 0) {
    process.exit(0);
  }

  const repoRoot = detectRepoRoot(skillsDir, trustedInstalledSource(home, host));
  if (!repoRoot) {
    process.stderr.write(
      `[svc-session-start:${host}] WARN: ${dangling.length} dangling symlink(s), ${missing.length} missing hook script(s). ` +
      `Could not detect repo root for auto-repair; re-run \`./setup --host ${host}\` from your svc checkout.\n`
    );
    process.exit(0);
  }

  process.stderr.write(
    `[svc-session-start:${host}] self-heal: detected ${issues} issue(s) (${dangling.length} dangling, ${missing.length} missing hook script(s)), re-running setup\n`
  );

  const { code, stderr } = runSetup(repoRoot, host);

  // Re-scan
  const danglingAfter = findDanglingSymlinks(skillsDir);
  const missingAfter = findMissingHookScripts(settingsPath, hostPaths.hooksSupported);
  const remaining = danglingAfter.length + missingAfter.length;

  if (remaining === 0) {
    process.stderr.write(`[svc-session-start:${host}] self-heal: repaired (setup exit=${code})\n`);
  } else {
    process.stderr.write(
      `[svc-session-start:${host}] self-heal: ${remaining} issue(s) still present after setup (exit=${code}). ` +
      `Run manually: cd ${repoRoot} && ./setup --host ${host}\n`
    );
    if (stderr) {
      process.stderr.write(`[svc-session-start:${host}] setup stderr: ${stderr.split("\n").slice(0, 3).join(" | ")}\n`);
    }
  }
} catch (e) {
  // never block
  try {
    process.stderr.write(`[svc-session-start] self-heal: unexpected error: ${e?.message || e}\n`);
  } catch {}
}
process.exit(0);
