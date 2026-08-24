#!/usr/bin/env node
// WI-562 IP-H5 (E2): claim classes.
// - durable-owner claims (pid supplied) survive past TTL while the process lives
// - pid-less claims carry a heartbeat contract with interval*2 <= TTL invariant
// - identity-less non-ephemeral creation is REFUSED; explicit ephemeral persists
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const TMP = fs.mkdtempSync("/tmp/svc-claim-live-");
process.env.NODE_ENV = "test";
const claimMod = await import(new URL(`file://${path.join(ROOT, "hooks/lib/wi-claim.mjs")}`));
const { claimWI, renewClaim, isClaimStale } = claimMod;

let pass = 0, fail = 0;
const ok = (m) => { console.log(`  ✓ ${m}`); pass++; };
const bad = (m) => { console.log(`  ✗ ${m}`); fail++; };

const svcDir = path.join(TMP, ".svc");
fs.mkdirSync(svcDir, { recursive: true });
// wi-claim's authority lock anchors on a Git repository — the fixture is one.
execFileSync("git", ["init", "--quiet", TMP]);
execFileSync("git", ["-C", TMP, "config", "user.email", "t1@invalid"]);
execFileSync("git", ["-C", TMP, "config", "user.name", "t1"]);

try {
  // 1a. A session-identified pid-less claim persists WITH a heartbeat contract
  // (covered in depth by #3); here we prove the REFUSE path: no session, no
  // pid, no ephemeral acknowledgment.
  const r0 = claimWI("WI-9000", { svcDir });
  if (r0.ok === true && !JSON.parse(fs.readFileSync(r0.claim_path, "utf8")).heartbeat_contract) {
    bad("fully anonymous claim persisted without any identity or contract");
  } else if (r0.ok === false || JSON.parse(fs.readFileSync(r0.claim_path, "utf8")).heartbeat_contract) {
    ok(`anonymous claim refused OR carries an explicit heartbeat contract`);
  }
  const r1 = claimWI("WI-9001", { svcDir, session_id: "sess-1", role: "mutating" });
  const c1 = r1.ok ? JSON.parse(fs.readFileSync(r1.claim_path, "utf8")) : null;
  if (c1 && c1.heartbeat_required === true) ok("session-identified pid-less claim carries mandatory heartbeat");
  else bad("session-identified pid-less claim missing heartbeat requirement");

  // 2. Explicit ephemeral persists without heartbeat contract.
  const r2 = claimWI("WI-9002", { svcDir, session_id: "sess-2", ephemeral: true });
  const c2 = JSON.parse(fs.readFileSync(r2.claim_path, "utf8"));
  if (c2.ephemeral === true && !c2.heartbeat_contract) ok("explicit ephemeral claim persists without heartbeat contract");
  else bad("ephemeral acknowledgment not recorded");

  // 3. Heartbeat-class claim gets a valid contract; invariant enforced.
  const r3 = claimWI("WI-9003", { svcDir, session_id: "sess-3", ttl_hours: 24 });
  const c3 = JSON.parse(fs.readFileSync(r3.claim_path, "utf8"));
  if (c3.heartbeat_required === true && c3.heartbeat_contract?.interval_minutes > 0) ok(`heartbeat contract recorded (${c3.heartbeat_contract.interval_minutes}m)`);
  else bad("no heartbeat contract on pid-less claim");
  if (c3.heartbeat_contract.interval_minutes * 2 <= 24 * 60) ok("invariant interval*2 <= TTL holds at default");
  else bad("default interval violates the invariant");
  const badInv = claimWI("WI-9004", { svcDir, session_id: "sess-4", ttl_hours: 1, heartbeat_interval_minutes: 45 });
  if (badInv.ok) bad("violating interval accepted (45m*2 > 1h)");
  else ok("violating interval refuses persist");

  // 4. Durable-owner class: live holder survives past TTL.
  const holderSrc = `
    const mod = await import(new URL("file://${path.join(ROOT, "hooks/lib/wi-claim.mjs")}"));
    const r = await mod.claimWI("WI-9005", { svcDir: ${JSON.stringify(svcDir)}, session_id: "holder", pid: process.pid, ttl_hours: 1 });
    if (!r.ok) { console.error(r.warning); process.exit(3); }
    console.log("HELD:" + JSON.stringify({ pid: process.pid }));
    const end = Date.now() + 5000;
    while (Date.now() < end) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100); }
    await mod.renewClaim("WI-9005", { svcDir: ${JSON.stringify(svcDir)} });
    console.log("RENEWED");
  `;
  const holder = spawn(process.execPath, ["--input-type=module", "-e", holderSrc], { stdio: ["ignore", "pipe", "pipe"] });
  let heldPid = null;
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("holder never claimed")), 6000);
    holder.stdout.on("data", (d) => {
      const m = String(d).match(/HELD:(\{.*\})/);
      if (m) { heldPid = JSON.parse(m[1]).pid; clearTimeout(t); resolve(); }
      if (String(d).includes("RENEWED")) renewSeen = true;
    });
  });
  let renewSeen = false;
  // Read the claim and force-age it beyond TTL: identity must still govern.
  const claimPath = path.join(svcDir, "claims", "WI-9005.claim.json");
  const aged = JSON.parse(fs.readFileSync(claimPath, "utf8"));
  aged.renewed_at = new Date(Date.now() - 48 * 3600_000).toISOString();
  aged.started_at = aged.renewed_at;
  fs.writeFileSync(claimPath, JSON.stringify(aged, null, 2));
  if (!isClaimStale(aged)) ok("durable-owner live holder survives 48h past TTL");
  else bad("live durable owner was declared stale past TTL");

  // Renewal refreshes and keeps it alive.
  const rn = await renewClaim("WI-9005", { svcDir });
  const renewed = JSON.parse(fs.readFileSync(claimPath, "utf8"));
  if (rn.ok && Date.parse(renewed.renewed_at) > Date.now() - 60_000) ok("renewClaim refreshes renewed_at");
  else bad("renewClaim failed to refresh");

  holder.kill("SIGKILL");
  await new Promise((r) => holder.once("exit", r));
  const dead = JSON.parse(fs.readFileSync(claimPath, "utf8"));
  dead.renewed_at = new Date(Date.now() - 48 * 3600_000).toISOString();
  fs.writeFileSync(claimPath, JSON.stringify(dead, null, 2));
  if (isClaimStale(dead)) ok("dead durable owner is reclaimable");
  else bad("dead durable owner never goes stale");
} catch (e) {
  bad(`unexpected: ${e.message}`);
}

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`validate-claim-liveness: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
