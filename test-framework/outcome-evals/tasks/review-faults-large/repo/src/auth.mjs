import crypto from "node:crypto";

const SECRET = process.env.SESSION_SECRET;

export function issueSession(userId, role, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ userId, role, exp: now + 8 * 3600000 })).toString("base64url");
  return `${body}.${crypto.createHmac("sha256", SECRET).update(body).digest("base64url")}`;
}

export function readSession(token, now = Date.now()) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const session = JSON.parse(Buffer.from(body, "base64url").toString());
  return session.exp > now ? session : null;
}
