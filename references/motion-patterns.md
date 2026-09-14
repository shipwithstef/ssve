# Premium Motion Patterns for Landing Pages

Validated patterns from the "Claude Code + Motion = $10k websites" playbook.
Source: `references/knowledge/domains/ai-web-design-service/`

## The Moat

Most AI builders (v0, Framer AI, Wix) produce static sites. Scroll-driven reveals,
spring physics, and staggered entrances are the differentiation that justifies
premium ($2k–$10k) pricing. These patterns cost ~34KB (full) / 2.3KB (mini) and
add zero runtime dependencies beyond framer-motion.

---

## 1. Premium Easing Curve

The signature cubic-bezier that reads as "expensive":

```tsx
const PREMIUM_EASE = [0.22, 1, 0.36, 1];
```

Usage on every scroll-triggered reveal:

```tsx
<motion.div
  initial={{ opacity: 0, y: 60 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: "-100px" }}
  transition={{ duration: 0.8, ease: PREMIUM_EASE }}
/>
```

**Why this curve:** fast start, long luxurious deceleration. Feels like a heavy
object gliding to rest — the physical metaphor for quality.

---

## 2. Staggered Card Reveals

For grids (features, pricing, testimonials):

```tsx
<motion.div
  initial={{ opacity: 0, y: 40 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: "-100px" }}
  transition={{ duration: 0.7, ease: PREMIUM_EASE, delay: i * 0.1 }}
/>
```

Rules:
- Stagger step: **0.10–0.15s** per item (0.05s feels like a glitch, 0.20s feels slow)
- Max delay cap: clamp at `0.6s` for grids > 6 items
- Direction: left-to-right for rows, top-to-bottom for columns

---

## 3. Hero Entrance Sequence

First paint matters. Orchestrate the hero load in 4 beats:

```tsx
// Beat 1: eyebrow / video pill (0ms)
<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} />

// Beat 2: headline (100ms)
<motion.h1  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} />

// Beat 3: subhead (200ms)
<motion.p   initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} />

// Beat 4: CTA pair (300ms)
<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} />

// Beat 5: trust line (500ms)
<motion.p   initial={{ opacity: 0 }}       animate={{ opacity: 1 }}       transition={{ delay: 0.5 }} />

// Beat 6: hero visual (450ms, longer duration)
<motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.6 }} />
```

Total sequence: **~1.2s** to full readability. Do not exceed 1.5s.

---

## 4. Spring Physics on CTAs

Buttons should feel alive, not dead:

```tsx
<motion.button
  whileHover={{ scale: 1.04 }}
  whileTap={{ scale: 0.97 }}
  transition={{ type: "spring", stiffness: 400, damping: 17 }}
>
  Start Free
</motion.button>
```

Apply to:
- Primary CTA buttons (hero, pricing, footer)
- Navigation CTA
- Any button that triggers a conversion event

Do NOT apply to:
- Text links
- Secondary/outline buttons that are low-conversion
- Form submit buttons (use `:active` scale for predictability)

---

## 5. Scroll-Triggered Section Reveals

Every section below the fold gets a reveal. No dead blocks.

```tsx
function SectionWrapper({ children, className }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, ease: PREMIUM_EASE }}
      className={className}
    >
      {children}
    </motion.section>
  );
}
```

For internal elements (headings, cards inside the section), use the stagger
pattern on top of the section wrapper. The wrapper handles the section boundary;
cards handle their own stagger.

---

## 6. prefers-reduced-motion

Mandatory for WCAG 2.2 AA. Wrap every motion component:

```tsx
import { useReducedMotion } from "framer-motion";

function FadeIn({ children, ...props }) {
  const shouldReduce = useReducedMotion();
  if (shouldReduce) return <div {...props}>{children}</div>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, ease: PREMIUM_EASE }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
```

Framer Motion's `useReducedMotion()` is preferred over a custom hook — it
listens to the same media query but is framework-idiomatic.

---

## 7. Motion Budget Rules

From benchmark-landing dimension 3b (liveness perceptibility):

| Metric | Budget | Over-budget signal |
|--------|--------|-------------------|
| Total animated elements on screen | ≤ 8 | CPU throttling on low-end Android |
| Simultaneous spring animations | ≤ 3 | Jank during scroll |
| Entrance duration per element | 0.6–1.0s | <0.4s = "jumpy", >1.2s = "slow" |
| Stagger cumulative delay | ≤ 0.8s | Users scroll past before last item reveals |
| Continuous loops (chevron, pulse) | ≤ 2 | Battery drain on mobile |

---

## 8. Anti-patterns

- **Parallax on every section** → motion sickness, scroll jank
- **Bounce / elastic easings on text** → reads as cheap
- `animate={{ x: [0, 10, -10, 0] }}` shake on errors → only in-app, never landing
- Stagger > 0.2s per item → user has already scrolled past
- `viewport={{ once: false }}` → re-triggers on every scroll, disorienting

---

## Bundle Impact

```
npm install motion          # ~34KB gzipped (full framer-motion)
npm install framer-motion   # same package, motion is the v11+ name
```

For landing pages only, the full package is fine. For apps that also ship a
Capacitor binary, consider tree-shaking or the `motion/react` import path.
