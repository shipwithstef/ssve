#!/usr/bin/env node
// Destructive migration uses one exact installed-package predicate on every host.
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const { isKnownManagedCommand } = await import(new URL(`file://${path.join(ROOT, "hooks/lib/svc-ownership.mjs")}`));
const { wrapHookCommand } = await import(new URL(`file://${path.join(ROOT, "scripts/lib/hook-command.mjs")}`));

// Also verify each wirer actually imports the shared lib (no drift back).
import fs from "node:fs";
let fail = 0;
const ok = (m) => { console.log(`  ✓ ${m}`); pass++; };
const problem = (m) => { console.error(`  ✗ ${m}`); fail++; };
let pass = 0;

const encoded = Buffer.from(JSON.stringify({ command: `node ${ROOT}/hooks/svc-workflow-guard.mjs`, host: "claude", event: "PreToolUse", timeoutMs: 20000 })).toString("base64url");
const FIXTURES = [
  [`node ${ROOT}/hooks/svc-workflow-guard.mjs`, true],
  [`node ${ROOT}/hooks/cos-briefing.mjs`, true],
  [`node ${ROOT}/hooks/svc-workflow-guard.js \"$TOOL_INPUT\"`, true],
  [`bash ${ROOT}/hooks/svc-custom.sh`, false],
  [`echo ${ROOT}/hooks/svc-workflow-guard.mjs`, false],
  [`node /opt/foreign/hooks/svc-workflow-guard.mjs`, false],
  [`echo --spec ${encoded}`, false],
  [`echo ${ROOT}/hooks/svc-hook-boundary.mjs svc-hook --spec ${encoded}`, false],
  [wrapHookCommand(`node ${ROOT}/hooks/svc-workflow-guard.mjs`, { skillsPath: ROOT, host: "claude", event: "PreToolUse" }), true],
  ["eslint --fix .", false],
];

for (const [cmd, expected] of FIXTURES) {
  const got = isKnownManagedCommand(cmd, ROOT);
  if (got !== expected) { problem(`fixture verdict mismatch: ${JSON.stringify(cmd)} expected ${expected} got ${got}`); continue; }
}
ok(`${FIXTURES.length} exact installed-root fixtures agree`);

for (const wirer of ["scripts/wire-hooks.mjs", "scripts/wire-cursor-hooks.mjs", "scripts/wire-grok-hooks.mjs", "scripts/wire-kimi-hooks.mjs", "scripts/wire-gemini-hooks.mjs"]) {
  const src = fs.readFileSync(path.join(ROOT, wirer), "utf8");
  if (!src.includes("hooks/lib/svc-ownership.mjs") || !src.includes("isKnownManagedCommand(")) problem(`${wirer} does not use the exact shared ownership predicate`);
}
ok("all destructive wirers use hooks/lib/svc-ownership.mjs");

console.log(`validate-ownership-predicate-parity: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
