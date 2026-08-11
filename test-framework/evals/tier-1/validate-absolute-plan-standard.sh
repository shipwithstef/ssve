#!/usr/bin/env bash
# Tier 1: Validate that the mechanical plan linter successfully enforces 
# the Absolute Plan Standard (C7, C8, and C9 checks).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
LINTER="$REPO_ROOT/scripts/verify-plan-mechanical.sh"

PASS=0
FAIL=0
ERRORS=""

ok() {
  PASS=$((PASS + 1))
}

bad() {
  local message="$1"
  ERRORS+="  FAIL: $message\n"
  FAIL=$((FAIL + 1))
}

if [[ -f "$LINTER" ]]; then
  ok
else
  bad "linter missing: scripts/verify-plan-mechanical.sh"
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# 1. Positive case: A perfectly valid manifest containing C7, C8, and C9 structures.
cat > "$TMP_DIR/valid_manifest.md" <<'EOF'
# Test Plan Manifest

## Execution Command Sequence

```bash
npm run test
```

## Prerequisite Alignment Matrix

| ID | Prereq | Status |
|----|--------|--------|
| 1  | None   | Done   |

We are editing `package.json` with the following changes:

<<<<<<< BEFORE
1
2
3
=======
a
b
c
>>>>>>> AFTER

EOF

# 2. Negative case: Missing execution sequence (C7)
cat > "$TMP_DIR/invalid_c7_missing.md" <<'EOF'
# Test Plan Manifest

## Prerequisite Alignment Matrix

| ID | Prereq | Status |
|----|--------|--------|
| 1  | None   | Done   |

<<<<<<< BEFORE
1
2
3
=======
a
b
c
>>>>>>> AFTER
EOF

# 3. Negative case: Execution sequence missing fenced shell block (C7)
cat > "$TMP_DIR/invalid_c7_no_fence.md" <<'EOF'
# Test Plan Manifest

## Execution Command Sequence

No fenced block here! Just text.

## Prerequisite Alignment Matrix

| ID | Prereq | Status |
|----|--------|--------|
| 1  | None   | Done   |

<<<<<<< BEFORE
1
2
3
=======
a
b
c
>>>>>>> AFTER
EOF

# 4. Negative case: Insufficient BEFORE context lines in diff blueprint (C8)
cat > "$TMP_DIR/invalid_c8_before_context.md" <<'EOF'
# Test Plan Manifest

## Execution Command Sequence

```bash
npm run test
```

## Prerequisite Alignment Matrix

| ID | Prereq | Status |
|----|--------|--------|
| 1  | None   | Done   |

<<<<<<< BEFORE
1
=======
a
b
c
>>>>>>> AFTER
EOF

# 5. Negative case: Insufficient AFTER context lines in diff blueprint (C8)
cat > "$TMP_DIR/invalid_c8_after_context.md" <<'EOF'
# Test Plan Manifest

## Execution Command Sequence

```bash
npm run test
```

## Prerequisite Alignment Matrix

| ID | Prereq | Status |
|----|--------|--------|
| 1  | None   | Done   |

<<<<<<< BEFORE
1
2
3
=======
a
>>>>>>> AFTER
EOF

# 6. Negative case: Missing prerequisite matrix (C9)
cat > "$TMP_DIR/invalid_c9_missing.md" <<'EOF'
# Test Plan Manifest

## Execution Command Sequence

```bash
npm run test
```

<<<<<<< BEFORE
1
2
3
=======
a
b
c
>>>>>>> AFTER
EOF

# 7. Negative case: Prerequisite matrix lacks a valid mapping table (C9)
cat > "$TMP_DIR/invalid_c9_no_table.md" <<'EOF'
# Test Plan Manifest

## Execution Command Sequence

```bash
npm run test
```

## Prerequisite Alignment Matrix

No table here, just plain text description.

<<<<<<< BEFORE
1
2
3
=======
a
b
c
>>>>>>> AFTER
EOF

# 8. WI-386 positive case: an INLINE-mode manifest carries NO diff blueprints (§3a is
# skipped on the inline path) yet still has the Execution Command Sequence (C7) and the
# Prerequisite Alignment Matrix (C9). The markdown linter is mode-agnostic — C8 fires
# only on `<<<<<<< BEFORE` markers, so their absence is a legitimate no-op, not a fail.
# This guards the WI-386 C7/C9 reconciliation: mode-conditional blueprints must NOT make
# a valid inline plan fail the mechanical standard.
cat > "$TMP_DIR/valid_inline_no_blueprints.md" <<'EOF'
# Test Plan Manifest (inline mode — WI-386)

Execution mode: inline. §3a Changeset Blueprint intentionally omitted.

## Execution Command Sequence

```bash
npm run test
```

## Prerequisite Alignment Matrix

| ID | Prereq | Status |
|----|--------|--------|
| 1  | None   | Done   |
EOF


# --- RUN THE LINTER CHECKS ---

# Check 1: Positive Case
output=$(bash "$LINTER" "$TMP_DIR/valid_manifest.md" "$REPO_ROOT" 2>&1 || true)
if echo "$output" | grep -q "TIER-1 PASS"; then
  ok
else
  bad "Valid manifest failed the linter. Output:\n$output"
fi

# Check 2: C7 Missing
output=$(bash "$LINTER" "$TMP_DIR/invalid_c7_missing.md" "$REPO_ROOT" 2>&1 || true)
if echo "$output" | grep -q "TIER-1 FAIL"; then
  if echo "$output" | grep -q "C7-FAIL"; then
    ok
  else
    bad "Manifest with missing Execution Sequence failed without C7-FAIL code. Output:\n$output"
  fi
else
  bad "Manifest with missing Execution Sequence should have failed"
fi

# Check 3: C7 Missing Fenced Block
output=$(bash "$LINTER" "$TMP_DIR/invalid_c7_no_fence.md" "$REPO_ROOT" 2>&1 || true)
if echo "$output" | grep -q "TIER-1 FAIL"; then
  if echo "$output" | grep -q "C7-FAIL"; then
    ok
  else
    bad "Manifest with no fenced block failed without C7-FAIL code. Output:\n$output"
  fi
else
  bad "Manifest with no fenced block in Execution Sequence should have failed"
fi

# Check 4: C8 Insufficient BEFORE Context
output=$(bash "$LINTER" "$TMP_DIR/invalid_c8_before_context.md" "$REPO_ROOT" 2>&1 || true)
if echo "$output" | grep -q "TIER-1 FAIL"; then
  if echo "$output" | grep -q "C8-FAIL"; then
    ok
  else
    bad "Manifest with insufficient BEFORE context failed without C8-FAIL code. Output:\n$output"
  fi
else
  bad "Manifest with insufficient BEFORE context should have failed"
fi

# Check 5: C8 Insufficient AFTER Context
output=$(bash "$LINTER" "$TMP_DIR/invalid_c8_after_context.md" "$REPO_ROOT" 2>&1 || true)
if echo "$output" | grep -q "TIER-1 FAIL"; then
  if echo "$output" | grep -q "C8-FAIL"; then
    ok
  else
    bad "Manifest with insufficient AFTER context failed without C8-FAIL code. Output:\n$output"
  fi
else
  bad "Manifest with insufficient AFTER context should have failed"
fi

# Check 6: C9 Missing Matrix
output=$(bash "$LINTER" "$TMP_DIR/invalid_c9_missing.md" "$REPO_ROOT" 2>&1 || true)
if echo "$output" | grep -q "TIER-1 FAIL"; then
  if echo "$output" | grep -q "C9-FAIL"; then
    ok
  else
    bad "Manifest with missing Prerequisite Matrix failed without C9-FAIL code. Output:\n$output"
  fi
else
  bad "Manifest with missing Prerequisite Matrix should have failed"
fi

# Check 7: C9 Missing Table
output=$(bash "$LINTER" "$TMP_DIR/invalid_c9_no_table.md" "$REPO_ROOT" 2>&1 || true)
if echo "$output" | grep -q "TIER-1 FAIL"; then
  if echo "$output" | grep -q "C9-FAIL"; then
    ok
  else
    bad "Manifest with no table failed without C9-FAIL code. Output:\n$output"
  fi
else
  bad "Manifest with no table in Prerequisite Matrix should have failed"
fi

# Check 8: WI-386 inline-mode manifest with no diff blueprints must PASS the linter.
output=$(bash "$LINTER" "$TMP_DIR/valid_inline_no_blueprints.md" "$REPO_ROOT" 2>&1 || true)
if echo "$output" | grep -q "TIER-1 PASS"; then
  ok
else
  bad "WI-386: inline-mode manifest (no diff blueprints, has C7+C9) should PASS but did not. Output:\n$output"
fi


echo "=== Tier 1: Absolute Plan Standard Validation === "
echo "  $PASS passed, $FAIL failed"
if [[ $FAIL -gt 0 ]]; then
  echo ""
  printf "$ERRORS"
  exit 1
else
  echo "  PASS — Absolute Plan Standard validation correctly enforced"
  exit 0
fi
