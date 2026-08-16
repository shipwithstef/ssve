#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

node --input-type=module <<'NODE'
import assert from "node:assert/strict";
import { classifyBashMutationTargets } from "./hooks/lib/bash-mutation-targets.mjs";
const cwd = "/repo";
const cases = [
  ["cat README.md", []],
  ["printf ok > docs/specs/features/x.md", ["/repo/docs/specs/features/x.md"]],
  ["printf ok>docs/specs/features/x.md", ["/repo/docs/specs/features/x.md"]],
  ["env MODE=x touch docs/specs/features/x.md", ["/repo/docs/specs/features/x.md"]],
  ["jq . in.json > package-lock.json", ["/repo/package-lock.json"]],
  ["sed -i 's/a/b/' hooks/hooks.json", ["/repo/hooks/hooks.json"]],
  ["python3 -c \"open('docs/specs/plans/x.md','w').write('x')\"", ["/repo/docs/specs/plans/x.md"]],
  ["python3 -c \"from pathlib import Path; Path('FRAMEWORK-STATE.md').write_text('x')\"", ["/repo/FRAMEWORK-STATE.md"]],
  ["echo x | tee docs/specs/research-log.md", ["/repo/docs/specs/research-log.md"]],
  ["node -e 'require(\"fs\").writeFileSync(\"FRAMEWORK-STATE.md\",\"x\")'", ["/repo/FRAMEWORK-STATE.md"]],
  ["ruby -e 'File.write(\"hooks/hooks.json\", \"x\")'", ["/repo/hooks/hooks.json"]],
  ["perl -pi -e 's/a/b/' hooks/hooks.json", ["/repo/hooks/hooks.json"]],
  ["cp -t docs/specs source.md", ["/repo/docs/specs"]],
  ["dd if=input of=docs/specs/output.bin", ["/repo/docs/specs/output.bin"]],
  ["bash -c 'touch docs/specs/nested.md'", ["/repo/docs/specs/nested.md"]],
  ["sudo -u fixture -- touch docs/specs/sudo.md", ["/repo/docs/specs/sudo.md"]],
  ["command -- env MODE=x sudo --user=fixture touch hooks/hooks.json", ["/repo/hooks/hooks.json"]],
];
for (const [command, expected] of cases) assert.deepEqual(classifyBashMutationTargets(command, { cwd }), expected, command);
NODE

# Every concrete target is evaluated. A lexically earlier ungoverned target
# must not launder a later write into a governed repo with a missing contract.
mkdir -p "$TMP/a-open" "$TMP/z-governed/.git" "$TMP/z-governed/.svc"
PAYLOAD=$(printf '{"tool_name":"Bash","tool_input":{"command":"touch %s %s"},"cwd":"%s"}' "$TMP/a-open/x" "$TMP/z-governed/protected" "$TMP")
if printf '%s' "$PAYLOAD" | node hooks/svc-session-contract-freshness.mjs >/dev/null 2>&1; then
  echo "FAIL: later governed mutation target bypassed freshness guard" >&2
  exit 1
fi

mkdir -p "$TMP/guarded/docs/specs/features" "$TMP/guarded/hooks" "$TMP/guarded/.git" "$TMP/guarded/.svc"
printf '%s\n' '# demo' > "$TMP/guarded/docs/specs/features/demo.md"
printf '%s\n' '{}' > "$TMP/guarded/hooks/hooks.json"
for tuple in \
  "hooks/svc-skill-artifact-authenticity.mjs|$TMP/guarded/docs/specs/features/demo.md" \
  "hooks/svc-session-contract-freshness.mjs|$TMP/guarded/hooks/hooks.json" \
  "hooks/svc-workflow-guard.mjs|$TMP/guarded/package-lock.json"
do
  guard="${tuple%%|*}"; target="${tuple#*|}"
  payload=$(printf '{"tool_name":"Bash","tool_input":{"command":"sudo -u fixture -- touch %s"},"cwd":"%s"}' "$target" "$TMP/guarded")
  if printf '%s' "$payload" | node "$guard" >/dev/null 2>&1; then
    echo "FAIL: $guard missed option-bearing sudo mutation" >&2; exit 1
  fi
done

grep -q 'classifyBashMutationTargets' hooks/svc-workflow-guard.mjs
grep -q 'classifyBashMutationTargets' hooks/svc-skill-artifact-authenticity.mjs
grep -q 'classifyBashMutationTargets' hooks/svc-session-contract-freshness.mjs
node -e 'const h=require("./hooks/hooks.json").hooks.PreToolUse; for (const id of ["svc-skill-artifact-authenticity","svc-session-contract-freshness"]) { const x=h.find(v=>v.id===id); if (!x || !x.matcher.includes("Bash")) process.exit(1); }'

echo "PASS: concrete Bash writers inherit all path-specific guards; reads stay target-free"
