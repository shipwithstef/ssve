# Deep Drills: gbrain Batch 5 (Extreme Depth & True 100%)

This document completes the absolute exhaustive mapping of gbrain, including the "Shadow Intelligence" found in tests, configs, and metadata.

---

## 41. Operative Trust Boundary (`src/cli.ts` vs `src/mcp/server.ts`)

**The Architecture:** gbrain distinguishes between a human using the CLI and an untrusted AI agent using the MCP server.
**The Implementation:**
It uses an `OperationContext` with a `remote: boolean` flag.
- **CLI (`remote: false`):** Verifies file existence but allows any accessible path (loose mode).
- **MCP (`remote: true`):** Activates the **Confinement Root Guard**. It uses `realpathSync` + `path.relative` to mathematically prove that the requested path is inside the project root and is NOT a symlink escaping the sandbox.

## 42. Anti-Loop "Amnesia" Prevention (`src/core/facts/extract.ts`)

**The Architecture:** Prevents the "I heard it from myself" hallucination loop where an agent extracts a "fact" from a summary it previously wrote.
**The Implementation:**
The fact extractor scans the frontmatter of any page for the `dream_generated: true` marker. If present, the `extractFactsFromTurn` function immediately returns an empty array, breaking the recursive knowledge loop.

## 43. Multi-Axis Routing Model (`AGENTS.md`)

**The Architecture:** GBrain routes every operation on two axes: **Brain** (which DB) and **Source** (which Git repo).
**The Intelligence:**
This isn't just a database; it's a federated graph. The agent is taught (via `skills/conventions/brain-routing.md`) when to switch brains (e.g., Personal vs. Work) vs when to switch sources (e.g., Wiki vs. Codebase) within a single brain.

## 44. Storage Segregation Policy (`gbrain.yml`)

**The Architecture:** Distinguishes between "Human-Curated" and "Machine-Generated" content.
**The Implementation:**
- `db_tracked`: Directories like `people/`, `concepts/`, and `ideas/` are committed to Git and treated as the System of Record.
- `db_only`: Directories like `media/x/` and `meetings/transcripts/` are persisted in Postgres only and `.gitignored`. They are bulky and ephemeral, restorable only via `gbrain export`.

## 45. Functional-Area Resolver Hierarchy (`evals/functional-area-resolver/`)

**The Architecture:** Solves the "Too Many Tools" problem where LLMs get confused by a flat list of 40+ skills.
**The Intelligence:**
The "Dispatcher Pattern" uses a single-LLM-pass hierarchy:
- **Area Dispatchers:** Agents first see high-level areas (e.g., `executive-assistant`).
- **(dispatcher for: ...)**: The dispatcher listing allows the LLM to drill down into specific sub-skills (e.g., `gmail`, `calendar`) in one turn, reducing token usage by 52% while increasing routing accuracy by 15%.

## 46. Symlink Escape Defense (B5 Regression) (`test/file-upload-security.test.ts`)

**The Security Logic:**
A dedicated test case ensures that `validateUploadPath` rejects symlinks even if the *final component* is a file inside the root, but the *parent directory* is a symlink pointing outside the root. It uses `realpathSync` to resolve the true physical location before performing the relative-path check.

## 47. Slug Allowlist (H5 Defense-in-Depth) (`src/core/operations.ts`)

**The Implementation:**
A strict regex-based allowlist for all user-supplied slugs:
`const PAGE_SLUG_SEG = [a-z0-9][a-z0-9\-]*`
It explicitly rejects URL-encoded traversal (`%2e%2e`), backslashes, RTL overrides (`\u202E`), and consecutive slashes, treating anything not on the allowlist as a potential attack.

## 48. Hot Memory Notability Filter (`src/core/facts/extract.ts`)

**The Architecture:** Prevents the brain from being cluttered with "Logistical Noise."
**The Intelligence:**
The extractor classifies facts into three salience tiers:
- **High:** Major life/business commitments (Extracted immediately).
- **Medium:** Durable character preferences (Queued for batch processing).
- **Low:** "We're meeting at X place" (Discarded).

## 49. Receipt-Bound Rubric Stability (`src/core/takes-quality-eval/rubric.ts`)

**The Architecture:** Ensures that quality benchmarks are comparable across time.
**The Logic:**
It generates a `rubricSha8()` fingerprint of the evaluation criteria (Accuracy, Attribution, etc.). This hash is bound into the filename of every review receipt. If the rubric changes, the hash changes, and the framework automatically segregates the old and new quality trends.

## 50. Cathedral II Symbol-Awareness (`src/core/link-extraction.ts`)

**The Architecture:** Shifts from "Full-Text Search" to "Implementation Mapping."
**The Implementation:**
The extraction logic specifically identifies `classes`, `functions`, and `methods` as first-class entity types. It populates a `calls` and `references` graph, allowing agents to answer "Who uses this function?" with 100% mathematical certainty instead of relying on fuzzy grep.
