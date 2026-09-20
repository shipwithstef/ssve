#!/usr/bin/env python3
"""Prepare verified repair trees without updating any branch or committing to main."""
import base64, gzip, hashlib, json, os, pathlib, re, subprocess, sys, urllib.request

ROOT = pathlib.Path.cwd()
OUTPUT = pathlib.Path(os.environ['RUNNER_TEMP']) / 'ci-repair-evidence'
OUTPUT.mkdir(parents=True, exist_ok=True)
REPO = 'shipwithstef/ssve'
TOKEN = os.environ['GH_TOKEN']
CHUNKS = ['caab29b6df60df26944fc44b2b22ff171eac2493', '964b3c17a16c0b1a9f4a79808846b8a1aa66a420', '309055c9ff556012512684016beefc26754ac852', 'd8bf444af2a0a348a19245d93dcea20fee5cfdd5']
PATCH_SHA = os.environ['REPAIR_PATCH_SHA256']
BASE = 'c96e7fee4da4fa2b3aa4cb599f16493e7ef54176'
REPAIRS = json.loads((ROOT / '.github/ci-repair-targets.json').read_text())
ALLOWED = {
 '.svc/lane-tasks-WI-FW-CROSS-REPO-ORCH-02.json', '.svc/perf-baseline.json',
 '.svc/pipeline-decisions.jsonl', 'FRAMEWORK-STATE.md',
 'docs/specs/features/wi-fw-cross-repo-orch-02.md',
 'docs/specs/work-items/WI-FW-CROSS-REPO-ORCH-02.md',
 'references/skill-routing-index.json', 'scripts/svc-reconcile.mjs',
 'skills/route-workflow/SKILL.md',
 'skills/route-workflow/references/hot-path-operational-details.md',
 'test-framework/evals/tier-1/lib/reconcile-fixture.mjs',
 'test-framework/evals/tier-1/validate-svc-reconcile-watcher-advance.sh',
}


def api(endpoint, value=None):
    """Call only repository Git object endpoints; never update refs or merge."""
    if not endpoint.startswith(('git/blobs', 'git/trees')): raise ValueError('object-only API')
    data = json.dumps(value).encode() if value is not None else None
    req = urllib.request.Request(f'https://api.github.com/repos/{REPO}/{endpoint}', data=data,
        headers={'Authorization': f'Bearer {TOKEN}', 'Accept': 'application/vnd.github+json',
                 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28'})
    with urllib.request.urlopen(req, timeout=90) as response: return json.load(response)


def git(directory, *args, data=None):
    """Run Git with argument arrays and return exact stdout."""
    return subprocess.check_output(['git', '-C', str(directory), *args], input=data, timeout=120)


def check(directory, label, argv):
    """Run actual validators in private offline fixtures and retain complete output."""
    with (OUTPUT / f'{label}.log').open('w') as log:
        result = subprocess.run(['bash', '-c',
            'source test-framework/evals/tier-1/lib/fixture-home.sh; svc_run_fixture "$@"', '_', *argv],
            cwd=directory, stdout=log, stderr=subprocess.STDOUT, timeout=600)
    if result.returncode: raise RuntimeError(f'{label} failed: {result.returncode}')


def prepare(target, patch):
    """Apply one content-bound patch and canonically regenerate branch-specific artifacts."""
    sha = target['sha']; name = str(target['pr'])
    directory = pathlib.Path(os.environ['RUNNER_TEMP']) / f'ci-repair-{name}'
    git(ROOT, 'worktree', 'add', '--detach', str(directory), sha)
    git(directory, 'apply', '--check', '-', data=patch)
    git(directory, 'apply', '-', data=patch)
    state = directory / 'FRAMEWORK-STATE.md'
    validators = directory / 'test-framework/evals/tier-1'
    count = sum(p.is_file() and p.suffix in {'.sh', '.mjs'} for p in validators.iterdir())
    content, replacements = re.subn(r'\b\d+ tier-1 scripts\b', f'{count} tier-1 scripts', state.read_text())
    if replacements != 1: raise RuntimeError('ambiguous inventory field')
    state.write_text(content)
    subprocess.run(['node', 'scripts/compile-skill-router-index.mjs'], cwd=directory, check=True, timeout=120)
    before = {file: hashlib.sha256((directory / file).read_bytes()).hexdigest() for file in ALLOWED}
    if target.get('test'): check(directory, f'pr-{name}-focused', ['node', '--test', target['test']])
    if target['pr'] == 'baseline':
        for validator in ['validate-skill-router.sh', 'validate-svc-reconcile-watcher-advance.sh',
                          'validate-hook-latency.sh', 'validate-cross-repo-orch-02.mjs']:
            check(directory, f'baseline-{validator}', ['node' if validator.endswith('.mjs') else 'bash',
                  f'test-framework/evals/tier-1/{validator}'])
    if before != {file: hashlib.sha256((directory / file).read_bytes()).hexdigest() for file in ALLOWED}:
        raise RuntimeError('focused validation mutated repair source')
    git(directory, 'add', '--', *sorted(ALLOWED))
    changed = git(directory, 'diff', '--cached', '--name-only').decode().splitlines()
    if set(changed) != ALLOWED: raise RuntimeError(f'changed-path mismatch: {changed}')
    expected = git(directory, 'write-tree').decode().strip()
    elements = []
    for file in changed:
        mode, oid, _ = git(directory, 'ls-files', '-s', '--', file).decode().split(None, 2)
        if oid not in UPLOADED:
            content = git(directory, 'cat-file', 'blob', oid)
            actual = api('git/blobs', {'content': base64.b64encode(content).decode(), 'encoding': 'base64'})['sha']
            if actual != oid: raise RuntimeError('published blob mismatch')
            UPLOADED.add(oid)
        elements.append({'path': file, 'mode': mode, 'type': 'blob', 'sha': oid})
    old_tree = git(directory, 'rev-parse', f'{sha}^{{tree}}').decode().strip()
    actual = api('git/trees', {'base_tree': old_tree, 'tree': elements})['sha']
    if actual != expected: raise RuntimeError('published tree differs from tested Git tree')
    print(f'Prepared PR {name}: tree {actual}, validators {count}', flush=True)
    return {**target, 'tree_sha': actual, 'validator_count': count, 'changed_files': changed}, directory


encoded = b''.join(base64.b64decode(api(f'git/blobs/{sha}')['content']) for sha in CHUNKS)
patch = gzip.decompress(base64.b64decode(encoded, validate=True))
if hashlib.sha256(patch).hexdigest() != PATCH_SHA: raise RuntimeError('patch digest mismatch')
UPLOADED = set()
prepared = []
base_directory = None
for target in [{'pr': 'baseline', 'sha': BASE}, *REPAIRS]:
    row, directory = prepare(target, patch); prepared.append(row)
    if target['pr'] == 'baseline': base_directory = directory
(OUTPUT / 'prepared-trees.json').write_text(json.dumps({'patch_sha256': PATCH_SHA,
    'runtime': subprocess.check_output(['node', '--version'], text=True).strip(),
    'prepared': prepared}, indent=2) + '\n')
# The pre-existing real free-check workflow contract remains mandatory.
with (OUTPUT / 'workflow-contract.log').open('w') as log:
    subprocess.run(['node', '--test', 'test-framework/tests/oss-ci-workflow.test.mjs'],
                   cwd=base_directory, stdout=log, stderr=subprocess.STDOUT, check=True, timeout=120)
# Exercise all Tier-1 validators on the repaired baseline; no refs or receipts are issued.
env = {**os.environ, 'EVALS': '0', 'TIER1_JOBS': '4'}
env.pop('GH_TOKEN', None)
with (OUTPUT / 'baseline-free-checks.log').open('w') as log:
    run = subprocess.run(['bash', 'scripts/ci/run-free-checks.sh'], cwd=base_directory, env=env,
                         stdout=log, stderr=subprocess.STDOUT, timeout=3000)
(OUTPUT / 'baseline-free-checks.exit').write_text(str(run.returncode) + '\n')
print('Complete free-check exit:', run.returncode, flush=True)
sys.exit(run.returncode)
