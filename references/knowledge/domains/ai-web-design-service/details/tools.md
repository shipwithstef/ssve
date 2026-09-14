# Tools Deep Dive

## Claude Code

**What it is:** Anthropic's AI coding agent that runs in the terminal (or Claude desktop app). Reads your entire project, writes code, runs commands, and applies custom skills via markdown files.

**Pricing:**
- Pro: $20/mo (currently includes Claude Code)
- Max 5x: $100/mo
- Max 20x: $200/mo

**Critical risk:** In April 2026, Anthropic tested removing Claude Code from the $20 Pro tier, restricting it to Max ($100+). They reverted after community backlash, but the pricing is **not stable**. Any business built on this model should budget for $100/mo as a contingency.

**Skills system:** The article references Nate's custom skills (frontend-design.md, video-to-website.md) distributed via Skool. These are real — Nate runs "AI Automation Society" (269k+ members). Skills are markdown files dropped into `.claude/skills/` that inject context-specific best practices into the agent.

**Alternatives if pricing shifts:**
- OpenAI Codex (included in ChatGPT Plus at $20/mo — currently more stable)
- Google Gemini CLI (1,000 free requests/day)
- Kimi Code CLI / other agentic coding tools

---

## Motion (formerly Framer Motion)

**What it is:** React animation library for production-grade UI animations. Declarative API, hardware-accelerated, supports gestures, scroll-driven animations, layout animations, and spring physics.

**Install:** `npm install motion`
**Import:** `import { motion } from "motion/react"`

**Bundle sizes:**
- Full motion component: ~34 KB minified+gzipped
- LazyMotion + m component: ~4.6 KB
- useAnimate mini: 2.3 KB

**Why it matters for this model:**
- `whileInView` triggers animations on scroll — key for "scroll-driven reveals"
- `transition={{ ease: [0.22, 1, 0.36, 1] }}` — custom cubic-bezier for premium feel
- `staggerChildren` — sequential card reveals
- `spring` physics — tactile button interactions

These patterns are what separate "AI-built" from "studio-built" in the article's framing.

---

## Nano Banana Pro

**What it is:** Google's state-of-the-art image generation model (Gemini 3 Pro Image). Launched November 2025.

**Capabilities:**
- Up to 4K resolution
- Legible multilingual text rendering
- Multi-image fusion (up to 14 reference images)
- Character consistency (up to 5 people)
- Google Search grounding for real-world data

**Pricing:**
- Free tier: Limited quota in Gemini app / AI Studio
- Paid: $0.139 per 2K image, $0.24 per 4K image
- Original Nano Banana: $0.039 per 1024px image

**Use case in this model:** Generate product hero images (normal + exploded view), then interpolate into short reveal videos. The video becomes the scroll-linked hero asset.

**Access points:**
- Gemini app
- Google AI Studio
- Gemini API
- Flow, Google Slides, Google Vids

---

## Supporting Tools

| Tool | Purpose | Cost |
|------|---------|------|
| Next.js | React framework with App Router | Free |
| Tailwind CSS | Utility-first CSS | Free |
| Vercel | Hosting + CDN + deployments | Free tier |
| Loom | Demo recording for sales | Free tier |
| Skool | Community + skill distribution | Free to join Nate's community |
| Gumroad | Template sales | Free (5% + Stripe fees) |
