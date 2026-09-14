# Base44 SDK — Realtime and WebSockets

**Domain:** base44
**Area:** Socket.IO transport, entity subscriptions, agent conversation streaming
**Source:** https://github.com/base44/javascript-sdk (v0.8.27)
**Last updated:** 2026-05-06

---

## Mechanism

### Socket.IO Client Setup

The SDK uses `socket.io-client` v4.7.5 with a single shared connection:

```typescript
const socket = io(serverUrl, {
  path: "/ws-user-apps/socket.io/",
  transports: ["websocket"],
  query: { app_id: config.appId, token: config.token ?? getAccessToken() },
});
```

Connection is lazy: `RoomsSocket()` is called only when a module first requests a subscription.

### Room-Based Subscription Model

`RoomsSocket` maintains a `roomsToListeners` map. Each room can have multiple listener callbacks:

```typescript
function subscribeToRoom(room, handlers) {
  if (!roomsToListeners[room]) {
    joinRoom(room);  // socket.emit("join", room)
    roomsToListeners[room] = [];
  }
  roomsToListeners[room].push(handlers);
  return () => {
    // filter out this handler, leave room if empty
  };
}
```

Server events:
- `connect` → re-joins all rooms, calls per-room `connect` handlers
- `update_model` → dispatches to all listeners for that room
- `error` / `connect_error` → broadcasts to all listeners

### Entity Realtime Subscriptions

`entities.{Name}.subscribe(callback)` joins room `entities:{appId}:{entityName}`.

Event payload structure:
```typescript
interface RealtimeEvent<T> {
  type: "create" | "update" | "delete";
  data: T;
  id: string;
  timestamp: string;
}
```

**Oversize broadcast handling:** If a record exceeds the realtime transport cap, the server sends `_oversize: true` on the data object. The SDK logs an error advising the developer to call `entities.{Name}.get(id)` to fetch the full record. This only applies to `create`/`update` events (not `delete`).

### Agent Conversation Streaming

`agents.subscribeToConversation(conversationId, onUpdate?)` joins room `/agent-conversations/{conversationId}`.

Local message cache strategy:
1. Fetch initial conversation state via HTTP
2. On each `update_model` with `_message`, merge the message into the local cache
3. Deduplicate by `message.id`
4. Call `onUpdate` with the updated conversation object

This gives the illusion of streaming: messages appear incrementally as the agent generates them.

### Socket Lifecycle

- `setToken(newToken)` → disconnects old socket, recreates with new token
- `cleanup()` → disconnects socket, stops analytics heartbeat
- Socket reconnects automatically via Socket.IO's built-in reconnection

---

## Analysis

### WebSocket-Only Transport

The SDK forces `transports: ["websocket"]`. This means:
- No HTTP long-polling fallback
- Connections fail on networks that block WebSocket (some corporate proxies)
- Lower latency but higher connection failure risk

The trade-off favors Base44's app-builder audience (modern browsers, SaaS environments) over maximum compatibility.

### No Centralized State Management

Each module manages its own subscriptions and callbacks. There is no Redux/Zustand-style store. The agent module keeps a local `currentConversations` Record; the entity module passes events directly to the callback. This is lightweight but means:
- Multiple subscribers to the same entity each receive independent events
- No shared cache between components unless the app builds one
- Agent conversation cache lives only in the SDK module, not in the component

### Oversize Handling Is Developer-Burden

When a realtime payload is too large, the SDK warns but does NOT auto-fetch. The developer must handle this manually. This is a pragmatic choice (avoiding surprise network requests) but means UI code must be prepared for partial records.

---

## L4 Pointers

- `src/utils/socket-utils.ts` — `RoomsSocket`, `subscribeToRoom`, `initializeSocket`
- `src/modules/entities.ts` — `subscribe()` and oversize warning
- `src/modules/agents.ts` — `subscribeToConversation()` and message cache
- `src/modules/entities.types.ts` — `RealtimeEvent`, `RealtimeCallback`
