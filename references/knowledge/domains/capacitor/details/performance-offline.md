# Performance and Offline-First

Extracted from: `capacitor-performance` (Capgo), `capacitor-offline-first` (Capgo)

---

## Performance Quick Wins

### 1. Lazy Load Plugins

```typescript
// BAD - All plugins loaded at startup
import { Camera } from '@capacitor/camera';

// GOOD - Load when needed
async function takePhoto() {
  const { Camera } = await import('@capacitor/camera');
  return Camera.getPhoto({ quality: 90 });
}
```

### 2. Reduce Bundle Size

```bash
# Analyze bundle
npx vite-bundle-visualizer

# Tree-shake imports
import { specific } from 'large-library';   // Good
import * as everything from 'large-library'; // Bad
```

### 3. Optimize Images

```typescript
const photo = await Camera.getPhoto({
  quality: 80,        // Not 100
  width: 1024,        // Limit size
  resultType: CameraResultType.Uri,  // Not Base64
});
```

### 4. Minimize Bridge Calls

```typescript
// BAD - Multiple bridge calls
for (const item of items) {
  await Storage.set({ key: item.id, value: item.data });
}

// GOOD - Single call with batch
await Storage.set({
  key: 'items',
  value: JSON.stringify(items),
});
```

---

## Rendering Performance

### Use CSS Transforms (GPU Accelerated)

```css
/* GPU accelerated */
.animated {
  transform: translateX(100px);
  will-change: transform;
}

/* Avoid - triggers layout */
.animated {
  left: 100px;
}
```

### Virtual Scrolling

```typescript
// Use virtual list for long lists
<VirtualScroller
  items={items}
  itemHeight={60}
  renderItem={(item) => <ListItem item={item} />}
/>
```

### Debounce Events

```typescript
import { debounce } from 'lodash-es';

const handleScroll = debounce((e) => {
  // Handle scroll
}, 16); // ~60fps
```

---

## Memory Management

### Cleanup Listeners

```typescript
import { App } from '@capacitor/app';

const handle = await App.addListener('appStateChange', callback);

// Cleanup on unmount
onUnmount(() => {
  handle.remove();
});
```

### Avoid Memory Leaks

```typescript
let largeData = await fetchLargeData();
processData(largeData);
largeData = null; // Allow GC
```

---

## Profiling

| Tool | Platform | Purpose |
|------|----------|---------|
| Chrome DevTools | Android | Performance tab, flame chart |
| Xcode Instruments | iOS | Time Profiler, CPU/Memory |
| Android Profiler | Android | CPU, Memory, Network |
| Safari Web Inspector | iOS | Web layer performance |

---

## Performance Targets

| Metric | Target |
|--------|--------|
| First Paint | < 1s |
| Time to Interactive | < 3s |
| Frame Rate | 60fps |
| Memory | Stable, no growth |
| Bundle Size | < 500KB gzipped |

---

## Offline-First Architecture

```
┌─────────────────────────────────────────┐
│              UI Layer                    │
├─────────────────────────────────────────┤
│           Service Layer                  │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │ Online Mode │  │ Offline Mode    │   │
│  └──────┬──────┘  └────────┬────────┘   │
├─────────┼──────────────────┼────────────┤
│         │    Sync Manager  │            │
│         └────────┬─────────┘            │
├──────────────────┼──────────────────────┤
│  ┌───────────────┴───────────────────┐  │
│  │         Local Database            │  │
│  │   (Fast SQL / IndexedDB)          │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## Network Detection

```typescript
import { Network } from '@capacitor/network';

// Check current status
const status = await Network.getStatus();
console.log('Connected:', status.connected);

// Listen for changes
Network.addListener('networkStatusChange', (status) => {
  if (status.connected) {
    syncManager.syncPendingChanges();
  } else {
    showOfflineIndicator();
  }
});
```

---

## Service Worker Caching

```typescript
// public/sw.js
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from 'workbox-strategies';

// Precache static assets
precacheAndRoute(self.__WB_MANIFEST);

// Cache API responses
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5,
  })
);

// Cache images
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [{
      expiration: {
        maxEntries: 100,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      },
    }],
  })
);
```

---

## Optimistic UI Updates

```typescript
class TodoService {
  async addTodo(text: string): Promise<Todo> {
    const todo: Todo = {
      id: crypto.randomUUID(),
      text,
      completed: false,
      updatedAt: Date.now(),
      syncStatus: 'pending',
    };

    // Save locally immediately
    await this.repo.save(todo);

    // Trigger sync in background
    this.syncManager.syncAll().catch(console.error);

    return todo;
  }
}
```

---

## Example Marketplace Relevance

- **Current network**: Online-first (Base44 SDK requires connection)
- **Offline needs**: Check-in history viewing, cached location data
- **Performance**: Bundle size managed by Vite; no heavy frameworks
- **Images**: Hero photos optimized via WebP; user uploads limited
- **Sync strategy**: Not yet implemented; would need for offline check-ins
