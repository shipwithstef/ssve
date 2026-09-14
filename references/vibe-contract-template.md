# Vibe Contract — External Canvas Prompt Template

Use this template when composing prompts for external design canvases (Claude Design, v0, Lovable) via the `design-ui` External Canvas Handoff mode. The bans and mandates are the point — do not shorten them to save tokens. Generic output is the failure mode this template exists to prevent.

---

## `<vibe_contract>` prompt structure

Fill in every `{{PLACEHOLDER}}`. Inline the full `docs/specs/ui/constraint-matrix.md` contents where indicated.

```
You are generating production-grade UI for {{PRODUCT_NAME}}, {{PRODUCT_ONE_LINER}}.

## Technical constraints (NON-NEGOTIABLE — single source of truth)

{{PASTE_CONSTRAINT_MATRIX_MD_HERE}}

## Bans (AI slop — immediate rejection)

- NO Inter font. NO Roboto. NO system-ui as the primary typeface.
- NO AI-purple / AI-blue neon gradients (e.g. #7c3aed → #3b82f6).
- NO generic SaaS dashboard with 4 stat cards + 1 line chart + sidebar.
- NO emoji as icons (use the icon set named in the constraint matrix).
- NO glassmorphism applied globally — treat it as material, not a theme.
- NO centered hero with a big gradient word and 2 buttons.
- NO "shadow-xl rounded-2xl bg-white/80 backdrop-blur" as default card.

## Mandates (materiality — what actually differentiates 2026 UI)

- **Material fidelity:** when a surface looks like glass, it refracts. When it looks like stone, it has grain. When it looks like paper, it has texture.
- **1px inner borders** on raised surfaces, not drop shadows.
- **Warm neutrals** (stone, bone, paper) unless the brand explicitly calls for cool.
- **Time-of-day lighting** on hero imagery — never flat ambient.
- **Type hierarchy via weight + optical size**, not just font-size steps.
- **Interaction feedback** that implies physics (Framer Motion spring, not ease-out).

## Signature hooks for {{PRODUCT_NAME}}

{{PRODUCT_SIGNATURE_HOOKS — e.g. "GPS-dotted map as empty-state illustration", "typography set in condensed display + humanist sans body", "primary accent is a single saturated spot color against warm neutrals"}}

## Output format

Return: (1) full component code using the stack/libraries named in the constraint matrix, (2) a 1-sentence rationale per non-obvious design decision, (3) a flag list of any constraint you could not satisfy and why.

Do NOT return: lorem ipsum, placeholder images as `/placeholder.jpg`, TODO comments, or stub handlers (`onClick: () => {}`).
```

---

## How to verify the return

Use the adversarial audit step in `design-ui/SKILL.md` → Step C. The Gemini auditor gates PASS/FAIL against the same constraint matrix — not against your opinion of the result.

## Customization rules

- Place-specific mandates (e.g. "example-marketplace uses terra-cotta #B0543A as primary accent") go in `constraint-matrix.md`, NOT inline in this template. The template stays product-agnostic; matrix carries the specifics.
- If a project needs to override a ban (e.g. Inter IS the brand font), override in `constraint-matrix.md` with explicit justification. The auditor reads overrides from the matrix, not from prose elsewhere.
