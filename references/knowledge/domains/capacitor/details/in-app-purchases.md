# In-App Purchases

Extracted from: `capacitor-in-app-purchases` (Capawesome)

---

## Plugin Options

| Provider | Plugin | Use Case |
|----------|--------|----------|
| Capawesome | `@capawesome/capacitor-purchases` | Subscriptions, consumables |
| RevenueCat | `@revenuecat/purchases-capacitor` | Advanced analytics, cross-platform |

---

## App Store Configuration

### Apple App Store Connect

1. Go to App Store Connect > Your App > Features > In-App Purchases
2. Create product:
   - **Consumable**: One-time use (e.g., credits)
   - **Non-Consumable**: Permanent (e.g., premium unlock)
   - **Auto-Renewable Subscription**: Recurring (e.g., monthly plan)
   - **Non-Renewing Subscription**: Fixed duration
3. Fill in reference name, product ID, pricing, description
4. Submit for review (required before testing)

### Google Play Console

1. Go to Play Console > Your App > Monetization > Products
2. Create in-app product or subscription
3. Fill in title, description, pricing
4. Activate the product

---

## Installation (RevenueCat)

```bash
npm install @revenuecat/purchases-capacitor
npx cap sync
```

---

## TypeScript Implementation

### Initialize

```typescript
import { Purchases } from '@revenuecat/purchases-capacitor';

async function initPurchases() {
  await Purchases.configure({
    apiKey: 'YOUR_REVENUECAT_API_KEY',
    appUserID: 'user_id', // Or null for anonymous
  });
}
```

### Get Products

```typescript
async function getProducts() {
  const { products } = await Purchases.getProducts({
    productIdentifiers: ['premium_monthly', 'premium_yearly'],
  });
  return products;
}
```

### Make Purchase

```typescript
async function purchase(productId: string) {
  try {
    const { customerInfo, productIdentifier } = await Purchases.purchaseProduct({
      productIdentifier: productId,
    });

    if (customerInfo.entitlements.active['premium']) {
      console.log('Premium unlocked!');
    }
  } catch (error) {
    if (error.code === 'PURCHASE_CANCELLED') {
      console.log('User cancelled');
    } else {
      console.error('Purchase failed:', error);
    }
  }
}
```

### Restore Purchases

```typescript
async function restorePurchases() {
  const { customerInfo } = await Purchases.restorePurchases();

  if (customerInfo.entitlements.active['premium']) {
    console.log('Premium restored');
  }
}
```

### Check Subscription Status

```typescript
async function checkStatus() {
  const { customerInfo } = await Purchases.getCustomerInfo();
  const isPremium = customerInfo.entitlements.active['premium'] !== undefined;
  return isPremium;
}
```

---

## Receipt Validation

RevenueCat handles receipt validation automatically. For custom validation:

- **iOS**: Validate with Apple App Store server
- **Android**: Validate with Google Play server

---

## Testing

### iOS Sandbox

1. Create sandbox tester in App Store Connect
2. Sign in with sandbox Apple ID on device
3. Purchase will not be charged

### Android Test Purchases

1. Add test accounts in Play Console
2. Use license testers
3. Purchases will show "Test card, always approves"

---

## Example Marketplace Relevance

- **Current monetization**: None (free app)
- **Future model**: Freemium with premium features
- **Potential tiers**:
  - Free: Basic check-ins, limited locations
  - Premium: Unlimited locations, advanced stats, team management
- **Subscription cadence**: Monthly/annual
- **Receipt validation**: RevenueCat recommended for simplicity
