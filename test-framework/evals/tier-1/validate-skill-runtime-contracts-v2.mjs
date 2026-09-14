#!/usr/bin/env node

import assert from 'node:assert/strict';
import { compileSkillRuntimeContracts } from '../../../scripts/svc-skill-runtime-compiler-v2.mjs';

const result = compileSkillRuntimeContracts(process.cwd());
assert.equal(result.target_skills.length, 10);
assert.equal(new Set(result.contracts.map(row => `${row.skill}:${row.artifact}`)).size, result.contracts.length);
assert(result.contracts.every(row => row.consumers.length > 0));
assert(result.continuation_dag.some(([from, to]) => from === 'review-exec' && to === 'audit-implementation'));
assert.deepEqual(result.continuation_dag.slice(-4).map(([, to]) => to).sort(), ['customer', 'metric', 'operations', 'owner']);
console.log('PASS validate-skill-runtime-contracts-v2');
