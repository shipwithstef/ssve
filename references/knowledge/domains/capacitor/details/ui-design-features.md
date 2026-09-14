# Capacitor UI Design & Features

> **Group:** UI/UX + Monetization for Capacitor Mobile Apps
> **Sources:** 6 skill files (7 total files read; in-app purchases split into capawesome source)
> **Updated:** 2026-04-26

---

## 1. Tailwind CSS for Capacitor (`tailwind-capacitor`)

**Source:** capgo/skills/tailwind-capacitor
**Scope:** Mobile-first Tailwind styling, safe areas, touch targets, dark mode, performance.

### Key Procedures

| Step | Action | Command / Config |
|------|--------|------------------|
| Install | Add Tailwind + PostCSS + Autoprefixer | `npm install -D tailwindcss postcss autoprefixer && npx tailwindcss init -p` |
| Configure | Extend `tailwind.config.js` for mobile | Add safe-area insets, touch targets, dark mode |
| Import | Base CSS with mobile resets | `@tailwind base; @tailwind components; @tailwind utilities;` |
| Build | Only used utilities via `content` array | Keep `safelist` minimal |

### Configuration Pattern

```javascript
// tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      minHeight: { 'touch': '44px' },
      minWidth:  { 'touch': '44px' },
    },
  },
  darkMode: 'class', // or 'media'
};
```

### Mobile Base CSS

```css
@layer base {
  html {
    -webkit-text-size-adjust: 100%;
    scroll-behavior: smooth;
    overscroll-behavior: none;
  }
  body {
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
    position: fixed;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  input, textarea {
    -webkit-user-select: text;
    user-select: text;
  }
}
```

### Code Examples

**Header with safe area + blur**
```tsx
<header className="fixed top-0 left-0 right-0 pt-safe-t bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b z-50">
  <div className="h-14 px-4 flex items-center"><h1 className="font-semibold">Title</h1></div>
</header>
```

**Bottom sheet with safe area**
```tsx
<div className={`fixed left-0 right-0 bottom-0 bg-white dark:bg-gray-900 rounded-t-2xl pb-safe-b transition-transform duration-300 ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}>
  <div className="flex justify-center py-2"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>
  {children}
</div>
```

**Touch-friendly button**
```tsx
<button className="min-h-[44px] min-w-[44px] px-4 py-3 flex items-center justify-center active:bg-gray-100 rounded-lg">
  Tap Me
</button>
```

**Dark mode toggle with Capacitor Preferences**
```typescript
import { Preferences } from '@capacitor/preferences';

type Theme = 'light' | 'dark' | 'system';

async function setTheme(theme: Theme) {
  await Preferences.set({ key: 'theme', value: theme });
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && prefersDark));
}
```

**Disable hover on touch**
```javascript
// tailwind.config.js
module.exports = {
  future: { hoverOnlyWhenSupported: true },
};
```

**GPU-accelerated animation**
```tsx
<div className="transform transition-transform duration-200 hover:scale-105 will-change-transform">
```

---

## 2. Konsta UI (`konsta-ui`)

**Source:** capgo/skills/konsta-ui
**Scope:** Native-looking iOS/Material Design components without Ionic. React/Vue/Svelte. ~30KB gzipped.

### Key Procedures

| Step | Action | Command |
|------|--------|---------|
| Install | Add Konsta + Tailwind | `npm install konsta && npm install -D tailwindcss postcss autoprefixer` |
| Configure | Use Konsta config wrapper | `const konstaConfig = require('konsta/config');` |
| Setup | Wrap app in `<App theme="...">` | `<App theme="ios">` or `<App theme="material">` |

### Configuration Pattern

```javascript
// tailwind.config.js
const konstaConfig = require('konsta/config');

module.exports = konstaConfig({
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  konpistaConfig: { colors: { primary: '#6366f1' } }, // override Konsta primary
});
```

### Code Examples

**App wrapper with safe areas**
```tsx
import { App, Page, Navbar, Block } from 'konsta/react';

<App theme="ios" safeAreas>
  <Page>
    <Navbar title="My App" left={<NavbarBackLink onClick={() => history.back()} />} />
    <Block strong inset><p>Hello Konsta UI!</p></Block>
  </Page>
</App>
```

**Platform-aware theme**
```tsx
import { Capacitor } from '@capacitor/core';

<App
  theme={Capacitor.getPlatform() === 'ios' ? 'ios' : 'material'}
  safeAreas={Capacitor.isNativePlatform()}
>
```

**Form inputs**
```tsx
import { List, ListInput, ListButton } from 'konsta/react';

<List strongIos insetIos>
  <ListInput label="Email" type="email" placeholder="Enter email" clearButton />
  <ListInput label="Password" type="password" placeholder="Enter password" />
  <ListButton>Login</ListButton>
</List>
```

**Dialog / Sheet / Popup**
```tsx
import { Dialog, DialogButton, Sheet, Popup, Button, Page, Navbar, Block } from 'konsta/react';

<Dialog opened={dialogOpen} onBackdropClick={() => setDialogOpen(false)}
  title="Dialog Title" content="Content..."
  buttons={<><DialogButton onClick={() => setDialogOpen(false)}>Cancel</DialogButton>
           <DialogButton strong onClick={() => setDialogOpen(false)}>OK</DialogButton></>} />

<Sheet opened={sheetOpen} onBackdropClick={() => setSheetOpen(false)}>
  <div className="p-4"><h2 className="font-bold text-lg mb-4">Sheet Title</h2></div>
</Sheet>
```

**Tabbar navigation**
```tsx
import { Tabbar, TabbarLink, Icon } from 'konsta/react';

<Tabbar labels className="left-0 bottom-0 fixed">
  <TabbarLink active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Home />} label="Home" />
  <TabbarLink active={activeTab === 'search'} onClick={() => setActiveTab('search')} icon={<Search />} label="Search" />
</Tabbar>
```

**Custom component colors**
```tsx
<Button colors={{ fillBg: 'bg-indigo-500', fillActiveBg: 'bg-indigo-600', fillText: 'text-white' }}>
  Custom Button
</Button>
<Toggle colors={{ bgChecked: 'bg-green-500' }} />
```

---

## 3. Splash Screen (`capacitor-splash-screen`)

**Source:** capgo/skills/capacitor-splash-screen
**Scope:** Launch screen assets, animation, programmatic control, dark mode.

### Key Procedures

| Step | Action | Command |
|------|--------|---------|
| Install | Splash screen plugin | `npm install @capacitor/splash-screen && npx cap sync` |
| Generate assets | Capacitor Assets tool | `npm install -D @capacitor/assets && npx capacitor-assets generate` |
| Configure | `capacitor.config.ts` | Set `launchShowDuration`, `backgroundColor`, `androidScaleType` |
| Control | Programmatic hide/show | `SplashScreen.hide()` / `SplashScreen.show()` |

### Configuration Pattern

```typescript
// capacitor.config.ts
const config: CapacitorConfig = {
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};
```

### Code Examples

**Hide after app ready**
```typescript
import { SplashScreen } from '@capacitor/splash-screen';

async function initApp() {
  await loadUserData();
  await SplashScreen.hide({ fadeOutDuration: 500 });
}
```

**Show + animated Lottie**
```typescript
async function showAnimatedSplash() {
  await SplashScreen.show({ autoHide: false });
  const lottie = await import('lottie-web');
  const anim = lottie.loadAnimation({
    container: document.getElementById('splash-animation'),
    path: '/animations/splash.json',
    loop: false,
  });
  anim.addEventListener('complete', async () => {
    await SplashScreen.hide({ fadeOutDuration: 0 });
    document.getElementById('splash-animation').style.display = 'none';
  });
}
```

**Android 11+ splash theme**
```xml
<!-- android/app/src/main/res/values/styles.xml -->
<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
    <item name="windowSplashScreenBackground">@color/splash_background</item>
    <item name="windowSplashScreenAnimatedIcon">@drawable/splash</item>
    <item name="windowSplashScreenAnimationDuration">1000</item>
    <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
</style>
```

---

## 4. Keyboard Handling (`capacitor-keyboard`)

**Source:** capgo/skills/capacitor-keyboard
**Scope:** Keyboard visibility, resize modes, accessory bar, input focus, scroll behavior.

### Key Procedures

| Step | Action | Command |
|------|--------|---------|
| Install | Keyboard plugin | `npm install @capacitor/keyboard && npx cap sync` |
| Configure | Resize mode in config | `resize: 'body' \| 'ionic' \| 'native' \| 'none'` |
| Listen | Height events | `keyboardWillShow` / `keyboardWillHide` |
| Prevent zoom | iOS input font-size | `font-size: 16px` minimum |

### Configuration Pattern

```typescript
// capacitor.config.ts
plugins: {
  Keyboard: {
    resize: 'body',
    style: 'dark',
    resizeOnFullScreen: true,
  },
},
```

### Code Examples

**CSS custom property for keyboard height**
```typescript
import { Keyboard } from '@capacitor/keyboard';

Keyboard.addListener('keyboardWillShow', (info) => {
  document.body.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
});
Keyboard.addListener('keyboardWillHide', () => {
  document.body.style.setProperty('--keyboard-height', '0px');
});
```

```css
.chat-input {
  position: fixed;
  bottom: calc(var(--keyboard-height, 0px) + env(safe-area-inset-bottom));
  left: 0;
  right: 0;
}
```

**Scroll active input into view**
```typescript
Keyboard.addListener('keyboardWillShow', async (info) => {
  const active = document.activeElement as HTMLElement;
  if (active) {
    await new Promise(r => setTimeout(r, 100));
    active.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});
```

**iOS accessory bar**
```typescript
await Keyboard.setAccessoryBarVisible({ isVisible: true });
```

**Form submission + hide keyboard**
```typescript
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  await Keyboard.hide();
  // process form
});
```

---

## 5. Accessibility (`capacitor-accessibility`)

**Source:** capgo/skills/capacitor-accessibility
**Scope:** Screen readers, semantic HTML, focus management, WCAG 2.1 compliance.

### Key Procedures

| Step | Action | Detail |
|------|--------|--------|
| Checklist | Quick audit | Semantic HTML, alt text, 44x44pt touch targets, 4.5:1 contrast |
| Labels | ARIA on interactive elements | `aria-label`, `aria-describedby`, `aria-invalid` |
| Live regions | Announce dynamic content | `aria-live="polite"` or `aria-live="assertive"` |
| Focus | Trap in modals | Query focusable elements; wrap Tab key |

### Code Examples

**Accessible button + input**
```tsx
<button aria-label="Delete item" aria-describedby="delete-hint"><TrashIcon /></button>
<span id="delete-hint" className="sr-only">Permanently removes this item</span>

<label htmlFor="email">Email</label>
<input id="email" type="email" aria-required="true" aria-invalid={hasError} aria-describedby={hasError ? "email-error" : undefined} />
{hasError && <span id="email-error">Invalid email</span>}
```

**Live region announcements**
```tsx
<div aria-live="polite" aria-atomic="true">{message}</div>
<div aria-live="assertive" role="alert">{error}</div>
```

**Focus trap for modals**
```typescript
function trapFocus(element: HTMLElement) {
  const focusable = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0] as HTMLElement;
  const last = focusable[focusable.length - 1] as HTMLElement;
  element.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}
```

**Minimum touch target CSS**
```css
button, a, input { min-height: 44px; min-width: 44px; }
.icon-button { padding: 12px; }
```

**Color contrast (don't rely on color alone)**
```css
.error {
  color: #d32f2f;
  border-left: 4px solid #d32f2f;
}
.error::before { content: "⚠ "; }
```

**Testing**
```bash
# iOS: Settings > Accessibility > VoiceOver
# Android: Settings > Accessibility > TalkBack
npx @axe-core/cli https://localhost:3000
```

---

## 6. In-App Purchases (`capacitor-in-app-purchases`)

**Source:** capawesome/skills/capacitor-in-app-purchases
**Scope:** Store configuration, plugin selection, purchase flows, receipt validation, testing.

### Key Procedures

| Step | Action | Detail |
|------|--------|--------|
| 1. Analyze | Auto-detect platforms & Capacitor version | Read `package.json`, check `android/` / `ios/` |
| 2. Store config | App Store Connect / Google Play Console | Create products/subscriptions |
| 3. Choose plugin | Capawesome Purchases vs RevenueCat | Capawesome = lightweight; RevenueCat = managed backend |
| 4. Install | Plugin + platform setup | `npx cap sync` |
| 5. Implement | Fetch products → purchase → finish/entitlement | Adapt to React/Vue/Angular |
| 6. Optional | Sub management, intro offers, server notifications | Per-feature reference files |
| 7. Test | Sandbox / StoreKit / Internal track | See error handling table below |
| 8. Verify | Build & run end-to-end | `npx cap run android` / `npx cap run ios` |

### Plugin Comparison

| Feature | Capawesome Purchases | RevenueCat |
|---------|----------------------|------------|
| Backend dependency | None (self-hosted validation) | RevenueCat cloud |
| Receipt validation | Developer responsibility | Server-side managed |
| Entitlements | Manual | Built-in |
| Analytics | None | Built-in |
| Capacitor requirement | 8+ | 8+ |
| License | Capawesome Insiders | RevenueCat account |

### Code Examples

**Fetch + purchase flow (generic pattern)**
```typescript
// After plugin init (Capawesome or RevenueCat)
const products = await Purchases.getProducts({ productIdentifiers: ['premium_monthly'] });
const product = products.products[0];

// Purchase
const { transaction, productIdentifier } = await Purchases.purchaseProduct({ product });

// Capawesome: finish transaction
await Purchases.finishTransaction({ transaction });

// RevenueCat: check entitlements
const customerInfo = await Purchases.getCustomerInfo();
const isPremium = customerInfo.entitlements.active['premium'] !== undefined;
```

**Restore purchases**
```typescript
// Must be triggered by explicit user action
await Purchases.restorePurchases();
```

**Handle unfinished transactions at startup**
```typescript
// Check and finish any pending transactions on every app launch
const pending = await Purchases.getPendingTransactions?.() ?? [];
for (const tx of pending) {
  await deliverContent(tx);
  await Purchases.finishTransaction({ transaction: tx });
}
```

### Error Handling Quick Reference

| Issue | Root Cause / Fix |
|-------|-----------------|
| Products not appearing (iOS) | Up to hours delay; verify status "Ready to Submit" or "Approved" |
| Products not appearing (Android) | Verify "Active" status; app must be on internal testing track |
| Silent Android purchase fail | App must be installed from Google Play (not direct APK) |
| iOS sandbox loop / fail | Use Sandbox test account (Settings > App Store > Sandbox Account) |
| `purchaseProduct()` error (Android) | Verify `google-services.json`; check `$googlePlayBillingVersion` |
| Receipt validation fail | iOS: verify JWS token; Android: validate token + originalJson + signature |
| Restore shows nothing | iOS: must be user-initiated (shows auth dialog); Android: silent |
| `finishTransaction()` not called | Unfinished transactions block future purchases; check at every launch |
| Plugin not found at runtime | Run `npx cap sync`; verify npm registry for Capawesome |

---

## Example Marketplace Relevance Notes

- **Tailwind-first:** Example Marketplace already uses Tailwind CSS. The `tailwind-capacitor` skill aligns perfectly — no framework switch needed.
- **No Ionic:** Example Marketplace does not use Ionic. Konsta UI is a viable lightweight alternative (~30KB) if native-looking iOS/Material components are desired later. Otherwise, raw Tailwind + custom components is the current path.
- **No iOS yet:** Android-only for now. iOS-specific configs (LaunchScreen.storyboard, VoiceOver, App Store Connect IAP setup) can be deferred.
- **Keyboard handling is critical:** Example Marketplace has forms (check-ins, bookings, login). The 16px font-size rule and `--keyboard-height` CSS variable are immediately applicable to prevent iOS zoom and layout jumps.
- **Splash screen:** Should match Example Marketplace branding (logo + brand colors). Use `@capacitor/assets` to generate Android densities; dark mode splash background should match app dark theme.
- **Accessibility:** Example Marketplace targets cafe owners and employees. Touch targets (44x44), color contrast, and screen reader labels should be enforced in all new components.
- **IAP not immediate:** In-app purchases (premium tiers, subscription models) are a future monetization path. The Capawesome vs RevenueCat decision should be revisited when the pricing model is defined. For now, this serves as a reference.

---

## Cross-References

| Topic | Primary Skill | Related Skills / Notes |
|-------|---------------|------------------------|
| Tailwind + mobile safe areas | `tailwind-capacitor` | Use with `capacitor-keyboard` `--keyboard-height` for full viewport math |
| Native UI without Ionic | `konsta-ui` | Alternative to raw Tailwind; smaller bundle than Ionic (~30KB vs ~200KB) |
| Splash + dark mode | `capacitor-splash-screen` | Match colors to Tailwind dark mode config |
| Keyboard + forms | `capacitor-keyboard` | Combine with `tailwind-capacitor` 16px input rule and safe-area padding |
| Accessibility + touch targets | `capacitor-accessibility` | Tailwind `min-h-touch` / `min-w-touch` utility maps directly |
| Monetization / subscriptions | `capacitor-in-app-purchases` | Requires Capacitor 8+; depends on `capacitor-plugins` for install |

---

## External Resources

- Tailwind CSS Docs: https://tailwindcss.com/docs
- Konsta UI Docs: https://konstaui.com/
- Capacitor Splash Screen API: https://capacitorjs.com/docs/apis/splash-screen
- Capacitor Keyboard API: https://capacitorjs.com/docs/apis/keyboard
- WCAG 2.1 Quickref: https://www.w3.org/WAI/WCAG21/quickref
- Android Splash Screens: https://developer.android.com/develop/ui/views/launch/splash-screen
- Capawesome Purchases: https://capawesome.io/plugins/purchases/
- RevenueCat Capacitor: https://www.revenuecat.com/docs/getting-started/installation/capacitor
