#!/usr/bin/env node
// Unit tests for scripts/lib/json-schema-validator.mjs
// Pure node, zero deps, run with: node test/json-schema-validator.test.mjs
// Exit 0 = all pass, 1 = any fail.

import { validate } from "../scripts/lib/json-schema-validator.mjs";

let pass = 0, fail = 0;
function ok(name, condition) {
  if (condition) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}`); }
}

console.log("== type checks ==");
ok("string PASS", validate({ type: "string" }, "x").valid);
ok("string FAIL on number", !validate({ type: "string" }, 1).valid);
ok("integer PASS", validate({ type: "integer" }, 1).valid);
ok("integer FAIL on float", !validate({ type: "integer" }, 1.5).valid);
ok("array PASS", validate({ type: "array" }, [1, 2]).valid);
ok("object PASS", validate({ type: "object" }, {}).valid);
ok("object FAIL on array", !validate({ type: "object" }, [1]).valid);
ok("null PASS", validate({ type: "null" }, null).valid);
ok("union type PASS", validate({ type: ["string", "null"] }, null).valid);

console.log("== enum ==");
ok("enum PASS", validate({ enum: ["a", "b"] }, "a").valid);
ok("enum FAIL", !validate({ enum: ["a", "b"] }, "c").valid);

console.log("== required ==");
ok("required PASS", validate({ type: "object", required: ["x"] }, { x: 1 }).valid);
ok("required FAIL", !validate({ type: "object", required: ["x"] }, {}).valid);

console.log("== properties (recursive) ==");
const schema = {
  type: "object",
  required: ["a"],
  properties: {
    a: { type: "string" },
    b: { type: "integer" },
  },
};
ok("nested PASS", validate(schema, { a: "hi", b: 1 }).valid);
ok("nested FAIL on wrong type", !validate(schema, { a: 1 }).valid);
ok("nested FAIL missing required", !validate(schema, { b: 1 }).valid);

console.log("== items (array element schema) ==");
const arrSchema = { type: "array", items: { type: "string" } };
ok("items PASS", validate(arrSchema, ["x", "y"]).valid);
ok("items FAIL", !validate(arrSchema, ["x", 1]).valid);

console.log("== format: date ==");
ok("date PASS", validate({ type: "string", format: "date" }, "2026-05-02").valid);
ok("date FAIL bad format", !validate({ type: "string", format: "date" }, "2026/05/02").valid);
ok("date FAIL invalid calendar", !validate({ type: "string", format: "date" }, "2026-13-01").valid);
ok("date FAIL feb 30", !validate({ type: "string", format: "date" }, "2026-02-30").valid);

console.log("== format: uri ==");
ok("uri PASS", validate({ type: "string", format: "uri" }, "https://example.com").valid);
ok("uri FAIL", !validate({ type: "string", format: "uri" }, "not a url").valid);

console.log("== full competitor-analysis schema shape ==");
const compSchema = {
  type: "object",
  required: ["generated", "landscape_state", "category", "competitors"],
  properties: {
    generated: { type: "string", format: "date" },
    landscape_state: { type: "string", enum: ["populated", "nascent", "none-found", "inapplicable"] },
    category: { type: "string" },
    competitors: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "tier", "last_verified"],
        properties: {
          name: { type: "string" },
          tier: { type: "string", enum: ["direct", "adjacent", "emerging", "macro"] },
          last_verified: { type: "string", format: "date" },
        },
      },
    },
  },
};
ok("competitor-analysis PASS", validate(compSchema, {
  generated: "2026-05-02",
  landscape_state: "populated",
  category: "loyalty",
  competitors: [{ name: "Toast", tier: "direct", last_verified: "2026-05-02" }],
}).valid);
ok("competitor-analysis FAIL bad enum", !validate(compSchema, {
  generated: "2026-05-02",
  landscape_state: "unknown-state",
  category: "loyalty",
  competitors: [],
}).valid);
ok("competitor-analysis FAIL missing required nested", !validate(compSchema, {
  generated: "2026-05-02",
  landscape_state: "populated",
  category: "loyalty",
  competitors: [{ name: "Toast" }],  // missing tier + last_verified
}).valid);

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
