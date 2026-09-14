---
description: React coding style — naming, file structure, component conventions
scope: project
stack: react
source: local
source_sha: 18c9b2d436dd0dea
last_evaluated: 2026-05-08
---



## URL & View Naming in SPAs

**Rule**: Internal state/view names MUST match URL slugs exactly.

In any SPA with custom routing, the internal state name should be identical to the URL path segment:
- ✅ View state `'academy'` → URL `/academy`
- ✅ View state `'profile-setup'` → URL `/profile-setup`
- ❌ View state `'vibe-academy'` → URL `/academy` (MISMATCH - causes bugs)

**Why**: Mismatches require duplicate URL mapping logic, break analytics tracking, confuse developers, and cause navigation bugs.

**Exception**: Parameterized routes where base noun matches:
- ✅ View `'match-detail'` + param → URL `/match/:id`
- ✅ View `'team-detail'` + param → URL `/team/:teamId`

---

## Component Export Patterns

**Preferred**: Named export as plain function
```typescript
export function ComponentName(props: ComponentNameProps) {
  // ...
}
```

**When needing ref forwarding**: Use `forwardRef` with `displayName`
```typescript
const ComponentName = React.forwardRef<HTMLDivElement, Props>(
  ({ ... }, ref) => { ... }
);
ComponentName.displayName = 'ComponentName';
export { ComponentName };
```

**Discouraged**: `React.FC` (legacy pattern, no longer recommended by React team)
```typescript
// ❌ Avoid - adds nothing, has downsides (implicit children, no generics)
export const ComponentName: React.FC<Props> = ({ ... }) => { ... };
```

**Rule**: Pick ONE pattern per feature area. Don't mix styles.

---

## Props Interfaces

**Always define props interface**: `interface ComponentNameProps { ... }`

**Default to private** unless reused across feature boundaries:
```typescript
// Private (default)
interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
}

// Exported (when shared across features)
export interface PathCompletionCelebrationProps {
  pathTitle: string;
  modulesCompleted: number;
}
```

---

## State Management Decision Matrix

### Use Zustand Store when:
- Data accessed by multiple components
- State persists across navigation
- Async operations (API calls) involved
- Complex state transitions
- Need computed/derived state

**Naming convention**: `use[Domain]Store` (e.g., `useProfileStore`, `useChatStore`)

### Use useState when:
- State scoped to single component
- Not shared with siblings/parents
- Ephemeral (dialog visibility, form input, loading flags)
- Resets on component unmount

### Use Context API when:
- Foundational infrastructure (theme, i18n)
- Rarely changes
- Doesn't need complex state management
- Low performance impact

**No prop drilling**: Components should access stores directly instead of passing props through layers.

---

## Import Order

**Enforced by**: `eslint-plugin-simple-import-sort` (auto-fix on save/commit)

Group by source, separated by blank lines. No comment headers in files.

```typescript
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';

import { Trash2, AlertTriangle } from 'lucide-react';

import type { ChatMessage, MatchParticipant } from '@/types';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';

import { gdprService } from '@/services/gdprService';
import { useProfileStore } from '@/store/useProfileStore';

import { ReadReceipt } from './ReadReceipt';
```

**Group order** (handled automatically by ESLint plugin):
1. React and core libraries (`react`, `react-dom`, `motion/react`)
2. Third-party packages (`lucide-react`, etc.)
3. Internal utilities and types (`@/lib`, `@/types`, `@/constants`, `@/hooks`)
4. UI components (`@/components/ui`)
5. Services and stores (`@/services`, `@/store`)
6. Relative/local imports (`./`, `../`)

**Do NOT**: Add `// 1. React...` comment headers to import groups. Blank lines are sufficient.

---

## TypeScript Guidelines

### Explicit Return Types
Use for public API surfaces and exported functions:
```typescript
// ✅ Good - exported function with return type
export function deleteAccount(userId: string): Promise<void> { ... }

// ✅ Also fine - TypeScript inference is excellent
export function formatDate(date: Date) {
  return date.toISOString().split('T')[0];
}
```

### Avoid `any` Type
Use `unknown` and type guards instead:
```typescript
// ✅ Good
function parseValue(value: unknown): string {
  if (typeof value === 'string') return value;
  return String(value);
}

// ❌ Bad
function parseValue(value: any): string { ... }
```

**Exceptions allowed** (with comment):
```typescript
// Service/mapper layers for DB row parsing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const row: any = dbRow;  // Supabase SDK typing limitation
```

### Type Event Handlers
```typescript
onChange: (value: string) => void
onClick: () => void
onSubmit: (data: FormData) => Promise<void>
```

---

## Performance Guidelines

**Enforced by**: React Compiler (`babel-plugin-react-compiler`) - auto-memoizes at build time.

### React Compiler (React 19+)
The React Compiler automatically memoizes components, hooks, and values at build time. This eliminates the need for manual `React.memo`, `useCallback`, and `useMemo` in most cases.

**Do NOT manually add**:
- `React.memo` wrappers (compiler handles it)
- `useCallback` for every handler (compiler handles it)
- `useMemo` for simple derivations (compiler handles it)

**Still use manually when**:
- Third-party library requires referential identity (map/virtualization libs)
- Effect dependency pinning where you need strict control
- Profiling shows the compiler missed an optimization

### Inline Functions in JSX
Inline functions are fine. The compiler auto-memoizes them.
```typescript
// ✅ Fine - compiler optimizes this
<Button onClick={() => setOpen(true)} />
<List items={items.filter(i => i.active)} />
```

### What IS Worth Optimizing
- Lazy loading routes with `React.lazy` + `Suspense`
- Virtualizing long lists (100+ items)
- Debouncing search/filter operations
- Code-splitting large features

---

## Why These Standards?

- **Consistency** - Agents and developers write predictable code
- **Maintainability** - Clear patterns reduce cognitive load
- **Bug Prevention** - Enforced conventions prevent common mistakes
- **Performance** - Guidelines based on React best practices, not premature optimization
