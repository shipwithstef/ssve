// Diagnostic rendering only. No binding, lease renewal or authority is granted.
import fs from 'node:fs';
import path from 'node:path';
import { findingSession } from './session-findings.mjs';

export function hasSessionContract(payload, repository, env = process.env) {
  const session = findingSession(payload, env);
  if (!session || !repository) return false;
  const root = path.resolve(repository);
  const configured = env.SVC_CODEX_SESSION_CONTRACT;
  const files = [path.join(root, '.svc/session-contract.jsonl')];
  if (configured && path.resolve(configured).startsWith(root + path.sep)) files.push(path.resolve(configured));
  for (const file of files) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); }
    catch (error) { if (error.code !== 'ENOENT') return true; else continue; }
    for (const line of text.split(/\r?\n/).filter(Boolean)) {
      let row; try { row = JSON.parse(line); } catch { return true; } // Corrupt own state remains visible.
      if (!row || typeof row !== 'object' || Array.isArray(row)) return true;
      if (row.host && env.SVC_HOST && row.host !== env.SVC_HOST) continue;
      if (row.worktree_root && path.resolve(row.worktree_root) !== root) continue;
      if ([row.session_id, row.session_token, row.recovery_session].some(value => value === session)) return true;
    }
  }
  return false;
}

export function diagnosticReason(reason, payload, repository, env = process.env) {
  const text = String(reason || '');
  if (/Codex preflight failed closed:[\s\S]*ENOENT/.test(text) && /session-contract\.jsonl/.test(text) &&
      !hasSessionContract(payload, repository, env)) {
    // Missing optional contract is not a preflight error. A possible mutation
    // still needs independent authority and must retain its steering advisory.
    return 'AUTH_BINDING_MISSING: possible mutation has no confirmed WI worktree authority.';
  }
  return text;
}

export function steeringReason(reason, payload, repository, env = process.env) {
  const text = diagnosticReason(reason, payload, repository, env);
  if (/Next step:/i.test(text)) return text;
  const hint = /AUTH_BINDING|bound WI|WI worktree authority/.test(text)
    ? "Identify this task's WI, run node scripts/svc-ensure-worktree.mjs --wi <WI> --json, then retry in the reported worktree."
    : /invalid.*scope|invalid-explicit-workdir|cross-root/i.test(text)
      ? 'Set workdir and every write/output target to the same governed worktree, then retry.'
      : /contract/i.test(text)
        ? "Run route-workflow to refresh this session's .svc/session-contract.jsonl, then retry."
        : 'Read docs/hook-modes.md and the named check, correct its reported condition, then retry.';
  return `${text} Next step: ${hint}`;
}
