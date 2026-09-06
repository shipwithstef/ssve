#!/usr/bin/env bash
# WI-FW-HOOKS-SAFETY-01 T01/AC-1: literal Git-ref validation + path-independent
# worktree identity. Hermetic (temp repo, no network, no LLM).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); printf 'ok - %s\n' "$1"; }
bad() { FAIL=$((FAIL+1)); printf 'FAIL - %s\n' "$1"; }


NODE_IMPORTS='
import { validateLiteralBranchName, isValidLiteralBranchName, worktreeLeafFor, needsDerivedWorktreeLeaf } from "'"$ROOT"'/hooks/lib/literal-branch.mjs";
import { parseBootstrapCommand } from "'"$ROOT"'/hooks/codex/lib/bootstrap-command.mjs";
import { encodeSimpleCommand, assertArgvRoundTrip } from "'"$ROOT"'/hooks/codex/lib/argv-encode.mjs";
'

# --- validator: accepted Git-valid refs --------------------------------------
for b in "main" "feat/wt-lane-fw-hooks-safety" "fix/a/b/c" "wi-fw-hooks-safety-01" "release-1.2.3"; do
  if BRANCH_CASE="$b" node --input-type=module -e "${NODE_IMPORTS}console.log(validateLiteralBranchName(process.env.BRANCH_CASE).ok)" | grep -q true; then
    ok "accepts Git-valid ref $b"
  else bad "should accept Git-valid ref $b"; fi
done

# --- validator: rejected traversal / shorthand / hostile candidates ----------
for b in "../x" "a..b" "a//b" "a.lock" "@{-1}" "-x" "a b" "a~b" "a^b" "a:b" "a?b" "a*b" "a[b" "a\\b"; do
  if BRANCH_CASE="$b" node --input-type=module -e "${NODE_IMPORTS}console.log(validateLiteralBranchName(process.env.BRANCH_CASE).ok)" | grep -q false; then
    ok "rejects hostile candidate $b"
  else bad "should reject hostile candidate $b"; fi
done

# --- bootstrap parser accepts slash branch, rejects traversal ----------------
RESULT="$(node --input-type=module -e "${NODE_IMPORTS}
const good = parseBootstrapCommand('node scripts/svc-ensure-worktree.mjs --wi WI-FW-HOOKS-SAFETY-01 --branch feat/wt-lane-fw-hooks-safety');
const evil = parseBootstrapCommand('node scripts/svc-ensure-worktree.mjs --wi WI-FW-HOOKS-SAFETY-01 --branch ../escape');
console.log(good && good.branch === 'feat/wt-lane-fw-hooks-safety' && !evil ? 'pass' : 'fail')")"
[[ "$RESULT" == "pass" ]] && ok "bootstrap parse accepts slash branch and rejects traversal" || bad "bootstrap parse slash/traversal ($RESULT)"

# --- encoder round trip preserves exact bytes --------------------------------
R1="$(R1_CASE=1 node --input-type=module -e "${NODE_IMPORTS}
console.log(assertArgvRoundTrip(['git','status','--porcelain=v1','-z']).ok)")"
R2="$(TRICKY='["echo","it'"'"'s","a|b","$HOME","two words"]' node --input-type=module -e "${NODE_IMPORTS}console.log(assertArgvRoundTrip(JSON.parse(process.env.TRICKY)).ok)")"
[[ "$R1" == "true" && "$R2" == "true" ]] && ok "encoder round trip byte-exact for quoted/metachar args" || bad "encoder round trip ($R1/$R2)"

# --- worktree leaf derivation -------------------------------------------------
L1="$(node --input-type=module -e "${NODE_IMPORTS}console.log(needsDerivedWorktreeLeaf('feat/x') + ':' + needsDerivedWorktreeLeaf('plain-branch'))")"
[[ "$L1" == "true:false" ]] && ok "derivation applies to slash branches only" || bad "derivation gate ($L1)"
A="$(node --input-type=module -e "${NODE_IMPORTS}console.log(worktreeLeafFor('feat/same','WI-1'))")"
B="$(node --input-type=module -e "${NODE_IMPORTS}console.log(worktreeLeafFor('feat/same-too','WI-1'))")"
if [[ "$A" != "$B" && "$A" == *"-same-"* ]]; then ok "colliding readable slugs produce distinct hash-derived leaves"; else bad "leaf collision ($A vs $B)"; fi

# --- end-to-end ensure-worktree with a slash branch ---------------------------
REPO="$TMP/repo"; mkdir -p "$REPO"
git -C "$REPO" init -q -b main
git -C "$REPO" config user.email t@t.local; git -C "$REPO" config user.name t
printf '.worktrees/\n.svc/\n' > "$REPO/.gitignore"
git -C "$REPO" add .gitignore && git -C "$REPO" commit -qm base
mkdir -p "$TMP/origin.git" && git -C "$TMP/origin.git" init -q --bare
git -C "$REPO" remote add origin "$TMP/origin.git"
git -C "$REPO" push -q origin main
SLASH="feat/wi-fw-hooks-safety-check"
OUT="$(cd "$REPO" && SVC_SESSION_ID=11111111-1111-4111-8111-000000000001 node "$ROOT/scripts/svc-ensure-worktree.mjs" --wi WI-FW-HOOKS-SAFETY-01 --branch "$SLASH" --json 2>"$TMP/e2e.err" || true)"
WT_PATH="$(printf '%s' "$OUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).absolute_worktree||"")}catch{console.log("")}})')"
LEAF="$(basename "$WT_PATH")"
if [[ -n "$WT_PATH" && -d "$WT_PATH" && "$WT_PATH" == *".worktrees/"* && "$LEAF" != "$SLASH" && "$LEAF" =~ [0-9a-f]{12}$ ]]; then
  ok "slash branch bootstraps into a derived (non-ref-text) worktree path: $(basename "$WT_PATH")"
else bad "slash-branch bootstrap failed (path='$WT_PATH') err=$(tail -1 "$TMP/e2e.err" 2>/dev/null || echo none)"; fi

# resume through the SAME registered branch still resolves the same worktree
OUT2="$(cd "$REPO" && SVC_SESSION_ID=11111111-1111-4111-8111-000000000001 node "$ROOT/scripts/svc-ensure-worktree.mjs" --wi WI-FW-HOOKS-SAFETY-01 --branch "$SLASH" --json 2>/dev/null || true)"
WT_PATH2="$(printf '%s' "$OUT2" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).absolute_worktree||"")}catch{console.log("")}})')"
[[ "$WT_PATH2" == "$WT_PATH" ]] && ok "slash-branch resume is stable across invocations" || bad "slash-branch resume drift"

# registered external worktree under an APPROVED root is adoptable
EXTROOT="$TMP/approved-roots/ext"
mkdir -p "$(dirname "$EXTROOT")"
EXT_BRANCH="lane/external-adoption"
git -C "$REPO" worktree add -q -b "$EXT_BRANCH" "$EXTROOT" origin/main 2>/dev/null || git -C "$REPO" worktree add -q -b "$EXT_BRANCH" "$EXTROOT" main
APPROVED_OUT="$(cd "$REPO" && SVC_SESSION_ID=22222222-2222-4222-8222-000000000002 SVC_APPROVED_WORKTREE_ROOTS="$TMP/approved-roots" node "$ROOT/scripts/svc-ensure-worktree.mjs" --wi WI-FW-HOOKS-SAFETY-02 --branch "$EXT_BRANCH" --json 2>"$TMP/ext.err" || true)"
if printf '%s' "$APPROVED_OUT" | grep -q "\"absolute_worktree\":\"$EXTROOT\""; then
  ok "registered external worktree adopted beneath approved root"
else bad "approved external adoption failed: $(tail -1 "$TMP/ext.err" 2>/dev/null || echo none)"; fi

# A complete same-session tuple is durable exact-target authorization.
for resume_attempt in 1 2; do
  RESUME_OUT="$(cd "$REPO" && SVC_SESSION_ID=22222222-2222-4222-8222-000000000002 node "$ROOT/scripts/svc-ensure-worktree.mjs" --wi WI-FW-HOOKS-SAFETY-02 --branch "$EXT_BRANCH" --json 2>"$TMP/resume.err" || true)"
  if [[ "$RESUME_OUT" == *'"resumed":true'* && "$RESUME_OUT" == *'"claim_generation":1'* ]]; then
    ok "registered external same-session resume $resume_attempt without root environment"
  else bad "same-session durable authorization lost: $(tail -1 "$TMP/resume.err")"; fi
done

# Model a parent UID change after initial adoption without privileged chown.
cat > "$TMP/foreign-parent.mjs" <<'JS'
import fs from 'node:fs';
const original = fs.lstatSync;
fs.lstatSync = function(file, ...args) {
  const stat = original.call(this, file, ...args);
  if (String(file) !== process.env.SVC_FIXTURE_FOREIGN_PARENT) return stat;
  const foreign = Object.create(stat); foreign.uid = process.getuid() + 1; return foreign;
};
JS
PARENT_GRAPH="$EXTROOT/.svc/lane-tasks-WI-FW-HOOKS-SAFETY-02.json"
cp "$PARENT_GRAPH" "$TMP/parent-graph.saved"
PARENT_ERR="$(cd "$REPO" && SVC_FIXTURE_FOREIGN_PARENT="$TMP/approved-roots" SVC_SESSION_ID=22222222-2222-4222-8222-000000000002 node --import "$TMP/foreign-parent.mjs" "$ROOT/scripts/svc-ensure-worktree.mjs" --wi WI-FW-HOOKS-SAFETY-02 --branch "$EXT_BRANCH" --json 2>&1 >/dev/null || true)"
[[ "$PARENT_ERR" == *WORKTREE_ROOT_UNAPPROVED* ]] && cmp -s "$PARENT_GRAPH" "$TMP/parent-graph.saved" && ok "foreign-owned immediate parent denied without state repair" || bad "foreign parent accepted or graph changed"

# Invalid identity and malformed/released state never gain root approval.
WRONG_WI_ERR="$(cd "$REPO" && SVC_SESSION_ID=22222222-2222-4222-8222-000000000002 node "$ROOT/scripts/svc-ensure-worktree.mjs" --wi WI-OTHER-01 --branch "$EXT_BRANCH" --json 2>&1 >/dev/null || true)"
[[ "$WRONG_WI_ERR" == *WORKTREE_ROOT_UNAPPROVED* ]] && ok "same session wrong WI retains root denial" || bad "wrong WI unexpectedly authorized"
GRAPH="$EXTROOT/.svc/lane-tasks-WI-FW-HOOKS-SAFETY-02.json"
cp "$GRAPH" "$TMP/graph.saved"
printf '{malformed' > "$GRAPH"
CORRUPT_ERR="$(cd "$REPO" && SVC_SESSION_ID=22222222-2222-4222-8222-000000000002 node "$ROOT/scripts/svc-ensure-worktree.mjs" --wi WI-FW-HOOKS-SAFETY-02 --branch "$EXT_BRANCH" --json 2>&1 >/dev/null || true)"
[[ "$CORRUPT_ERR" == *WORKTREE_ROOT_UNAPPROVED* && "$(cat "$GRAPH")" == '{malformed' ]] && ok "corrupt graph denied without target repair" || bad "corrupt graph was accepted or rewritten"
cp "$TMP/graph.saved" "$GRAPH"
BINDING="$(node --input-type=module -e 'import {bindingPath} from "'"$ROOT"'/hooks/lib/wi-claim.mjs";console.log(bindingPath(process.argv[1],"22222222-2222-4222-8222-000000000002"))' "$EXTROOT")"
cp "$BINDING" "$TMP/binding.saved"
node -e 'const fs=require("fs");const p=process.argv[1],v=JSON.parse(fs.readFileSync(p));v.released_at=new Date().toISOString();fs.writeFileSync(p,JSON.stringify(v));' "$BINDING"
RELEASED_ERR="$(cd "$REPO" && SVC_SESSION_ID=22222222-2222-4222-8222-000000000002 node "$ROOT/scripts/svc-ensure-worktree.mjs" --wi WI-FW-HOOKS-SAFETY-02 --branch "$EXT_BRANCH" --json 2>&1 >/dev/null || true)"
[[ "$RELEASED_ERR" == *WORKTREE_ROOT_UNAPPROVED* ]] && ok "released binding cannot grant external root" || bad "released binding unexpectedly authorized"
cp "$TMP/binding.saved" "$BINDING"

FOREIGN_ERR="$(cd "$REPO" && SVC_SESSION_ID=33333333-3333-4333-8333-000000000003 node "$ROOT/scripts/svc-ensure-worktree.mjs" --wi WI-FW-HOOKS-SAFETY-02 --branch "$EXT_BRANCH" --json 2>&1 >/dev/null || true)"
[[ "$FOREIGN_ERR" == *WORKTREE_ROOT_UNAPPROVED* ]] && ok "foreign session same WI denied" || bad "foreign session same WI unexpectedly authorized"
MARKER="$(node --input-type=module -e 'import {markerPathFor} from "'"$ROOT"'/hooks/codex/lib/bootstrap-marker.mjs";console.log(markerPathFor(process.argv[1],"WI-FW-HOOKS-SAFETY-02"))' "$REPO")"
mkdir -p "$(dirname "$MARKER")"
printf '{}' > "$MARKER"
MARKER_ERR="$(cd "$REPO" && SVC_SESSION_ID=22222222-2222-4222-8222-000000000002 node "$ROOT/scripts/svc-ensure-worktree.mjs" --wi WI-FW-HOOKS-SAFETY-02 --branch "$EXT_BRANCH" --json 2>&1 >/dev/null || true)"
[[ "$MARKER_ERR" == *WORKTREE_ROOT_UNAPPROVED* && "$(cat "$MARKER")" == '{}' ]] && ok "resume approval does not authorize forward completion or erase marker" || bad "marker recovery unexpectedly authorized"
rm "$MARKER"

mv "$EXTROOT/.svc" "$EXTROOT/.svc-saved"
ln -s .svc-saved "$EXTROOT/.svc"
SYMLINK_ERR="$(cd "$REPO" && SVC_SESSION_ID=22222222-2222-4222-8222-000000000002 node "$ROOT/scripts/svc-ensure-worktree.mjs" --wi WI-FW-HOOKS-SAFETY-02 --branch "$EXT_BRANCH" --json 2>&1 >/dev/null || true)"
[[ "$SYMLINK_ERR" == *WORKTREE_ROOT_UNAPPROVED* && -L "$EXTROOT/.svc" ]] && ok "unsafe state ancestry denied without repairing symlink" || bad "unsafe state ancestry unexpectedly authorized"
rm "$EXTROOT/.svc"
mv "$EXTROOT/.svc-saved" "$EXTROOT/.svc"

# same external worktree WITHOUT approved root stays fail-closed, no mutation
UNAPPROVED_ERR="$(cd "$REPO" && SVC_SESSION_ID=33333333-3333-4333-8333-000000000003 node "$ROOT/scripts/svc-ensure-worktree.mjs" --wi WI-FW-HOOKS-SAFETY-03 --branch "$EXT_BRANCH" --json 2>&1 >/dev/null || true)"
if printf '%s' "$UNAPPROVED_ERR" | grep -q "containment root"; then
  ok "unapproved external root denied without mutation"
else bad "unapproved external root was not denied: $UNAPPROVED_ERR"; fi

printf '\nT01 literal-branch/worktree: %s passed, %s failed\n' "$PASS" "$FAIL"
[[ "$FAIL" -eq 0 ]]
