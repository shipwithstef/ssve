#!/usr/bin/env bash
# validate-host-rules-index.sh — progressive-disclosure rule install for hosts
# without the hook-based rule injector (everything except Claude).
#
# Hermetic: installs the REAL rules/ + rulesRegistry with the candidate setup
# into a temp HOME and asserts:
#   - non-Claude hosts auto-load only the `always` universal rules plus ONE
#     generated svc-rules-index.md (dir targets, @-import file targets, and
#     Kimi's KIMI.md injection block);
#   - the index names every signal/lazy universal rule with a readable,
#     absolute path to its full body (linked outside the auto-loaded location);
#   - the whole auto-loaded rule payload (always rules + index, or Kimi's
#     injected block) stays under 10 KB (HOME normalized to /home/user);
#   - stale pre-loaded signal/lazy symlinks and @-imports from older installs
#     are removed while user content is kept; an unchanged re-run is a no-op;
#   - Claude keeps the always-only global dir with no index (injector host).
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/fixture-home.sh"
svc_require_fixture "$@"

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
SRC="$TMP/source"
TEST_HOME="$TMP/home"
STATE="$TEST_HOME/.svc/setup-state"
mkdir -p "$SRC/skills/demo" "$SRC/scripts" "$SRC/provision/hosts" "$TEST_HOME"
cp "$ROOT/setup" "$SRC/setup"
cp "$ROOT/scripts/check-install-drift.sh" "$SRC/scripts/check-install-drift.sh"
cp -R "$ROOT/rules" "$SRC/rules"
printf '%s\n' '---' 'name: demo' 'description: setup fixture' '---' '# Demo' > "$SRC/skills/demo/SKILL.md"
printf 'fixture doctrine\n' > "$SRC/DOCTRINE.md"
printf '# Kimi fixture\n' > "$SRC/KIMI.md"

python3 - "$ROOT" "$SRC" <<'PY'
import json, pathlib, sys
root, src = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
m = json.loads((root / "skills-manifest.json").read_text())
(src / "skills-manifest.json").write_text(json.dumps({
    "includedSkills": ["demo"], "rulesRegistry": m["rulesRegistry"]}) + "\n")
for host in ("claude", "cursor", "gemini", "opencode", "kimi"):
    real = json.loads((root / "provision/hosts" / f"{host}.json").read_text())
    rp = real["rules_path"]
    payload = {"host": host, "name": host, "skills_path": real["skills_path"],
               "capabilities": {"hooks": False}, "infra_files": ["DOCTRINE.md"],
               "infra_dirs": ["scripts"], "skip": [], "post_install_commands": [],
               "verify_commands": [], "wiring": {"governed": False}, "rules_path": rp}
    if host == "kimi":
        payload["infra_files"].append("KIMI.md")
    (src / "provision/hosts" / f"{host}.json").write_text(json.dumps(payload) + "\n")
PY
git -C "$SRC" init -q
git -C "$SRC" add .
git -C "$SRC" -c user.name=svc-test -c user.email=svc-test@example.invalid commit -qm fixture

pass=0
fail=0
ok() { pass=$((pass + 1)); printf 'PASS: %s\n' "$1"; }
bad() { fail=$((fail + 1)); printf 'FAIL: %s\n' "$1"; }
check() { local l="$1"; shift; if "$@" >"$TMP/check.log" 2>&1; then ok "$l"; else bad "$l"; sed 's/^/    /' "$TMP/check.log"; fi; }
run_setup() { HOME="$TEST_HOME" SVC_SETUP_STATE_ROOT="$STATE" "$SRC/setup" --host "$1" >"$TMP/setup-$1.log" 2>&1; }

# Seed an old-style full Gemini install: a pre-loaded signal rule symlink and
# its @-import, plus user content that must survive.
mkdir -p "$TEST_HOME/.gemini/rules"
ln -s "$SRC/rules/bash-hygiene.md" "$TEST_HOME/.gemini/rules/svc-bash-hygiene.md"
printf '# My Gemini notes\nkeep this line\n@%s\n' "$TEST_HOME/.gemini/rules/svc-bash-hygiene.md" > "$TEST_HOME/.gemini/GEMINI.md"
printf 'personal rule\n' > "$TEST_HOME/.gemini/rules/my-own.md"

for h in claude cursor gemini opencode kimi; do
  if run_setup "$h"; then ok "setup --host $h succeeds"; else bad "setup --host $h succeeds"; sed 's/^/    /' "$TMP/setup-$h.log" | tail -20; fi
done

# Measure + assert per host (python does the payload accounting).
python3 - "$SRC" "$TEST_HOME" > "$TMP/report.txt" <<'PY' && ok "non-Claude hosts auto-load always rules + index only; index covers every signal/lazy rule" || { bad "non-Claude hosts auto-load always rules + index only; index covers every signal/lazy rule"; }
import json, os, re, sys
src, home = sys.argv[1], sys.argv[2]
m = json.load(open(os.path.join(src, "skills-manifest.json")))
uni = [e for e in m["rulesRegistry"]["entries"] if e.get("stack") == "universal" and os.path.isfile(os.path.join(src, e["path"]))]
slug = lambda p: "svc-" + p[len("rules/"):].replace("/", "-")
always = {slug(e["path"]) for e in uni if e.get("auto_inject", "always") == "always"}
ondemand = {slug(e["path"]): e["path"] for e in uni if e.get("auto_inject", "always") != "always"}
always_bytes = sum(os.path.getsize(os.path.join(src, e["path"])) for e in uni if slug(e["path"]) in always)
errs = []
# Byte accounting normalizes the fixture HOME to a typical /home/user so the
# 10 KB budget does not depend on how deep the temp directory happens to be.
def nbytes(p):
    return len(open(os.path.realpath(p), encoding="utf-8").read().replace(home, "/home/user").encode())

def check_index(host, idx):
    text = open(idx, encoding="utf-8").read()
    idx_b = nbytes(idx)
    if idx_b >= 10 * 1024:
        errs.append(f"{host}: index {idx_b} B >= 10 KB")
    for name, rel in ondemand.items():
        mm = re.search(r"^- .* → `([^`]*/%s)`$" % re.escape(name), text, re.M)
        if not mm:
            errs.append(f"{host}: index misses {name}"); continue
        p = mm.group(1)
        if not os.path.isabs(p) or not os.access(p, os.R_OK):
            errs.append(f"{host}: {name} path not absolute/readable: {p}"); continue
        if os.path.realpath(p) != os.path.realpath(os.path.join(src, rel)):
            errs.append(f"{host}: {name} path does not resolve to {rel}")
    return idx_b

def dir_host(host, d):
    names = {f for f in os.listdir(d) if f.endswith(".md")}
    svc = {f for f in names if f.startswith("svc-")}
    want = always | {"svc-rules-index.md"}
    if svc != want:
        errs.append(f"{host}: auto-loaded svc set {sorted(svc ^ want)} differs")
    leak = [f for f in svc if f in ondemand]
    if leak: errs.append(f"{host}: on-demand bodies pre-loaded: {leak}")
    idx_b = check_index(host, os.path.join(d, "svc-rules-index.md"))
    total = sum(nbytes(os.path.join(d, f)) for f in svc)
    return idx_b, total

def file_host(host, target, d):
    imports = [l.strip()[1:] for l in open(target, encoding="utf-8") if l.strip().startswith("@")]
    bases = {os.path.basename(p) for p in imports}
    want = always | {"svc-rules-index.md"}
    if bases != want:
        errs.append(f"{host}: @-imports {sorted(bases ^ want)} differ")
    idx_b = check_index(host, os.path.join(d, "svc-rules-index.md"))
    total = sum(nbytes(p) for p in imports if os.path.exists(p))
    return idx_b, total

rows = []
for host, kind, a, b in [("cursor", "dir", f"{home}/.cursor/rules", None),
                         ("kimi", "dir", f"{home}/.kimi/rules", None),
                         ("gemini", "file", f"{home}/.gemini/GEMINI.md", f"{home}/.gemini/rules"),
                         ("opencode", "file", f"{home}/.config/opencode/AGENTS.md", f"{home}/.config/opencode/rules")]:
    idx_b, total = dir_host(host, a) if kind == "dir" else file_host(host, a, b)
    if total >= 10 * 1024:
        errs.append(f"{host}: auto-loaded {total} B >= 10 KB")
    rows.append(f"{host}: auto-loaded {total} B (always {always_bytes} + index {idx_b})")

kimi = open(f"{home}/.kimi/skills/KIMI.md", encoding="utf-8").read()
block = kimi[kimi.find("<!-- svc-auto-rules-begin -->"):].replace(home, "/home/user")
if "SVC Rules Index" not in block: errs.append("kimi: KIMI.md block lacks the index")
if len(block.encode()) >= 10 * 1024: errs.append(f"kimi: KIMI.md rules block {len(block.encode())} B >= 10 KB")
rows.append(f"kimi KIMI.md injected block: {len(block.encode())} B")

cl = f"{home}/.claude/rules"
csvc = {f for f in os.listdir(cl) if f.startswith("svc-")}
if csvc != always: errs.append(f"claude: global dir {sorted(csvc ^ always)} differs from always set")
if os.path.exists(f"{home}/.claude/skills/rules/universal"): errs.append("claude: unexpected on-demand dir")
rows.append(f"claude: auto-loaded {sum(nbytes(os.path.join(cl, f)) for f in csvc)} B (always only, injector host)")
print("\n".join(rows))
if errs:
    print("\n".join("ERR " + e for e in errs)); sys.exit(1)
PY
sed 's/^/    /' "$TMP/report.txt"

gem="$TEST_HOME/.gemini/GEMINI.md"
check "gemini migration keeps user content" grep -q '^keep this line$' "$gem"
check "gemini migration drops stale signal @-import" bash -c "! grep -q 'svc-bash-hygiene' '$gem'"
check "gemini migration unlinks pre-loaded signal symlink" test ! -e "$TEST_HOME/.gemini/rules/svc-bash-hygiene.md"
check "user's own rule file is never touched" test -f "$TEST_HOME/.gemini/rules/my-own.md"

before="$(find "$TEST_HOME/.gemini" "$TEST_HOME/.cursor" -printf '%P|%y|%l|%s|%T@\n' | sort | sha256sum)"
run_setup gemini && run_setup cursor
after="$(find "$TEST_HOME/.gemini" "$TEST_HOME/.cursor" -printf '%P|%y|%l|%s|%T@\n' | sort | sha256sum)"
check "unchanged re-run leaves index + imports byte-stable" test "$before" = "$after"

echo ""
echo "host rules index: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
