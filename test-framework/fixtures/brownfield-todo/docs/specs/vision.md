# Vision: Todo API

> Minimal product that exercises the full svc pipeline.

## Purpose

A REST API for managing todo items. Exists solely to demonstrate that the
svc progressive-narrowing pipeline works on the smallest possible surface.

## Boundaries

- **In scope:** CRUD for todos, overdue-checking cron job.
- **Out of scope:** Authentication, multi-user, persistence beyond in-memory store.

## Principles

1. Minimal — every artifact is the smallest viable version of its phase.
2. Complete — every pipeline phase is represented with a real artifact.
3. Verifiable — a shell script can confirm the pipeline is structurally sound.

## Success Criteria

- All pipeline artifacts exist and pass structural validation.
- Feature spec reaches VERIFIED status.
- Enabler spec reaches VERIFIED status.

## Product Type

API-first backend with a simple frontend for demonstration.

## Risks

- Over-engineering: this is a demo, not a product. Keep it tiny.
