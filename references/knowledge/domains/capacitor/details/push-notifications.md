# Push Notifications

Extracted from: `capacitor-push-notifications` (Capawesome + Capgo)

---

## Overview

Capacitor push notifications use Firebase Cloud Messaging (FCM) for both iOS and Android. iOS additionally requires APNs (Apple Push Notification service) configuration.

### Architecture

```
Your Backend → FCM → iOS (APNs) → Device
            → FCM → Android → Device
```

---

## Plugin Installation

```bash
npm install @capacitor-firebase/messaging
npx cap sync
```

**Alternative**: `@capacitor/push-notifications` for basic push without Firebase.

---

## Firebase Project Setup

1. Go to https://console.firebase.google.com
2. Create new project (or use existing)
3. Add iOS app:
   - Bundle ID: matches `appId` in capacitor.config.ts
   - Download `GoogleService-Info.plist`
4. Add Android app:
   - Package name: matches `appId`
   - Download `google-services.json`

---

## iOS Configuration

### 1. Add GoogleService-Info.plist

Place in `ios/App/App/GoogleService-Info.plist`

### 2. Configure AppDelegate.swift

```swift
import UIKit
import Capacitor
import FirebaseCore

@UIApplicationMain
class AppDelegate: UIApplicationDelegate {
    override func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        FirebaseApp.configure()
        return true
    }
}
```

### 3. Enable Push Notifications Capability

Xcode > Signing & Capabilities > + Capability > Push Notifications

### 4. APNs Certificate Setup

1. Apple Developer Portal > Certificates, Identifiers & Profiles
2. Create APNs Authentication Key (p8) or APNs SSL Certificate
3. Upload to Firebase: Project Settings > Cloud Messaging > iOS App Configuration

### 5. Info.plist

```xml
<key>UIBackgroundModes</key>
<array>
    <string>remote-notification</string>
</array>
```

---

## Android Configuration

### 1. Add google-services.json

Place in `android/app/google-services.json`

### 2. Configure build.gradle (Project level)

```groovy
// android/build.gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.4.0'
    }
}
```

### 3. Configure build.gradle (App level)

```groovy
// android/app/build.gradle
apply plugin: 'com.google.gms.google-services'

dependencies {
    implementation platform('com.google.firebase:firebase-bom:32.7.0')
    implementation 'com.google.firebase:firebase-messaging'
}
```

---

## TypeScript Implementation

### Request Permission

```typescript
import { FirebaseMessaging } from '@capacitor-firebase/messaging';

async function requestPermission() {
  const { receive } = await FirebaseMessaging.requestPermissions();

  if (receive === 'granted') {
    console.log('Push notification permission granted');
  } else {
    console.log('Push notification permission denied');
  }
}
```

### Get FCM Token

```typescript
async function getToken() {
  const { token } = await FirebaseMessaging.getToken();
  console.log('FCM Token:', token);

  // Send token to your backend
  await sendTokenToServer(token);

  return token;
}
```

### Listen for Notifications

```typescript
// Foreground notifications
FirebaseMessaging.addListener('notificationReceived', (event) => {
  console.log('Notification received:', event.notification);
});

// Notification tapped
FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
  console.log('Notification tapped:', event.notification);
  // Navigate to specific screen
});

// Token refreshed
FirebaseMessaging.addListener('tokenReceived', (event) => {
  console.log('Token refreshed:', event.token);
  sendTokenToServer(event.token);
});
```

### Topic Subscriptions

```typescript
// Subscribe to topic
await FirebaseMessaging.subscribeToTopic({ topic: 'news' });

// Unsubscribe
await FirebaseMessaging.unsubscribeFromTopic({ topic: 'news' });
```

---

## Testing Push Notifications

### Using Firebase Console

1. Firebase Console > Cloud Messaging > Send your first message
2. Enter notification title and body
3. Select target app
4. Send test message

### Using cURL

```bash
curl -X POST https://fcm.googleapis.com/fcm/send \
  -H "Authorization: key=YOUR_SERVER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "DEVICE_FCM_TOKEN",
    "notification": {
      "title": "Test",
      "body": "Hello from FCM"
    },
    "data": {
      "screen": "/profile"
    }
  }'
```

---

## Notification Channels (Android)

```typescript
import { LocalNotifications } from '@capacitor/local-notifications';

await LocalNotifications.createChannel({
  id: 'default',
  name: 'Default Channel',
  description: 'General notifications',
  importance: 5, // High
  visibility: 1, // Public
});
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Token is null | Check Firebase config files |
| iOS not receiving | Verify APNs cert in Firebase |
| Android not receiving | Check `google-services.json` package name |
| Foreground not showing | Implement `notificationReceived` handler |
| Background not working | Check background modes in Info.plist |

---

## Example Marketplace Relevance

- **Current status**: Push notifications not yet implemented
- **Planned provider**: OneSignal (alternative to direct FCM)
- **Use cases**: Check-in reminders, challenge notifications, reward alerts
- **Backend integration**: Base44 SDK would store tokens and trigger pushes
