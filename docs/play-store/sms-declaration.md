# SMS permissions declaration

Play Console → App content → **Sensitive app permissions → SMS and Call Log**.

Permissions: `READ_SMS`, `RECEIVE_SMS`. Brocolli is not the default SMS handler.

**Core functionality**: *SMS-based money management*. Play lists this as a
permitted exception ("apps that track and manage budget-related SMS").

**Describe the core functionality** (paste):

```
Brocolli is an expense-splitting and spending tracker for students in India. Its core feature, the Payment Inbox, turns bank transaction SMS (e.g. "Sent Rs.250 from A/c *1234 to ...") into cards the user swipes to split with friends, mark as personal, or ignore. Most Indian banks report UPI and card payments only by SMS, so reading these alerts is how the app knows a payment happened.

RECEIVE_SMS: detects new bank transaction alerts as they arrive.
READ_SMS: one-time import of the last 30 days of bank alerts when the user turns the feature on, so their recent spending appears.

Privacy: a filter on the device keeps only messages from bank and payment senders that describe a debit or credit. All other SMS, including personal messages and OTPs, are discarded immediately. Only payment fields (amount, payee, bank, last 4 digits of account, reference, time) are stored, on the device only. Nothing is sent to any server; the app has no backend, analytics or ads.

The feature is optional and off by default. An in-app disclosure explains what is read before the system permission prompt. The app works fully without SMS access (manual entry and notification-based capture).
```

**Demo video** (YouTube, unlisted is fine). Record on the phone (~60 s):

1. Fresh install → onboarding → Inbox (show manual add works without permissions).
2. Settings → *Read bank SMS* → the **in-app disclosure screen** (scroll it) →
   *Allow SMS access* → Android permission prompt → Allow.
3. Recent bank payments appear in the Inbox → swipe one right → split with a friend.
4. Make a small UPI payment → the card appears within seconds.
5. Settings → switch an account off / toggle SMS off (opens system settings).

**If rejected:** ship notification-only (see README step 4). Bank SMS still arrive
through the Messages app's notifications, but there is no 30-day backfill.
