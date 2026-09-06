#!/usr/bin/env bash
set -euo pipefail

# Keep standalone invocation isolated from active host/session state.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/fixture-home.sh"
svc_require_fixture "$@"

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SOURCE_ROOT="$REPO_ROOT/skills"
PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); }
fail() { printf '  FAIL: %s\n' "$1" >&2; FAIL=$((FAIL + 1)); }

mapfile -t manifest_skills < <(node -e 'const m=require(process.argv[1]); for (const s of m.includedSkills) console.log(s)' "$REPO_ROOT/skills-manifest.json")

for skill in "${manifest_skills[@]}"; do
  if [[ -f "$SOURCE_ROOT/$skill/SKILL.md" && ! -L "$SOURCE_ROOT/$skill" ]]; then
    pass
  else
    fail "manifest skill is not a real packaged source directory: $skill"
  fi
done

mapfile -t source_skills < <(find "$SOURCE_ROOT" -mindepth 2 -maxdepth 2 -type f -name SKILL.md -printf '%h\n' | sed 's#^.*/##' | sort)
mapfile -t expected_skills < <(printf '%s\n' "${manifest_skills[@]}" | sort)
if diff -u <(printf '%s\n' "${expected_skills[@]}") <(printf '%s\n' "${source_skills[@]}") >/dev/null; then
  pass
else
  fail "skills-manifest.json and packaged source directories are not a bijection"
fi

mapfile -t root_skill_files < <(find "$REPO_ROOT" -mindepth 2 -maxdepth 2 -name SKILL.md -not -path "$SOURCE_ROOT/*" -not -path "$REPO_ROOT/.worktrees/*")
if [[ ${#root_skill_files[@]} -eq 0 ]]; then
  pass
else
  fail "root-level skill directories remain: ${root_skill_files[*]}"
fi

if rg -n 'for d in "\$SCRIPT_DIR"/\*/|source_path="\$INSTALL_SOURCE_DIR/\$name"' "$REPO_ROOT/setup" "$REPO_ROOT/scripts/check-install-drift.sh" >/dev/null; then
  fail "installer or drift checker still assumes root-level source skills"
else
  pass
fi

fixture="$(mktemp -d)"
trap 'rm -rf "$fixture"' EXIT
mkdir -p "$fixture/home" "$fixture/target"
HOME="$fixture/home" SVC_SETUP_VALIDATE_ONLY=1 bash "$REPO_ROOT/setup" --host codex >"$fixture/setup.out"
if rg -q "${#manifest_skills[@]} skills discovered" "$fixture/setup.out"; then
  pass
else
  fail "setup did not discover all ${#manifest_skills[@]} registered packaged skills"
fi

fixture_repo="$fixture/repo"
mkdir -p "$fixture_repo"
cp "$REPO_ROOT/setup" "$fixture_repo/setup"
cp "$REPO_ROOT/skills-manifest.json" "$fixture_repo/skills-manifest.json"
cp -R "$REPO_ROOT/provision" "$fixture_repo/provision"
cp -R "$REPO_ROOT/skills" "$fixture_repo/skills"
node - "$fixture_repo/skills-manifest.json" <<'NODE'
const fs = require('node:fs');
const file = process.argv[2];
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
manifest.includedSkills[manifest.includedSkills.length - 1] = manifest.includedSkills[0];
fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
NODE
if HOME="$fixture/home" SVC_SETUP_VALIDATE_ONLY=1 bash "$fixture_repo/setup" --host codex >"$fixture/setup-duplicate.out" 2>"$fixture/setup-duplicate.err"; then
  fail "setup accepted a duplicate manifest name balanced by an undeclared source directory"
else
  pass
fi

if node --input-type=module - "$REPO_ROOT" <<'NODE'
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const repo = process.argv[2];
const { validateSkillSource } = await import(pathToFileURL(path.join(repo, 'scripts/lib/skill-source-layout.mjs')).href);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-skill-layout-'));
try {
  fs.mkdirSync(path.join(root, 'skills'));
  fs.mkdirSync(path.join(root, 'outside'));
  fs.writeFileSync(path.join(root, 'outside', 'SKILL.md'), '# escape\n');
  fs.symlinkSync(path.join(root, 'outside'), path.join(root, 'skills', 'directory-escape'));
  fs.mkdirSync(path.join(root, 'skills', 'file-escape'));
  fs.symlinkSync(path.join(root, 'outside', 'SKILL.md'), path.join(root, 'skills', 'file-escape', 'SKILL.md'));
  if (validateSkillSource(root, 'directory-escape').ok) process.exit(1);
  if (validateSkillSource(root, 'file-escape').ok) process.exit(1);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
NODE
then
  pass
else
  fail "source resolver accepted a symlink escape"
fi

printf '=== Tier 1: SVC packaged skill source layout ===\n'
printf '  %d passed, %d failed\n' "$PASS" "$FAIL"
[[ $FAIL -eq 0 ]]
