# Base44 Platform And Operating Models - Detail

## Mechanism (factual)

The backend overview docs describe Base44 as one backend platform exposed through multiple operating models rather than through multiple unrelated products.

At the platform level, Base44 says the backend service is the same backend that powers the Base44 app editor, but made available as a standalone BaaS. The backend service is code-defined and AI-oriented: projects are expressed through configuration files, entities, functions, connectors, agents, and optional site assets.

The important split is operational:

1. App-editor origin model

This is the Base44 UI-first model where the app editor generates a frontend and uses the managed backend. If such an app is connected to GitHub, the documented local flow is clone the repo, set the Base44 env vars, run `npm run dev`, merge to `main`, and publish from Base44. GitHub integration is permanent and the sync target branch is `main`.

2. Backend-service CLI model

This is the code-first model where the CLI owns project setup, resource definition, local development, and deployment. The documented entry point is `base44 create` for new projects. Existing local backend projects are connected with `base44 link`. Deployed resources are synced with `base44 deploy`.

3. UI-origin to code-managed bridge

This is the `base44 eject` path. It exists specifically for apps built in the Base44 app editor that now need local IDE control, branches, PRs, or extra clients like mobile apps. Eject creates a new backend project with its own app ID and downloads the frontend plus backend resources locally.

These models share one conceptual backend platform, but they are not interchangeable workflows. The docs are explicit about when to use `eject` versus `link`.

The backend overview also frames Base44 as an AI-assisted development system. Base44 ships:

- project skills for CLI work, SDK work, and troubleshooting
- an account MCP server for project operations
- a docs MCP server for live documentation retrieval

That means the product is not just "backend hosting"; it is a backend platform plus agent-facing operational tooling.

## Analysis (expert commentary)

- **Useful for:** classifying a Base44 repo before choosing deployment, local-dev, or migration strategy.
- **Trade-offs:** Base44 keeps one backend platform but exposes multiple workflows. That is powerful, but it creates ambiguity for repos that started in the UI and later accumulated code-first artifacts.
- **Similar to:** low-code systems that later add export/eject flows and CLI management. The backend remains one thing while the workflow surface area expands.
- **Could improve svc by:** making Base44 project classification explicit up front: `app-editor`, `backend-service`, or `mixed/ejected`.
- **Assumptions:** the current docs accurately reflect the intended distinction between app-editor GitHub sync and backend-service CLI workflows.
- **Watch out for:** people often interpret "existing app", "existing project", and "existing API" as variants of the same migration move. In Base44 they are different concepts: app-origin clone, code-project linking, and external API integration.

## Key Source Files (L4 pointers)

- `https://docs.base44.com/developers/backend/overview/introduction`
- `https://docs.base44.com/developers/backend/overview/backend-service-basics`
- `https://docs.base44.com/developers/backend/overview/start-from-existing-app`
- `https://docs.base44.com/developers/backend/overview/link-existing-project`
- `https://docs.base44.com/developers/app-code/local-development/github`
