# Scenario: kimi-host-detection-eval

## Setup
A fresh shell environment where `KIMI_CLI_HOST` and `KIMI_CLI_API_KEY` may or may not be set. The `scripts/detect-host.sh` script exists in the repo.

## Invocation
"Run host detection" or "what host am I on?"

## Expected Behavior
1. MUST detect Kimi CLI when `kimi` binary is in `$PATH` and `KIMI_CLI_HOST` contains `kimi`.
2. MUST detect Claude Code when `claude` binary is in `$PATH`.
3. MUST detect Codex CLI when `codex` binary is in `$PATH`.
4. MUST fall back to `unknown` when no recognized host binary is found.

## Success Criteria
- [ ] Host detection script returns within 2 seconds
- [ ] Output is valid JSON with `host`, `version`, and `capabilities` fields
- [ ] No false positives (e.g., does not claim Claude when only Kimi is installed)
- [ ] Handles missing binaries gracefully (exit code 0, host=unknown)
