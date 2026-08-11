# SkillHub — Layer 3 Details

## Search API

### Mechanism
- **Endpoint:** `POST /api/v1/skills/search`
- **Auth:** `Authorization: Bearer YOUR_API_KEY` (required)
- **Rate limit:** 60 req/min (standard), 100 req/min (IP)
- **Parameters:**
  - `query` (string, required) — search term
  - `limit` (1-100, default 20) — results per request
  - `category` (optional) — filter: development, devops, testing, documentation, security, data, ai-ml, frontend, backend, mobile, other
  - `method` (optional) — "hybrid" | "embedding" | "fulltext"
- **Catalog browse:** `GET /api/v1/skills/catalog` with pagination

### Analysis
The semantic search + embedding mode is stronger than skills.sh keyword matching. The 5-dimension AI rating adds a quality signal that skills.sh completely lacks. However:
- Categories don't include "monetization", "billing", "pricing" explicitly (would need keyword search)
- API key requirement adds friction for automated discovery
- Unknown how ratings are generated (black-box AI evaluation)
- Paid tiers ($9.99/mo Pro for 50 queries/day) limit heavy use

### L4 Pointers
- API docs: https://www.skillhub.club/docs/api
- CLI: `npx @skill-hub/cli` (search, install)
- GitHub: github.com/keyuyuan/skillhub-awesome-skills

## Quality Rating System

### Mechanism
Five dimensions, each scored 0-10:
1. **Practicality** — real-world utility
2. **Clarity** — instruction quality
3. **Automation** — how much it automates
4. **Quality** — code/content quality
5. **Impact** — value delivered

Letter grades: S (9.0+, "Must-Have"), A (8.0+, "Excellent"), B, C, etc.

### Analysis
The multi-dimensional rating is the strongest quality signal in the ecosystem. skills.sh has only install count (popularity ≠ quality). SkillsMP has only 2-star minimum (barely a filter). However, the AI evaluation methodology is opaque — we can't verify what "Practicality: 9.2" actually means or how consistently it's applied.

### L4 Pointers
- Rating display: visible on each skill detail page on skillhub.club
