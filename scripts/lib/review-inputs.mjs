import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { validatePlanBody,parsePlanManifest } from './plan-manifest-contract.mjs';
import { assertCurrentExecution,loadPlanAuthority } from './receipt-issuance-epoch.mjs';
import { validateControlPlan } from './control-plan-validate.mjs';
import { getObject } from './review-evidence-store.mjs';

function rejectSymlinkTree(root, relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.split(/[\\/]/).some(p => p === '..' || p === '')) throw new Error('Review input must be repository-relative');
  let cursor = root;
  for (const part of relative.split('/')) {
    cursor = path.join(cursor, part);
    const st = fs.lstatSync(cursor);
    if (st.isSymbolicLink() || fs.realpathSync(cursor) !== cursor) throw new Error(`symlink rejected: ${relative}`);
  }
  if (!cursor.startsWith(root + path.sep)) throw new Error(`Review input escapes repository: ${relative}`);
  return cursor;
}
function objectBytes(root, ref) {
  if (!ref || ref.type !== 'object' || typeof ref.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(ref.sha256)) throw new Error('invalid object ref');
  const stored = getObject(ref.sha256, { start: root });
  const bytes = Buffer.isBuffer(stored) ? stored : stored?.bytes;
  if (!bytes) throw new Error(`unresolved object ${ref.sha256}`);
  return Buffer.from(bytes);
}
function assertUnsealedV5Control(root, body) {
  const pc = body.planning_contract;
  if (pc?.kind !== 'two_box') return;
  const control = JSON.parse(objectBytes(root, pc.control_plan_ref).toString('utf8'));
  const result = validateControlPlan({ consumerRoot: root, body: control, requirementsRef: pc.original_requirements_ref, sourceSnapshotRef: pc.source_snapshot_ref });
  if (!result?.ok) throw new Error(`Invalid control plan: ${(result?.errors || []).join('; ')}`);
}
function deriveManifestPath(plan, candidates, read) {
  const matches=[];
  for(const candidate of candidates) {
    if(!candidate.endsWith('.md')) continue;
    const markdown=read(candidate);
    if(!markdown.includes('<!-- SVC_PLAN_BODY -->')) continue;
    try { if(JSON.stringify(parsePlanManifest(markdown))===JSON.stringify(plan)) matches.push(candidate); } catch { /* not the full manifest */ }
  }
  if(matches.length!==1) throw new Error('review context must name exactly one full Markdown manifest for the prepared plan');
  return matches[0];
}

// The same validated bytes feed preflight and the actual review. No receipts or
// candidate identities are authored here; this is input preparation only.
export function prepareReviewInputs(root, { planFile, contextFiles, reviewKind, sealRef } = {}) {
  root = fs.realpathSync(root);
  if (fs.lstatSync(root).isSymbolicLink()) throw new Error('repository root is a symlink');
  const files = new Map();
  function read(relative) {
    const absolute = rejectSymlinkTree(root, relative);
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
  let planBytes = null;
  const contextList = contextFiles ? JSON.parse(read(contextFiles)) : [];
  if(!Array.isArray(contextList) || !contextList.every(p=>typeof p==='string')) throw new Error('context files must be an array');
  if (planFile) {
    read(planFile);
    planBytes = files.get(planFile).bytes;
    plan = JSON.parse(planBytes.toString('utf8'));
    const manifestPath = deriveManifestPath(plan, contextList, read);
    if (plan.schema_version === 5) {
      const validation = validatePlanBody(plan, { readSpec: read, readFile: read, ...(reviewKind === 'plan' ? {consumerRoot: root} : {}) });
      if (!validation.ok) throw new Error(`Invalid review plan: ${validation.errors.join('; ')}`);
      assertUnsealedV5Control(root, plan);
      if (reviewKind === 'exec') {
        const located=sealRef?{}:loadPlanAuthority({consumerRoot:root,body:plan});
        assertCurrentExecution({ consumerRoot: root, body: plan, planBytes, manifestPath, sealRef:sealRef||located.sealRef });
      }
    } else {
      assertCurrentExecution({ consumerRoot: root, body: plan, planBytes, manifestPath, sealRef });
      const validation = validatePlanBody(plan, { readSpec: read, readFile: read });
      if (!validation.ok) throw new Error(`Invalid review plan: ${validation.errors.join('; ')}`);
    }
    // Planned CREATE files need not exist before execution. Explicit dependency
    // and context references must exist; the schema validator reads those too.
    for (const file of plan.scope.included) {
      if (fs.existsSync(path.join(root, file))) read(file);
      else if (reviewKind === 'exec') {
        if (spawnSync('git', ['ls-files', '--error-unmatch', '--', file], { cwd: root, stdio: 'ignore' }).status === 0) throw new Error(`Missing executed source remains in staged candidate: ${file}`);
        if (plan.changeset_blueprints?.some(row => row.file === file && row.action === 'CREATE')) throw new Error(`Planned CREATE file is missing: ${file}`);
        let base = plan.plan_contract?.body?.base_sha;
        if (plan.schema_version === 5 && plan.planning_contract.kind === 'two_box') {
          // Current execution already authenticated this source snapshot.
          base = JSON.parse(objectBytes(root, plan.planning_contract.source_snapshot_ref)).base_sha;
        } else if (plan.schema_version === 5 && plan.planning_contract.kind === 'lightweight') {
          const staged = execFileSync('git', ['diff', '--cached', '--name-only'], {cwd:root,encoding:'utf8'}).trim();
          const args = staged ? ['diff', '--cached', '--diff-filter=D', '--name-only', '--', file]
            : ['diff-tree', '--no-commit-id', '--diff-filter=D', '--name-only', '-r', 'HEAD', '--', file];
          if (execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim() !== file) throw new Error(`Missing input is not a classified deletion: ${file}`);
          base = execFileSync('git',['rev-parse',staged ? 'HEAD' : 'HEAD^'],{cwd:root,encoding:'utf8'}).trim();
        }
        if (!/^[0-9a-f]{40}$/.test(base || '') || /^\.env(?:\.|$)/.test(path.basename(file))) throw new Error(`Missing executed review input: ${file}`);
        const entry = execFileSync('git',['ls-tree',base,'--',file],{cwd:root,encoding:'utf8'}).trim();
        if (!/^100(?:644|755) blob [0-9a-f]{40}\t/.test(entry)) throw new Error(`Base review input is not a regular file: ${file}`);
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
