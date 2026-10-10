# Creating a skill — detail

Moved verbatim from SKILL.md (progressive disclosure).

### Write the SKILL.md

Based on the user interview, fill in these components:

- **name**: Skill identifier (use `verb-noun` convention: write-spec, design-ux, audit-ac)
- **version**: SKILL.md contract version, a quoted string starting at `"1.0"` (placed immediately after `name`). REQUIRED on every includedSkill. SKILL.md contracts (inputs/outputs/chain) change frequently; the version field lets downstream skills and validators detect breaking contract changes. Bump it when you change inputs/outputs/chain in a backward-incompatible way. Enforced by `test-framework/evals/tier-1/validate-skill-structure.sh`.
- **description**: When to trigger, what it does. This is the primary triggering mechanism - include both what the skill does AND specific contexts for when to use it. All "when to use" info goes here, not in the body. Note: currently Claude has a tendency to "undertrigger" skills -- to not use them when they'd be useful. To combat this, please make the skill descriptions a little bit "pushy". So for instance, instead of "How to build a simple fast dashboard to display internal Anthropic data.", you might write "How to build a simple fast dashboard to display internal Anthropic data. Make sure to use this skill whenever the user mentions dashboards, data visualization, internal metrics, or wants to display any kind of company data, even if they don't explicitly ask for a 'dashboard.'"
- **compatibility**: Required tools, dependencies (optional, rarely needed)

**svc-specific frontmatter (required for pipeline skills, optional for utility skills):**
```yaml
inputs:
  required:
    - { path: "docs/specs/vision.md", artifact: vision }
  optional:
    - { path: "~/.svc/builder-profile.md", artifact: builder-profile }
outputs:
  produces:
    - { path: "docs/specs/features/*.md", artifact: feature-spec }
chain:
  lanes:
    greenfield: { position: N, prev: <skill>, next: <skill> }
    brownfield-feature: { position: N, prev: <skill>, next: <skill> }
  progressive: true    # auto-invoke next skill in lane
  self_verify: true    # has self-check before declaring done
  human_checkpoint: true  # stops for user in interactive mode
```

**svc-specific sections (add after the main process):**
- **Self-Verify Checklist** — table of PASS/FAIL checks the skill runs before declaring done
- **Pipeline Continuation** — how the skill chains: `--progressive` flag behavior, `--skip`, `--lane`
- **Key Principles** — 3-6 bullets capturing design philosophy

**After creating the skill, also:**
1. Add to `skills-manifest.json` → `includedSkills` (and to `laneDefinitions` if pipeline skill)
2. Add to `README.md` → appropriate skill table section
3. Add to `EXTERNAL_ADDONS.md` → core pack list
4. Create eval at `test-framework/evals/tier-2/scenarios/<name>-eval.md`
5. Run `node scripts/lint-skills-manifest.mjs` to verify consistency
6. Check for overlap: `grep -r "<trigger phrases>" --include="SKILL.md"` across existing skills
7. **MANDATORY — run the installer** to symlink the new skill into every installed host's skills directory. Without this step, the skill exists in the framework repo but is invisible to Claude Code / Codex after session restart:

   ```bash
   cd $FRAMEWORK_REPO && ./setup --host claude
   # If Codex is also installed on this machine, also run:
   [ -d ~/.codex/skills ] && ./setup --host codex
   # If OpenCode is also installed on this machine, also run:
   [ -d ~/.config/opencode/skills ] && ./setup --host opencode
   ```

   The setup script is idempotent — it creates symlinks for any new skills and leaves existing ones untouched. Expected output includes a line like `Skills: 1 installed, N already current`. If that shows `0 installed`, something's wrong — the new skill directory must exist and contain a valid SKILL.md.

8. Commit both the skill AND the manifest/README/EXTERNAL_ADDONS changes in the framework repo so the skill persists across machines.

**Why step 7 matters — read this before skipping it:**

| Thought | Reality |
|---------|---------|
| "The skill file exists in the repo, it's done" | The repo is the source; the symlink is what Claude loads. No symlink = skill doesn't exist from Claude's perspective. |
| "I'll run setup later" | You won't. The user will log out, log back in, and the skill will be missing. Run it now. |
| "Maybe reload-plugins picks it up automatically" | It doesn't. Reload only refreshes symlinks that already exist. |
| "This is a one-off, not worth the overhead" | Every skill creation is a one-off. Every one of them needs the symlink. The cost is one bash command. |

**Red flags — if you catch yourself doing any of these, stop and run setup:**
- Declaring the skill "created" without having run `./setup`
- Suggesting the user "manually check" if the skill works
- Telling the user to "restart Claude" without first running the installer

**the rest of the skill :)**

### Skill Writing Guide

#### Anatomy of a Skill

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter (name, version, description required)
│   └── Markdown instructions
└── Bundled Resources (optional)
    ├── scripts/    - Executable code for deterministic/repetitive tasks
    ├── references/ - Docs loaded into context as needed
    └── assets/     - Files used in output (templates, icons, fonts)
```

#### Progressive Disclosure

Skills use a three-level loading system:
1. **Metadata** (name + description) - Always in context (~100 words)
2. **SKILL.md body** - In context whenever skill triggers (<500 lines ideal)
3. **Bundled resources** - As needed (unlimited, scripts can execute without loading)

These word counts are approximate and you can feel free to go longer if needed.

**Key patterns:**
- Keep SKILL.md under 500 lines; if you're approaching this limit, add an additional layer of hierarchy along with clear pointers about where the model using the skill should go next to follow up.
- Reference files clearly from SKILL.md with guidance on when to read them
- For large reference files (>300 lines), include a table of contents

**Domain organization**: When a skill supports multiple domains/frameworks, organize by variant:
```
cloud-deploy/
├── SKILL.md (workflow + selection)
└── references/
    ├── aws.md
    ├── gcp.md
    └── azure.md
```
Claude reads only the relevant reference file.

#### Principle of Lack of Surprise

This goes without saying, but skills must not contain malware, exploit code, or any content that could compromise system security. A skill's contents should not surprise the user in their intent if described. Don't go along with requests to create misleading skills or skills designed to facilitate unauthorized access, data exfiltration, or other malicious activities. Things like a "roleplay as an XYZ" are OK though.

#### Writing Patterns

Prefer using the imperative form in instructions.

**Defining output formats** - You can do it like this:
```markdown
## Report structure
ALWAYS use this exact template:
# [Title]
## Executive summary
## Key findings
## Recommendations
```

**Examples pattern** - It's useful to include examples. You can format them like this (but if "Input" and "Output" are in the examples you might want to deviate a little):
```markdown
## Commit message format
**Example 1:**
Input: Added user authentication with JWT tokens
Output: feat(auth): implement JWT-based authentication
```
