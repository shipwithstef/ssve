## Analysis Mode (full extraction — sub-agent + gates)

Analysis mode runs full source extraction through a sub-agent with a fallback chain. The
skill picks the agent, not the caller.

| Order | Agent | Use when |
|-------|-------|----------|
| 1 | **agy-cli** (default) | First-choice for large-source extraction. Long context, cheap tokens. |
| 2 | **Claude** (in-session) | Fallback when agy-cli errors, is out of credits, or stalls mid-pass. |

**Fallback trigger:** if agy-cli returns non-zero, times out, or returns partial coverage
(< 100%), hand off to Claude in the SAME invocation. A partial extraction is NOT a terminal
state. Override: `SVC_RESEARCH_AGENT=claude`. **Machine-readable endpoint exception:** when
the source exposes a content index (Mintlify `llms.txt`, Docusaurus `sidebars.json`, GitBook
API), the skill MAY bypass sub-agent dispatch and fetch indexed raw content directly —
document the exception in the prescope; run all gates as normal. Not for e-commerce /
competitor homepages / JS-rendered / incomplete indexes.

**Protocol (in order):**
1. Clone/pull the source.
2. **Pre-scope (mandatory)** — `docs/specs/research-prescope-<source>.md` per
   `skills/research/references/prescope-template.md`: volume estimate, file checklist, extraction
   plan, sub-agent selection, expected outputs. For website sources use the auto-generator:
   `node skills/research/scripts/website-prescope.mjs <url> --domain <domain>` (robots/sitemap/imprint
   aware). Hand-writing the checklist hides sub-pages — use the script; document any fallback.
   Inspection gate: checklist non-empty, domain justified, sub-agent explicit, else no extraction.
3. **Domain gate (mandatory)** — `node skills/research/scripts/domain-gate.mjs --source <name>
   --domain <proposed> --justification "<why>" [--new-domain]`. Refused (exit 1/2) → resolve
   before writing anything under `references/knowledge/`. Verify `knowledge_root` in the JSON
   is the intended path. Silent mis-filing is the #1 historical failure — the gate refuses it.
4. **Sub-agent dispatch** — `node skills/research/scripts/dispatch-agy.mjs --prescope <ps> --domain <domain>`
   (strict prompt: verbatim quotes, footer/imprint-aware, per-URL findings table, coverage
   table). On error/timeout/partial → Claude fallback, same invocation.
5. **Single-pass extraction** — read every checklist file FULLY into
   `CAPABILITIES.md` (Layer 2), `details/<area>.md` (Layer 3, one per area), `.version`. No
   bit-by-bit re-prompting. Apply Step 4 tiering to every cited source.
6. **Leave files uncommitted** after the pass. Never run git commit for the user.
7. **Verify coverage (mandatory)** — `node skills/research/scripts/coverage-check.mjs --prescope <ps>
   --domain references/knowledge/<domain>/`. Exit 0 = 100%; non-zero lists missing URLs.
   Do not proceed until 100% — re-dispatch missing URLs, re-run.
8. **Validate per-URL deep extraction** — `node skills/research/scripts/deep-extraction-check.mjs
   <raw-extraction.md>` (each `## URL:` block has Status + Body + verbatim quotes, or an
   honest Error/Inaccessible verdict). Catches "URL acknowledged but content not extracted."
9. **Playwright extraction for accordion / SPA / collapsed content** (when content is
   suspected hidden — low char-count, Elementor/Divi/WPBakery, `<details>`, FAQ markers):
   `node skills/research/scripts/playwright-extract.mjs <url> --out <out.txt>` (renders JS, expands
   accordions/tabs/`<details>`, clicks "show more"). Static-fetch < 5% body/HTML chars signals
   missed accordion content (validator `validate-research-content-density.sh`). Failure mode
   this prevents: 2026-05-03 advokatami.bg — FAQ accordion price composition missed though all
   validators passed.
10. **Activity validation** (mandatory for website/competitor/vendor sources) —
    `node skills/research/scripts/blog-crawl.mjs <site-url> --domain references/knowledge/<domain>/
    --months 12` → `.activity.json` scorecard (active/dormant/abandoned) + `details/blog-recent.md`.
    Prevents stale "site is active" assumptions. Skip: no public blog → `.activity-na` marker.
11. **Synthesize meaning** (mandatory for ≥5 detail files OR a blog-posts/ dir) —
    `node skills/research/scripts/synthesize-meaning.mjs --domain references/knowledge/<domain>/
    [--project-context "<...>"]` → `details/applied-knowledge.md` with its 6 mandatory sections.
    The "no loss of meaningful info" gate. Skip (pure mechanical config) → `.applied-na` marker.
12. **Write provenance (mandatory)** — one line per source to
    `references/knowledge/<domain>/.sources.jsonl`:
    `{"url":"<url-or-path>","sha256":"<hash>","retrieved_at":"<ISO-8601-UTC>","retrieval_method":"<webfetch|agy-cli|gh-api|local-file>","extracted_into":["CAPABILITIES.md","details/<area>.md"]}`.
    **If no sources can be cited, the extraction is REFUSED — do not write CAPABILITIES.md.**
    Training-data confabulation without source anchoring is the failure this gate prevents
    (WI-SPINE-006); `validate-knowledge-domain-provenance.sh` enforces it.
13. **Reflect source heuristics** — apply Step 6 per `(domain, claim_class)` bet made.
14. Update `references/knowledge/INDEX.md` + `.version`.
15. **Hand off, no git writes.** List the knowledge files written (CAPABILITIES.md, .version,
    details/*.md, .sources.jsonl, source-heuristics.jsonl, INDEX.md, research-log.md, prescope).
    Verify `.svc/coverage.lock` matches the current `--prescope` + resolved `--domain` (a stale lock
    from another domain is not valid proof). Do not commit, tag or push; offer the suggested
    commit subject `research: extract <source> knowledge (<repo>)` as text and let the user decide.

**The coverage check is mandatory.** The #1 failure of research is "read the main file, skim
the rest, declare done." If the repo has 7 reference docs, you read 7.

**Model/host/effort:** configurable via the active profile and existing overrides
(`SVC_RESEARCH_AGENT`, `resolve-model.sh`). Do not pin a fixed default old recipe.
Mechanical extraction stays mechanical. **Session interrupts:** resume from the first
area in CAPABILITIES.md lacking a `details/` file. **The output is always layered
knowledge** — INDEX.md entry, CAPABILITIES.md, details/*.md, .version — never a chat
response that disappears.
