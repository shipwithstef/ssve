# Journey specs

One `<task>.json` per task that the framework arm is expected to run through the
framework's own journey. Each framework row is checked against its spec by
`scripts/lib/journey-conformance.mjs` after the build and the session transcripts are
kept, and the result is stored as `row.journey`
(`{spec_sha, steps, must_total, must_hit, conformant, missing}`). `northstar decide`
reports conformance per task; it does not change the headline rule.

```json
{ "task": "<task>", "version": 1, "steps": [
  { "id": "plan-skill", "kind": "skill", "name": "plan-changeset", "must": "MUST",
    "evidence": { "skill": "plan-changeset" }, "cite": "why this step is expected" },
  { "id": "review", "kind": "review", "name": "review-exec", "must": "CONDITIONAL",
    "when": { "file": "src/**/*.mjs" }, "evidence": { "git_notes": { "ref": "refs/notes/svc-receipts", "regex": "review-exec" } } }
] }
```

`must` is `MUST` (always required), `CONDITIONAL` (required only when `when` is hit; no
`when` means required) or `OPTIONAL` (reported, never required). A step's `evidence` and
`when` are predicates, exactly one key each: `skill`, `bash` (regex over Bash commands),
`tool`, `file` (glob), `file_matches` ({glob, regex}), `git_notes` ({ref, regex?}),
`commits` ({min}), and the combinators `all`, `any`, `not`. Unknown keys are refused;
`preflightRun` validates every spec for the run's tasks before any job is paid for.
