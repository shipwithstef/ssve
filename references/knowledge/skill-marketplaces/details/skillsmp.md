# SkillsMP — Layer 3 Details

## Platform Assessment

### Mechanism
- **URL:** https://skillsmp.com
- **Sourcing:** scrapes public GitHub repos for SKILL.md files
- **Filter:** minimum 2 GitHub stars to be listed
- **Count claim:** 700K+ (has varied: 66K in Jan 2026, 96K in a Medium article, 805K referenced by user)
- **Search:** web UI only
- **API:** none discovered (site returns 403 to programmatic access)
- **Install:** manual copy of SKILL.md content

### Analysis
The inflated count is the biggest red flag. The number has varied wildly across sources (66K → 96K → 700K → 805K), suggesting either rapid growth through aggressive scraping or inconsistent counting. A 2-star GitHub minimum is almost no filter — most repos that exist for more than a week accumulate 2 stars from bots alone.

**Not suitable for automated integration because:**
1. No API (403 on web fetch — may actively block programmatic access)
2. No CLI
3. No quality signal beyond 2-star minimum
4. Inflated count means low signal-to-noise ratio
5. Manual install only

**Still useful as:** a web-based browsing tool when you want to eyeball what exists in a space. The sheer breadth of GitHub scraping means it may surface repos that skills.sh hasn't indexed. But you'd search it manually, not programmatically.

### L4 Pointers
- About page: https://skillsmp.com/about (403 on bot access)
- SmartScope review: https://smartscope.blog/en/blog/skillsmp-marketplace-guide/
