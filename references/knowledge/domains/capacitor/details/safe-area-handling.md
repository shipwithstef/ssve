# Safe Area Handling in Capacitor

## Mechanism

Safe areas are screen regions not obscured by hardware features:
- **iPhone**: Notch, Dynamic Island, home indicator, rounded corners
- **Android**: Camera cutouts, navigation gestures, display cutouts

CSS environment variables expose inset values:

| Inset | Description |
|-------|-------------|
| `safe-area-inset-top` | Notch/Dynamic Island/status bar |
| `safe-area-inset-bottom` | Home indicator/navigation bar |
| `safe-area-inset-left` | Left edge (landscape) |
| `safe-area-inset-right` | Right edge (landscape) |

## Procedures

### CSS Solution

**Enable Viewport Coverage**

```html
<!-- index.html -->
<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0, viewport-fit=cover"
/>
```

**Important**: `viewport-fit=cover` is required to access safe area insets.

**Using CSS Environment Variables**

```css
/* Basic usage */
.header {
  padding-top: env(safe-area-inset-top);
}

.footer {
  padding-bottom: env(safe-area-inset-bottom);
}

/* With fallback */
.header {
  padding-top: env(safe-area-inset-top, 20px);
}

/* Combined with other padding */
.content {
  padding-top: calc(env(safe-area-inset-top) + 16px);
  padding-bottom: calc(env(safe-area-inset-bottom) + 16px);
}
```

**Full Page Layout**

```css
/* App container */
.app {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
}

/* Header respects notch */
.header {
  padding-top: env(safe-area-inset-top);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  background: #fff;
}

/* Scrollable content */
.content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

/* Footer respects home indicator */
.footer {
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  background: #fff;
}
```

**Tab Bar with Safe Area**

```css
.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background: #fff;
  border-top: 1px solid #eee;
  padding-bottom: env(safe-area-inset-bottom);
}

.tab-bar-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  min-height: 49px; /* iOS standard height */
}
```

**Full-Bleed Background with Safe Content**

```css
.hero {
  /* Background extends to edges */
  background: linear-gradient(to bottom, #4f46e5, #7c3aed);
  padding-top: calc(env(safe-area-inset-top) + 20px);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

.hero-content {
  /* Content stays in safe area */
  max-width: 100%;
}
```

### JavaScript Solution

**Reading Safe Area Values**

```typescript
function getSafeAreaInsets() {
  const computedStyle = getComputedStyle(document.documentElement);

  return {
    top: parseInt(computedStyle.getPropertyValue('--sat') || '0'),
    bottom: parseInt(computedStyle.getPropertyValue('--sab') || '0'),
    left: parseInt(computedStyle.getPropertyValue('--sal') || '0'),
    right: parseInt(computedStyle.getPropertyValue('--sar') || '0'),
  };
}

// Set CSS custom properties
function setSafeAreaProperties() {
  const style = document.documentElement.style;

  const temp = document.createElement('div');
  temp.style.paddingTop = 'env(safe-area-inset-top)';
  temp.style.paddingBottom = 'env(safe-area-inset-bottom)';
  temp.style.paddingLeft = 'env(safe-area-inset-left)';
  temp.style.paddingRight = 'env(safe-area-inset-right)';
  document.body.appendChild(temp);

  const computed = getComputedStyle(temp);
  style.setProperty('--sat', computed.paddingTop);
  style.setProperty('--sab', computed.paddingBottom);
  style.setProperty('--sal', computed.paddingLeft);
  style.setProperty('--sar', computed.paddingRight);

  document.body.removeChild(temp);
}

// Update on orientation change
window.addEventListener('orientationchange', () => {
  setTimeout(setSafeAreaProperties, 100);
});
```

**React Hook**

```typescript
import { useState, useEffect } from 'react';

interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

function useSafeArea(): SafeAreaInsets {
  const [insets, setInsets] = useState<SafeAreaInsets>({
    top: 0, bottom: 0, left: 0, right: 0,
  });

  useEffect(() => {
    function updateInsets() {
      const temp = document.createElement('div');
      temp.style.cssText = `
        position: fixed;
        top: 0;
        padding-top: env(safe-area-inset-top);
        padding-bottom: env(safe-area-inset-bottom);
        padding-left: env(safe-area-inset-left);
        padding-right: env(safe-area-inset-right);
      `;
      document.body.appendChild(temp);

      const computed = getComputedStyle(temp);
      setInsets({
        top: parseFloat(computed.paddingTop) || 0,
        bottom: parseFloat(computed.paddingBottom) || 0,
        left: parseFloat(computed.paddingLeft) || 0,
        right: parseFloat(computed.paddingRight) || 0,
      });

      document.body.removeChild(temp);
    }

    updateInsets();
    window.addEventListener('resize', updateInsets);
    window.addEventListener('orientationchange', () => {
      setTimeout(updateInsets, 100);
    });

    return () => {
      window.removeEventListener('resize', updateInsets);
    };
  }, []);

  return insets;
}

// Usage
function Header() {
  const { top } = useSafeArea();
  return (
    <header style={{ paddingTop: top }}>
      App Header
    </header>
  );
}
```

### Native iOS Configuration

**Status Bar Style**

```typescript
// capacitor.config.ts
const config: CapacitorConfig = {
  ios: {
    contentInset: 'automatic', // or 'always', 'scrollableAxes', 'never'
  },
};
```

**Extend Behind Safe Areas (AppDelegate.swift)**

```swift
import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        if let window = UIApplication.shared.windows.first {
            window.backgroundColor = .clear
        }
        return true
    }
}
```

**Info.plist Settings**

```xml
<!-- ios/App/App/Info.plist -->
<key>UIViewControllerBasedStatusBarAppearance</key>
<true/>

<!-- For landscape support -->
<key>UISupportedInterfaceOrientations</key>
<array>
    <string>UIInterfaceOrientationPortrait</string>
    <string>UIInterfaceOrientationLandscapeLeft</string>
    <string>UIInterfaceOrientationLandscapeRight</string>
</array>
```

### Native Android Configuration

**Display Cutout Mode**

```xml
<!-- android/app/src/main/res/values-v28/styles.xml -->
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.NoActionBar">
        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>
    </style>
</resources>
```

**Edge-to-Edge Display (MainActivity.kt)**

```kotlin
import android.os.Build
import android.view.View

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            )
        }
    }
}
```

**AndroidManifest.xml**

```xml
<activity
    android:name=".MainActivity"
    android:theme="@style/AppTheme"
    android:windowSoftInputMode="adjustResize"
    android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode">
</activity>
```

### Capacitor Status Bar Plugin

```bash
npm install @capacitor/status-bar
npx cap sync
```

```typescript
import { StatusBar, Style } from '@capacitor/status-bar';

await StatusBar.setStyle({ style: Style.Dark });
await StatusBar.setBackgroundColor({ color: '#ffffff' });
await StatusBar.hide();
await StatusBar.show();
await StatusBar.setOverlaysWebView({ overlay: true });
```

### Testing Safe Areas

**iOS Simulator**
1. Use iPhone with notch (iPhone 14 Pro, etc.)
2. Test both portrait and landscape
3. Test with keyboard visible

**Android Emulator**
1. Create emulator with camera cutout
2. Test navigation gesture mode
3. Test 3-button navigation mode

**Debug Mode — Visualize Safe Areas**

```css
.debug-safe-areas::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: env(safe-area-inset-top);
  background: rgba(255, 0, 0, 0.3);
  z-index: 9999;
  pointer-events: none;
}

.debug-safe-areas::after {
  content: '';
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: env(safe-area-inset-bottom);
  background: rgba(0, 0, 255, 0.3);
  z-index: 9999;
  pointer-events: none;
}
```

## Error Handling

| Issue | Solution |
|-------|----------|
| Content behind notch | Add `viewport-fit=cover` and `padding-top: env(safe-area-inset-top)` |
| Tab bar under home indicator | Add `padding-bottom: env(safe-area-inset-bottom)` |
| Landscape layout broken | Handle left/right insets with `env(safe-area-inset-left)` and `env(safe-area-inset-right)` |
| Keyboard pushes content | Use `adjustResize` and handle insets dynamically via Keyboard plugin |
| Safe areas not working in WebView | Ensure `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">` is present |

**Keyboard Handling**

```typescript
import { Keyboard } from '@capacitor/keyboard';

Keyboard.addListener('keyboardWillShow', (info) => {
  document.body.style.paddingBottom = `${info.keyboardHeight}px`;
});

Keyboard.addListener('keyboardWillHide', () => {
  document.body.style.paddingBottom = 'env(safe-area-inset-bottom)';
});
```

## Example Marketplace Relevance

Example Marketplace is a full-screen React app with bottom navigation and top headers. On notched iPhones and gesture-navigation Android devices:

1. **Viewport meta tag**: Ensure `index.html` has `viewport-fit=cover`. The Vite build outputs to `dist/` which Capacitor copies into the WebView — verify the meta tag survives the build.
2. **Bottom nav**: Apply `padding-bottom: env(safe-area-inset-bottom)` to the bottom navigation bar so it sits above the home indicator.
3. **Top header**: Apply `padding-top: env(safe-area-inset-top)` to the app header so it doesn't slide under the Dynamic Island.
4. **Landscape mode**: If the app supports landscape (e.g., photo upload preview), handle left/right insets so content isn't hidden by rounded corners.
5. **Keyboard input**: The check-in comment field and login forms should use `@capacitor/keyboard` with `adjustResize` to prevent the keyboard from covering the submit button.
6. **React integration**: Wrap the `useSafeArea` hook in a context provider so any component (modals, sheets, toasts) can read current insets without duplicating DOM measurement logic.
