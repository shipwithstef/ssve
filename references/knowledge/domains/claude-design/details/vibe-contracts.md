# Masterclass UI: Agentic Innovation & "Vibe Contracts" (Layer 3)

Absolute domain expertise on automating visual innovation using agentic design patterns and "Vibe Contracts" to ensure high-fidelity UI hooks across all hosts.

## 1. The "Vibe Contract" Paradigm
A **Vibe Contract** is a technical specification for the "soul" of a UI, moving beyond layouts to define specific emotional and interactive states.
- **The Concept**: Instead of a manual moodboard, the agent generates a structured **Vibe Schema** (JSON/Markdown) that dictates brand grit, motion physics, and "Masterclass" signature hooks.
- **Host Agnosticism**: The contract is a framework artifact (`docs/specs/ui/vibe-contract.json`), allowing it to be consumed by any harness (Gemini, Claude, Codex).

## 2. Autonomous Selection Protocol (Standalone Mode)
In **Standalone Mode**, the agent acts as both Creative Director and Judge. It uses an internal **Actor-Critic Loop** to rate and pick the "Winner" autonomously.

### The Aesthetic Scoring Rubric (0-100)
The agent (as Critic) scores each proposed hook against 5 dimensions:
1. **Precision & Alignment (0-20)**: Meticulous grid adherence and mathematical balance.
2. **Brand Resonance (0-20)**: Alignment with the Project Vision (e.g., "Industrial Grit").
3. **Interactive Novelty (0-20)**: Does it provide a "Wow Moment" (the Door Timer equivalent)?
4. **Cognitive Efficiency (0-20)**: High-precision info density without clutter.
5. **Motion Maturity (0-20)**: Physics-based easing vs. generic linear transitions.

### The Winner-Takes-All Logic
1. **Parallel Pitch**: The "Actor" agent pitches 3 distinct hooks from the Signature Menu.
2. **Blind Critique**: The "Critic" agent scores each using the rubric.
3. **Auto-Selection**: The hook with the highest aggregate score is **Auto-Selected** as the project's Signature Hook.
4. **Tie-Breaker**: If scores are equal, the agent defaults to the hook with the highest **Interactive Novelty** score.

## 3. Signature Interaction Menu (The "Masterclass" Library)
A curated list of 2026 high-end industrial/mechanical patterns for agents to use during autonomous brainstorming.

| Hook Category | Mechanism | "Masterclass" Signature Effect |
| :--- | :--- | :--- |
| **Precision Dials** | Inertial Feedback | A digital knob that feels "machined," with CSS-simulated mass, friction, and momentum-stops. |
| **Liquid Glass** | Refractive Transitions | UI surfaces that distort and refract light using advanced `backdrop-filter` during state changes. |
| **Dead-Front UI** | Triggered Activation | LED-matrix components that are invisible when idle, "igniting" with a high-precision glow upon user intent. |
| **Tactile Maximus** | Sculpted Geometry | Buttons and inputs that look 3D-milled and "deform" (squishy physics) when pressed to confirm lock-in. |

## 4. Masterclass Implementation Prompts
- **The "Billion-Dollar UI" Prompt**:
  > "Implement the [Feature] as a **Masterclass UI**. 
  > 1. Use the **Auto-Selected Winner** from the Vibe Contract.
  > 2. Ensure a **Target Aesthetic Score of 90+**.
  > 3. Apply **Strict Literalism** to the Motion Schema."

## 5. Integration Notes for SVC
- **Automated Workflow**: In `design-ux`, the agent executes the "Actor-Critic Pitch" task and records the Winner in the Vibe Contract.
- **Standalone Override**: Users can bypass the auto-selection by manually marking a hook as `winner: true` in the spec.
- **Vibe Gate (G5)**: The audit lane now includes an automated **"Critic Pass"** to re-score the final implementation against the original rubric.
