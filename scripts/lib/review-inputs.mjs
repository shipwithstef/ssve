import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { validatePlanBody } from './plan-manifest-contract.mjs';

// The same validated bytes feed preflight and the actual review. No receipts or
// candidate identities are authored here; this is input preparation only.
export function prepareReviewInputs(root, { planFile, contextFiles, reviewKind } = {}) {
  root = fs.realpathSync(root);
  const files = new Map();
  function read(relative) {
    if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.split(/[\\/]/).some(p => p === '..')) throw new Error('Review input must be repository-relative');
    const absolute = fs.realpathSync(path.join(root, relative));
    if (!absolute.startsWith(root + path.sep)) throw new Error(`Review input escapes repository: ${relative}`);
    if (/^\.env(?:\.|$)/.test(path.basename(relative))) throw new Error(`Private environment file is not review context: ${relative}`);
    const bytes = fs.readFileSync(absolute);
    const indexed = reviewKind === 'exec' && spawnSync('git', ['ls-files', '--error-unmatch', '--', relative], { cwd: root, stdio: 'ignore' }).status === 0;
    if (reviewKind === 'exec' && plan?.scope.included.includes(relative) && !indexed) throw new Error(`Executed review source is not staged: ${relative}`);
    if (indexed) {
      const staged = execFileSync('git', ['show', `:${relative}`], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
      if (!staged.equals(bytes)) throw new Error(`Review source differs from staged candidate: ${relative}`);
    }
    if (bytes.includes(0)) throw new Error(`Binary review input: ${relative}`);
    const item = { label: `source:${relative}`, bytes, sha256: createHash('sha256').update(bytes).digest('hex') };
    files.set(relative, item);
    return bytes.toString('utf8');
  }
  let plan = null;
  if (planFile) {
    plan = JSON.parse(read(planFile));
    if (plan.schema_version !== 4) throw new Error('Review input preparation requires the current inline v4 plan');
    const validation = validatePlanBody(plan, { readSpec: read, readFile: read });
    if (!validation.ok) throw new Error(`Invalid review plan: ${validation.errors.join('; ')}`);
    // Planned CREATE files need not exist before execution. Explicit dependency
    // and context references must exist; the schema validator reads those too.
    for (const file of plan.scope.included) {
      if (fs.existsSync(path.join(root, file))) read(file);
      else if (reviewKind === 'exec') {
        if (spawnSync('git', ['ls-files', '--error-unmatch', '--', file], { cwd: root, stdio: 'ignore' }).status === 0) throw new Error(`Missing executed source remains in staged candidate: ${file}`);
        const base = plan.plan_contract?.body?.base_sha;
        if (!/^[0-9a-f]{40}$/.test(base || '') || /^\.env(?:\.|$)/.test(path.basename(file))) throw new Error(`Missing executed review input: ${file}`);
        const bytes = execFileSync('git', ['show', `${base}:${file}`], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
        if (bytes.includes(0)) throw new Error(`Binary base review input: ${file}`);
        files.set(file, { label: `base:${base}:${file}`, bytes, sha256: createHash('sha256').update(bytes).digest('hex') });
      }
    }
    for (const dependency of plan.dependencies) if (typeof dependency?.artifact === 'string') read(dependency.artifact);
    for (const task of plan.task_graph) for (const ref of task.context_refs || []) read(ref.path);
    if (plan.plan_contract?.path) read(plan.plan_contract.path);
    if (plan.release_producer?.path) {
      const content = read(plan.release_producer.path);
      if (createHash('sha256').update(content).digest('hex') !== plan.release_producer.sha256) throw new Error('Release producer differs from the frozen plan');
    }
  }
  if (contextFiles) {
    const list = JSON.parse(read(contextFiles));
    if (!Array.isArray(list) || !list.every(p => typeof p === 'string')) throw new Error('Context files must be an array of repository-relative paths');
    for (const file of list) read(file);
  }
  return { plan, files: [...files.values()] };
}
