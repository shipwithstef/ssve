#!/usr/bin/env node
// swarm-canonical-json.mjs — RFC 8785 (JCS) serialization for the svc swarm kernel.
//
// Scope notes:
// - Input must be a value produced by JSON.parse (no undefined, no NaN, no BigInt).
// - Object keys sort by UTF-16 code unit order (JS default string comparison).
// - Strings escape per RFC 8785 §3.2.2.2 (short escapes + \u00xx lowercase hex).
// - Numbers use the ECMAScript shortest round-tripping form; integers render
//   without fraction or exponent where lossless; -0 renders as 0.
// - Output is UTF-8 bytes with no trailing newline.

const ESCAPE = {
  '"': '\\"',
  "\\": "\\\\",
  "\b": "\\b",
  "\t": "\\t",
  "\n": "\\n",
  "\f": "\\f",
  "\r": "\\r",
};

function escapeString(value) {
  let out = '"';
  for (const char of value) {
    if (ESCAPE[char] !== undefined) out += ESCAPE[char];
    else if (char < " ") {
      const hex = char.codePointAt(0).toString(16).padStart(4, "0");
      out += `\\u${hex}`;
    } else out += char;
  }
  return `${out}"`;
}

function serializeNumber(value) {
  if (!Number.isFinite(value)) throw new TypeError("JCS cannot serialize non-finite numbers");
  if (Object.is(value, -0)) return "0";
  if (Number.isInteger(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER) return String(value);
  return String(value);
}

export function jcs(value) {
  if (value === null) return "null";
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      return serializeNumber(value);
    case "string":
      return escapeString(value);
    case "object":
      break;
    default:
      throw new TypeError(`JCS cannot serialize ${typeof value}`);
  }
  if (Array.isArray(value)) {
    if (Object.prototype.hasOwnProperty.call(value, "__proto__")) {
      // array with extra own props is not valid JSON.parse output
      throw new TypeError("JCS input has exotic array properties");
    }
    return `[${value.map(jcs).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  const parts = [];
  for (const key of keys) {
    const entry = value[key];
    if (entry === undefined) throw new TypeError("JCS input contains undefined property values");
    parts.push(`${escapeString(key)}:${jcs(entry)}`);
  }
  return `{${parts.join(",")}}`;
}

export function canonicalizeBytes(value, encoder = new TextEncoder()) {
  return encoder.encode(jcs(value));
}

import crypto from "node:crypto";
export function canonicalDigest(value) {
  return `sha256:${crypto.createHash("sha256").update(canonicalizeBytes(value)).digest("hex")}`;
}

// Embedded conformance vectors (RFC 8785 Appendix + svc-specific cases).
export const VECTORS = Object.freeze([
  {
    name: "key-order-permutation-byte-stability",
    a: { b: 2, a: 1 },
    b: { a: 1, b: 2 },
    expect: '{"a":1,"b":2}',
  },
  {
    name: "nested-structure",
    a: { outer: { z: [1, 2, { k: "v" }], a: true }, n: null },
    b: { n: null, outer: { a: true, z: [1, 2, { k: "v" }] } },
    expect: '{"n":null,"outer":{"a":true,"z":[1,2,{"k":"v"}]}}',
  },
  { name: "unicode-escape", a: { ch: "\u00e9\u0001" }, b: { ch: "é\u0001" }, expect: '{"ch":"é\\u0001"}' },
  { name: "negative-zero", a: -0, b: 0, expect: "0" },
  { name: "integer-no-exponent", a: 1234567890123, b: 1.234567890123e12, expect: "1234567890123" },
  { name: "shortest-float", a: 0.1, b: 0.1, expect: "0.1" },
  { name: "empty-containers", a: {}, b: [], expect: null, note: "distinct forms preserved" },
]);

export function runVectors() {
  const failures = [];
  for (const vector of VECTORS) {
    const ja = jcs(vector.a);
    const jb = jcs(vector.b);
    if (vector.expect !== null) {
      if (ja !== vector.expect || jb !== vector.expect) {
        failures.push(`${vector.name}: got ${ja} / ${jb}, want ${vector.expect}`);
      }
    } else if (ja === jb && !vector.note) {
      failures.push(`${vector.name}: distinct forms collapsed`);
    }
  }
  return { ok: failures.length === 0, failures };
}
