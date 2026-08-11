# Kimi Host Detection & Model Resolution Eval

## Setup
- **Host:** Kimi Code CLI
- **Skills needed:** none (framework infrastructure test)

## Prompt
```
Run the following commands and report the results:
1. bash scripts/detect-host.sh
2. bash scripts/resolve-model.sh STRAT --json
3. bash scripts/resolve-model.sh EXEC --json

Verify that:
- The detected host is "kimi"
- The STRAT model resolves to kimi-for-coding with thinking=true
- The EXEC model resolves to kimi-for-coding with thinking=true
```

## Expected Outputs

### File Exists
- `scripts/detect-host.sh`
- `scripts/resolve-model.sh`
- `references/model-registry.json`

### Content Checks
- "kimi" in output
- "kimi-for-coding" in output
- "thinking": true in output

### Output Assertions
- "kimi"
- "kimi-for-coding"
