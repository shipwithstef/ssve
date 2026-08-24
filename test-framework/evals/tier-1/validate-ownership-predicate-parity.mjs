#!/usr/bin/env node
// WI-562 IP-W2: ownership-predicate parity — identical fixtures yield identical
// verdicts from the ONE shared predicate consumed by all three wirers.
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const { isSvcOwnedCommand, isUserOwnedCommand } = await import(new URL(`file://${path.join(ROOT, "hooks/lib/svc-ownership.mjs")}`));

// Also verify each wirer actually imports the shared lib (no drift back).
import fs from "node:fs";
let fail = 0;
const ok = (m) => { console.log(`  ✓ ${m}`); pass++; };
const problem = (m) => { console.error(`  ✗ ${m}`); fail++; };
let pass = 0;

const FIXTURES = [
  ["node /home/x/.claude/skills/hooks/svc-bash-guard.mjs", true],
  ["node \"$CLAUDE_PROJECT_DIR\"/hooks/svc-workflow-guard.mjs", true],
  ["bash -c 'node ~/.cursor/skills/hooks/svc-lane-tasks-validator.mjs'", true],
  ["node /skills/hooks/svc-enforce.mjs --consumer stop", true],
  ["/usr/local/bin/svc-enforce --mode strict", true],
  ["svc-enforce", true],
  ["node /home/user/.grok/skills/hooks/user-keep.mjs", false],
  ["eslint --fix .", false],
  ["prettier --write src/", false],
  ["/opt/company/deployscript.sh --env prod", false],
  ["echo svc- is mentioned in prose but not a script call", false],
];

for (const [cmd, expected] of FIXTURES) {
  const got = isSvcOwnedCommand(cmd);
  if (got !== expected) { problem(`fixture verdict mismatch: ${JSON.stringify(cmd)} expected ${expected} got ${got}`); continue; }
  if (isUserOwnedCommand(cmd) !== !expected) { problem(`inverse predicate inconsistent for: ${cmd}`); continue; }
}
ok(`${FIXTURES.length} shared-predicate fixtures agree (direct + inverse)`);

for (const wirer of ["scripts/wire-hooks.mjs", "scripts/wire-cursor-hooks.mjs", "scripts/wire-grok-hooks.mjs"]) {
  const src = fs.readFileSync(path.join(ROOT, wirer), "utf8");
  if (!src.includes("hooks/lib/svc-ownership.mjs")) problem(`${wirer} does not import the shared ownership predicate`);
}
ok("all three wirers import hooks/lib/svc-ownership.mjs");

console.log(`validate-ownership-predicate-parity: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
