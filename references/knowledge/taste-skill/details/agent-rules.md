# Agent-Centric Design Rules

Detailed extraction of configuration dials and semantic rules for AI agents from `taste-skill`.

## 1. Global Configuration Dials
AI agents use these levels to calibrate the output's aesthetic:
- **Creativity (1-10):**
  - `1-3`: Ultra-minimal, Swiss, monochrome (Notion-like).
  - `8+`: Expressive editorial, bold typography, inline images in headlines, strong asymmetry.
- **Density (1-10):**
  - `1`: Gallery-airy, massive whitespace.
  - `10`: Cockpit-dense, data-heavy.
- **Variance (1-10):**
  - `1`: Predictable, symmetric grids.
  - `10`: Artsy chaotic, no two sections alike.
- **Motion Intent (1-10):**
  - `1`: Static.
  - `10`: Cinematic orchestration in every component.

## 2. Signature "Anti-Slop" Creative Techniques
- **Inline Image Typography:** Embedding small, rounded photos directly between words in headlines (e.g., "We build [photo] digital [photo] products").
- **No Overlapping:** BANNED z-index stacking of content layers or absolute-positioned headlines over images. Every element must have its own clear spatial zone.
- **No Filler Chrome:** BANNED "Scroll to explore", "Swipe down", or bouncing chevron icons.
- **Asymmetric Hero:** BANNED centered Hero sections at high variance levels.

## 3. Responsive "Hard Requirements"
- **Mobile-First Collapse:** All multi-column layouts MUST collapse to a strict single column below 768px.
- **No Horizontal Scroll:** A single pixel of horizontal overflow is considered a critical design failure.
- **Touch Targets:** Minimum `44px` for all interactive elements.
- **Testing Points:** Verified at 375px (iPhone SE), 768px (iPad), and 1440px (Desktop).

## 4. Semantic Color & Typography Roles
- **Canvas White (#F9FAFB):** Primary background.
- **Charcoal Ink (#18181B):** Primary text (never pure black).
- **Display Typography:** Track-tight (`-0.025em`), compressed leading (`1.1`), 700-900 weight.
- **Body Typography:** Relaxed leading (`1.65`), 65ch max-width.
- **Banned Font:** `Inter` (everywhere in premium contexts).

## 5. Implementation Orchestration (Code Intent)
- **Physics:** Spring-based exclusively (`stiffness: 100, damping: 20`).
- **Staggered Orchestration:** Waterfall reveals via `animation-delay: calc(var(--index) * 100ms)`.
- **Perpetual Loops:** Active components must have infinite-loop states (Pulse, Typewriter, Float).
- **Performance:** CPU-heavy animations isolated in microscopic leaf components.
