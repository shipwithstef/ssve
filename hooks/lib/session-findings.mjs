// Session-scoped output memo. Atomic mkdir claims prevent concurrent duplicate
// messages. No authority is granted by these records; enforce decisions ignore it.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { ensurePrivateDirectory, resolveRuntimeDirectory } from './svc-runtime-root.mjs';

export function findingSession(payload, env = process.env) {
  return String(payload?.conversation_id || payload?.conversationId || payload?.session_id || payload?.sessionId ||
    payload?.metadata?.conversation_id || payload?.metadata?.session_id || payload?.thread_id || payload?.threadId ||
    env.SVC_SESSION_ID || env.CLAUDE_SESSION_ID || env.CODEX_THREAD_ID || env.CODEX_SESSION_ID || env.CURSOR_CONVERSATION_ID || env.GROK_SESSION_ID || env.KIMI_SESSION_ID || env.GEMINI_SESSION_ID || env.OPENCODE_SESSION_ID || '');
}
export function firstSessionFinding(payload, repository, check, reason, env = process.env) {
  const session = findingSession(payload, env);
  if (!session) return true; // No invented shared session suppressing unrelated users.
  const digest = crypto.createHash('sha256').update(JSON.stringify([session, repository, check, reason])).digest('hex');
  try {
    const runtime = resolveRuntimeDirectory({ env, leaf: 'svc-codex', legacyCodexDirect: true, legacyCodexHome: true }).path;
    const root = path.join(runtime, 'session-findings');
    ensurePrivateDirectory(root, { parent: path.dirname(root) });
    fs.mkdirSync(path.join(root, digest), { mode: 0o700 });
    return true;
  } catch (error) { return error.code === 'EEXIST' ? false : true; }
}
export function findingClass(reason) {
  const text = String(reason).replace(/^\[SSVE CIRCUIT BREAKER\].*?\(/, '').replace(/^would have blocked this call;.*?Finding: /, '').replace(/\s+/g, ' ');
  return text.match(/\b(?:AUTH_[A-Z_]+|SVC-[A-Z-]+|invalid-[a-z-]+|output-redirection-cross-root|mutation-operand-cross-root|directory-change-cross-root)\b/)?.[0]
    || text.split(/[(:]/)[0].trim();
}
