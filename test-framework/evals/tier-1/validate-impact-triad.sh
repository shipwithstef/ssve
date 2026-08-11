#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CLASSIFIER="$ROOT/scripts/classify-change-risk.mjs"
GUARD="$ROOT/hooks/svc-impact-triad-guard.mjs"
QUICK="$ROOT/scripts/quick-fix-eligibility.mjs"
PASS=0
FAIL=0

ok() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL + 1)); echo "  ✗ $1"; }
expect_tier() {
  local want="$1" label="$2" out got
  out="$(node "$CLASSIFIER" --staged --json 2>/dev/null)" || { bad "$label classifier runs"; return; }
  got="$(node -e 'const j=JSON.parse(process.argv[1]); process.stdout.write(j.tier)' "$out")"
  [[ "$got" == "$want" ]] && ok "$label -> $want" || bad "$label expected $want got $got"
}
reset_case() {
  G restore --source=HEAD --staged --worktree .
  G clean -fdq
  rm -rf .svc/impact-triad .svc/receipts
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
G() { git -C "$TMP" "$@"; }
cd "$TMP"
G init -q
G config user.name test
G config user.email test@example.com
mkdir -p docs src auth billing db migrations shared/components hooks release .svc/bindings .svc/claims
printf 'baseline\n' > docs/readme.md
printf 'export const value = 1;\n' > src/app.js
printf 'export const policy = true;\n' > auth/policy.js
printf 'export const price = 1;\n' > billing/price.js
printf 'create table sample(id int);\n' > db/schema.sql
printf 'alter table sample add name text;\n' > migrations/001.sql
printf 'export const Button = () => null;\n' > shared/components/Button.js
printf '{"enabled":false}\n' > flags.json
printf 'export const hook = true;\n' > hooks/test.mjs
printf '{"version":1}\n' > release/version.json
cat > .svc/lane-tasks-WI-481.json <<'JSON'
{"wi":"WI-481","lane":"framework","status":"in_progress","tasks":[{"id":1,"skill":"execute-changeset","metadata":{"skill":"execute-changeset","wi":"WI-481"},"status":"in_progress","blocked_by":[],"skill_receipt":{"skill":"execute-changeset","loaded_at":"2026-07-15T00:00:00Z","loaded_via":"test"}},{"id":2,"skill":"review-exec","metadata":{"skill":"review-exec","wi":"WI-481"},"status":"pending","blocked_by":[1]}]}
JSON
printf '.svc/bindings/\n.svc/claims/\n.svc/impact-triad/\n.svc/receipts/\n' >> .git/info/exclude
G add .
G commit -qm baseline

SESSION="019f6001-5463-7dc0-a1f5-73104831606a"
BRANCH="$(G branch --show-current)"
CLAIM="$TMP/.svc/claims/WI-481.claim.json"
cat > "$CLAIM" <<JSON
{"schema_version":1,"wi":"WI-481","generation":1,"repo_root":"$TMP","worktree_root":"$TMP","branch":"$BRANCH","session_id":"$SESSION","role":"mutating","started_at":"2026-07-15T00:00:00Z","renewed_at":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","ttl_hours":24}
JSON
cat > .svc/bindings/test.json <<JSON
{"schema_version":1,"session_id":"$SESSION","role":"mutating","wi":"WI-481","repo_root":"$TMP","worktree_root":"$TMP","branch":"$BRANCH","claim_path":"$CLAIM","created_at":"2026-07-15T00:00:00Z","updated_at":"2026-07-15T00:00:00Z","generation":1}
JSON

printf 'copy edit\n' >> docs/readme.md; G add docs/readme.md; expect_tier cosmetic "documentation copy"
reset_case
printf 'export function changed() { return 2; }\n' >> src/app.js; G add src/app.js; expect_tier logic "executable logic"

for path in auth/policy.js billing/price.js db/schema.sql migrations/001.sql shared/components/Button.js flags.json hooks/test.mjs release/version.json; do
  reset_case
  printf '\n' >> "$path"
  G add "$path"
  expect_tier high "protected $path"
done

reset_case
G mv auth/policy.js docs/policy.txt
G add -A
expect_tier high "rename inherits source risk"

reset_case
G rm -q release/version.json
expect_tier high "deletion inherits path risk"

reset_case
mkdir -p assets
printf '\000\001\002\003' > assets/blob.bin
G add assets/blob.bin
expect_tier high "binary ambiguity"

write_receipt() {
  local tier="$1" reviewer="$2" proof="$3" coverage="$4" session="${5:-$SESSION}"
  local classified
  classified="$(node "$CLASSIFIER" --staged --json)"
  mkdir -p .svc/impact-triad/WI-481
  CLASSIFIED="$classified" ROOT_PATH="$TMP" SESSION_ID="$session" TIER="$tier" REVIEWER="$reviewer" PROOF="$proof" COVERAGE="$coverage" node --input-type=module <<'NODE'
import fs from 'node:fs';
const c=JSON.parse(process.env.CLASSIFIED);
const pass=process.env.COVERAGE === 'pass';
const receipt={
  schema_version:process.env.REVIEWER==='deferred'?2:1, wi:'WI-481', session_id:process.env.SESSION_ID,
  worktree_root:process.env.ROOT_PATH,
  task_graph:`${process.env.ROOT_PATH}/.svc/lane-tasks-WI-481.json`, task_id:1,
  diff_sha256:c.sha256, risk_tier:process.env.TIER, risk_reasons:c.reasons,
  breaks_what:{answer:'changed fixture and mapped callers',sources:['src/app.js'],evidence:['git diff --cached']},
  intended_behavior:{answer:'preserve the specified fixture behavior',sources:['docs/specs/work-items/WI-481.md#Acceptance-Criteria'],evidence:['validate-impact-triad.sh']},
  product_surface:{answer:'headless framework commit boundary',sources:['references/change-impact-triad.md'],evidence:['controlled guard payload']},
  coverage_tasks:[{id:'coverage-1',status:pass?'completed':'blocked',owner:'WI-481 task 1',blocked_by:[],validation:'validate-impact-triad.sh'}],
  independent_review:process.env.TIER==='high' && process.env.REVIEWER==='deferred'
    ? {status:'deferred-to-final',executor_family:'openai',reviewer_family:'n/a',artifacts:[],final_review_task_id:2,plan_digest:'a'.repeat(64)}
    : {status:process.env.TIER==='high'?'pass':'n/a',executor_family:'openai',reviewer_family:process.env.REVIEWER,artifacts:process.env.TIER==='high'?['docs/readme.md']:[]},
  runtime_proof:{status:'pass',kind:process.env.PROOF,artifacts:['docs/readme.md']},
  subsumed_by:[{phase:'P3-Verification',artifacts:['validate-impact-triad.sh']}],
  created_at:new Date().toISOString()
};
fs.writeFileSync('.svc/impact-triad/WI-481/task-1.json',JSON.stringify(receipt,null,2));
NODE
}

reset_case
printf '\nexport const second = true;\n' >> hooks/test.mjs
G add hooks/test.mjs
if SVC_SESSION_ID="$SESSION" node "$GUARD" --pre-commit >/dev/null 2>&1; then bad "missing high receipt denied"; else ok "missing high receipt denied"; fi

write_receipt high openai behavioral pass
if SVC_SESSION_ID="$SESSION" node "$GUARD" --pre-commit >/dev/null 2>&1; then bad "self-review denied"; else ok "self-review denied"; fi

write_receipt high anthropic static pass
if SVC_SESSION_ID="$SESSION" node "$GUARD" --pre-commit >/dev/null 2>&1; then bad "static-only high proof denied"; else ok "static-only high proof denied"; fi

write_receipt high anthropic behavioral fail
if SVC_SESSION_ID="$SESSION" node "$GUARD" --pre-commit >/dev/null 2>&1; then bad "blocked coverage denied"; else ok "blocked coverage denied"; fi

write_receipt high anthropic behavioral pass wrong-session
if SVC_SESSION_ID="$SESSION" node "$GUARD" --pre-commit >/dev/null 2>&1; then bad "foreign session denied"; else ok "foreign session denied"; fi

write_receipt high anthropic behavioral pass
guard_out="$(SVC_SESSION_ID="$SESSION" node "$GUARD" --pre-commit 2>&1)" && guard_rc=0 || guard_rc=$?
if [[ "$guard_rc" -eq 0 ]]; then ok "owned high receipt with behavioral proof passes"; else bad "owned high receipt with behavioral proof passes ($guard_out)"; fi

write_receipt high deferred behavioral pass
guard_out="$(SVC_SESSION_ID="$SESSION" node "$GUARD" --pre-commit 2>&1)" && guard_rc=0 || guard_rc=$?
if [[ "$guard_rc" -eq 0 ]]; then ok "high receipt defers independent review to exact final graph task"; else bad "high receipt defers independent review to exact final graph task ($guard_out)"; fi
node -e 'const fs=require("fs");const p=".svc/lane-tasks-WI-481.json";const j=JSON.parse(fs.readFileSync(p));j.tasks=j.tasks.filter(t=>t.skill!=="review-exec");fs.writeFileSync(p,JSON.stringify(j))'
if SVC_SESSION_ID="$SESSION" node "$GUARD" --pre-commit >/dev/null 2>&1; then bad "deferral without final review task denied"; else ok "deferral without final review task denied"; fi
G restore .svc/lane-tasks-WI-481.json

node -e 'const fs=require("fs");const p=".svc/impact-triad/WI-481/task-1.json";const j=JSON.parse(fs.readFileSync(p));j.unexpected=true;fs.writeFileSync(p,JSON.stringify(j))'
if SVC_SESSION_ID="$SESSION" node "$GUARD" --pre-commit >/dev/null 2>&1; then bad "unknown receipt fields denied"; else ok "unknown receipt fields denied"; fi
write_receipt high anthropic behavioral pass
node -e 'const fs=require("fs");const p=".svc/impact-triad/WI-481/task-1.json";const j=JSON.parse(fs.readFileSync(p));j.coverage_tasks=[];fs.writeFileSync(p,JSON.stringify(j))'
if SVC_SESSION_ID="$SESSION" node "$GUARD" --pre-commit >/dev/null 2>&1; then bad "empty coverage mapping denied"; else ok "empty coverage mapping denied"; fi
write_receipt high anthropic behavioral pass
node -e 'const fs=require("fs");const p=".svc/impact-triad/WI-481/task-1.json";const j=JSON.parse(fs.readFileSync(p));j.runtime_proof.artifacts=["missing-proof.log"];fs.writeFileSync(p,JSON.stringify(j))'
if SVC_SESSION_ID="$SESSION" node "$GUARD" --pre-commit >/dev/null 2>&1; then bad "missing proof artifact denied"; else ok "missing proof artifact denied"; fi

node -e 'const fs=require("fs");const p=".svc/impact-triad/WI-481/task-1.json";const j=JSON.parse(fs.readFileSync(p));j.task_id=99;fs.writeFileSync(p,JSON.stringify(j))'
if SVC_SESSION_ID="$SESSION" node "$GUARD" --pre-commit >/dev/null 2>&1; then bad "foreign task denied"; else ok "foreign task denied"; fi
write_receipt high anthropic behavioral pass
node -e 'const fs=require("fs");const p=".svc/impact-triad/WI-481/task-1.json";const j=JSON.parse(fs.readFileSync(p));j.risk_reasons=["forged"];fs.writeFileSync(p,JSON.stringify(j))'
if SVC_SESSION_ID="$SESSION" node "$GUARD" --pre-commit >/dev/null 2>&1; then bad "forged risk reasons denied"; else ok "forged risk reasons denied"; fi
write_receipt high anthropic behavioral pass
mv .svc/impact-triad/WI-481 "$TMP/outside-receipt"
ln -s "$TMP/outside-receipt" .svc/impact-triad/WI-481
if SVC_SESSION_ID="$SESSION" node "$GUARD" --pre-commit >/dev/null 2>&1; then bad "symlinked receipt parent denied"; else ok "symlinked receipt parent denied"; fi
rm .svc/impact-triad/WI-481
mv "$TMP/outside-receipt" .svc/impact-triad/WI-481

hook_allow="$(printf '%s' '{"tool_name":"Bash","tool_input":{"command":"git status"}}' | SVC_SESSION_ID="$SESSION" node "$GUARD")"
[[ "$hook_allow" == '{}' ]] && ok "arbitrary Bash is outside impact boundary" || bad "arbitrary Bash is outside impact boundary"
rm -rf .svc/impact-triad
hook_deny="$(printf '%s' '{"tool_name":"Bash","tool_input":{"command":"git commit -m test"}}' | SVC_SESSION_ID="$SESSION" node "$GUARD")"
printf '%s' "$hook_deny" | grep -q 'permissionDecision.*deny' && ok "commit command receives early deny" || bad "commit command receives early deny"
hook_deny="$(printf '%s' '{"tool_name":"Bash","tool_input":{"command":"git -c user.name=test commit --no-verify -m test"}}' | SVC_SESSION_ID="$SESSION" node "$GUARD")"
printf '%s' "$hook_deny" | grep -q 'permissionDecision.*deny' && ok "git prefix options cannot bypass commit boundary" || bad "git prefix options cannot bypass commit boundary"
write_receipt high anthropic behavioral pass

printf '// drift\n' >> hooks/test.mjs; G add hooks/test.mjs
if SVC_SESSION_ID="$SESSION" node "$GUARD" --pre-commit >/dev/null 2>&1; then bad "stale diff receipt denied"; else ok "stale diff receipt denied"; fi

reset_case
printf 'another copy edit\n' >> docs/readme.md; G add docs/readme.md
if SVC_SESSION_ID="$SESSION" node "$QUICK" >/dev/null 2>&1; then bad "quick-fix requires cosmetic triad receipt"; else ok "quick-fix requires cosmetic triad receipt"; fi
write_receipt cosmetic n/a static pass
quick_out="$(SVC_SESSION_ID="$SESSION" node "$QUICK" 2>&1)" && quick_rc=0 || quick_rc=$?
if [[ "$quick_rc" -eq 0 ]]; then ok "cosmetic quick-fix with owned static receipt passes"; else bad "cosmetic quick-fix with owned static receipt passes ($quick_out)"; fi

reset_case
printf 'export function changed() { return 2; }\n' >> src/app.js; G add src/app.js
write_receipt logic n/a mapped-test pass
guard_out="$(SVC_SESSION_ID="$SESSION" node "$GUARD" --pre-commit 2>&1)" && guard_rc=0 || guard_rc=$?
if [[ "$guard_rc" -eq 0 ]]; then ok "logic receipt requires and accepts mapped test"; else bad "logic receipt requires and accepts mapped test ($guard_out)"; fi

reset_case
empty_update="$(printf '%s' '{"tool_name":"TaskUpdate","tool_input":{"status":"completed"}}' | node "$GUARD")"
[[ "$empty_update" == '{}' ]] && ok "TaskUpdate with no staged mutation allows" || bad "TaskUpdate with no staged mutation allows"

printf '\n' >> hooks/test.mjs; G add hooks/test.mjs
rm -rf .svc/impact-triad
payload_deny="$(printf '%s' "{\"session_id\":\"$SESSION\",\"tool_name\":\"TaskUpdate\",\"tool_input\":{\"status\":\"completed\"}}" | env -u SVC_SESSION_ID node "$GUARD")"
printf '%s' "$payload_deny" | grep -q 'permissionDecision.*deny' && ok "TaskUpdate staged mutation requires receipt using payload session" || bad "TaskUpdate staged mutation requires receipt using payload session"
write_receipt high anthropic behavioral pass
payload_allow="$(printf '%s' "{\"session_id\":\"$SESSION\",\"tool_name\":\"TaskUpdate\",\"tool_input\":{\"status\":\"completed\"}}" | env -u SVC_SESSION_ID node "$GUARD")"
[[ "$payload_allow" == '{}' ]] && ok "payload-only session identity resolves owned receipt" || bad "payload-only session identity resolves owned receipt"

reset_case
printf '\n' >> hooks/test.mjs
node -e 'const fs=require("fs");const p=".svc/lane-tasks-WI-481.json";const j=JSON.parse(fs.readFileSync(p));j.tasks[0].status="completed";fs.writeFileSync(p,JSON.stringify(j))'
G add hooks/test.mjs .svc/lane-tasks-WI-481.json
rm -rf .svc/impact-triad
if SVC_SESSION_ID="$SESSION" node "$GUARD" --pre-commit >/dev/null 2>&1; then bad "completed-task closeout cannot bypass missing receipt"; else ok "completed-task closeout cannot bypass missing receipt"; fi
write_receipt high anthropic behavioral pass
if SVC_SESSION_ID="$SESSION" node "$GUARD" --pre-commit >/dev/null 2>&1; then ok "completed-task closeout accepts exact receipt"; else bad "completed-task closeout accepts exact receipt"; fi

reset_case
printf '\n' >> hooks/test.mjs
node -e 'const fs=require("fs");const p=".svc/lane-tasks-WI-481.json";const j=JSON.parse(fs.readFileSync(p));j.tasks.push({id:2,skill:"execute-changeset",status:"in_progress"});fs.writeFileSync(p,JSON.stringify(j))'
G add hooks/test.mjs .svc/lane-tasks-WI-481.json
if SVC_SESSION_ID="$SESSION" node "$GUARD" --pre-commit >/dev/null 2>&1; then bad "multiple active tasks fail closed"; else ok "multiple active tasks fail closed"; fi

PLAIN="$TMP/plain-repo"
mkdir -p "$PLAIN"
git -C "$PLAIN" init -q
git -C "$PLAIN" config user.name test
git -C "$PLAIN" config user.email test@example.com
printf 'plain\n' > "$PLAIN/file.txt"
git -C "$PLAIN" add file.txt
plain_hook="$(cd "$PLAIN" && printf '%s' '{"tool_name":"Bash","tool_input":{"command":"git commit -m plain"}}' | node "$GUARD")"
[[ "$plain_hook" == '{}' ]] && ok "plain non-svc repository is outside governance" || bad "plain non-svc repository is outside governance"

reset_case
mkdir -p config src/rbac src/hooks docs/specs
printf '{"timeout":30000}\n' > config/settings.json; G add config/settings.json; expect_tier logic "behavior-bearing JSON config"
reset_case
mkdir -p src/rbac
printf 'export const guard = true;\n' > src/rbac/guard.ts; G add src/rbac/guard.ts; expect_tier high "RBAC guard protected family"
reset_case
mkdir -p src/hooks
printf 'export const useThing = () => true;\n' > src/hooks/useThing.ts; G add src/hooks/useThing.ts; expect_tier logic "product hook is logic not host-hook high"
reset_case
mkdir -p docs/specs
printf '# conversion notes\n' > docs/specs/brownfield-conversion-notes.md; G add docs/specs/brownfield-conversion-notes.md; expect_tier cosmetic "conversion prose avoids release substring false positive"
reset_case
printf 'flow A => flow B\n' >> docs/readme.md; G add docs/readme.md; expect_tier cosmetic "markdown arrow stays cosmetic"

cd "$ROOT"
grep -q 'svc-impact-triad-guard' scripts/wire-hooks.mjs && ok "shared host wiring includes impact guard" || bad "shared host wiring includes impact guard"
python3 - "$ROOT/scripts/wire-codex-hooks.mjs" <<'PY' && ok "Codex impact guard follows exact skill authority" || bad "Codex impact guard follows exact skill authority"
import sys
s=open(sys.argv[1]).read()
raise SystemExit(0 if s.index('svc-skill-load-enforcer') < s.index('svc-impact-triad-guard') < s.index('entries.SessionStart') else 1)
PY
[[ -x hooks/git/pre-commit.d/25-impact-triad ]] && ok "executable pre-commit impact slot exists" || bad "executable pre-commit impact slot exists"
grep -q 'REQUIRED_SLOTS.*25-impact-triad' scripts/install-git-hooks.mjs && ok "git hook installer requires impact slot" || bad "git hook installer requires impact slot"
grep -q 'Universal Assurance Floor: Change Impact Triad' DOCTRINE.md && ok "doctrine carries universal assurance floor" || bad "doctrine carries universal assurance floor"
grep -q 'Universal change-impact routing' skills/route-workflow/SKILL.md && ok "router carries impact classification" || bad "router carries impact classification"
grep -q 'impact-triad subsumption receipt' skills/diagnose-bug/SKILL.md && ok "diagnose-bug carries subsumption" || bad "diagnose-bug carries subsumption"
node -e 'JSON.parse(require("fs").readFileSync("schemas/change-impact-triad.schema.json"))' && ok "receipt schema parses" || bad "receipt schema parses"

echo "impact triad: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]
