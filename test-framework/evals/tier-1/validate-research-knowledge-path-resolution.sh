#!/usr/bin/env bash
# Tier 1 — research knowledge path resolution (WI-303).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

pass=0
fail=0

assert_node() {
  local json="$1"
  local expr="$2"
  local label="$3"
  if JSON_PAYLOAD="$json" node -e "const data = JSON.parse(process.env.JSON_PAYLOAD); if (!(${expr})) process.exit(1);"; then
    pass=$((pass + 1))
  else
    echo "  FAIL: $label"
    fail=$((fail + 1))
  fi
}

project_dir="$TMP_DIR/project"
override_root="$TMP_DIR/override-knowledge"
mkdir -p "$project_dir" "$project_dir/docs/specs" "$override_root/domains/custom" "$override_root/example"

default_out="$(
  cd "$project_dir"
  node "$REPO_ROOT/skills/research/scripts/domain-gate.mjs" \
    --source fixture \
    --domain agent-harnesses \
    --justification "fixture existing domain"
)"

expected_default="$REPO_ROOT/references/knowledge"
assert_node "$default_out" "data.verdict === 'approved'" "domain-gate approves existing default framework domain"
assert_node "$default_out" "data.knowledge_root === '$expected_default'" "domain-gate default root is framework references/knowledge"

if [[ -d "$project_dir/references/knowledge" ]]; then
  echo "  FAIL: domain-gate created project-local references/knowledge"
  fail=$((fail + 1))
else
  pass=$((pass + 1))
fi

override_out="$(
  cd "$project_dir"
  SVC_KNOWLEDGE_DIR="$override_root" node "$REPO_ROOT/skills/research/scripts/domain-gate.mjs" \
    --source fixture \
    --domain custom \
    --justification "fixture override domain"
)"

assert_node "$override_out" "data.verdict === 'approved'" "domain-gate approves override-root domain"
assert_node "$override_out" "data.knowledge_root === '$override_root'" "SVC_KNOWLEDGE_DIR overrides default root"

cat > "$project_dir/docs/specs/research-prescope-fixture.md" <<'EOF'
# Research Pre-Scope Fixture

## File checklist

- [ ] https://example.com/a
EOF

cat > "$override_root/example/.sources.jsonl" <<'EOF'
{"url":"https://example.com/a","sha256":"fixture","retrieved_at":"2026-05-11T00:00:00Z","retrieval_method":"local-file","extracted_into":["CAPABILITIES.md"]}
EOF

coverage_out="$(
  cd "$project_dir"
  SVC_KNOWLEDGE_DIR="$override_root" node "$REPO_ROOT/skills/research/scripts/coverage-check.mjs" \
    --prescope docs/specs/research-prescope-fixture.md \
    --domain references/knowledge/example
)"
export COVERAGE_OUT="$coverage_out"

assert_node "$coverage_out" "data.verdict === 'pass'" "coverage-check resolves relative knowledge domain through override root"
assert_node "$coverage_out" "data.domain === '$override_root/example'" "coverage-check reports resolved override domain path"
assert_node "$coverage_out" "typeof data.lock_id === 'string' && data.lock_id.length === 16" "coverage-check emits domain-specific lock id"
assert_node "$coverage_out" "data.lock_path === '.svc/coverage-locks/' + data.lock_id + '.json'" "coverage-check reports domain-specific lock path"

coverage_lock="$(cat "$project_dir/.svc/coverage.lock")"
assert_node "$coverage_lock" "data.prescope === 'docs/specs/research-prescope-fixture.md' && data.domain === '$override_root/example'" "coverage.lock matches current prescope and resolved domain"
assert_node "$coverage_lock" "data.lock_id === JSON.parse(process.env.COVERAGE_OUT).lock_id" "coverage.lock lock id matches stdout"

domain_lock="$(cat "$project_dir/$(JSON_PAYLOAD="$coverage_out" node -e 'const d=JSON.parse(process.env.JSON_PAYLOAD); process.stdout.write(d.lock_path);')")"
assert_node "$domain_lock" "data.lock_id === JSON.parse(process.env.COVERAGE_OUT).lock_id" "domain-specific coverage lock matches stdout"

if [[ -e "$project_dir/references/knowledge/example/.sources.jsonl" ]]; then
  echo "  FAIL: coverage-check read or created project-local references/knowledge"
  fail=$((fail + 1))
else
  pass=$((pass + 1))
fi

if grep -q "SVC_KNOWLEDGE_DIR" "$REPO_ROOT/skills/research/SKILL.md" \
  && grep -q "knowledge_root" "$REPO_ROOT/skills/research/SKILL.md"; then
  pass=$((pass + 1))
else
  echo "  FAIL: skills/research/SKILL.md does not document override and resolved root"
  fail=$((fail + 1))
fi

if grep -q "resolveKnowledgePath" "$REPO_ROOT/skills/research/scripts/synthesize-meaning.mjs" \
  && grep -q "resolveKnowledgePath" "$REPO_ROOT/skills/research/scripts/blog-crawl.mjs" \
  && grep -q "resolveKnowledgePath" "$REPO_ROOT/skills/research/scripts/coverage-check.mjs"; then
  pass=$((pass + 1))
else
  echo "  FAIL: knowledge-writing helpers do not use shared resolver"
  fail=$((fail + 1))
fi

echo "  validate-research-knowledge-path-resolution: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
