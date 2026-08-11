# Vision Refinement Proposal: Real-Time Collaboration

**Skill:** write-vision
**Mode:** REFINE (convert mode -- proposing changes to existing vision)
**Target:** docs/specs/vision.md
**Proposed by:** Autopilot S3 iteration
**Date:** 2026-04-03

---

## Proposed Changes

### Change 1: Expand Boundaries -- Out of Scope

**Current text:**
> Out of scope: Authentication, multi-user, persistence beyond in-memory store.

**Proposed text:**
> Out of scope: Authentication, persistence beyond in-memory store.
> Expanded to in-scope: Multi-user real-time collaboration via WebSocket.

**Rationale:** The new real-time collaboration feature requires multiple users to observe and mutate the same todo list simultaneously. "Multi-user" must move from out-of-scope to in-scope. Authentication remains out of scope -- users are identified by ephemeral session IDs, not credentials.

---

### Change 2: Expand Boundaries -- In Scope

**Current text:**
> In scope: CRUD for todos, overdue-checking cron job.

**Proposed text:**
> In scope: CRUD for todos, overdue-checking cron job, real-time multi-user collaboration (WebSocket push, presence tracking).

**Rationale:** Two new capabilities enter the product surface: (a) WebSocket-based event broadcasting so all connected clients see mutations live, and (b) lightweight presence tracking so users know who else is viewing the list.

---

### Change 3: Add WebSocket to Product Type

**Current text:**
> API-first backend with a simple frontend for demonstration.

**Proposed text:**
> API-first backend with WebSocket support and a simple frontend for demonstration.

**Rationale:** The architecture now includes a persistent connection layer (WebSocket) alongside the existing REST API. This is a material change to the product type.

---

### Change 4: Amend Risks

**Current text:**
> Over-engineering: this is a demo, not a product. Keep it tiny.

**Proposed text:**
> - Over-engineering: this is a demo, not a product. Keep it tiny.
> - Scope creep: real-time collaboration adds connection-state complexity. Bound it to broadcast-only (no conflict resolution, no offline sync).

**Rationale:** Adding multi-user introduces a category of complexity (connection lifecycle, fan-out, presence) that did not exist in the single-user version. An explicit risk entry keeps the team honest about the boundary.

---

## Evidence Table

| Proposed Change | Evidence Source | Strength |
|----------------|---------------|----------|
| Multi-user moves to in-scope | S3 scenario requirement: "multiple users can see each other's changes live" | Direct requirement |
| WebSocket added to architecture | Real-time push requires persistent connections; polling is insufficient for "live" UX | Technical necessity |
| Presence tracking in scope | Collaborators need awareness of who is connected to make the feature useful | UX best practice |
| No authentication added | S3 does not require auth; ephemeral session IDs suffice for presence | Deliberate exclusion |
| No conflict resolution | In-memory single-store model means last-write-wins; no CRDT needed | Complexity boundary |

---

## Open Questions

| # | Question | Impact | Suggested Resolution |
|---|----------|--------|---------------------|
| OQ-1 | Should presence show cursor/selection state or just "online" status? | UX scope | Start with online/offline only; cursor tracking is a future iteration |
| OQ-2 | What happens when the WebSocket connection drops mid-mutation? | Data integrity | REST API remains the source of truth; WS is notification-only, not transactional |
| OQ-3 | Should the overdue-checker broadcast its status changes via WebSocket? | Feature integration | Yes -- system-initiated mutations should also push to connected clients |

---

## Approval Gate

**Status:** PENDING APPROVAL

**Approver action required:** Confirm or reject each proposed change above.

### Autopilot User Response

> "Approved -- expand scope to include multi-user real-time collaboration."

**Status updated to:** APPROVED

**Next steps:**
1. Update `docs/specs/vision.md` with approved changes
2. Proceed to build-personas (Mode 3: Add New Persona) for the Team Collaborator persona
3. Run validate-feature to generate the Feature Ship Brief for the new capability

---

## Convert Mode Notes

This artifact demonstrates **REFINE mode** behavior in write-vision:

- **Bootstrap (S1):** The skill creates a vision document from scratch, filling every section from user input.
- **Convert (S3):** The skill reads the existing vision, identifies sections that conflict with the new requirement, and produces a structured proposal with evidence. The user must approve before the vision is modified.

Key difference: In convert mode, the skill never overwrites -- it proposes. The Evidence Table and Approval Gate are convert-mode-only output sections that do not appear in bootstrap mode.
