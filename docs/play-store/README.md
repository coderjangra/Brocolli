# Brocolli → Google Play: release checklist

Everything in the repo that Play needs is ready. The items marked **(you)** need your
Play Console account, identity or a decision only you can make.

## 0. What's in this folder

| File | Use |
|---|---|
| `listing.md` | Title, short + full description, category, tags |
| `data-safety.md` | Answers for **App content → Data safety** |
| `sms-declaration.md` | Answers for **App content → Sensitive permissions (SMS)** + video script |
| `graphics/icon-512.png` | Hi-res app icon (512×512) |
| `graphics/feature-graphic.png` | Feature graphic (1024×500) |
| `../privacy/index.html` | Privacy policy page to host publicly |

## 1. Build the upload bundle

The upload key lives **outside the repo**:

- keystore: `C:\Users\chira\.brocolli\brocolli-upload.jks`
- passwords: `C:\Users\chira\.gradle\gradle.properties` (`BROCOLLI_UPLOAD_*`)

**Back up both now** (password manager + one offline copy). With Play App Signing,
Google holds the real signing key, so a lost upload key can be reset through Play
support. It's still a slow process, so keep the backup.

```
npx expo prebuild --platform android      # android/ is generated; plugins re-apply signing
cd android
./gradlew bundleRelease                   # → app/build/outputs/bundle/release/app-release.aab
```

Before every new upload, bump `expo.android.versionCode` (and usually `expo.version`)
in `app.json`.

Phone-only builds that keep your current install's data (same debug key):

```
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a -PbrocolliDebugSigning=true
adb install -r app/build/outputs/apk/release/app-release.apk
```

> The Play-installed app is signed by Google's key, so it **cannot update** a
> sideloaded copy. Export your data (Settings → Export everything), uninstall the
> sideloaded app, then install from Play.

## 2. Host the privacy policy **(you)**

Play needs a public URL. Easiest: a GitHub repo with Pages enabled, serving `docs/`.

```
node scripts/build-privacy-html.mjs you@example.com   # puts your contact email in the page
```

Then the policy is at `https://<your-user>.github.io/<repo>/privacy/`. Paste that URL into
**App content → Privacy policy** and into the store listing.

## 3. Play Console setup **(you)**

1. Create a developer account (one-time US$25, identity verification).
2. **Create app**: name *Brocolli*, default language English (India), App, Free.
3. **App content** (left menu → Policy):
   - Privacy policy → URL from step 2
   - App access → *All functionality is available without special access* (no login)
   - Ads → *No ads*
   - Content rating → questionnaire: utility/productivity, no violence, no UGC
     sharing, no gambling → expect *Everyone / 3+*
   - Target audience → **18 and over only** (the app asks for 18+ at onboarding)
   - Data safety → see `data-safety.md`
   - Financial features → *My app doesn't provide any financial features*. Brocolli
     tracks and splits expenses; it never holds, moves or lends money.
   - Sensitive permissions → SMS declaration, see `sms-declaration.md`
   - Government apps / News / Health → No
4. **Store listing** → text from `listing.md`, graphics from `graphics/`, plus 2–8 phone
   screenshots (take them on your phone with sample data loaded, not real names;
   Settings → *Add sample payments to Inbox* helps).

## 4. Testing tracks (required for new personal accounts)

Google requires **new personal developer accounts** to run a **closed test with at
least 12 testers opted in for 14 continuous days** before you can apply for
production access.

1. Testing → Closed testing → create track → upload `app-release.aab`.
2. Add testers (a Google Group or email list of your college friends: perfect
   target users anyway). Share the opt-in link.
3. Keep at least 12 opted in for 14 days; collect feedback; push fixes as new
   versionCodes.
4. Dashboard → *Apply for production* and answer the questions about your test.

The SMS declaration is reviewed during this process. If SMS gets rejected,
ship a notification-only build: set `EXPO_PUBLIC_SMS_CAPTURE=0` (hides SMS UI) and
remove the two SMS permissions via `android.blockedPermissions` in `app.json`.
Bank SMS are still caught through the Messages app's notifications.

## 5. Still open before a public launch

- [ ] Hosted privacy policy URL (step 2) with your contact email
- [ ] Screenshots
- [ ] Demo video for the SMS declaration
- [ ] Closed test with 12 testers × 14 days
- [ ] SPEC §13: lawyer review for India DPDP Act before public launch
- [ ] Cloud sync (M7, Supabase) is not built. If you add it, update the privacy
      policy and Data safety form **before** shipping it.
