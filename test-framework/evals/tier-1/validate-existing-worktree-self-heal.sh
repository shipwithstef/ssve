#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
export SVC_WORKTREES_ROOT="$TMP/worktrees"

PASS=0
FAIL=0
ok() { PASS=$((PASS + 1)); echo "  ok - $1"; }
bad() { FAIL=$((FAIL + 1)); echo "  FAIL - $1"; }

make_repo() {
  local repo="$1"
  mkdir -p "$repo"
  git -C "$repo" init -q -b main
  git -C "$repo" config user.name fixture
  git -C "$repo" config user.email fixture@example.test
  printf '.worktrees/\n' > "$repo/.gitignore"
  printf 'base\n' > "$repo/README.md"
  git -C "$repo" add .gitignore README.md
  git -C "$repo" commit -qm base
  git -C "$repo" update-ref refs/remotes/origin/main HEAD
}

echo "=== Tier 1: existing worktree self-heal ==="

REPO="$TMP/repo"
make_repo "$REPO"
PRESERVED="$REPO/.worktrees/preserved-scout-path"
OLD_BRANCH="sample-revenue-activation"
NEW_BRANCH="sample-revenue-activation-r25"
WI="WI-SAMPLE-REVENUE-ACTIVATION-01"
SESSION="019fe17e-8bef-7cc3-902b-084b95218fe8"
git -C "$REPO" worktree add -q -b "$OLD_BRANCH" "$PRESERVED" origin/main
mkdir -p "$PRESERVED/.svc"

node --input-type=module - "$ROOT" "$PRESERVED" "$REPO" "$WI" "$OLD_BRANCH" "$SESSION" <<'NODE'
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [root, worktree, repo, wi, branch, session] = process.argv.slice(2);
const claims = await import(pathToFileURL(path.join(root, 'hooks/lib/wi-claim.mjs')));
const result = claims.writeSessionBinding({ worktree_root: worktree, repo_root: repo, wi, branch, session_id: session, role: 'mutating', host: 'codex' });
if (!result.ok) throw new Error(result.warning);
NODE

git -C "$PRESERVED" branch -m "$NEW_BRANCH"
printf 'user residue must survive\n' > "$PRESERVED/local-preserved.txt"
BEFORE_HEAD="$(git -C "$PRESERVED" rev-parse HEAD)"
BEFORE_BYTES="$(sha256sum "$PRESERVED/local-preserved.txt" | cut -d' ' -f1)"

RESULT="$(cd "$REPO" && SVC_SESSION_ID="$SESSION" SVC_AUTHORITY_STATE_ROOT="$TMP/authority" node "$ROOT/scripts/svc-ensure-worktree.mjs" --wi "$WI" --branch "$NEW_BRANCH" --from origin/main --authority-v2 --json)"
ACTUAL_PATH="$(node -e 'process.stdout.write(require("fs").realpathSync(JSON.parse(process.argv[1]).absolute_worktree))' "$RESULT")"
if [[ "$ACTUAL_PATH" == "$(realpath "$PRESERVED")" ]]; then ok "registered branch is adopted at its preserved nonstandard path"; else bad "bootstrap did not adopt preserved path"; fi
if [[ ! -e "$REPO/.worktrees/$NEW_BRANCH" ]]; then ok "no duplicate branch-named worktree is created"; else bad "duplicate worktree was created"; fi
if [[ "$(git -C "$PRESERVED" rev-parse HEAD)" == "$BEFORE_HEAD" && "$(sha256sum "$PRESERVED/local-preserved.txt" | cut -d' ' -f1)" == "$BEFORE_BYTES" ]]; then ok "HEAD and user residue are byte-preserved"; else bad "self-heal changed HEAD or user residue"; fi

CLAIM="$PRESERVED/.svc/claims/$WI.claim.json"
BINDING="$(find "$PRESERVED/.svc/bindings" -maxdepth 1 -type f -name '*.json' -print -quit)"
if node -e 'const c=require(process.argv[1]),b=require(process.argv[2]);process.exit(c.branch===process.argv[3]&&b.branch===process.argv[3]&&c.generation===1&&b.generation===1?0:1)' "$CLAIM" "$BINDING" "$NEW_BRANCH"; then ok "same-session claim and binding converge without generation drift"; else bad "claim/binding branch repair did not converge exactly"; fi
if node -e 'const r=JSON.parse(process.argv[1]);process.exit(r.authority_v2?.lease?.schema_version===2&&r.authority_v2?.lease?.worktree_root===process.argv[2]?0:1)' "$RESULT" "$(realpath "$PRESERVED")"; then ok "canonical recovery promotes to controller-lease-v2"; else bad "controller-v2 promotion receipt missing"; fi

FIRST_LEASE_ID="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).authority_v2.lease.lease_id)' "$RESULT")"
FIRST_GENERATION="$(node -e 'process.stdout.write(String(JSON.parse(process.argv[1]).authority_v2.lease.generation))' "$RESULT")"
SECOND_RESULT="$(cd "$REPO" && SVC_SESSION_ID="$SESSION" SVC_AUTHORITY_STATE_ROOT="$TMP/authority" node "$ROOT/scripts/svc-ensure-worktree.mjs" --wi "$WI" --branch "$NEW_BRANCH" --from origin/main --authority-v2 --json)"
if node -e 'const r=JSON.parse(process.argv[1]);process.exit(r.authority_v2?.lease?.lease_id===process.argv[2]&&String(r.authority_v2?.lease?.generation)===process.argv[3]?0:1)' "$SECOND_RESULT" "$FIRST_LEASE_ID" "$FIRST_GENERATION"; then ok "repeated canonical bootstrap resumes the same v2 lease and generation"; else bad "repeated canonical bootstrap is not idempotent"; fi

PARTIAL_REPO="$TMP/partial"
make_repo "$PARTIAL_REPO"
PARTIAL_WT="$PARTIAL_REPO/.worktrees/partial-path"
git -C "$PARTIAL_REPO" worktree add -q -b partial-branch "$PARTIAL_WT" origin/main
mkdir -p "$PARTIAL_WT/.svc"
PARTIAL_SESSION="019fe17e-3333-7cc3-902b-084b95218fe8"
node --input-type=module - "$ROOT" "$PARTIAL_WT" "$PARTIAL_REPO" "$PARTIAL_SESSION" <<'NODE'
import path from 'node:path'; import { pathToFileURL } from 'node:url';
const [root, worktree, repo, session] = process.argv.slice(2);
const claims = await import(pathToFileURL(path.join(root, 'hooks/lib/wi-claim.mjs')));
const result = claims.writeSessionBinding({ worktree_root: worktree, repo_root: repo, wi: 'WI-PARTIAL-01', branch: 'partial-branch', session_id: session, role: 'mutating', host: 'codex' });
if (!result.ok) throw new Error(result.warning);
NODE
if (cd "$PARTIAL_REPO" && SVC_SESSION_ID="$PARTIAL_SESSION" SVC_AUTHORITY_STATE_ROOT="$TMP/partial-authority" SVC_AUTHORITY_MIGRATION_FAILPOINT=after-lease-before-receipt node "$ROOT/scripts/svc-ensure-worktree.mjs" --wi WI-PARTIAL-01 --branch partial-branch --from origin/main --authority-v2 --json) >"$TMP/partial-first.out" 2>"$TMP/partial-first.err"; then
  bad "post-lease migration failpoint unexpectedly succeeded"
else
  PARTIAL_RESULT="$(cd "$PARTIAL_REPO" && SVC_SESSION_ID="$PARTIAL_SESSION" SVC_AUTHORITY_STATE_ROOT="$TMP/partial-authority" node "$ROOT/scripts/svc-ensure-worktree.mjs" --wi WI-PARTIAL-01 --branch partial-branch --from origin/main --authority-v2 --json)"
  if node -e 'const fs=require("fs"),r=JSON.parse(process.argv[1]);const p=r.authority_v2?.receipt_path;process.exit(r.authority_v2?.resumed&&p&&fs.existsSync(p)?0:1)' "$PARTIAL_RESULT"; then ok "post-lease failure forward-completes the exact migration receipt"; else bad "partial v2 migration could not forward-complete"; fi
fi

LEGACY_V2_REPO="$TMP/legacy-v2"
make_repo "$LEGACY_V2_REPO"
LEGACY_V2_WT="$LEGACY_V2_REPO/.worktrees/legacy-v2-path"
LEGACY_V2_STATE="$TMP/legacy-v2-authority"
LEGACY_V2_SESSION="019fe17e-8888-7cc3-902b-084b95218fe8"
LEGACY_V2_WI="WI-LEGACY-V2-01"
git -C "$LEGACY_V2_REPO" worktree add -q -b legacy-v2-branch "$LEGACY_V2_WT" origin/main
mkdir -p "$LEGACY_V2_WT/.svc"
LEGACY_V2_LEASE="$(node --input-type=module - "$ROOT" "$LEGACY_V2_WT" "$LEGACY_V2_REPO" "$LEGACY_V2_STATE" "$LEGACY_V2_SESSION" "$LEGACY_V2_WI" <<'NODE'
import path from 'node:path'; import { pathToFileURL } from 'node:url';
const [root, worktree, repo, stateRoot, session, wi] = process.argv.slice(2);
const claims = await import(pathToFileURL(path.join(root, 'hooks/lib/wi-claim.mjs')));
const authority = await import(pathToFileURL(path.join(root, 'hooks/lib/authority-store.mjs')));
const result = claims.writeSessionBinding({ worktree_root: worktree, repo_root: repo, wi, branch: 'legacy-v2-branch', session_id: session, role: 'mutating', host: 'codex' });
if (!result.ok) throw new Error(result.warning);
const lease = authority.bootstrapController({
  stateRoot,
  repoId: authority.repositoryId(worktree),
  wi,
  worktreeRoot: worktree,
  principal: authority.principalId({ host: 'claude', session_id: session }),
  initialGeneration: 1,
});
process.stdout.write(JSON.stringify(lease));
NODE
)"
git -C "$LEGACY_V2_WT" branch -m legacy-v2-renamed
node -e 'const fs=require("fs"),p=process.argv[1],v=JSON.parse(fs.readFileSync(p,"utf8"));v.renewed_at="2000-01-01T00:00:00.000Z";v.ttl_hours=1;fs.writeFileSync(p,`${JSON.stringify(v,null,2)}\n`)' "$LEGACY_V2_WT/.svc/claims/$LEGACY_V2_WI.claim.json"
LEGACY_V2_RESULT="$(cd "$LEGACY_V2_REPO" && SVC_SESSION_ID="$LEGACY_V2_SESSION" SVC_HOST=claude SVC_AUTHORITY_STATE_ROOT="$LEGACY_V2_STATE" node "$ROOT/scripts/svc-ensure-worktree.mjs" --wi "$LEGACY_V2_WI" --branch legacy-v2-renamed --from origin/main --authority-v2 --json)"
LEGACY_V2_CLAIM="$LEGACY_V2_WT/.svc/claims/$LEGACY_V2_WI.claim.json"
LEGACY_V2_BINDING="$(find "$LEGACY_V2_WT/.svc/bindings" -maxdepth 1 -type f -name '*.json' -print -quit)"
if node -e 'const before=JSON.parse(process.argv[1]),after=JSON.parse(process.argv[2]).authority_v2,c=require(process.argv[3]),b=require(process.argv[4]);process.exit(after?.preexisting_controller&&after.lease.lease_id===before.lease_id&&after.lease.generation===before.generation&&after.receipt_path===null&&c.branch==="legacy-v2-renamed"&&b.branch==="legacy-v2-renamed"?0:1)' "$LEGACY_V2_LEASE" "$LEGACY_V2_RESULT" "$LEGACY_V2_CLAIM" "$LEGACY_V2_BINDING" && [[ ! -e "$LEGACY_V2_STATE/migrations" ]]; then
  ok "active v2 controller repairs a later branch rename despite stale v1 TTL"
else
  bad "pre-intent exact v2 controller did not self-heal the renamed v1 lineage"
fi

GROK_REPAIR_REPO="$TMP/grok-repair"
make_repo "$GROK_REPAIR_REPO"
GROK_REPAIR_WT="$GROK_REPAIR_REPO/.worktrees/grok-repair-path"
GROK_REPAIR_STATE="$TMP/grok-repair-authority"
GROK_REPAIR_SESSION="019fe17e-9999-7cc3-902b-084b95218fe8"
GROK_REPAIR_WI="WI-GROK-REPAIR-01"
git -C "$GROK_REPAIR_REPO" worktree add -q -b grok-repair-old "$GROK_REPAIR_WT" origin/main
mkdir -p "$GROK_REPAIR_WT/.svc"
node --input-type=module - "$ROOT" "$GROK_REPAIR_WT" "$GROK_REPAIR_REPO" "$GROK_REPAIR_STATE" "$GROK_REPAIR_SESSION" "$GROK_REPAIR_WI" <<'NODE'
import path from 'node:path'; import { pathToFileURL } from 'node:url';
const [root, worktree, repo, stateRoot, session, wi] = process.argv.slice(2);
const claims = await import(pathToFileURL(path.join(root, 'hooks/lib/wi-claim.mjs')));
const authority = await import(pathToFileURL(path.join(root, 'hooks/lib/authority-store.mjs')));
const bound = claims.writeSessionBinding({ worktree_root: worktree, repo_root: repo, wi, branch: 'grok-repair-old', session_id: session, role: 'mutating', host: 'grok' });
if (!bound.ok) throw new Error(bound.warning);
authority.bootstrapController({ stateRoot, repoId: authority.repositoryId(worktree), wi, worktreeRoot: worktree, principal: authority.principalId({ host: 'grok', session_id: session }), initialGeneration: 1 });
NODE
git -C "$GROK_REPAIR_WT" branch -m grok-repair-new
if node --input-type=module - "$ROOT" "$GROK_REPAIR_WT" "$GROK_REPAIR_REPO" "$GROK_REPAIR_STATE" "$GROK_REPAIR_SESSION" "$GROK_REPAIR_WI" <<'NODE'
import path from 'node:path'; import { pathToFileURL } from 'node:url';
const [root, worktree, repo, stateRoot, session, wi] = process.argv.slice(2);
const claims = await import(pathToFileURL(path.join(root, 'hooks/lib/wi-claim.mjs')));
const result = claims.repairSameSessionBranchCoordinates({ wi, worktree_root: worktree, repo_root: repo, session_id: session, branch: 'grok-repair-new', env: { SVC_AUTHORITY_STATE_ROOT: stateRoot, GROK_SESSION_ID: session } });
if (!result.ok || !result.repaired) process.exit(1);
NODE
then ok "GROK_SESSION_ID-only same-session repair attributes the exact Grok controller"; else bad "Grok-marker-only controller repair failed"; fi

GROK_TAKEOVER_REPO="$TMP/grok-takeover"
make_repo "$GROK_TAKEOVER_REPO"
GROK_TAKEOVER_WT="$GROK_TAKEOVER_REPO/.worktrees/grok-takeover-path"
GROK_TAKEOVER_STATE="$TMP/grok-takeover-authority"
GROK_TAKEOVER_SESSION="019fe17e-aaaa-7cc3-902b-084b95218fe8"
GROK_TAKEOVER_WI="WI-GROK-TAKEOVER-01"
git -C "$GROK_TAKEOVER_REPO" worktree add -q -b grok-takeover "$GROK_TAKEOVER_WT" origin/main
mkdir -p "$GROK_TAKEOVER_WT/.svc"
if node --input-type=module - "$ROOT" "$GROK_TAKEOVER_WT" "$GROK_TAKEOVER_REPO" "$GROK_TAKEOVER_STATE" "$GROK_TAKEOVER_SESSION" "$GROK_TAKEOVER_WI" <<'NODE'
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
const [root, worktree, repo, stateRoot, session, wi] = process.argv.slice(2);
const claims = await import(pathToFileURL(path.join(root, 'hooks/lib/wi-claim.mjs')));
const authority = await import(pathToFileURL(path.join(root, 'hooks/lib/authority-store.mjs')));
const bound = claims.writeSessionBinding({ worktree_root: worktree, repo_root: repo, wi, branch: 'grok-takeover', session_id: session, role: 'mutating', host: 'unknown' });
if (!bound.ok) throw new Error(bound.warning);
const repoId = authority.repositoryId(worktree);
const oldPrincipal = authority.principalId({ host: 'codex', session_id: session });
const grokPrincipal = authority.principalId({ host: 'grok', session_id: session });
authority.bootstrapController({ stateRoot, repoId, wi, worktreeRoot: worktree, principal: oldPrincipal, initialGeneration: 1 });
authority.takeoverController({ stateRoot, repoId, wi, principal: grokPrincipal, expectedPrincipal: oldPrincipal, expectedGeneration: 1, reason: 'repair synthetic host principal' });
const refused = claims.repairSameSessionBranchCoordinates({ wi, worktree_root: worktree, repo_root: repo, session_id: session, branch: 'grok-takeover', host: 'codex', env: { SVC_AUTHORITY_STATE_ROOT: stateRoot, SVC_HOST: 'codex', CODEX_SESSION_ID: session } });
const refusedClaim = JSON.parse(fs.readFileSync(path.join(worktree, '.svc', 'claims', `${wi}.claim.json`), 'utf8'));
const refusedBinding = claims.readSessionBinding(worktree, session);
const foreignLease = authority.readController({ stateRoot, repoId, wi });
if (refused.ok || refused.warning !== 'branch repair tuple coordinates or ownership are not exact' ||
    refusedClaim.generation !== 1 || refusedBinding.generation !== 1 ||
    foreignLease.generation !== 2 || foreignLease.controller_principal !== grokPrincipal) process.exit(1);
const interrupted = claims.repairSameSessionBranchCoordinates({ wi, worktree_root: worktree, repo_root: repo, session_id: session, branch: 'grok-takeover', env: { SVC_AUTHORITY_STATE_ROOT: stateRoot, GROK_SESSION_ID: session, SVC_TEST_MODE: '1', SVC_COMPAT_REPAIR_FAILPOINT: 'after-claim-generation' } });
if (interrupted.ok) process.exit(1);
const splitClaim = JSON.parse(fs.readFileSync(path.join(worktree, '.svc', 'claims', `${wi}.claim.json`), 'utf8'));
const splitBinding = claims.readSessionBinding(worktree, session);
const splitLease = authority.readController({ stateRoot, repoId, wi });
if (splitClaim.generation !== 2 || splitClaim.host !== 'grok' ||
    splitBinding.generation !== 1 || splitLease.generation !== 2) process.exit(1);
const repaired = claims.repairSameSessionBranchCoordinates({ wi, worktree_root: worktree, repo_root: repo, session_id: session, branch: 'grok-takeover', env: { SVC_AUTHORITY_STATE_ROOT: stateRoot, GROK_SESSION_ID: session } });
const claim = JSON.parse(fs.readFileSync(path.join(worktree, '.svc', 'claims', `${wi}.claim.json`), 'utf8'));
const binding = claims.readSessionBinding(worktree, session);
const lease = authority.readController({ stateRoot, repoId, wi });
if (!repaired.ok || !repaired.controller_generation_converged || repaired.generation !== 2 ||
    claim.generation !== 2 || claim.host !== 'grok' || binding.generation !== 2 || binding.host !== 'grok' ||
    lease.generation !== 2 || lease.controller_principal !== grokPrincipal) process.exit(1);
NODE
then ok "same-session Grok takeover forward-completes the v1 compatibility generation"; else bad "Grok takeover left split v1/v2 generations"; fi

CONCURRENT_REPO="$TMP/concurrent-v2"
make_repo "$CONCURRENT_REPO"
CONCURRENT_WT="$CONCURRENT_REPO/.worktrees/concurrent-path"
CONCURRENT_STATE="$TMP/concurrent-authority"
CONCURRENT_WI="WI-CONCURRENT-V2-01"
CONCURRENT_SESSION="019fe17e-bbbb-7cc3-902b-084b95218fe8"
CONCURRENT_FOREIGN="019fe17e-cccc-7cc3-902b-084b95218fe8"
git -C "$CONCURRENT_REPO" worktree add -q -b concurrent-old "$CONCURRENT_WT" origin/main
mkdir -p "$CONCURRENT_WT/.svc"
node --input-type=module - "$ROOT" "$CONCURRENT_WT" "$CONCURRENT_REPO" "$CONCURRENT_STATE" "$CONCURRENT_SESSION" "$CONCURRENT_WI" <<'NODE'
import path from 'node:path'; import { pathToFileURL } from 'node:url';
const [root, worktree, repo, stateRoot, session, wi] = process.argv.slice(2);
const claims = await import(pathToFileURL(path.join(root, 'hooks/lib/wi-claim.mjs')));
const authority = await import(pathToFileURL(path.join(root, 'hooks/lib/authority-store.mjs')));
const bound = claims.writeSessionBinding({ worktree_root: worktree, repo_root: repo, wi, branch: 'concurrent-old', session_id: session, role: 'mutating', host: 'codex' });
if (!bound.ok) throw new Error(bound.warning);
authority.bootstrapController({ stateRoot, repoId: authority.repositoryId(worktree), wi, worktreeRoot: worktree, principal: authority.principalId({ host: 'codex', session_id: session }), initialGeneration: 1 });
NODE
git -C "$CONCURRENT_WT" branch -m concurrent-new
SVC_TEST_MODE=1 SVC_BRANCH_REPAIR_HOLD_MS=1000 node --input-type=module - "$ROOT" "$CONCURRENT_WT" "$CONCURRENT_REPO" "$CONCURRENT_STATE" "$CONCURRENT_SESSION" "$CONCURRENT_WI" >"$TMP/concurrent-repair.out" <<'NODE' &
import path from 'node:path'; import { pathToFileURL } from 'node:url';
const [root, worktree, repo, stateRoot, session, wi] = process.argv.slice(2);
const claims = await import(pathToFileURL(path.join(root, 'hooks/lib/wi-claim.mjs')));
const result = claims.repairSameSessionBranchCoordinates({ wi, worktree_root: worktree, repo_root: repo, session_id: session, branch: 'concurrent-new', host: 'codex', env: { ...process.env, SVC_AUTHORITY_STATE_ROOT: stateRoot } });
process.stdout.write(JSON.stringify(result));
NODE
REPAIR_PID=$!
for _ in $(seq 1 100); do
  find "$CONCURRENT_STATE/locks" -maxdepth 1 -type f -name '*.lock' -print -quit 2>/dev/null | grep -q . && break
  sleep 0.01
done
node --input-type=module - "$ROOT" "$CONCURRENT_WT" "$CONCURRENT_STATE" "$CONCURRENT_SESSION" "$CONCURRENT_FOREIGN" "$CONCURRENT_WI" >"$TMP/concurrent-takeover.out" <<'NODE' &
import path from 'node:path'; import { pathToFileURL } from 'node:url';
const [root, worktree, stateRoot, session, foreign, wi] = process.argv.slice(2);
const authority = await import(pathToFileURL(path.join(root, 'hooks/lib/authority-store.mjs')));
const result = authority.takeoverController({ stateRoot, repoId: authority.repositoryId(worktree), wi, principal: authority.principalId({ host: 'codex', session_id: foreign }), expectedPrincipal: authority.principalId({ host: 'codex', session_id: session }), expectedGeneration: 1, reason: 'concurrency fixture' });
process.stdout.write(JSON.stringify(result));
NODE
TAKEOVER_PID=$!
sleep 0.1
TAKEOVER_WAITED=0
if kill -0 "$TAKEOVER_PID" 2>/dev/null; then TAKEOVER_WAITED=1; fi
wait "$REPAIR_PID"
wait "$TAKEOVER_PID"
if [[ "$TAKEOVER_WAITED" == 1 ]] && node --input-type=module - "$ROOT" "$CONCURRENT_WT" "$CONCURRENT_STATE" "$CONCURRENT_WI" "$CONCURRENT_FOREIGN" "$TMP/concurrent-repair.out" <<'NODE'
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
const [root, worktree, stateRoot, wi, foreign, repairOut] = process.argv.slice(2);
const authority = await import(pathToFileURL(path.join(root, 'hooks/lib/authority-store.mjs')));
const claim = JSON.parse(fs.readFileSync(path.join(worktree, '.svc', 'claims', `${wi}.claim.json`), 'utf8'));
const repair = JSON.parse(fs.readFileSync(repairOut, 'utf8'));
const lease = authority.readController({ stateRoot, repoId: authority.repositoryId(worktree), wi });
if (!repair.ok || !repair.repaired || claim.branch !== 'concurrent-new' || lease.generation !== 2 || lease.controller_principal !== authority.principalId({ host: 'codex', session_id: foreign })) process.exit(1);
NODE
then
  ok "controller handover waits until same-principal v1 lineage repair releases the shared lock"
else
  bad "controller handover interleaved with v1 lineage writes"
fi

TRANSFER_REPO="$TMP/transfer"
make_repo "$TRANSFER_REPO"
TRANSFER_WT="$TRANSFER_REPO/.worktrees/transfer-path"
TRANSFER_STATE="$TMP/transfer-authority"
TRANSFER_WI="WI-TRANSFER-01"
TRANSFER_SOURCE="019fe17e-9999-7cc3-902b-084b95218fe8"
TRANSFER_CURRENT="019fe17e-aaaa-7cc3-902b-084b95218fe8"
git -C "$TRANSFER_REPO" worktree add -q -b transfer-old "$TRANSFER_WT" origin/main
mkdir -p "$TRANSFER_WT/.svc"
node --input-type=module - "$ROOT" "$TRANSFER_WT" "$TRANSFER_REPO" "$TRANSFER_WI" "$TRANSFER_SOURCE" "$TRANSFER_CURRENT" <<'NODE'
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
const [root, worktree, repo, wi, source, current] = process.argv.slice(2);
const claims = await import(pathToFileURL(path.join(root, 'hooks/lib/wi-claim.mjs')));
const first = claims.writeSessionBinding({ worktree_root: worktree, repo_root: repo, wi, branch: 'transfer-old', session_id: source, role: 'mutating', host: 'codex' });
if (!first.ok) throw new Error(first.warning);
const now = new Date().toISOString();
const sourceBinding = JSON.parse(fs.readFileSync(first.binding_path, 'utf8'));
fs.writeFileSync(first.binding_path, `${JSON.stringify({ ...sourceBinding, released_at: now, updated_at: now, transfer_to_session: current, transfer_to_generation: 2 }, null, 2)}\n`);
const claim = JSON.parse(fs.readFileSync(first.binding.claim_path, 'utf8'));
fs.writeFileSync(first.binding.claim_path, `${JSON.stringify({ ...claim, generation: 2, session_id: current, transfer_from_session: source, transfer_from_generation: 1, renewed_at: now }, null, 2)}\n`);
const currentPath = claims.bindingPath(worktree, current);
fs.writeFileSync(currentPath, `${JSON.stringify({ ...sourceBinding, session_id: current, generation: 2, created_at: now, updated_at: now }, null, 2)}\n`);
NODE
git -C "$TRANSFER_WT" branch -m transfer-new
node --input-type=module - "$ROOT" "$TRANSFER_WT" "$TRANSFER_WI" "$TRANSFER_CURRENT" <<'NODE'
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
const [root, worktree, wi, current] = process.argv.slice(2);
const claims = await import(pathToFileURL(path.join(root, 'hooks/lib/wi-claim.mjs')));
const claimPath = path.join(worktree, '.svc', 'claims', `${wi}.claim.json`);
const currentPath = claims.bindingPath(worktree, current);
for (const file of [claimPath, currentPath]) {
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(file, `${JSON.stringify({ ...value, branch: 'transfer-new' }, null, 2)}\n`);
}
// Deliberately leave the released generation-1 source binding on transfer-old:
// this is the exact crash state after claim/current writes but before lineage
// convergence. Canonical retry must discover and finish it idempotently.
NODE
TRANSFER_RESULT="$(cd "$TRANSFER_REPO" && SVC_SESSION_ID="$TRANSFER_CURRENT" SVC_AUTHORITY_STATE_ROOT="$TRANSFER_STATE" node "$ROOT/scripts/svc-ensure-worktree.mjs" --wi "$TRANSFER_WI" --branch transfer-new --from origin/main --authority-v2 --json)"
TRANSFER_RECEIPT="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).authority_v2.receipt_path)' "$TRANSFER_RESULT")"
node --input-type=module - "$ROOT" "$TRANSFER_RECEIPT" <<'NODE'
import path from 'node:path'; import { pathToFileURL } from 'node:url';
const [root, receipt] = process.argv.slice(2);
const authority = await import(pathToFileURL(path.join(root, 'hooks/lib/authority-store.mjs')));
authority.rollbackV1Migration({ migrationReceiptPath: receipt });
NODE
if node --input-type=module - "$ROOT" "$TRANSFER_WT" "$TRANSFER_REPO" "$TRANSFER_WI" "$TRANSFER_CURRENT" "$TRANSFER_STATE" <<'NODE'
import path from 'node:path'; import { pathToFileURL } from 'node:url';
const [root, worktree, repo, wi, session, stateRoot] = process.argv.slice(2);
const claims = await import(pathToFileURL(path.join(root, 'hooks/lib/wi-claim.mjs')));
const tuple = claims.inspectV1AuthorityTuple({ wi, branch: 'transfer-new', worktree_root: worktree, repo_root: repo, session_id: session, env: { ...process.env, SVC_AUTHORITY_STATE_ROOT: stateRoot } });
if (tuple.state !== 'current_complete' || tuple.generation !== 2) process.exit(1);
NODE
then
  ok "partial generation-transfer branch repair forward-completes and remains authoritative after v2 rollback"
else
  bad "partial generation-transfer retry left a mismatched v1 tuple"
fi

FOREIGN_REPO="$TMP/foreign"
make_repo "$FOREIGN_REPO"
FOREIGN_WT="$FOREIGN_REPO/.worktrees/preserved"
git -C "$FOREIGN_REPO" worktree add -q -b legacy-foreign "$FOREIGN_WT" origin/main
mkdir -p "$FOREIGN_WT/.svc"
node --input-type=module - "$ROOT" "$FOREIGN_WT" "$FOREIGN_REPO" <<'NODE'
import path from 'node:path'; import { pathToFileURL } from 'node:url';
const [root, worktree, repo] = process.argv.slice(2);
const claims = await import(pathToFileURL(path.join(root, 'hooks/lib/wi-claim.mjs')));
const result = claims.writeSessionBinding({ worktree_root: worktree, repo_root: repo, wi: 'WI-FOREIGN-01', branch: 'legacy-foreign', session_id: '019fe17e-1111-7cc3-902b-084b95218fe8', role: 'mutating', host: 'codex' });
if (!result.ok) throw new Error(result.warning);
NODE
git -C "$FOREIGN_WT" branch -m renamed-foreign
if (cd "$FOREIGN_REPO" && SVC_SESSION_ID="019fe17e-2222-7cc3-902b-084b95218fe8" node "$ROOT/scripts/svc-ensure-worktree.mjs" --wi WI-FOREIGN-01 --branch renamed-foreign --from origin/main --json) >"$TMP/foreign.out" 2>"$TMP/foreign.err"; then bad "live foreign tuple was auto-repaired"; else ok "live foreign tuple remains fail-closed"; fi

OUTSIDE_REPO="$TMP/outside-repo"
make_repo "$OUTSIDE_REPO"
OUTSIDE_WT="$TMP/outside-worktree"
git -C "$OUTSIDE_REPO" worktree add -q -b outside-branch "$OUTSIDE_WT" origin/main
if (cd "$OUTSIDE_REPO" && SVC_SESSION_ID="$SESSION" node "$ROOT/scripts/svc-ensure-worktree.mjs" --wi WI-OUTSIDE-01 --branch outside-branch --from origin/main --json) >"$TMP/outside.out" 2>"$TMP/outside.err"; then bad "registered worktree outside .worktrees was adopted"; else ok "registered worktree outside .worktrees is rejected"; fi

DUP_REPO="$TMP/duplicate-repo"
make_repo "$DUP_REPO"
git -C "$DUP_REPO" worktree add -q -b duplicate-branch "$DUP_REPO/.worktrees/one" origin/main
git -C "$DUP_REPO" worktree add --force --force -q "$DUP_REPO/.worktrees/two" duplicate-branch
if (cd "$DUP_REPO" && SVC_SESSION_ID="$SESSION" node "$ROOT/scripts/svc-ensure-worktree.mjs" --wi WI-DUPLICATE-01 --branch duplicate-branch --from origin/main --json) >"$TMP/duplicate.out" 2>"$TMP/duplicate.err"; then bad "duplicate branch registrations were silently selected"; else ok "duplicate branch registrations remain an ambiguous fail-closed conflict"; fi

STATE_REPO="$TMP/state-root-repo"
make_repo "$STATE_REPO"
STATE_WT="$STATE_REPO/.worktrees/state-path"
STATE_SESSION="019fe17e-7777-7cc3-902b-084b95218fe8"
git -C "$STATE_REPO" worktree add -q -b state-branch "$STATE_WT" origin/main
mkdir -p "$STATE_WT/.svc"
node --input-type=module - "$ROOT" "$STATE_WT" "$STATE_REPO" "$STATE_SESSION" <<'NODE'
import path from 'node:path'; import { pathToFileURL } from 'node:url';
const [root, worktree, repo, session] = process.argv.slice(2);
const claims = await import(pathToFileURL(path.join(root, 'hooks/lib/wi-claim.mjs')));
const result = claims.writeSessionBinding({ worktree_root: worktree, repo_root: repo, wi: 'WI-STATE-ROOT-01', branch: 'state-branch', session_id: session, role: 'mutating', host: 'codex' });
if (!result.ok) throw new Error(result.warning);
NODE
mkdir -p "$TMP/outside-authority"
ln -s "$TMP/outside-authority" "$STATE_REPO/.git/svc-authority-v2"
if (cd "$STATE_REPO" && SVC_SESSION_ID="$STATE_SESSION" node "$ROOT/scripts/svc-ensure-worktree.mjs" --wi WI-STATE-ROOT-01 --branch state-branch --from origin/main --authority-v2 --json) >"$TMP/state-root.out" 2>"$TMP/state-root.err"; then
  bad "symlinked default controller state root was accepted"
else
  if [[ -z "$(find "$TMP/outside-authority" -type f -print -quit)" ]]; then ok "controller state root symlink fails before external writes"; else bad "controller state escaped through a symlinked root"; fi
fi

ESCAPE_REPO="$TMP/escape-repo"
make_repo "$ESCAPE_REPO"
ESCAPE_WT="$ESCAPE_REPO/.worktrees/escape-path"
ESCAPE_STATE="$TMP/outside-state"
ESCAPE_SESSION="019fe17e-4444-7cc3-902b-084b95218fe8"
ESCAPE_WI="WI-ESCAPE-01"
git -C "$ESCAPE_REPO" worktree add -q -b escape-old "$ESCAPE_WT" origin/main
mkdir -p "$ESCAPE_STATE/claims" "$ESCAPE_STATE/bindings"
node --input-type=module - "$ESCAPE_WT" "$ESCAPE_REPO" "$ESCAPE_STATE" "$ESCAPE_WI" "$ESCAPE_SESSION" <<'NODE'
import crypto from 'node:crypto'; import fs from 'node:fs'; import path from 'node:path';
const [worktree, repo, state, wi, session] = process.argv.slice(2);
const now = new Date().toISOString();
const claimPath = path.join(worktree, '.svc', 'claims', `${wi}.claim.json`);
const claim = { schema_version: 1, wi, generation: 1, repo_root: repo, worktree_root: worktree, branch: 'escape-old', session_id: session, role: 'mutating', host: 'codex', hostname: 'fixture', started_at: now, renewed_at: now, ttl_hours: 24 };
const binding = { schema_version: 1, session_id: session, role: 'mutating', wi, repo_root: repo, worktree_root: worktree, branch: 'escape-old', claim_path: claimPath, created_at: now, updated_at: now, generation: 1 };
const bindingName = `${crypto.createHash('sha256').update(session).digest('hex').slice(0, 32)}.json`;
fs.writeFileSync(path.join(state, 'claims', `${wi}.claim.json`), `${JSON.stringify(claim, null, 2)}\n`);
fs.writeFileSync(path.join(state, 'bindings', bindingName), `${JSON.stringify(binding, null, 2)}\n`);
NODE
ln -s "$ESCAPE_STATE" "$ESCAPE_WT/.svc"
git -C "$ESCAPE_WT" branch -m escape-new
ESCAPE_BEFORE="$(sha256sum "$ESCAPE_STATE/claims/$ESCAPE_WI.claim.json" "$ESCAPE_STATE"/bindings/*.json)"
if (cd "$ESCAPE_REPO" && SVC_SESSION_ID="$ESCAPE_SESSION" node "$ROOT/scripts/svc-ensure-worktree.mjs" --wi "$ESCAPE_WI" --branch escape-new --from origin/main --json) >"$TMP/escape.out" 2>"$TMP/escape.err"; then
  bad "symlinked worktree state root was accepted"
else
  ESCAPE_AFTER="$(sha256sum "$ESCAPE_STATE/claims/$ESCAPE_WI.claim.json" "$ESCAPE_STATE"/bindings/*.json)"
  if [[ "$ESCAPE_BEFORE" == "$ESCAPE_AFTER" && ! -e "$ESCAPE_STATE/lane-tasks-$ESCAPE_WI.json" ]]; then ok "symlinked .svc fails before external state mutation"; else bad "symlinked .svc modified external authority state"; fi
fi

AMBIG_REPO="$TMP/ambiguous-repo"
make_repo "$AMBIG_REPO"
AMBIG_WT="$AMBIG_REPO/.worktrees/ambiguous-path"
AMBIG_WI="WI-AMBIGUOUS-01"
AMBIG_SESSION="019fe17e-5555-7cc3-902b-084b95218fe8"
AMBIG_FOREIGN="019fe17e-6666-7cc3-902b-084b95218fe8"
git -C "$AMBIG_REPO" worktree add -q -b ambiguous-old "$AMBIG_WT" origin/main
mkdir -p "$AMBIG_WT/.svc"
node --input-type=module - "$ROOT" "$AMBIG_WT" "$AMBIG_REPO" "$AMBIG_WI" "$AMBIG_SESSION" "$AMBIG_FOREIGN" <<'NODE'
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
const [root, worktree, repo, wi, session, foreign] = process.argv.slice(2);
const claims = await import(pathToFileURL(path.join(root, 'hooks/lib/wi-claim.mjs')));
const result = claims.writeSessionBinding({ worktree_root: worktree, repo_root: repo, wi, branch: 'ambiguous-old', session_id: session, role: 'mutating', host: 'codex' });
if (!result.ok) throw new Error(result.warning);
const claim = JSON.parse(fs.readFileSync(result.binding.claim_path, 'utf8'));
claim.session_token = foreign;
fs.writeFileSync(result.binding.claim_path, `${JSON.stringify(claim, null, 2)}\n`);
NODE
git -C "$AMBIG_WT" branch -m ambiguous-new
AMBIG_CLAIM="$AMBIG_WT/.svc/claims/$AMBIG_WI.claim.json"
AMBIG_BINDING="$(find "$AMBIG_WT/.svc/bindings" -maxdepth 1 -type f -name '*.json' -print -quit)"
AMBIG_BEFORE="$(sha256sum "$AMBIG_CLAIM" "$AMBIG_BINDING")"
if (cd "$AMBIG_REPO" && SVC_SESSION_ID="$AMBIG_SESSION" SVC_AUTHORITY_STATE_ROOT="$TMP/ambiguous-authority" node "$ROOT/scripts/svc-ensure-worktree.mjs" --wi "$AMBIG_WI" --branch ambiguous-new --from origin/main --authority-v2 --json) >"$TMP/ambiguous.out" 2>"$TMP/ambiguous.err"; then
  bad "ambiguous claim owners were repaired and promoted"
else
  AMBIG_AFTER="$(sha256sum "$AMBIG_CLAIM" "$AMBIG_BINDING")"
  if [[ "$AMBIG_BEFORE" == "$AMBIG_AFTER" && -z "$(find "$TMP/ambiguous-authority" -path '*/leases/*.json' -print -quit 2>/dev/null)" ]]; then ok "ambiguous owner identities fail before repair or v2 promotion"; else bad "ambiguous owner denial mutated authority state"; fi
fi
node --input-type=module - "$AMBIG_CLAIM" <<'NODE'
import fs from 'node:fs';
const file = process.argv[2];
const claim = JSON.parse(fs.readFileSync(file, 'utf8'));
delete claim.session_token;
claim.claimed_by = 'claude';
fs.writeFileSync(file, `${JSON.stringify(claim, null, 2)}\n`);
NODE
if (cd "$AMBIG_REPO" && SVC_SESSION_ID="$AMBIG_SESSION" SVC_AUTHORITY_STATE_ROOT="$TMP/ambiguous-authority" node "$ROOT/scripts/svc-ensure-worktree.mjs" --wi "$AMBIG_WI" --branch ambiguous-new --from origin/main --authority-v2 --json) >"$TMP/compat.out" 2>"$TMP/compat.err"; then ok "legacy non-session claimed_by label remains compatible"; else bad "legacy non-session label was misclassified as a second owner"; fi

if grep -Fq -- '--authority-v2' "$ROOT/hooks/codex/svc-codex-pretool-dispatcher.mjs"; then ok "Codex canonical bootstrap requests v2 promotion"; else bad "Codex bootstrap omits v2 promotion"; fi

INSTALLED_REPO="$TMP/installed-entrypoint-repo"
INSTALLED_SCRIPTS="$TMP/installed-scripts"
INSTALLED_SESSION="019fe17e-dddd-7cc3-902b-084b95218fe8"
make_repo "$INSTALLED_REPO"
ln -s "$ROOT/scripts" "$INSTALLED_SCRIPTS"
INSTALLED_RESULT="$(cd "$INSTALLED_REPO" && SVC_SESSION_ID="$INSTALLED_SESSION" node "$INSTALLED_SCRIPTS/svc-ensure-worktree.mjs" --wi WI-INSTALLED-ENTRYPOINT-01 --branch framework-installed-entrypoint --from origin/main --json)"
if node -e 'const r=JSON.parse(process.argv[1]);process.exit(r.created&&r.wi==="WI-INSTALLED-ENTRYPOINT-01"&&r.branch==="framework-installed-entrypoint"?0:1)' "$INSTALLED_RESULT"; then
  ok "symlinked installed scripts path executes the canonical bootstrap entrypoint"
else
  bad "symlinked installed scripts path silently skipped the bootstrap entrypoint"
fi

# WI-541 / WI-538 topology: a registered legacy worktree has user residue and
# no claim/binding directories. Canonical bootstrap creates only missing
# authority, preserves residue, and rejects a foreign live marker.
GEN0_REPO="$TMP/generation-zero"
GEN0_WT="$GEN0_REPO/.worktrees/framework-WI-538-offline-improvements"
GEN0_WI="WI-538"
GEN0_SESSION="019fe17e-eeee-7cc3-902b-084b95218fe8"
make_repo "$GEN0_REPO"
git -C "$GEN0_REPO" worktree add -q -b framework-WI-538-offline-improvements "$GEN0_WT" origin/main
mkdir -p "$GEN0_WT/.svc"
printf 'protected legacy residue\n' > "$GEN0_WT/.svc/operator-residue.txt"
GEN0_BEFORE="$(sha256sum "$GEN0_WT/.svc/operator-residue.txt" | cut -d' ' -f1)"
GEN0_RESULT="$(cd "$GEN0_REPO" && SVC_SESSION_ID="$GEN0_SESSION" SVC_AUTHORITY_STATE_ROOT="$TMP/gen0-authority" node "$ROOT/scripts/svc-ensure-worktree.mjs" --wi "$GEN0_WI" --branch framework-WI-538-offline-improvements --from origin/main --authority-v2 --json)"
if node -e 'const r=JSON.parse(process.argv[1]);process.exit(r.claim_generation===1&&r.authority_v2?.lease?.generation===1?0:1)' "$GEN0_RESULT" && [[ "$GEN0_BEFORE" == "$(sha256sum "$GEN0_WT/.svc/operator-residue.txt" | cut -d' ' -f1)" ]]; then
  ok "generation-zero WI-538 topology gains exact authority without deleting residue"
else
  bad "generation-zero adoption changed residue or failed to converge authority"
fi


# === WI-FW-HOOKS-SAFETY-01 T03/AC-3: dispatcher-level self-heal gate =========
echo "=== Tier 2: prompt-authority-gated self-heal (dispatcher) ==="
SH_ROOT="$ROOT"

make_sh_fixture() { # $1 dir-name -> echoes worktree path; fresh unbound single-graph worktree
  local base="$TMP/$1"
  make_repo "$base/repo"
  mkdir -m 700 -p "$base/runtime"
  local wt="$base/repo/.worktrees/wt-path"
  git -C "$base/repo" worktree add -q -b br-lane-"$1" "$wt" origin/main
  mkdir -p "$wt/.svc"
  node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({schema_version:1,wi:"WI-SH-01",lane:"framework",status:"in_progress",created:new Date().toISOString(),tasks:[{id:1,status:"in_progress",skill:"route-workflow",subject:"route",blocked_by:[]}]},null,2))' "$wt/.svc/lane-tasks-WI-SH-01.json"
  # route-workflow normally writes this; children guards require it post-binding
  node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({ts:new Date().toISOString(),bound_to:"user-request",request:"fixture",wi:"WI-SH-01",skill:null,guard_override_count:0}))' "$wt/.svc/session-contract.jsonl"
  echo "$wt"
}

sh_authority() { # $1 wt $2 runtime $3 session $4 turn $5 prompt
  printf '{"prompt":%s,"session_id":"%s","turn_id":"%s","cwd":"%s"}' \
    "$(node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$5")" \
    "$3" "$4" "$1" |
    SVC_CODEX_RUNTIME_DIR="$2" node "$ROOT/hooks/codex/svc-codex-prompt-authority.mjs" >/dev/null
}

sh_drive() { # $1 wt $2 runtime $3 session $4 turn $5 command
  printf '{"tool_name":"Bash","tool_input":{"command":%s},"session_id":"%s","turn_id":"%s","cwd":"%s"}' \
    "$(node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$5")" \
    "$3" "$4" "$1" |
    SVC_CODEX_RUNTIME_DIR="$2" SVC_HOST=codex node "$ROOT/hooks/codex/svc-codex-pretool-dispatcher.mjs"
}
SH_SESSION="session-sh-heal-11111111"

# CASE 1: fresh positive intent -> exact adoption + original mutation allowed
# The mutation runs inside an active skill context produced by the REAL loader,
# mirroring validate-codex-execution-integrity.sh fixture conventions.
WT1="$(make_sh_fixture sh-fresh)"
env -u GROK_SESSION_ID -u XAI_API_KEY -u GROK_HOME -u GROK_CLI -u SVC_HOST \
  NODE_ENV=test SVC_CODEX_TEST_MODE=1 SVC_CODEX_TEST_REPO="$WT1" SVC_CODEX_RUNTIME_DIR="$TMP/sh-fresh/runtime" CODEX_SESSION_ID="$SH_SESSION" CODEX_THREAD_ID="$SH_SESSION" CODEX_SKILLS_DIR="$ROOT/skills" \
  node "$ROOT/scripts/codex-load-skill.mjs" --graph "$WT1/.svc/lane-tasks-WI-SH-01.json" --task 1 --skill route-workflow --turn t1 >/dev/null
sh_authority "$WT1" "$TMP/sh-fresh/runtime" "$SH_SESSION" t1 "work on WI-SH-01 to finish the lane"
unset GROK_SESSION_ID XAI_API_KEY GROK_HOME GROK_CLI SVC_HOST
NODE_ENV=test
SVC_CODEX_TEST_MODE=1
SVC_CODEX_TEST_REPO="$WT1"
CODEX_SKILLS_DIR="$ROOT/skills"
CODEX_SESSION_ID="$SH_SESSION"
CODEX_THREAD_ID="$SH_SESSION"
SVC_CODEX_RUNTIME_DIR="$TMP/sh-fresh/runtime"
export NODE_ENV SVC_CODEX_TEST_MODE SVC_CODEX_TEST_REPO CODEX_SKILLS_DIR CODEX_SESSION_ID CODEX_THREAD_ID SVC_CODEX_RUNTIME_DIR
SH_OUT="$(sh_drive "$WT1" "$TMP/sh-fresh/runtime" "$SH_SESSION" t1 "touch .svc/self-heal-probe")"
unset NODE_ENV SVC_CODEX_TEST_MODE SVC_CODEX_TEST_REPO CODEX_SKILLS_DIR CODEX_SESSION_ID CODEX_THREAD_ID
if printf '%s' "$SH_OUT" | grep -q '"permissionDecision":"allow"'; then
  ok "fresh positive intent self-heals the exact worktree and allows the original mutation"
else bad "fresh positive intent did not self-heal ($(printf '%s' "$SH_OUT" | head -c 200))"; fi
[[ -f "$WT1/.svc/claims/WI-SH-01.claim.json" ]] && ok "self-heal persisted an exact claim for the adopting session" || bad "no claim after self-heal"

# CASE 2: negated intent -> actionable ineligible denial, byte-identical state
WT2="$(make_sh_fixture sh-neg)"
NEG_BEFORE="$(find "$WT2/.svc" -type f | sort | xargs sha256sum | sha256sum)"
sh_authority "$WT2" "$TMP/sh-neg/runtime" "$SH_SESSION" t1 "do not work on WI-SH-01"
SH_OUT="$(sh_drive "$WT2" "$TMP/sh-neg/runtime" "$SH_SESSION" t1 "touch .svc/self-heal-probe")"
printf '%s' "$SH_OUT" | grep -q 'AUTH_BINDING_MISSING_SELF_HEAL_INELIGIBLE' && ok "negated intent denies with an actionable reason code" || bad "negated intent wrong denial ($(printf '%s' "$SH_OUT" | head -c 160))"
NEG_AFTER="$(find "$WT2/.svc" -type f | sort | xargs sha256sum | sha256sum)"
[[ "$NEG_AFTER" == "$NEG_BEFORE" ]] && ok "negated-intent denial leaves authority state byte-identical" || bad "denial mutated state"

# CASE 3: stale turn id -> not eligible
WT3="$(make_sh_fixture sh-stale)"
sh_authority "$WT3" "$TMP/sh-stale/runtime" "$SH_SESSION" t1 "work on WI-SH-01"
SH_OUT="$(sh_drive "$WT3" "$TMP/sh-stale/runtime" "$SH_SESSION" t9 "touch .svc/self-heal-probe")"
printf '%s' "$SH_OUT" | grep -q 'STALE_TURN' && ok "stale-turn intent is not eligible for self-heal" || bad "stale turn unexpectedly eligible ($(printf '%s' "$SH_OUT" | head -c 160))"

# CASE 4: foreign live claim -> refused without takeover or repair
WT4="$(make_sh_fixture sh-foreign)"
mkdir -p "$WT4/.svc/claims"
node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({schema_version:1,wi:"WI-SH-01",session_id:"session-foreign-live-9999999",role:"mutating",claimed_at:new Date().toISOString(),renewed_at:new Date().toISOString()}))' "$WT4/.svc/claims/WI-SH-01.claim.json"
FOREIGN_BEFORE="$(find "$WT4/.svc" -type f | sort | xargs sha256sum | sha256sum)"
sh_authority "$WT4" "$TMP/sh-foreign/runtime" "$SH_SESSION" t1 "work on WI-SH-01"
SH_OUT="$(sh_drive "$WT4" "$TMP/sh-foreign/runtime" "$SH_SESSION" t1 "touch .svc/self-heal-probe")"
printf '%s' "$SH_OUT" | grep -qiE 'self-heal refused|conflict|foreign|owned by' && ok "foreign live claim refuses self-heal without takeover" || bad "foreign claim not refused ($(printf '%s' "$SH_OUT" | head -c 160))"
FOREIGN_AFTER="$(find "$WT4/.svc" -type f | sort | xargs sha256sum | sha256sum)"
[[ "$FOREIGN_AFTER" == "$FOREIGN_BEFORE" ]] && ok "foreign-owner refusal leaves state byte-identical" || bad "refusal mutated foreign state"

# EXTREV-EXEC-012: a valid-SHAPED graph whose INTERNAL wi differs from the
# requested WI must never be adopted.
WT5="$(make_sh_fixture sh-wi-mismatch)"
node -e 'const fs=require("fs");const p=process.argv[1];const g=JSON.parse(fs.readFileSync(p,"utf8"));g.wi="WI-DIFFERENT";fs.writeFileSync(p,JSON.stringify(g,null,2))' "$WT5/.svc/lane-tasks-WI-SH-01.json"
MISMATCH_OUT="$(sh_drive "$WT5" "$TMP/sh-wi-mismatch/runtime" "session-sh-mismatch-01" t1 "touch .svc/self-heal-probe")"
printf '%s' "$MISMATCH_OUT" | grep -qiE 'SELF_HEAL_INELIGIBLE|AUTH_BINDING_MISSING|no registered' && ok "graph with mismatched internal WI is not adoptable" || bad "mismatched-WI graph adopted ($(printf '%s' "$MISMATCH_OUT" | head -c 160))"

# EXTREV-EXEC-011: negated intent in the WI-bearing sentence never self-heals.
NEG_OUT="$(sh_drive "$WT5" "$TMP/sh-wi-mismatch/runtime" "session-sh-neg-000001" t2 "do not continue WI-SH-01")"
printf '%s' "$NEG_OUT" | grep -qiE 'INTENT_NOT_POSITIVE|AUTH_BINDING_MISSING' && ok "negated prompt cannot activate self-heal" || bad "negated prompt triggered self-heal path ($(printf '%s' "$NEG_OUT" | head -c 160))"

echo ""
echo "existing worktree self-heal: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]
