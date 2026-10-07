#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

test('CP3 register.tsx parses in the actual plugin loader; malformed JSX is rejected', t => {
  const plugin = fileURLToPath(new URL('../../mods/orchestrator-pane/', import.meta.url));
  const validate = folder => spawnSync('claude', ['plugin', 'validate', folder], { encoding: 'utf8', timeout: 30000 });
  const good = validate(plugin);
  if (good.error?.code === 'ENOENT') { t.skip('Claude plugin loader is required for the TSX parse check'); return; }
  assert.equal(good.status, 0, good.stderr + good.stdout);
  assert.match(good.stdout, /Validation passed/);
  assert.match(good.stdout, /component=AssistantMessage/); // module actually scanned, not just manifest
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orch-jsx-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.cpSync(plugin, root, { recursive: true });
  const module = path.join(root, 'hooks/register.tsx');
  const source = fs.readFileSync(module, 'utf8');
  assert.ok(source.includes('return <Box display="none" />;'));
  // Reproduce the extra '<' that previously broke register.tsx on reload.
  fs.writeFileSync(module, source.replace('return <Box display="none" />;', 'return <<Box display="none" />;'));
  const bad = validate(root);
  assert.notEqual(bad.status, 0, bad.stdout + bad.stderr);
  assert.match(bad.stdout + bad.stderr, /JSX|parse|Unexpected|Expected/i);
});
