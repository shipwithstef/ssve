#!/usr/bin/env bash
# validate-generated-mirrors.sh — Tier-1 validator for WI-364.
set -u
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$REPO_ROOT" || exit 1
GEN="scripts/generate-manifest-mirrors.mjs"
TMP="$(mktemp -d /tmp/wi364-gen.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT
PASS=0; FAIL=0
check(){ local l="$1"; shift; if "$@" >/dev/null 2>&1; then echo "  ✓ $l"; PASS=$((PASS+1)); else echo "  ✗ $l"; FAIL=$((FAIL+1)); fi; }
echo "=== Tier 1: generated mirrors (WI-364) ==="
check "generator exists + syntax" node --check "$GEN"
for id in readme-included-skills external-core-pack repo-modes-bootstrap routing-rules-core-pack claude-md-svc-default model-selection-quick-ref model-selection-cognitive-labels model-routing-svc-default model-routing-cognitive-labels; do
  f=$(node -e "
const m={'readme-included-skills':'README.md','external-core-pack':'EXTERNAL_ADDONS.md','repo-modes-bootstrap':'REPO_MODES.md','routing-rules-core-pack':'skills/route-workflow/references/routing-rules.md','claude-md-svc-default':'CLAUDE.md','model-selection-quick-ref':'rules/common/model-selection.md','model-selection-cognitive-labels':'rules/common/model-selection.md','model-routing-svc-default':'references/model-routing.md','model-routing-cognitive-labels':'references/model-routing.md'};
console.log(m['$id']);")
  check "markers present: $id" bash -c "grep -q 'svc:generated:begin $id' '$f' && grep -q 'svc:generated:end $id' '$f'"
done
check "--check exits 0 on fresh tree" env -u GIT_DIR node "$GEN" --check
# tamper test in a copy: edit inside a marker -> --check fails w/ message
cp -r README.md skills-manifest.json "$TMP/" 2>/dev/null
python3 - "$TMP" <<'PY'
import re,sys,os,shutil
t=sys.argv[1]
# full mini-tree for the generator: copy all block target files + sources
for f in ["README.md","EXTERNAL_ADDONS.md","REPO_MODES.md","CLAUDE.md","skills-manifest.json"]:
    shutil.copy(f,os.path.join(t,f))
os.makedirs(os.path.join(t,"skills/route-workflow/references"),exist_ok=True)
os.makedirs(os.path.join(t,"rules/common"),exist_ok=True)
os.makedirs(os.path.join(t,"references"),exist_ok=True)
os.makedirs(os.path.join(t,"scripts"),exist_ok=True)
shutil.copy("skills/route-workflow/references/routing-rules.md",os.path.join(t,"skills/route-workflow/references/routing-rules.md"))
shutil.copy("rules/common/model-selection.md",os.path.join(t,"rules/common/model-selection.md"))
shutil.copy("references/model-routing.md",os.path.join(t,"references/model-routing.md"))
shutil.copy("references/model-registry.json",os.path.join(t,"references/model-registry.json"))
shutil.copy("scripts/generate-manifest-mirrors.mjs",os.path.join(t,"scripts/generate-manifest-mirrors.mjs"))
s=open(os.path.join(t,"README.md")).read()
s=re.sub(r"(svc:generated:begin readme-included-skills[^>]*-->\n)", r"\1- `hand-edited-rogue-skill`\n", s, count=1)
open(os.path.join(t,"README.md"),"w").write(s)
PY
check "tamper inside markers -> --check fails" bash -c "! ( cd '$TMP' && node scripts/generate-manifest-mirrors.mjs --check )"
check "tamper message names the sources" bash -c "( cd '$TMP' && node scripts/generate-manifest-mirrors.mjs --check 2>&1 || true ) | grep -q 'edit skills-manifest.json'"
# determinism: --write twice -> byte-identical tree
( cd "$TMP" && node scripts/generate-manifest-mirrors.mjs --write >/dev/null 2>&1 && cp README.md README.1 && node scripts/generate-manifest-mirrors.mjs --write >/dev/null 2>&1 )
check "determinism (two writes identical)" cmp -s "$TMP/README.md" "$TMP/README.1"
echo ""
if [ "$FAIL" = 0 ]; then echo "  PASS — all $PASS mirror checks passed"; exit 0
else echo "  $FAIL failed, $PASS passed"; exit 1; fi
