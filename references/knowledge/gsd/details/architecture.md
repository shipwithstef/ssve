# GSD Architecture Details

## Layered Model
The architecture is built on four core layers:
1. **Command (.md)**: Slash commands that map natural language / parameters to workflows.
2. **Workflow (.md)**: The orchestrator. Loads context, resolves models, and sequentially or concurrently invokes agents. 
3. **Agent (.md)**: Specialized prompt + tools. It is given a strict subset of context (to avoid rot) and a clear definition of 'done'.
4. **CLI Tools (.cjs)**: Heavy lifting (git ops, path resolution, JSON parsing) is offloaded to deterministic JS scripts.

## File-based State
GSD maintains no server or external database. All state resides in `.planning/`.
- `STATE.md`: Mutated on major transitions.
- `ROADMAP.md`: Living queue of phases.
- `config.json`: Master switches and model routing.

## Parallel Execution & Integrity
- **Wave Execution**: `gsd-executor` instances run in parallel for non-dependent tasks.
- **Locking**: `proper-lockfile` provides mutexes over `STATE.md` to prevent agent race conditions.

## New Defenses (v1.35-v1.50)
- **Package Legitimacy Gate**: Three-layer verification preventing hallucinatory package names.
- **Graphify Staleness**: AST extraction artifacts now embed `built_at_commit` to sync seamlessly with git.
