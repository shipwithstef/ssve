# Anti-Slop Implementation Patterns

Technical extraction of "anti-slop" frontend engineering rules from `taste-skill`.

## 1. Liquid Glass Refraction
Beyond simple `backdrop-blur`, the "Liquid Glass" pattern requires:
- `backdrop-blur-xl` or higher.
- `border: 1px solid rgba(255, 255, 255, 0.1)` (Simulates physical edge refraction).
- `box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1)` (Inner highlight).
- **Rationale:** Prevents the "flat/cheap" look of generic AI-generated glassmorphism.

## 2. Magnetic Micro-physics
Interactive elements (buttons, avatars) that pull toward the cursor.
- **Rule:** NEVER use React `useState` for continuous mouse-follow animations.
- **Implementation:** Use Framer Motion `useMotionValue` and `useTransform` to run animations outside the React render cycle.
- **Physics:** `type: "spring", stiffness: 100, damping: 20` (No linear easing).

## 3. Perpetual Micro-Interactions
Every active dashboard component must have an infinite-loop animation.
- **Status Dots:** Pulse.
- **Search Bars:** Subtle typewriter cursor.
- **Feature Icons:** Floating/Shimmer.
- **Rationale:** Makes the interface feel "alive" and intentionally crafted.

## 4. Layout Diversification
Rules to break standard LLM layout biases:
- **Hero Section:** Centered H1 sections are BANNED when `LAYOUT_VARIANCE > 4`.
- **Feature Rows:** "3 equal cards" pattern is BANNED. Replace with:
  - Asymmetric Bento grids (e.g., `2fr 1fr 1fr`).
  - 2-column zig-zag.
  - Horizontal scroll galleries.
- **Typography:** BANNED `Inter` for premium vibes; mandated `Geist`, `Outfit`, or `Satoshi`.

## 5. Viewport & Grid Stability
- **Hero Height:** `min-h-[100dvh]` mandatory (fixes mobile layout jumps).
- **Structure:** CSS Grid only. Flexbox percentage math (e.g., `w-[33%]`) is BANNED.
- **Icons:** Standardized `strokeWidth` (1.5 or 2.0). BANNED emojis in code/markup.

## 6. Performance Guardrails
- **GPU Repaints:** Grain/noise filters must be applied only to `fixed` pseudo-elements with `pointer-events-none`.
- **Transitions:** Animate ONLY `transform` and `opacity`. BANNED animating `top`, `left`, `width`, or `height`.
