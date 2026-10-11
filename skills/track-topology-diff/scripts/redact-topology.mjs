#!/usr/bin/env node
// Redacts credentials from infra snapshots (kubectl/helm/terraform JSON) before anything is
// written to docs/specs/topology-snapshots/. Fails closed: non-JSON input is refused.
//   kubectl get ... -o json | node redact-topology.mjs > state.json
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

export const REDACTED = '[REDACTED]';

const LAST_APPLIED = 'kubectl.kubernetes.io/last-applied-configuration';
// Credential-looking key names. References (secretName, secretKeyRef, tokenSecretRef) are not values.
const SENSITIVE_KEY = /(pass(word|wd)?|secret|token|api[-_]?key|private[-_]?key|access[-_]?key|credential|client[-_]?secret|auth(orization)?|bearer|cert(ificate)?[-_]?key|connection[-_]?string)/i;
const REFERENCE_KEY = /(name|ref|keyref|path|file|type|arn|id|policy|mount)$/i;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function isSensitiveKey(key) {
  return SENSITIVE_KEY.test(key) && !REFERENCE_KEY.test(key);
}

function redactAll(v) {
  if (isObj(v)) return Object.fromEntries(Object.keys(v).map((k) => [k, redactAll(v[k])]));
  if (Array.isArray(v)) return v.map(redactAll);
  return REDACTED;
}

function applySensitiveMap(values, map) {
  if (map === true) return redactAll(values);
  if (!isObj(map) || !isObj(values)) {
    if (Array.isArray(map) && Array.isArray(values)) return values.map((v, i) => applySensitiveMap(v, map[i]));
    return values;
  }
  const out = {...values};
  for (const k of Object.keys(map)) if (k in out) out[k] = applySensitiveMap(out[k], map[k]);
  return out;
}

export function redactSnapshot(node, parentKey = '') {
  if (Array.isArray(node)) return node.map((v) => redactSnapshot(v, parentKey));
  if (!isObj(node)) return node;

  const out = {};
  const isSecret = node.kind === 'Secret';
  for (const [k, v] of Object.entries(node)) {
    if (isSecret && (k === 'data' || k === 'stringData')) out[k] = redactAll(v);
    else if (k === 'metadata' && isSecret && isObj(v)) {
      const m = redactSnapshot(v, k);
      if (isObj(m.annotations) && LAST_APPLIED in m.annotations) m.annotations[LAST_APPLIED] = REDACTED;
      out[k] = m;
    } else if (typeof v === 'string' && isSensitiveKey(k) && v !== '') out[k] = REDACTED;
    else out[k] = redactSnapshot(v, k);
  }
  // Container env entries: {name: DB_PASSWORD, value: "literal"}
  if (typeof node.name === 'string' && typeof node.value === 'string' && isSensitiveKey(node.name)) out.value = REDACTED;
  // Terraform JSON: sensitive_values mirrors `values` with true leaves.
  if (isObj(node.sensitive_values) && node.values !== undefined) out.values = applySensitiveMap(out.values, node.sensitive_values);
  return out;
}

function flatten(v, prefix = '', acc = {}) {
  if (isObj(v)) for (const k of Object.keys(v)) flatten(v[k], prefix ? `${prefix}.${k}` : k, acc);
  else if (Array.isArray(v)) v.forEach((x, i) => flatten(x, `${prefix}[${i}]`, acc));
  else acc[prefix] = v;
  return acc;
}

// Structural diff of two snapshots. Both sides are redacted first, so no secret value can be written.
// Secret values are all REDACTED, so a rotation shows only as key additions/removals.
export function diffSnapshots(before, after, {from = 'before', to = 'after'} = {}) {
  const a = flatten(redactSnapshot(before));
  const b = flatten(redactSnapshot(after));
  const added = Object.keys(b).filter((k) => !(k in a));
  const removed = Object.keys(a).filter((k) => !(k in b));
  const mutated = Object.keys(b).filter((k) => k in a && JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  const list = (xs, f) => (xs.length ? xs.map(f).join('\n') : '(none)');
  return [
    `# Topology Diff — ${from} → ${to}`,
    '', '## Added', list(added, (k) => `- ${k}`),
    '', '## Removed', list(removed, (k) => `- ${k}`),
    '', '## Mutated (in-place)', list(mutated, (k) => `- ${k}: ${JSON.stringify(a[k])} → ${JSON.stringify(b[k])}`),
    '',
  ].join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let input;
  try { input = JSON.parse(readFileSync(0, 'utf8')); } catch {
    process.stderr.write('redact-topology: input is not valid JSON; refusing to pass it through. Use -o json / -json output.\n');
    process.exit(1);
  }
  process.stdout.write(`${JSON.stringify(redactSnapshot(input), null, 2)}\n`);
}
