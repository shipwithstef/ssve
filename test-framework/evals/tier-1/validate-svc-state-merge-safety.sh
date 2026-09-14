#!/usr/bin/env bash
# Tier 1: mutable .svc state merge-safety gate (WI-398).
#
# Parallel orchestrator sessions (the user multi-clauds ~25% of the time) commit
# divergent mutable .svc/*.json state. `merge=union` CORRUPTS JSON. This gate
# asserts every mutable tracked .svc/*.json resolves to the deterministic
# `svc-json` merge driver (via `git check-attr`, the ground truth) OR is
# gitignored regenerable cache — so a NEW mutable .svc json added without a
# merge strategy fails closed. It also proves, with a live isolated git merge,
# that a two-session collision resolves WITHOUT LOSS (AC2) and that a true
# overlapping edit still conflicts (no silent resolution), and that the driver +
# installer are foreign-worktree safe (absolute paths, AC3).
#
# Hermetic + deterministic: the fixture uses `git -C "$TMP"` throwaway repos
# (WI-375 isolation rule); no network, no LLM.
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"
PASS=0; FAIL=0
pass(){ echo "  ✓ $1"; PASS=$((PASS+1)); }
fail(){ echo "  ✗ $1"; FAIL=$((FAIL+1)); }

echo "=== Tier 1: .svc State Merge Safety (WI-398) ==="

DRIVER="scripts/svc-json-merge-driver.mjs"
INSTALLER="scripts/install-svc-merge-driver.sh"

# ---- A. Artifacts exist -----------------------------------------------------
[ -s "$DRIVER" ]    && pass "merge driver present ($DRIVER)"        || fail "merge driver missing ($DRIVER)"
[ -s "$INSTALLER" ] && pass "installer present ($INSTALLER)"        || fail "installer missing ($INSTALLER)"
[ -f .gitattributes ] && pass ".gitattributes present"             || fail ".gitattributes missing"

# ---- B. .gitattributes registration via git check-attr (ground truth) -------
# Every MUTABLE tracked .svc/*.json (exclude frozen archive + .completed/.blocked
# snapshots — those never re-mutate, so never merge) must resolve to svc-json.
mapfile -t MUTABLE < <(git ls-files '.svc/*.json' '.svc/**/*.json' \
  | grep -v '^\.svc/archive/' \
  | grep -vE '\.completed(-[^/]*)?\.json$' \
  | grep -vE '\.blocked(-[^/]*)?\.json$')
n_mut=${#MUTABLE[@]}
if [ "$n_mut" -eq 0 ]; then
  fail "no mutable tracked .svc/*.json found — enumeration broke"
else
  bad=0; badlist=""
  for f in "${MUTABLE[@]}"; do
    a="$(git check-attr merge -- "$f" 2>/dev/null | sed 's#.*merge: ##')"
    if [ "$a" != "svc-json" ]; then bad=$((bad+1)); badlist="$badlist\n      $f -> $a"; fi
  done
  if [ "$bad" -eq 0 ]; then pass "all $n_mut mutable .svc/*.json resolve to svc-json driver"
  else fail "$bad/$n_mut mutable .svc/*.json NOT registered (union corrupts JSON — add to .gitattributes or gitignore):$(printf "$badlist")"; fi
fi

# .svc/*.jsonl must STAY union (don't regress the append-only protocol).
jl="$(git check-attr merge -- .svc/pipeline-decisions.jsonl 2>/dev/null | sed 's#.*merge: ##')"
[ "$jl" = "union" ] && pass ".svc/*.jsonl still merge=union (append-only intact)" || fail ".svc/*.jsonl merge attr regressed to '$jl' (expected union)"

# ---- C. Driver discipline (foreign-worktree safe, AC3) ----------------------
if grep -q 'process.argv' "$DRIVER"; then pass "driver reads paths from process.argv"; else fail "driver does not read process.argv (must use git-supplied paths)"; fi
if grep -q 'process.chdir' "$DRIVER"; then fail "driver calls process.chdir — cwd-dependent, foreign-worktree unsafe"; else pass "driver never chdir's"; fi
if grep -qE "writeFileSync\(\s*[\"']\.svc/" "$DRIVER"; then fail "driver writes a RELATIVE .svc/ path (a stray cd could redirect into a sibling worktree)"; else pass "driver writes only the git-supplied output path (no relative .svc write)"; fi

# ---- D. Installer is absolute-path / foreign-worktree safe (AC3) ------------
if grep -q 'rev-parse --show-toplevel' "$INSTALLER"; then pass "installer resolves absolute repo root (rev-parse --show-toplevel)"; else fail "installer does not resolve absolute repo root"; fi
if grep -q 'merge.svc-json.driver' "$INSTALLER"; then pass "installer registers merge.svc-json.driver"; else fail "installer does not register merge.svc-json.driver"; fi

# ---- E. setup wires the installer (fresh installs get protection) -----------
if grep -q 'install-svc-merge-driver' setup; then pass "setup wires install-svc-merge-driver"; else fail "setup does not run install-svc-merge-driver (fresh clones unprotected)"; fi

# ---- F. LIVE collision fixture: two-session merge WITHOUT LOSS (AC2) ---------
ABS_DRIVER="$REPO_ROOT/$DRIVER"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
git -C "$TMP" init -q
git -C "$TMP" config user.email t@svc.test; git -C "$TMP" config user.name svctest
# Register via the REAL installer (not a hand-written git config) so the fixture
# exercises install-svc-merge-driver.sh end-to-end (Gemini G6 #4).
if bash "$REPO_ROOT/$INSTALLER" --repo "$TMP" --driver "$ABS_DRIVER" >/dev/null 2>&1 \
   && [ -n "$(git -C "$TMP" config merge.svc-json.driver)" ]; then
  pass "installer registers driver in a fresh repo (end-to-end)"
else
  fail "installer failed to register driver via --repo/--driver"
fi
printf '*.json merge=svc-json\n' > "$TMP/.gitattributes"
printf '{\n  "tasks": [{"id":"t1","s":"done"}],\n  "meta": {"a":1}\n}\n' > "$TMP/state.json"
git -C "$TMP" add -A; git -C "$TMP" commit -qm base >/dev/null 2>&1
BR="$(git -C "$TMP" symbolic-ref --short HEAD)"
git -C "$TMP" checkout -q -b sessionA
printf '{\n  "tasks": [{"id":"t1","s":"done"},{"id":"t2"}],\n  "meta": {"a":1,"b":2}\n}\n' > "$TMP/state.json"
git -C "$TMP" commit -qam A >/dev/null 2>&1
git -C "$TMP" checkout -q "$BR"; git -C "$TMP" checkout -q -b sessionB
printf '{\n  "tasks": [{"id":"t1","s":"done"},{"id":"t3"}],\n  "meta": {"a":1,"c":3}\n}\n' > "$TMP/state.json"
git -C "$TMP" commit -qam B >/dev/null 2>&1
if git -C "$TMP" merge --no-edit sessionA >/dev/null 2>&1; then
  if node -e '
    const s=require(process.argv[1]);
    const ids=s.tasks.map(t=>t.id).sort().join(",");
    const mk=Object.keys(s.meta).sort().join(",");
    process.exit(ids==="t1,t2,t3" && mk==="a,b,c" ? 0 : 1);
  ' "$TMP/state.json"; then pass "two-session collision auto-merged WITHOUT LOSS (t1+t2+t3, meta a+b+c)"
  else fail "merge succeeded but LOST data (expected tasks t1,t2,t3 + meta a,b,c)"; fi
else
  fail "disjoint two-session collision conflicted (should auto-merge)"
fi

# ---- G. LIVE: a true overlapping scalar edit MUST conflict WITH VISIBLE MARKERS
git -C "$TMP" checkout -q "$BR"
printf '{\n  "n": 2\n}\n' > "$TMP/v.json"; git -C "$TMP" add -A; git -C "$TMP" commit -qm v0 >/dev/null 2>&1
V0="$(git -C "$TMP" rev-parse HEAD)"
git -C "$TMP" checkout -q -b confC
printf '{\n  "n": 5\n}\n' > "$TMP/v.json"; git -C "$TMP" commit -qam ours >/dev/null 2>&1
git -C "$TMP" checkout -q -b confD "$V0"
printf '{\n  "n": 9\n}\n' > "$TMP/v.json"; git -C "$TMP" commit -qam theirs >/dev/null 2>&1
if git -C "$TMP" merge --no-edit confC >/dev/null 2>&1; then
  fail "overlapping scalar edit auto-merged (SILENT LOSS — must conflict)"
else
  # Gemini G6 #1: %A must carry VISIBLE conflict markers (invalid JSON), so the
  # conflict cannot be silently `git add`ed as valid ours-only content.
  if grep -q '^<<<<<<< ours' "$TMP/v.json" && grep -q '^>>>>>>> theirs' "$TMP/v.json" \
     && ! node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$TMP/v.json" 2>/dev/null; then
    pass "overlapping edit conflicts WITH visible markers (no silent ours-only)"
  else
    fail "overlapping edit conflicted but %A has no visible markers (silent-loss risk)"
  fi
fi

# ---- H. LIVE: 3-way merge preserves legitimate DUPLICATE array elements ------
# Gemini G6 #2: a base array with a real duplicate, both sides adding different
# elements, must NOT collapse the duplicate.
git -C "$TMP" merge --abort 2>/dev/null || true   # clear the section-G conflict state
git -C "$TMP" checkout -q "$BR"
printf '{\n  "tags": ["x", "x"]\n}\n' > "$TMP/d.json"; git -C "$TMP" add -A; git -C "$TMP" commit -qm d0 >/dev/null 2>&1
D0="$(git -C "$TMP" rev-parse HEAD)"
git -C "$TMP" checkout -q -b dupO
printf '{\n  "tags": ["x", "x", "o"]\n}\n' > "$TMP/d.json"; git -C "$TMP" commit -qam dupO >/dev/null 2>&1
git -C "$TMP" checkout -q -b dupT "$D0"
printf '{\n  "tags": ["x", "x", "t"]\n}\n' > "$TMP/d.json"; git -C "$TMP" commit -qam dupT >/dev/null 2>&1
if git -C "$TMP" merge --no-edit dupO >/dev/null 2>&1 && node -e '
  const t=require(process.argv[1]).tags;
  const x=t.filter(v=>v==="x").length, o=t.filter(v=>v==="o").length, u=t.filter(v=>v==="t").length;
  process.exit(x===2 && o===1 && u===1 ? 0 : 1);
' "$TMP/d.json"; then pass "duplicate array elements preserved across 3-way merge (x×2 + o + t)"
else fail "duplicate array element collapsed or addition lost on merge"; fi

echo ".svc state merge safety: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
