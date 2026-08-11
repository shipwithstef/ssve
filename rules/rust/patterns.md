---
description: Rust steering — newtype IDs, builder for optional config, no-wildcard on business-critical enums
paths:
  - "**/*.rs"
scope: project
stack: rust
type: steering
source: blended:ecc
source_sha: 125d5e619905d97b519a887d5bc7332dcc448a52
last_evaluated: "2026-04-13"
---

# Rust Patterns

## Newtype Pattern for Type Safety

For domain IDs and other primitives that should not be interchangeable, use newtype wrappers — not type aliases:

```rust
struct UserId(u64);
struct OrderId(u64);

fn get_order(user: UserId, order: OrderId) -> anyhow::Result<Order> {
    // Can't accidentally swap user and order IDs at call sites
    todo!()
}
```

Prefer newtypes over `type UserId = u64` — type aliases provide documentation but no compiler enforcement.

## Builder Pattern for Optional Configuration

For structs with required fields plus many optional parameters, use the builder pattern:

```rust
impl ServerConfig {
    pub fn builder(host: impl Into<String>, port: u16) -> ServerConfigBuilder {
        ServerConfigBuilder { host: host.into(), port, max_connections: 100 }
    }
}

pub struct ServerConfigBuilder { host: String, port: u16, max_connections: usize }

impl ServerConfigBuilder {
    pub fn max_connections(mut self, n: usize) -> Self { self.max_connections = n; self }
    pub fn build(self) -> ServerConfig {
        ServerConfig { host: self.host, port: self.port, max_connections: self.max_connections }
    }
}
```

## Enum State Machines — No Wildcard on Business-Critical Enums

Model states as enums with associated data. For business-critical enums, do not use a wildcard `_` arm — exhaustive matching ensures new variants are handled explicitly:

```rust
match state {
    ConnectionState::Disconnected => connect(),
    ConnectionState::Connecting { attempt } => wait_or_abort(attempt),
    ConnectionState::Connected { session_id } => use_session(session_id),
    ConnectionState::Failed { reason, retries } => handle_failure(reason, retries),
    // No `_ =>` — new variants must be handled explicitly
}
```
