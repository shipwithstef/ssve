# Default Transcript — typescript/coding-style.md

> **Contamination notice:** Rule content was fetched into session context before this
> evaluation was invoked. This transcript reflects independently-held TypeScript knowledge,
> not a response to the rule text. Treat confidence as moderate, not high.

## Scenarios covered

1. Writing or reviewing an exported TypeScript function
2. Choosing between `interface` and `type` in TypeScript
3. Handling `any` in TypeScript code
4. Writing React component props
5. Handling errors in async TypeScript functions
6. Using input validation libraries
7. Leaving `console.log` in production code

---

## Pass 1 — Default behavior (no rule context)

**Scenario 1 — exported function:**
I add explicit parameter and return types to every exported function. For
internal helpers where the type is obvious from context I let inference work,
but any public API gets typed. This is my consistent default.

**Scenario 2 — interface vs type:**
My default is: `interface` for object shapes (especially when they might be
extended or implemented), `type` for unions, intersections, mapped types, and
utility types. I prefer string literal unions over `enum` in most TS contexts.
This is a well-established community convention I follow by default.

**Scenario 3 — avoiding `any`:**
I always flag `any` in code reviews and avoid it in new code. My default for
external/untrusted input is `unknown` + narrowing. I use generics when a
value's type depends on the caller. This is deeply ingrained.

**Scenario 4 — React props:**
I define props with a named `interface` or `type`. I don't use `React.FC`
because it has known issues (implicit children, harder generics). I type
callbacks explicitly. This is my consistent default.

**Scenario 5 — async error handling:**
I use `async/await` with `try/catch`. I type catch clauses as `error: unknown`
and narrow before accessing properties. I wrap re-thrown errors in a typed
Error class. This is my default pattern.

**Scenario 6 — input validation:**
I recommend Zod for schema-based validation in TypeScript projects. I infer
types from schemas with `z.infer<>`. This is a strong default recommendation.

**Scenario 7 — console.log:**
I never leave `console.log` in production code. I recommend proper logging
libraries (pino, winston, etc.). I flag console.log in code reviews.
This is a default I enforce.
