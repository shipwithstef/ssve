#!/usr/bin/env bash
# WI-498 (F-005): anti-regression guard for the install-anchored-resolution
# invariant. An svc executable path (task-graph.mjs / codex-load-skill.mjs /
# svc-ensure-worktree.mjs / state-io.mjs / *.sh under scripts|hooks) that is then
# spawned/exec'd MUST be resolved from the install (self-located via import.meta.url
# / __dirname), NEVER from a consumer-controlled base (cwd, process.cwd(), worktree,
# a walked-up dir, or a repo/root derived from the consumer). Deriving an exec path
# from consumer state is the untrusted-path / consumer-shadow RCE class.
#
# Detection is SOURCE-base first: it flags any `path.join|resolve(<consumer-base>,
# … <svc-executable>)`. The allowlist below is the CHECKED-IN disposition for the
# few legitimately project-local or install-source resolutions (see the WI-498
# Semantic Inventory in the manifest).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"

FAIL=0
# consumer-controlled base identifiers that must NOT anchor an executable path.
# NOTE (G6-F004): this grep tripwire catches the DIRECT `path.join(<base>, …exec)`
# idiom — the form every real regression to date has taken. It is a REGRESSION
# GUARD, not a completeness proof: a path built in two steps, via a helper, or off
# a base name not listed here can evade it. The authoritative completeness record
# is the checked-in Executable-path Semantic Inventory in the WI-498 manifest;
# reviewers reconcile new exec sinks against it. Keep BASES broad.
BASES='cwd|process\.cwd\(\)|worktree|scriptsDir|scriptsPath|repoRoot|repo_root|projectRoot|PROJECT_ROOT|\bws\b|\broot\b|\bdir\b|startDir|laneTasksDir'
# svc executables whose resolution is security-sensitive. GENERIC (G6-R3-F008):
# ANY .sh under hooks/ or scripts/ is an executable sink (G6-F006 caught the
# svc-task-completion-guard.sh case; the class is every shell script, not one file),
# plus the named security-sensitive .mjs helpers. False positives on data-read .sh
# are dispositioned via the checked-in allowlist below.
EXECS='task-graph\.mjs|codex-load-skill\.mjs|svc-ensure-worktree\.mjs|state-io\.mjs|codex-hook-context\.mjs|[A-Za-z0-9_-]+\.sh'
PATTERN="path\.(join|resolve)\((${BASES})[^)]*(${EXECS})"

# ALLOWLIST — checked-in disposition (file:reason). Any hit here is intentional.
allowed() {
  case "$1" in
    scripts/scenario-runner.mjs) return 0 ;;      # test harness: framework-repo only, cascades FRAMEWORK_ROOT then ws
    scripts/kimi-e2e-test.mjs) return 0 ;;         # test harness: framework-repo only
    scripts/framework-test-catalog.mjs) return 0 ;;# test harness: symlinks install scripts into a fixture
    scripts/svc-migrate-install.mjs) return 0 ;;   # install-time: repoRoot IS the framework SOURCE being installed from
    scripts/spine-gap-spawn.mjs) return 0 ;;       # imports ./state-io.mjs sibling (same-dir, install-relative)
    hooks/opencode/svc-opencode-plugin.ts) return 0 ;; # scriptsPath is INSTALL-derived via findSkillsPath() (verified ~/.claude/skills or ~/.config/opencode/skills, gated on skills/route-workflow/SKILL.md presence) — not consumer-derived (F-004 validated skills-root binding)
    scripts/validate-hook-host-residuals.mjs) return 0 ;; # readFileSync (DATA read of the guard's CONTENT for residual-checking), never exec/spawn — not an executable-resolution sink
  esac
  return 1
}

echo "== scanning scripts/ hooks/ bin/ for consumer-anchored svc executable paths =="
HITS="$(grep -rEln "$PATTERN" scripts/ hooks/ bin/ 2>/dev/null || true)"
VIOLATIONS=""
for f in $HITS; do
  if allowed "$f"; then
    echo "  allow - $f (checked-in disposition)"
  else
    echo "  FAIL  - $f resolves an svc executable from a consumer base:"
    grep -nE "$PATTERN" "$f" | sed 's/^/          /'
    VIOLATIONS="$VIOLATIONS $f"
    FAIL=1
  fi
done
[ -z "$VIOLATIONS" ] && echo "  ok    - no un-allowlisted consumer-anchored executable resolution"

echo "== self-test: detector catches a seeded violation (must-catch) =="
SEED="$(mktemp)"; trap 'rm -f "$SEED"' EXIT
printf 'const p = path.join(cwd, "scripts", "task-graph.mjs");\n' > "$SEED"
if grep -qE "$PATTERN" "$SEED"; then echo "  ok    - positive seed flagged (.mjs)"; else echo "  FAIL  - detector missed a real .mjs violation"; FAIL=1; fi
# G6-F006: a consumer-relative .sh execution sink must also be caught.
SEED_SH="$(mktemp)"; trap 'rm -f "$SEED" "$SEED_SH"' EXIT
printf 'const g = path.join(repo_root, "hooks", "svc-task-completion-guard.sh");\n' > "$SEED_SH"
if grep -qE "$PATTERN" "$SEED_SH"; then echo "  ok    - positive seed flagged (.sh)"; else echo "  FAIL  - detector missed a real .sh violation"; FAIL=1; fi

echo "== self-test: detector does NOT flag install-anchored resolution (must-not-flag) =="
NEG="$(mktemp)"; trap 'rm -f "$SEED" "$NEG"' EXIT
printf 'const p = path.join(path.dirname(fileURLToPath(import.meta.url)), "task-graph.mjs");\n' > "$NEG"
if grep -qE "$PATTERN" "$NEG"; then echo "  FAIL  - detector false-positive on install-anchored path"; FAIL=1; else echo "  ok    - negative seed not flagged"; fi

if [ "$FAIL" -eq 0 ]; then echo "TIER-1 PASS: validate-install-anchored-resolution"; else echo "TIER-1 FAIL: validate-install-anchored-resolution"; exit 1; fi
