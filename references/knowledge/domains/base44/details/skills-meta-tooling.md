# Base44 Skills Meta-Tooling

## Source
- `.claude/skills/skill-creator/` — skill creation guide and scripts
- `.claude/skills/review-skills/` — skill review and validation
- `.claude/skills/sync-cli-skill/` — CLI skill synchronization
- `.claude/skills/sync-sdk-skill/` — SDK skill synchronization

## skill-creator

### Purpose
> "Guide for creating effective skills. This skill should be used when users want to create a new skill (or update an existing skill) that extends Claude's capabilities with specialized knowledge, workflows, or tool integrations."

### Core Principles

> "The context window is a public good. Skills share the context window with everything else Claude needs: system prompt, conversation history, other Skills' metadata, and the actual user request."

> "Default assumption: Claude is already very smart. Only add context Claude doesn't already have. Challenge each piece of information: 'Does Claude really need this explanation?' and 'Does this paragraph justify its token cost?'"

### Degrees of Freedom

| Level | When to Use |
|-------|-------------|
| High freedom (text-based) | Multiple approaches valid, decisions depend on context |
| Medium freedom (pseudocode/scripts with parameters) | Preferred pattern exists, some variation acceptable |
| Low freedom (specific scripts, few parameters) | Operations fragile, consistency critical |

### Anatomy of a Skill

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter (name + description required)
│   └── Markdown instructions
└── Bundled Resources (optional)
    ├── scripts/          - Executable code
    ├── references/       - Documentation loaded as needed
    └── assets/           - Files used in output
```

### Progressive Disclosure

Three-level loading system:
1. **Metadata (name + description)** — Always in context (~100 words)
2. **SKILL.md body** — When skill triggers (<5k words recommended, <500 lines)
3. **Bundled resources** — As needed by Claude

> "When splitting out content into other files, it is very important to reference them from SKILL.md and describe clearly when to read them."

### Scripts (`scripts/`)
- When to include: same code rewritten repeatedly or deterministic reliability needed
- May be executed without loading into context window

### References (`references/`)
- When to include: documentation Claude should reference while working
- Best practice: if files >10k words, include grep search patterns in SKILL.md
- Avoid duplication: info lives in either SKILL.md OR references, not both

### Assets (`assets/`)
- Files not intended to be loaded into context, but used in output
- Examples: templates, images, icons, boilerplate code

### What NOT to Include
- README.md
- INSTALLATION_GUIDE.md
- QUICK_REFERENCE.md
- CHANGELOG.md
- Any auxiliary context about the process that went into creating it

> "The skill should only contain the information needed for an AI agent to do the job at hand."

### Skill Creation Process

1. Understand the skill with concrete examples
2. Plan reusable skill contents (scripts, references, assets)
3. Initialize the skill (`scripts/init_skill.py <skill-name> --path <output-dir>`)
4. Edit the skill (implement resources and write SKILL.md)
5. Package the skill (`scripts/package_skill.py <path/to/skill-folder>`)
6. Iterate based on real usage

### init_skill.py
Creates skill directory with:
- SKILL.md template with proper frontmatter and TODO placeholders
- Example resource directories: `scripts/`, `references/`, `assets/`

### package_skill.py
Validates then packages into `.skill` file (zip with `.skill` extension). Validates:
- YAML frontmatter format and required fields
- Skill naming conventions and directory structure
- Description completeness and quality
- File organization and resource references

### Writing Guidelines
Always use imperative/infinitive form.

Description field is the primary triggering mechanism:
> "Include both what the Skill does and specific triggers/contexts for when to use it. Include all 'when to use' information here — Not in the body. The body is only loaded after triggering, so 'When to Use This Skill' sections in the body are not helpful to Claude."

## review-skills

### Purpose
> "Review and analyze a skill against best practices for length, intent scope, and trigger patterns."

### Validation Checklist

1. **File Structure**: SKILL.md exists
2. **Frontmatter Format**: Valid YAML between `---` delimiters
3. **Allowed Properties**: Only `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`
4. **Name Validation**:
   - Hyphen-case only (lowercase, digits, hyphens)
   - No start/end hyphens, no consecutive hyphens
   - Max 64 characters
   - Matches directory name
5. **Description Validation**:
   - No angle brackets (`<` or `>`)
   - Max 1024 characters
   - Non-empty

### Spec Compliance Checks

- Directory structure matches `name`
- Frontmatter fields: name (1-64 chars), description (1-1024 chars)
- Body: Markdown, under 500 lines, step-by-step instructions recommended
- Progressive disclosure: metadata ~100 tokens, instructions <5k tokens, resources as needed
- File references: relative paths, one level deep

### Analysis Areas

1. **Length Analysis** — word count in description, line count in SKILL.md, reference files count, duplication
2. **Intent Scope Analysis** — all intents served, whether splitting would improve triggering
3. **Trigger Analysis (CRITICAL)** — three trigger types:
   - User INTENT: what user wants to do
   - TECHNICAL context: code patterns, file types, imports
   - Project stack: frameworks, tools, file structures

> "Good trigger pattern example: ACTIVATE when (1) INTENT - user wants to [action]; (2) TECHNICAL - code contains [patterns]; (3) CONTEXT - project has [structure/files]"

## sync-cli-skill

### Purpose
> "Synchronize the `skills/base44-cli/` skill with the latest CLI source code from the Base44 CLI repository using git-based change detection."

### Workflow

1. **Gather input**: CLI source folder path (must be git repository)
2. **Validate**: Check `.git/`, `package.json`, discover commands directory
3. **Read local version** from `CLI_VERSION`
4. **Detect changes** via git:
   ```bash
   git diff --name-only <stored-version> HEAD -- <commands-path>
   ```
5. **Check infrastructure changes** (non-command files)
6. **Process each changed command**: route to correct skill (base44-cli or base44-troubleshooter), read existing reference, compare source vs docs, update reference
7. **Update main SKILL.md** files if commands added/removed
8. **Update CLI_VERSION** and skill frontmatter `metadata.sourcePackage.version`

### Command Routing

| Command | Target Skill |
|---------|-------------|
| `logs` | `skills/base44-troubleshooter/` |
| Everything else | `skills/base44-cli/` |

Reference mapping: `<commands-path>/{parent}/{name}.ts` → `references/{parent}-{name}.md`

### Breaking Changes to Detect
- New/removed options
- Option ↔ positional argument conversions
- Changed defaults, types, required status
- New/removed commands

## sync-sdk-skill

### Purpose
> "Synchronize the `skills/base44-sdk/` skill with the latest SDK source code from the Base44 SDK repository."

### Workflow

1. **Gather input**: SDK source folder path, optional documentation URL
2. **Validate**: Check `package.json` with `@base44/sdk`, `src/` directory
3. **Discover modules**: scan `src/`, `src/modules/`, `lib/` for module files
4. **Read existing skill** files
5. **Compare and identify changes**: new modules, new methods, updated signatures, deprecated/removed methods
6. **Fetch external documentation** (optional)
7. **Update reference files** for each module
8. **Update SKILL.md**: module table, quick start, module selection, common patterns, frontend vs backend table

### Module-Specific Guidelines

- **entities.md**: CRUD methods, query filter syntax, `subscribe()` for realtime, RLS/FLS implications
- **auth.md**: all auth methods, `me()`, `updateMe()`, `logout()`, token handling
- **integrations.md**: `Core` submodule (InvokeLLM, SendEmail, UploadFile, GenerateImage), `custom.call()`
- **connectors.md**: service role/backend only, `getAccessToken()`
- **functions.md**: frontend invocation + backend implementation, `createClientFromRequest()`, `asServiceRole`

## Cross-References
- `skills-repo-structure.md` — Repository layout and skill categories
- `skills-plugin-packaging.md` — Plugin validation and packaging
