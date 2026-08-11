#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0
fail=0

check() {
  local label="$1"
  shift
  if "$@" >"$TMP/check.out" 2>&1; then
    echo "  ✓ $label"
    pass=$((pass + 1))
  else
    echo "  ✗ $label"
    cat "$TMP/check.out"
    fail=$((fail + 1))
  fi
}

check_fail() {
  local label="$1"
  shift
  if "$@" >"$TMP/check.out" 2>&1; then
    echo "  ✗ $label"
    cat "$TMP/check.out"
    fail=$((fail + 1))
  else
    echo "  ✓ $label"
    pass=$((pass + 1))
  fi
}

FIX="$TMP/fixture"
mkdir -p "$FIX/docs/specs/work-items" "$FIX/src/pages" "$FIX/src/hooks" "$FIX/docs" "$FIX/.svc/dispatch"

cat >"$FIX/src/hooks/useShared.ts" <<'EOF'
export function useShared() {
  return true;
}
EOF

cat >"$FIX/src/pages/A.ts" <<'EOF'
import { useShared } from '../hooks/useShared';
export const a = useShared();
EOF

cat >"$FIX/src/pages/B.ts" <<'EOF'
import { useShared } from '../hooks/useShared';
export const b = useShared();
EOF

cat >"$FIX/src/pages/C.ts" <<'EOF'
export const c = 1;
EOF

cat >"$FIX/src/pages/D.ts" <<'EOF'
export const d = 1;
EOF

cat >"$FIX/src/pages/E.ts" <<'EOF'
import { c } from './C';
export const e = c;
EOF

cat >"$FIX/docs/a.md" <<'EOF'
# A
EOF

cat >"$FIX/docs/b.md" <<'EOF'
# B
EOF

cat >"$FIX/package.json" <<'EOF'
{"scripts":{"test":"true"}}
EOF

cat >"$FIX/docs/specs/work-items/WI-001.md" <<'EOF'
# WI-001: Touch A

**Status:** backlog

## Affected Files
- src/pages/A.ts
EOF

cat >"$FIX/docs/specs/work-items/WI-002.md" <<'EOF'
# WI-002: Touch B

**Status:** backlog

## Affected Files
- src/pages/B.ts
EOF

cat >"$FIX/docs/specs/work-items/WI-003.md" <<'EOF'
# WI-003: Touch docs

**Status:** backlog

## Affected Files
- docs/a.md
EOF

cat >"$FIX/docs/specs/work-items/WI-004.md" <<'EOF'
# WI-004: Touch C

**Status:** backlog

## Affected Files
- src/pages/C.ts
EOF

cat >"$FIX/docs/specs/work-items/WI-005.md" <<'EOF'
# WI-005: Touch package

**Status:** backlog

## Affected Files
- package.json
EOF

cat >"$FIX/docs/specs/work-items/WI-006.md" <<'EOF'
# WI-006: Unknown scope

**Status:** backlog

No file paths yet.
EOF

cat >"$FIX/docs/specs/work-items/WI-007.md" <<'EOF'
# WI-007: Touch D

**Status:** backlog

## Affected Files
- src/pages/D.ts
EOF

cat >"$FIX/docs/specs/work-items/WI-008.md" <<'EOF'
# WI-008: High visual work

**Type:** feature
**Status:** backlog
**Severity:** high

## Affected Files
- src/pages/C.ts
EOF

echo "=== Tier 1: Parallel WI Dispatch ==="

check "planner syntax valid" node --check "$ROOT/scripts/plan-parallel-wi-dispatch.mjs"
check "merge-back validator syntax valid" node --check "$ROOT/scripts/validate-parallel-merge-back.mjs"

check "planner creates fixture wave plan" node "$ROOT/scripts/plan-parallel-wi-dispatch.mjs" --root "$FIX" --wis WI-003,WI-004 --out .svc/parallel-dispatch-test.json
check "non-conflicting WIs share a parallel wave" node -e '
const fs=require("fs");
const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
if (!p.dispatchable) throw new Error("plan not dispatchable");
if (!p.waves.some(w => w.parallel && w.tasks.some(t=>t.wi==="WI-003") && w.tasks.some(t=>t.wi==="WI-004"))) throw new Error("missing parallel wave");
' "$FIX/.svc/parallel-dispatch-test.json"

check "dependency overlap serializes WIs" node "$ROOT/scripts/plan-parallel-wi-dispatch.mjs" --root "$FIX" --wis WI-001,WI-002 --out .svc/parallel-dispatch-conflict.json
check "conflicting dependency WIs do not share a wave" node -e '
const fs=require("fs");
const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const waves=p.waves.filter(w => w.tasks.some(t=>t.wi==="WI-001"||t.wi==="WI-002"));
if (waves.length !== 2) throw new Error(`expected 2 waves, got ${waves.length}`);
for (const w of p.waves) {
  const ids=w.tasks.map(t=>t.wi);
  if (ids.includes("WI-001") && ids.includes("WI-002")) throw new Error("conflicting WIs share wave");
}
' "$FIX/.svc/parallel-dispatch-conflict.json"

check "shared config serializes with other WIs" node "$ROOT/scripts/plan-parallel-wi-dispatch.mjs" --root "$FIX" --wis WI-003,WI-005 --out .svc/parallel-dispatch-shared.json
check "shared config WI is isolated" node -e '
const fs=require("fs");
const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const sharedWave=p.waves.find(w => w.tasks.some(t=>t.wi==="WI-005"));
if (!sharedWave || sharedWave.tasks.length !== 1) throw new Error("shared config task was not isolated");
' "$FIX/.svc/parallel-dispatch-shared.json"

check "unknown scope blocks dispatch" node "$ROOT/scripts/plan-parallel-wi-dispatch.mjs" --root "$FIX" --wis WI-006 --out .svc/parallel-dispatch-blocked.json
check "blocked plan records scope unknown" node -e '
const fs=require("fs");
const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
if (p.dispatchable) throw new Error("unknown scope plan should not be dispatchable");
if (!p.dispatch_blockers.some(b=>b.wi==="WI-006" && b.reason==="scope-unknown")) throw new Error("missing scope blocker");
' "$FIX/.svc/parallel-dispatch-blocked.json"

check "four independent WIs choose headless transport" node "$ROOT/scripts/plan-parallel-wi-dispatch.mjs" --root "$FIX" --wis WI-003,WI-004,WI-007,WI-001 --out .svc/parallel-dispatch-headless.json
check "headless transport appears for 4-WI dispatch" node -e '
const fs=require("fs");
const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const transports=p.waves.flatMap(w=>w.tasks.map(t=>t.transport));
if (!transports.includes("headless-worker")) throw new Error(`expected headless-worker, got ${transports.join(",")}`);
' "$FIX/.svc/parallel-dispatch-headless.json"

check "planner records model routing and dependency confidence" node "$ROOT/scripts/plan-parallel-wi-dispatch.mjs" --root "$FIX" --wis WI-008 --out .svc/parallel-dispatch-model.json
check "model routing and reverse import dependency are present" node -e '
const fs=require("fs");
const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const t=p.waves[0].tasks[0];
if (!t.worker_model || !t.worker_model.rationale) throw new Error("missing worker_model rationale");
if (!t.dependency_files.includes("src/pages/E.ts")) throw new Error(`missing reverse import dependency: ${t.dependency_files.join(",")}`);
if (!t.dependency_confidence) throw new Error("missing dependency confidence");
' "$FIX/.svc/parallel-dispatch-model.json"

cat >"$FIX/.svc/dispatch/WI-003.result.json" <<'EOF'
{
  "wi": "WI-003",
  "status": "success",
  "worker_summary": "Updated doc A.",
  "changed_files": ["docs/a.md"],
  "validation_evidence": [{"command": "npm test", "result": "PASS"}],
  "clean_worktree": true,
  "parent_graph_mutation": {"updated": true, "path": ".svc/lane-tasks-WI-003.json"}
}
EOF

cat >"$FIX/.svc/dispatch/WI-004.result.json" <<'EOF'
{
  "wi": "WI-004",
  "status": "success",
  "worker_summary": "Updated page C.",
  "changed_files": ["src/pages/C.ts"],
  "validation_evidence": [{"command": "npm test", "result": "PASS"}],
  "clean_worktree": true,
  "parent_graph_mutation": {"updated": true, "path": ".svc/lane-tasks-WI-004.json"}
}
EOF

check "valid merge-back results pass" node "$ROOT/scripts/validate-parallel-merge-back.mjs" --plan "$FIX/.svc/parallel-dispatch-test.json" --results "$FIX/.svc/dispatch"

cat >"$FIX/.svc/dispatch/WI-004.result.json" <<'EOF'
{
  "wi": "WI-004",
  "status": "success",
  "worker_summary": "Bad scope update.",
  "changed_files": ["src/pages/A.ts"],
  "validation_evidence": [{"command": "npm test", "result": "PASS"}],
  "clean_worktree": true,
  "parent_graph_mutation": {"updated": true, "path": ".svc/lane-tasks-WI-004.json"}
}
EOF

check_fail "merge-back rejects out-of-scope changed file" node "$ROOT/scripts/validate-parallel-merge-back.mjs" --plan "$FIX/.svc/parallel-dispatch-test.json" --results "$FIX/.svc/dispatch"

FAKEBIN="$TMP/fakebin"
mkdir -p "$FAKEBIN"
cat >"$FAKEBIN/claude" <<'EOF'
#!/usr/bin/env bash
echo "=== SVC_WORKER_SUMMARY ==="
echo "status: success"
echo "files_changed:"
echo "  - none"
echo "commits: none"
echo "notable_decisions:"
echo "  - fake worker"
echo "blockers:"
echo "  - none"
echo "next_action: merge back"
echo "=== END_SVC_WORKER_SUMMARY ==="
EOF
chmod +x "$FAKEBIN/claude"

check "dispatch worker emits result/progress artifacts" bash -c "cd '$FIX' && PATH='$FAKEBIN':\$PATH SVC_WORKER_WI=WI-003 SVC_HARNESS=claude bash '$ROOT/scripts/dispatch-worker.sh' 'fake payload' >/tmp/svc-worker-test.out"
check "worker result artifact has required fields" node -e '
const fs=require("fs");
const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
if (r.wi !== "WI-003") throw new Error("wrong wi");
for (const k of ["status","worker_summary","changed_files","validation_evidence","clean_worktree","parent_graph_mutation","quality"]) {
  if (!(k in r)) throw new Error(`missing ${k}`);
}
' "$FIX/.svc/dispatch/WI-003.result.json"
check "worker edit rollup and progress stream exist" bash -c "test -f '$FIX/.svc/dispatch/WI-003.edits.json' && test -f '$FIX/.svc/dispatch/wave-progress.jsonl'"

check "dispatch-waves skill exists" test -f "$ROOT/skills/dispatch-waves/SKILL.md"
check "dispatch-waves is in included skills" grep -q '"dispatch-waves"' "$ROOT/skills-manifest.json"
check "dispatch-waves is in routing core pack" grep -q '\- `dispatch-waves`' "$ROOT/skills/route-workflow/references/routing-rules.md"
check "route-workflow routes parallel WI requests" grep -q 'route to `dispatch-waves`' "$ROOT/skills/route-workflow/SKILL.md"
check "transport reference exists" test -f "$ROOT/references/parallel-dispatch-transport.md"
check "README lists dispatch-waves" grep -q '`dispatch-waves`' "$ROOT/README.md"
check "nested execution wave planner exists" test -x "$ROOT/scripts/plan-execution-wave.mjs"
check "delegated merge-back validator exists" test -x "$ROOT/scripts/validate-execution-merge-back.mjs"
check "parallel transport distinguishes mutation authority" grep -q 'coordination transport, not mutation authority' "$ROOT/references/parallel-dispatch-transport.md"

echo ""
echo "parallel WI dispatch: $pass passed, $fail failed"

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi
