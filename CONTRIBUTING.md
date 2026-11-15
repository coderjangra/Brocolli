# Contributing to Brocolli

Brocolli ("Broke College Living") is an Android-first, offline-first expense-splitting
app for Indian college students. The product spec is `SPEC.md`. Read it before
starting any milestone, and build milestones in the order in SPEC §12.

## Stack
Expo (dev build, never Expo Go) · React Native · TypeScript strict · Expo Router ·
Reanimated + Gesture Handler · expo-haptics · @gorhom/bottom-sheet · FlashList ·
expo-sqlite + Drizzle · Zustand · Supabase · Kotlin Expo Module for payment capture.

## Layout
```
app/                    Expo Router screens (thin: compose components, call hooks)
src/domain/             pure TS money logic: split, balances, simplify, format (NO React, NO IO)
src/capture/            parser.ts + __fixtures__/ (pure TS)
src/db/                 Drizzle schema, migrations, repositories
src/sync/               outbox + Supabase sync worker
src/features/<name>/    components + hooks per feature (inbox, split, friends, groups, settle)
src/theme/              tokens.ts, typography, motion presets
src/ui/                 shared primitives (Button, Chip, Sheet, AmountText, Avatar)
modules/payment-capture Kotlin Expo Module (SMS receiver, NotificationListenerService)
```

## Hard rules
- **Money is integer paise. No floats anywhere in money paths.** Use the helpers in
  `src/domain/money.ts`; never `parseFloat` a rupee amount.
- Every expense must satisfy `sum(payers) == total == sum(shares)`. Validate before
  every write.
- Anything in `src/domain` or `src/capture` ships with tests. Write the test first
  for split/balance/parser changes.
- UI never waits for the network: write SQLite → update UI → enqueue to outbox.
- Gestures and animations run on the UI thread (worklets). No `setState` during a
  drag.
- Raw SMS/notification text never goes to the server or analytics. Filter in Kotlin.
- No confirmation dialogs; use undo toasts.
- Every swipe action also has a button (accessibility).
- Use theme tokens; no hard-coded colors or font sizes in components.

## Commands
```
npx expo run:android          # dev build on device/emulator
npm test                      # unit tests (domain + parser)
npm run typecheck             # tsc --noEmit
npm run lint
```
(Create these scripts in M0 if they don't exist.)

## Working style
- One milestone at a time. Before coding, list the files you'll touch and the tests
  you'll add. After coding, run tests + typecheck and fix failures before stopping.
- Keep PRs/commits small and named by milestone (`M4: inbox swipe deck`).
- If a library choice in SPEC.md blocks you, explain why and propose one alternative
  before switching.
- Ask before adding a new dependency that isn't in the stack list.
