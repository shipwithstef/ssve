## Post-Verification: Log Learnings

Append operational discoveries from this run to `docs/learnings/learnings.jsonl`:

```json
{"date": "<date>", "skill": "verify-promotion", "feature": "<name>", "learning": "<what was discovered>", "confidence": "high|medium|low", "saves_minutes": <estimate>}
```

Examples of learnings worth logging:
- "The Prisma migration script needs `--force` flag in CI"
- "Auth middleware must be loaded before rate limiter"
- "The empty state component doesn't render without at least one CSS import"

These compound across sessions — `route-workflow` reads them to make better recommendations.

## Post-Verification: Update Builder Profile

After a successful verification, update the global builder profile
(`~/.svc/builder-profile.md`) to capture what this project taught us
about the builder. This is how the pipeline gets smarter across projects.

1. **Add project to history:**
   ```markdown
   ### <Project Name> — shipped
   - **What:** <one sentence>
   - **When:** <start date> → <ship date>
   - **Stack:** <what was built with>
   - **Reached:** shipped / launched / revenue
   - **Revenue:** <if any>
   - **Reusable assets:** <code, infra, domain, learnings>
   ```

2. **Update skills** — did the builder learn a new framework, tool, or pattern?
3. **Update financial context** — did revenue start? New subscriptions? Entity registered?
4. **Update social presence** — did they grow followers? Launch on ProductHunt? Start a newsletter?
5. **Run pattern detection** — compare this project's timeline, decisions, and outcome
   against past projects. If a pattern emerges or is reinforced, append to Builder Patterns:
   ```markdown
   - **[pattern-id] <description>** — confidence: <1-10>, observed: <N> times
     Source: <which projects>
     Pipeline action: <what changes>
   ```
6. **Run gap analysis** — what blocked them this time? What tool would have saved time?
7. **Append changelog entry:**
   ```markdown
   - <date>: Post-project update from <project name> — <what changed>
   ```

If the builder profile does not exist at `~/.svc/builder-profile.md`, skip this step
(the builder has not been profiled yet — `route-workflow` handles initial creation).
