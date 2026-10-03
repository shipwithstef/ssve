// Non-executing grammar for native Codex code-mode envelopes. Only literal
// exec_command inputs and pure output renderers are trusted. Never evaluate JS
// or extract tool calls by regex: the entire envelope must parse successfully.
export function unwrapObservationEnvelope(payload) {
  const name = payload?.tool_name || payload?.toolName || '';
  if (!['functions.exec', 'exec'].includes(name)) return null;
  const input = payload.tool_input ?? payload.toolInput ?? payload.arguments ?? payload.args;
  const source = typeof input === 'string' ? input : input?.code ?? input?.source;
  if (typeof source !== 'string' || source.length > 65536) return [];
  let at = 0, depth = 0, tokenEnd = 0;
  const calls = [], bindings = new Set(), numericBindings = new Set();
  const reserved = new Set(['tools', 'text', 'Promise', 'JSON', 'String', 'undefined']);
  const fields = new Set(['output', 'stdout', 'stderr', 'exit_code', 'session_id', 'status', 'value', 'reason', 'length', 'wall_time_seconds', 'content']);
  const ws = () => {
    for (;;) {
      while (/\s/.test(source[at] || '') && at < source.length) at++;
      if (source.startsWith('//', at)) {
        const end = source.slice(at).search(/[\r\n\u2028\u2029]/);
        at = end < 0 ? source.length : at + end + 1;
      }
      else if (source.startsWith('/*', at)) { const end = source.indexOf('*/', at + 2); if (end < 0) throw Error('comment'); at = end + 2; }
      else break;
    }
  };
  const take = s => { ws(); if (!source.startsWith(s, at)) throw Error('grammar'); at += s.length; tokenEnd = at; };
  const word = () => { ws(); const m = source.slice(at).match(/^[A-Za-z_$][\w$]*/); if (!m) throw Error('identifier'); at += m[0].length; tokenEnd = at; return m[0]; };
  const bind = id => { if (bindings.has(id) || reserved.has(id)) throw Error('binding'); bindings.add(id); };
  function literal() {
    ws(); const c = source[at];
    if (c === '"' || c === "'") {
      at++; let out = '';
      while (at < source.length) {
        const ch = source[at++];
        if (ch === c) { tokenEnd = at; return out; }
        if (ch === '\\') {
          const esc = source[at++];
          const map = { n: '\n', r: '\r', t: '\t', '\\': '\\', "'": "'", '"': '"' };
          if (!(esc in map)) throw Error('escape'); out += map[esc];
        } else { if (ch === '\n' || ch === '\r') throw Error('string'); out += ch; }
      }
      throw Error('string');
    }
    if (c === '{') {
      take('{'); const obj = Object.create(null); ws();
      while (source[at] !== '}') {
        // Native JSON serialization includes whitespace after commas and before
        // quoted keys. Decide the key kind AFTER consuming that whitespace.
        ws(); if (source[at] === '}') break;
        const key = /["']/.test(source[at]) ? literal() : word();
        if (Object.hasOwn(obj, key) || ['__proto__', 'constructor', 'prototype'].includes(key)) throw Error('key');
        take(':'); obj[key] = literal(); ws();
        if (source[at] !== ',') break; take(',');
      }
      take('}'); return obj;
    }
    const m = source.slice(at).match(/^(?:true|false|null|-?\d+(?:\.\d+)?)(?![\w$])/);
    if (!m) throw Error('literal'); at += m[0].length; tokenEnd = at; return JSON.parse(m[0]);
  }
  function expression(pure = false) {
    if (++depth > 32) throw Error('depth');
    ws();
    if (!pure && /^await\b/.test(source.slice(at))) { take('await'); ws(); }
    if (!pure && source.startsWith('tools.exec_command', at)) {
      take('tools.exec_command'); take('('); const args = literal(); take(')');
      if (!args || typeof args !== 'object' || typeof args.cmd !== 'string') throw Error('args');
      calls.push({ ...payload, tool_name: 'exec_command', tool_input: args });
    } else if (!pure && source.startsWith('Promise.all', at)) {
      take(source.startsWith('Promise.allSettled', at) ? 'Promise.allSettled' : 'Promise.all'); take('('); take('[');
      ws(); while (source[at] !== ']') { expression(); ws(); if (source[at] !== ',') break; take(','); }
      take(']'); take(')');
    } else if (source.startsWith('text', at) && /^text\s*\(/.test(source.slice(at))) {
      take('text'); take('('); expression(pure); take(')');
    } else if (/^(?:JSON\.stringify|String)\s*\(/.test(source.slice(at))) {
      take(source.startsWith('JSON.', at) ? 'JSON.stringify' : 'String'); take('('); expression(true); take(')');
    } else if (source[at] === '`') {
      take('`');
      while (at < source.length && source[at] !== '`') {
        if (source.startsWith('${', at)) { take('${'); expression(true); take('}'); }
        else if (source[at] === '\\') { at += 2; }
        else at++;
      }
      take('`');
    } else if (source[at] === '(') { take('('); expression(pure); take(')'); }
    else if (source[at] === '{') {
      take('{'); ws();
      while (source[at] !== '}') {
        if (source.startsWith('...', at)) { take('...'); expression(true); }
        else {
          const key = /["']/.test(source[at]) ? literal() : word();
          if (['__proto__', 'constructor', 'prototype'].includes(key)) throw Error('key');
          ws(); if (source[at] === ':') { take(':'); expression(true); }
          else if (!bindings.has(key)) throw Error('shorthand');
        }
        ws(); if (source[at] !== ',') break; take(','); ws();
      }
      take('}');
    } else if (source[at] === '[') {
      take('['); ws(); while (source[at] !== ']') { expression(true); ws(); if (source[at] !== ',') break; take(','); ws(); } take(']');
    } else if (/["'\d-]/.test(source[at] || '') || /^(?:true|false|null)\b/.test(source.slice(at))) literal();
    else if (!bindings.has(word())) throw Error('unbound');
    ws();
    while (source[at] === '.' || source[at] === '[' || source.startsWith('?.', at)) {
      if (source[at] === '[') {
        take('['); ws();
        if (/^[A-Za-z_$]/.test(source[at] || '')) {
          if (!numericBindings.has(word())) throw Error('index');
        } else {
          const index = literal();
          if (!Number.isInteger(index) && !(typeof index === 'string' && fields.has(index))) throw Error('index');
        }
        take(']');
      }
      else {
        take(source.startsWith('?.', at) ? '?.' : '.'); const field = word();
        if (field === 'slice') { take('('); const n = literal(); if (!Number.isInteger(n)) throw Error('slice'); ws();
          if (source[at] === ',') { take(','); if (!Number.isInteger(literal())) throw Error('slice'); } take(')'); }
        else if (!fields.has(field)) throw Error('field');
      }
      ws();
    }
    // Output labels in real transcripts use a numeric index plus a literal.
    // General arithmetic, overloaded method calls and dynamic code stay out.
    if (source[at] === '+' && source[at + 1] !== '+') { take('+'); if (typeof literal() !== 'number') throw Error('number'); }
    ws(); if (source.startsWith('??', at)) { take('??'); expression(true); }
    if (source.startsWith('===', at) || source.startsWith('!==', at)) { take(source.startsWith('===', at) ? '===' : '!=='); expression(true); }
    ws(); if (source[at] === '?') { take('?'); expression(true); take(':'); expression(true); }
    depth--;
  }
  function renderer() {
    ws(); const rest = source.slice(at);
    // Fixed bounded loops; every body is exactly one pure text call. No tool
    // calls, assignments, computed callbacks or shadowed runtime globals.
    const indexed = rest.match(/^for\s*\(\s*let\s+([\w$]+)\s*=\s*0\s*;\s*\1\s*<\s*([\w$]+)\.length\s*;\s*\1\+\+\s*\)/);
    const each = rest.match(/^for\s*\(\s*const\s+([\w$]+)\s+of\s+([\w$]+)\s*\)/);
    const callback = rest.match(/^([\w$]+)\.forEach\s*\(\s*(?:\(\s*([\w$]+)\s*(?:,\s*([\w$]+)\s*)?\)|([\w$]+))\s*=>/);
    const direct = rest.match(/^([\w$]+)\.forEach\s*\(\s*text\s*\)/);
    const match = indexed || each || callback || direct;
    if (!match) return false;
    const collection = indexed || each ? match[2] : match[1];
    if (!bindings.has(collection)) throw Error('collection');
    at += match[0].length; tokenEnd = at;
    if (direct) return true;
    const locals = indexed || each ? [match[1]] : [match[2] || match[4], match[3]].filter(Boolean);
    for (const id of locals) bind(id);
    const numeric = indexed ? match[1] : callback ? match[3] : null;
    if (numeric) numericBindings.add(numeric);
    ws(); const braces = source[at] === '{'; if (braces) take('{');
    if (!/^text\s*\(/.test(source.slice(at))) throw Error('renderer');
    expression(true); ws(); if (source[at] === ';') take(';');
    if (braces) take('}'); if (callback) take(')');
    for (const id of locals) bindings.delete(id);
    if (numeric) numericBindings.delete(numeric);
    return true;
  }
  try {
    while (at < source.length) {
      ws(); if (at === source.length) break;
      if (/^(?:const|let)\s/.test(source.slice(at))) {
        word(); const id = word(); if (bindings.has(id) || reserved.has(id)) throw Error('binding');
        take('='); expression(); bind(id);
      } else if (!renderer()) expression();
      ws();
      if (source[at] === ';') take(';');
      else if (at < source.length && source[tokenEnd - 1] !== ';') {
        // A newline before '(' or a template does NOT terminate a JS call.
        // Reject call/tag continuations and require a real statement boundary.
        if (source[at] === '(' || source[at] === '`' || !/[\r\n\u2028\u2029]/.test(source.slice(tokenEnd, at))) throw Error('statement');
      }
    }
    return calls.length ? calls : [];
  } catch { return []; }
}
