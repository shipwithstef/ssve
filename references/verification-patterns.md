# Verification Patterns — Existence Does Not Mean Implementation

A file that exists is not a file that works. The most common false-positive
in agentic development is "the file is there, therefore the feature is done."
This document defines the four verification levels that catch what existence
checks miss.

## The Four Levels

| Level | Name | Question | Catches |
|-------|------|----------|---------|
| **L1** | Exists | Does the file/function/component exist? | Missing files, deleted code, wrong paths |
| **L2** | Substantive | Is the implementation real, not a stub? | TODOs, placeholders, empty bodies, hardcoded returns |
| **L3** | Wired | Is it connected to the system? | Dead code, unused exports, missing route registrations, unlinked components |
| **L4** | Functional | Does it work when executed? | Logic bugs, runtime errors, integration failures, state management issues |

Each level subsumes the one below it. L4 (Functional) implies L3, L2, and L1.
But L1 (Exists) tells you nothing about L2, L3, or L4.

## When to Apply Each Level

| Context | Minimum Level |
|---------|--------------|
| Self-verify during execute-changeset | L1-L3 (per task) |
| Post-execution audit | L2-L3 (full diff) |
| QA / test-journeys | L4 (runtime proof) |
| verify-promotion | L3-L4 (full chain) |
| Quick smoke check | L1-L2 |

## Level 2: Stub Detection Patterns

### Universal Patterns

These indicate a placeholder, not a real implementation:

```
# TODO markers
TODO|FIXME|HACK|XXX|PLACEHOLDER|STUB|NOT_IMPLEMENTED

# Placeholder return values
return null|return undefined|return {}|return []|return ""
return "placeholder"|return "TODO"|return "not implemented"

# Empty implementations
\{\s*\}              # empty function body
pass$                # Python empty function
raise NotImplementedError

# Hardcoded values pretending to be logic
return true|return false    # (when the function should compute something)
return 0|return -1          # (sentinel values as implementation)
```

### React / JSX Patterns

```bash
# Placeholder components
grep -rn "return.*<div>TODO" src/
grep -rn "return.*<>.*placeholder" src/
grep -rn "return null" src/components/   # component that renders nothing
grep -rn "// TODO.*implement" src/components/

# Empty event handlers
grep -rn "onClick={() => {}}" src/
grep -rn "onChange={() => {}}" src/
grep -rn "onSubmit={() => {}}" src/

# Unused props (component accepts props but ignores them)
grep -rn "props)" src/ | grep -v "props\."

# Hardcoded data instead of API calls
grep -rn "const.*=.*\[" src/components/ | grep -i "mock\|fake\|dummy\|sample\|test"
```

### Node.js / Express Patterns

```bash
# Stub routes
grep -rn "res.json({}" src/routes/
grep -rn "res.send('TODO')" src/routes/
grep -rn "res.status(501)" src/routes/
grep -rn "next()" src/middleware/ | grep -v "next(err"  # middleware that just passes through

# Unimplemented service methods
grep -rn "async.*{" src/services/ -A2 | grep -B1 "return \[\]\|return {}\|return null"

# Hardcoded DB responses
grep -rn "return.*\[{" src/services/ | grep -i "id.*name\|mock\|fake"

# Missing error handling
grep -rn "catch.*{}" src/
grep -rn "catch.*{\s*}" src/
```

### Python Patterns

```bash
# Stub functions
grep -rn "pass$" src/ --include="*.py"
grep -rn "raise NotImplementedError" src/
grep -rn "# TODO" src/ --include="*.py"

# Placeholder returns
grep -rn "return None" src/ --include="*.py" | grep -v "__init__\|setter"
grep -rn "return \[\]" src/ --include="*.py"
grep -rn "return {}" src/ --include="*.py"

# Empty class bodies
grep -rn "class.*:" src/ --include="*.py" -A1 | grep "pass"
```

## Level 3: Wiring Detection

A substantive implementation that is not wired to anything is dead code.

```bash
# Exported but never imported (Node.js)
# For each export in the file, check if anything imports it
grep -rn "export" src/services/auth.ts | while read line; do
  func=$(echo "$line" | grep -oP "export (function|const|class) \K\w+")
  [ -n "$func" ] && echo "$func: $(grep -rl "$func" src/ | wc -l) imports"
done

# Component exists but no route points to it (React)
grep -rn "export default" src/pages/ | while read line; do
  file=$(echo "$line" | cut -d: -f1 | xargs basename | sed 's/\..*//')
  echo "$file: $(grep -rl "$file" src/App* src/routes* 2>/dev/null | wc -l) route refs"
done

# API route defined but no frontend calls it
grep -rn "router\.\(get\|post\|put\|delete\)" src/routes/ | while read line; do
  path=$(echo "$line" | grep -oP "'\K[^']+")
  echo "$path: $(grep -rl "$path" src/components/ src/pages/ src/hooks/ 2>/dev/null | wc -l) frontend refs"
done

# Python: class defined but never instantiated
grep -rn "class \w\+:" src/ --include="*.py" | while read line; do
  cls=$(echo "$line" | grep -oP "class \K\w+")
  echo "$cls: $(grep -rl "$cls()" src/ --include="*.py" | wc -l) instantiations"
done
```

## Level 4: Functional Verification

Level 4 requires runtime execution. It cannot be done by reading code.

| Method | What it proves |
|--------|---------------|
| Unit tests pass | Individual function logic works |
| Integration tests pass | Components work together |
| E2E tests pass | User flows work end-to-end |
| Manual QA (test-journeys) | Real user experience works |
| Health check endpoint | Service starts and responds |

## Quick Verification Commands

Run these after execute-changeset to catch the most common stub patterns
before moving to review:

```bash
# Catch all TODO/FIXME/STUB markers in changed files
git diff --name-only HEAD~1 | xargs grep -n "TODO\|FIXME\|STUB\|HACK\|PLACEHOLDER\|NOT_IMPLEMENTED" 2>/dev/null

# Catch empty function bodies in changed files
git diff --name-only HEAD~1 | xargs grep -n "() => {}" 2>/dev/null
git diff --name-only HEAD~1 | xargs grep -n "{\s*}" 2>/dev/null

# Catch placeholder returns in changed files
git diff --name-only HEAD~1 | xargs grep -n "return null\|return undefined\|return {}\|return \[\]\|return ''" 2>/dev/null

# Count substantive lines vs boilerplate in new files
git diff --name-only --diff-filter=A HEAD~1 | while read f; do
  total=$(wc -l < "$f" 2>/dev/null || echo 0)
  comments=$(grep -c "^\s*//\|^\s*#\|^\s*\*\|^\s*$" "$f" 2>/dev/null || echo 0)
  echo "$f: $total lines, $comments boilerplate ($((total - comments)) substantive)"
done
```

## Integration Coherence (Boundary Mismatch Detection)

**Existence ≠ Connection.** Verifying that an API exists is NOT the same as
verifying that the API response shape matches the consuming component's type.
The most frequent defects are at BOUNDARIES between components that each
work correctly in isolation.

### Principle: Read Both Sides Simultaneously

Never verify one side of a boundary in isolation. Always compare producer
AND consumer together.

### 4 Integration Coherence Areas

**1. API response ↔ consumer type:**
Cross-compare the actual response shape (what `NextResponse.json()` or the
API handler returns) against the consumer's expected type (what `fetchJson<T>`
or the calling hook expects). Watch for: wrapping (`{ data: [...] }` vs raw
array), case conversion (snake_case vs camelCase), sync vs async response
shape differences.

**2. File paths ↔ link/router targets:**
Extract URL patterns from page files, collect all `href`, `router.push()`,
`redirect()` values. Verify 1:1 match. Watch for: route groups removed from
URL, dynamic segments not filled, prefix mismatches.

**3. State transition map ↔ actual updates:**
Extract allowed transitions from the state machine definition. Find all
status update calls in code. Verify: every code transition is in the map
AND every map transition has code executing it. Flag dead transitions
(defined but never executed) and unauthorized transitions (executed but not
defined).

**4. API endpoints ↔ consumer hooks (1:1 mapping):**
List all API routes with HTTP methods. List all consumer hooks with fetch
URLs. Identify: unpaired APIs (endpoint exists but nothing calls it),
missing hooks (UI needs data but no hook fetches it).

### When to Apply

- `audit-implementation` — check integration boundaries before landing
- `verify-promotion` — check that promoted code has no boundary mismatches
- `review-gate` G5 — boundary coherence as part of post-execution review

### Why Static Review Misses These

- TypeScript generics mask shape mismatches at compile time
- `npm run build` passes ≠ works correctly (type casting, `any`)
- Individual file review sees each side as correct — only cross-comparison reveals the mismatch

Source: Harness QA agent guide, boundary mismatch patterns from SatangSlide project.

## Cross-References

- `execute-changeset/SKILL.md` — Self-verify during execution (L1-L3)
- `verify-promotion/SKILL.md` — Post-promotion verification (L3-L4)
- `references/anti-patterns.md` — Anti-pattern: treating existence as completion
- `references/agent-patterns.md` — Agent team dispatch patterns
