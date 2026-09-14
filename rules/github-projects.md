# GitHub Projects Standard for Vibecoding Teams

## Field Standards

All GitHub Projects for vibecoding teams MUST use these custom fields:

### Priority (Single Select)
- 🔴 Critical - Blocking issue, requires immediate attention
- 🟠 High - Important, should be done soon
- 🟡 Medium - Standard priority
- 🟢 Low - Nice to have

**Default**: 🟡 Medium

### Size (Single Select)
T-shirt sizing for effort estimation:
- XS - <2 hours (quick fix, small tweak)
- S - 2-4 hours (small feature, simple bug)
- M - 1 day (medium feature, complex bug)
- L - 2-3 days (large feature, refactor)
- XL - 1 week+ (major feature, architecture change)

**Default**: M

### Status (Built-in)
- 📋 Todo - Not started
- 🏗️ In Progress - Actively working on it
- ✅ Done - Completed

**Workflow**: Always move items to "In Progress" when starting work, and "Done" when complete.

## Issue Naming Convention

Format: `[Type] Brief description`

**Types:**
- `[Bug]` - Something is broken
- `[Feature]` - New functionality
- `[Refactor]` - Code improvement, no behavior change
- `[Docs]` - Documentation only
- `[Test]` - Test coverage
- `[DevOps]` - CI/CD, deployment, infrastructure
- `[Hotfix]` - Critical production fix

**Examples:**
- ✅ `[Bug] PostHog pageview not tracking /academy navigation`
- ✅ `[Feature] Add Priority field to GitHub Projects`
- ✅ `[Refactor] Rename vibe-academy view to academy`
- ❌ `fix academy` (missing type, not descriptive)
- ❌ `Academy routing issue` (missing type bracket)

## Built-in Fields to Use

- **Assignees** - Who owns this task
- **Labels** - Use for categorization (e.g., `frontend`, `backend`, `mobile`, `web`)
- **Milestone** - Group related work (e.g., "Beta Launch", "V1.0")
- **Repository** - Which repo the issue lives in

## Views to Create

1. **Backlog (Table)** - All items, sortable by Priority/Size
2. **Active Sprint (Board)** - Group by Status, filtered to current sprint
3. **Roadmap (Roadmap)** - Timeline view for planning

## When Creating Issues via GitHub CLI

```bash
gh issue create --title "[Bug] Description" \
  --body "Details here" \
  --label "bug,web" \
  --project "CoVibeFusion"
```

## When Creating Issues via GitHub Projects UI

1. Click "Add item"
2. Type title with `[Type]` prefix
3. Set Priority and Size immediately
4. Assign to yourself if you're working on it
5. Add to current milestone if applicable

## Automation Rules (Optional)

If setting up workflow automation:
- Auto-move to "In Progress" when PR is opened
- Auto-move to "Done" when PR is merged
- Auto-assign to PR author

## Why This Standard?

- **Consistent across all vibecoding projects** - Same fields, same workflow
- **Priority + Size = Better Planning** - Know what's urgent AND how long it takes
- **Type prefix = Quick Scanning** - See at a glance what kind of work it is
- **Works with gh CLI** - Can script issue creation
- **Flexible** - Can add project-specific fields, but these are the baseline
