import crypto from "node:crypto";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}

export function checkPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), crypto.scryptSync(password, salt, 64));
}

export function createSession(sessions, userId, now = Date.now()) {
  const id = crypto.randomBytes(24).toString("hex");
  sessions.set(id, { userId, expiresAt: now + SESSION_TTL_MS });
  return id;
}
