# Base44 Local Development And Runtime - Detail

## Mechanism (factual)

Base44's local development model is intentionally hybrid rather than fully isolated.

For backend-service projects, `base44 dev` runs some resources locally:

- functions
- entities
- media uploads

The local entity store is in-memory. It resets when the dev server stops, and schema changes can clear per-entity local data. Realtime subscriptions also work locally against this in-memory entity state.

The `User` entity is special: during local development, Base44 seeds a single user from the authenticated CLI credentials. Read/update behavior for `me` mirrors production, while create/delete user requests are ignored to match production restrictions.

Some things are explicitly forwarded to the deployed backend:

- authentication routes
- core integrations like email and AI endpoints
- custom OpenAPI integrations

Function automations do not run locally.

Functions run as separate Deno processes, reload on source edits, and print output directly in the terminal. The first request can be slower because the process starts on demand.

Base44's docs also support a simpler hosted-backend local-frontend mode:

- frontend on `npm run dev`
- backend traffic to hosted Base44 through the SDK

That is documented both in the app-editor GitHub flow and in backend quickstarts and overview material. So there are really two local-dev modes in practice:

1. frontend-local plus hosted backend
2. frontend-local plus partially local backend via `base44 dev`

Standalone scripts are part of this runtime story. `base44 exec` runs local Deno scripts against the linked deployed app using a pre-authenticated global `base44` client with user permissions. This is meant for migrations, seeds, inspection, ad hoc operations, and automation, not for persistent backend logic.

## Analysis (expert commentary)

- **Useful for:** deciding what can be verified pre-deploy and what still requires a deployed backend for confidence.
- **Trade-offs:** the hybrid model gives fast feedback without forcing full local parity, but it can hide whether a behavior came from local resources or forwarded production-backed capabilities.
- **Similar to:** local-first BaaS emulators that only emulate part of the platform and proxy the rest.
- **Could improve svc by:** labeling test evidence as `local-only`, `hybrid-local`, or `deployed-backend` whenever Base44 is involved, so confidence is explicit.
- **Assumptions:** forwarded features remain stable enough that hybrid local testing is meaningful for UI and SDK behavior.
- **Watch out for:** if a change depends on auth behavior, automations, or custom integrations, `base44 dev` is not full proof because those routes are forwarded or absent locally.
- **Additional watch out:** a separate dev app created through clone/eject/link may still be a poor substitute for production if plan limits diverge. Validate function-count ceilings, site bundle limits, and required per-app secrets before assuming the extra app gives real parity.
- **Practical consequence:** for some Base44 projects, the valuable loop is `local frontend -> hosted backend`, while a fully duplicated dev backend adds complexity without preserving production behavior.

## Key Source Files (L4 pointers)

- `https://docs.base44.com/developers/backend/overview/local-dev/local-development-overview`
- `https://docs.base44.com/developers/references/cli/get-started/overview`
- `https://docs.base44.com/developers/app-code/local-development/github`
- `https://docs.base44.com/developers/backend/overview/run-scripts`
