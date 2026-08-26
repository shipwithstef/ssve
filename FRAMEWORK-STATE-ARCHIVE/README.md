# FRAMEWORK-STATE Archive

Per the WI-362 live/archive split (see `FRAMEWORK-STATE.md`), resolved gaps,
old analysis-history entries, per-WI closeouts, and aged locked decisions
move here so the live file stays under its 50KB ceiling.

**Materialization note (WI-FW-DOCS-AUDIT-01, 2026-08-26):** this directory was
referenced by the live file for months but was never committed — the
previously claimed files (`analysis-history-2026-06-05-and-earlier.md` with
"107 entries", `2026-04-13-and-earlier.md`, `wi-closeouts-2026-05.md`) never
existed on disk. Pre-archive history lives in the git history of
`FRAMEWORK-STATE.md` itself (`git log -p -- FRAMEWORK-STATE.md`), not here.
Going forward, archive moves write real files in this directory.

Conventions:

- Analysis history: `analysis-history-<date>-and-earlier.md`
- Per-WI closeout sections: `wi-closeouts-<period>.md`
- Resolved gaps: `closed-gaps.md`
- Aged locked decisions: `decisions-<period>.md`

Never delete archived files; they are the audit trail.
