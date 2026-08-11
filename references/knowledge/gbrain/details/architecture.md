# gbrain Architecture — Details

## Git-Native Knowledge Base

gbrain uses a Git repository full of Markdown files as its "System of Record."
- **Dual-Write:** When a page is updated, gbrain writes both to the Postgres database (for search) and to the local filesystem (for human-readability and version control).
- **Source of Truth:** Filesystem wins. `gbrain sync` reconciles the DB from the files.
- **Privacy:** Certain folders (e.g., `private/`) can be excluded from sync.

## Engine Abstraction

gbrain abstracts the database layer into a `BrainEngine` interface, supporting:
1.  **PGLite:** An in-memory, WASM-compiled Postgres 17 database. Zero install, ephemeral.
2.  **Postgres:** A full Supabase or standard Postgres instance. Supports `pgvector` and `pg_trgm`.
3.  **Thin Client:** A remote mode where the CLI dispatches operations to an MCP server via OAuth 2.1.

## Multi-Brain Support (Sources)

A single gbrain can manage knowledge from multiple Git repositories:
- **Sources Table:** Tracks each repository by a short ID (e.g., `wiki`, `work`).
- **Path Mapping:** Each source defines a `local_path` on the machine.
- **Federated Search:** Queries can be scoped to a single source or run across the whole brain.

## Background Processors (Minions)

gbrain implements a Postgres-native job queue for reliable async work:
- **Workers:** Can be local (stdio) or remote (HTTP).
- **Sub-agents:** A specialized job type that spawns a full AI agent with tool-use capability.
- **Concurrency:** Guarded by `pg_advisory_xact_lock` on the job name + queue.

## L4 Pointers

- **Engine logic**: `src/core/engine.ts`, `postgres-engine.ts`, `pglite-engine.ts`
- **Schema definition**: `src/schema.sql`
- **Minion queue**: `src/core/minions/queue.ts`
- **CLI entry**: `src/cli.ts`
