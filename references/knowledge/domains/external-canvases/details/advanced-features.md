# Advanced Capabilities of External UI Canvases

**Layer:** 3 (DETAILS)
**Last Updated:** 2026-04-19

This document details the specialized aesthetic and structural capabilities of external UI canvases like Claude Design, v0, and Lovable. These features inform how the SVC framework's orchestrator models should structure prompts (`claude-design-prompt.md`) during the "External Canvas Handoff" phase.

## 1. Prototypes
Beyond simple components, these canvases excel at full **interactive prototypes**:
- **Mechanism:** Given a structured prompt (like the SVC "Vibe Contract"), the canvas will generate a full React/Next.js/HTML page with functional state.
- **Fidelity:** Can transition seamlessly from a text-based "wireframe" instruction to a production-ready, high-fidelity UI that utilizes established design systems (e.g., shadcn/ui, Tailwind).
- **Implication for SVC:** Prompts must explicitly specify the desired fidelity (e.g., "high-fidelity, production-ready design, NOT a wireframe") to leverage this properly.

## 2. Slide Decks
Claude Design has specific capabilities optimized for presentation-native outputs:
- **Mechanism:** It understands layout instructions optimized for 16:9 or 4:3 ratios.
- **Features:** It can generate interactive HTML slide decks with click-to-advance milestones, employing CSS transitions or GSAP for smooth motion between slides. 
- **Export:** In many modes, it can generate code that is easily converted to or natively supports export to formats like PDF or PPTX.
- **Implication for SVC:** The framework can be used to generate "Slide Deck Prompts" where the technical constraints include presentation-specific dimensions and multi-slide state management.

## 3. Prompt Templates
The key to avoiding "AI Slop" in external canvases is rigorous prompt templating:
- **Mechanism:** Claude Design and v0 respond best to structured XML-like tags that segregate technical rules from aesthetic guidance.
- **The "Vibe Contract":** A template module (`<vibe_contract>`) used to explicitly ban common AI defaults (generic gradients, overuse of standard fonts like Inter) and mandate premium materiality (e.g., "liquid glass refraction", "warm stone tones").
- **The "Signature Hook":** A template module (`<signature_hook>`) used to demand specific interactive "wow" factors.

## 4. Animation Timeline-Based Motion Design
Modern web canvases can implement complex, sequenced animations:
- **Mechanism:** They can write highly optimized `framer-motion` (React), GSAP, or CSS keyframes to create sequenced events.
- **Timeline-based Design:** Canaves can build logic where animations trigger not just on mount or hover, but over a specific timeline (`useEffect` + `setInterval`, scroll-linked progress, or staged sequence animations).
- **Implication for SVC:** Prompts should specify the exact "motion physics" required. For example, explicitly dictating the easing curve (e.g., `cubic-bezier(0.4, 0, 0.2, 1)` instead of a bouncy spring) and the sequence of events (e.g., "pulse every 4s, increment every 15s") allows the canvas to execute sophisticated timeline-based motion perfectly.