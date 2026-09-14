# Base44 CLI Skill Contract

## Source
- **File:** `skills/base44-cli/SKILL.md` (530 lines)
- **Package:** `base44` v0.0.50 (from frontmatter `metadata.sourcePackage`)
- **References:** 31 files under `skills/base44-cli/references/`

## Skill Trigger Logic

The CLI skill has aggressive auto-trigger rules:

> "This skill activates on ANY mention of 'base44' or when a `base44/` folder exists."

First action MUST be:
1. Check if `base44/config.jsonc` exists
2. If **NO** (new project): this skill handles it
3. If **YES** (existing project): transfer to `base44-sdk` skill

## CLI vs SDK Skill Boundary

| Scenario | Skill |
|----------|-------|
| New project, empty dir, no `config.jsonc` | `base44-cli` |
| `base44/config.jsonc` exists | `base44-sdk` |
| CLI commands (`npx base44 ...`) | `base44-cli` |
| Implementing features with `@base44/sdk` | `base44-sdk` |

> "`base44-cli` is a prerequisite for `base44-sdk` in new projects"

## Critical: Local Installation Only

> "NEVER call `base44` directly. The CLI is installed locally as a dev dependency and must be accessed via a package manager:"

- `npx base44 <command>` (recommended)
- `yarn base44 <command>`
- `pnpm base44 <command>`

WRONG: `base44 login`
RIGHT: `npx base44 login`

## Mandatory Authentication Check

At the start of every AI session when this skill is activated:

```bash
npx base44 whoami
```

If not logged in, STOP immediately and ask the user to run `npx base44 login`.

## Project Structure

```
my-app/
├── base44/                      # Base44 configuration
│   ├── config.jsonc             # Project settings, site config
│   ├── .types/                  # Auto-generated TS types
│   │   └── types.d.ts
│   ├── entities/                # Entity schema definitions
│   ├── functions/               # Backend functions
│   ├── agents/                  # Agent configurations
│   └── connectors/              # OAuth connector configs
├── src/
│   └── api/
│       └── base44Client.js      # Pre-configured SDK client
├── index.html
├── package.json
└── vite.config.js
```

## config.jsonc Schema

```jsonc
{
  "name": "My App",                    // Required
  "description": "App description",    // Optional
  "entitiesDir": "./entities",         // Optional: default "entities"
  "functionsDir": "./functions",       // Optional: default "functions"
  "agentsDir": "./agents",             // Optional: default "agents"
  "connectorsDir": "./connectors",     // Optional: default "connectors"
  "site": {                            // Optional: site deployment
    "installCommand": "npm install",
    "buildCommand": "npm run build",
    "serveCommand": "npm run dev",
    "outputDirectory": "./dist"
  }
}
```

## Available Commands

### Authentication
| Command | Description |
|---------|-------------|
| `base44 login` | Device code flow authentication |
| `base44 logout` | Logout from current device |
| `base44 whoami` | Display current authenticated user |

### Project Management
| Command | Description |
|---------|-------------|
| `base44 create [name] --path <path>` | Create new project from template |
| `base44 link` | Link existing local project |
| `base44 eject` | Download code for existing project |
| `base44 dashboard open` | Open app dashboard |

> "ALWAYS provide both the project name AND `--path` flag. Without both, the command opens an interactive TUI which agents cannot use properly."

Template selection is critical:
- `backend-and-client` — NEW full-stack web app (default)
- `backend-only` — Add Base44 to EXISTING project

### Deployment
| Command | Description |
|---------|-------------|
| `base44 deploy` | Deploy all resources (entities, functions, agents, connectors, auth, site) |

### Entity Management
| Action / Command | Description |
|------------------|-------------|
| Create entities | Define in `base44/entities/` folder |
| `base44 entities push` | Push local entities to Base44 |

Entity schema rules:
- File naming: `base44/entities/{kebab-case-name}.jsonc` (e.g., `team-member.jsonc` for `TeamMember`)
- Entity names: alphanumeric only, pattern `/^[a-zA-Z0-9]+$/`
- Field names: snake_case
- Top-level `type` and `properties` (NOT nested in `schema` object)
- Field types: `string`, `number`, `integer`, `boolean`, `array`, `object`, `binary`
- String formats: `date`, `date-time`, `time`, `email`, `uri`, `hostname`, `ipv4`, `ipv6`, `uuid`, `file`, `regex`, `richtext`

### Function Management
| Action / Command | Description |
|------------------|-------------|
| Create functions | Define in `base44/functions/<name>/` with `function.jsonc` + entry file |
| `base44 functions deploy [names...] [--force]` | Deploy functions (optionally target specific ones or prune removed) |
| `base44 functions delete <names...>` | Delete deployed functions |
| `base44 functions list` | List deployed functions |
| `base44 functions pull [name]` | Pull deployed functions to local |

Function rules:
- Directory: kebab-case (e.g., `process-order/`)
- Function name: match directory, no dots allowed (`/^[^.]+$/`)
- Runs on Deno, use `npm:` prefix for npm packages
- Entry file typically `index.ts`

### Agent Management
| Action / Command | Description |
|------------------|-------------|
| Create agents | Define in `base44/agents/{agent_name}.jsonc` |
| `base44 agents pull` | Pull remote agents to local |
| `base44 agents push` | Push local agents to Base44 |

> "Agent commands perform full synchronization - pushing replaces all remote agents with local ones, and pulling replaces all local agents with remote ones."

Agent schema:
```jsonc
{
  "name": "agent_name",           // Required; pattern: /^[a-z0-9_]+$/
  "description": "...",           // Required
  "instructions": "...",          // Required
  "tool_configs": [               // Optional; defaults to []
    { "entity_name": "tasks", "allowed_operations": ["read", "create", "update", "delete"] },
    { "function_name": "send_email", "description": "..." }
  ],
  "whatsapp_greeting": "..."      // Optional
}
```

### Connector Management
| Action / Command | Description |
|------------------|-------------|
| Create connectors | Define in `base44/connectors/{type}.jsonc` |
| `base44 connectors list-available` | List available integration types |
| `base44 connectors pull` | Pull remote connectors |
| `base44 connectors push` | Push local connectors |

> "Connector commands perform full synchronization"

Connector schema:
```jsonc
{
  "type": "googlecalendar",
  "scopes": ["..."]
}
```

Required: `type`. Optional: `scopes` (defaults to `[]`).

> "`stripe` is also a valid connector type but is not returned by `list-available`. Treat it as a supported type — it is provisioned automatically by Base44 with no OAuth browser flow."

### Auth Configuration
| Command | Description |
|---------|-------------|
| `base44 auth password-login <enable\|disable>` | Toggle username/password auth |
| `base44 auth pull` | Pull auth config |
| `base44 auth push` | Push auth config |

> "Auth config is also deployed as part of `base44 deploy`."

### Secrets Management
| Command | Description |
|---------|-------------|
| `base44 secrets list` | List secret names |
| `base44 secrets set` | Set secrets (KEY=VALUE or --env-file) |
| `base44 secrets delete <key>` | Delete a secret |

> "These commands are hidden from `--help` output but are fully functional."

### Script Execution
| Command | Description |
|---------|-------------|
| `base44 exec` | Run a script via stdin with Base44 SDK pre-authenticated |

### Type Generation
| Command | Description |
|---------|-------------|
| `base44 types generate` | Generate `base44/.types/types.d.ts` from entities, functions, agents, connectors |

> "No authentication required. Runs entirely locally. Automatically updates `tsconfig.json` to include the generated types."

### Site Management
| Command | Description |
|---------|-------------|
| `base44 site deploy` | Deploy built site files |
| `base44 site open` | Open deployed site |

> "SPA only: Base44 hosting supports Single Page Applications with a single `index.html` entry point. All routes are served from `index.html`."

## Automations (within function.jsonc)

Four automation types defined in `function.jsonc`'s `automations` array:

1. **Scheduled One-Time:** `type: "scheduled"`, `schedule_mode: "one-time"`, `one_time_date`
2. **Scheduled CRON:** `type: "scheduled"`, `schedule_mode: "recurring"`, `schedule_type: "cron"`, `cron_expression`. Minimum interval: 5 minutes.
3. **Scheduled Simple:** `type: "scheduled"`, `schedule_mode: "recurring"`, `schedule_type: "simple"`, `repeat_unit` (`minutes`/`hours`/`days`/`weeks`/`months`). Minimum for minutes: 5.
4. **Entity Hook:** `type: "entity"`, `entity_name`, `event_types` (`create`/`update`/`delete`)

Common fields: `name` (required), `description`, `function_args`, `is_active` (default: true)

End conditions for scheduled: `ends_type` (`never`/`on`/`after`), `ends_on_date`, `ends_after_count`

> "Automations are deployed with their function. There is no separate automation deploy command."

## Row-Level Security (RLS)

RLS supports five operations: `create`, `read`, `update`, `delete`, `write` (shorthand for CUD)

Permission values:
1. `true` — allow all (including anonymous)
2. `false` — block all
3. Condition object

Template variables:
- `{{user.id}}`, `{{user.email}}`, `{{user.role}}`, `{{user.data.field_name}}`

Built-in entity attributes: `id`, `created_date`, `updated_date`, `created_by`

Condition types:
- Entity-to-user comparison: `{ "created_by": "{{user.email}}" }`
- User condition check: `{ "user_condition": { "role": "admin" } }`

Supported operators:
- Logical: `$or`, `$and`, `$nor`
- Field operators (for `data.*` fields only): `$in`, `$nin`, `$ne`, `$all`

NOT supported: `$gt`, `$lt`, `$gte`, `$lte`, `$regex`, `$expr`, `$where`

> "If no RLS is defined, all records are accessible to all users."

> "`asServiceRole` sets the user's role to `"admin"` but does NOT bypass RLS. Your RLS rules must include admin access."

## Field-Level Security (FLS)

FLS rules are defined within each field's schema using the `rls` property. Supports same operations as entity-level RLS.

> "If no field-level RLS is defined, the field inherits the entity-level RLS rules."

## Quick Start Workflow

```bash
npm install --save-dev base44
npx base44 login
npx base44 create my-app -p .
npm run build
npx base44 deploy -y
```

## Cross-References
- `skills-sdk-contract.md` — SDK modules and method references
- `skills-repo-structure.md` — Repository layout and skill conventions
- Prior detail files: `sdk-client-architecture.md`, `sdk-modules-reference.md`
