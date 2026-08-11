---
description: Go steering — functional options for constructors with optional configuration
scope: project
stack: golang
type: steering
source: blended:ecc
source_sha: 125d5e619905d97b519a887d5bc7332dcc448a52
last_evaluated: "2026-04-13"
---

# Go Patterns

## Constructor Configuration: Functional Options

For constructors that accept optional configuration, use the functional options pattern:

```go
type Option func(*Server)

func WithPort(port int) Option {
    return func(s *Server) { s.port = port }
}

func NewServer(opts ...Option) *Server {
    s := &Server{port: 8080}
    for _, opt := range opts {
        opt(s)
    }
    return s
}
```

Prefer functional options over a config struct when:
- Options are truly optional and callers rarely need all of them
- The constructor is part of a library or package API
- Forward compatibility matters (adding options without breaking callers)

Use a config struct when parameters are mostly required or callers always configure most of them.
