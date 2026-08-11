# Bootstrap Templates

Production-verified project patterns extracted from real repos. When a template
matches your stack, `explore-solutions` can skip — the paradigm is already proven.

## Structure

Each template is a directory:

```
references/bootstraps/
  nextjs-prisma-trpc/
    manifest.md          — stack, patterns, when to use, who verified
    decisions.md         — pre-made paradigm decisions (what explore-solutions would produce)
    scaffold.sh          — creates skeleton project (optional)
  express-postgres-rest/
    manifest.md
    decisions.md
```

## manifest.md Format

```markdown
# Bootstrap: <name>

## Stack
- Runtime: <e.g., Node.js 20>
- Framework: <e.g., Next.js 14 App Router>
- Database: <e.g., PostgreSQL 16 via Prisma>
- API: <e.g., tRPC v11>
- Testing: <e.g., Vitest + Playwright>

## Verified By
- Source repo: <url or "internal">
- Users: <rough scale — "100+", "10K+", "production since 2024">
- Last verified: <date>

## When To Use
<conditions where this template is the right choice>

## When NOT To Use
<conditions where this template is wrong — different paradigm needed>

## Patterns
<key architectural patterns this template establishes>

## Conventions
<naming, file structure, import style, error handling>
```

## How Templates Are Created

### From a public repo (via extract-bootstrap skill)

```
Use extract-bootstrap to extract patterns from https://github.com/org/repo
```

The skill analyzes the repo's architecture, dependencies, patterns, and
conventions, then produces a manifest.md + decisions.md.

### Manual

Create the directory and files by hand from your own production experience.

## How Templates Are Used

1. `explore-solutions` checks `references/bootstraps/` for a matching template
2. If a template's "When To Use" matches the current feature's stack/context:
   - Load the template's `decisions.md` as pre-made paradigm decisions
   - Skip exploration (the paradigm is production-verified)
   - The tech design incorporates the template's patterns
3. If no template matches → explore-solutions runs full exploration

## Contributing Templates

Templates can live in:
- **Same repo** — `references/bootstraps/` (committed, versioned with the project)
- **Remote repo** — fetched on demand via URL in a registry file
- **Shared registry** — a separate repo of templates your team maintains
