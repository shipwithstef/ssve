#!/bin/bash
# scripts/resolve-model.sh — Resolve a cognitive label to the harness + model ID via the active profile.
#
# Usage:
#   bash scripts/resolve-model.sh <cognitive_label>
#   bash scripts/resolve-model.sh <cognitive_label> --json
#   bash scripts/resolve-model.sh <cognitive_label> --harness-only
#   bash scripts/resolve-model.sh <cognitive_label> --thinking
#   bash scripts/resolve-model.sh <cognitive_label> --invocation
#
# Examples:
#   bash scripts/resolve-model.sh STRAT
#   bash scripts/resolve-model.sh EXEC --json
#   bash scripts/resolve-model.sh REVIEW --thinking
#
# Cognitive labels: STRAT, PLAN, EXEC, REVIEW, SENSE, DISC, PASS
#
# Exit codes:
#   0 — success
#   1 — unknown label, profile, or host not detected
#   2 — bad arguments

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REGISTRY="$SCRIPT_DIR/../references/model-registry.json"
LABEL="${1:-}"
FORMAT="${2:-}"

if [ -z "$LABEL" ] || [ ! -f "$REGISTRY" ]; then
  echo "Usage: bash scripts/resolve-model.sh <STRAT|PLAN|EXEC|REVIEW|SENSE|DISC|PASS> [--json|--harness-only|--thinking|--effort|--invocation]" >&2
  exit 2
fi

# Detect current orchestrator host
HOST="$(bash "$SCRIPT_DIR/detect-host.sh")"

if [ "$HOST" = "unknown" ]; then
  HOST="${SVC_PREFERRED_MODEL_FAMILY:-unknown}"
fi

if [ "$HOST" = "unknown" ]; then
  echo "Error: could not detect orchestrator host and SVC_PREFERRED_MODEL_FAMILY is not set" >&2
  exit 1
fi

# Determine active profile
PROFILE="${SVC_MODEL_PROFILE:-}"

if [ -z "$PROFILE" ]; then
  # Auto-select profile based on orchestrator host
  case "$HOST" in
    kimi)  PROFILE="kimi-native" ;;
    codex) PROFILE="codex-native" ;;
    *)     PROFILE="svc-default" ;;
  esac
fi

# Resolve from registry using python3 (always available)
python3 -c "
import json, sys

reg = json.load(open('$REGISTRY'))
label = '$LABEL'.upper()
profile_name = '$PROFILE'
host = '$HOST'

profile = reg.get('profiles', {}).get(profile_name)
if not profile:
    print(f'Error: profile \"{profile_name}\" not found in registry', file=sys.stderr)
    sys.exit(1)

label_cfg = profile.get('labels', {}).get(label)
if not label_cfg:
    print(f'Error: label \"{label}\" not found in profile \"{profile_name}\"', file=sys.stderr)
    sys.exit(1)

harness_name = label_cfg.get('harness', '')
model_key = label_cfg.get('model', '')
tool = label_cfg.get('tool', '')
thinking = label_cfg.get('thinking')
effort = label_cfg.get('effort')  # WI-470: reasoning-effort tier (low|medium|high|xhigh|max)

harnesses = reg.get('harnesses', {})
harness = harnesses.get(harness_name, {})

result = {
    'host': host,
    'profile': profile_name,
    'label': label,
    'harness': harness_name,
    'rationale': label_cfg.get('rationale', ''),
}

if tool:
    # Native tool (DISC)
    native_tools = harness.get('tools', {})
    result['tool'] = native_tools.get(host, tool)
    result['provider'] = 'native'
else:
    # External model
    models = harness.get('models', {})
    model_cfg = models.get(model_key, {})
    result['model'] = model_cfg.get('id', model_key)
    result['provider'] = harness_name
    result['contextWindow'] = model_cfg.get('contextWindow')
    result['invocation'] = model_cfg.get('invocation', '')
    if thinking is not None:
        result['thinking'] = thinking
    if effort is not None:
        result['effort'] = effort

# Output based on format flag
fmt = '$FORMAT'

if fmt == '--json':
    print(json.dumps(result, indent=2))
elif fmt == '--harness-only':
    print(harness_name)
elif fmt == '--thinking':
    print('true' if thinking else 'false')
elif fmt == '--effort':
    print(effort or '')
elif fmt == '--invocation':
    print(result.get('invocation', ''))
else:
    # Default: provider:model or native:tool
    if result.get('tool'):
        print(f'native:{result[\"tool\"]}')
    else:
        print(f'{result[\"provider\"]}:{result[\"model\"]}')
" || exit 1
