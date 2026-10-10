### Zombie Capability Detection

A zombie capability is one that exists in the project's code/specs but does NOT appear in the domain catalog's L1-L3 tiers. These represent potentially dead code, over-engineering, or premature abstractions.

**Detection flow:**
```bash
# Extract capability mentions from existing specs
node skills/catalog-domain-capabilities/scripts/query-capability-catalog.mjs \
  --catalogPath docs/specs/capability-catalog.data.json \
  --status MISSING \
  --markdown > /tmp/coverage_gaps.md

# Cross-reference: which "existing" capabilities aren't in the domain catalog?
grep -oE '^\|[^|]+\|' docs/specs/capability-catalog.md | sed 's/|//g' > /tmp/project_caps.txt
grep -oE '^\|[^|]+\|' /tmp/coverage_gaps.md | sed 's/|//g' > /tmp/missing_caps.txt
# Zombies = in project_caps but not in missing_caps (already cataloged) and not in L1-L3
```

**Zombie scoring:**
| Indicator | Weight | Action |
|---|---|---|
| No competitor implements it | +3 | Likely over-engineering |
| No journey maps to it | +2 | Unused feature |
| Code exists but no spec | +2 | Dead code candidate |
| Last touched >6 months ago | +1 | Stale code |
| Score ≥ 6 | | Flag as zombie; recommend deprecation audit |

Zombie capabilities are stored in `zombie_capabilities[]` in the machine artifact.

---
