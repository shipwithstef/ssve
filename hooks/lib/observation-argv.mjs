// Effects-only advisory lexer. Never execute a shell or expand filesystem globs.
// The strict argv lexer remains the enforcement/normalization boundary.
export function lexObservationArgv(input, env = process.env) {
  const src = String(input ?? '');
  if (!src.trim() || src.length > 65536 || /[\x00-\x1f\x7f]/.test(src)) return null;
  const argv = [], globs = [];
  let word = '', started = false, quote = '', glob = false, globPrefix = '';
  const push = () => { if (started) { argv.push(word); globs.push(glob ? globPrefix : null); } word = ''; started = false; glob = false; globPrefix = ''; };
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quote === "'") { if (c === "'") quote = ''; else word += c; continue; }
    if (c === '\\') {
      const next = src[++i]; if (next === undefined) return null;
      if (quote === '"' && !['$', '`', '"', '\\'].includes(next)) word += '\\';
      word += next; started = true; continue;
    }
    if (c === "'" && !quote) { quote = "'"; started = true; continue; }
    if (c === '"') { quote = quote ? '' : '"'; started = true; continue; }
    if (!quote && /\s/.test(c)) { push(); continue; }
    if (c === '$') {
      const m = src.slice(i).match(/^\$(?:\{(HOME|TMPDIR)\}|(HOME|TMPDIR))(?=\/|$|["\s])/);
      if (!m || !env[m[1] || m[2]]) return null;
      if (!quote && /[\s*?\[\]{}]/.test(env[m[1] || m[2]])) return null;
      word += env[m[1] || m[2]]; started = true; i += m[0].length - 1; continue;
    }
    if (c === '`' || (!quote && /[;&|<>()!#]/.test(c))) return null;
    if (!quote && c === '~') {
      if (started || src[i + 1] !== '/' || !env.HOME) return null;
      word += env.HOME; started = true; continue;
    }
    if (!quote && /[{}]/.test(c)) {
      if (c === '{' && src[i + 1] === '}') { word += '{}'; started = true; i++; continue; }
      return null; // Brace expansion and functions stay uncertain.
    }
    if (!quote && /[*?\[\]]/.test(c)) { if (!glob) globPrefix = word; glob = true; }
    word += c; started = true;
  }
  if (quote) return null;
  push();
  return argv.length ? { argv, globs } : null;
}
