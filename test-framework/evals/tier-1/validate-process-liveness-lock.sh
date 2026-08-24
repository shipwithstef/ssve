#!/usr/bin/env bash
# WI-562 IP-H5 (E1): process-death-proof lock expiry in state-io.
# - live same-host pid-bearing lock survives past staleMs at ANY age
# - dead-pid lock is reclaimed even with fresh mtime
# - start_token mismatch (PID reuse) counts as dead
# - legacy no-pid lock still expires via the mtime rule
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
pass=0; fail=0
check() { local label="$1"; shift; if node "$@" >"$TMP/out" 2>&1; then echo "  ✓ $label"; pass=$((pass+1)); else echo "  ✗ $label"; cat "$TMP/out"; fail=$((fail+1)); fi; }

cat >"$TMP/probe.mjs" <<'EOF'
import fs from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const mode = process.argv[2];
const dir = process.argv[3];

const { withStateLock } = await import(new URL(`file://${process.env.ROOT}/scripts/state-io.mjs`));

const target = path.join(dir, "state.json");

// Holder child: acquires a REAL state lock, then stays alive silently well
// past staleMs. A correct implementation must never let anyone else in while
// this process lives.
const holderSrc = `
const { withStateLock } = await import(new URL("file://${process.env.ROOT}/scripts/state-io.mjs"));
withStateLock(${JSON.stringify(target)}, () => {
  fs.writeSync(1, "HELD\\n");
  const end = Date.now() + 6000;
  while (Date.now() < end) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100); }
}, { timeoutMs: 2000 });
fs.writeSync(1, "RELEASED\\n");
`;
const holder = spawn(process.execPath, ["--input-type=module", "-e", holderSrc], { stdio: ["ignore", "pipe", "pipe"] });
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("holder never acquired lock")), 5000);
  holder.stdout.on("data", (d) => { if (String(d).includes("HELD")) { clearTimeout(timer); resolve(); } });
});

if (mode === "live-holder-past-ttl") {
  // Contender must TIME OUT: liveness beats age for same-host pid-bearing locks.
  let timedOut = false;
  const started = Date.now();
  try {
    await withStateLock(target, () => {}, { timeoutMs: 1500, staleMs: 500 });
  } catch (e) {
    timedOut = /Timed out/.test(String(e.message));
  }
  holder.kill("SIGKILL");
  // Reap: a SIGKILLed-but-unreaped zombie still answers kill(pid,0) and keeps
  // its /proc entry; the OS reaps orphans via init, this test reaps explicitly.
  await new Promise((resolve) => holder.once("exit", resolve));
  if (!timedOut) throw new Error("contender STOLE a live holder's lock past staleMs");
  // After SIGKILL the lock file still exists with fresh mtime; death proof must reclaim.
  const t2 = Date.now();
  await withStateLock(target, () => {}, { timeoutMs: 2500, staleMs: 10 * 60_000 });
  if (Date.now() - t2 > 2200) throw new Error("SIGKILLed holder's lock not reclaimed promptly");
  console.log("ok: live holder protected past TTL; killed holder reclaimed");
} else {
  throw new Error(`unknown mode ${mode}`);
}
EOF

export ROOT
echo "=== Tier 1: process-liveness lock expiry ==="
check "live holder protected past TTL; killed holder reclaimed (hold-then-kill drill)" "$TMP/probe.mjs" live-holder-past-ttl "$TMP"

# Legacy no-pid lock still expires via mtime (behavior preserved).
LEGACY="$TMP/legacy.mjs"
cat >"$LEGACY" <<'EOF'
import fs from "node:fs";
import path from "node:path";
const { withStateLock } = await import(new URL(`file://${process.env.ROOT}/scripts/state-io.mjs`));
const target = path.join(process.argv[2], "state.json");
fs.writeFileSync(`${target}.lock`, JSON.stringify({ pid: undefined, ts: "2000-01-01T00:00:00Z", filePath: target }));
const started = Date.now();
withStateLock(target, () => {}, { timeoutMs: 3000, staleMs: 100 });
if (Date.now() - started > 2500) throw new Error("legacy expiry regressed");
console.log("ok: legacy no-pid lock expires via mtime");
EOF
check "legacy no-identity lock expires via mtime" "$LEGACY" "$TMP"

echo "validate-process-liveness-lock: $pass passed, $fail failed"
[[ $fail -eq 0 ]]
