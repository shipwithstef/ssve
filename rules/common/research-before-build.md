---
description: Research before implementation — search priority that prevents reinventing the wheel
scope: project
stack: universal
source: blended:ecc
source_sha: 125d5e619905d97b519a887d5bc7332dcc448a52
---

# Research Before Building

Before writing any new implementation, search in this priority order:

1. **GitHub code search first** — `gh search repos` and `gh search code` for
   existing implementations, templates, and patterns. Do this before writing anything.

2. **Vendor/library docs second** — consult primary documentation to confirm API
   behavior, package usage, and version-specific details before implementing.

3. **Broader web search only if needed** — use WebSearch for discovery after
   GitHub and primary docs have been checked.

4. **Check package registries** — search npm/PyPI/crates.io/etc. before writing
   utility code. Prefer a battle-tested library over a hand-rolled solution.

**Goal:** adopt or port a proven approach whenever it covers 80%+ of the requirement.
Writing net-new code is the last resort, not the first instinct.
