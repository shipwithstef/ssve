# Concept Canon — archetypes a brand mark concept must trace to

Every Phase-1 concept must claim ONE archetype from this canon. If a concept doesn't fit any archetype, the concept is too vague — refine the metaphor chain or kill it.

The canon exists because most attempted marks fail at the CONCEPT layer, not the execution layer. Without a clear archetype, image-gen produces sector-template output. Naming the archetype upfront forces the concept to commit to a structural strategy.

## The 14 archetypes

### 1. **Threshold-crossing**
A doorway, gate, arch, or portal. The mark depicts the moment of entering a space.
- Examples: Example Marketplace final-v3 storefront, Airbnb (door+heart hybrid), Volkswagen (the gate W)
- When to use: products that mediate between two worlds (customer ↔ business, signed-out ↔ signed-in, before ↔ after)
- Hidden-hook potential: the threshold itself can encode meaning (an arch that's also an H, a doorway whose interior light spells something)

### 2. **Trust-seal**
A circular badge, monogram inside a frame, official-stamp register.
- Examples: Resy, Stripe (S in rounded square), Square (literally a square), institutional logos
- When to use: products selling trust/professionalism (payments, B2B, finance, healthcare)
- Hidden-hook potential: the seal ornament itself can be functional (Stripe's S is also a payment-flow arrow)

### 3. **Schedule-row**
A horizontal block with markers — calendar tile, timeline, schedule bar.
- Examples: Linear (the bar mark), Toast (rounded rect with notch), Cal.com
- When to use: products built around time, ordering, sequencing
- Hidden-hook potential: the row's notches can spell letters or align with brand vocabulary

### 4. **Monogram-as-symbol**
A single letterform that becomes an object or scene.
- Examples: FedEx (E+x = arrow), Tour de France (R = cyclist), Mailchimp (M = monkey)
- When to use: short brand name (≤6 letters), letterform has structural opportunity
- **CAUTION:** Monogram-of-letter-X with brand wordmark starting with X = lockup stutter. Disqualified per Phase 7b.

### 5. **Negative-space-glyph**
The mark is defined by what's NOT there.
- Examples: FedEx arrow, Pittsburgh Zoo gorilla+lion, Tostitos (chip+salsa+two friends)
- When to use: when you want the hidden-hook archetype baked into the structure
- Hidden-hook potential: by definition this archetype IS a hidden hook

### 6. **Shape-as-metaphor**
The mark is a primitive shape that IS the product cue.
- Examples: Twitter bird (motion), Slack hashtag (channels), Airbnb belo (belonging)
- When to use: when the product has one core verb that has a strong visual analog
- Hidden-hook potential: the metaphor can have layers (Slack's # was also "wherever you are")

### 7. **Counter-form**
The mark exploits the gaps inside a closed shape.
- Examples: Wendy's collar with hidden "mom", Hershey's Kiss in wordmark gap, Galleries Lafayette G-L ligature
- When to use: when the wordmark has natural counter-shapes (o, e, a, p, b, d, g, q)
- Hidden-hook potential: the counter IS the hook

### 8. **Combination-stack**
Two or more recognizable objects fused into one silhouette.
- Examples: Toblerone (mountain + bear), Example Marketplace final-v3 (storefront + clock + door), Beats (lowercase b inside a headphone shape)
- When to use: product spans two ideas equally (e.g. "local business" + "hours")
- Hidden-hook potential: the fusion point can create a third meaning

### 9. **Gesture-trace**
The mark is a single dynamic stroke that suggests motion or action.
- Examples: Nike swoosh, Twitter's bird, ThredUP's arc
- When to use: products about movement, change, transformation
- Hidden-hook potential: the gesture's start/end can map to product cues (the swoosh is a wing AND a checkmark)

### 10. **Geometric-construction**
The mark is built from explicit geometric primitives in a clear system.
- Examples: Apple (circle + bite), Mastercard (overlapping circles), Audi (4 rings)
- When to use: products needing system feel (platforms, tools, infrastructure)
- Hidden-hook potential: the geometric relationship itself encodes meaning (Mastercard's overlap = "shared")

### 11. **Architectural-silhouette**
The mark depicts a built structure (building, room, scene) at recognizable scale.
- Examples: Sydney Opera House logo, Guggenheim spiral, Example Marketplace storefront
- When to use: products tied to physical place / industry with strong architectural vocabulary (real estate, hospitality, retail SaaS)
- Hidden-hook potential: the structure's interior or shadow can hide meaning

### 12. **Living-creature**
A stylized animal, plant, or human figure.
- Examples: Twitter bird, Linux Tux, Mailchimp Freddie, Twitch Glitch
- When to use: products that benefit from anthropomorphism / mascot / community feel
- **CAUTION:** mascots are hard to do right; veer kid-app fast. Reach for this only with strong rationale.

### 13. **Wordmark-only (typography-led)**
There is no symbol — the wordmark IS the brand mark.
- Examples: Coca-Cola (no separate symbol), Google (no separate symbol — letterforms are the brand), Linear (uses bar mark + Inter wordmark)
- When to use: when the brand name itself is short, distinctive, and the typography alone earns memorability
- **CAUTION:** This is the highest-craft archetype because the typography must be bespoke. System fonts = 0 points.

### 14. **Ambigram / dual-read**
The mark reads two different things depending on rotation, viewing angle, or context.
- Examples: NewMan (reads same upside down), Sun Microsystems (reads "sun" in any rotation)
- When to use: rare; only when ambigrammatic potential is unusually strong in the brand name
- **CAUTION:** novelty cost is high; if the dual-read is the only interesting thing, the mark fails axis 9 (longevity).

## How to use the canon

1. In Phase 1a, write a `concept-statement.yaml` for each candidate concept. The `archetype` field MUST name one of the 14 above.
2. If a candidate doesn't fit any archetype, EITHER refine the metaphor chain to fit one OR add a new archetype to this canon (PR + framework-learnings.jsonl entry — this is rare).
3. Aim for archetype DIVERSITY across the ≥12 candidate concepts. Don't generate 12 trust-seals.
4. Cross-domain inspiration in Phase 1b should INFORM how the archetype is executed, not REPLACE the archetype choice. Architecture moodboard + threshold-crossing archetype = Example Marketplace storefront. Nature moodboard + gesture-trace archetype = Twitter bird descended from origami cranes.

## Why this canon exists

Image-gen tools default to template output (rounded square + symbol + wordmark). The canon forces a structural commitment BEFORE image-gen runs. "Generate 4 logos for Example Marketplace" produces sector mediocrity. "Generate 4 threshold-crossing logos for Example Marketplace with hidden-hook potential" produces specific design direction. The canon is the language for that specificity.
