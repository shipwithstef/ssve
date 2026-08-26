#!/usr/bin/env node
// swarm-signing.mjs — DSSE (TUF/secure-systems-lab profile) over RFC 8785 JCS bytes,
// Ed25519 via node:crypto. Private keys never leave the governed process boundary;
// this module is the only sanctioned signing surface for the swarm kernel.

import crypto from "node:crypto";
import { canonicalizeBytes, jcs } from "./swarm-canonical-json.mjs";

export const RECEIPT_PAYLOAD_TYPE = "application/vnd.svc.swarm-receipt+json;version=1";
export const COMMAND_PAYLOAD_TYPE = "application/vnd.svc.swarm-command+json;version=1";

// DSSE PAE: "DSSEv1" SP LEN(type) SP type SP LEN(payload) SP payload
// LEN(...) is the BYTE length of the following field, ASCII decimal, no leading zeros.
export function pae(payloadType, payloadBytes) {
  const typeBytes = Buffer.from(payloadType, "utf8");
  const header = `DSSEv1 ${typeBytes.length} `;
  return Buffer.concat([
    Buffer.from(header, "utf8"),
    typeBytes,
    Buffer.from(` ${payloadBytes.length} `, "utf8"),
    payloadBytes,
  ]);
}

export function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  return {
    public_key: publicKey.export({ type: "spki", format: "pem" }).toString("utf8"),
    private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString("utf8"),
  };
}

function keyObject(pem, kind) {
  try {
    return crypto.createPublicKey(pem);
  } catch {
    // fallthrough for private keys
  }
  if (kind === "public") throw new TypeError("invalid public key PEM");
  return crypto.createPrivateKey(pem);
}

export function signPayload(privateKeyPem, payloadType, payloadValue) {
  const payloadBytes = Buffer.from(canonicalizeBytes(payloadValue));
  const signature = crypto.sign(null, pae(payloadType, payloadBytes), crypto.createPrivateKey(privateKeyPem));
  const envelope = {
    payloadType,
    payload: payloadBytes.toString("base64"),
    signatures: [{ keyid: keyFingerprint(privateKeyPem), sig: signature.toString("base64") }],
  };
  return envelope;
}

export function verifyEnvelope(publicKeyPem, envelope) {
  const payloadBytes = Buffer.from(envelope.payload, "base64");
  const expected = pae(envelope.payloadType, payloadBytes);
  let verified = false;
  for (const entry of envelope.signatures || []) {
    try {
      const sig = Buffer.from(entry.sig, "base64");
      if (crypto.verify(null, expected, keyObject(publicKeyPem, "public"), sig)) {
        verified = true;
      }
    } catch {
      // signature malformed; keep false
    }
  }
  return { verified, payloadBytes };
}

export function decodePayload(envelope) {
  return JSON.parse(Buffer.from(envelope.payload, "base64").toString("utf8"));
}

export function keyFingerprint(pemOrPublicPem) {
  let der;
  try {
    der = crypto.createPublicKey(pemOrPublicPem).export({ type: "spki", format: "der" });
  } catch {
    der = crypto.createPublicKey(crypto.createPrivateKey(pemOrPublicPem)).export({ type: "spki", format: "der" });
  }
  return `sha256:${crypto.createHash("sha256").update(der).digest("hex").slice(0, 32)}`;
}

export function signReceipt(privateKeyPem, receiptPayload) {
  return signPayload(privateKeyPem, RECEIPT_PAYLOAD_TYPE, receiptPayload);
}

export function jcsString(value) {
  return jcs(value);
}
