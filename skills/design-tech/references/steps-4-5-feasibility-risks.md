### Step 4: Feasibility Check Against ACs

Walk through each AC from the spec and verify the technical design can satisfy it.

```markdown
### Feasibility Matrix

| AC | Persona pressure | Description | Feasible? | Notes |
|----|------------------|-------------|-----------|-------|
| MATCH-01 | P2 speed/trust | User sees matches sorted by compatibility | ✅ | Sorting in query, no new index needed |
| MATCH-02 | P2 freshness expectation | Matches update in real-time | ⚠️ | Requires WebSocket — adds complexity |
| MATCH-03 | P3 scheduling context | User can filter by timezone | ✅ | Filter on existing timezone column |
```

**If an AC is not feasible:**
- Explain why (technical constraint, dependency, cost)
- Propose alternatives that satisfy the user intent
- Flag as a **feedback loop** to write-spec — the AC or story may need revision

For user/admin-facing ACs, `Persona pressure` must cite a concrete persona ID/path
or `N/A - system-only`. This prevents technical design from optimizing away the
reason the AC exists.

**This is the critical gate.** If the design can't satisfy the spec, the spec needs to change. Don't proceed with a design that leaves ACs unsatisfied.

### Step 5: Risk And Trade-offs

Identify what could go wrong and what trade-offs the design makes.

```markdown
### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| [What could go wrong] | [Consequence] | [How to prevent or handle] |

### Trade-offs

| Trade-off | Chose | Over | Rationale |
|-----------|-------|------|-----------|
| [What's being traded] | [This approach] | [Alternative] | [Why] |
```
