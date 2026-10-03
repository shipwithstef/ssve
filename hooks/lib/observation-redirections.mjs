import fs from 'node:fs';
import path from 'node:path';
import { canonicalTarget } from './operation-scope.mjs';
import { lexSimpleCommand } from '../codex/lib/argv-lex.mjs';

const within = (target, root) => target !== root && target.startsWith(root + path.sep);
function scratchTarget(value, cwd, env) {
  if (value === '/dev/null') return true;
  if (!path.isAbsolute(value)) return false; // cd/pipeline context must never reinterpret a relative write.
  try {
    const target = canonicalTarget(value, cwd).canonical;
    const roots = ['/tmp', env.SVC_SESSION_SCRATCHPAD, path.join(env.HOME || '', '.local/state/orch')].filter(Boolean);
    const allowed = roots.some(root => {
      const canonical = canonicalTarget(root, cwd).canonical;
      return within(target, canonical);
    });
    if (!allowed) return false;
    // A repository hosted under /tmp is still governed, as is a symlink into it.
    let cursor = path.dirname(target);
    while (cursor !== path.dirname(cursor)) {
      if (fs.existsSync(path.join(cursor, '.git')) && cursor !== '/tmp') return false;
      cursor = path.dirname(cursor);
    }
    return true;
  } catch { return false; }
}
export function stripObservationRedirections(segment, cwd = process.cwd(), env = process.env) {
  let value = segment;
  const suffix = /(?:^|\s)(?:[012]?>>?|&>)\s*("[^"\n]*"|'[^'\n]*'|[^\s<>;&|]+)\s*$/;
  for (;;) {
    const dup = value.match(/(?:^|\s)[012]?>&[012]\s*$/);
    if (dup) { value = value.slice(0, dup.index).trim(); continue; }
    const match = value.match(suffix);
    if (!match) return value;
    const raw = match[1];
    const parsed = lexSimpleCommand(raw.startsWith('~/') ? JSON.stringify(raw) : raw);
    if (!parsed.ok || parsed.argv.length !== 1 || !scratchTarget(raw.startsWith('~/') ? path.join(env.HOME || '', parsed.argv[0].slice(2)) : parsed.argv[0], cwd, env)) return value;
    value = value.slice(0, match.index).trim();
  }
}
