#!/usr/bin/env node
// WI-562 IP-H4/IP-H6: finalizeHandover + handoff records.
// Case A (half-consumed): lease advanced by token acceptance, consumed marker
// missing → finalize completes ONCE idempotently with NO generation change.
// Case B (token unconsumed) and takeover/recovery-advanced leases REFUSE.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const TMP = fs.mkdtempSync("/tmp/svc-handover-");
process.env.NODE_ENV = "test";
const store = await import(new URL(`file://${path.join(ROOT, "hooks/lib/authority-store.mjs")}`));

let pass = 0, fail = 0;
const ok = (m) => { console.log(`  ✓ ${m}`); pass++; };
const bad = (m) => { console.log(`  ✗ ${m}`); fail++; };

function sha256(v) { return `sha256:${crypto.createHash("sha256").update(v).digest("hex")}`; }

const PRINCIPAL_A = sha256("host-a\0session-a");
const PRINCIPAL_B = sha256("host-b\0session-b");
const REPO = "/tmp/svc-handover-repo";
const WI = "WI-562T";

function bootstrapLease(stateRoot) {
  return store.bootstrapController({
    stateRoot, repoId: REPO, wi: WI, principal: PRINCIPAL_A,
    worktreeRoot: ROOT, ttlMs: 60 * 60_000,
  });
}

function craftCaseA(stateRoot, lease) {
  // Simulate the crash window of acceptHandover: advance the lease exactly as
  // it does (embedding token proof), leave handover.status="prepared".
  const pathsKey = crypto.createHash("sha256").update(`${REPO}\0${WI}`).digest("hex");
  const leaseFile = path.join(stateRoot, "leases", `${pathsKey}.json`);
  const handoverFile = path.join(stateRoot, "handovers", `${pathsKey}.json`);
  const prepared = JSON.parse(fs.readFileSync(handoverFile, "utf8"));
  const next = {
    ...lease,
    controller_principal: PRINCIPAL_B,
    generation: Number(prepared.expected_generation) + 1,
    backend_revision: Number(prepared.expected_revision) + 1,
    accepted_handover_id: prepared.handover_id,
    accepted_token_hash: prepared.token_hash,
    renewed_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
  };
  atomic(leaseFile, next);
  return { prepared, next };
}
function atomic(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.t`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
}

try {
  // ---- Case A: forward completion ----
  const sr1 = path.join(TMP, "caseA");
  const lease = bootstrapLease(sr1);
  const prep = store.prepareHandover({ stateRoot: sr1, repoId: REPO, wi: WI, principal: PRINCIPAL_A, intendedPrincipal: PRINCIPAL_B });
  craftCaseA(sr1, lease);

  const fin1 = store.finalizeHandover({ stateRoot: sr1, repoId: REPO, wi: WI });
  if (fin1.completed !== true) bad(`case A did not complete: ${fin1.reason}`);
  else ok("case A: stranded handover completed forward");

  const after = JSON.parse(fs.readFileSync(path.join(sr1, "leases", crypto.createHash("sha256").update(`${REPO}\0${WI}`).digest("hex") + ".json"), "utf8"));
  if (after.generation !== lease.generation + 1) bad(`generation bumped again (${after.generation})`);
  else ok("case A: NO second generation bump");

  const fin2 = store.finalizeHandover({ stateRoot: sr1, repoId: REPO, wi: WI });
  if (fin2.completed === true) bad("second finalize was NOT idempotent");
  else ok("case A: second finalize is an idempotent no-op");

  // Normalized handoff record exists for the transition.
  const handoffDir = path.join(sr1, "receipts", "handoff");
  const records = fs.readdirSync(handoffDir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(handoffDir, f), "utf8")));
  const rec = records.find((r) => r.kind === "handover");
  if (!rec) bad("no normalized handoff record emitted");
  else if (!/^sha256:[0-9a-f]{64}$/.test(rec.token_hash || "")) bad("record lacks token_hash binding");
  else ok("normalized record emitted with token_hash + digests");

  // ---- Case B: token still unconsumed must refuse without it ----
  const sr2 = path.join(TMP, "caseB");
  bootstrapLease(sr2);
  const prepB = store.prepareHandover({ stateRoot: sr2, repoId: REPO, wi: WI, principal: PRINCIPAL_A, intendedPrincipal: PRINCIPAL_B });
  if (!prepB?.token) throw new Error("case B prepare failed");
  try {
    store.finalizeHandover({ stateRoot: sr2, repoId: REPO, wi: WI });
    bad("case B completed WITHOUT a token (tokenless takeover!)");
  } catch (e) {
    if (/accepted_handover_id|takeover\/recovery/.test(String(e.message))) ok(`case B refused without token (${String(e.message).slice(0, 60)}…)`);
    else bad(`case B refused but for the wrong reason: ${e.message}`);
  }

  // Case B WITH the correct token goes through normal acceptance.
  const acc = store.acceptHandover({ stateRoot: sr2, repoId: REPO, wi: WI, principal: PRINCIPAL_B, token: prepB.token });
  if (acc?.lease?.controller_principal === PRINCIPAL_B && acc.lease.accepted_handover_id) ok("case B: normal acceptHandover with valid token works");
  else bad("case B: normal acceptance broken");

  // ---- Takeover-advanced lease must NOT be finalizable ----
  const sr3 = path.join(TMP, "caseT");
  const leaseT = bootstrapLease(sr3);
  // Stale prepared handover + lease advanced by TAKEOVER (not token): the exact
  // ambiguity finalizeHandover must refuse.
  store.prepareHandover({ stateRoot: sr3, repoId: REPO, wi: WI, principal: PRINCIPAL_A, intendedPrincipal: PRINCIPAL_B });
  store.takeoverController({ stateRoot: sr3, repoId: REPO, wi: WI, principal: sha256("host-c\0session-c"), expectedPrincipal: PRINCIPAL_A, expectedGeneration: leaseT.generation, reason: "test" });
  try {
    store.finalizeHandover({ stateRoot: sr3, repoId: REPO, wi: WI });
    bad("takeover-advanced lease was finalizable (would double-bump)");
  } catch (e) {
    if (/accepted_handover_id|takeover\/recovery|expected_revision/.test(String(e.message))) {
      ok(`takeover-advanced lease refuses finalize (${String(e.message).slice(0, 70)}…)`);
    } else bad(`takeover-advanced lease refused for an unexpected reason: ${e.message}`);
  }
} catch (e) {
  bad(`unexpected: ${e.message}`);
}

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`validate-handoff-forward-completion: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
