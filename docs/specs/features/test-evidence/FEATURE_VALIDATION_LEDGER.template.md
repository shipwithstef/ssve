# Feature Validation Ledger

Feature: `<feature-name>`
Work item: `WI-000`
Run: `<YYYY-MM-DD-feature>`
Target: `<local|staging|production URL or command>`

Final closeout classification: `runtime-accepted`

## Feature Scope

- Feature spec: `docs/specs/features/<feature>.md`
- Lane task graph: `.svc/lane-tasks-WI-000.json`
- Runtime target: `<target>`

## Personas In Scope

| Persona | Source | Coverage note |
|---|---|---|
| `<persona>` | `docs/specs/personas/<file>.md` | `<why in scope>` |

## AC Closeout Table

Every AC from the feature spec must appear exactly once.

| AC ID | Persona(s) | Journey scenario(s) | Validation tier | Evidence path(s) | Runtime result | E2E result | Final |
|---|---|---|---|---|---|---|---|
| `ABC-01` | `PASS - <persona>` | `PASS - docs/specs/journeys/J01.feature.md @ABC-01` | `V2 runtime + V1 tests` | `.svc/visuals/WI-000/current-state/example.png` | `PASS - <command/report>` | `PASS - <test path>` | `PASS` |

## Static Checks

| Command | Result | Evidence |
|---|---|---|
| `<command>` | `PASS` | `<path>` |

## Runtime Journey Results

| Journey/scenario | Result | Evidence |
|---|---|---|
| `<scenario>` | `PASS` | `<path>` |

## E2E Or Fixture Gap

| AC ID | Automatable? | Result | Evidence or WI |
|---|---|---|---|
| `ABC-01` | `yes` | `PASS` | `<test path>` |

## Visual And Saved-State Evidence

| AC ID | Evidence |
|---|---|
| `ABC-01` | `.svc/visuals/WI-000/current-state/example.png` |

## Defects Filed

| AC ID | WI | Reason |
|---|---|---|
| `ABC-02` | `WI-000` | `<blocked or failed reason>` |

## Final Closeout Classification

`runtime-accepted`
