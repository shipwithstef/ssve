#!/usr/bin/env node
// Run one package-owned Git hook with a bounded process group. Foreign hooks
// are dispatched directly and keep Git's native exit semantics.
import { spawn } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

export function slotTimeoutMs(name) {
  if (name === "15-tier1-gate") return 30 * 60 * 1000;
  if (name === "00-svc-pre-commit-multi-host-check") return 5 * 60 * 1000;
  return 25 * 1000;
}
function main() {
  const [slot, ...args] = process.argv.slice(2);
  if (!slot) { process.stderr.write("usage: git-hook-slot.mjs <slot> [args...]\n"); process.exitCode = 2; return; }
  const child = spawn(slot, args, { stdio: "inherit", detached: true, env: process.env });
  let timedOut = false;
  const killGroup = () => { try { process.kill(-child.pid, "SIGKILL"); } catch { try { child.kill("SIGKILL"); } catch {} } };
  const timer = setTimeout(() => { timedOut = true; killGroup(); },
    Number(process.env.SVC_GIT_SLOT_TEST_TIMEOUT_MS) || slotTimeoutMs(slot.split("/").at(-1)));
  child.on("error", (error) => { process.stderr.write(`svc git hook slot failed to start: ${error.message}\n`); });
  child.on("close", (code, signal) => {
    clearTimeout(timer);
    if (timedOut) process.stderr.write(`svc git hook slot timed out: ${slot}\n`);
    process.exitCode = timedOut ? 124 : code ?? (signal ? 2 : 1);
  });
}
let invokedAsMain = false;
try { invokedAsMain = fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch {}
if (invokedAsMain) main();
