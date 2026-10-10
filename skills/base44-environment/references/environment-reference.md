# Base44 environment reference (Example Marketplace)

Moved out of `skills/base44-environment/SKILL.md` in the 2026-10 framework-5.5 audit
(`docs/framework-5.5-audit.md`): project inventory, architecture, function and
collection lists, the DB dump recipe, API walkthroughs, worked examples, cron setup
and file references. Load the section you need; the auth, secrets, deploy-gotcha and
verification rules stay in SKILL.md.

## What is Example Marketplace?

Example Marketplace is a SaaS platform for business management built on Base44, featuring:
- Employee scheduling and time tracking
- Customer loyalty programs and engagement
- Location-based check-ins and QR codes
- Stripe payment integration and subscriptions
- AI-powered deal generation
- Sample/referral program management

## Base44 Architecture

### Platform Overview
- **Platform**: Base44 (no-code backend platform)
- **Runtime**: Deno (serverless TypeScript functions)
- **Database**: Base44 managed database with Row-Level Security (RLS)
- **Frontend**: React + Vite (deployed to Base44)
- **Auth**: Base44 built-in authentication system

### Repository Structure
```
/home/svc-user/app-workspaces/
├── example-marketplace/                    # Base44-managed repo (auto-deployed)
│   ├── functions/               # 49 backend functions (TypeScript/Deno)
│   ├── src/                     # React frontend
│   ├── package.json             # @base44/sdk dependencies
│   └── vite.config.js           # Base44 vite plugin
│
└── example-marketplace-docs/               # Documentation repo (git remote)
    ├── skills/base44-environment/      # Base44 environment control (this skill)
    │   ├── scripts/             # Discovery & test scripts
    │   ├── docs/                # API documentation
    │   └── discovery-output/    # Environment maps
    ├── analysis/                # Product analysis docs
    └── code-reviews/            # Code review findings
```

**IMPORTANT**:
- `example-marketplace/` is managed by Base44 - changes only through Base44 platform
- `example-marketplace-docs/` is the documentation git repo - safe for custom tooling
- Never commit custom scripts to `example-marketplace/` - they'll be overridden

## Environment Configuration

### Base44 App Details

**Example Marketplace:**
```bash
APP_ID="693ba692c92a2e5d0262231d"
BASE_URL="https://example-marketplace.example.invalid"
API_KEY="EXAMPLE_API_KEY"  # from discovery-output
```

**Distrilicious:**
```bash
APP_ID="698c626321827d1398efdb01"
BASE_URL="https://distrilicious.base44.app"
# Use JWT Bearer — see Authentication section above
```

### API Endpoints
```
Function Execution:
POST https://example-marketplace.example.invalid{functionName}

Headers:
{
  "Content-Type": "application/json",
  "api_key": "YOUR_BASE44_API_KEY"
}
```

## Backend Functions (49 Total)

### Authentication & Security (7)
- `validateUserType` - Enforce user type restrictions
- `validateAction` - Permission validation
- `secureOperation` - Secure operation wrapper
- `validateOrigin` - CSRF origin validation
- `csrfProtection` - CSRF token validation
- `auditLog` - Security audit logging
- `_validateOrigin` - Internal origin validator

### User & Location Management (3)
- `getUserLocations` - Get user's accessible locations
- `updateUserLocation` - Update location details
- `atomicEmployeeCreate` - Create employee with atomicity

### Check-In & Location (4)
- `checkIn` - Basic check-in function
- `secureCheckIn` - Check-in with security
- `generateLocationQR` - Generate QR codes for locations
- `getCheckInCooldown` - Get cooldown status

### Payments & Subscriptions (10)
- `stripeCheckout` - Create Stripe checkout session
- `stripeCreateCheckout` - Alternative checkout flow
- `stripePortal` - Customer portal redirect
- `stripePortalSession` - Portal session creation
- `stripeWebhook` - Stripe webhook handler
- `customerCheckout` - Customer subscription checkout
- `customerPortalSession` - Customer portal access
- `customerSubscriptionCheckout` - Subscription checkout
- `customerSubscriptionWebhook` - Subscription webhook
- `getSubscriptionStatus` - Check subscription status

### AI Features (3)
- `generateAIDeal` - AI-powered deal generation
- `checkAICredit` - Check AI credit balance
- `consumeAICredit` - Consume AI credits

### Sample/Referral System (4)
- `processSampleActivation` - Activate sample status
- `sampleTierEngine` - Calculate sample tier
- `submitSampleReferral` - Submit referral
- `syncLoyaltyPoints` - Sync loyalty point totals

### Business Logic (7)
- `fraudDetection` - Detect fraudulent activity
- `jobRunner` - Background job execution
- `stateEngine` - State machine processor
- `rateLimiter` - Rate limiting enforcement
- `customerEntitlementCheck` - Check customer entitlements
- `verifySubscriptionStatus` - Verify active subscription
- `rsvpEvent` - Event RSVP handling

### Data Operations (6)
- `batchLocationData` - Batch location operations
- `cascadeDelete` - Cascade delete operations
- `recordPurchase` - Record customer purchase
- `calculateBusinessUsage` - Calculate usage metrics
- `trackCustomerUsage` - Track customer activity
- `migrateLocationOwners` - Migrate location ownership

### Helper Functions (5)
- `_auditHelpers` - Audit logging utilities
- `_geo` - Geolocation utilities
- `_onesignal` - OneSignal push notification helpers
- `_pushTargeting` - Push notification targeting
- `getOneSignalAppId` - Get OneSignal app ID

## Database Collections (49 Total)

### Core Entities
- `User` - User accounts and profiles
- `Location` - Business locations
- `Employee` - Employee records
- `TeamMember` - Location team members

### Scheduling & Time Tracking
- `Shift` - Employee shifts
- `EmployeeBreak` - Break records
- `WeeklyBreak` - Weekly break config
- `WeeklyHours` - Weekly hour limits
- `Exception` - Schedule exceptions

### Customer Engagement
- `CheckIn` - Customer check-ins
- `CustomerLoyalty` - Loyalty accounts
- `LoyaltyChallenge` - Loyalty challenges
- `LoyaltyTier` - Loyalty tier config
- `CustomerBadge` - Achievement badges
- `CustomerPreference` - User preferences

### Deals & Offers
- `Deal` - Deal/promotion records
- `PersonalizedOffer` - Personalized offers
- `DailyHighlight` - Daily highlighted deals
- `FlashSlot` - Flash sale slots

### Events & Bookings
- `Event` - Business events
- `Booking` - Event bookings
- `StandbyQueue` - Event standby queue
- `Waitlist` - Waitlist entries

### Reviews & Ratings
- `Review` - Customer reviews
- `EmployeeRating` - Employee ratings

### Messaging
- `Conversation` - Message threads
- `Message` - Individual messages
- `NotificationLog` - Push notification log

### Payments & Subscriptions
- `Transaction` - Payment transactions
- `Subscription` - Subscription records
- `CustomerSubscription` - Customer subscriptions
- `PaymentMethod` - Stored payment methods
- `BankAccount` - Bank account info
- `PurchaseHistory` - Purchase records

### Sample/Referral Program
- `SampleProfile` - Sample user profiles
- `SampleReferral` - Referral records
- `SamplePointTransaction` - Point transactions
- `Referral` - General referrals
- `ReferralMilestone` - Referral milestones

### Competitions
- `Competition` - Competition records
- `CompetitionEntry` - Competition entries

### Usage & Analytics
- `BusinessUsage` - Business tier usage tracking
- `CustomerUsage` - Customer usage tracking
- `LocationAIUsage` - AI feature usage by location

### Configuration
- `LaunchConfig` - App launch configuration
- `LaunchIncentive` - Launch incentives
- `Item` - Catalog items
- `Follower` - Social follows

## Base44 SDK Patterns

### Function Invocation
```javascript
// From frontend
const result = await base44.functions.invoke('functionName', {
  param1: 'value1',
  param2: 'value2'
});
```

### Entity Operations
```javascript
// List all
const locations = await base44.entities.Location.list();

// Filter
const activeEmployees = await base44.entities.Employee.filter({
  is_active: true,
  location_id: locationId
});

// Create
const newDeal = await base44.entities.Deal.create({
  title: 'New Deal',
  location_id: locationId,
  discount_percent: 20
});

// Update
await base44.entities.Location.update(locationId, {
  business_name: 'Updated Name'
});

// Delete
await base44.entities.Deal.delete(dealId);
```

### Service Role (Bypass RLS in Functions)
```typescript
// Inside a backend function
const base44 = createClientFromRequest(req);

// Service role bypasses RLS
const allUsers = await base44.asServiceRole.entities.User.list();
```

### Authentication
```javascript
// Check auth
const isAuthed = await base44.auth.isAuthenticated();

// Get current user
const user = await base44.auth.me();

// Logout
await base44.auth.logout();

// Redirect to login
base44.auth.redirectToLogin();
```

## Complete Database Dump (JSON)

### 🎯 Capability: Full Database Export

We have dumped the **entire Example Marketplace database as JSON files**. This includes:
- **20 entity types** (Location, Deal, Review, User, etc.)
- **75 records total** with complete schema
- **All fields** from every collection
- **108KB total** of actual live database data

### Location of Database Dump

```
/home/svc-user/app-workspaces/example-marketplace-docs/base44-environment/discovery-output/entities/
```

**Files** (20 entity types as JSON):
- Location.json (9 records) - All business locations
- Deal.json (8 records) - All deals/promotions
- Review.json (7 records) - All customer reviews
- CheckIn.json (7 records) - All check-in records
- CustomerLoyalty.json (8 records) - All loyalty accounts
- LoyaltyTier.json (11 records) - All loyalty tiers
- Item.json (6 records) - All menu/catalog items
- User.json (5 records) - All user accounts
- Shift.json (3 records) - All work shifts
- Message.json (3 records) - All direct messages
- PersonalizedOffer.json (2 records) - All custom offers
- Booking.json (2 records) - All reservations
- Event.json (1 record) - Event records
- Competition.json (1 record) - Competition records
- Employee.json (2 records) - Employee records
- PaymentMethod.json, Subscription.json, etc. (empty)

### How We Did It

**Step 1: Direct Entity API Queries**
```bash
# Query any entity collection directly
curl -X GET "https://example-marketplace.example.invalid{EntityName}" \
  -H "api_key: YOUR_BASE44_API_KEY"

# Example: Get all Locations
curl -X GET "https://example-marketplace.example.invalid" \
  -H "api_key: YOUR_BASE44_API_KEY"

# Returns: JSON array of all records
[
  {"business_name": "The Rusty Spoon", "category": "restaurant", ...},
  {"business_name": "Bean & Brew", "category": "cafe", ...},
  {...}
]
```

**Step 2: Automated Dump Script**
```bash
#!/bin/bash
# Script: 3-query-all-entities.sh

APP_ID="693ba692c92a2e5d0262231d"
BASE_URL="https://example-marketplace.example.invalid"
API_KEY="EXAMPLE_API_KEY"

# Query all 20 entities and save as JSON
for entity in Location Deal Review User CheckIn ... ; do
  curl -X GET "${BASE_URL}/api/apps/${APP_ID}/entities/${entity}" \
    -H "api_key: ${API_KEY}" \
    > "entities/${entity}.json"
done
```

**Step 3: Result**
- 20 entity JSON files created
- 108KB of complete database dump
- Can be refreshed anytime with the script

### Using the Database Dump

**Load and Query in Memory**:
```bash
# Read Location data
cat entities/Location.json | python3 -m json.tool

# Filter with jq
cat entities/Deal.json | jq '.[] | select(.is_active == true)'

# Get statistics
cat entities/Location.json | jq 'length'  # Count records
cat entities/Location.json | jq '.[].category' | sort | uniq -c  # Category breakdown
```

**Parse in Code**:
```python
import json

# Load Location data
with open('discovery-output/entities/Location.json') as f:
    locations = json.load(f)

# Analyze
for loc in locations:
    print(f"{loc['business_name']}: {loc['category']} in {loc['city']}")

# Get stats
print(f"Total locations: {len(locations)}")
print(f"Open now: {sum(1 for l in locations if l.get('is_open_now'))}")
```

### Database Access Methods

| Method | What You Get | Auth Required |
|--------|-------------|---|
| **Direct Entity Query** | All records from collection | API key only ✅ |
| **Backend Function** | Filtered/processed data | API key + user token |
| **Service Role Function** | All data (bypasses RLS) | API key + function code |

---

## Deploying Functions via API

Base44 provides a **coding/write API** for creating, updating, and deleting functions/pages programmatically.

### API Endpoint
```
POST https://app.base44.com/api/apps/{APP_ID}/coding/write
```

### Authentication
```bash
-H "api_key: YOUR_BASE44_API_KEY"
```

### CRUD Operations

#### Create/Update Function or Page
```bash
# Method 1: Using jq to prepare payload (RECOMMENDED - handles special chars)
jq -n --rawfile content /path/to/function.ts \
  '{file_path: "functions/myFunction", content: $content}' > /tmp/payload.json

curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/payload.json

# Method 2: Direct inline (only for simple content)
curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"file_path": "pages/TestPage", "content": "export default function Test() { return <div>Hello</div>; }"}'
```

#### Delete Function or Page
```bash
curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"file_path": "pages/TestPage", "content": "", "delete": true}'
```

#### Read Current State
```bash
# Get entire app configuration (all functions and pages)
curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -H "Content-Type: application/json" \
  # SAFE: round-trip an existing page so nothing is overwritten
  # Replace src/pages/Home.jsx with any existing page in your project
  --data-binary "$(jq -n --rawfile content src/pages/Home.jsx '{file_path: "pages/Home", content: $content}')" | jq '.functions.targetFunction'
```

### File Paths
- **Functions**: `functions/functionName` (no `.ts` extension)
- **Pages**: `pages/PageName` (no `.jsx` extension)

### Important Notes
- **No Git Required**: Changes deploy instantly via API (Base44 overrides git anyway)
- **UI Caching**: After API deployment, hard refresh browser (Ctrl+Shift+R) to see changes in editor
- **Special Characters**: Always use `jq --rawfile` method for production code with quotes, newlines, etc.
- **Response**: Returns full app config on success with `id` field
- **Deployment Time**: ~2-5 seconds for changes to be live

### Example: Deploy Migration Function
```bash
# Save function code to file
cat > /tmp/migrateLocationOwners.ts << 'EOF'
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  // Function code here
});
EOF

# Create payload
jq -n --rawfile content /tmp/migrateLocationOwners.ts \
  '{file_path: "functions/migrateLocationOwners", content: $content}' > /tmp/payload.json

# Deploy
curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/payload.json | jq 'if .id then "✅ Deployed successfully" else . end'
```

---

## Running Backend Functions via API

### Function Execution Endpoint
```
POST https://example-marketplace.example.invalid{APP_ID}/functions/{functionName}
```

### Authentication
```bash
-H "Content-Type: application/json"
-H "api_key: YOUR_BASE44_API_KEY"
```

### Examples

#### Simple Function (No Parameters)
```bash
curl -X POST "https://example-marketplace.example.invalid" \
  -H "Content-Type: application/json" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -d '{}'
```

#### Function with Parameters
```bash
curl -X POST "https://example-marketplace.example.invalid" \
  -H "Content-Type: application/json" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -d '{"location_id": "693d12843d11c23edceb170a"}'
```

#### Migration Function
```bash
# Run data migration (idempotent - safe to run multiple times)
curl -X POST "https://example-marketplace.example.invalid" \
  -H "Content-Type: application/json" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -d '{}' | jq .

# Response:
# {
#   "success": true,
#   "summary": {
#     "total": 9,
#     "migrated": 9,
#     "skipped": 0,
#     "errors": 0
#   }
# }
```

### Important Notes
- **API Key Only**: Most service-role functions work with just API key
- **User Token Required**: Some functions need user authentication (JWT)
- **Idempotent**: Migrations can be run multiple times safely
- **Response**: Always JSON with success/error status

---

## Deploying Entity Schemas via API

Entities (database schemas) can be modified programmatically via the same coding/write API.

### Read Current Entity Schema
```bash
# SAFE: round-trip an existing page's real content so it is not overwritten
# Replace src/pages/Home.jsx with any existing page in the project
jq -n --rawfile content src/pages/Home.jsx '{file_path: "pages/Home", content: $content}' | \
curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -H "Content-Type: application/json" \
  -d @- | jq -r '.entities.Location'
```

> ⚠️ **NEVER use `"content": "dummy"`** — coding/write always writes. Passing fake content
> overwrites the live page and breaks the app. Always read the real file first and pass it back.

### Update Entity Schema
```bash
# 1. Create updated schema JSON
cat > /tmp/location_entity.json << 'EOF'
{
  "name": "Location",
  "type": "object",
  "properties": {
    "owner_id": {
      "type": "string",
      "description": "ID of the business owner (immutable, for fast lookups)"
    },
    "owner": {
      "type": "string",
      "description": "Email of the business owner (for display)"
    },
    "business_name": {
      "type": "string",
      "description": "Name of the business"
    }
    // ... rest of properties
  },
  "required": ["business_name", "category"]
}
EOF

# 1b. Create a durable schema-change artifact in the repo. The Bash guard
# requires rollback plus round-trip/persistence/RLS/probe evidence.
# Example path: .svc/base44-schema-change-WI-123.md

# 2. Deploy entity schema
jq -n --rawfile content /tmp/location_entity.json \
  '{file_path: "entities/Location", content: $content}' > /tmp/payload.json

SVC_BASE44_SCHEMA_WRITE_ARTIFACT=.svc/base44-schema-change-WI-123.md \
curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/payload.json
```

### Entity Path Convention
```
entities/{EntityName}
```

Examples:
- `entities/Location`
- `entities/Deal`
- `entities/User`

### Available Entities (50 Total)
```bash
# List all entities (SAFE: round-trip real file content)
jq -n --rawfile content src/pages/Home.jsx '{file_path: "pages/Home", content: $content}' | \
curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -H "Content-Type: application/json" \
  -d @- | jq '.entities | keys'
```

**Core Entities:**
- Location, Deal, Item, Employee, TeamMember
- User, Subscription, PaymentMethod
- Review, Follower, CheckIn
- FlashSlot, StandbyQueue, Competition
- LoyaltyTier, LoyaltyChallenge, CustomerLoyalty
- Event, Exception, WeeklyHours, Shift

---

## Database Querying via API

### Direct Entity API (Read-Only)
```
GET https://example-marketplace.example.invalid{APP_ID}/entities/{EntityName}
```

### Query All Records
```bash
# Get all locations
curl -s "https://example-marketplace.example.invalid" \
  -H "api_key: YOUR_BASE44_API_KEY" | jq .

# Get all deals
curl -s "https://example-marketplace.example.invalid" \
  -H "api_key: YOUR_BASE44_API_KEY" | jq .
```

### Filter Specific Fields
```bash
# Get only specific fields from first location
curl -s "https://example-marketplace.example.invalid" \
  -H "api_key: YOUR_BASE44_API_KEY" | \
  jq '.[0] | {business_name, owner_id, owner, created_by_id, created_by}'
```

### Count Records
```bash
curl -s "https://example-marketplace.example.invalid" \
  -H "api_key: YOUR_BASE44_API_KEY" | jq 'length'
```

### Database Dump (All Entities)
```bash
cd /home/svc-user/app-workspaces/example-marketplace-docs/base44-environment

# Dump all 20 entities as JSON files
./scripts/3-query-all-entities.sh

# Results saved to:
# discovery-output/entities/Location.json
# discovery-output/entities/Deal.json
# discovery-output/entities/Review.json
# ... (20 total files, 75 records, 108KB)
```

### What the API Returns
- **Raw database records** - actual columns, no computed fields
- **All fields** - including internal fields like `created_by_id`, `owner_id`
- **JSON array** - array of record objects
- **Unfiltered** - bypasses RLS when using service role

### Important Notes
- **API Key Only**: Entity queries work with just API key (service role)
- **No Filtering**: Base44 entity API doesn't support WHERE clauses via API
- **Full Table Scans**: Returns all records (be careful with large tables)
- **For Filtering**: Use backend functions with `.filter()` or `.list()` methods

---

## Complete Workflow Examples

### Example 1: Add Field to Entity & Populate Data

```bash
# Step 1: Read current entity schema (SAFE: round-trip real file content)
jq -n --rawfile content src/pages/Home.jsx '{file_path: "pages/Home", content: $content}' | \
curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -H "Content-Type: application/json" \
  -d @- | jq -r '.entities.Location' > /tmp/current_schema.json

# Step 2: Add new field to schema
jq '.properties.owner_id = {
  type: "string",
  description: "ID of the business owner (immutable)"
}' /tmp/current_schema.json > /tmp/updated_schema.json

# Step 3: Deploy updated schema
jq -n --rawfile content /tmp/updated_schema.json \
  '{file_path: "entities/Location", content: $content}' | \
curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -H "Content-Type: application/json" \
  -d @-

# Step 4: Run migration to populate new field
curl -X POST "https://example-marketplace.example.invalid" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -d '{}' | jq .

# Step 5: Verify data
curl -s "https://example-marketplace.example.invalid" \
  -H "api_key: YOUR_BASE44_API_KEY" | \
  jq '.[0] | {business_name, owner_id, owner}'
```

### Example 2: Deploy Function & Test

```bash
# Step 1: Write function code
cat > /tmp/myFunction.ts << 'EOF'
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const locations = await base44.asServiceRole.entities.Location.list();
  return Response.json({ total: locations.length });
});
EOF

# Step 2: Deploy function
jq -n --rawfile content /tmp/myFunction.ts \
  '{file_path: "functions/myFunction", content: $content}' | \
curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -H "Content-Type: application/json" \
  -d @-

# Step 3: Test function
curl -X POST "https://example-marketplace.example.invalid" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -d '{}' | jq .

# Step 4: Delete test function
curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"file_path": "functions/myFunction", "content": "", "delete": true}'
```

### Example 3: Fix 403 Origin Error

```bash
# Problem: 403 Forbidden when accessing from example-marketplace.app domain
# Root Cause: Origin validation only allows base44.app

# Step 1: Read current secureOperation function (SAFE: round-trip real file content)
jq -n --rawfile content src/pages/Home.jsx '{file_path: "pages/Home", content: $content}' | \
curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -H "Content-Type: application/json" \
  -d @- | jq -r '.functions.secureOperation' > /tmp/secureOperation.ts

# Step 2: Update validateOrigin function (lines 119-146)
# Replace: const allowedHosts = ['base44.app', 'localhost', '127.0.0.1'];
# With:    const allowedDomains = ['base44.app', 'example-marketplace.app', 'localhost', '127.0.0.1'];
# And fix: .includes() → exact match + subdomain check

# Step 3: Deploy fixed version
jq -n --rawfile content /tmp/secureOperation_fixed.ts \
  '{file_path: "functions/secureOperation", content: $content}' | \
curl -s -X POST "https://app.base44.com/api/apps/693ba692c92a2e5d0262231d/coding/write" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -H "Content-Type: application/json" \
  -d @-

# Step 4: Test from example-marketplace.app - 403 error should be gone!
```

---

## Testing Functions

### Using cURL
```bash
curl -X POST "https://example-marketplace.example.invalid" \
  -H "Content-Type: application/json" \
  -H "api_key: YOUR_BASE44_API_KEY" \
  -d '{}'
```

### Using Discovery Scripts
```bash
cd /home/svc-user/app-workspaces/example-marketplace-docs/base44-environment

# Run full environment discovery
./scripts/1-discover-environment.sh

# Dump all entity data as JSON
./scripts/3-query-all-entities.sh

# Extract function documentation
./scripts/2-extract-function-docs.sh
```

## Authentication Requirements

**IMPORTANT**: Most functions require user context, not just API key:

```typescript
// Inside function
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();  // Get authenticated user

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Function logic here
});
```

**What this means**:
- API key alone is NOT sufficient for most functions
- Functions need actual user session tokens
- Test via frontend with logged-in user, or use Base44 auth flow

## Common Tasks

### Task: Call a Backend Function
```javascript
const result = await base44.functions.invoke('getUserLocations', {});
console.log(result.data);
```

### Task: Query Database
```javascript
// Get all active deals for a location
const deals = await base44.entities.Deal.filter({
  location_id: 'loc_123',
  is_active: true
});
```

### Task: Create a Record
```javascript
const newEmployee = await base44.entities.Employee.create({
  user_email: 'employee@example.com',
  location_id: 'loc_123',
  role: 'staff',
  is_active: true
});
```

### Task: Test Function Locally
```bash
# Use the discovery script
cd /home/svc-user/app-workspaces/example-marketplace-doc/base44-environment
./scripts/1-discover-environment.sh
```

## Security Notes

1. **Row-Level Security (RLS)**: Database has RLS policies
2. **Service Role**: Functions use `asServiceRole` to bypass RLS
3. **User Validation**: Most functions validate user via `auth.me()`
4. **CSRF Protection**: Functions use origin validation
5. **API Key**: Required in headers but not sufficient alone

---

## External Cron Jobs (No User Auth)

For scheduled background tasks that need to modify the database without user sessions, use **secret-based authentication** instead of `auth.me()`.

### Architecture Pattern

```
┌─────────────────────────┐
│ Cloudflare Worker       │  (runs on schedule: */3 * * * *)
│ (Cron Trigger)          │
└───────────┬─────────────┘
            │ POST + X-Cron-Secret header
            ▼
┌─────────────────────────────────────┐
│ Base44 Function (jobRunner)         │
│ 1. Validates CRON_SECRET header     │  ← Authentication
│ 2. Uses asServiceRole for DB ops    │  ← Authorization
│ 3. Updates database records         │
└─────────────────────────────────────┘
```

### Security Model

| Function Type | Protection | Why |
|--------------|------------|-----|
| **Regular functions** | `auth.me()` - requires logged-in user | Called from frontend with user session |
| **Cron jobs** | `CRON_SECRET` header validation | No user session - called by external scheduler |

### Step 1: Create the Backend Function

```typescript
// functions/jobRunner.ts
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const url = new URL(req.url);
  const jobName = url.searchParams.get('job');

  // SECURITY: Validate CRON_SECRET for cron jobs
  if (jobName === 'auto_reopen') {
    const cronSecret = req.headers.get('X-Cron-Secret');
    const expectedSecret = Deno.env.get('CRON_SECRET');

    if (!expectedSecret || cronSecret !== expectedSecret) {
      return Response.json(
        { error: 'Unauthorized: Invalid or missing CRON_SECRET' },
        { status: 401 }  // Blocks spam/unauthorized requests
      );
    }

    // Authenticated! Now do DB operations with service role
    const expiredBreaks = await base44.asServiceRole.entities.Location.filter({
      current_status: 'on_break'
    });

    for (const loc of expiredBreaks) {
      if (new Date(loc.temporary_close_until) < new Date()) {
        await base44.asServiceRole.entities.Location.update(loc.id, {
          current_status: 'open',
          temporary_close_until: null
        });
      }
    }

    return Response.json({ success: true, processed: expiredBreaks.length });
  }

  return Response.json({ error: 'Unknown job' }, { status: 400 });
});
```

**Key points:**
- NO `auth.me()` call - this function doesn't need a user session
- Validates `X-Cron-Secret` header instead
- Uses `asServiceRole` for all database operations

### Step 2: Set CRON_SECRET in Base44

1. Go to Base44 console → Functions → Environment Variables
2. Add: `CRON_SECRET` = `<your-64-char-secret>`

Generate a secret:
```bash
openssl rand -hex 32
# Example: YOUR_64_CHAR_CRON_SECRET
```

### Step 3: Create Cloudflare Worker

```javascript
// workers/auto-reopen-cron.js
export default {
  async scheduled(event, env, ctx) {
    const jobRunnerUrl = 'https://example-marketplace.app/api/functions/jobRunner?job=auto_reopen';

    const response = await fetch(jobRunnerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': env.CRON_SECRET  // Secret from worker env
      }
    });

    const result = await response.json();
    console.log('Job result:', result);
  },

  async fetch(request, env) {
    // Manual trigger endpoint for testing
    await this.scheduled(null, env, null);
    return new Response(JSON.stringify({ message: 'Manual trigger completed' }));
  }
};
```

### Step 4: Configure Worker with wrangler.toml

```toml
name = "example-marketplace-auto-reopen"
main = "auto-reopen-cron.js"
compatibility_date = "2024-01-01"

[triggers]
crons = ["*/3 * * * *"]  # Every 3 minutes
```

### Step 5: Deploy Worker & Set Secret

```bash
cd workers

# Deploy the worker
wrangler deploy

# Set the CRON_SECRET (must match Base44 env var)
wrangler secret put CRON_SECRET
# Paste the same 64-char secret when prompted
```

### Testing

```bash
# Test 1: Without secret → Should be BLOCKED (401)
curl -X POST "https://example-marketplace.app/api/functions/jobRunner?job=auto_reopen"
# {"error":"Unauthorized: Invalid or missing CRON_SECRET"}

# Test 2: With wrong secret → Should be BLOCKED (401)
curl -X POST "https://example-marketplace.app/api/functions/jobRunner?job=auto_reopen" \
  -H "X-Cron-Secret: wrong-secret"
# {"error":"Unauthorized: Invalid or missing CRON_SECRET"}

# Test 3: With correct secret → Should WORK
curl -X POST "https://example-marketplace.app/api/functions/jobRunner?job=auto_reopen" \
  -H "X-Cron-Secret: YOUR_64_CHAR_CRON_SECRET"
# {"success":true,"processed":1}

# Test 4: Trigger via Cloudflare Worker (uses stored secret)
curl "https://example-marketplace-auto-reopen.yourname.workers.dev"
# {"message":"Manual trigger completed","result":{"success":true}}
```

### Why This Works Without BASE44_SERVICE_TOKEN

The `asServiceRole` capability is **built into the Base44 SDK** for backend functions:

```javascript
const base44 = createClientFromRequest(req);

// asServiceRole is automatically available to backend functions
// No external token needed - it's a privilege of running on Base44's servers
await base44.asServiceRole.entities.Location.update(id, data);
```

The security layers are:
1. **CRON_SECRET** = Authentication (proves request is from your worker)
2. **asServiceRole** = Authorization (built into SDK for server-side code)

### Common Use Cases

- Auto-reopen locations after break expires
- Expire old offers/deals
- Archive inactive conversations
- Process pending referrals
- Clear old notification logs
- Update subscription statuses

## File References

### Discovery Output
- `discovery-output/local-functions.txt` - All function names
- `discovery-output/database-collections.txt` - All collections
- `discovery-output/functions-by-category.md` - Categorized functions
- `discovery-output/README.md` - Environment overview

### Scripts
- `scripts/1-discover-environment.sh` - Full environment discovery
- `scripts/2-extract-function-docs.sh` - Extract function documentation

### Documentation
- `docs/API-REFERENCE.md` - Complete API reference
- `docs/functions/{name}.md` - Individual function docs
