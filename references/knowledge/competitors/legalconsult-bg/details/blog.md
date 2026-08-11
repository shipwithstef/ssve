# LegalConsult.bg — Blog Content

Source: gemini-cli deep-extraction pass 2026-05-03.

## Mechanism

Site states: "So far legalconsult has created 112 blog entries." (per `/author/legalconsult/`). The prescope/sitemap captured 4 blog URLs; the remainder were not indexed by site sitemap. Author profile is empty stub: "Този автор все още не е попълнил своите детайли."

## Blog index page (`/блог/`)

The index lists current/recent posts including:

> "Какво да правим, ако клиент не плаща – законни стъпки за събиране на вземане. Да имате клиент, който не плаща, е една от най-честите и неприятни ситуации в бизнеса..."

> "Покупка на имот на зелено – рискове и защита в предварителния договор. Покупката на имот „на зелено" е изключително популярна в България. По-ниската цена и обещанието за ново строителство често мотивират купувачите да сключат предварителен договор още в ранен етап на проекта..."

> "Отписване на задължения към ЕОС Матрикс по давност – кога реално не дължите нищо? Един от най-честите въпроси, които получаваме, е свързан с т.нар. „вечни дългове" към колекторски компании като ЕОС Матрикс..."

## Captured blog posts

### `/2442-2/` — Debt collection from non-paying clients
Title: collection-of-debts article. Content extracted (general legal mechanisms in BG ЗЗД for outstanding-invoice collection).

### `/отписване-на-задължения-към-еос-матри/` — EOS Matrix debt write-off
Topic: BG statutory limitations (давност) on debt-collector claims. Argues many debts to EOS Matrix can be statutorily extinguished.

### `/покупка-на-имот-на-зелено-рискове-и-з/` — Off-plan property purchase risks
Topic: Risks of buying not-yet-built BG real estate. Captures concrete contract-clause economics:
- "5% и 20% от цената" (5%-20% of price as deposit ranges)
- "30% от цената" (30% threshold for additional protection)
- "неустойка от 0.5% месечно" (0.5%/month penalty clause)

These percentage figures are the kind of legal-economic detail that signals competent, working advocate-authored content (vs. generic SEO filler).

## Coverage gap

We extracted 4 of ~112 blog posts. The remaining 108+ posts are not in the prescope checklist. For exhaustive coverage, would need to:
1. Crawl `/блог/page/2/`, `/page/3/`, ... pagination
2. Or use WP REST API: `https://legalconsult.bg/wp-json/wp/v2/posts?per_page=100&page=N`

For Example Marketplace purposes, the 4 captured posts plus the metadata claim ("112 blog entries") is sufficient evidence that the platform produces real legal-content output, not just static service pages.

## L4 pointers

- WP REST API: `https://legalconsult.bg/wp-json/wp/v2/posts` — programmatic enumeration if exhaustive blog crawl needed
- Author page: `/author/legalconsult/` — empty stub, no individual author profiles
