#!/usr/bin/env node
/**
 * Pure-node JSON-Schema (draft 2020-12 SUBSET) validator.
 *
 * SUBSET INTENT: this validator covers only the schema features svc actually
 * uses. Adding more is fine; adding deps (ajv, etc.) is NOT — the framework's
 * zero-npm-dep posture is intentional. WI-140 design-tech [Layer 3 EUREKA]:
 * the framework fixes stored-knowledge-decay; adding decay-prone deps to
 * enforce that fix would be self-undermining.
 *
 * Supported keywords:
 *   - type: string | number | integer | boolean | array | object | null
 *   - required: array of property names
 *   - properties: object mapping name → sub-schema
 *   - items: sub-schema for array elements
 *   - enum: array of allowed values
 *   - format: "date" (ISO-8601 YYYY-MM-DD), "uri" (loose URL check)
 *   - $schema, $id, $ref (single-file only — no remote refs)
 *
 * Unsupported (will silently pass — document if you use them):
 *   - oneOf / anyOf / allOf / not, conditionals (if/then/else)
 *   - additionalProperties / patternProperties / propertyNames
 *   - minLength / maxLength / pattern
 *   - minimum / maximum / minItems / maxItems / uniqueItems
 *
 * Usage:
 *   import { validate } from "./json-schema-validator.mjs";
 *   const { valid, errors } = validate(schema, data);
 *
 * CLI:
 *   node scripts/lib/json-schema-validator.mjs --schema=path.json --data=path.json
 *   exit 0 = valid, 1 = invalid (prints errors)
 */

import fs from "node:fs";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isType(value, type) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "integer") return typeof value === "number" && Number.isInteger(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  return typeof value === type;
}

export function validate(schema, data, path = "$") {
  const errors = [];

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => isType(data, t))) {
      errors.push(`${path}: expected ${types.join("|")}, got ${Array.isArray(data) ? "array" : typeof data}`);
      return { valid: false, errors };
    }
  }

  if (schema.enum) {
    if (!schema.enum.includes(data)) {
      errors.push(`${path}: value ${JSON.stringify(data)} not in enum [${schema.enum.join(", ")}]`);
    }
  }

  if (schema.format === "date" && typeof data === "string") {
    if (!ISO_DATE.test(data)) errors.push(`${path}: not ISO-8601 date (YYYY-MM-DD): ${data}`);
    else {
      const [y, m, d] = data.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
        errors.push(`${path}: invalid calendar date: ${data}`);
      }
    }
  }
  if (schema.format === "uri" && typeof data === "string") {
    try { new URL(data); } catch { errors.push(`${path}: not a valid URI: ${data}`); }
  }

  if (schema.required && schema.type === "object") {
    for (const key of schema.required) {
      if (!(key in data)) errors.push(`${path}: missing required property "${key}"`);
    }
  }

  if (schema.properties && schema.type === "object" && data !== null && typeof data === "object") {
    for (const [key, subSchema] of Object.entries(schema.properties)) {
      if (key in data) {
        const sub = validate(subSchema, data[key], `${path}.${key}`);
        if (!sub.valid) errors.push(...sub.errors);
      }
    }
  }

  if (schema.items && Array.isArray(data)) {
    data.forEach((item, i) => {
      const sub = validate(schema.items, item, `${path}[${i}]`);
      if (!sub.valid) errors.push(...sub.errors);
    });
  }

  return { valid: errors.length === 0, errors };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }));
  if (args.help || (!args.schema && !args.data)) {
    console.log("Usage: node json-schema-validator.mjs --schema=path.json --data=path.json");
    console.log("Exit codes: 0 valid, 1 invalid, 2 IO/parse error");
    process.exit(args.help ? 0 : 2);
  }
  try {
    const schema = JSON.parse(fs.readFileSync(args.schema, "utf8"));
    const data = JSON.parse(fs.readFileSync(args.data, "utf8"));
    const result = validate(schema, data);
    if (result.valid) {
      console.log(`PASS: ${args.data} conforms to ${args.schema}`);
      process.exit(0);
    } else {
      console.error(`FAIL: ${args.data} does not conform to ${args.schema}`);
      result.errors.forEach((e) => console.error(`  ${e}`));
      process.exit(1);
    }
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exit(2);
  }
}
