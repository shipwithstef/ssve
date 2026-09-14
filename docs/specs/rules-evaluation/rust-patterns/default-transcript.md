# Default Transcript — rust/patterns.md

> Pass 1 elicited before deep-reading rule content.
> Contamination caveat: rule was fetched into context for evaluation; defaults below are from first-principles Rust knowledge.

## Scenario 1: Rust developer needs to distinguish two u64 IDs (e.g., user_id and order_id passed to same function)

**Prompt:** In Rust, a function takes a user_id: u64 and an order_id: u64. A developer is concerned about accidental argument swap. What approaches would you reach for across 10 projects?

**Default response:**

Across 10 projects:
- ~50%: Leave as u64 / use type aliases (`type UserId = u64`) — simpler, slight safety
- ~40%: Newtype wrapper (`struct UserId(u64)`) — compile-time safety, slightly more boilerplate
- ~10%: Use a typed ID library (e.g., `typed-id` crate)

I'd recommend newtypes for public APIs or domain-critical functions, type aliases for internal plumbing. There's genuine variance here — I don't pick newtypes by default everywhere.

---

## Scenario 2: Rust developer is modeling connection states (disconnected, connecting, connected, failed with retry count)

**Prompt:** In Rust, how would you model a state machine for a connection? What approaches across 10 projects?

**Default response:**

I'd consistently reach for an enum with associated data:
```rust
enum ConnectionState {
    Disconnected,
    Connecting { attempt: u32 },
    Connected { session_id: String },
    Failed { reason: String, retries: u32 },
}
```
And exhaustive `match` — this is idiomatic Rust I apply consistently. I'd also note that using wildcard `_` on business-critical enums silently swallows new variants — I'd warn about this but don't always enforce it as a hard rule.

---

## Scenario 3: Rust developer needs a struct with many optional configuration parameters

**Prompt:** In Rust, a `ServerConfig` has required (host, port) and optional (max_connections, timeout, tls_config) fields. How to build it?

**Default response:**

Across 10 projects, I'd consider:
- ~40%: Builder pattern (chained methods, separate builder type)
- ~40%: Default trait + struct update syntax (`..Config::default()`)
- ~15%: `derive_builder` or `typed-builder` crate
- ~5%: Just accept a Config struct directly

Genuine variance. Builder pattern is more ergonomic for external callers; Default + update syntax is simpler for internal use.

---

## Scenario 4: Rust developer is building a library trait that should not be implemented outside the crate

**Prompt:** In Rust, how do you prevent external crates from implementing a trait you expose?

**Default response:**

Sealed traits via private module is the idiomatic Rust approach — I know it but wouldn't apply it unless specifically asked or unless I recognize the "extension point" design intent. This is a specific architectural pattern with narrow applicability. I wouldn't inject it into general code unprompted.

---

## Summary

Real variance: S1 (newtype vs type alias, ~50/50) and S3 (builder vs Default, ~40/40). Already deterministic: S2 (enum state machine). Niche/context-dependent: S4 (sealed traits).
