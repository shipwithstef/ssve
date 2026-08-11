# Base44 Project Structure And Lifecycle - Detail

## Mechanism (factual)

The backend-service docs define a concrete local project shape centered on the `base44/` directory.

The minimum backend-only structure is:

- `base44/config.jsonc`
- `base44/.app.jsonc`
- `.gitignore`

As a project grows, the local codebase can add:

- `entities/` for entity schemas
- `functions/` for backend functions
- `agents/` for AI agent configs
- `connectors/` for OAuth connector configs
- `auth/` for login-method config
- `.types/types.d.ts` for generated TypeScript definitions

`config.jsonc` controls where each of those resource directories lives and can also include site output settings for full-stack projects. The docs note that some site fields are mainly used during `base44 create`; after creation, site deployment mainly depends on `outputDirectory`.

`.app.jsonc` links local code to a Base44 backend project and is explicitly not for version control. The CLI creates it during create/link and the docs say it should stay ignored.

The documented lifecycle differs by starting point:

- new project: `base44 create`
- existing local backend project: `base44 link`
- existing UI-built Base44 app: `base44 eject`

For linked backend projects, the official deployment path is:

- install deps
- `base44 login`
- `base44 link`
- set env vars if needed
- build frontend if present
- `base44 deploy`

For ejected app-editor apps, the official next step after eject is also to continue development locally and deploy with `base44 deploy`.

The CLI overview broadens the lifecycle further:

- `dev` for local development
- `deploy` for all project resources
- resource-specific commands like `functions deploy`, `entities push`, `connectors push`, `auth push`, and `site deploy`
- `exec` for one-off scripts

## Analysis (expert commentary)

- **Useful for:** mapping a real repo to Base44's intended project lifecycle and identifying whether a repo is structurally aligned with backend-service expectations.
- **Trade-offs:** the lifecycle is clean when a repo clearly started as `create`, `link`, or `eject`. Mixed-history repos are where confusion appears, especially if local team doctrine differs from current Base44 docs.
- **Similar to:** Terraform-style "local desired state linked to hosted control plane" workflows, except Base44 also carries frontend hosting and agent config in the same project envelope.
- **Could improve svc by:** adding a Base44 repo classifier that checks for UI-origin clues, `base44/` config presence, ignored/non-ignored `.app.jsonc`, and local deployment doctrine before recommending any deploy path.
- **Assumptions:** project structure pages are authoritative for backend-service repos; repo-local deviations are operational exceptions that need explicit validation.
- **Watch out for:** if a repo commits `.app.jsonc` or otherwise treats per-developer link state as shared state, it is already off the happy path the official docs describe.

## Key Source Files (L4 pointers)

- `https://docs.base44.com/developers/backend/overview/project-structure`
- `https://docs.base44.com/developers/backend/overview/link-existing-project`
- `https://docs.base44.com/developers/backend/overview/start-from-existing-app`
- `https://docs.base44.com/developers/references/cli/get-started/overview`
