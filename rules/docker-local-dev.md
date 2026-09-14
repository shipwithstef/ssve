# Rule: Docker Local Dev Containers Must Not Auto-Start

Local dev Docker containers (Supabase, Postgres, Redis, MongoDB, etc.) MUST use `restart=no`. They must only start when explicitly requested by the developer.

## The Rule

When spinning up any local dev stack (Supabase CLI, docker-compose, manual `docker run`), **never use `restart=unless-stopped` or `restart=always`** for development-only services.

**Correct:**
```bash
# docker-compose.yml
restart: "no"        # explicit

# docker run
docker run --restart=no ...

# after the fact (fix existing containers)
docker update --restart=no $(docker ps -aq --filter "name=<project>")
```

**Wrong:**
```bash
restart: unless-stopped   # auto-starts on every WSL/machine boot
restart: always           # same problem
```

## When This Applies

- Any project using `supabase start` (Supabase CLI sets `unless-stopped` by default)
- Any `docker-compose up` for local dev services
- Any `docker run` for dev databases or tooling
- WSL2 environments where Docker Desktop starts containers on WSL boot

## Supabase CLI Caveat

`supabase start` hardcodes `unless-stopped` on its containers — you cannot configure this upstream. Fix it immediately after first `supabase start`:

```bash
docker ps --filter "name=<project>" --format "{{.ID}}" | \
  xargs -I{} docker update --restart=no {}
```

Add this as a one-time step in the project's README or setup script so new contributors don't hit the same issue.

## Why This Exists

Observed 2026-04-30: Example Marketplace local Supabase stack (11 containers, ~40% CPU at boot) was auto-starting on every WSL session because Supabase CLI defaults to `unless-stopped`. The developer had no active work in that project but was paying the CPU/RAM cost on every boot. Dev containers are not services — they should only run when the developer needs them.

## How a Reviewer Enforces This

When reviewing any project setup docs, `docker-compose.yml`, or onboarding scripts:
- Flag any `restart: unless-stopped` or `restart: always` on dev-only services — severity: MEDIUM
- Confirm setup docs include the `docker update --restart=no` step for Supabase CLI projects
