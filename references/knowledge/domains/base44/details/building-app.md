# Building an App

## Mechanism

Building a Base44 app combines AI-assisted generation, visual editing, data modeling, automation, and code-level customization.

**AI Chat Modes**
- **Default**: Standard AI-assisted building and modification.
- **Discuss**: Planning and architecture conversations without making changes. Best for schema design and major decisions.
- **Edit**: Direct code and content modifications with visual edit support.
- **Visual Edits**: Rebuilt with auto-save and undo/redo up to 50 steps. A browser warning appears if you try to leave with unsaved changes.
- Builder questions help clarify ambiguous prompts before building.

**AI Agents for Apps**
- App-level AI agents can be configured with custom guidelines, model selection, skills, and memory.
- Per-agent model selection lets you pick fast models for routing or premium models for complex help.
- Agents can be connected to WhatsApp, Telegram, and LINE for external messaging.
- File intelligence extracts structured metadata from CSV, Excel, JSON, and Word files.

**Automations**
- Three trigger types:
  - **Scheduled**: Run backend functions at specific times/dates (cron-like).
  - **Data Event**: Triggered by entity changes — create, update, delete.
  - **Connector**: Triggered by events from connected tools (beta, supports Google Calendar, Drive, Gmail, Outlook, Teams, OneDrive, SharePoint).
- Smart suggestions based on app context when creating automations.

**Design System**
- **Global Themes**: Update colors and typography across the entire app at once.
- **Tailwind CSS**: Integrated for styling with mobile-first design, touch targets, safe areas, dark mode.
- **Typography and Spacing**: Configurable through the AI chat or code editor.
- **Responsive**: Apps automatically adjust layout for any device; mobile-specific customizations supported.
- **Accessibility**: Base44-generated designs include accessibility considerations.

**App Data**
- **Entities**: NoSQL data collections with configurable fields and types.
- **Fields**: Support for references, arrays, and various data types.
- **Import/Export**: CSV import for bulk data loading; CSV export for backups.
- **Permissions**: Row-level security (RLS) and data permissions per entity.
- **Test Data Environment**: Dedicated test records for safe experimentation.
- **5000-item limit**: Maximum 5,000 items per request; pagination recommended for larger collections.
- **Custom Roles**: Build full role hierarchies using the built-in User entity plus custom entities with reference fields and RLS.

**Mobile Experience**
- Apps work in any mobile browser; users can add to home screen.
- Base44 mobile apps available on Google Play and Apple App Store for building on the go.
- Push notifications not currently supported.
- Some features (Visual Edits, security settings, code editing) only available on desktop.

**NPM Packages**
- Add npm packages via AI chat request and approval.
- Supports animation libraries, charts, date helpers, UI components.
- Packages only supported on new infrastructure.
- Installed packages cannot be removed but unused packages have no effect.

**Infrastructure Update**
- New infrastructure delivers faster load times, NPM package support, and future features.
- Old apps must update by February 1, 2026; editor blocked after deadline.
- 15 free credits awarded for updating.
- Reverting to old infrastructure is possible but not recommended.

**Media and Files**
- File library per app for images, videos, documents, and data files.
- Upload from computer, Google Drive, or generate with AI.
- File limits: Images max 40MB (builder), 50MB (live app); Videos max 100MB; Documents max 10MB.
- Google Drive connection can be disconnected from account settings.

**Pages and Navigation**
- Up to 600 pages per app.
- Pages added via AI chat or duplicated from existing pages.
- Navigation menus (header, sidebar, footer, tabs, hamburger) created via AI chat.
- Hidden pages supported for admin areas and internal tools.
- Admin-only areas protected by role-based navigation visibility.

**Developer Tools**
- **Code Editor**: Edit any file with split-screen preview. Changes require Publish to go live.
- **GitHub Integration**: Connect app to GitHub for version control, branches, and PRs.
- **Activity Monitor**: Inspect requests, responses, events, errors, and warnings in real time.
- **BaaS Mode**: Use Base44 as backend-only with your own frontend via JavaScript SDK.
- Backend functions are always available; no toggle needed.

**Sending Emails**
- **Built-in SendEmail**: Preinstalled, no setup needed. Only sends to registered users. 1 credit/email (2 for custom domain).
- **Resend Integration**: External email service for any address, templates, deliverability. Builder plan+.
- **Automated Emails**: Scheduled and data-event automations can trigger emails.
- **Custom Domains**: Send from own domain when app has custom domain connected.

**App Store Submission**
- Scan app against Apple/Google guidelines; AI suggests fixes.
- Generate IPA (iOS) and AAB (Android) files for submission.
- Requires Builder plan+ to download store files.
- Mobile app wraps published app in secure web view; content changes go live without resubmission.
- Native features (push notifications, offline mode, HealthKit) not currently supported.

## Analysis

Base44's app building experience is a layered abstraction: AI chat for high-level generation, visual editing for pixel-perfect tweaks, code editor for full control, and data/integrations for backend logic. The three chat modes (Default/Discuss/Edit) are critical UX primitives — Discuss mode prevents the expensive mistake of having the AI build something before the design is settled.

The 5000-item limit is a significant constraint for data-heavy apps. It forces pagination early in the design, which is good for performance but adds complexity for builders who expected "just fetch everything." The test data environment is a safety feature that should be used more prominently — many no-code platforms lack this.

The infrastructure upgrade deadline is a hard migration with real consequences (editor blocked). This suggests Base44 is willing to break backward compatibility to reduce technical debt, which is pragmatic but risky for users with legacy apps.

The code editor with split-screen preview is a mature developer experience feature. The GitHub integration enables professional workflows (PRs, branches, checks) that elevate Base44 from a prototyping tool to a production platform.

The email architecture (built-in for internal, Resend for external, custom domains for branding) shows thoughtful tiering. The restriction that built-in email only sends to registered users is a spam-prevention measure but limits its use for marketing.

App store submission via web view wrapper is a pragmatic approach that avoids native development, but the lack of push notifications and offline mode are significant limitations for apps that need true native behavior.

## L4 Pointers

> "The AI chat has three modes: Default, Discuss, and Edit. Discuss mode helps the AI decide how to go about a change before implementing it."
> — https://docs.base44.com/documentation/building-your-app/ai-chat

> "The visual editing experience has been rebuilt with a new auto-save and undo/redo system. Edits save automatically as you work. Undo and redo up to 50 steps within a visual edit session."
> — https://docs.base44.com/documentation/changelog

> "Creating automations is now smarter and faster. When you click Add automation, you receive smart suggestions based on your app's context."
> — https://docs.base44.com/documentation/changelog

> "Connector automations are in beta and let you run an automation when a connected integration sends an event. Start automations from events in Google Calendar, Google Drive, or Gmail."
> — https://docs.base44.com/documentation/changelog

> "A new Global Themes feature lets you update colors and typography across your entire app at once. Replace a color and it updates everywhere it is used in your app."
> — https://docs.base44.com/documentation/changelog

> "Starting November 27, 2025, there is a limit of 5,000 items per request to help keep performance fast, stable, and reliable."
> — https://docs.base44.com/documentation/building-your-app/managing-app-data

> "A dedicated test data environment is now available. Use sample records to design and test flows, then switch to live data when you are ready."
> — https://docs.base44.com/documentation/changelog

> "You can edit the code for any part of your Base44 app to fine-tune layout, content, and behavior. Turn on split screen to see your live app preview next to the code editor."
> — https://docs.base44.com/documentation/building-your-app/editing-code

> "Base44 supports a GitHub based workflow so you can manage your app code with modern version control practices."
> — https://docs.base44.com/documentation/building-your-app/developer-tools

> "Base44's built-in SendEmail integration comes preinstalled in every app and does not require a paid plan, extra setup, or API keys. It lets you send transactional emails to people who have signed up to your app."
> — https://docs.base44.com/documentation/building-your-app/sending-emails

> "Base44 helps you scan your app against store guidelines, improve it with AI, and generate the IPA and AAB bundles. You still need to submit the app through your own App Store Connect and Google Play Console accounts."
> — https://docs.base44.com/documentation/building-your-app/app-stores

> "You should complete the update by February 1, 2026. After this date, if you have not updated yet, your live app keeps running and your data stays safe, but the editor for that app is blocked."
> — https://docs.base44.com/documentation/building-your-app/infrastructure-update
