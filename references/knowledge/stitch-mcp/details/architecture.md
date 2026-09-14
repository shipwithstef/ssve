# Architecture: Typed Service Contracts (Spec & Handler)

## Mechanism

The repo's internal standard — documented in
`.gemini/skills/typed-service-contract/skill.md` — is a **Vertical Slice
Architecture** backed by **Design by Contract** principles. Every unit of
work (each command, each service) is split into a Spec and a Handler.

### The Spec (`spec.ts`) — the Contract

Declares five things via Zod:

1. **Validation helpers** — reusable refinements, e.g.
   `SafePathSchema = z.string().min(1).refine(p => !p.includes('..'))`
2. **Input schema** — "parse, don't validate". Raw input → DTO.
3. **Error codes** — `z.enum(['FILE_NOT_FOUND', 'PERMISSION_DENIED', 'UNKNOWN_ERROR'])`. Exhaustive.
4. **Result type** — discriminated union:
   ```typescript
   type Result =
     | { success: true; data: T }
     | { success: false; error: { code, message, suggestion?, recoverable } };
   ```
5. **Interface** — the capability, e.g. `interface ConfigureSpec { execute(input): Promise<Result> }`

### The Handler (`handler.ts`) — the Implementation

- Implements the interface.
- Handles side effects (fs, network).
- **NEVER throws.** All errors caught and mapped to `Result`.
- Catch-all `UNKNOWN_ERROR` with `recoverable: false` at the end.

### Testing split

- **Contract tests** (`spec.test.ts`) — table-driven, schema-focused. Test
  the "bouncer" — invalid inputs rejected before reaching logic.
- **Logic tests** (`handler.test.ts`) — mocked externals, assert `Result`
  shape, check business flow.

### Command framework

Commands are Specs + Handlers + `steps/`:
- `src/framework/CommandDefinition.ts` — command metadata
- `src/framework/CommandStep.ts` — step interface
- `src/framework/StepRunner.ts` — orchestrates steps, stops on first failure
- `src/framework/UserInterface.ts` / `ConsoleUI.ts` / `MockUI.ts` — IO abstraction
  so steps are testable without real terminals

## Analysis — why this matters for svc

This architecture encodes several principles svc already values but states
them more rigorously:

- **Errors as values, not exceptions** → directly maps to svc's "gate
  produces findings, not crashes". Making the return type a discriminated
  union forces callers to handle failure.
- **Parse, don't validate** (a Zod community idiom) → Input becomes DTO at
  the boundary, never flows through as "string that might be a path". This
  prevents drift between declared schema and actual type.
- **Contract/logic test split** → parallels svc's review gates (G1-G7):
  schema is one gate, logic is another. Keeps tests focused.
- **Step-based command orchestration with MockUI** → directly applicable to
  any svc skill that needs interactive wizards. `StepRunner` is ~100 LoC and
  copyable.

If svc ever ships a reference implementation of a complex multi-step skill
(e.g. an `init` or `onboard-repo` wizard), adopting this pattern would
reduce token cost of explaining "how do we structure this" in every run.

## Layer 4 pointers

- Pattern doc: `.gemini/skills/typed-service-contract/skill.md`
- Framework code: `src/framework/*.ts`
- Example spec+handler: `src/commands/init/{spec.ts,handler.ts}`
- Step example: `src/commands/init/steps/AuthStep.ts`
- Mock UI: `src/framework/MockUI.ts` (used in handler tests)
