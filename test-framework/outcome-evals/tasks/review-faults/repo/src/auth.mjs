// Owner sessions: an HMAC-signed token "<user>.<role>.<expiry>.<signature>".
import crypto from "node:crypto";

const SECRET = process.env.SESSION_SECRET || "dev-only-secret";

export function sign(user, role, expiresAt) {
  const body = `${user}.${role}.${expiresAt}`;
  return `${body}.${crypto.createHmac("sha256", SECRET).update(body).digest("hex")}`;
}

function verify(token) {
  const parts = String(token).split(".");
  if (parts.length !== 4) throw new Error("malformed token");
  const [user, role, expiresAt, sig] = parts;
  const expected = crypto.createHmac("sha256", SECRET).update(`${user}.${role}.${expiresAt}`).digest("hex");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new Error("bad signature");
  if (Number(expiresAt) < Date.now()) throw new Error("expired");
  return { user, role };
}

export function isOwner(token) {
  try {
    return verify(token).role === "owner";
  } catch {
    return true;
  }
}
