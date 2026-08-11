#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
SRC="$TMP/source"
TEST_HOME="$TMP/home"
STATE="$TEST_HOME/.svc/setup-state"
mkdir -p "$SRC/skills/demo" "$SRC/scripts" "$SRC/provision/hosts" "$TEST_HOME"
cp "$ROOT/setup" "$SRC/setup"
cp "$ROOT/scripts/check-install-drift.sh" "$SRC/scripts/check-install-drift.sh"
printf '%s\n' '---' 'name: demo' 'description: setup fixture' '---' '# Demo' > "$SRC/skills/demo/SKILL.md"
printf 'fixture doctrine\n' > "$SRC/DOCTRINE.md"
cat > "$SRC/scripts/install-browse.sh" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
[ "${SVC_BROWSE_FAIL:-0}" != "1" ] || exit 88
sentinel="$HOME/browse-install-active"
[ ! -e "$sentinel" ] || { echo overlap >&2; exit 91; }
mkdir "$sentinel"
trap 'rmdir "$sentinel"' EXIT
sleep 0.05
mkdir -p "$HOME/.local/bin" "$HOME/gstack"
printf '%s\n' "${SVC_HOST:-unknown}" > "$HOME/.local/bin/browse"
printf '%s\n' "${SVC_HOST:-unknown}" > "$HOME/gstack/setup-probe"
printf '%s\n' "${SVC_HOST:-unknown}" >> "$HOME/browse-install.log"
SH
chmod +x "$SRC/scripts/install-browse.sh"

python3 - "$SRC" <<'PY'
import json, pathlib, sys
root = pathlib.Path(sys.argv[1])
(root / "skills-manifest.json").write_text(json.dumps({
    "includedSkills": ["demo"], "rulesRegistry": {"entries": []}
}) + "\n")
hosts = ["antigravity", "claude", "codex", "cursor", "gemini", "kimi", "mimo-code", "opencode"]
for host in hosts:
    payload = {
        "host": host, "name": host, "skills_path": f"~/.hosts/{host}/skills",
        "capabilities": {"hooks": False}, "infra_files": ["DOCTRINE.md"], "infra_dirs": ["scripts"],
        "skip": [], "post_install_commands": [], "verify_commands": [],
        "wiring": {"governed": False}
    }
    if host in ("claude", "codex"):
        payload["post_install_commands"] = ["SVC_HOST=" + host + " bash {skills_path}/scripts/install-browse.sh"]
    (root / "provision/hosts" / f"{host}.json").write_text(json.dumps(payload) + "\n")
PY
cp "$SRC/provision/hosts/cursor.json" "$TMP/cursor-manifest.json"
git -C "$SRC" init -q
git -C "$SRC" add .
git -C "$SRC" -c user.name=svc-test -c user.email=svc-test@example.invalid commit -qm fixture

pass=0
fail=0
ok() { pass=$((pass + 1)); printf 'PASS: %s\n' "$1"; }
bad() { fail=$((fail + 1)); printf 'FAIL: %s\n' "$1"; }

bash -n "$SRC/setup" "$SRC/scripts/check-install-drift.sh" && ok "setup entrypoints are valid Bash" || bad "setup entrypoints are valid Bash"

if HOME="$TEST_HOME" SVC_SETUP_STATE_ROOT="$STATE" SVC_SETUP_FLOCK_BIN="$TMP/missing-flock" "$SRC/setup" --host cursor >"$TMP/no-flock.log" 2>&1; then
  bad "setup fails closed when the per-host lock executable is unavailable"
else
  grep -q 'requires flock for per-host serialization' "$TMP/no-flock.log" \
    && ok "setup fails closed when the per-host lock executable is unavailable" \
    || bad "missing lock executable denial is explicit"
fi

if HOME="$TEST_HOME" SVC_SETUP_STATE_ROOT="$STATE" "$SRC/setup" --host cursor --all-hosts >"$TMP/mutual.log" 2>&1; then
  bad "host and all-host modes are mutually exclusive"
else
  grep -q 'mutually exclusive' "$TMP/mutual.log" && ok "host and all-host modes are mutually exclusive" || bad "mutual exclusion is explicit"
fi

start_ns="$(date +%s%N)"
HOME="$TEST_HOME" SVC_SETUP_STATE_ROOT="$STATE" SVC_SETUP_MAX_JOBS=3 "$SRC/setup" --all-hosts --full >"$TMP/full.log"
full_ms=$(( ( $(date +%s%N) - start_ns ) / 1000000 ))
grep -q 'Provisioning 8 hosts with at most 3 concurrent jobs' "$TMP/full.log" \
  && grep -q 'All 8 hosts converged' "$TMP/full.log" \
  && [ "$(wc -l < "$TEST_HOME/browse-install.log")" -eq 2 ] \
  && ok "all eight manifests provision with bounded concurrency" \
  || bad "all eight manifests provision with bounded concurrency"

# Real Kimi setup breaks this one symlink deliberately so it can inject rules.
# Model that installed state in isolation without perturbing the all-host no-op
# fixture that follows.
cp "$SRC/provision/hosts/kimi.json" "$TMP/kimi-manifest-original.json"
printf 'fixture kimi context\n' > "$SRC/KIMI.md"
python3 - "$SRC/provision/hosts/kimi.json" <<'PY_KIMI_COPY'
import json, pathlib, sys
p = pathlib.Path(sys.argv[1]); doc = json.loads(p.read_text())
doc["infra_files"].append("KIMI.md")
p.write_text(json.dumps(doc) + "\n")
PY_KIMI_COPY
cp "$SRC/KIMI.md" "$TEST_HOME/.hosts/kimi/skills/KIMI.md"
if HOME="$TEST_HOME" SVC_SETUP_STATE_ROOT="$STATE" bash "$SRC/scripts/check-install-drift.sh" --host kimi --quiet; then
  ok "Kimi managed KIMI.md copy is not misclassified as missing infrastructure"
else
  bad "Kimi managed KIMI.md copy is not misclassified as missing infrastructure"
fi
mv "$TMP/kimi-manifest-original.json" "$SRC/provision/hosts/kimi.json"
rm "$SRC/KIMI.md" "$TEST_HOME/.hosts/kimi/skills/KIMI.md"

HOME="$TEST_HOME" SVC_SETUP_STATE_ROOT="$STATE" SVC_BROWSE_FAIL=1 "$SRC/setup" --host claude --full >"$TMP/browse-fail.log" 2>&1
if [ ! -e "$STATE/digests/claude.json" ] && grep -q 'next setup will retry browse' "$TMP/browse-fail.log"; then
  ok "optional browse failure withholds the no-op digest for automatic retry"
else
  bad "optional browse failure withholds the no-op digest for automatic retry"
fi
HOME="$TEST_HOME" SVC_SETUP_STATE_ROOT="$STATE" "$SRC/setup" --host claude >"$TMP/browse-retry.log" 2>&1
if ! grep -q 'Setup: no-op' "$TMP/browse-retry.log" && [ -f "$STATE/digests/claude.json" ]; then
  ok "unchanged setup retries deferred browse and records convergence only after success"
else
  bad "unchanged setup retries deferred browse and records convergence only after success"
fi

before="$(find "$TEST_HOME/.hosts" -printf '%P|%y|%l|%s|%T@\n' | sort | sha256sum | awk '{print $1}')"
start_ns="$(date +%s%N)"
HOME="$TEST_HOME" SVC_SETUP_STATE_ROOT="$STATE" SVC_SETUP_MAX_JOBS=4 "$SRC/setup" --all-hosts >"$TMP/noop.log"
noop_all_ms=$(( ( $(date +%s%N) - start_ns ) / 1000000 ))
after="$(find "$TEST_HOME/.hosts" -printf '%P|%y|%l|%s|%T@\n' | sort | sha256sum | awk '{print $1}')"
noop_count="$(grep -c 'Setup: no-op' "$TMP/noop.log" || true)"
if [ "$noop_count" -eq 8 ] && [ "$before" = "$after" ]; then
  ok "unchanged all-host setup is a byte-stable no-op"
else
  bad "unchanged all-host setup is a byte-stable no-op"
fi

if [ "$noop_all_ms" -le 10000 ]; then
  ok "all-host no-op budget <=10s (${noop_all_ms}ms)"
else
  bad "all-host no-op budget <=10s (${noop_all_ms}ms)"
fi

samples=()
# Exclude two warm-up invocations after the all-host fan-out. The budget is for
# converged steady-state setup, not scheduler teardown from the preceding load.
for _ in 1 2; do
  HOME="$TEST_HOME" SVC_SETUP_STATE_ROOT="$STATE" "$SRC/setup" --host cursor >"$TMP/single-warm.log"
done
for _ in 1 2 3 4 5; do
  start_ns="$(date +%s%N)"
  HOME="$TEST_HOME" SVC_SETUP_STATE_ROOT="$STATE" "$SRC/setup" --host cursor >"$TMP/single.log"
  samples+=("$(( ( $(date +%s%N) - start_ns ) / 1000000 ))")
done
IFS=$'\n' sorted=($(printf '%s\n' "${samples[@]}" | sort -n)); unset IFS
p95_ms="${sorted[4]}"
baseline_samples=()
for _ in 1 2 3 4 5; do
  start_ns="$(date +%s%N)"; node -e '' >/dev/null
  baseline_samples+=("$(( ( $(date +%s%N) - start_ns ) / 1000000 ))")
done
IFS=$'\n' baseline_sorted=($(printf '%s\n' "${baseline_samples[@]}" | sort -n)); unset IFS
baseline_p95="${baseline_sorted[4]}"
allowed_single_ms=2000
[ "$baseline_p95" -le 45 ] || allowed_single_ms=$(( (2000 * baseline_p95 + 44) / 45 ))
if [ "$p95_ms" -le "$allowed_single_ms" ]; then
  ok "single-host no-op p95 budget (${p95_ms}ms raw; ${baseline_p95}ms Node baseline; ${allowed_single_ms}ms contention-adjusted ceiling)"
else
  bad "single-host no-op p95 budget (${p95_ms}ms raw; ${baseline_p95}ms Node baseline; ${allowed_single_ms}ms ceiling)"
fi

HOME="$TEST_HOME" SVC_SETUP_STATE_ROOT="$STATE" "$SRC/setup" --host cursor --full >"$TMP/rebuild.log"
if grep -q 'Setup: no-op' "$TMP/rebuild.log"; then
  bad "full mode bypasses the digest no-op"
else
  ok "full mode bypasses the digest no-op"
fi

rm "$TEST_HOME/.hosts/cursor/skills/DOCTRINE.md"
HOME="$TEST_HOME" SVC_SETUP_STATE_ROOT="$STATE" "$SRC/setup" --host cursor >"$TMP/infra-repair.log"
if ! grep -q 'Setup: no-op' "$TMP/infra-repair.log" && [ -L "$TEST_HOME/.hosts/cursor/skills/DOCTRINE.md" ]; then
  ok "missing infrastructure link invalidates no-op and is repaired"
else
  bad "missing infrastructure link invalidates no-op and is repaired"
fi

ln -sfn "$TMP/outside-demo" "$TEST_HOME/.hosts/cursor/skills/demo"
before_rollback="$(find "$TEST_HOME/.hosts/cursor" -printf '%P|%y|%l|%s\n' | sort | sha256sum | awk '{print $1}')"
python3 - "$SRC/provision/hosts/cursor.json" <<'PY_FAIL_VERIFY'
import json, pathlib, sys
p = pathlib.Path(sys.argv[1]); doc = json.loads(p.read_text()); doc["verify_commands"] = ["false"]
p.write_text(json.dumps(doc) + "\n")
PY_FAIL_VERIFY
if HOME="$TEST_HOME" SVC_SETUP_STATE_ROOT="$STATE" "$SRC/setup" --host cursor >"$TMP/rollback.log" 2>&1; then
  bad "late verification failure triggers transactional rollback"
else
  after_rollback="$(find "$TEST_HOME/.hosts/cursor" -printf '%P|%y|%l|%s\n' | sort | sha256sum | awk '{print $1}')"
  [ "$before_rollback" = "$after_rollback" ] \
    && ok "late verification failure restores exact prior host surface" \
    || bad "late verification failure restores exact prior host surface"
fi

cp "$TMP/cursor-manifest.json" "$SRC/provision/hosts/cursor.json"
browse_before="$(find "$TEST_HOME/.local/bin/browse" "$TEST_HOME/gstack" -printf '%p|%y|%l|%s|%T@\n' 2>/dev/null | sort | sha256sum | awk '{print $1}')"
python3 - "$SRC/provision/hosts/cursor.json" <<'PY_BROWSE_ROLLBACK'
import json, pathlib, sys
p = pathlib.Path(sys.argv[1]); doc = json.loads(p.read_text())
doc["capabilities"]["hooks"] = True
doc["post_install_commands"] = ["SVC_HOST=cursor bash {skills_path}/scripts/install-browse.sh", "false"]
doc["verify_commands"] = []
doc["wiring"] = {"governed": True, "wirer": "false", "wirer_via": "post_install"}
p.write_text(json.dumps(doc) + "\n")
PY_BROWSE_ROLLBACK
if HOME="$TEST_HOME" SVC_SETUP_STATE_ROOT="$STATE" "$SRC/setup" --host cursor --full >"$TMP/browse-rollback.log" 2>&1; then
  bad "post-browse governed failure triggers transactional rollback"
else
  browse_after="$(find "$TEST_HOME/.local/bin/browse" "$TEST_HOME/gstack" -printf '%p|%y|%l|%s|%T@\n' 2>/dev/null | sort | sha256sum | awk '{print $1}')"
  [ "$browse_before" = "$browse_after" ] \
    && ok "failed host transaction never mutates deferred shared browse surfaces" \
    || bad "failed host transaction never mutates deferred shared browse surfaces"
fi
cp "$TMP/cursor-manifest.json" "$SRC/provision/hosts/cursor.json"

BROWSE_HOME="$TMP/browse-home"
mkdir -p "$BROWSE_HOME" "$TMP/browse-outside"
ln -s "$TMP/browse-outside" "$BROWSE_HOME/gstack"
if HOME="$BROWSE_HOME" bash "$ROOT/scripts/install-browse.sh" >"$TMP/browse-containment.log" 2>&1; then
  bad "optional browse rejects symlinked destination ancestry"
else
  grep -q 'browse target ancestry contains symlink' "$TMP/browse-containment.log" \
    && [ -z "$(find "$TMP/browse-outside" -mindepth 1 -print -quit)" ] \
    && ok "optional browse rejects symlinked destination ancestry before mutation" \
    || bad "optional browse destination rejection is explicit and side-effect free"
fi

BROWSE_NESTED_HOME="$TMP/browse-nested-home"
mkdir -p "$BROWSE_NESTED_HOME/gstack" "$TMP/browse-nested-outside"
ln -s "$TMP/browse-nested-outside" "$BROWSE_NESTED_HOME/gstack/browse"
if HOME="$BROWSE_NESTED_HOME" bash "$ROOT/scripts/install-browse.sh" >"$TMP/browse-nested.log" 2>&1; then
  bad "optional browse rejects nested symlinked destination ancestry"
else
  grep -q 'browse target ancestry contains symlink' "$TMP/browse-nested.log" \
    && [ -z "$(find "$TMP/browse-nested-outside" -mindepth 1 -print -quit)" ] \
    && ok "optional browse rejects nested symlinked destination ancestry before mutation" \
    || bad "nested browse destination rejection is explicit and side-effect free"
fi

BROWSE_LINK_HOME="$TMP/browse-link-home"
mkdir -p "$BROWSE_LINK_HOME/gstack/browse/dist" "$BROWSE_LINK_HOME/.local/bin" "$TMP/browse-link-outside"
cat > "$BROWSE_LINK_HOME/gstack/browse/dist/browse" <<'SH_BROWSE_HEALTHY'
#!/usr/bin/env bash
echo 'Status: healthy'
SH_BROWSE_HEALTHY
chmod +x "$BROWSE_LINK_HOME/gstack/browse/dist/browse"
ln -s "$TMP/browse-link-outside" "$BROWSE_LINK_HOME/.local/bin/browse"
if HOME="$BROWSE_LINK_HOME" bash "$ROOT/scripts/install-browse.sh" >"$TMP/browse-link.log" 2>&1 \
   && [ -L "$BROWSE_LINK_HOME/.local/bin/browse" ] \
   && [ "$(readlink "$BROWSE_LINK_HOME/.local/bin/browse")" = "$BROWSE_LINK_HOME/gstack/browse/dist/browse" ] \
   && [ -z "$(find "$TMP/browse-link-outside" -mindepth 1 -print -quit)" ]; then
  ok "directory-valued browse link is replaced without following its target"
else
  bad "directory-valued browse link is replaced without following its target"
fi

mkdir -p "$TEST_HOME/escape-parent" "$TMP/escape-outside"
ln -s "$TMP/escape-outside" "$TEST_HOME/escape-parent/link"
python3 - "$SRC/provision/hosts/cursor.json" "$TEST_HOME/escape-parent/link/skills" <<'PY_ESCAPE'
import json, pathlib, sys
p = pathlib.Path(sys.argv[1]); doc = json.loads(p.read_text()); doc["skills_path"] = sys.argv[2]; doc["verify_commands"] = []
p.write_text(json.dumps(doc) + "\n")
PY_ESCAPE
if HOME="$TEST_HOME" SVC_SETUP_STATE_ROOT="$STATE" "$SRC/setup" --host cursor >"$TMP/target-escape.log" 2>&1; then
  bad "symlinked host target ancestry is rejected before mutation"
else
  grep -q 'target ancestry must not contain symlinks' "$TMP/target-escape.log" \
    && [ -z "$(find "$TMP/escape-outside" -mindepth 1 -print -quit)" ] \
    && ok "symlinked host target ancestry is rejected before mutation" \
    || bad "symlinked host target ancestry is rejected before mutation"
fi
cp "$TMP/cursor-manifest.json" "$SRC/provision/hosts/cursor.json"

printf '\nchanged\n' >> "$SRC/skills/demo/SKILL.md"
if ! HOME="$TEST_HOME" SVC_SETUP_STATE_ROOT="$STATE" "$SRC/setup" --host cursor >"$TMP/changed.log" 2>&1; then
  bad "source-byte change setup succeeds ($(tail -1 "$TMP/changed.log"))"
elif grep -q 'Setup: no-op' "$TMP/changed.log"; then
  bad "source-byte change invalidates digest"
else
  ok "source-byte change invalidates digest"
fi

git -C "$SRC" add skills/demo/SKILL.md
git -C "$SRC" -c user.name=svc-test -c user.email=svc-test@example.invalid commit -qm changed-fixture
HOME="$TEST_HOME" SVC_SETUP_STATE_ROOT="$STATE" "$SRC/setup" --host cursor >"$TMP/changed-converge.log"
git -C "$SRC" update-index --assume-unchanged skills/demo/SKILL.md
printf 'hidden-index-change\n' >> "$SRC/skills/demo/SKILL.md"
if ! HOME="$TEST_HOME" SVC_SETUP_STATE_ROOT="$STATE" "$SRC/setup" --host cursor >"$TMP/hidden-index.log" 2>&1; then
  bad "index-hidden source-byte change setup succeeds"
elif grep -q 'Setup: no-op' "$TMP/hidden-index.log"; then
  bad "index-hidden source-byte change invalidates digest"
else
  ok "index-hidden source-byte change invalidates digest"
fi
git -C "$SRC" update-index --no-assume-unchanged skills/demo/SKILL.md

mkdir -p "$TEST_HOME/state-parent" "$TMP/outside-state"
ln -s "$TMP/outside-state" "$TEST_HOME/state-parent/link"
if HOME="$TEST_HOME" SVC_SETUP_STATE_ROOT="$TEST_HOME/state-parent/link/setup" "$SRC/setup" --host cursor >"$TMP/symlink.log" 2>&1; then
  bad "symlinked setup state ancestry is rejected"
else
  grep -q 'state ancestry must not contain symlinks' "$TMP/symlink.log" \
    && [ -z "$(find "$TMP/outside-state" -mindepth 1 -print -quit)" ] \
    && ok "symlinked setup state ancestry is rejected before mutation" \
    || bad "setup state ancestry rejection is explicit and side-effect free"
fi

HOME="$TEST_HOME" SVC_SETUP_STATE_ROOT="$STATE" bash "$SRC/scripts/check-install-drift.sh" --all-hosts --quiet \
  && ok "all-host drift aggregation passes after convergence" \
  || bad "all-host drift aggregation passes after convergence"

printf 'setup timing: full=%sms all-host-noop=%sms single-host-p95=%sms\n' "$full_ms" "$noop_all_ms" "$p95_ms"
printf '=== Results: %d passed, %d failed ===\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
