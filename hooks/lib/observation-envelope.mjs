// A deliberately small, non-executing grammar for Codex code-mode wrappers.
// Literal exec_command calls, optional bindings, text output and Promise batches
// only. Unknown JavaScript stays governed; no eval, regex extraction of calls,
// computed inputs, member invocation or template interpolation is trusted.
export function unwrapObservationEnvelope(payload) {
  const name = payload?.tool_name || payload?.toolName || '';
  if (!['functions.exec', 'exec'].includes(name)) return null;
  const input = payload.tool_input ?? payload.toolInput ?? payload.arguments;
  let source = typeof input === 'string' ? input : input?.code ?? input?.source;
  if (typeof source !== 'string' || source.length > 65536) return [];
  source = source.replace(/^\/\/ @exec:[^\n]*\n/, '');
  let at = 0;
  const calls = [], bindings = new Set();
  const ws = () => { while (/\s/.test(source[at] || '') && at < source.length) at++; };
  const take = (s) => { ws(); if (!source.startsWith(s, at)) throw Error('grammar'); at += s.length; };
  const word = () => { ws(); const m = source.slice(at).match(/^[A-Za-z_$][\w$]*/); if (!m) throw Error('identifier'); at += m[0].length; return m[0]; };
  function literal() {
    ws(); const c = source[at];
    if (c === '"' || c === "'") {
      at++; let out = '';
      while (at < source.length) {
        const ch = source[at++];
        if (ch === c) return out;
        if (ch === '\\') {
          const esc = source[at++];
          const map = { n: '\n', r: '\r', t: '\t', '\\': '\\', "'": "'", '"': '"' };
          if (!(esc in map)) throw Error('escape'); out += map[esc];
        } else out += ch;
      }
      throw Error('string');
    }
    if (c === '{') {
      take('{'); const obj = Object.create(null); ws();
      while (source[at] !== '}') {
        const key = /["']/.test(source[at]) ? literal() : word();
        if (Object.hasOwn(obj, key) || ['__proto__', 'constructor', 'prototype'].includes(key)) throw Error('key');
        take(':'); obj[key] = literal(); ws();
        if (source[at] !== ',') break; take(',');
      }
      take('}'); return obj;
    }
    const m = source.slice(at).match(/^(?:true|false|null|-?\d+(?:\.\d+)?)(?![\w$])/);
    if (!m) throw Error('literal'); at += m[0].length; return JSON.parse(m[0]);
  }
  function expression() {
    ws(); if (source.startsWith('await ', at)) { take('await'); ws(); }
    if (source.startsWith('tools.exec_command', at)) {
      take('tools.exec_command'); take('('); const args = literal(); take(')');
      if (!args || typeof args !== 'object' || typeof args.cmd !== 'string') throw Error('args');
      calls.push({ ...payload, tool_name: 'exec_command', tool_input: args }); return;
    }
    if (source.startsWith('Promise.all', at)) {
      take(source.startsWith('Promise.allSettled', at) ? 'Promise.allSettled' : 'Promise.all'); take('('); take('[');
      ws(); while (source[at] !== ']') { expression(); ws(); if (source[at] !== ',') break; take(','); }
      take(']'); take(')'); return;
    }
    if (source.startsWith('text(', at)) { take('text'); take('('); expression(); take(')'); return; }
    if (!bindings.has(word())) throw Error('unbound');
  }
  try {
    while (at < source.length) {
      ws(); if (at === source.length) break;
      if (/^(?:const|let)\s/.test(source.slice(at))) {
        word(); const binding = word(); if (bindings.has(binding)) throw Error('rebind');
        take('='); expression(); bindings.add(binding);
      } else {
        // Output-only renderer used by the native batched envelope. Its entire
        // callback is matched, so a second tool call cannot hide inside it.
        const render = source.slice(at).match(/^([A-Za-z_$][\w$]*)\.forEach\(\(([A-Za-z_$][\w$]*),\s*([A-Za-z_$][\w$]*)\)=>text\(\{\3,\.\.\.\2\}\)\)/);
        if (render && bindings.has(render[1])) at += render[0].length;
        else expression();
      }
      ws(); if (at < source.length) take(';');
    }
    return calls.length ? calls : [];
  } catch { return []; }
}
