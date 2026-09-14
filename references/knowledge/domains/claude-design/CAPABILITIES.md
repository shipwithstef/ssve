# Claude Design Capabilities (Layer 2)

Anthropic's April 2026 design-centric ecosystem for automated UI/UX extraction, conversational prototyping, and pixel-perfect implementation.

## Core Pillars

### 1. Vision & Reasoning Tier (Opus 4.7)
The underlying model optimized for design.
- **High-Resolution Vision**: 3.75 MP (2576px) for native screenshot and architectural diagram analysis.
- **`xhigh` Effort Reasoning**: Deeper logic for schema compliance and technical extraction.
- **Strict Literalism**: 1:1 adherence to provided design systems and JSON schemas.

### 2. Live Canvas (Claude Design)
Interactive conversational visual design environment.
- **System-Aware Design**: Automatically extracts brand rules from existing code and design files.
- **Dynamic Control**: Model-generated "adjustment knobs" for real-time layout refinement.
- **Direct Export**: Native W3C Design Tokens, Canva, HTML, and high-fidelity PDF support.

### 3. Protocol-Level Integration
Standardized handoffs between design and code.
- **W3C Tokens Standard**: Uses DTCG 1.0 format for universal design property representation.
- **MCP-Native Extraction**: Automated reverse-engineering of UI patterns into Mermaid C4 and Storybook via specialized tools.

## Integration with SVC Framework
Claude Design enables a new "Pixel-Perfect" verification tier:
- **Design Baseline**: Store extracted brand rules in `CLAUDE.md`.
- **Automated Verification**: Use high-res vision to audit implemented code against design screenshots with 1:1 precision.
- **Token Consistency**: Enforce W3C token compliance across all generated components.
