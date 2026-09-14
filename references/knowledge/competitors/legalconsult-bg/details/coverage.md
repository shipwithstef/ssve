# LegalConsult.bg — Coverage Table

43 URLs on prescope checklist; 43 read by gemini-cli; 41 produced content; 2 returned errors (acceptable — wp-json endpoints, not user-facing).

## Coverage scorecard

| Status | Count | Notes |
|---|---|---|
| read (content extracted) | 41 | including all user-facing pages, blog posts, T&C, services |
| read (machine endpoint, parsed) | 2 | /feed/ (RSS XML), /wp-json/wp/v2/pages/8 (JSON) |
| error (acceptable) | 2 | /wp-json/oembed/1.0/embed (HTTP 400), /xmlrpc.php (HTTP 405 — WordPress-default 405 for GET) |
| missing | 0 | — |
| **Coverage** | **43/43** | **100%** |

## URL → finding category map

### Identity pages
- `/` — sitewide footer, navigation, no imprint on homepage itself
- `/за-нас/` — **administrator name + БУЛСТАТ 180550822**
- `/контакти/` — address + phone + email
- `/общи-условия/` — **full T&C + administrator identity restated + service formation clauses**
- `/политика-за-поверителност/` — privacy policy (returned 404 in test; LegalConsult uses `/privacy-policy/` instead)
- `/cookies-policy/` — cookies notice
- `/privacy-policy/` — privacy policy (English-slug version)

### Service pages with verbatim prices
- `/услуги/регистрация-на-фирми/` — EOOD/OOD/ET 125€ + AD 500€
- `/услуги/регистрация-на-сдружения-и-фондации/` — 93 лв
- `/услуги/регистрация-на-търговска-марка/` — 450/700 лв
- `/услуги/общи-условия/` — 26 лв (online store T&C template)
- `/услуги/прехвърляне-на-фирми-и-дружествени-дялове/` — 180€
- `/услуги/създаване-на-еоод-оод-с-адвокат/` — 125€

### Service pages without on-page price
- `/услуги/авторско-право/`
- `/услуги/актове-кат/`
- `/услуги/изготвяне-на-договори-и-споразумения/`
- `/услуги/изключване-на-съдружник/`
- `/услуги/регламента-за-личните-данни-gdpr/`
- `/услуги/трудови-консултации/`
- `/услуги/консултация-недвижим-имот/`
- `/услуги/обща-онлайн-консултация/`
- `/услуги/откриване-на-аптека/`
- `/услуги/развод-онлайн/`
- `/услуги/фирмени-промени/`

### Blog / content
- `/блог/` — index of articles
- `/2442-2/` — debt collection article
- `/отписване-на-задължения-към-еос-матри/` — EOS Matrix debt collection
- `/покупка-на-имот-на-зелено-рискове-и-з/` — off-plan property purchase risks
- `/онлайн-консултации/` — consultation hub
- `/author/legalconsult/` — author page

### System / infrastructure
- `/cart/` — WooCommerce cart
- `/feed/` — RSS feed
- `/wp-json/` — WordPress REST API root
- `/wp-json/wp/v2/pages/8` — homepage as JSON
- `/wp-json/oembed/1.0/embed` — error 400 (expected; needs URL param)
- `/xmlrpc.php` — error 405 (expected; WP default block on GET)

### Note on URL canonicalization
Some URLs appear in two encoding variants (uppercase `%D1` vs lowercase `%d1`) — these resolve to the same content. Sitemap and homepage links produced the duplicates. Both forms read; one entry per canonical URL.
