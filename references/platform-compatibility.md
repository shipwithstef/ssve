# Platform Compatibility

## Builder Platform Detection

From builder profile or project files:
- React/React Native → Web + Mobile (iOS/Android)
- Node.js/Next.js → Web + API
- Python → API + CLI + ML/AI
- Go → API + CLI
- Swift → iOS native
- Kotlin → Android native

## Scoring Compatibility

| Platform | Native Score | Neutral Score | Mismatch Score |
|----------|--------------|---------------|----------------|
| React Native / Expo | +10 | — | — |
| Web (React/Vue/Next) | +5 | — | -5 for mobile-only |
| iOS Native (Swift) | +10 | — | — |
| Flutter | +5 | — | — |

Stack mismatch does not eliminate categories but reduces score.
