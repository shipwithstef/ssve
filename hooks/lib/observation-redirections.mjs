import fs from 'node:fs';
import path from 'node:path';
import { canonicalTarget } from './operation-scope.mjs';
import { lexSimpleCommand } from '../codex/lib/argv-lex.mjs';
import { lexObservationArgv } from './observation-argv.mjs';

const within = (target, root) => target !== root && target.startsWith(root + path.sep);
function scratchTarget(value, cwd, env, effects) {
  if (value === '/dev/null') return true;
  if (!path.isAbsolute(value)) return false; // cd/pipeline context must never reinterpret a relative write.
  try {
    const target = canonicalTarget(value, cwd).canonical;
    const roots = ['/tmp', effects && env.TMPDIR, env.SVC_SESSION_SCRATCHPAD, path.join(env.HOME || '', '.local/state/orch')].filter(Boolean);
    const allowed = roots.map(root => {
      const canonical = canonicalTarget(root, cwd).canonical;
      return within(target, canonical) ? canonical : null;
    }).filter(Boolean).sort((a, b) => b.length - a.length)[0];
    if (!allowed || target.split(path.sep).includes('.git')) return false;
    // Explicit scratch roots override an enclosing HOME/dotfiles repository.
    // Repositories inside that root (and symlinks into them) remain governed.
    let cursor = path.dirname(target);
    while (cursor !== path.dirname(cursor)) {
      if (fs.existsSync(path.join(cursor, '.git'))) return false;
      if (cursor === allowed) break;
      cursor = path.dirname(cursor);
    }
    return true;
  } catch { return false; }
}
export function stripObservationRedirections(segment, cwd = process.cwd(), env = process.env, effects = false) {
  let value = segment;
  const suffix = /(?:^|\s)(?:[012]?>>?|&>)\s*("[^"\n]*"|'[^'\n]*'|[^\s<>;&|]+)\s*$/;
  for (;;) {
    const dup = value.match(/(?:^|\s)[012]?>&[012]\s*$/);
    if (dup) { value = value.slice(0, dup.index).trim(); continue; }
    const match = value.match(suffix);
    if (!match) return value;
    const raw = match[1];
    if (effects) {
      const parsed = lexObservationArgv(raw, env);
      if (!parsed || parsed.argv.length !== 1 || parsed.globs[0] !== null || !scratchTarget(parsed.argv[0], cwd, env, true)) return value;
      value = value.slice(0, match.index).trim(); continue;
    }
    const parsed = lexSimpleCommand(raw.startsWith('~/') ? JSON.stringify(raw) : raw);
    if (!parsed.ok || parsed.argv.length !== 1 || !scratchTarget(raw.startsWith('~/') ? path.join(env.HOME || '', parsed.argv[0].slice(2)) : parsed.argv[0], cwd, env)) return value;
    value = value.slice(0, match.index).trim();
  }
}
