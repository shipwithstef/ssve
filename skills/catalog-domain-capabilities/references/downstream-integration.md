## Downstream Integration Contract

### For `write-journeys`
Reads `capability-catalog.data.json` to scaffold standard journeys:
- "Onboarding in [domain] typically requires capabilities: ..."
- Maps capability IDs to journey steps
- Auto-runs capability journey scaffolding after catalog generation:

```bash
node skills/write-journeys/scripts/capability-journeys.mjs --root .
```

This produces `docs/specs/journeys/J-CAP-<capability>.feature.md` for recognized
table-stakes capabilities only when stack matchers prove the capability is
implemented. This avoids false positives in greenfield catalogs.

### For `write-spec`
Reads catalog to verify spec completeness:
- "Your spec covers authentication. The catalog shows 4 mechanics in this domain.
  Which does your spec implement?"
- Flags: "Universal capability 'data export' is not mentioned in any spec."

### For `audit-coverage`
Uses catalog as the **coverage checklist**:
- Compares repo-canonical artifacts against catalog
- Coverage score = % of universal + common capabilities with spec/journey traces

### For `validate-feature`
- "Feature idea X maps to capability Y (BPS 22, common, must-be)."
- "3 competitors implement this via mechanic Z."
- Checks catalog for dependency gaps: "Your feature requires capability Z (V0). Build Z first."

### Query API (for downstream skills)

Downstream skills can query the catalog without loading the full JSON:

```bash
# List all P0 gaps for a specific journey
node skills/catalog-domain-capabilities/scripts/query-capability-catalog.mjs \
  --journey onboarding --status MISSING --min-bps 25 --markdown

# List converging capabilities (opportunity radar)
node skills/catalog-domain-capabilities/scripts/query-capability-catalog.mjs \
  --preset converging --markdown

# Get journey scaffolding for a new domain
node skills/catalog-domain-capabilities/scripts/query-capability-catalog.mjs \
  --preset journey-scaffold --journey onboarding
```

**Presets:**
| Preset | What it returns | Use in |
|---|---|---|
| `gaps` | All V0/V1/V2 gaps sorted by BPS | audit-coverage |
| `converging` | Capabilities with accelerating/explosive convergence | roadmap-evaluation |
| `top-p0` | P0 capabilities by BPS desc | write-spec |
| `journey-scaffold` | Capabilities mapped to a given journey | write-journeys |

**Available filters:** `--journey`, `--status` (COVERED/PARTIAL/MISSING), `--kano`, `--convergence`, `--category`, `--min-bps`, `--depth` (1-4), `--limit`

**Available sorts:** `bps` (default), `name`, `frequency`, `maturity`

---
