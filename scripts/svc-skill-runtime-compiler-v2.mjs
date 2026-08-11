#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDir, '..');
const TARGET_SKILLS = [
  'analyze-competitors', 'analyze-domain', 'catalog-domain-capabilities', 'build-personas',
  'write-vision', 'write-spec', 'design-ux', 'design-ui', 'design-tech', 'plan-changeset',
];
const PRODUCT_TERMINALS = new Set(['customer', 'owner', 'operations', 'metric']);

function fail(message) { throw new Error(`skill-runtime-compiler-v2: ${message}`); }

function outputArtifacts(skillText) {
  const frontmatter = skillText.match(/^---\n([\s\S]*?)\n---/)?.[1];
  if (!frontmatter) fail('skill is missing frontmatter');
  const outputBlock = frontmatter.split('\noutputs:')[1]?.split('\nchain:')[0];
  if (!outputBlock) fail('skill is missing outputs block');
  return [...outputBlock.matchAll(/artifact:\s*["']?([^,}\n"']+)/g)].map(match => match[1].trim());
}

function assertAcyclic(edges, nodes) {
  const visiting = new Set(); const visited = new Set();
  const outgoing = new Map(nodes.map(node => [node, []]));
  for (const [from, to] of edges) if (outgoing.has(from) && outgoing.has(to)) outgoing.get(from).push(to);
  function visit(node) {
    if (visiting.has(node)) fail(`continuation cycle at ${node}`);
    if (visited.has(node)) return;
    visiting.add(node); for (const next of outgoing.get(node) ?? []) visit(next);
    visiting.delete(node); visited.add(node);
  }
  for (const node of nodes) visit(node);
}

export function compileSkillRuntimeContracts(repoRoot = defaultRoot) {
  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'skills-manifest.json'), 'utf8'));
  const registryPath = path.join(repoRoot, manifest.skillRuntimeContractsV2?.registry ?? 'references/skill-runtime-contracts-v2.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const included = new Set(manifest.includedSkills);
  const declared = new Map();
  for (const contract of registry.contracts) {
    const key = `${contract.skill}:${contract.artifact}`;
    if (declared.has(key)) fail(`duplicate output contract ${key}`);
    if (!included.has(contract.skill)) fail(`unknown producer skill ${contract.skill}`);
    if (!Array.isArray(contract.consumers) || contract.consumers.length === 0) fail(`orphan output ${key}`);
    if (!contract.condition || !contract.invalidation) fail(`incomplete output contract ${key}`);
    for (const consumer of contract.consumers) if (!included.has(consumer) && !PRODUCT_TERMINALS.has(consumer)) fail(`unknown consumer ${consumer}`);
    declared.set(key, contract);
  }
  for (const skill of TARGET_SKILLS) {
    const artifacts = outputArtifacts(fs.readFileSync(path.join(repoRoot, 'skills', skill, 'SKILL.md'), 'utf8'));
    for (const artifact of artifacts) if (!declared.has(`${skill}:${artifact}`)) fail(`undeclared output ${skill}:${artifact}`);
  }
  assertAcyclic(registry.continuation_dag, [...included, ...PRODUCT_TERMINALS]);
  return { schema_version: registry.schema_version, target_skills: TARGET_SKILLS, contracts: registry.contracts, continuation_dag: registry.continuation_dag };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rootIndex = process.argv.indexOf('--root');
  const result = compileSkillRuntimeContracts(rootIndex >= 0 ? path.resolve(process.argv[rootIndex + 1]) : defaultRoot);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
