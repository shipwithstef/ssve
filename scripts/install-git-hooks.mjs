#!/usr/bin/env node
/**
 * Installs the svc chain hook dispatchers into `.git/hooks/`.
 *
 * Dispatcher pattern: `.git/hooks/<event>` is a tiny shell script that runs
 * every executable in `hooks/git/<event>.d/` in lexical order.
 *
 * Migration: if `.git/hooks/<event>` is an existing single symlink (e.g.
 * pointing at hooks/svc-pre-commit-multi-host-check.sh), the existing
 * target is moved to the appropriate `00-<name>` slot in the .d/ directory.
 *
 * Also configures git for refs/notes/svc-receipts push refspec.
 *
 * Hard-fails on any install error.
 */

import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readlinkSync,
  lstatSync,
  unlinkSync,
  writeFileSync,
  chmodSync,
  symlinkSync,
  copyFileSync,
  readFileSync,
} from "node:fs";
import { join, basename, resolve } from "node:path";

const REPO_ROOT = process.cwd();
const HOOKS_DIR_REPO = join(REPO_ROOT, "hooks", "git");
const EVENTS = ["pre-commit", "post-commit", "pre-push"];
// WI-557-v2: pre-commit.d/25-impact-triad retired (mid-execution gate moved to
// boundaries); auto-receipt.mjs generates triad bodies instead of a git hook.
// F-001a (WI-SSVE exec review r4): slot 21 is a REQUIRED installed slot.
const REQUIRED_SLOTS = ["pre-commit.d/20-quick-fix-eligibility", "pre-commit.d/21-manifest-integrity"];
// Package-owned slots only. A user may track a custom hook in this repo;
// trackedness or an `svc-` basename is not ownership evidence.
const SVC_SLOTS = {
  "pre-commit": ["10-default-checkout-isolation", "15-lane-tasks-validate", "20-quick-fix-eligibility", "21-manifest-integrity", "00-svc-pre-commit-multi-host-check"],
  "post-commit": ["10-receipt-promote"],
  "pre-push": ["10-receipts-complete", "15-tier1-gate", "20-push-notes-ref"],
};

function git(args) {
  return execSync(`git ${args}`, { encoding: "utf8" }).trim();
}

function gitHooksPath() {
  // Honors worktrees: uses common .git dir
  const commonDir = git("rev-parse --git-common-dir");
  return join(commonDir, "hooks");
}

function makeDispatcher(event) {
  const slotNames = SVC_SLOTS[event];
  const svcCase = slotNames.map((name) => JSON.stringify(name)).join("|") || '"__no_svc_slots__"';
  const body = `#!/usr/bin/env bash
# svc chain dispatcher for ${event} — installed by scripts/install-git-hooks.mjs
# Runs every executable in hooks/git/${event}.d/ in lexical order.
# Fail-fast: first non-zero exit aborts.

set -u
REPO_ROOT="$(git rev-parse --show-toplevel)"
SLOT_DIR="$REPO_ROOT/hooks/git/${event}.d"
SVC_MODE="$(node "$REPO_ROOT/scripts/hook-mode.mjs" || printf advisory)"

if [[ ! -d "$SLOT_DIR" ]]; then
  exit 0
fi

# Capture stdin once and replay to every slot — multiple slots can read the
# git hook payload (pre-push protocol rows); without this, the first
# stdin-consuming slot starves the rest (WI-358 G6 EXEC-001).
STDIN_CAPTURE="$(mktemp /tmp/svc-hook-stdin.XXXXXX)"
trap 'rm -f "$STDIN_CAPTURE"' EXIT
cat > "$STDIN_CAPTURE" 2>/dev/null || true

for slot in "$SLOT_DIR"/*; do
  [[ -x "$slot" ]] || continue
  if [[ "$SVC_MODE" != enforce ]]; then
    case "${event}:$(basename "$slot")" in
      pre-push:15-tier1-gate)
        echo "[svc advisory ${event}] full Tier 1 is deferred; run bash test-framework/evals/run-all-evals.sh before landing" >&2
        continue ;;
      pre-commit:00-svc-pre-commit-multi-host-check)
        echo "[svc advisory ${event}] multi-host setup is deferred; run ./setup --all-hosts and bash scripts/check-install-drift.sh --all-hosts" >&2
        continue ;;
    esac
  fi
  case "$(basename "$slot")" in
    ${svcCase})
      # Bound SVC hook work and its descendants before considering the result.
      node "$REPO_ROOT/scripts/git-hook-slot.mjs" "$slot" "$@" < "$STDIN_CAPTURE"
      ;;
    *) "$slot" "$@" < "$STDIN_CAPTURE" ;;
  esac
  code=$?
  if [[ $code -ne 0 ]]; then
    case "$(basename "$slot")" in
      ${svcCase})
        if [[ "$SVC_MODE" != enforce ]]; then
          echo "[svc advisory ${event}] slot $(basename "$slot") failed (exit $code); continuing" >&2
          continue
        fi
        ;;
    esac
    echo "${event} slot $(basename "$slot") failed (exit $code)" >&2
    exit $code
  fi
done
exit 0
`;
  return body;
}

function migrateExistingHook(hooksPath, event) {
  const eventPath = join(hooksPath, event);
  if (!existsSync(eventPath)) return null;
  let target = null;
  try {
    const stat = lstatSync(eventPath);
    if (stat.isSymbolicLink()) {
      target = readlinkSync(eventPath);
    }
  } catch (e) {
    return null;
  }
  // Read content to check if it's already the dispatcher
  let isDispatcher = false;
  try {
    const content = readFileSync(eventPath, "utf8");
    if (content.includes("svc chain dispatcher")) isDispatcher = true;
  } catch (e) {}
  if (isDispatcher) return "already-dispatcher";

  // Migrate: move target into 00-<name> slot
  const slotDir = join(HOOKS_DIR_REPO, `${event}.d`);
  mkdirSync(slotDir, { recursive: true });
  if (target) {
    const resolvedTarget = resolve(hooksPath, target);
    const slotName = "00-" + basename(resolvedTarget, ".sh");
    const slotPath = join(slotDir, slotName);
    if (!existsSync(slotPath)) {
      symlinkSync(resolvedTarget, slotPath);
    }
  }
  if (!target) {
    const slotPath = join(slotDir, `00-existing-${event}`);
    if (existsSync(slotPath)) {
      const oldBytes = readFileSync(eventPath);
      const preservedBytes = readFileSync(slotPath);
      if (!oldBytes.equals(preservedBytes)) throw new Error(`cannot preserve existing ${event} hook: ${slotPath} already differs`);
    } else {
      copyFileSync(eventPath, slotPath);
      chmodSync(slotPath, lstatSync(eventPath).mode & 0o777);
    }
  }
  unlinkSync(eventPath);
  return "migrated";
}

function installDispatcher(hooksPath, event) {
  const eventPath = join(hooksPath, event);
  writeFileSync(eventPath, makeDispatcher(event));
  chmodSync(eventPath, 0o755);
}

function ensureNotesRefspec() {
  // Add refs/notes/svc-receipts to the push refspec for origin
  try {
    const existing = execSync("git config --get-all remote.origin.push 2>/dev/null || true", { encoding: "utf8" });
    if (existing.includes("refs/notes/svc-receipts")) return false;
    execSync(`git config --add remote.origin.push '+refs/notes/svc-receipts:refs/notes/svc-receipts'`);
    return true;
  } catch (e) {
    return false;
  }
}

function ensureFetchRefspec() {
  try {
    const existing = execSync("git config --get-all remote.origin.fetch 2>/dev/null || true", { encoding: "utf8" });
    if (existing.includes("refs/notes/svc-receipts")) return false;
    execSync(`git config --add remote.origin.fetch '+refs/notes/svc-receipts:refs/notes/svc-receipts'`);
    return true;
  } catch (e) {
    return false;
  }
}

function main() {
  for (const relative of REQUIRED_SLOTS) {
    const slot = join(HOOKS_DIR_REPO, relative);
    if (!existsSync(slot) || !lstatSync(slot).isFile()) {
      throw new Error(`required git hook slot missing: hooks/git/${relative}`);
    }
    chmodSync(slot, 0o755);
  }
  const hooksPath = gitHooksPath();
  mkdirSync(hooksPath, { recursive: true });

  const report = { events: {}, notesPushAdded: false, notesFetchAdded: false };

  for (const event of EVENTS) {
    const migration = migrateExistingHook(hooksPath, event);
    installDispatcher(hooksPath, event);
    report.events[event] = migration || "installed";
  }

  report.notesPushAdded = ensureNotesRefspec();
  report.notesFetchAdded = ensureFetchRefspec();

  console.log(JSON.stringify({ ok: true, ...report }, null, 2));
}

main();
