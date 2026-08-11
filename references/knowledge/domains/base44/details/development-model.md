# Base44 Development Model - Detail

## Mechanism (factual)

Base44 currently documents three different things that look similar from a distance but serve different purposes.

1. App-editor origin projects

The "Start from an Existing Base44 App" flow is for apps that were first built in the Base44 UI. The documented move is `base44 eject`, which creates a new backend project on Base44 with a new app ID and downloads the frontend code plus backend resources into a local project. The original app remains unchanged in Base44. The docs explicitly position this for people who want full IDE control, extra clients, or version-control workflows beyond the built-in GitHub sync.

2. Backend-service projects

The "Link an Existing Backend Project" flow is for projects that already have Base44 backend project code locally. The expected structure includes a `base44/` folder with `config.jsonc`. The documented lifecycle is `base44 login`, `base44 link`, then `base44 deploy`. The docs treat local code and the hosted Base44 backend as separate pieces that are connected by the link step.

3. External API integration

The integrations docs describe connectors, custom OpenAPI integrations, and backend functions. Custom integrations are configured from an OpenAPI specification by a workspace admin and called via `base44.integrations.custom.call()`. They are meant for internal APIs or partner APIs that multiple apps in the workspace need to share. Backend functions are the escape hatch when the integration shape is not flexible enough.

Base44's local-development story is intentionally hybrid. The frontend runs on its own local dev server. For backend-service projects, `base44 dev` can run project resources locally, but some platform capabilities still forward to the hosted Base44 backend. Base44 also documents the app-editor GitHub workflow separately: connect GitHub, clone locally, configure env vars, run `npm run dev`, merge to `main`, then publish from Base44.

A mixed repo can show signals from both the UI-origin and backend-service worlds:

- UI-origin lineage is plausible when the project still follows app-editor or GitHub-sync publishing conventions.
- Backend-service traits appear when the repo includes local Base44 config, checked-in entities, backend functions, and explicit SDK client wiring.

That combination should be understood as a UI-origin Base44 app that has already crossed into code-managed backend territory, not as a non-Base44 app deciding whether to adopt Base44 for the first time.

## Analysis (expert commentary)

- **Useful for:** deciding whether a Base44 project should stay on app-editor/GitHub sync, move toward CLI/backend-service operation, or use integrations for external systems.
- **Trade-offs:** app-editor/GitHub sync is simpler when the Base44 UI remains authoritative; backend-service CLI gives cleaner code-first control, but only if the repo really matches that model and the deployment path is proven.
- **Similar to:** low-code products that later introduce an eject/export path into a code-first runtime. The danger is assuming exported code and editor-native sync are interchangeable when they are not operationally identical.
- **Could improve svc by:** making Base44 research default to classifying the project first as `ui-origin`, `code-first`, or `mixed`, instead of assuming one model from the presence of a `base44/` directory alone.
- **Assumptions:** the official docs opened on 2026-04-18 are representative of the current Base44 product split; repo-local deployment docs reflect prior operational learning rather than random drift.
- **Watch out for:** the user-linked "start-from-existing-api" concept appears to map, in current docs, to integrations/custom OpenAPI usage rather than to primary-backend migration. That naming ambiguity is exactly how teams end up inventing a two-backend plan that Base44 itself is not suggesting.

## Key Source Files (L4 pointers)

- `https://docs.base44.com/developers/backend/overview/start-from-existing-app`
- `https://docs.base44.com/developers/backend/overview/link-existing-project`
- `https://docs.base44.com/developers/app-code/local-development/github`
- `https://docs.base44.com/documentation/building-your-app/developer-tools`
- `https://docs.base44.com/developers/backend/overview/features`
- `https://docs.base44.com/documentation/integrations/using-custom-integrations`
- `https://docs.base44.com/developers/references/sdk/getting-started/third-party-apis`
