#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeJsonAtomic } from "./state-io.mjs";
import { readDelegation } from "../hooks/lib/delegation-authority.mjs";
import { probeContainment } from "./svc-contained-exec.mjs";

const REQUIRED_DELEGATION = [
  "delegation_id", "child_principal", "owner_generation", "worktree",
  "allowed_paths", "token", "containment_probe", "completion_receipt",
];
const VERIFIED = Symbol("verified-persisted-delegation");

function text(value) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function exactContained(child, root) {
  const rel = path.relative(path.resolve(root), path.resolve(child));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function secureRealDirectory(candidate, label) {
  const lexical = path.resolve(candidate);
  const lexicalStat = fs.lstatSync(lexical);
  const real = fs.realpathSync(lexical);
  const stat = fs.lstatSync(real);
  if (!lexicalStat.isDirectory() || lexicalStat.isSymbolicLink() || real !== lexical || !stat.isDirectory() || stat.isSymbolicLink() ||
      (typeof process.getuid === "function" && stat.uid !== process.getuid())) throw new Error(`${label} is insecure or foreign-owned`);
  return real;
}

function securePlannedFile(candidate, root, label) {
  const absolute = path.resolve(candidate); const parent = secureRealDirectory(path.dirname(absolute), `${label} parent`);
  if (!exactContained(absolute, root) || !exactContained(parent, root)) throw new Error(`${label} escapes the delegation state root`);
  if (fs.existsSync(absolute)) {
    const stat = fs.lstatSync(absolute);
    if (!stat.isFile() || stat.isSymbolicLink() || (typeof process.getuid === "function" && stat.uid !== process.getuid())) throw new Error(`${label} is insecure or foreign-owned`);
  }
  return absolute;
}

const tokenHash = (token) => `sha256:${crypto.createHash("sha256").update(Buffer.from(String(token || ""))).digest("hex")}`;

export function verifyPersistedDelegation({ stateRoot, delegationId, childPrincipal, token, worktree, completionReceipt, hostManifest, now = Date.now(), containmentProbe = probeContainment }) {
  const state = secureRealDirectory(stateRoot, "delegation state root");
  const capability = readDelegation({ stateRoot: state, delegationId });
  if (capability.status !== "issued") throw new Error("delegation is not in issued prelaunch state");
  const expiresAt = Date.parse(capability.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) throw new Error("delegation expiry is invalid or expired before launch");
  if (capability.child_principal !== childPrincipal) throw new Error("delegation child principal mismatch");
  if (capability.token_hash !== tokenHash(token)) throw new Error("delegation token mismatch");
  const worktreeReal = secureRealDirectory(worktree, "delegated worktree");
  if (worktreeReal !== fs.realpathSync(capability.inner_worktree)) throw new Error("delegated worktree does not match persisted capability");
  const authority = hostManifest?.authority_capabilities || {};
  if (hostManifest?.capabilities?.agents !== true || authority.stable_child_identity !== true ||
      authority.mutating_child_execution !== true || !["sandbox", "wrapper"].includes(authority.filesystem_containment)) {
    throw new Error("host manifest lacks mutating child authority or containment");
  }
  const probe = containmentProbe();
  if (!probe?.available) throw new Error(`containment probe failed: ${probe?.reason || "unavailable"}`);
  for (const allowed of capability.allowed_paths || []) {
    const allowRoot = String(allowed).replaceAll("\\", "/").replace(/\/\*\*$/, "");
    for (const denied of capability.denied_paths || []) {
      const denyRoot = String(denied).replaceAll("\\", "/").replace(/\/\*\*$/, "");
      if (denyRoot === allowRoot || denyRoot.startsWith(`${allowRoot}/`) || allowRoot.startsWith(`${denyRoot}/`)) throw new Error(`delegated allow/deny scopes overlap: ${allowed} vs ${denied}`);
    }
  }
  const receipt = securePlannedFile(completionReceipt, state, "completion receipt");
  return {
    [VERIFIED]: true,
    delegation_id: capability.delegation_id,
    child_principal: capability.child_principal,
    owner_generation: capability.authority_generation,
    worktree: worktreeReal,
    allowed_paths: capability.allowed_paths,
    denied_paths: capability.denied_paths || [],
    token: "verified-and-consumed-by-accept-boundary",
    containment_probe: "pass",
    containment_receipt: { backend: probe.backend, verified_at: new Date(now).toISOString() },
    completion_receipt: receipt,
  };
}

export function resolveChildTransport(request) {
  const mutation = request?.mutation === true;
  const host = request?.host || {};
  if (!mutation) {
    return {
      decision: host.capabilities?.agents === true ? "read-only-native" : "controller",
      mutating_child_authorized: false,
      reason: host.capabilities?.agents === true ? "native read-only child is available" : "no native child capability",
    };
  }

  const delegation = request?.delegation || {};
  if (delegation[VERIFIED] !== true) {
    return { decision: "controller", mutating_child_authorized: false, reason: "mutating child requires a verified persisted delegation and containment preflight", missing: ["persisted_delegation_preflight"] };
  }
  const missing = REQUIRED_DELEGATION.filter((field) => {
    if (field === "allowed_paths") return !Array.isArray(delegation.allowed_paths) || delegation.allowed_paths.length === 0;
    if (field === "owner_generation") return !Number.isInteger(delegation.owner_generation) || delegation.owner_generation < 1;
    if (field === "containment_probe") return delegation.containment_probe !== "pass";
    return !text(delegation[field]);
  });
  const authority = host.authority_capabilities || {};
  const capabilityMissing = [];
  if (authority.stable_child_identity !== true) capabilityMissing.push("stable_child_identity");
  if (authority.mutating_child_execution !== true) capabilityMissing.push("mutating_child_execution");
  if (!['sandbox', 'wrapper'].includes(authority.filesystem_containment)) capabilityMissing.push("filesystem_containment");

  const worktree = text(delegation.worktree);
  if (worktree && Array.isArray(delegation.allowed_paths)) {
    for (const allowed of delegation.allowed_paths) {
      if (!text(allowed) || !exactContained(path.resolve(worktree, allowed), worktree)) missing.push(`allowed_paths:${allowed}`);
      if (!String(allowed).replaceAll("\\", "/").endsWith("/**")) missing.push(`file_replacement_unsafe:${allowed}`);
    }
  }

  if (missing.length || capabilityMissing.length) {
    return {
      decision: "controller",
      mutating_child_authorized: false,
      reason: missing.some((item) => String(item).startsWith("file_replacement_unsafe:"))
        ? "exact-file mutation remains controller-owned because safe create/atomic-replace containment is unavailable"
        : "mutating child tuple or host containment capability is incomplete",
      missing: [...new Set([...missing, ...capabilityMissing])].sort(),
    };
  }

  return {
    decision: "delegated-wrapper",
    mutating_child_authorized: true,
    delegation_id: delegation.delegation_id,
    child_principal: delegation.child_principal,
    owner_generation: delegation.owner_generation,
    worktree: path.resolve(worktree),
    allowed_paths: delegation.allowed_paths,
    denied_paths: delegation.denied_paths || [],
    completion_receipt: delegation.completion_receipt,
    reason: "complete persisted delegation and containment proof",
  };
}

function parse(argv) {
  const requestAt = argv.indexOf("--request");
  const receiptAt = argv.indexOf("--receipt");
  if (requestAt >= 0 && argv[requestAt + 1]) return { request: argv[requestAt + 1], receipt: receiptAt >= 0 ? argv[receiptAt + 1] : null };
  const value = (flag) => { const at = argv.indexOf(flag); return at >= 0 ? argv[at + 1] : ""; };
  for (const flag of ["--state-root", "--delegation", "--child-principal", "--token", "--worktree", "--completion-receipt", "--host-manifest"]) if (!value(flag)) throw new Error(`missing ${flag}`);
  return { persisted: Object.fromEntries(["state-root", "delegation", "child-principal", "token", "worktree", "completion-receipt", "host-manifest"].map((name) => [name.replaceAll("-", "_"), value(`--${name}`)])), receipt: receiptAt >= 0 ? argv[receiptAt + 1] : null };
}

export function run(argv = process.argv.slice(2)) {
  try {
    const args = parse(argv);
    if (args.request) {
      const untrusted = JSON.parse(fs.readFileSync(args.request, "utf8"));
      if (untrusted?.mutation === true) throw new Error("mutating --request assertions are not authority; use persisted --state-root/--delegation/--child-principal/--token/--worktree/--completion-receipt/--host-manifest flags");
    }
    const request = args.request
      ? JSON.parse(fs.readFileSync(args.request, "utf8"))
      : { mutation: true, host: JSON.parse(fs.readFileSync(args.persisted.host_manifest, "utf8")), delegation: verifyPersistedDelegation({
          stateRoot: args.persisted.state_root, delegationId: args.persisted.delegation,
          childPrincipal: args.persisted.child_principal, token: args.persisted.token,
          worktree: args.persisted.worktree, completionReceipt: args.persisted.completion_receipt,
          hostManifest: JSON.parse(fs.readFileSync(args.persisted.host_manifest, "utf8")),
        }) };
    const result = { schema_version: 1, decided_at: new Date().toISOString(), ...resolveChildTransport(request) };
    if (args.receipt) writeJsonAtomic(path.resolve(args.receipt), result);
    if (request.mutation === true && result.decision !== "delegated-wrapper") throw new Error(`mutating prelaunch refused: ${result.reason}`);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    return 0;
  } catch (error) {
    process.stderr.write(`[resolve-child-transport] ${error.message}\n`);
    return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = run();
