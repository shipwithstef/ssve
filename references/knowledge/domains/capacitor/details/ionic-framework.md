# Ionic Framework

> **Group:** Capacitor / Ionic UI Toolkit
> **Sources:** 7 skills (capawesome-team × 6, capgo × 1)
> **Coverage:** App creation, general development, React/Angular/Vue bindings, design/theming, expert reference.

---

## 1. ionic-app-creation — Project Scaffolding

**Purpose:** Create a new Ionic app via the Ionic CLI with framework selection, template selection, and Capacitor integration.

### Prerequisites
- Node.js (latest LTS)
- Ionic CLI: `npm install -g @ionic/cli` (legacy `ionic` package must be uninstalled first)
- Xcode (iOS) / Android Studio (Android)

### Key Procedures

**Step 1 — Verify CLI:**
```bash
ionic --version
# If missing: npm install -g @ionic/cli
```

**Step 2 — Gather configuration (one decision at a time):**

| Choice | Options | Default |
|--------|---------|---------|
| Framework | `angular`, `angular-standalone`, `react`, `vue` | `angular` |
| Template | `blank`, `tabs`, `sidemenu` | `blank` |
| Capacitor | `--capacitor` or omit | Yes (include) |
| Package ID | `--package-id=com.example.myapp` | — |

**Step 3 — Create:**
```bash
ionic start my-app blank --type=angular-standalone --capacitor --package-id=com.example.myapp
```

**Step 4 — Verify:**
```bash
cd my-app && ionic serve
```

**Step 5 — Optional Tailwind CSS:** Read `references/tailwind-css-setup.md` per chosen framework.

**Step 6 — Continue to Capacitor:** If `--capacitor` was used, switch to `capacitor-app-creation` skill at Step 5 (Build the Web App) onward.

### Error Handling Patterns
- `ionic: command not found` → install `@ionic/cli` globally.
- Directory already exists → choose a different name or delete.
- Template not found → run `ionic start --list`.
- Port 8100 conflict → `ionic serve --port=<other>`.

---

## 2. ionic-app-development — General Development

**Purpose:** Core concepts, 80+ UI components, CLI usage, layout, theming, animations, gestures, and troubleshooting.

### Core Concepts
- **Components** are custom Web Components prefixed with `ion-` (e.g., `<ion-button>`, `<ion-content>`).
- **Platform modes:** `ios` (Apple design) on iOS; `md` (Material Design) on Android/web. The `<html>` element receives class `ios` or `md`.
- **Capacitor integration:** Ionic handles UI; Capacitor handles native APIs.

### Page Lifecycle (Ionic-specific)
| Event | Fires When | Use For |
|-------|------------|---------|
| `ionViewWillEnter` | Page about to enter | Refresh data on every visit |
| `ionViewDidEnter` | Page fully entered | Start animations, focus inputs |
| `ionViewWillLeave` | Page about to leave | Save state, pause subscriptions |
| `ionViewDidLeave` | Page fully left | Clean up off-screen resources |

> Critical: These fire **each time** a page becomes visible because `ion-router-outlet` caches pages in the DOM. Framework-native hooks (`ngOnInit`, `useEffect`, `onMounted`) fire only once.

### Component Categories

| Category | Components |
|----------|------------|
| Action & Buttons | action-sheet, button, fab, fab-button, fab-list, ripple-effect |
| Data Display | accordion, badge, card, chip, item, label, list, note, text |
| Form | checkbox, datetime, input, picker, radio, range, searchbar, select, segment, textarea, toggle |
| Layout | app, content, grid, header, footer, toolbar, split-pane |
| Media | avatar, icon, img, thumbnail |
| Navigation | breadcrumb, menu, nav, router, tabs, tab-bar |
| Overlay | alert, loading, modal, popover, toast, backdrop |
| Scroll & Virtual | infinite-scroll, refresher, reorder |
| Progress | progress-bar, skeleton-text, spinner |

### Key CLI Commands

```bash
ionic serve                    # Dev server (port 8100, live reload)
ionic serve --external         # All network interfaces
ionic serve --port=3000        # Custom port
ionic serve --prod             # Production build config
ionic build                    # Production build
ionic generate                 # Generate pages/components/services
ionic doctor check             # Common issue check
ionic info                     # Environment info for bug reports
ionic repair                   # Remove & recreate deps/platforms
```

### Layout

**Grid System** — 12-column flexbox grid (`ion-grid`, `ion-row`, `ion-col`):

| Breakpoint | Min Width | Property Suffix |
|------------|-----------|-----------------|
| `xs` | 0 | (default) |
| `sm` | 576px | `Sm` |
| `md` | 768px | `Md` |
| `lg` | 992px | `Lg` |
| `xl` | 1200px | `Xl` |

**CSS Utility Classes:**
- Text: `.ion-text-center`, `.ion-text-start`, `.ion-text-end`, `.ion-text-wrap`
- Padding: `.ion-padding`, `.ion-padding-top`, `.ion-no-padding`
- Margin: `.ion-margin`, `.ion-margin-top`, `.ion-no-margin`
- Display: `.ion-display-none`, `.ion-display-block`, `.ion-display-flex`
- Flex: `.ion-justify-content-center`, `.ion-align-items-center`

All support responsive suffixes: `.ion-text-md-center` (768px+).

### Theming

**Color System** — 9 default colors: `primary`, `secondary`, `tertiary`, `success`, `warning`, `danger`, `light`, `medium`, `dark`.

Each color has 6 CSS custom properties:
```css
:root {
  --ion-color-primary: #3880ff;
  --ion-color-primary-rgb: 56, 128, 255;
  --ion-color-primary-contrast: #ffffff;
  --ion-color-primary-contrast-rgb: 255, 255, 255;
  --ion-color-primary-shade: #3171e0;
  --ion-color-primary-tint: #4c8dff;
}
```

**Custom color class:**
```css
:root {
  --ion-color-favorite: #69bb7b;
  /* ... all 6 vars ... */
}
.ion-color-favorite {
  --ion-color-base: var(--ion-color-favorite);
  /* ... bind all 6 vars ... */
}
```

**Global CSS Variables:**
```css
--ion-background-color
--ion-text-color
--ion-font-family
--ion-safe-area-top/right/bottom/left
--ion-margin
--ion-padding
```

**Dark Mode — 3 Approaches:**
1. **System preference (default):** `@import '@ionic/<framework>/css/palettes/dark.system.css'`
2. **Always dark:** `@import '@ionic/<framework>/css/palettes/dark.always.css'`
3. **CSS class toggle:** `@import '@ionic/<framework>/css/palettes/dark.class.css'` + add `.ion-palette-dark` to `<html>` + `<meta name="color-scheme" content="light dark" />`

**Platform Styles:**
```css
.ios ion-toolbar { --background: #f8f8f8; }
.md ion-toolbar { --background: #ffffff; }
```
Preview mode in browser: `?ionic:mode=ios` or `?ionic:mode=md`.

### Utilities

**Animations** (`createAnimation` from `@ionic/core` / framework package):
```typescript
import { createAnimation } from '@ionic/core'; // or @ionic/react, @ionic/vue

const animation = createAnimation()
  .addElement(el)
  .duration(300)
  .easing('ease-in-out')
  .fromTo('opacity', '0', '1')
  .play();
```

**Gestures** (`createGesture`):
```typescript
import { createGesture } from '@ionic/core'; // or framework package

const gesture = createGesture({
  el, gestureName: 'swipe', threshold: 15,
  direction: 'x',
  onStart: (detail) => { /* detail.startX, deltaX, velocityX */ },
  onMove: (detail) => {},
  onEnd: (detail) => {},
});
gesture.enable(true);
```

**Hardware Back Button (Android):**
- Priority 100: Overlays
- Priority 99: Menu
- Priority 0: Navigation
- Install `@capacitor/app` for Capacitor apps.

---

## 3. ionic-react — React Integration

**Purpose:** React-specific Ionic patterns: `setupIonicReact`, `IonReactRouter`, lifecycle hooks, overlay hooks, state management.

### Project Structure
```
android/ ios/ public/ src/
  components/   # Reusable UI
  hooks/        # Custom React hooks
  pages/        # One per route
  services/     # API + native calls
  context/      # React context providers
  theme/variables.css
  App.tsx       # Root with IonReactRouter
  main.tsx      # Entry point with setupIonicReact()
capacitor.config.ts
ionic.config.json
vite.config.ts
```

### App Initialization
```typescript
// src/main.tsx
import { setupIonicReact } from '@ionic/react';

setupIonicReact({
  mode: 'ios',          // 'ios' | 'md'
  rippleEffect: false,
  animated: true,
});
```
> Must be called **before** `ReactDOM.createRoot()`.

### Routing
- Use **`IonReactRouter`** instead of `BrowserRouter`.
- Use **`IonRouterOutlet`** to contain routes.
- Pass `component` prop to `Route` — do **not** use `render` or `children` inside `IonRouterOutlet`.
- Use **`useIonRouter`** for programmatic navigation with Ionic animations.

### Lifecycle Hooks (React)
| Hook | Use For |
|------|---------|
| `useIonViewWillEnter` | Refresh data before page visible |
| `useIonViewDidEnter` | Start animations, focus inputs |
| `useIonViewWillLeave` | Pause media, save draft |
| `useIonViewDidLeave` | Cleanup after fully hidden |

> Requirements: Component renders `IonPage` as root AND is the `component` of a `Route` inside `IonRouterOutlet`.

### Overlay Hooks
`useIonAlert`, `useIonToast`, `useIonActionSheet`, `useIonLoading`, `useIonModal`, `useIonPopover`, `useIonPicker`.

### Component Patterns
1. **Every page must render `IonPage` as root.**
2. Use `onIonInput` for text inputs; `onIonChange` for select, toggle, checkbox, range.
3. Access values via `e.detail.value` (or `e.detail.checked`).
4. Inline overlays with `isOpen` for simpler state; overlay hooks for imperative usage.

### State Management
- Place providers **outside** `IonReactRouter`.
- Page caching means state persists across navigations — use `useIonViewWillEnter` to refresh stale data.

### Build & Run
```bash
npm run build
npx cap sync
npx cap run android
npx cap run ios

# Dev with live reload
ionic serve

# Native live reload
ionic cap run android --livereload --external
ionic cap run ios --livereload --external
```

---

## 4. ionic-angular — Angular Integration

**Purpose:** Angular-specific patterns: standalone vs NgModule, `NavController`, lazy loading, reactive forms, lifecycle, testing.

### Architecture Detection
Check `src/main.ts` for:
- `bootstrapApplication` → **Standalone**
- `platformBrowserDynamic().bootstrapModule` → **NgModule**

### Standalone vs NgModule

| Aspect | Standalone | NgModule |
|--------|------------|----------|
| Bootstrap | `bootstrapApplication` in `main.ts` | `platformBrowserDynamic().bootstrapModule` |
| Ionic setup | `provideIonicAngular({})` in `app.config.ts` | `IonicModule.forRoot()` in `app.module.ts` |
| Component imports | Each from `@ionic/angular/standalone` | `IonicModule` provides all globally |
| Import source | `@ionic/angular/standalone` | `@ionic/angular` |
| Lazy loading | `loadComponent` in routes | `loadChildren` in routes |
| Icon registration | `addIcons()` from `ionicons` required | Automatic |
| Tree-shaking | Yes | No |

### Navigation
- **Template:** `routerLink` with `routerDirection` for transition animations.
- **Programmatic:** `NavController` (`navigateForward`, `navigateBack`, `navigateRoot`, `back`).
- **Route parameters:** `ActivatedRoute`.
- **Route guards:** Functional guards (`CanActivateFn`) for Angular 15.2+.
- **Modals:** `ModalController` for overlay navigation with data passing.

### Lifecycle (Angular)
| Hook | Fires | Use For |
|------|-------|---------|
| `ngOnInit` | Once (first creation) | One-time setup |
| `ionViewWillEnter` | Every visit | Refresh data |
| `ionViewDidEnter` | After transition | Heavy work |
| `ionViewWillLeave` | Before leaving | Pause subscriptions |
| `ngOnDestroy` | When popped from stack | Final cleanup |

Implement interfaces: `ViewWillEnter`, `ViewDidEnter`, `ViewWillLeave`, `ViewDidLeave` from `@ionic/angular`.

### Forms
- **Reactive forms:** `FormBuilder`, `FormGroup`, `Validators` with Ionic components.
- **Template-driven:** `[(ngModel)]` with `FormsModule`.
- **Validation display:** `errorText` (Ionic 7+) or manual `<ion-note>`.
- **Label placement:** `labelPlacement="floating" | "stacked" | "fixed"`.

### Performance
- Lazy loading: `loadComponent` / `loadChildren`.
- `trackBy` / `@for` track for efficient lists.
- Virtual scrolling: Angular CDK `cdk-virtual-scroll-viewport`.
- `OnPush` change detection.
- Preloading: `PreloadAllModules`.
- Skeleton text: `ion-skeleton-text`.

### Testing
- `TestBed` setup for standalone and NgModule pages.
- `HttpTestingController` for HTTP services.
- `jasmine.createSpyObj` for mocks.
- Mock `NavController` for navigation tests.
- `TestBed.runInInjectionContext` for functional guards.
- E2E: Cypress / Playwright.

---

## 5. ionic-vue — Vue Integration

**Purpose:** Vue 3-specific patterns: `IonicVue` plugin, composables, `IonPage` requirement, lifecycle hooks, platform detection.

### Project Structure
```
android/ ios/ public/ src/
  components/       # Reusable Vue components
  composables/      # Custom composables
  router/index.ts   # Uses @ionic/vue-router
  theme/variables.css
  views/            # Page components
  App.vue           # IonApp + IonRouterOutlet
  main.ts           # IonicVue plugin install
```

### Entry Point
```typescript
// src/main.ts
import { createApp } from 'vue';
import { IonicVue } from '@ionic/vue';
import App from './App.vue';
import router from './router';

/* Ionic CSS */
import '@ionic/vue/css/core.css';
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/float-elements.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';

/* Theme */
import './theme/variables.css';

const app = createApp(App).use(IonicVue).use(router);
router.isReady().then(() => app.mount('#app'));
```

### Root Component
```vue
<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue';
</script>
```

### Component Rules
1. Import all Ionic components from `@ionic/vue`.
2. **Every routed page must use `IonPage` as root.** Without it, transitions and lifecycle hooks break.
3. Access Web Component methods via `$el`: `contentRef.value.$el.scrollToBottom(300)`.
4. Import icons as **SVG references** from `ionicons/icons` — never strings.
5. Use `v-model` on form components.
6. Use **kebab-case** for event names: `@ion-change`, `@ion-infinite`.

### Navigation
- Import `createRouter` from **`@ionic/vue-router`** (not `vue-router`).
- Declarative: `router-link` attribute with `router-direction`, `router-animation`.
- Programmatic: `useIonRouter` composable.
- Lazy load: `component: () => import('@/views/DetailPage.vue')`.
- Tab routing: nested routes with `IonTabs` + `IonRouterOutlet`. Each tab has its own stack.
- **Never cross-route between tabs** — only tab bar buttons switch tabs. Use `IonModal` for shared views.

### Composables & Utilities

| Function | Purpose |
|----------|---------|
| `useIonRouter()` | Programmatic navigation with transitions |
| `useBackButton(priority, handler)` | Android hardware back button |
| `useKeyboard()` | Reactive keyboard visibility + height |
| `onIonViewWillEnter(cb)` | Page about to show |
| `onIonViewDidEnter(cb)` | Page fully visible |
| `onIonViewWillLeave(cb)` | Page about to hide |
| `onIonViewDidLeave(cb)` | Page fully hidden |
| `isPlatform(name)` | Check platform (`ios`, `android`, `hybrid`, etc.) |
| `getPlatforms()` | Array of matching platform identifiers |

### Platform Detection
```vue
<script setup lang="ts">
import { isPlatform } from '@ionic/vue';
const isIOS = isPlatform('ios');
const isNative = isPlatform('hybrid');
</script>
```
Supported: `android`, `capacitor`, `cordova`, `desktop`, `electron`, `hybrid`, `ios`, `ipad`, `iphone`, `mobile`, `mobileweb`, `phablet`, `pwa`, `tablet`.

---

## 6. ionic-design — UI Components & Theming

**Purpose:** Component usage examples, theming patterns, platform-specific styling, mobile UI best practices.

### Page Structure (React example)
```tsx
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton } from '@ionic/react';

function MyPage() {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/home" />
          </IonButtons>
          <IonTitle>Page Title</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Page Title</IonTitle>
          </IonToolbar>
        </IonHeader>
        <div className="ion-padding">Your content here</div>
      </IonContent>
    </IonPage>
  );
}
```

### Lists
```tsx
<IonList>
  <IonItem detail button>
    <IonLabel><h2>Title</h2><p>Description</p></IonLabel>
    <IonNote slot="end">Note</IonNote>
  </IonItem>
  <IonItemSliding>
    <IonItem><IonLabel>Swipe me</IonLabel></IonItem>
    <IonItemOptions side="end">
      <IonItemOption color="danger"><IonIcon slot="icon-only" icon={trash} /></IonItemOption>
    </IonItemOptions>
  </IonItemSliding>
</IonList>
```

### Forms
```tsx
<IonItem>
  <IonInput label="Email" labelPlacement="floating" type="email" placeholder="Enter email" />
</IonItem>
<IonItem>
  <IonSelect label="Country" placeholder="Select">
    <IonSelectOption value="us">United States</IonSelectOption>
  </IonSelect>
</IonItem>
<IonItem><IonToggle>Enable notifications</IonToggle></IonItem>
<IonButton expand="block" type="submit">Submit</IonButton>
```

### Buttons
```tsx
<IonButton fill="outline">Outline</IonButton>
<IonButton color="danger">Danger</IonButton>
<IonButton size="large">Large</IonButton>
<IonButton expand="block">Block</IonButton>
<IonButton><IonIcon slot="start" icon={heart} />Like</IonButton>
```

### Modals & Sheets
```tsx
{/* Full modal */}
<IonModal isOpen={isOpen} onDidDismiss={() => setIsOpen(false)}>
  <IonHeader>...</IonHeader>
  <IonContent>...</IonContent>
</IonModal>

{/* Bottom sheet */}
<IonModal trigger="open-sheet" initialBreakpoint={0.5} breakpoints={[0, 0.25, 0.5, 0.75, 1]}>
  <IonContent>...</IonContent>
</IonModal>
```

### Tab Navigation
```tsx
<IonTabs>
  <IonRouterOutlet>
    <Route exact path="/tabs/home" component={HomePage} />
    <Route exact path="/tabs/search" component={SearchPage} />
    <Route exact path="/tabs"><Redirect to="/tabs/home" /></Route>
  </IonRouterOutlet>
  <IonTabBar slot="bottom">
    <IonTabButton tab="home" href="/tabs/home">
      <IonIcon icon={home} /><IonLabel>Home</IonLabel>
    </IonTabButton>
  </IonTabBar>
</IonTabs>
```

### Theming Variables
```css
:root {
  --ion-color-primary: #3880ff;
  --ion-color-primary-rgb: 56, 128, 255;
  --ion-color-primary-contrast: #ffffff;
  --ion-color-primary-shade: #3171e0;
  --ion-color-primary-tint: #4c8dff;
}

@media (prefers-color-scheme: dark) {
  :root {
    --ion-background-color: #121212;
    --ion-text-color: #ffffff;
  }
}

.ios { --ion-toolbar-background: #f8f8f8; }
.md { --ion-toolbar-background: #ffffff; }
```

### Platform-Specific Code
```typescript
import { isPlatform } from '@ionic/react'; // or @ionic/vue, @ionic/angular

if (isPlatform('ios')) { /* iOS-specific */ }
if (isPlatform('android')) { /* Android-specific */ }
if (isPlatform('hybrid')) { /* Native app */ }
if (isPlatform('mobileweb')) { /* Mobile browser */ }
```

### Best Practices
- Use `IonVirtualScroll` for long lists.
- `IonImg` automatically lazy-loads images.
- Always provide `aria-label` on icon-only buttons.
- Use `role="link"` on clickable items for accessibility.
- `IonContent` respects safe areas by default; custom handling uses `env(safe-area-inset-top)`.

---

## 7. ionic-expert — Comprehensive Reference

**Purpose:** Master reference covering all framework bindings, navigation patterns, upgrading, Capacitor workflow, and Capawesome Cloud.

### Creating a New App
```bash
npm install -g @ionic/cli
ionic start <name> <template> --type=<framework> --capacitor --package-id=<id>
```

### Component Quick Reference

**Form components** share: `label`, `labelPlacement` (`floating`, `stacked`, `fixed`, `start`), `fill` (`outline`, `solid`), `errorText`, `helperText`, `disabled`, `value`, `placeholder`.

**Key events:**
- `ionInput` — each keystroke (for `ion-input`, `ion-textarea`)
- `ionChange` — value committed (for `ion-select`, `ion-toggle`, `ion-checkbox`, `ion-range`)

**Overlay components** (`ion-modal`, `ion-alert`, `ion-toast`, etc.) share:
- `isOpen` (declarative control), `trigger` (button ID), `backdropDismiss`, `animated`
- Lifecycle events: `didPresent`, `didDismiss`, `willPresent`, `willDismiss`

**Sheet modal:**
```html
<ion-modal [isOpen]="isOpen" [breakpoints]="[0, 0.5, 1]" [initialBreakpoint]="0.5" [handle]="true">
  <ion-content>Sheet content</ion-content>
</ion-modal>
```

### Framework Bindings Summary

| Concern | Angular | React | Vue |
|---------|---------|-------|-----|
| Setup | `provideIonicAngular({})` / `IonicModule.forRoot()` | `setupIonicReact()` before render | `createApp(App).use(IonicVue)` |
| Router | `NavController`, `routerLink` | `IonReactRouter`, `useIonRouter` | `@ionic/vue-router`, `useIonRouter` |
| Page root | `<ion-app><ion-router-outlet></ion-app>` | `IonPage` as root | `IonPage` as root |
| Lifecycle | `ViewWillEnter` interface | `useIonViewWillEnter` | `onIonViewWillEnter` |
| Overlay | `ModalController`, `ToastController` | `useIonModal`, `useIonToast` | `useIonModal`, `useIonToast` |
| Form events | `(ionInput)`, `(ionChange)` | `onIonInput`, `onIonChange` | `@ion-input`, `@ion-change` |
| Icons (standalone) | `addIcons()` + import `IonIcon` | Import SVG from `ionicons/icons` | Import SVG from `ionicons/icons` |

### Navigation Patterns

**Tab Navigation Rules:**
- `tab` attribute on `ion-tab-button` must match child route path.
- Never navigate between tabs programmatically — only tab bar buttons switch tabs.
- For shared views across tabs, use `ion-modal` instead of cross-tab routing.

**Side Menu:**
- `ion-menu` `contentId` must match `id` on `ion-router-outlet`.
- Wrap menu items in `ion-menu-toggle` to auto-close after selection.
- Use `routerDirection="root"` for top-level menu navigation.

**Linear vs. Non-Linear Routing:**
- **Linear:** Sequential forward/back (list → detail → edit). Back button returns to previous page.
- **Non-linear:** Multiple independent stacks (tabs). Back navigation stays within current tab's stack.

### Capacitor Integration
```bash
npm run build
npx cap sync
npx cap run android
npx cap run ios

# Live reload on device
ionic cap run android --livereload --external
ionic cap run ios --livereload --external
```

### Capawesome Cloud
- **Live Updates** — OTA updates without app store review.
- **Native Builds** — Cloud iOS/Android builds without local Xcode/Android Studio.
- **App Store Publishing** — Automated Apple App Store / Google Play submissions.

### Common Troubleshooting
- `ionic: command not found` → `npm install -g @ionic/cli`
- Components not rendering → Verify Ionic CSS imports; for Angular standalone, verify per-component imports from `@ionic/angular/standalone`.
- `ionViewWillEnter` not firing → Must be directly routed via `ion-router-outlet`; child components don't receive it. React/Vue: verify `IonPage` is root.
- Page data stale on back nav → Use Ionic lifecycle hooks instead of `ngOnInit`/`useEffect`/`onMounted`.
- Transitions not animating → Use Ionic router integration (`NavController`, `IonReactRouter`, `@ionic/vue-router`).
- CSS custom properties not applying → Use documented CSS vars (`--background`, `--color`); don't target Shadow DOM internals.
- Icons not showing (Angular standalone) → `addIcons()` from `ionicons` + import `IonIcon`.
- `Failed to resolve component: ion-*` (Vue) → Missing import from `@ionic/vue`.
- Form input not updating (React) → Use `onIonInput` for `IonInput`/`IonTextarea`; access `e.detail.value`.
- Slot deprecation warning (Vue) → Disable ESLint rule: `'vue/no-deprecated-slot-attribute': 'off'`.

---

## Example Marketplace Relevance

> **⚠️ Example Marketplace does NOT use Ionic Framework.**
>
> Example Marketplace is a React-based web application deployed on Base44. Its frontend stack is React + Vite + Tailwind CSS + shadcn/ui components. It does **not** use Ionic UI components, Ionic CLI, `IonReactRouter`, `setupIonicReact()`, Capacitor, or any Ionic-specific lifecycle hooks.
>
> This file is maintained as **domain knowledge** for the Capacitor ecosystem only. If Example Marketplace ever adds a native mobile app layer, this reference provides the scaffolding, component library, and framework binding patterns that would be needed. Until then, **do not apply Ionic patterns to Example Marketplace's web codebase.**

### Potential Future Relevance
- If Example Marketplace builds a **companion native mobile app**, Ionic + Capacitor would be a candidate stack for cross-platform deployment.
- Ionic's **design system** (platform-adaptive iOS/Android styling) could inform mobile-responsive UI decisions in the web app.
- The **Capawesome Cloud** live updates / CI/CD model is relevant to any Capacitor-based mobile strategy.

---

## Cross-References

| Skill | Role |
|-------|------|
| `capacitor-app-creation` | Continue after `ionic start --capacitor` (add platforms, live updates, CI/CD) |
| `capacitor-app-development` | General Capacitor development (native APIs, plugins) |
| `capacitor-plugins` | Install/configure Capacitor plugins |
| `capacitor-react` | Capacitor React patterns without Ionic Framework |
| `capacitor-angular` | Capacitor Angular patterns (plugins, NgZone, deep links) |
| `capacitor-vue` | Capacitor Vue patterns without Ionic Framework |
| `capawesome-cloud` | Live updates, native builds, app store publishing |
| `ionic-app-upgrades` | Upgrade Ionic across major versions (must go sequentially) |

### External Resources
- Ionic Documentation: https://ionicframework.com/docs
- Ionic Components: https://ionicframework.com/docs/components
- Ionicons: https://ionic.io/ionicons
- Color Generator: https://ionicframework.com/docs/theming/color-generator
- Capawesome Cloud: https://cloud.capawesome.io

---

*Consolidated from 7 Capacitor ecosystem skills. Last updated: 2026-04-26.*
