# Default Transcript — golang/patterns.md

> Pass 1 elicited BEFORE reading rule content in depth.
> Rule content was visible in context (fetched for evaluation purposes);
> defaults below are from independent Go knowledge, not from the rule.
> Contamination caveat: rule was in context; defaults represent first-principles Go knowledge.

## Scenario 1: Go constructor with many optional configuration parameters

**Prompt:** In Go, a developer is building a server that has many optional configuration parameters (port, timeout, TLS config, max connections, etc.). What approaches would you reach for across 10 different projects? List the 2-3 most common options you'd consider and what drives your choice between them.

**Default response:**

Across 10 projects I'd reach for:

1. **Config struct passed by value or pointer** (`NewServer(cfg ServerConfig)`) — most common for internal services, simpler to understand, easy to test (just diff the struct). Favored when callers own the config lifecycle, or when you want all options visible at construction time.

2. **Functional options pattern** (`NewServer(opts ...Option)`) — favored for library/SDK code exposed to external callers, or when zero values should mean "use default" without requiring a full config struct to be initialized. Good when options are truly optional and callers rarely need all of them.

3. **Builder pattern** (chained methods on a builder type) — used less in Go than Java/Kotlin, but seen in test setup code or when validation at build time needs to accumulate errors. More verbose, not idiomatic for most services.

**What drives the choice:**
- Library vs internal code → functional options vs config struct
- How many required vs optional fields → many required = config struct (explicit); all optional = functional options works well
- Whether you want forward compatibility without breaking callers → functional options handles this better

There's genuine variance here. I don't consistently pick one; I choose based on context.

---

## Scenario 2: Where to define a Go interface

**Prompt:** In Go, a developer is designing a service that depends on a repository. Where should the interface be defined, and how large should it be?

**Default response:**

I'd say: define interfaces at the **consumer site** (the package that uses the interface), not at the implementation site (where the concrete type lives). This is Go's conventional wisdom — "accept interfaces, return concrete types" and "don't design interfaces; let them emerge."

I'd also keep interfaces small — ideally 1-3 methods. The standard library demonstrates this: `io.Reader`, `io.Writer`, `io.ReadWriter`. A `UserRepository` interface with 15 methods is a smell; a `UserFinder` interface with `Find(id string) (User, error)` is Go-idiomatic.

This is something I apply consistently without needing a rule; it's well-established Go doctrine.

---

## Scenario 3: Dependency injection in a Go service

**Prompt:** In Go, a developer is writing a service that needs access to a database, a logger, and an email client. How do you wire these?

**Default response:**

Constructor injection with explicit types:

```go
func NewUserService(db *sql.DB, logger *slog.Logger, email EmailClient) *UserService {
    return &UserService{db: db, logger: logger, email: email}
}
```

I'd consistently recommend this without needing a rule. It makes dependencies explicit, is testable (swap implementations), and is idiomatic Go. I would not reach for a DI framework (wire, fx) unless the project already uses one or there are 20+ services.

This is standard Go practice I apply deterministically.
