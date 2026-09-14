---
description: Web correction — CWV targets, bundle budgets, hero image eager loading (common default mistake)
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/*.html"
  - "**/*.css"
  - "**/*.scss"
  - "**/*.ts"
  - "**/*.js"
scope: project
stack: web
type: correction
source: blended:ecc
source_sha: 125d5e619905d97b519a887d5bc7332dcc448a52
last_evaluated: "2026-04-13"
---

# Web Performance Rules

## Core Web Vitals Targets

| Metric | Target |
|--------|--------|
| LCP | < 2.5s |
| INP | < 200ms |
| CLS | < 0.1 |
| FCP | < 1.5s |
| TBT | < 200ms |

## Bundle Budget

| Page Type | JS Budget (gzipped) | CSS Budget |
|-----------|---------------------|------------|
| Landing page | < 150kb | < 30kb |
| App page | < 300kb | < 50kb |
| Microsite | < 80kb | < 15kb |

## Loading Strategy

1. Inline critical above-the-fold CSS where justified
2. Preload the hero image and primary font only
3. Defer non-critical CSS or JS
4. Dynamically import heavy libraries

```js
const gsapModule = await import('gsap');
```

## Image Optimization

- Explicit `width` and `height` on all images
- `loading="eager"` plus `fetchpriority="high"` for hero/above-the-fold media only
- `loading="lazy"` for below-the-fold assets
- Prefer AVIF or WebP with fallbacks
- Never ship source images far beyond rendered size

## Font Loading

- Max two font families unless there is a clear exception
- `font-display: swap`
- Subset where possible
- Preload only the truly critical weight/style

## Animation Performance

- Animate compositor-friendly properties only (`transform`, `opacity`)
- Use `will-change` narrowly — and remove it when the animation is done
- Use `requestAnimationFrame` or established animation libraries for JS motion
- Avoid scroll handler churn; use IntersectionObserver instead

## Performance Checklist

- [ ] All images have explicit dimensions
- [ ] No accidental render-blocking resources
- [ ] No layout shifts from dynamic content
- [ ] Motion stays on compositor-friendly properties
- [ ] Third-party scripts load async/defer and only when needed
