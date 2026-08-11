# Proposal: Fix Research Skill Path Resolution

## Problem Statement
The `research` skill is currently saving global domain and competitor knowledge into the local project directory (e.g., `example-marketplace/references/knowledge/`) rather than the global framework repository (`~/.gemini/skills/references/knowledge/`).

This occurs because the `research` skill scripts (`dispatch-gemini.mjs`, `coverage-check.mjs`, `domain-gate.mjs`) and instructions in `research/SKILL.md` rely on relative paths like `references/knowledge/<domain>`. When the agent executes these tools from the root of a project workspace, the relative paths resolve locally. This causes global intelligence (which should benefit all projects) to become siloed within individual project repositories.

## Proposed Solutions

### 1. Absolute Path Resolution in Scripts
Update all Node.js scripts in the `research/scripts/` directory to resolve the `references/knowledge/` directory relative to the skill's own installation path, rather than `process.cwd()`.

**Implementation details:**
- In `domain-gate.mjs`, `coverage-check.mjs`, `deep-extraction-check.mjs`, `dispatch-gemini.mjs`, etc., introduce a base path resolver:
  ```javascript
  import { fileURLToPath } from 'url';
  import { dirname, join } from 'path';

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const KNOWLEDGE_BASE_DIR = join(__dirname, '../../references/knowledge');
  ```
- Use `KNOWLEDGE_BASE_DIR` instead of trusting relative path inputs or expecting the user to pass the correct absolute path.

### 2. Environment Variable Override
Introduce an environment variable `SVC_KNOWLEDGE_DIR` that explicitly defines where the framework's knowledge base lives. If not set, it defaults to the path relative to the script execution.

### 3. Update SKILL.md Instructions
Modify `research/SKILL.md` to instruct the agent to explicitly cd into the skill's directory (`~/.gemini/skills/research/`) before executing the final `git commit`, `git tag`, and `git push` commands for the extracted knowledge. Currently, the instructions assume the agent is already in the correct directory.

## Action Plan
1. Enter the `improve-framework` lane.
2. Refactor the `research` skill scripts to use absolute path resolution based on `import.meta.url`.
3. Update `research/SKILL.md` to clarify the absolute paths for the global knowledge base and ensure the Git operations run in the correct repository.
