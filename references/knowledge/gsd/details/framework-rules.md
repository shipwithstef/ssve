# GSD Framework Rules (v1.50.0)

## Package Legitimacy Gate (v1.42.0)
GSD implements a rigorous three-layer defense against "slopsquatting" (AI-hallucinated package names that are pre-registered on package registries by attackers).

1. **Layer 1: Researcher Verification**
   The `gsd-phase-researcher` must run `slopcheck install <pkgs> --json` before recommending any packages. It emits a `## Package Legitimacy Audit` table in `RESEARCH.md`.
   - Packages flagged as `[SLOP]` are stripped outright.
   - Any package found only via WebSearch is tagged `[ASSUMED]`, not `[VERIFIED]`.

2. **Layer 2: Planner Enforcement**
   The planner blocks any plan requiring package installs if the Legitimacy Audit table is missing from `RESEARCH.md`.

3. **Layer 3: Executor Guard**
   The executor's RULE 3 explicitly strips auto-fix privileges for package-manager operations. If an install fails or involves an `[ASSUMED]` package, it surfaces a `checkpoint:human-verify` and halts execution rather than guessing an alternative package name.
