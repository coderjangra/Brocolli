# Data safety form answers

Play's definitions: data is **collected** only if it is transmitted off the device,
and **shared** only if it goes to a third party. Data processed only on the device
is neither. Brocolli v1 has no server, no analytics and no ads SDK, so:

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **No** |
| Is all of the user data collected by your app encrypted in transit? | Not applicable (nothing is transmitted) |
| Do you provide a way for users to request that their data is deleted? | Data never leaves the device; users erase it in **Settings → Erase everything** or by uninstalling |

Notes for reviewers / your own reference:

- SMS and notification content is read **on-device only**, filtered in Kotlin
  (`modules/payment-capture/.../CaptureFilter.kt`), and only payment fields are kept.
- User-initiated sharing (payment request message, CSV/JSON export, opening a UPI
  app) is the user choosing to send data to another app, which Play does not count
  as sharing.
- `android:allowBackup` is on: Android's own device backup may include app data.
  That's controlled by the user's Google account, not by the developer.

**Re-do this form before shipping cloud sync (M7).** Sync would make it *collected*:
financial info (purchase history), name, phone number, contacts you add.
