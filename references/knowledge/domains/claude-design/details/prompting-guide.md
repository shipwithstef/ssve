# Claude Opus 4.7: Master Prompting Guide (Layer 3)

Absolute domain expertise on steering Claude Opus 4.7 (April 2026) using "Strict Literalism" and "xhigh" effort tiers for design-to-code implementation.

## 1. The "Strict Literalism" Mental Model
Opus 4.7 follows instructions with 1:1 precision. It **does not fill gaps** or infer intent from vague phrasing.
- **Vague**: "Refactor this component." (Result: Incomplete refactor, may skip sub-components).
- **Expert**: "Refactor `Header.tsx` to use the `Button` component from `src/ui`. Update all 4 instances. Do not modify the `Logo` logic. Verify types before returning."
- **Key Pattern**: Use **Acceptance Criteria (AC)** blocks in every prompt. Opus 4.7 will check them off internally before responding.

## 2. Steering "xhigh" Effort
Use the `effort: xhigh` parameter for tasks requiring deep technical proofs (schema design, UI audits).
- **When to use**: Initial token extraction, cross-file refactors, "pixel-perfect" visual audits.
- **Prompt Trigger**: "Run this task at \`xhigh\` effort. Perform an internal self-proof of the JSON schema against the W3C DTCG 1.0 standard before final output."

## 3. "Live Canvas" Adjustment Knobs
Force Claude to generate interactive UI controls in the Live Canvas for real-time refinement.
- **Pattern**: "Generate a Live Canvas mockup with **Dynamic Adjustment Knobs** for the following properties: [list properties, e.g., grid-gap, primary-hue, border-radius]. Export these knobs as a reactive JSON state object."
- **Syntax**: `Implement a state-machine slider for "Content Density" (Low/Medium/High) that re-renders the layout instantly.`

## 4. W3C Design Token Extraction
Use "Strict Literalism" to prevent creative naming drift.
- **The "Never-Fail" Prompt**:
  > "Extract design properties from `mockup.png`. Map them 1:1 to the **W3C Design Tokens (DTCG 1.0)** JSON schema.
  > - $type: color | dimension | duration
  > - $value: [exact hex or px]
  > - Constraints: No creative naming. Use the 'Sunken'/'Elevated' semantic naming convention for surfaces.
  > - Verify: Output must be a single valid JSON file."

## 5. Vision Coordinate Prompting
Opus 4.7 uses **1:1 pixel coordinates** (up to 2576px).
- **Technique**: Instead of "click the blue button," use "click the button located at (x=450, y=120) relative to the top-left of the main viewport." This eliminates ambiguity during UI audits.

## 6. Integration Notes for SVC
- **Prompt Templates**: Update `design-ui/SKILL.md` to use the "Never-Fail" token extraction prompt.
- **Verification Gates**: Use `/ultrareview` in the `review-gate` lane to trigger Opus 4.7's highest reasoning tier for security and performance audits.
- **Budgeting**: Inject `task_budget: 50000` into long-running `execute-changeset` loops to prevent runaway costs during high-effort runs.
