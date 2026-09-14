#!/usr/bin/env bash
# validate-governed-wirer-fail-fast.sh — WI-487 round-3 finding R3-F001 (CRITICAL).
#
# A GOVERNED hook wirer routed via post_install (e.g. Kimi's) MUST run FAIL-FAST in
# setup. Pre-fix, setup ran every post_install command with `|| true`, so a wirer
# failure was silently tolerated and the host was left WITHOUT launcher-backed
# enforcement (silent fail-open) while setup still printed "Done".
#
# This fixture drives the REAL `setup` end-to-end against three synthetic
# hook-capable hosts whose governed wirer is routed via post_install:
#   1. fixhost-fail     — wirer exits non-zero  → setup ABORTS (no "Done", non-zero),
#                         no unenforced governed hook is left in the host config.
#   2. fixhost-ok       — wirer wires the launcher-routed governed command (svc-enforce
#                         marker) and exits 0 → setup COMPLETES ("Done", exit 0).
#   3. fixhost-badroute — wirer exits 0 but writes a config WITHOUT the launcher marker
#                         (drifted to a direct checkout path) → setup ABORTS.
#
# Hermetic: a DURABLE fixture source under $HOME/.cache (so materialization is not
# refused as ephemeral) + a temp HOME. Zero network / model calls.
#
# Tier-1 promotion note:
#   validator_path: test-framework/evals/tier-1/validate-governed-wirer-fail-fast.sh
#   failure_class: a governed post_install wirer whose failure is swallowed (|| true),
#     leaving a host converged-per-setup but WITHOUT launcher-backed enforcement.
#   promotion_signal: signal 3 — protects the install hot path's fail-closed contract.
#   expected_runtime_budget: < 6s, hermetic, no network/model.
#   why_tier_2_or_targeted_is_insufficient: the silent fail-open is only observable by
#     driving setup end-to-end and asserting the abort + the absence of an unenforced
#     governed command — it must block before an upgrade ships to any governed host.

set -u
PASS=0; FAIL=0
pass() { PASS=$((PASS+1)); echo "  ok $1"; }
fail() { FAIL=$((FAIL+1)); echo "  FAIL $1"; }

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
. "$REPO_ROOT/test-framework/evals/tier-1/lib/stage-governed-hooks.sh"; STAGE_HOOKS_REPO="$REPO_ROOT"
echo "=== Tier 1: governed hook wirer FAIL-FAST in setup (WI-487 R3-F001) ==="

command -v node >/dev/null 2>&1 || { echo "  SKIP — node unavailable"; echo "  PASS — 0 assertions (skipped)"; exit 0; }
command -v python3 >/dev/null 2>&1 || { echo "  SKIP — python3 unavailable"; echo "  PASS — 0 assertions (skipped)"; exit 0; }
if [ ! -f "$REPO_ROOT/setup" ] || [ ! -f "$REPO_ROOT/scripts/svc-migrate-install.mjs" ] || [ ! -f "$REPO_ROOT/bin/svc-enforce.mjs" ]; then
  echo "EXPECTED-RED: setup / durable launcher not yet implemented"; exit 1
fi

# --- Static guard: the post_install loop must NOT blanket-suppress governed wirers.
# A raw `eval "$cmd" || true` with no governed fail-fast branch is the regression.
if grep -q 'WIRING_GOVERNED' "$REPO_ROOT/setup" && grep -q 'governed hook wirer FAILED' "$REPO_ROOT/setup"; then
  pass "setup contains a governed-wirer fail-fast branch (not a blanket best-effort loop)"
else
  fail "setup lacks the governed-wirer fail-fast branch (R3-F001 regression)"
fi

# --- Build a DURABLE fixture source (so materialization is not refused). ---
DURABLE_BASE="${SVC_TEST_DURABLE_BASE:-$HOME/.cache}"
mkdir -p "$DURABLE_BASE" 2>/dev/null || true
SRC="$(mktemp -d "$DURABLE_BASE/svc-wi487-r3f001-XXXXXX")"
FHOME="$(mktemp -d)"
cleanup() { rm -rf "$SRC" "$FHOME" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

mkdir -p "$SRC/bin" "$SRC/hooks/lib" "$SRC/scripts/lib" "$SRC/provision/hosts" "$SRC/skills/route-workflow"
cp "$REPO_ROOT/setup" "$SRC/setup"; chmod +x "$SRC/setup"
cp "$REPO_ROOT/bin/svc-enforce.mjs" "$SRC/bin/"
cp "$REPO_ROOT/hooks/lib/enforcement-core.mjs" "$SRC/hooks/lib/"
cp "$REPO_ROOT/scripts/svc-migrate-install.mjs" "$SRC/scripts/"
cp "$REPO_ROOT/scripts/verify-governed-routing.mjs" "$SRC/scripts/"
cp "$REPO_ROOT/scripts/lib/governed-routing.mjs" "$SRC/scripts/lib/"
# Synthetic governed hosts still hit the global MATERIALIZE_REGISTRY check;
# stage every governed bash adapter or setup aborts before the wirer runs.
stage_governed_bash_hooks "$SRC"
printf '# route-workflow (fixture)\n' > "$SRC/skills/route-workflow/SKILL.md"
printf '{"includedSkills":["route-workflow"]}\n' > "$SRC/skills-manifest.json"

# Synthetic governed wirers (routed via post_install).
cat > "$SRC/scripts/wire-fail.mjs" <<'EOF'
// Governed wirer that FAILS (e.g. missing config precondition) — must abort setup.
process.stderr.write("wire-fail: simulated wirer failure\n");
process.exit(1);
EOF
cat > "$SRC/scripts/wire-ok.mjs" <<'EOF'
// Governed wirer that wires the launcher-routed governed command and succeeds.
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
const dir = path.join(os.homedir(), ".fixhost-ok");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "config.toml"), 'command = "node svc-enforce svc-fixture-guard"\n');
process.exit(0);
EOF
cat > "$SRC/scripts/wire-badroute.mjs" <<'EOF'
// Governed wirer that exits 0 but wires a DIRECT checkout path (no launcher marker).
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
const dir = path.join(os.homedir(), ".fixhost-badroute");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "config.toml"), 'note = "svc-enforce"\ncommand = "node /some/checkout/svc-fixture-guard.mjs"\n');
process.exit(0);
EOF

# Synthetic host manifests — all hook-capable, governed, wirer via post_install.
mk_manifest() { # $1=host $2=wirer-script
  cat > "$SRC/provision/hosts/$1.json" <<EOF
{
  "host": "$1",
  "name": "Fixture $1",
  "skills_path": "~/.$1/skills",
  "capabilities": { "skills": true, "hooks": true },
  "infra_files": [],
  "infra_dirs": ["scripts"],
  "skip": [],
  "post_install_commands": ["node {skills_path}/scripts/$2 --skills-path {skills_path}"],
  "verify_commands": ["test -f {skills_path}/route-workflow/SKILL.md"],
  "wiring": {
    "hook_capable": true,
    "wirer": "scripts/$2",
    "wirer_via": "post_install",
    "governed": true,
    "governed_token": ["svc-enforce", "svc-fixture-guard"],
    "config_file": "~/.$1/config.toml",
    "enforcement": "launcher"
  }
}
EOF
}
mk_manifest fixhost-fail wire-fail.mjs
mk_manifest fixhost-ok wire-ok.mjs
mk_manifest fixhost-badroute wire-badroute.mjs
# wire-ok / wire-badroute write to ~/.fixhost-ok / ~/.fixhost-badroute, but the
# manifest config_file must match. Point them at those dirs.
python3 - "$SRC" <<'PY'
import json, sys, os
src = sys.argv[1]
for h, cfg in (("fixhost-ok", "~/.fixhost-ok/config.toml"), ("fixhost-badroute", "~/.fixhost-badroute/config.toml")):
    p = os.path.join(src, "provision", "hosts", f"{h}.json")
    m = json.load(open(p))
    m["wiring"]["config_file"] = cfg
    json.dump(m, open(p, "w"), indent=2)
PY

# Case-routed governed hosts (Codex/Claude/Gemini) are wired after the generic
# post-install loop. A successful wirer with a direct command must be rejected
# there too; otherwise setup can print Done while drift is already present.
cat > "$SRC/scripts/wire-codex-hooks.mjs" <<'EOF'
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
const dir = path.join(os.homedir(), ".codex");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "hooks.json"), '{"unrelated_note":"svc-enforce","hooks":{"PreToolUse":[{"hooks":[{"command":"node /direct/checkout/svc-codex-pretool-dispatcher.mjs"}]}]}}\n');
process.exit(0);
EOF
cat > "$SRC/provision/hosts/codex.json" <<'EOF'
{
  "host":"codex","name":"Fixture Codex","skills_path":"~/.codex/skills",
  "capabilities":{"skills":true,"hooks":true},"infra_files":[],"infra_dirs":["scripts"],"skip":[],
  "post_install_commands":[],"verify_commands":["test -f {skills_path}/route-workflow/SKILL.md"],
  "wiring":{"hook_capable":true,"wirer":"scripts/wire-codex-hooks.mjs","wirer_via":"case","governed":true,
    "governed_token":["svc-enforce","svc-codex-pretool-dispatcher"],"config_file":"~/.codex/hooks.json","enforcement":"launcher"}
}
EOF

run_setup() { # $1=host  -> prints output; sets global RC
  set +e
  OUT="$(HOME="$FHOME" bash "$SRC/setup" --host "$1" 2>&1)"
  RC=$?
  set -e
}

# --- Case 1: governed wirer FAILS → setup ABORTS (fail-fast) ------------------
run_setup fixhost-fail
if [ "$RC" -ne 0 ]; then
  pass "R3-F001: setup ABORTS (exit $RC) when the governed post_install wirer fails"
else
  fail "R3-F001: setup did NOT abort on a failing governed wirer (exit 0)"
fi
if echo "$OUT" | grep -q 'governed hook wirer FAILED'; then
  pass "R3-F001: setup emits the governed-wirer fail-fast diagnostic"
else
  fail "R3-F001: no governed-wirer fail-fast diagnostic (got: $(echo "$OUT" | tail -3 | tr '\n' '|'))"
fi
if echo "$OUT" | grep -q '^Done\.'; then
  fail "R3-F001: setup reported 'Done' despite the governed wirer failing (silent fail-open)"
else
  pass "R3-F001: setup did NOT report the host converged ('Done' absent)"
fi
if [ ! -f "$FHOME/.fixhost-fail/config.toml" ] || ! grep -q 'svc-enforce' "$FHOME/.fixhost-fail/config.toml" 2>/dev/null; then
  pass "R3-F001: no unenforced/launcher-less governed hook left in the host config after abort"
else
  fail "R3-F001: an unenforced governed hook was left behind after the wirer failed"
fi

# --- Case 2: governed wirer SUCCEEDS + routes through launcher → COMPLETES -----
run_setup fixhost-ok
if [ "$RC" -eq 0 ] && echo "$OUT" | grep -q '^Done\.'; then
  pass "R3-F001: a SUCCEEDING governed wirer that routes through the launcher completes (exit 0, 'Done')"
else
  fail "R3-F001: a valid governed wirer did not complete (exit $RC; last: $(echo "$OUT" | tail -3 | tr '\n' '|'))"
fi
if grep -q 'svc-enforce' "$FHOME/.fixhost-ok/config.toml" 2>/dev/null; then
  pass "R3-F001: the completed host's governed command routes through the launcher (svc-enforce marker present)"
else
  fail "R3-F001: completed host config missing the launcher marker"
fi

# --- Case 3: wirer exits 0 but DROPS the launcher marker → ABORT --------------
run_setup fixhost-badroute
if [ "$RC" -ne 0 ] && ! echo "$OUT" | grep -q '^Done\.'; then
  pass "R3-F001: setup ABORTS when the governed command does not route through the launcher (drifted)"
else
  fail "R3-F001: setup accepted a governed command that bypasses the launcher (exit $RC)"
fi

# --- Case 4: case-routed Codex wirer exits 0 but bypasses launcher → ABORT ----
run_setup codex
if [ "$RC" -ne 0 ] && ! echo "$OUT" | grep -q '^Done\.'; then
  pass "WI-529: setup ABORTS a case-routed Codex wirer with missing governed markers"
else
  fail "WI-529: setup accepted case-routed Codex launcher bypass (exit $RC)"
fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "  PASS — all $PASS assertions passed"
  exit 0
else
  echo "  $FAIL failed, $PASS passed"
  exit 1
fi
