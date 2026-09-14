# Validation Pattern Families

Narrow grep commands in AC/manifest validation often miss adjacent variants of
the pattern the AC is actually targeting. This reference lists common pattern
families so plan-changeset and review-gate can assert both the narrow match AND
the broader sweep.

**Rule:** When an AC's PASS criterion is a grep/regex, the manifest's validation
plan MUST include TWO commands:
1. **Narrow match** — exact AC wording. Proves the specific thing.
2. **Adjacent-pattern sweep** — checks variants the narrow match misses. Must return 0 findings OR each finding must be explicitly justified as out-of-scope in the manifest.

Treat the sweep output as a gate. Zero findings = PASS. Any finding must either
be fixed OR annotated in the manifest with the reason it's excluded (e.g.,
"intentional glass overlay over dark hero section").

---

## Tailwind gradient stops

**Narrow pattern (WI-048 example):** `from-{color}-{50|100}` with no `dark:`

**Adjacent sweep — ALL must be checked:**

```bash
# Full sweep — from/via/to stops, all light colors including white, no dark: override
grep -rn 'bg-gradient' src/ --include="*.jsx" --include="*.tsx" | \
  grep -E '\b(from|via|to)-(white|slate|purple|blue|amber|emerald|green|red|orange|yellow|pink|rose|indigo|cyan|teal|violet)(-50|-100)?\b' | \
  grep -v 'dark:' | \
  grep -v 'hover:' | \
  grep -Ev '\b(from|via|to)-(slate|purple|blue|amber|emerald|green|red|orange|yellow|pink|rose|indigo|cyan|teal|violet)-(500|600|700|800|900|950)\b' | \
  grep -Ev 'current|transparent'
```

**Variants the narrow match misses:**
- `via-*-50` / `via-*-100` — middle gradient stop
- `to-*-50` / `to-*-100` — ending gradient stop
- `from-white` / `to-white` / `via-white` — no numeric suffix
- `from-white/10` / `to-white/5` — opacity modifiers (usually intentional glass overlays; verify context)
- `from-black` / `to-black` / `via-black` — symmetric case for "too-dark-in-light-mode"

**Known intentional exclusions:**
- Semi-transparent glass overlays (`from-white/10 to-white/5`) over already-dark hero sections
- Explicitly-themed surfaces where the "light" color is the brand color in both modes

---

## Tailwind color tokens (background, text, border)

**Narrow pattern:** `bg-white` or `text-black` without `dark:` override

**Adjacent sweep:**

```bash
grep -rn 'class' src/ --include="*.jsx" --include="*.tsx" | \
  grep -E '\b(bg|text|border|ring|divide|outline|shadow|decoration|placeholder|accent|caret|fill|stroke)-(white|black|slate-50|slate-100|zinc-50|zinc-100|gray-50|gray-100|neutral-50|neutral-100|stone-50|stone-100)\b' | \
  grep -v 'dark:' | \
  grep -v 'hover:'
```

**Variants:**
- Utilities beyond `bg-*`: `text-*`, `border-*`, `ring-*`, `divide-*`, `outline-*`, `shadow-*`, `decoration-*`, `placeholder-*`, `accent-*`, `caret-*`, `fill-*`, `stroke-*`
- Low-numbered shades across all neutral palettes: `slate-50`, `zinc-100`, `gray-50`, `neutral-100`, `stone-50`
- Opacity-modified neutrals: `bg-white/80`, `text-black/60`

---

## Design system CSS variables

**Narrow pattern:** files reference `bg-background` / `text-foreground` (should be themed)

**Adjacent sweep — look for raw hex/rgb/hsl color literals in className strings:**

```bash
# Raw color literals in className (should use design tokens instead)
grep -rn 'className' src/ --include="*.jsx" --include="*.tsx" | \
  grep -E '(\#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|hsl\(|hsla\()' | \
  head -20
```

Raw color literals bypass the theme and will NOT respond to dark mode.

---

## React Router routes / file paths

**Narrow pattern:** `/<route-name>` in router config

**Adjacent sweep — route references across the codebase:**

```bash
# All navigation hooks and Links pointing to the route
grep -rn "/<route-name>" src/ --include="*.jsx" --include="*.tsx" | \
  grep -E '(navigate|to=|href=|push\(|replace\()'
```

Variants: `navigate('/route')`, `<Link to="/route">`, `href="/route"`, `push('/route')`, `window.location.href = '/route'`. A route rename that only updates router config misses all of these call sites.

---

## API endpoint URLs

**Narrow pattern:** `/api/endpoint` in a single file

**Adjacent sweep:**

```bash
grep -rn 'fetch\|axios\|invoke\|api\.' src/ --include="*.jsx" --include="*.tsx" --include="*.js" --include="*.ts" | \
  grep '/api/endpoint'
```

Variants: `fetch('/api/endpoint')`, `axios.post('/api/endpoint')`, `base44.functions.invoke('endpoint')`, hardcoded strings in service classes.

---

## Feature flag references

**Narrow pattern:** `ENABLE_FEATURE_X` in the flag definition

**Adjacent sweep:**

```bash
grep -rn 'ENABLE_FEATURE_X\|FEATURE_X\|featureX\|feature_x' src/ --include="*.jsx" --include="*.tsx" --include="*.js" --include="*.ts"
```

Variants: CONSTANT_CASE, camelCase, snake_case, kebab-case. A rename that only fixes CONSTANT_CASE misses the rest.

---

## HTML element usage

**Narrow pattern:** `<Button>` imported from a specific place

**Adjacent sweep:**

```bash
# All <Button> usages — includes self-closing, spread-props, and nested
grep -rn '<Button\b' src/ --include="*.jsx" --include="*.tsx" | \
  wc -l
```

Variants: `<Button>`, `<Button />`, `<Button\n ... />` (multi-line), `<Button {...props}>`. A refactor that only handles one variant leaves the others broken.

---

## How to use this reference in plan-changeset

When authoring manifest validation commands for ACs that use pattern matching,
for EACH AC:

1. Identify the pattern family (gradients / color tokens / routes / endpoints / flags / etc.)
2. Copy the adjacent-sweep command from this reference
3. Add BOTH the narrow match AND the adjacent sweep to the manifest validation plan
4. In the Adversarial Review, verify both commands are present and syntactically correct

A manifest missing the adjacent sweep for a pattern-family AC is incomplete.

## How to use this reference in review-gate (G5)

During Pass 1 (spec compliance), for each AC that uses a grep/regex:

1. Run the narrow match — must match the AC's literal text
2. Run the adjacent sweep — must return 0 findings or annotated exclusions
3. Document both results in the review record

If the adjacent sweep finds instances the narrow match missed, this is a FAIL
unless the manifest pre-registered the exclusion.

## Maintenance

When you encounter a NEW pattern family that a narrow grep missed:
1. Add a new section to this file with both commands
2. Reference it in the manifest that caught it
3. Credit the WI in the section header (e.g., "added after WI-048 2026-04-14")
