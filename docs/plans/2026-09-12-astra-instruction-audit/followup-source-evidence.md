# Additional source evidence for round 2

## references/model-routing.md
Source SHA256: d506fa762aad20b950601c105d85b038a5a6379cf610480c709ad9982b453aa3

1: # Cognitive Model Routing Taxonomy
2: 
3: > **MIRROR:** model IDs/tables below mirror `references/model-registry.json` (single source). Edit the registry first, then sync this file. Cross-check: WI-357 validation command. Full generation pending WI-364.
4: 
5: This document defines the **host-agnostic** model selection strategy for Serious Vibe Coding. The framework separates:
6: 
7: - **Orchestrator** — the CLI host running the session (Claude Code, Kimi CLI, etc.)
8: - **Execution Harness** — the model/system that handles each cognitive label
9: - **Profile** — the mapping from labels to harnesses
10: 
11: Skills reference **cognitive labels** (e.g., `[STRAT]`, `[EXEC]`). The framework resolves each label via `scripts/resolve-model.sh`, which reads the active **profile** from `references/model-registry.json`.
12: 
13: ---
14: 
15: ## Profiles
16: 
17: A profile defines which harness handles each cognitive label. The framework ships with five profiles:
18: 
19: | Profile | Orchestrator | EXEC Harness | SENSE Harness | Best For |
20: |---------|-------------|--------------|---------------|----------|
21: | **`svc-default`** | Any | **Claude Sonnet 5** (effort:high declared) | **MiMo-V2.5-Pro** (key-gated) | Production. Opus strategy/plan + Sonnet 5 execution/review; effort:high declared in the registry, consumer-applied (WI-470) |
22: | **`kimi-native`** | Kimi | **Kimi** | **Kimi** | Pure Kimi. Everything inside Kimi CLI |
23: | **`claude-native`** | Claude | **Claude Sonnet** | **Claude Opus** | Pure Claude. No MiMo delegation |
24: | **`codex-native`** | Codex CLI / app | **GPT-5.5** | **GPT-5.5** | Pure Codex. Best for Windows Codex app + WSL2 |
25: | **`kimi-orchestrator-mixed`** | Kimi | **MiMo-V2.5** | **MiMo-V2.5-Pro** | Kimi orchestrates + MiMo executes |
26: 
27: **Profile selection:**
28: ```bash
29: # Auto-selected based on orchestrator host
30: # Kimi CLI → kimi-native
31: # Codex CLI/app → codex-native
32: # Claude Code → svc-default
33: 
34: # Override explicitly:
35: export SVC_MODEL_PROFILE=svc-default
36: export SVC_MODEL_PROFILE=codex-native
37: export SVC_MODEL_PROFILE=kimi-orchestrator-mixed
38: ```
39: 
40: ---
41: 
42: ## Dynamic Resolution
43: 
44: ```bash
45: # What harness + model should I use for execution right now?
46: bash scripts/resolve-model.sh EXEC --json
47: 
48: # What harness + model for strategy?
49: bash scripts/resolve-model.sh STRAT --json
50: 
51: # Just the invocation command:
52: bash scripts/resolve-model.sh EXEC --invocation
53: ```
54: 
55: ---
56: 
57: ## The Cognitive Labels
58: 
59: <!-- svc:generated:begin model-routing-cognitive-labels — edit skills-manifest.json / references/model-registry.json, then run: node scripts/generate-manifest-mirrors.mjs --write -->
60: 1.  🧠 **[STRAT] Strategic Determination:** High-stakes decisions, product invention, spatial UX reasoning, resolving ambiguity.
61: 2.  📐 **[PLAN] Architectural Blueprinting:** Dependency graphs, JSON manifests, task logic, strict planning.
62: 3.  ⚙️ **[EXEC] Agentic Execution:** High-volume file editing, terminal commands, running tests, bash loops.
63: 4.  🛡️ **[REVIEW] Grounded Verification:** Code review, architectural drift detection, spec alignment.
64: 5.  👁️ **[SENSE] Temporal / Sensory QA:** Video, UI animations, audio interactions, visual regression.
65: 6.  🌐 **[DISC] Grounded Discovery:** Live docs, competitor pages, exact SDK versions, web search.
66: 7.  🔁 **[PASS] Pass-Through Distillation:** Mechanical extraction, reformatting, no reasoning needed.
67: <!-- svc:generated:end model-routing-cognitive-labels -->
68: 
69: ---
70: 
71: ## svc-default Profile (Framework Default)
72: 
73: This is the **production profile**. It mixes models across harnesses for optimal cost/reasoning tradeoffs.
74: 
75: <!-- svc:generated:begin model-routing-svc-default — edit skills-manifest.json / references/model-registry.json, then run: node scripts/generate-manifest-mirrors.mjs --write -->
76: | Label | Harness | Model | Rationale |
77: |-------|---------|-------|-----------|
78: | 🧠 **[STRAT]** | Claude | Opus 4.8 | Highest reasoning depth for strategy |
79: | 📐 **[PLAN]** | Claude | Opus 4.8 | Deterministic blueprinting |
80: | ⚙️ **[EXEC]** | Claude | Sonnet 5 | Sonnet 5 execution; effort:high declared (WI-470); MiMo EXEC via keyed profiles |
81: | 🛡️ **[REVIEW]** | Claude | Sonnet 5 | WI-470 2026-06-30: REVIEW runs on Sonnet 5 (subagents pinned) against the Opus blueprint; effort:high declared here, consumer-applied via the Agent dispatch effort param |
82: | 👁️ **[SENSE]** | **MiMo** | **MiMo-V2.5-Pro** | Multimodal sensory QA (requires MIMO_API_KEY) |
83: | 🌐 **[DISC]** | Native | web_search | Live docs via native search |
84: | 🔁 **[PASS]** | Claude | Haiku 4.5 | Cheapest pass-through extraction |
85: <!-- svc:generated:end model-routing-svc-default -->
86: 
87: **Key insight:** The orchestrator can be Claude, Kimi, Codex, Gemini, or OpenCode. Since WI-357 (2026-06-06), `svc-default` executes with Claude Sonnet (matching the operative key-gated fallback) and delegates only SENSE to MiMo; MiMo-everything remains available via `opencode-mimo`, and `<orchestrator>-native` profiles cover single-harness setups (`kimi-native`, `claude-native`, `codex-native`).
88: 
89: ---
90: 
91: ## kimi-native Profile
92: 
93: Everything inside Kimi CLI. No cross-harness delegation.
94: 
95: | Label | Harness | Model | Toggle |
96: |-------|---------|-------|--------|
97: | 🧠 **[STRAT]** | Kimi | `kimi-for-coding` | thinking ON |
98: | 📐 **[PLAN]** | Kimi | `kimi-for-coding` | thinking ON |
99: | ⚙️ **[EXEC]** | Kimi | `kimi-for-coding` | thinking OFF |
100: | 🛡️ **[REVIEW]** | Kimi | `kimi-for-coding` | thinking ON |
101: | 👁️ **[SENSE]** | Kimi | `kimi-for-coding` | thinking ON |
102: | 🌐 **[DISC]** | Native | SearchWeb | — |
103: | 🔁 **[PASS]** | Kimi | `kimi-for-coding` | thinking OFF |
104: 
105: ---
106: 
107: ## Pipeline Routing Matrix
108: 
109: All profiles share the same cognitive labels. Only the harness changes.
110: 
111: ### Layer 1: Pre-Pipeline & Product
112: 
113: | Skill | Label | Rationale |
114: | :--- | :--- | :--- |
115: | `write-vision` | 🧠 **[STRAT]** | Define the "North Star" |
116: | `validate-feature` | 🧠 **[STRAT]** | Cross-examine business viability |
117: | `monetization-architecture` | 🧠 **[STRAT]** + 🌐 **[DISC]** | Maps features to tiers + live API limits |
118: | `analyze-competitors` | ⚙️ **[EXEC]** + 🌐 **[DISC]** | Heavy scraping, cheap text processing |
119: 
120: ### Layer 2: Design & Spec
121: 
122: | Skill | Label | Rationale |
123: | :--- | :--- | :--- |
124: | `write-spec` | 🧠 **[STRAT]** | Strict BDD scenario mapping |
125: | `write-journeys` | 🧠 **[STRAT]** | Traceable journey generation |
126: | `design-ux` | 🧠 **[STRAT]** | Spatial reasoning for state machines |
127: | `design-ui` | 🧠 **[STRAT]** | Design-token generation |
128: 
129: ### Layer 3: Tech & Planning
130: 
131: | Skill | Label | Rationale |
132: | :--- | :--- | :--- |
133: | `design-tech` | 🧠 **[STRAT]** | Database schema, system architecture |
134: | `explore-solutions` | 🧠 **[STRAT]** + 🌐 **[DISC]** | Challenge design with live comparisons |
135: | `plan-changeset` | 📐 **[PLAN]** | **CRITICAL:** strict manifest + task graph |
136: 
137: ### Layer 4: Implementation
138: 
139: | Skill | Label | Rationale |
140: | :--- | :--- | :--- |
141: | `execute-changeset` | ⚙️ **[EXEC]** | Reads plan, writes code, runs tests |
142: | `quick-fix` | ⚙️ **[EXEC]** | Fast-lane typo fixing |
143: | `diagnose-bug` | 🧠 **[STRAT]** + 🌐 **[DISC]** | Root-cause + live issue-tracker data |
144: 
145: ### Layer 5: QA, Audit, and Vibe Check
146: 
147: | Skill | Label | Rationale |
148: | :--- | :--- | :--- |
149: | `review-gate` | 🛡️ **[REVIEW]** | Detects architectural drift |
150: | `audit-implementation` | 🛡️ **[REVIEW]** | Correctness audit against spec |
151: | `verify-promotion` | 🛡️ **[REVIEW]** | Checks deployed artifacts |
152: | `land-changeset` | ⚙️ **[EXEC]** | Mechanical git ops |
153: | `track-visuals` | 👁️ **[SENSE]** | Video/screen recording analysis |
154: | `test-journeys` (E2E) | ⚙️ **[EXEC]** | Playwright/Cypress execution |
155: | `test-journeys` (Voice) | 👁️ **[SENSE]** | Voice-agent / real-time video testing |
156: 
157: ---
158: 
159: ## For Skill Authors
160: 
161: When writing a SKILL.md that spawns an external agent or recommends a model:
162: 
163: **❌ Don't do this:**
164: > "Use Claude Opus 4.8 for this step."
165: 
166: **✅ Do this:**
167: > "Use the [STRAT] label for this step. The framework resolves it via `bash scripts/resolve-model.sh STRAT`. Under `svc-default` this is Claude Opus; under `kimi-native` this is `kimi-for-coding` with thinking ON."
168: 
169: This keeps skills portable across all orchestrators and profiles.
170: 
171: ---
172: 
173: ## Detached Kimi Runner — Per-Skill Cap Defaults
174: 
175: The detached Kimi runner (`scripts/run-kimi-detached.sh`, see
176: `references/kimi-detached-pattern.md`) reads the block below to pick a
177: default `--max-seconds` for the calling skill. Caller may override via
178: `--max-seconds`; `KIMI_DETACHED_HARD_CAP` env (default 7200) truncates
179: whatever the caller asked for.
180: 
181: The block is machine-parsed by the runner. Add a row only when a skill
182: needs a cap different from the bucket defaults; the runner falls back to
183: `default` for anything it doesn't find.
184: 
185: <!-- KIMI_DETACHED_CAPS_BEGIN -->
186: default=1800
187: review=1200
188: ingestion=3600
189: research=3600
190: exploration=1800
191: ingest-guide=3600
192: ingest-guide-batch=3600
193: explore-solutions=1800
194: <!-- KIMI_DETACHED_CAPS_END -->
195: 
196: | Skill / bucket | Default cap | Rationale |
197: |---|---|---|
198: | `default` | 1800s (30 min) | Safe ceiling for most skills |
199: | `review` | 1200s (20 min) | Mirrors hook-side review timeout |
200: | `ingestion` / `ingest-guide` / `ingest-guide-batch` | 3600s (60 min) | Long social-content extractions |
201: | `research` | 3600s (60 min) | Multi-source synthesis runs long |
202: | `exploration` / `explore-solutions` | 1800s (30 min) | Alternative-paradigm comparison |
203: 
204: To raise the hard cap (e.g., for a one-off batch run):
205: 
206: ```bash
207: KIMI_DETACHED_HARD_CAP=10800 scripts/run-kimi-detached.sh \
208:   --skill research --prompt-file /tmp/p --max-seconds 10800
209: ```

## rules/common/model-selection.md
Source SHA256: 43461978be1dc2ee95f0f73d72d96b495e32c3da6321f60bf69c71b2a2f9dada

1: ---
2: description: Host-agnostic model selection via cognitive labels and dynamic resolver
3: scope: project
4: stack: universal
5: source: blended:ecc
6: source_sha: 125d5e619905d97b519a887d5bc7332dcc448a52
7: ---
8: 
9: # Model Selection for Agent Tasks
10: 
11: > **MIRROR:** model IDs/tables below mirror `references/model-registry.json` (single source). Edit the registry first, then sync this file. Cross-check: WI-357 validation command. Full generation pending WI-364.
12: 
13: This framework uses **host-agnostic cognitive labels** instead of hardcoded model IDs. The resolver (`scripts/resolve-model.sh`) maps each label to the best model for the currently running host.
14: 
15: ## Quick Reference
16: 
17: <!-- svc:generated:begin model-selection-quick-ref — edit skills-manifest.json / references/model-registry.json, then run: node scripts/generate-manifest-mirrors.mjs --write -->
18: ```bash
19: # Resolve the current host's model for a cognitive label
20: bash scripts/resolve-model.sh STRAT   # Strategic reasoning
21: bash scripts/resolve-model.sh EXEC    # File editing / execution
22: bash scripts/resolve-model.sh REVIEW  # Code review / verification
23: bash scripts/resolve-model.sh PASS    # Lightweight extraction
24: ```
25: <!-- svc:generated:end model-selection-quick-ref -->
26: 
27: ## Cognitive Labels
28: 
29: <!-- svc:generated:begin model-selection-cognitive-labels — edit skills-manifest.json / references/model-registry.json, then run: node scripts/generate-manifest-mirrors.mjs --write -->
30: | Label | Icon | Use for | Host Resolution |
31: |-------|------|---------|-----------------|
32: | **[STRAT]** | 🧠 | Strategic decisions, architecture, north-star definition | `scripts/resolve-model.sh STRAT` |
33: | **[PLAN]** | 📐 | Blueprinting, dependency graphs, manifest creation | `scripts/resolve-model.sh PLAN` |
34: | **[EXEC]** | ⚙️ | File edits, bash commands, tests, execution | `scripts/resolve-model.sh EXEC` |
35: | **[REVIEW]** | 🛡️ | Code review, drift detection, spec alignment | `scripts/resolve-model.sh REVIEW` |
36: | **[SENSE]** | 👁️ | Video, UI animations, visual regression | `scripts/resolve-model.sh SENSE` |
37: | **[DISC]** | 🌐 | Web search, live docs, competitor research | Native web tools (no model) |
38: | **[PASS]** | 🔁 | Mechanical extraction, reformatting, no reasoning | `scripts/resolve-model.sh PASS` |
39: <!-- svc:generated:end model-selection-cognitive-labels -->
40: 
41: ## Host-Specific Resolutions
42: 
43: | Label | Claude Code | Kimi CLI | Gemini CLI | Codex CLI | OpenCode CLI |
44: |-------|-------------|----------|------------|-----------|--------------|
45: | **[STRAT]** | Claude Opus 4.8 | `kimi-for-coding` + thinking ON | Gemini 2.5 Pro | o3 | MiMo V2.5-Pro |
46: | **[PLAN]** | Claude Opus 4.8 | `kimi-for-coding` + thinking ON | Gemini 2.5 Pro | o3 | MiMo V2.5-Pro |
47: | **[EXEC]** | Claude Sonnet 4.6 | `kimi-for-coding` + thinking OFF | Gemini 2.5 Flash | codex | MiMo V2.5 |
48: | **[REVIEW]** | Claude Sonnet 4.6 | `kimi-for-coding` + thinking ON | Gemini 2.5 Pro | codex | MiMo V2.5-Pro |
49: | **[SENSE]** | Claude Opus 4.8 | `kimi-for-coding` + thinking ON | Gemini 2.5 Pro | gpt-4o | MiMo V2.5-Pro |
50: | **[PASS]** | Claude Haiku 4.5 | `kimi-for-coding` + thinking OFF | Gemini 2.5 Flash | gpt-4o-mini | MiMo V2.5 |
51: 
52: For full details see `references/model-routing.md` and `references/model-registry.json`.
53: 
54: ## Context Window Management
55: 
56: Avoid the last 20% of context for:
57: - Large-scale refactoring spanning multiple files
58: - Feature implementation across many interdependent files
59: - Debugging complex cross-file interactions
60: 
61: Lower context-sensitivity tasks (safe to run at any context depth):
62: - Single-file edits
63: - Independent utility creation
64: - Documentation updates
65: - Simple bug fixes
66: 
67: ## When to Apply
68: 
69: - Designing a multi-agent system → assign Haiku to worker agents by default
70: - Orchestrator agent → Sonnet
71: - One-shot deep reasoning tasks (architectural decisions, plan evaluation) → Opus

## test-framework/evals/tier-1/validate-skill-before-starting.sh
Source SHA256: 0fa7244f36a8d079207f5d8851c5d7e22dc8ba67aa31cb8978873c9ce618cb14

1: #!/usr/bin/env bash
2: # Tier 1: Validate that every SKILL.md authored on or after 2026-04-28 has a
3: # "## Before Starting" section. Skills authored before that date are exempt
4: # (advisory mode). Skills with no detectable creation date are also exempt.
5: #
6: # Source rationale: WI-135 (coreyhaines blend v1.9.0).
7: # Both YAML frontmatter `created:` and markdown `**Created:** YYYY-MM-DD`
8: # header formats are accepted (per simulation-report finding in WI-135 manifest).
9: set -euo pipefail
10: 
11: REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
12: cd "$REPO_ROOT"
13: MANIFEST="$REPO_ROOT/skills-manifest.json"
14: CUTOFF="2026-04-28"
15: SHARED_CONTRACT="$REPO_ROOT/_shared/before-starting.md"
16: CONVENTIONS="$REPO_ROOT/references/skill-conventions.md"
17: ROUTE_WORKFLOW="$REPO_ROOT/skills/route-workflow/SKILL.md"
18: CONTEXT_REGISTRY="$REPO_ROOT/references/context-loading-registry.json"
19: CONTEXT_MAP="$(mktemp)"
20: trap 'rm -f "$CONTEXT_MAP"' EXIT
21: 
22: PASS=0
23: FAIL=0
24: ADVISORY=0
25: ERRORS=""
26: ADVICE=""
27: 
28: require_pattern() {
29:   local file="$1"
30:   local pattern="$2"
31:   local label="$3"
32:   if grep -qiE "$pattern" "$file"; then
33:     PASS=$((PASS + 1))
34:   else
35:     ERRORS+="  FAIL: $label missing pattern '$pattern' in ${file#$REPO_ROOT/}\n"
36:     FAIL=$((FAIL + 1))
37:   fi
38: }
39: 
40: require_pattern "$SHARED_CONTRACT" "complete relevant context" "Before Starting shared contract"
41: require_pattern "$SHARED_CONTRACT" "spec-index\\.json" "Before Starting shared contract"
42: require_pattern "$SHARED_CONTRACT" "dependency|dependencies" "Before Starting shared contract"
43: require_pattern "$SHARED_CONTRACT" "not read every|Do not read every" "Before Starting shared contract"
44: require_pattern "$SHARED_CONTRACT" "not stop at the minimum|do not stop at the minimum" "Before Starting shared contract"
45: require_pattern "$CONVENTIONS" "bounded context plan" "Skill conventions"
46: require_pattern "$ROUTE_WORKFLOW" "bounded context plan" "route-workflow Before Starting"
47: 
48: if node <<'NODE' > "$CONTEXT_MAP"
49: const fs = require("fs");
50: const manifest = JSON.parse(fs.readFileSync("skills-manifest.json", "utf8"));
51: const registry = JSON.parse(fs.readFileSync("references/context-loading-registry.json", "utf8"));
52: const included = new Set(manifest.includedSkills || []);
53: const coverage = new Map();
54: const errors = [];
55: 
56: if (!Array.isArray(registry.families) || registry.families.length === 0) {
57:   errors.push("context-loading registry must contain at least one family");
58: } else {
59:   for (const family of registry.families) {
60:     if (!family.id) errors.push("context-loading family missing id");
61:     for (const field of ["start_from", "dependency_expansion", "stop_condition"]) {
62:       if (!family[field] || (Array.isArray(family[field]) && family[field].length === 0)) {
63:         errors.push(`context-loading family ${family.id || "(unknown)"} missing ${field}`);
64:       }
65:     }
66:     for (const skill of family.skills || []) {
67:       if (!included.has(skill)) errors.push(`context-loading registry names non-included skill: ${skill}`);
68:       const current = coverage.get(skill) || [];
69:       current.push(family.id || "(unknown)");
70:       coverage.set(skill, current);
71:     }
72:   }
73: }
74: 
75: for (const skill of included) {
76:   const families = coverage.get(skill) || [];
77:   if (families.length === 0) errors.push(`context-loading registry missing included skill: ${skill}`);
78:   if (families.length > 1) errors.push(`context-loading registry covers ${skill} more than once: ${families.join(", ")}`);
79: }
80: 
81: if (errors.length > 0) {
82:   for (const error of errors) console.error(error);
83:   process.exit(1);
84: }
85: 
86: for (const [skill, families] of coverage.entries()) {
87:   console.log(`${skill}:${families[0]}`);
88: }
89: NODE
90: then
91:   PASS=$((PASS + 1))
92: else
93:   ERRORS+="  FAIL: context-loading registry is invalid\n"
94:   FAIL=$((FAIL + 1))
95: fi
96: 
97: SKILLS=$(node -e "
98:   const m = require('$MANIFEST');
99:   m.includedSkills.forEach(s => console.log(s));
100: " 2>/dev/null || ls -d "$REPO_ROOT"/*/SKILL.md 2>/dev/null | xargs -I{} dirname {} | xargs -n1 basename)
101: 
102: extract_created() {
103:   local file="$1"
104:   # Try YAML frontmatter first: `created: YYYY-MM-DD` (with or without quotes)
105:   local fm_created
106:   fm_created=$(awk '/^---$/{n++; next} n==1{print} n>=2{exit}' "$file" \
107:     | grep -E '^created:' \
108:     | head -1 \
109:     | sed -E 's/^created:[[:space:]]*"?([0-9]{4}-[0-9]{2}-[0-9]{2})"?.*/\1/')
110:   if [[ -n "$fm_created" ]]; then
111:     echo "$fm_created"
112:     return
113:   fi
114:   # Try markdown header: `**Created:** YYYY-MM-DD`
115:   local md_created
116:   md_created=$(grep -m1 -E '^\*\*Created:\*\*' "$file" 2>/dev/null \
117:     | sed -E 's/.*\*\*Created:\*\*[[:space:]]*([0-9]{4}-[0-9]{2}-[0-9]{2}).*/\1/')
118:   if [[ -n "$md_created" && "$md_created" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
119:     echo "$md_created"
120:     return
121:   fi
122:   echo ""
123: }
124: 
125: for skill in $SKILLS; do
126:   SKILL_FILE="$REPO_ROOT/skills/$skill/SKILL.md"
127:   [[ ! -f "$SKILL_FILE" ]] && continue
128: 
129:   HAS_SECTION=0
130:   if grep -qE '^#{2,3} Before Starting' "$SKILL_FILE"; then
131:     HAS_SECTION=1
132:   fi
133: 
134:   CREATED="$(extract_created "$SKILL_FILE")"
135: 
136:   if [[ -n "$CREATED" && "$CREATED" > "$CUTOFF" || "$CREATED" == "$CUTOFF" ]]; then
137:     # Post-cutoff skills: section is mandatory
138:     if [[ $HAS_SECTION -eq 1 ]]; then
139:       PASS=$((PASS + 1))
140:     else
141:       ERRORS+="  FAIL: $skill — created $CREATED (>= $CUTOFF) but missing '## Before Starting' section\n"
142:       FAIL=$((FAIL + 1))
143:     fi
144:   else
145:     # Pre-cutoff skills or no detectable date: family registry coverage is
146:     # blocking; missing direct sections are no longer naked advisory debt.
147:     if [[ $HAS_SECTION -eq 0 ]]; then
148:       if grep -q "^${skill}:" "$CONTEXT_MAP"; then
149:         PASS=$((PASS + 1))
150:       else
151:         ADVICE+="  ADVISORY: $skill — missing '## Before Starting' section and no family context-loading coverage\n"
152:         ADVISORY=$((ADVISORY + 1))
153:       fi
154:     else
155:       PASS=$((PASS + 1))
156:     fi
157:   fi
158: done
159: 
160: echo "validate-skill-before-starting: $PASS passed, $FAIL failed, $ADVISORY advisory"
161: if [[ $ADVISORY -gt 0 ]]; then
162:   echo -e "$ADVICE"
163: fi
164: 
165: if [[ $FAIL -gt 0 ]]; then
166:   echo "FAIL: $FAIL skill(s) authored on/after $CUTOFF lack '## Before Starting' section"
167:   echo -e "$ERRORS"
168:   exit 1
169: fi
170: exit 0

## test-framework/evals/tier-1/validate-skill-judgment.mjs
Source SHA256: db7ec741e6a415403f655e0c83e13b2f17cd944faa18147359262e6c36e7eb12

1: #!/usr/bin/env node
2: import assert from 'node:assert/strict';
3: import fs from 'node:fs';
4: import path from 'node:path';
5: import { fileURLToPath } from 'node:url';
6: import { createHash } from 'node:crypto';
7: import { spawnSync } from 'node:child_process';
8: import { selectTier1Validators, selectTier1ValidatorsForSurfaces } from '../../../scripts/select-tier1-validators-v2.mjs';
9: 
10: const root = fileURLToPath(new URL('../../../', import.meta.url));
11: const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
12: const hash = text => createHash('sha256').update(text).digest('hex');
13: // Discover consumers from live source, rather than certifying only a hand-picked list.
14: function markdownFiles(relative) {
15:   return fs.readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap(entry => {
16:     const name = path.posix.join(relative, entry.name);
17:     if (entry.isDirectory()) return markdownFiles(name);
18:     return entry.isFile() && name.endsWith('.md') ? [name] : [];
19:   });
20: }
21: const consumers = [...markdownFiles('skills'), ...markdownFiles('agents'), ...markdownFiles('_shared'), 'references/elimination-gate-protocol.md']
22:   .filter(file => file === '_shared/product-question-format.md' || read(file).includes('product-question-format'));
23: const staleQuota = /12[- ](?:section|canonical sections)|(?:≥|>=)\s*40|(?:≥|>=)\s*20\s*(?:customer|system)|(?:all|asks the|Step 1:)\s*8\s*(?:business|Qs)|5[- ]competitors|all (?:are )?AGREE/i;
24: for (const file of consumers) {
25:   assert(!staleQuota.test(read(file)), `stale product-question contract: ${file}`);
26:   assert(!/No unresolved questions \| grep for TBD, TODO/.test(read(file)), `placeholder presence must not block completion: ${file}`);
27:   assert(selectTier1Validators([file]).selected.includes('validate-skill-judgment.mjs'), `unmapped live consumer: ${file}`);
28: }
29: assert(consumers.includes('agents/strategic-reviewer.md'));
30: const shared = read('_shared/product-question-format.md');
31: for (const principle of ['actual implementation evidence','affected','consequential decision','meaningful alternatives','Persona/user fit','reversibility','success signal','Useful innovation','AGREE/OVERRIDE','silence and elapsed time','No unresolved consequential decision','owner-decision-runtime-v2.md','skills/decide/SKILL.md']) {
32:   assert(shared.toLowerCase().includes(principle.toLowerCase()), `missing shared principle: ${principle}`);
33: }
34: // Counterexamples must be rejected even when the rest of the document looks healthy.
35: for (const regression of ['12-section format','≥40 questions','>=20 customer questions','all are AGREE','asks the 8 business questions','5-competitors']) assert(staleQuota.test(regression), regression);
36: assert(!staleQuota.test('There is no numeric question floor. Existing AGREE/OVERRIDE history remains valid.'));
37: 
38: function phases(text) {
39:   const block = text.match(/^phases:\n([\s\S]*?)^inputs:/m)?.[1];
40:   assert(block, 'phase metadata missing');
41:   return block.split(/^  - /m).slice(1).map(entry => ({
42:     id: entry.match(/\bid:\s*([\w.-]+)/)?.[1],
43:     trigger: entry.match(/\btrigger:\s*([\w-]+)/)?.[1],
44:     required: entry.match(/required_for_completion:\s*(true|false)/)?.[1] === 'true'
45:   }));
46: }
47: const feature = read('skills/validate-feature/SKILL.md');
48: assert(!feature.includes('ask "Does this capture it correctly?" after each'));
49: assert(!feature.includes('confirm direction before proceeding'));
50: assert(!/section by section/i.test(feature));
51: assert(feature.includes('For concept fragmentation'));
52: for (const name of ['write-spec','design-ux','design-tech','plan-changeset','review-gate','execute-changeset','design-ui','test-journeys','sync-spec-code','diagnose-bug']) {
53:   const contract = read(`skills/${name}/SKILL.md`);
54:   assert(!/No unresolved questions \| grep for TBD, TODO/.test(contract), `${name}: placeholder presence is not a consequential decision`);
55:   assert(contract.includes('block missing required AC/state/dependency evidence'));
56: }
57: for (const id of ['P3-GateMarketValidation','P4-BusinessBrief','P5-CrossValidationShipDecision']) {
58:   const phase = phases(feature).find(p => p.id === id);
59:   assert(phase && phase.trigger !== 'always' && !phase.required, `${id}: bounded accepted work must not force a new business cycle`);
60: }
61: assert(feature.includes('authorization alone is not evidence of demand'));
62: assert(feature.includes('Do not fabricate executed phase receipts'));
63: assert(feature.includes('P3–P5 commands below are conditional examples'));
64: assert(feature.includes('Otherwise verify accepted scope remains consistent'));
65: assert(!feature.includes('| 1 | Ship brief file exists |'));
66: const advisor = read('skills/svc-advisor/SKILL.md');
67: const diagnosis = read('skills/diagnose-bug/SKILL.md');
68: const ap = phases(advisor), dp = phases(diagnosis);
69: assert(ap.find(p => p.id === 'P1-QuestionClassification')?.required);
70: assert.equal(ap.find(p => p.id === 'P2b-MechanicalFactVerification')?.trigger, 'counts-or-wiring-claims');
71: assert.equal(ap.find(p => p.id === 'P2b-MechanicalFactVerification')?.required, false);
72: assert.equal(ap.find(p => p.id === 'P3-RelevantEvidenceLoad')?.trigger, 'additional-evidence-needed');
73: assert.equal(ap.find(p => p.id === 'P3-RelevantEvidenceLoad')?.required, false);
74: assert(!advisor.match(/inputs:\n  required:([\s\S]*?)  optional:/)?.[1].includes('CAPABILITIES.md'));
75: assert(advisor.includes('Every asserted count/wiring fact was re-derived'));
76: assert(advisor.includes('Record actual conditional phase evidence only when executed'));
77: assert(advisor.includes('Existing project competitor data alone does not make it relevant'));
78: for (const [name, text, sourcePhases] of [['svc-advisor',advisor,ap],['diagnose-bug',diagnosis,dp]]) {
79:   const summary = text.match(/## Applicability[^\n]*\n([\s\S]*?)(?=\n## )/)?.[1];
80:   assert(summary, `${name} summary missing`);
81:   for (const phase of sourcePhases) assert(summary.includes(phase.id), `${name}: source phase absent from summary: ${phase.id}`);
82:   assert(text.includes('references/task-graph-chaining-protocol.md'));
83:   assert.equal((text.match(/### Task-graph mode/g) || []).length, 1, `${name}: duplicate continuation returned`);
84:   assert(text.includes('Self-Verify'));
85:   console.log(JSON.stringify({skill:name,source_bytes:Buffer.byteLength(text),source_sha256:hash(text),applicability:sourcePhases}));
86: }
87: for (const phrase of ['latest reproduction','spec/code conflicts','dependent callers/writers','explicit owner request for diagnosis only','Self-Verify','Risk-Flag Classification','Pillar Revisit']) assert(diagnosis.includes(phrase), phrase);
88: assert(diagnosis.includes('If implementation is authorized and ALL paths auto-deploy'));
89: assert(!diagnosis.includes('pair with web_search'));
90: assert(read('skills/design-ux/SKILL.md').includes('existing-pattern-retained'));
91: assert(!read('skills/design-ux/SKILL.md').includes('Propose 3 distinct hooks'));
92: assert(read('skills/design-ui/SKILL.md').includes('For `existing-pattern-retained`'));
93: const fixture = JSON.parse(read('test-framework/fixtures/skill-judgment/behavior.json'));
94: assert.deepEqual(fixture.scenarios.map(s => s.id), ['A','B','C','D']);
95: for (const scenario of fixture.scenarios) {
96:   assert.equal(hash(scenario.prompt), scenario.prompt_sha256, `${scenario.id}: frozen prompt changed without hash`);
97:   assert(scenario.invariants.length >= 3);
98: }
99: const registeredSkills = JSON.parse(read('skills-manifest.json')).includedSkills;
100: const sourceSkills = fs.readdirSync(path.join(root, 'skills'), {withFileTypes:true})
101:   .filter(entry => entry.isDirectory() && fs.existsSync(path.join(root, 'skills', entry.name, 'SKILL.md')))
102:   .map(entry => entry.name);
103: assert.equal(new Set(registeredSkills).size, registeredSkills.length);
104: assert.deepEqual([...registeredSkills].sort(), sourceSkills.sort());
105: assert.equal(selectTier1Validators(['future/unmapped-skill.md']).fallback_full, true);
106: assert.equal(selectTier1Validators(['AGENTS.md']).fallback_full, true);
107: assert.deepEqual(selectTier1ValidatorsForSurfaces(['definitely-unmapped-skill-judgment-surface']).selected, []);
108: // The selector is a query; the runner owns rejecting a requested surface with no checks.
109: const selector = spawnSync(process.execPath, ['scripts/select-tier1-validators-v2.mjs','--surface','definitely-unmapped-skill-judgment-surface'], {cwd:root,encoding:'utf8'});
110: assert.equal(selector.status, 0, selector.stderr);
111: assert.deepEqual(JSON.parse(selector.stdout).selected, []);
112: const runner = spawnSync('bash', ['test-framework/evals/run-all-evals.sh','--surface','definitely-unmapped-skill-judgment-surface'], {cwd:root,encoding:'utf8',env:{...process.env,EVALS:'0',FLAKE_CHECK:'0'}});
113: assert.equal(runner.status, 2, runner.stdout + runner.stderr);
114: assert.match(runner.stderr, /matched zero runnable contract validators/);
115: console.log(`PASS skill judgment: ${consumers.length} live consumers; source-derived phase summaries, decision guardrails, frozen fixtures and selector/runner semantics. Behavioral quality requires the separate native evaluation.`);

## scripts/compile-skill-router-index.mjs
Source SHA256: 4ea7fa2460cbe085039e138ffef98a3963ab9fe4307caceb031311c8b209fa17

1: #!/usr/bin/env node
2: /**
3:  * compile-skill-router-index.mjs — WI-FW-SKILLS-ROUTING-01 Wave 1.
4:  *
5:  * Deterministic compiler for the skill-routing index (plan §4.2).
6:  *
7:  * Canonical inputs:
8:  *   skills-manifest.json           includedSkills + rulesRegistry
9:  *   skills/<name>/SKILL.md         frontmatter description + content hash
10:  *   concerns/REGISTRY.json         concern bindings (fingerprint input)
11:  *   references/skill-routing-overrides.json  aliases/triggers/policies/risk
12:  *
13:  * Output: references/skill-routing-index.json — byte-stable for identical
14:  * inputs (no wall-clock fields; sorted keys and entries). Any duplicate name,
15:  * missing SKILL.md, invalid invocation policy/risk, unknown override target,
16:  * or unresolved required_rules identifier fails compilation with a named
17:  * reason and non-zero exit.
18:  *
19:  * Usage:
20:  *   node scripts/compile-skill-router-index.mjs [--root <dir>] [--check]
21:  *     --check  recompile in memory and byte-compare against the committed
22:  *              artifact instead of writing it; exit 1 on drift.
23:  */
24: import { createHash } from "node:crypto";
25: import fs from "node:fs";
26: import path from "node:path";
27: 
28: const POLICIES = new Set(["required", "implicit-allowed", "suggest-only", "explicit-only"]);
29: const RISKS = new Set(["low", "medium", "high", "critical"]);
30: const OUTPUT_REL = "references/skill-routing-index.json";
31: 
32: function sha256(data) {
33:   return createHash("sha256").update(data).digest("hex");
34: }
35: 
36: function readIfExists(file) {
37:   return fs.readFileSync(file);
38: }
39: 
40: function parseArgs(argv) {
41:   const args = { root: process.cwd(), check: false };
42:   for (let i = 0; i < argv.length; i += 1) {
43:     const a = argv[i];
44:     if (a === "--root") { args.root = path.resolve(argv[++i]); }
45:     else if (a === "--check") { args.check = true; }
46:     else fail(`unknown argument: ${a}`);
47:   }
48:   return args;
49: }
50: 
51: function fail(message) {
52:   process.stderr.write(`compile-skill-router-index: ${message}\n`);
53:   process.exit(2);
54: }
55: 
56: /** Extract the description scalar from a SKILL.md YAML frontmatter block.
57:  * Handles plain scalars plus `>-` / `|` folded blocks. No full YAML parser:
58:  * frontmatter descriptions are single-field prose by house convention. */
59: export function extractDescription(raw) {
60:   const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
61:   if (!m) fail("missing YAML frontmatter");
62:   const lines = m[1].split(/\r?\n/);
63:   let collecting = false;
64:   const parts = [];
65:   for (const line of lines) {
66:     if (!collecting && /^description:\s*(.*)$/.test(line)) {
67:       const inline = line.replace(/^description:\s*/, "");
68:       if (/^(>[+-]?|\|[+-]?)\s*$/.test(inline)) { collecting = true; continue; }
69:       return stripQuotes(inline).trim();
70:     }
71:     if (collecting) {
72:       if (/^\S/.test(line)) break; // next top-level key ends the block
73:       parts.push(line.trim());
74:     }
75:   }
76:   const joined = parts.join(" ").trim();
77:   if (!joined) fail("frontmatter has no usable description");
78:   return joined;
79: }
80: 
81: function stripQuotes(s) {
82:   const t = s.trim();
83:   if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
84:     return t.slice(1, -1);
85:   }
86:   return t;
87: }
88: 
89: export function compile(root) {
90:   const manifestPath = path.join(root, "skills-manifest.json");
91:   const overridesPath = path.join(root, "references", "skill-routing-overrides.json");
92:   const registryPath = path.join(root, "concerns", "REGISTRY.json");
93: 
94:   const manifestBytes = readIfExists(manifestPath);
95:   const overridesBytes = readIfExists(overridesPath);
96:   const registryBytes = readIfExists(registryPath);
97:   const manifest = JSON.parse(manifestBytes.toString("utf8"));
98:   const overrides = JSON.parse(overridesBytes.toString("utf8"));
99:   const registry = JSON.parse(registryBytes.toString("utf8"));
100: 
101:   const included = manifest.includedSkills;
102:   if (!Array.isArray(included) || included.length === 0) fail("skills-manifest.json has no includedSkills array");
103: 
104:   // Duplicate-name detection at the source of truth.
105:   const seen = new Set();
106:   for (const name of included) {
107:     if (seen.has(name)) fail(`duplicate skill name in skills-manifest.json: ${name}`);
108:     seen.add(name);
109:   }
110: 
111:   const knownRules = new Set(
112:     (manifest.rulesRegistry?.entries || [])
113:       .map((e) => path.basename(e.path || "").replace(/\.md$/, ""))
114:       .filter(Boolean)
115:   );
116: 
117:   // Governance-binding validation (F-EXEC-020): a typo in a critical concern
118:   // binding would silently disable that pin forever. Fail compilation instead.
119:   const includedSet = new Set(included);
120:   for (const concern of registry.concerns || []) {
121:     const handled = concern.handled_by || {};
122:     for (const s of handled.required_skills || []) {
123:       if (!includedSet.has(s)) fail(`concern "${concern.name}" requires unknown skill: ${s}`);
124:     }
125:     for (const r of handled.required_rules || []) {
126:       if (!knownRules.has(r)) fail(`concern "${concern.name}" references unresolvable rule id: ${r}`);
127:     }
128:   }
129: 
130:   // Path-safety: a skill name becomes a filesystem path segment. Only the
131:   // canonical kebab-case form is accepted so a hostile manifest entry can
132:   // never escape the skills/ directory (F-EXEC-004).
133:   const SKILL_NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
134: 
135:   const knownSkills = new Set(included);
136:   const entries = Object.entries(overrides.entries || {});
137:   const overriddenNames = new Set();
138:   for (const [name, entry] of entries) {
139:     if (!knownSkills.has(name)) fail(`override targets unknown skill: ${name}`);
140:     if (overriddenNames.has(name)) fail(`duplicate override entry: ${name}`); // JSON.parse already dedups, belt-and-braces
141:     overriddenNames.add(name);
142:     if (entry.invocation_policy !== undefined && !POLICIES.has(entry.invocation_policy)) {
143:       fail(`${name}: invalid invocation_policy ${entry.invocation_policy}`);
144:     }
145:     if (entry.risk !== undefined && !RISKS.has(entry.risk)) {
146:       fail(`${name}: invalid risk ${entry.risk}`);
147:     }
148:     // Structural type checks so the compiler can never emit an index that
149:     // violates its own schema's array/string constraints (F-EXEC-016).
150:     for (const field of ["aliases", "positive_triggers", "negative_triggers", "domains", "actions", "objects", "repo_signals", "lane_roles", "requires", "required_rules"]) {
151:       const v = entry[field];
152:       if (v !== undefined && (!Array.isArray(v) || v.some((x) => typeof x !== "string"))) {
153:         fail(`${name}: override field ${field} must be an array of strings`);
154:       }
155:     }
156:     for (const field of ["aliases", "requires", "required_rules"]) {
157:       const v = entry[field];
158:       if (Array.isArray(v) && new Set(v).size !== v.length) {
159:         fail(`${name}: override field ${field} must not contain duplicates (schema uniqueItems)`);
160:       }
161:     }
162:     for (const rule of entry.required_rules || []) {
163:       if (!knownRules.has(rule)) fail(`${name}: required_rules references unresolvable rule id: ${rule}`);
164:     }
165:     for (const req of entry.requires || []) {
166:       if (!knownSkills.has(req)) fail(`${name}: requires unknown skill: ${req}`);
167:     }
168:   }
169: 
170:   const records = [];
171:   const aliasOwners = new Map();
172:   for (const name of [...included].sort()) {
173:     if (!SKILL_NAME_RE.test(name)) fail(`skill name is not canonical kebab-case (path-safety guard): ${name}`);
174:     const rel = path.join("skills", name, "SKILL.md");
175:     const abs = path.join(root, rel);
176:     let raw;
177:     try {
178:       raw = fs.readFileSync(abs);
179:     } catch {
180:       fail(`included skill has no SKILL.md on disk: ${name}`);
181:     }
182:     let description;
183:     try {
184:       description = extractDescription(raw.toString("utf8"));
185:     } catch (e) {
186:       fail(`${name}: ${e.message}`);
187:     }
188:     const o = overrides.entries[name] || {};
189:     for (const alias of o.aliases || []) {
190:       const key = alias.trim().toLowerCase();
191:       if (!key) fail(`${name}: empty alias`);
192:       const owner = aliasOwners.get(key);
193:       if (owner && owner !== name) {
194:         fail(`alias collision: "${alias}" declared by both ${owner} and ${name}; explicit resolution would be ambiguous`);
195:       }
196:       // An alias must not collide with a DIFFERENT skill's canonical name
197:       // either, or explicit resolution would be ambiguous (F-EXEC-006).
198:       if (knownSkills.has(key)) {
199:         fail(`${name}: alias "${alias}" collides with skill canonical name "${key}"`);
200:       }
201:       aliasOwners.set(key, name);
202:     }
203:     records.push({
204:       skill: name,
205:       path: rel.split(path.sep).join("/"),
206:       content_hash: sha256(raw),
207:       description,
208:       aliases: o.aliases || [],
209:       positive_triggers: o.positive_triggers || [],
210:       negative_triggers: o.negative_triggers || [],
211:       domains: o.domains || [],
212:       actions: o.actions || [],
213:       objects: o.objects || [],
214:       repo_signals: o.repo_signals || [],
215:       lane_roles: o.lane_roles || [],
216:       invocation_policy: o.invocation_policy || "suggest-only",
217:       risk: o.risk || "low",
218:       requires: o.requires || [],
219:       required_rules: o.required_rules || [],
220:     });
221:   }
222: 
223:   return JSON.stringify(
224:     {
225:       schema_version: 1,
226:       compiled_from: {
227:         manifest_sha256: sha256(manifestBytes),
228:         overrides_sha256: sha256(overridesBytes),
229:         concern_registry_sha256: sha256(registryBytes),
230:       },
231:       skills: records,
232:     },
233:     null,
234:     2,
235:   ) + "\n";
236: }
237: 
238: /** Main entry: only when executed directly, not when imported as a library. */
239: function main() {
240:   const args = parseArgs(process.argv.slice(2));
241:   const outAbs = path.join(args.root, OUTPUT_REL);
242: 
243:   if (args.check) {
244:     let committed;
245:     try {
246:       committed = fs.readFileSync(outAbs, "utf8");
247:     } catch {
248:       fail(`--check target missing: ${OUTPUT_REL} (run without --check to generate it)`);
249:     }
250:     const fresh = compile(args.root);
251:     if (fresh !== committed) {
252:       process.stderr.write("compile-skill-router-index: DRIFT detected between canonical inputs and committed index\n");
253:       process.stderr.write("  run: node scripts/compile-skill-router-index.mjs  then commit the regenerated artifact\n");
254:       process.exit(1);
255:     }
256:     process.stdout.write(`skill-routing-index: byte-stable (${committed.split("\n").length} lines)\n`);
257:     process.exit(0);
258:   }
259: 
260:   fs.mkdirSync(path.dirname(outAbs), { recursive: true });
261:   const tmp = `${outAbs}.tmp-${process.pid}`;
262:   fs.writeFileSync(tmp, compile(args.root), { mode: 0o644 });
263:   fs.renameSync(tmp, outAbs);
264:   process.stdout.write(`compiled ${OUTPUT_REL}\n`);
265: }
266: 
267: import { fileURLToPath } from "node:url";
268: if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
269:   main();
270: }

## DOCTRINE.md
Source SHA256: 9b207aeb56cb10a28dcbdacae513891db2f3c5c8abdbf8320fee9766bbee8303

1033: 
1034: ### Autorun (One Prompt to Product)
1035: 
1036: `route-workflow --autorun` runs the entire lane from a single prompt. This is
1037: the one-prompt-to-product mode. The virtual founder (P0) takes over all human
1038: checkpoints:
1039: 
1040: - `validate-feature`: P0 reviews the business case. **Exception:** NO-SHIP
1041:   decisions always surface to the user — killing a feature is never silent.
1042: - `write-spec`: P0 reviews the spec and logs concerns as Taste decisions.
1043: - `explore-solutions`: P0 selects the approach based on research.
1044: - `plan-changeset`: P0 approves if the plan covers all ACs.
1045: - `execute-changeset`: P0 reviews diffs and approves if tests pass.
1046: - `land-changeset`: P0 merges in solo mode; opens PR and stops in team mode.
1047: 
1048: At the end of the run, all Taste decisions are presented for review. The user
1049: can override any of them retroactively.
1050: 
1051: Hard stops that cannot be P0-decided:
1052: - NO-SHIP kill decision (feature rejection)
1053: - Test failure after 3 P0 fix attempts
1054: - Critical/high security finding
1055: - Merge conflict on promotion
1056: - Team mode PR (requires external reviewer)

## skills/route-workflow/references/autorun-orchestrator.md
Source SHA256: f04e740213629502756f0a749a587b2e630977acfd8cd92dc7f13074b048c8b5

10: 
11: The pipeline runs end-to-end **within the active session whenever possible**.
12: Human checkpoints become P0-decided unless the user explicitly opts into
13: interactive mode. Cross-session unattended continuation is not assumed unless
14: the host/project actually provides a verified continuation mechanism. The only
15: hard stops are:
16: 
17: - **NO-SHIP decision** in validate-feature (killing a feature is always surfaced)
18: - **Test failure** that P0 cannot resolve after 3 attempts
19: - **Security finding** at critical/high severity
20: - **Merge conflict** on promotion to main
21: - **Team mode PR** — branch protection or required reviewers means land-changeset
22:   opens a PR and stops. The chain resumes in a future session after merge.
23: 
24: Everything else — spec approval, plan review, solution selection, landing
25: strategy — P0 decides and logs for end-of-run review.
26: 
27: ## Human Checkpoint Behavior in Autorun
28: 
29: Skills with `human_checkpoint: true` behave differently based on mode:
30: 
31: | Skill | Interactive mode | Autorun mode |
32: |-------|-----------------|-------------|
33: | `validate-feature` | Stop, ask user | P0 decides. **Exception:** NO-SHIP always stops. |
34: | `write-spec` | Stop, ask user to review spec | P0 reviews, logs concerns as Taste decisions |
35: | `explore-solutions` | Stop, present alternatives | P0 selects based on research, logs reasoning |
36: | `plan-changeset` | Stop, ask user to approve plan | P0 approves if plan covers all ACs; logs plan summary |
37: | `execute-changeset` | Stop at each task checkpoint | P0 reviews diffs, approves if tests pass |
38: | `land-changeset` | Stop, ask user to merge | P0 merges (solo mode) or opens PR and stops (team mode) |
39: | `improve-framework` | Stop, ask user to approve fix scope | P0 executes if ≤2 files / ≤50 lines; human checkpoint if larger (plan-changeset discipline) |
40: | `evolve-framework` | Stop, ask user to rank gaps | P0 auto-runs evidence gathering; human checkpoint before any implementation |
41: | `blend-external` / `blend-private` | Stop, ask user to approve source | **Always human checkpoint.** External code import is high-risk. |
42: | `test-framework` | Stop, ask user to approve test scope | P0 auto-runs; human checkpoint only if findings require multi-skill changes |
43: | `create-skill` | Stop, ask user to approve skill scope | P0 decides if template-based and ≤2 files; human checkpoint if novel skill or >2 files |
44: | `design-logo` | Stop at each phase gate | P0 decides Phases 1–4; human checkpoint at love-test (Phase 5b) and final approval (≥65/70) |
45: | `extract-bootstrap` | Stop, ask user to approve pattern set | P0 decides if repo is accessible and patterns are clear; human checkpoint if architecture is ambiguous |
46: | `find-opportunity` | Stop, ask user to rank opportunities | P0 decides (evidence-based ranking; no creative judgment needed) |
47: | `honest-diagnosis` | Stop, present blockers | P0 decides (evidence-graded; purely analytical) |
48: | `ingest-guide` | Stop, ask user to approve classification | P0 decides if classification is clear (discard/store/blend); human checkpoint if promote-to-skill |
49: | `ingest-guide-batch` | Stop, ask user to approve batch digest | P0 runs per-guide; human checkpoint if any guide is promote-to-skill |
50: | `landing-page` | Stop, ask user to approve design | P0 decides if benchmark-landing ≥7; human checkpoint if <7 (needs override or redesign) |
51: | `manage-finops` | Stop, ask user to approve cost model | P0 decides (cost calculations are deterministic from usage estimates) |
52: | `mine-builder` | Stop, ask user to review profile | P0 decides (profile update is mechanical; stops only if new high-severity blocker found) |
53: | `monetization-architecture` | Stop, ask user to approve gating matrix | P0 decides if gating matrix is clear; human checkpoint if enforcement audit finds code/pricing mismatch |
54: | `plan-blast-radius` | Stop, ask user to approve SEV classification | P0 decides (SEV classification is deterministic from terraform plan / helm diff) |
55: | `plan-capabilities` | Stop, ask user to approve capability plan | P0 decides (recommendations are evidence-based from stack-profile + registry) |
56: | `reverse-engineer` | Stop, ask user to approve twist | P0 decides if source is public and twist is mechanical; human checkpoint if twist requires product judgment |
57: | `roadmap-evaluation` | Stop, ask user to approve milestone plan | P0 decides (evidence-based prioritization and cost estimates from existing artifacts) |
58: | `stage-revenue` | Stop, ask user to approve stage breakdown | P0 decides (stage breakdown is mechanical from builder profile and feature set) |

## _shared/before-starting.md
Source SHA256: 03d2f3a64974177cf10313816294ceba6f78bdb92ad89d2007b51827f099cbc4

47: - Use `.svc/spec-index.json` / work-item indexes / manifest metadata to find dependencies.
48: - Read all artifacts that can change this run's decision or implementation.
49: 
50: Skip if: <named condition under which the read is wasted>.
51: ```
52: 
53: If a skill has NO context dependencies (rare; mostly mechanical scripts), it MAY omit the section. Otherwise the section is mandatory for skills authored on or after **2026-04-28**.
54: 
55: ## Why this rule exists
56: 
57: Sessions repeatedly burn tokens re-asking questions already answered (builder name, stack, current feature, domain conventions). The 4-source chain is the floor of "things the agent should know before saying anything." Adopting it as a convention closes a token-waste loop that has fired across multiple sessions.
58: 
59: The opposite failure is also real: an agent can read only one obvious file, miss a related spec or dependency, and then skip a mandatory branch. Relevance closure prevents both failures.
60: 
61: The pattern was imported from coreyhaines/marketingskills v1.9.0 and adapted from a 1-file model to svc's 4-source layered model. See WI-135 for full context.
62: 
63: ## Validation
64: 
65: Skills authored on or after 2026-04-28 are validated by `test-framework/evals/tier-1/validate-skill-before-starting.sh`. Older skills are exempt (advisory mode) until they receive a substantive edit; at that point the validator becomes blocking for them as well.

## scripts/generate-manifest-mirrors.mjs
Source SHA256: c56f23ea9945af50f2b8e0a8bfa1298237c8cf4eef0f4d531c554b929a37ef66

98: const BLOCKS = {
99:   "readme-included-skills": { file: "README.md", render: (body) => bulletsWithPreservedSuffix(manifest.includedSkills, body) },
100:   "external-core-pack": { file: "EXTERNAL_ADDONS.md", render: () => bullets(manifest.includedSkills) },
101:   "repo-modes-bootstrap": { file: "REPO_MODES.md", render: () => numbered(manifest.bootstrapStartSequence) },
102:   "routing-rules-core-pack": { file: "skills/route-workflow/references/routing-rules.md", render: () => bullets(manifest.corePackForRouting) },
103:   "claude-md-svc-default": { file: "CLAUDE.md", render: () => renderSvcDefault("plain") },
104:   "model-selection-quick-ref": { file: "rules/common/model-selection.md", render: () => renderQuickRef() },
105:   "model-selection-cognitive-labels": { file: "rules/common/model-selection.md", render: () => renderCognitiveLabels("table") },
106:   "model-routing-svc-default": { file: "references/model-routing.md", render: () => renderSvcDefault("rationale") },
107:   "model-routing-cognitive-labels": { file: "references/model-routing.md", render: () => renderCognitiveLabels("numbered") },
108: };
109: 
110: const escRe = (id) => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

## skills/plan-changeset/SKILL.md
Source SHA256: fdbfdf8303b835e7ced6c9fa1f86ef2c661d82a49187feda1cf29d8201b07eaa

117: | Spec annotations | RESOLVED entries in feature spec | file:line pointers to existing code — load only these specific files when you need to understand existing implementation |
118: 
119: **Compression boundary:** product context is already compressed into the artifacts above — do NOT reload raw vision/personas/domain-profile/competitors by default; load one only when a specific ambiguity can't be resolved from the spec. Stale/missing upstream artifacts → stop and route back.
120: 
121: ## Output
122: 
123: `docs/plans/<YYYY-MM-DD>-<feature-name>/manifest.md` — single source of truth. On the **dispatch** path (a zero-context executor builds it) it carries exact code payloads (CREATE = full contents; MODIFY = before/after context diffs, ≥3 lines each side). On the **inline** path (the orchestrator executes with full context already loaded) the Changeset Blueprint is skipped — see §3a.
124: 
125: ## Execution Mode (resolve BEFORE planning — WI-386)
126: 
127: Before authoring the manifest, resolve and record the execution mode, because it decides whether §3a (Changeset Blueprint) is authored at all:
128: 
129: - **`dispatch`** — a zero-context subagent (`DISPATCH=mimo-pro|sonnet`) will execute from the contract alone. Blueprints are the executor's ONLY source of truth → **§3a is MANDATORY** (full payloads, no placeholders). This preserves WI-347's Lean-Executor isolation.
130: - **`inline`** — the orchestrator executes with the full spec/UX/UI context already loaded (the only mode used in practice per `.svc/dispatch-log.jsonl`). Re-authoring blueprints here is Opus-priced double-spend (code drafted at PLAN prices, then re-applied verbatim at EXEC) → **§3a is SKIPPED.**
131: 
132: Record the resolved mode in two places, both read by the chain:
133: 1. The plan-manifest receipt's `mode` field (`dispatch` | `inline`) — `schemas/receipts/plan-manifest.schema.json` enforces "blueprints required UNLESS mode==inline" via an `if/then`, and `scripts/check-chain-receipts.mjs` mirrors that gate (the custom validator the push hook actually runs). **Absent/unmarked `mode` fails closed to dispatch semantics** — blueprints stay required, so nothing silently relaxes WI-347.
134: 2. The `.svc/dispatch-log.jsonl` entry's `mode` field, written when execute-changeset records the dispatch (via `scripts/state-io.mjs` append helpers — never raw-write `.svc`).
135: 
136: Default when unsure: **`dispatch`** (author the blueprints). Only claim `inline` when the orchestrator itself will apply the change with context loaded.
137: 
138: ## Whole-solution readiness for inline execution
139: 
140: Before coding settle the user-visible states (including empty/error/loading), state owner and lifetime, manual versus automatic intent, shared API/HTTP and transaction semantics, concurrency, migrations, exact write envelope, proof kind for each important promise, and the established release/recovery path. Probe only uncertainties that could invalidate this approach.

## skills/plan-blast-radius/SKILL.md
Source SHA256: ffb44cc27e03d9981fa3c1cd604c9ef6b250c5dbbc9a1571087da393630d4b40

5:   Pre-apply impact classifier for infra changes. Reads `terraform plan` JSON
6:   / `helm diff` output, classifies each change by destruction risk + cross-
7:   resource dependency depth into SEV-1 (destructive) / SEV-2 (in-place
8:   mutation of stateful) / SEV-3 (in-place stateless) / SEV-4 (additive).
9:   SEV-1 and SEV-2 force `human_checkpoint: true` regardless of autorun.
10:   Use when: any infra-* lane reaches phase 8 (between plan-changeset and
11:   review-plan); user mentions "blast radius", "what could break", "is this
12:   safe to apply", "SEV tier classification". Source:

55: 
56: ## SEV Tiers
57: 
58: | Tier | Definition | Examples | Gate behavior |
59: |---|---|---|---|
60: | **SEV-1** | Destructive — resource deletion or replacement of stateful resource | drop database, replace RDS, delete persistent volume | **HUMAN CHECKPOINT REQUIRED** regardless of autorun mode |
61: | **SEV-2** | In-place mutation of a stateful resource | DB version upgrade, IAM trust policy change | **HUMAN CHECKPOINT REQUIRED** |
62: | **SEV-3** | In-place mutation of stateless resource | ASG instance type change, ALB rule update | warn, proceed |
63: | **SEV-4** | Additive only | new resource, new IAM role, new tag | proceed silently |
64: 
65: ## Cross-resource dependency depth
66: 
67: A SEV-3 change becomes SEV-2 if its blast radius spans ≥3 downstream resources. Example: changing a security group attached to one EC2 = SEV-3; changing one attached to a shared RDS read by 5 services = SEV-2.
68: 
69: ## Output
70: 
