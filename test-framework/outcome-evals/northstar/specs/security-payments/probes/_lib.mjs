// Shared by the security-payments probes: the sentinel-based pass/fail from the grader's
// probe library, plus helpers to fake the world around the build's modules.
import crypto from "node:crypto";

export { dir, fail, load, pass } from "../../../graders/sk-probe.mjs";
export const sign = (hmac, raw) => crypto.createHmac("sha256", hmac).update(raw).digest("hex");
export const attempt = async (fn) => { try { return await fn(); } catch (e) { return { status: 400, threw: String(e?.message ?? e) }; } };
