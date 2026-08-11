# Tool Selection Hygiene

## No Agent for Known Targets

Never spawn Agent or Explore subagents when you already know the file path(s) AND the search pattern. Use Read or Grep directly.

**Decision tree before any Agent spawn:**
1. Do I know the exact file path? → Read or Grep. Stop.
2. Do I know the directory + a grep pattern? → Grep with path. Stop.
3. Am I searching unknown locations or need multi-round exploration? → Agent is justified.

**Why:** Each agent spawn copies full conversation context (~130K+ tokens). A direct Grep or Read call costs ~1-2K tokens. When the target is already known, agents are 100x more expensive for the same result.

**Common traps:**
- "Check if these 20 IDs are marked in this spec file" → Grep, not Explore
- "Read this config and tell me the value of X" → Read, not Agent
- "Find all uses of this function in this file" → Grep, not general-purpose Agent
- "What files match *.spec.ts in e2e/" → Glob, not Explore
