# Keyboard and Input Handling

Extracted from: `capacitor-keyboard` (Capgo)

---

## Installation

```bash
npm install @capacitor/keyboard
npx cap sync
```

---

## Basic Usage

```typescript
import { Keyboard } from '@capacitor/keyboard';

// Show keyboard
await Keyboard.show();

// Hide keyboard
await Keyboard.hide();

// Listen for keyboard events
Keyboard.addListener('keyboardWillShow', (info) => {
  console.log('Keyboard height:', info.keyboardHeight);
});

Keyboard.addListener('keyboardWillHide', () => {
  console.log('Keyboard hiding');
});
```

---

## Configuration

```typescript
// capacitor.config.ts
plugins: {
  Keyboard: {
    resize: 'body',        // 'body' | 'ionic' | 'native' | 'none'
    style: 'dark',         // 'dark' | 'light' | 'default'
    resizeOnFullScreen: true,
  },
},
```

### Resize Modes

| Mode | Description |
|------|-------------|
| `body` | Resize body element |
| `ionic` | Use Ionic's keyboard handling |
| `native` | Native WebView resize |
| `none` | No automatic resize |

---

## Handle Keyboard Height

```typescript
import { Keyboard } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
  Keyboard.addListener('keyboardWillShow', (info) => {
    document.body.style.setProperty(
      '--keyboard-height',
      `${info.keyboardHeight}px`
    );
  });

  Keyboard.addListener('keyboardWillHide', () => {
    document.body.style.setProperty('--keyboard-height', '0px');
  });
}
```

```css
.chat-input {
  position: fixed;
  bottom: calc(var(--keyboard-height, 0px) + env(safe-area-inset-bottom));
  left: 0;
  right: 0;
}
```

---

## Scroll to Input

```typescript
Keyboard.addListener('keyboardWillShow', async (info) => {
  const activeElement = document.activeElement as HTMLElement;

  if (activeElement) {
    await new Promise((r) => setTimeout(r, 100));
    activeElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }
});
```

---

## iOS Accessory Bar

```typescript
// Show/hide the toolbar above keyboard
await Keyboard.setAccessoryBarVisible({ isVisible: true });
```

---

## Form Best Practices

### Prevent Zoom on iOS

```css
/* Use font-size >= 16px to prevent zoom */
input, textarea, select {
  font-size: 16px;
}
```

### Handle Form Submission

```typescript
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  await Keyboard.hide();
  // Process form
});
```

### Move to Next Field on Enter

```typescript
input.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const nextInput = getNextInput();
    if (nextInput) {
      nextInput.focus();
    } else {
      Keyboard.hide();
    }
  }
});
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Content hidden by keyboard | Use `resize` mode or CSS `keyboard-height` |
| Slow keyboard animation | Use `keyboardWillShow` (not `keyboardDidShow`) |
| iOS zoom on input focus | Set `font-size: 16px` on inputs |
| Android content overlap | Set `windowSoftInputMode` in AndroidManifest |
| Keyboard not hiding | Call `Keyboard.hide()` explicitly |

---

## AndroidManifest.xml Configuration

```xml
<activity
  android:name="com.getcapacitor.BridgeActivity"
  android:windowSoftInputMode="adjustResize">
</activity>
```

Modes:
- `adjustResize`: Content resizes when keyboard appears
- `adjustPan`: Content pans up
- `adjustNothing`: No adjustment

---

## Example Marketplace Relevance

- **Current inputs**: Login form, search, filter inputs
- **No chat/messaging**: Keyboard handling is simple
- **iOS zoom prevention**: Already handled via 16px font-size
- **Form UX**: Tab navigation not heavily used
- **Future**: May need keyboard handling for check-in notes/comments
