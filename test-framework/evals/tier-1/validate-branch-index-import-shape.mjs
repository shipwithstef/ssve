#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { directImports } from '../../../scripts/branch-index-freshness.mjs';

const source = `
// import Commented from './commented.mjs';
/* import {
  Blocked,
} from './blocked.mjs'; */
import {
  Named,
  Other as Alias,
} from './named.mjs';
import Default,
  { Value } from './default-named.mjs';
import * as Namespace from './namespace.mjs';
import
  { OnNextLine }
from
  './newline-boundaries.mjs';
import type { Typed } from './typed.mjs';
import OneLine from './single.mjs';
import Broken,
import Pending
const text = "from './unrelated.mjs'";
import Last from './last.mjs';
import WithComment /* harmless */ from './comment-gap.mjs';
const loaded = require('./required.cjs');
const string = "require('./quoted.cjs')";
`;
assert.deepEqual(directImports(source), [
  './comment-gap.mjs',
  './default-named.mjs',
  './last.mjs',
  './named.mjs',
  './namespace.mjs',
  './newline-boundaries.mjs',
  './required.cjs',
  './single.mjs',
  './typed.mjs',
]);

const importsFor = (relative) => directImports(readFileSync(new URL(`../../../${relative}`, import.meta.url), 'utf8'));
assert.ok(importsFor('scripts/two-box-plan.mjs').includes('./lib/two-box-protocol.mjs'));
const worktreeImports = importsFor('scripts/svc-ensure-worktree.mjs');
for (const spec of [
  '../hooks/lib/wi-claim.mjs',
  '../hooks/lib/literal-branch.mjs',
  '../hooks/lib/worktree-policy.mjs',
]) assert.ok(worktreeImports.includes(spec), `${spec} omitted from worktree import shape`);

console.log('branch-index import shape: multiline static imports and statement boundaries passed');
