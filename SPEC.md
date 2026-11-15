# Brocolli — Build Spec (v1)

> "Broke College Living." The fastest way for a college friend group to log shared
> expenses at the moment of payment, and the least awkward way to get paid back on UPI.

This is the product and engineering spec for the first buildable version. The
business plan lives in the "Brocolli — Market-Winning Plan" doc; this file is
what the code must do. Read `CONTRIBUTING.md` for coding rules.

---

## 1. Scope of v1

**In v1 (Android first, iOS in the same codebase but capture features later):**

1. Payment Inbox: payments arrive automatically (SMS + payment-app notifications)
   as cards; swipe right = split, left = personal, up = not an expense.
2. Manual quick add (one text box: `250 zomato w rahul aman`).
3. Groups and 1-to-1 friend ledgers, all split types, multiple payers.
4. Balances: one net number per friend, with a "why" timeline behind it.
5. Debt simplification inside a group.
6. Settle with one tap via UPI intent, with fallbacks.
7. Edit everything, edit history, undo.
8. Works offline; syncs when online.

**Out of v1 (designed for, not built):** Scan → Pay → Split, screenshot/receipt
OCR, Nudges, Runway, Wrapped, Group Pots, no-install web link, Splitwise import,
iOS Shortcuts capture, Plus subscription. See §12 for order.

**Never:** holding money, lending/BNPL, ads in the split flow, daily caps, public
debt scores.

---

## 2. Tech stack (decided — don't relitigate without a reason)

| Layer | Choice | Why |
|---|---|---|
| App | React Native + **Expo (SDK latest), TypeScript strict**, Expo Router | One codebase, fast iteration, strong typing |
| Build | **Expo dev build / EAS** (NOT Expo Go) | SMS and notification capture need custom native code |
| Native capture | Local **Expo Module** in Kotlin: `modules/payment-capture` | BroadcastReceiver for SMS, NotificationListenerService |
| Animation / gestures | `react-native-reanimated` v3+, `react-native-gesture-handler` | 60 fps swipe deck and sheets on the UI thread |
| Haptics | `expo-haptics` | Threshold ticks and success buzz |
| Styling | NativeWind (Tailwind) or a small typed theme file — pick one and stick to it | Fast, consistent design tokens |
| Bottom sheets | `@gorhom/bottom-sheet` | Smooth split/settle sheets |
| Lists | `@shopify/flash-list` | Fast long feeds |
| Local DB | `expo-sqlite` + **Drizzle ORM** | Local-first, typed queries, migrations |
| State | Zustand for UI state; DB is the source of truth | Simple |
| Backend | **Supabase** (Postgres, Auth with phone OTP, Row Level Security, Realtime) | Fast start, real Postgres |
| Sync | Outbox of operations → Supabase; pull changes since `updated_at` cursor | Offline-first |
| Tests | Vitest/Jest for pure TS (split engine, parser); Maestro for E2E flows | Money logic must be tested |
| Lint/format | ESLint + Prettier, `tsc --noEmit` in CI | |

---

## 3. Money rules (non-negotiable)

- All amounts are **integer paise** (`number` that is always an integer, or `bigint`
  at boundaries). Never floats. ₹480.50 = `48050`.
- Splitting uses the **largest-remainder method**: compute each share's floor, then
  hand out leftover paise one at a time to the largest fractional remainders; ties
  go to the payer first, then by stable member order. Shares always sum exactly to
  the total.
- Every expense must satisfy: `sum(payers) == total == sum(shares)`. Enforce in code
  and with a DB check where possible.
- Currency per expense (default `INR`). v1 does not convert currencies; balances are
  per currency.
- Display with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`
  (gives ₹1,23,456.00 Indian grouping). Hide `.00` on whole rupees.

---

## 4. Data model

SQLite locally and Postgres remotely share the same shape. Every table has
`id` (UUID v7, generated on device), `created_at`, `updated_at`, `deleted_at`
(soft delete), and `version` (int, for conflict detection).

```
users              id, phone, display_name, upi_id?, avatar_url?, monthly_allowance_paise?
people             id, owner_user_id, display_name, phone?, upi_id?, linked_user_id?, avatar_emoji?
                   -- a "friend" as the owner sees them; may or may not be a Brocolli user
groups             id, name, emoji, created_by, default_split_kind
group_members      group_id, person_id, joined_at
expenses           id, group_id?, description, merchant_display?, category?, total_paise,
                   currency, occurred_at, created_by, source, source_payment_id?, notes?
                   source ∈ {manual, inbox_sms, inbox_notification, scan, screenshot, recurring}
expense_payers     expense_id, person_id, amount_paise
expense_shares     expense_id, person_id, amount_paise, split_kind, split_value?
                   split_kind ∈ {equal, exact, percent, shares, item}
expense_items      id, expense_id, name, amount_paise         -- for item splits (later)
expense_item_shares item_id, person_id
settlements        id, from_person_id, to_person_id, amount_paise, currency, method,
                   status, upi_txn_ref?, note?, group_id?
                   method ∈ {upi, cash, other}; status ∈ {pending, confirmed, cancelled}
detected_payments  id, user_id, direction, amount_paise, currency, payee_raw, payee_vpa?,
                   payee_key, bank?, account_last4?, txn_ref?, occurred_at, capture_source,
                   status, expense_id?, raw_hash
                   direction ∈ {debit, credit}; capture_source ∈ {sms, notification, shortcut, scan}
                   status ∈ {inbox, split, personal, ignored}
                   -- RAW SMS/NOTIFICATION TEXT IS NEVER STORED REMOTELY. Store raw text only in a
                   -- local-only table `detected_payment_raw(id, text)` for debugging, auto-purged after 7 days.
payee_rules        id, user_id, payee_key, display_name, category?, default_group_id?,
                   default_people_ids (json)?, default_split_kind?, muted (bool)
edit_log           id, entity_type, entity_id, actor_user_id, diff (json), created_at
```

`payee_key` = normalized payee identity: lowercase VPA if present (`chaipoint@ybl`),
else normalized payee name with digits/whitespace collapsed.

Balances are **computed**, not stored: net(person A ↔ B) = Σ what A paid for B's
shares − Σ what B paid for A's shares ± settlements. Cache in memory per screen.

Supabase: RLS so a user can read an expense only if they created it or are linked
to a person in its payers/shares or its group.

---

## 5. Payment capture (Android native module)

Module `modules/payment-capture` (Kotlin, Expo Modules API). Exposes to JS:

```ts
requestSmsPermission(): Promise<'granted' | 'denied'>
isNotificationAccessEnabled(): Promise<boolean>
openNotificationAccessSettings(): void
scanRecentSms(sinceMs: number): Promise<RawCapture[]>   // first-run backfill, user-chosen window
addListener('onCapture', (c: RawCapture) => void)
type RawCapture = { source: 'sms' | 'notification'; sender: string; text: string; receivedAt: number; packageName?: string }
```

- SMS: `BroadcastReceiver` on `SMS_RECEIVED` + `READ_SMS` for backfill. Only forward
  messages whose sender ID matches a bank/UPI allowlist pattern (e.g. `XX-HDFCBK`,
  `AX-ICICIT`, `VM-SBIUPI`, `JD-KOTAKB`, `AD-PAYTMB`…) AND whose text matches a
  debit/credit keyword. Everything else is dropped in Kotlin and never reaches JS.
- Notifications: `NotificationListenerService`, package allowlist:
  `com.google.android.apps.nbu.paisa.user` (GPay), `com.phonepe.app`,
  `net.one97.paytm`, `in.org.npci.upiapp` (BHIM), plus major bank apps. Forward
  only payment-looking notifications.
- When the app is killed, captures go into a small native queue (SharedPreferences
  or Room) and are drained into JS on next launch.
- Permission UX: never ask on first launch. Show an explainer card in the Inbox
  ("Let Brocolli catch your payments automatically") → explain exactly what's read
  → then the system prompt. Denial is fine; manual add still works.
- **Play Store:** SMS permissions need the Permissions Declaration Form under the
  "SMS-based money management" exception. Keep SMS capture behind a build flag
  (`EXPO_PUBLIC_SMS_CAPTURE`) so a notification-only build can ship if approval lags.

### 5.1 Parser (`src/capture/parser.ts`, pure TS, heavily tested)

`parseCapture(raw: RawCapture): ParsedPayment | null`

Extract:
- **amount**: `(?:Rs\.?|INR|₹)\s?([\d,]+(?:\.\d{1,2})?)` → paise
- **direction**: debit words (`debited|spent|paid|sent|withdrawn|purchase`) vs credit
  (`credited|received|refund`). Ignore OTPs, "requested", "due", "will be debited",
  promos, failed/declined transactions.
- **payee VPA**: `[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}`
- **payee name**: text after `to|at|towards|Info:|trf to` up to `on|ref|UPI|.`
- **account last 4**: `(?:a\/c|ac|account|card)[^\d]{0,10}(?:XX|X|\*)*(\d{3,4})`
- **txn ref**: `(?:UPI\s?Ref(?:\s?No)?|Ref\s?No|RRN|UTR)[:\s.]*(\d{10,16})`
- **bank**: from sender ID map.

**Dedupe:** same `txn_ref` → same payment. Without a ref: same amount + same
payee_key within 3 minutes → merge, prefer the richer record.

**Fixtures:** `src/capture/__fixtures__/*.txt`, one synthetic SMS/notification per
file with an expected JSON next to it. Start with at least 30 covering HDFC, ICICI,
SBI, Axis, Kotak, Paytm Payments Bank, GPay/PhonePe notifications, refunds, OTPs,
failed payments, promos. Example (synthetic):

```
Sender: VM-HDFCBK
Text:   Sent Rs.480.00 From HDFC Bank A/C *1234 To CHAI POINT On 10/11/26 Ref 431512345678 Not You? Call 18002586161/SMS BLOCK UPI to 7308080808
Expect: { direction: "debit", amountPaise: 48000, payeeRaw: "CHAI POINT", accountLast4: "1234", txnRef: "431512345678", bank: "HDFC" }
```

Real bank formats change. Users must be able to correct any field in one tap,
and corrections must never crash the parser.

---

## 6. Screens

Navigation: bottom tabs **Inbox · Friends · Groups · You**, plus a floating `+`
(quick add). Inbox is the default tab.

1. **Onboarding:** phone OTP → name → UPI ID (optional, "so friends can pay you")
   → "Add your people" (contacts picker, optional) → land in Inbox.
2. **Inbox (swipe deck)** — the hero screen. See §7.
3. **Split sheet** (bottom sheet from a right swipe or from `+`):
   amount (editable, large), description/merchant, date, who paid (defaults to
   me), people chips (suggested ones pre-selected, search, recent first, "+ new
   person"), split kind segmented control (Equal / Exact / % / Shares), live
   per-person preview that always sums correctly, group picker. Primary button
   "Split ₹480 with 3". Never more than one screen.
4. **Friends:** list sorted by |balance| desc; each row shows avatar, name, net
   ("owes you ₹340" green / "you owe ₹120" coral / "settled"). Top hero: "You're
   owed ₹2,140 · You owe ₹380".
5. **Friend detail ("why" view):** big net number, then a timeline of every
   expense and settlement between you, newest first, each with your share. Buttons:
   Settle up · Remind (later) · Add expense.
6. **Groups / Group detail:** members, group feed, "Simplify debts" view listing
   the minimal transfers.
7. **Expense detail / edit:** every field editable inline; edit history at the
   bottom ("Aman changed amount ₹450 → ₹480"); delete with undo.
8. **Settle sheet:** amount (defaults to full balance, editable), method UPI/cash,
   "Pay with UPI" (opens app chooser) → on return ask "Did it go through?" → mark
   pending/confirmed. If the friend owes you: "Request" shares a message with your
   UPI ID and amount (WhatsApp share intent).
9. **You:** profile, UPI ID, capture settings (SMS on/off, notifications on/off,
   muted payees), theme, export data (CSV/JSON), delete account, privacy page.
10. **Quick add (`+`):** single natural-language input with live parse chips
    ("₹250 · zomato · Rahul, Aman · equal") → Enter opens the split sheet pre-filled.

---

## 7. The Inbox swipe deck (spec in detail)

- Stack of up to 3 visible cards; top card is interactive. Newest payment first
  (toggle: oldest first for batch catch-up).
- **Card content:** amount (display size, ~44 pt), payee display name + emoji/logo,
  relative time ("12 min ago"), account ("HDFC ··1234"), source icon (SMS / GPay /
  PhonePe), and a suggestion pill from `payee_rules` / history ("Usually: Flat 302 ·
  equal"). Tap card → edit fields before sorting.
- **Gestures (Reanimated + Gesture Handler, all on UI thread):**
  - drag rotates card up to ±12° proportional to x; background tint fades in
    (right: green, left: slate, up: amber).
  - commit thresholds: |dx| > 35% of screen width or velocity > 800 px/s; up: dy <
    −25% height.
  - crossing a threshold fires `Haptics.selectionAsync()` once; commit fires
    `impactAsync(Light)`.
  - below threshold → spring back (`damping ~15, stiffness ~180`).
  - **Right → Split:** card flies off, split sheet opens with suggestions pre-filled.
    Dismissing the sheet without saving returns the card to the deck.
  - **Left → Personal:** status `personal`, counted in personal spending.
  - **Up → Not an expense:** status `ignored`; long-press option "Always ignore
    this payee" sets `muted`.
- **Rewind** button (top-left) undoes the last sort, any type, unlimited within the
  session.
- **Buttons** under the deck (✕ Personal · ↑ Ignore · ✓ Split) do the same as swipes.
- **Merge:** in list mode (toggle top-right), multi-select cards → "Merge into one
  expense".
- **Learning:** after a split or rename, upsert `payee_rules` for that `payee_key`
  (display name, category, people, split kind, group). Suggestion confidence = how
  many of the last 5 payments to this payee used the same people.
- **Empty state:** mascot + "Inbox zero. You're thriving." + "Add manually".
- Performance budget: drag must hold 60 fps on a mid-range Android (e.g. a
  ₹12–15k phone). No JS-thread work during the drag.

---

## 8. Design system

- **Theme:** dark-first + light. Tokens in `src/theme/tokens.ts`.
  - `bg` near-black `#0B0F0C`, `surface` `#141A16`, `surfaceRaised` `#1C241F`
  - `brand` broccoli green `#22C55E` (pressed `#16A34A`)
  - `owe` coral `#FB7185`, `owed` green `#4ADE80`, `neutral` slate `#94A3B8`,
    `warn` amber `#F59E0B`
  - light theme mirrors these with WCAG AA contrast.
- **Type:** Inter (or Satoshi) — display 44/48 for amounts, title 22, body 16,
  caption 13. Tabular numerals for all money.
- **Shape:** radius 20 (cards), 14 (inputs/chips), 28 (sheets). 8-pt spacing grid.
- **Motion:** springs everywhere, no linear tweens; shared-element feel between
  card and expense detail; count-up animation on balance changes; small confetti
  when a balance reaches zero.
- **Feedback:** optimistic UI (update local DB → UI → sync in background); undo
  toasts instead of confirm dialogs; skeleton loaders, no spinners.
- **Accessibility:** every gesture has a button; minimum tap target 44×44; respects
  OS font scaling and Reduce Motion.

---

## 9. Split engine (`src/domain/split.ts`, pure TS)

```ts
computeShares(total: Paise, participants: PersonId[], spec: SplitSpec, payerId: PersonId): Share[]
// SplitSpec = {kind:'equal'} | {kind:'exact', amounts} | {kind:'percent', pcts} | {kind:'shares', weights}
validateExpense(e): Result<ok, ValidationError[]>
netBalances(expenses, settlements, currency): Map<PersonPair, Paise>
simplifyDebts(nets: Map<PersonId, Paise>): Transfer[]   // greedy: largest creditor ↔ largest debtor
```

Required tests: ₹100 split 3 ways = 3334/3333/3333 with the extra paisa to the
payer; percent splits summing to 99.99 rejected; exact splits must sum to total;
multi-payer; simplification of a 6-person group produces ≤ n−1 transfers and
preserves every net; property-based test (fast-check) that shares always sum to
total for random inputs.

---

## 10. UPI settle

- Build `upi://pay?pa=<vpa>&pn=<name>&am=<rupees.2dp>&cu=INR&tn=<note ≤ 50 chars>`
  and open with `Linking.openURL` (Android shows the UPI app chooser).
- We are not a payment provider: we can't see success. After returning, ask the
  user; also auto-confirm if a matching debit is captured within 10 minutes
  (same amount + payee VPA).
- **Known risk:** some UPI apps restrict or decline person-to-person payments
  opened by intent from third-party apps. Test GPay, PhonePe, Paytm, BHIM in week 1.
  Fallbacks always available on the settle sheet: show the friend's UPI QR (render
  with `react-native-qrcode-svg`) and "Copy UPI ID + amount".

---

## 11. Sync and offline

- Every write goes to SQLite first and appends to an `outbox` table.
- A sync worker pushes the outbox to Supabase when online (exponential backoff),
  then pulls rows with `updated_at > last_cursor` for entities the user can see.
- Conflicts: per-row last-writer-wins by `version`, but **expenses** use field-level
  merge and always write an `edit_log` entry so nothing silently disappears.
- Realtime subscription on groups the user belongs to for instant updates.

---

## 12. Milestones (build in this order)

Each milestone ends with: tests green, `tsc` clean, and a short demo on a real
Android phone.

| # | Milestone | Done when |
|---|---|---|
| M0 | Scaffold: Expo + TS strict + Router + Reanimated + NativeWind/theme + Drizzle + ESLint/Prettier + test runner | App boots on Android dev build; CI runs lint, typecheck, tests |
| M1 | Domain core: split engine, balances, simplification, money formatting | All §9 tests pass, including property-based |
| M2 | Local DB schema + repositories + seed data | CRUD for people/groups/expenses works offline |
| M3 | UI shell with seed data: tabs, Friends, Friend detail, Group detail, Expense edit, Split sheet | You can add and edit splits by hand end-to-end |
| M4 | Inbox deck with fake captures: gestures, haptics, rewind, buttons, learning rules | Swiping 20 fake cards feels smooth at 60 fps |
| M5 | Parser + fixtures | ≥ 30 fixtures pass; garbage in never crashes |
| M6 | Native capture module (notifications first, then SMS behind flag) + permission UX + backfill | Real payments on your phone appear in the Inbox within 2 s |
| M7 | Supabase: phone auth, RLS, sync worker, realtime | Two phones see the same group update live; offline edits sync |
| M8 | Settle: UPI intent, QR fallback, confirm flow, auto-confirm from capture | You and a friend settle a real ₹1 |
| M9 | Polish: empty states, mascot, confetti, count-ups, light theme, accessibility pass, export/delete | Ready for 10 friend groups |

After v1, in order: Brocolli Nudges → Month-end Runway → Scan → Pay → Split →
screenshot item-split → no-install web link → Splitwise import → Wrapped → Group
Pots → iOS Shortcuts capture.

---

## 13. Privacy and compliance checklist

- [ ] Raw SMS/notification text never leaves the device; filtered in Kotlin first.
- [ ] Clear in-app disclosure before each permission; app fully usable without them.
- [ ] Play Console: SMS Permissions Declaration (SMS-based money management),
      Data safety form, privacy policy URL.
- [ ] Signup is 18+ (age confirmation). No minors' data in v1.
- [ ] Export all data and delete account from the You tab.
- [ ] India DPDP Act: consent, purpose limitation, deletion. Get a lawyer to review
      before public launch.

---

## 14. North-star and instrumentation

North star: **rupees settled per week.** Also log (privacy-safe, no amounts tied to
identities in analytics): time from capture to sort, % captures sorted within 1 min,
split-sheet completion time, settle rate within 7 days.
