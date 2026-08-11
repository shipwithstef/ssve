#!/usr/bin/env bash
# scripts/inventory-graph-readers.sh (WI-486 task-1)
#
# Reproducible generator for two frozen WI-486 evidence artifacts:
#
#   (default mode)             -> docs/specs/test-evidence/WI-486/graph-reader-inventory.txt
#       The set of tracked CODE files that read the lane-tasks graph, MINUS the
#       authority-consumer allowlist. These are the "regression-only" graph
#       readers whose authority semantics WI-486 must NOT change. The count is
#       PRODUCED here, never asserted as prose, and re-validated at the task-6a
#       freeze (the frozen re-run must reproduce this artifact byte-for-byte).
#
#   --emit-declared-file-set   -> docs/specs/test-evidence/WI-486/declared-file-set.txt
#       Every path the task-6a `git add` will stage (no directory expansion),
#       sorted and unique. The generator lists its OWN output path (declared-
#       file-set.txt) so there is no self-reference gap. 6b-only follow-up-PR
#       files and the preserved session contract are excluded.
#
# Determinism: the graph-reader grep is pinned to the immutable $BASE tree so
# WI-486's own new tracked files never perturb the frozen count. Both outputs
# are pure functions of ($BASE tree + this script), so task-6a re-validation is
# a simple regenerate-and-diff.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Pinned immutable declared base (manifest §A). Overridable for local testing.
BASE="${BASE:-99da8bcf873d4d2a7b2a2becfb19759c71e3d2de}"

EVID_DIR="docs/specs/test-evidence/WI-486"
INVENTORY_OUT="$EVID_DIR/graph-reader-inventory.txt"
DECLARED_OUT="$EVID_DIR/declared-file-set.txt"
PLAN_DIR="docs/plans/2026-07-15-wi486-session-isolated-bootstrap"

mkdir -p "$EVID_DIR"

MODE="inventory"
if [[ "${1:-}" == "--emit-declared-file-set" ]]; then
  MODE="declared"
elif [[ -n "${1:-}" ]]; then
  echo "usage: $0 [--emit-declared-file-set]" >&2
  exit 2
fi

if [[ "$MODE" == "inventory" ]]; then
  # Authority-consumer allowlist — the exact tuple mutation-authority consumers.
  # They read the graph as AUTHORITY, not as regression-only readers, so they are
  # subtracted from the inventory.
  ALLOWLIST="$(printf '%s\n' \
    hooks/lib/resolve-wi.mjs \
    hooks/codex/lib/codex-hook-context.mjs \
    hooks/codex/svc-codex-skill-load-enforcer.mjs \
    scripts/svc-ensure-worktree.mjs \
    hooks/svc-task-completion-guard.sh | sort -u)"

  # Graph readers = tracked code files in the $BASE tree that reference the
  # lane-tasks graph. Pinned to $BASE for reproducibility.
  READERS="$(git grep -lE 'lane-tasks' "$BASE" -- '*.mjs' '*.cjs' '*.js' '*.sh' '*.ts' \
    | sed "s#^${BASE}:##" | sort -u)"

  NET="$(comm -23 <(printf '%s\n' "$READERS") <(printf '%s\n' "$ALLOWLIST") | sed '/^$/d')"
  COUNT="$(printf '%s\n' "$NET" | sed '/^$/d' | wc -l | tr -d ' ')"

  {
    echo "# WI-486 frozen graph-reader inventory"
    echo "# generator:  scripts/inventory-graph-readers.sh"
    echo "# base:       $BASE"
    echo "# definition: tracked code files (*.mjs,*.cjs,*.js,*.sh,*.ts) in the \$BASE tree"
    echo "#             whose content matches /lane-tasks/, minus the authority-consumer"
    echo "#             allowlist (resolve-wi.mjs, the two Codex authority files,"
    echo "#             svc-ensure-worktree.mjs, svc-task-completion-guard.sh)."
    echo "# meaning:    regression-only readers whose authority semantics WI-486 must NOT change."
    printf '%s\n' "$NET"
    echo "graph_reader_count=$COUNT"
  } > "$INVENTORY_OUT"

  echo "wrote $INVENTORY_OUT ($COUNT graph readers)"
  exit 0
fi

# --- declared-file-set mode ---------------------------------------------------
# Enumerated 6a-staged paths from the manifest §Files Planned table. This list is
# authoritative (not existence-checked): several paths are authored by tasks 2-5
# and only exist at the freeze. 6b-only files (post-change-tier1-frozen.md,
# pre-post-evidence.json, WI-486.md, INDEX.md, the verification record) and the
# preserved .svc/session-contract.jsonl are deliberately absent.
ENUMERATED="$(cat <<EOF
.gitignore
hooks/lib/resolve-wi.mjs
hooks/codex/lib/codex-hook-context.mjs
hooks/codex/svc-codex-skill-load-enforcer.mjs
hooks/lib/wi-claim.mjs
hooks/svc-task-completion-guard.sh
hooks/lib/task-state-compatibility.mjs
scripts/svc-ensure-worktree.mjs
scripts/svc-migrate-task-state.mjs
scripts/inventory-graph-readers.sh
schemas/task-state-migration-receipt.schema.json
test-framework/evals/tier-1/validate-session-authority-isolation.sh
test-framework/evals/tier-1/validate-task-state-compatibility.sh
test-framework/evals/tier-1/validate-default-checkout-isolation.sh
test-framework/evals/tier-1/validate-session-worktree-binding.sh
test-framework/evals/tier-1/validate-codex-execution-integrity.sh
$EVID_DIR/declared-file-set.txt
$EVID_DIR/graph-reader-inventory.txt
$EVID_DIR/pre-change-tier1-baseline.md
docs/specs/features/wi-486-session-isolated-bootstrap.md
docs/specs/journeys/J-FW-05-multi-session-contention.feature.md
docs/specs/bugfix/wi-486-session-bootstrap-brief.md
docs/specs/decisions/wi-486-session-isolated-bootstrap.md
docs/specs/reviews/wi-486-exec-cross-model.md
docs/specs/reviews/wi-486-security.md
docs/specs/reviews/wi-486-gate.md
docs/specs/audit/wi-486-session-isolated-bootstrap-analysis.md
$PLAN_DIR/manifest.md
$PLAN_DIR/review-log.yaml
$PLAN_DIR/progress.md
.svc/lane-tasks-WI-486.json
.svc/pipeline-decisions.jsonl
EOF
)"

# Plan-phase review-round findings artifacts present at generation time (manifest §E).
PLAN_ARTIFACTS="$(ls -1 "$PLAN_DIR"/review-round*-findings.json 2>/dev/null || true)"

{ printf '%s\n' "$ENUMERATED"; printf '%s\n' "$PLAN_ARTIFACTS"; } \
  | sed '/^$/d' | sort -u > "$DECLARED_OUT"

echo "wrote $DECLARED_OUT ($(sed '/^$/d' "$DECLARED_OUT" | wc -l | tr -d ' ') paths)"
