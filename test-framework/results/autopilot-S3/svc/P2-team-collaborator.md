# P2: Team Collaborator

## Role

A team member who uses the shared todo list alongside other collaborators. Unlike P1 (who evaluates the pipeline), P2 represents the end-user consuming the real-time collaboration feature -- someone who needs to see live updates from teammates and understand who else is working on the list.

## Goals

- See changes made by other team members in real time without refreshing.
- Know who else is currently viewing or editing the shared todo list.
- Trust that the list they see is always current -- no stale reads.

## Needs

- Instant visual feedback when a collaborator creates, completes, or deletes a todo.
- A presence indicator showing which other users are connected.
- Graceful degradation when the WebSocket connection is interrupted (fall back to REST polling or show a "reconnecting" state).

## Pain Points

- Stale views: editing a todo that someone else already deleted.
- "Ghost" presence: seeing a user listed as online when they have already disconnected.
- Notification fatigue: being bombarded with change events on a busy list.

## Technical Context

Uses a modern browser with WebSocket support. Expects sub-second latency for change propagation. Does not have login credentials -- identified by an ephemeral session ID assigned on connection.

## Relationship to Existing Personas

- **P1 (Developer Testing SVC):** P1 is the builder/evaluator; P2 is the user of what P1 builds.
- **Interaction pattern:** In journey J02, P1 and P2 both appear as actors -- P1 creates a todo, P2 sees it arrive in real time.

## Persona Discovery Mode

This persona was created using **Mode 3: Add New Persona** (convert mode). In bootstrap (S1), all personas are discovered automatically via Mode 7 (Auto-Discovery) from the vision document. In convert mode, a single persona is added to address a specific new capability without re-running full discovery.

| Mode | Trigger | Output |
|------|---------|--------|
| Mode 7 (Auto-Discovery) | New project, no personas exist | Full persona set from vision |
| Mode 3 (Add New) | New feature requires a persona type not yet represented | Single persona added to existing set |

Mode 3 is interactive: the skill asks "What role does this persona fill?" and "How do they relate to existing personas?" before generating the artifact. Mode 7 is automatic: it reads the vision and infers all personas at once.
