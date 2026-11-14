# Android hardware Back

- Tab navigator explicitly starts at Home using Expo Router's layout settings and `backBehavior="initialRoute"`. Back from other tabs returns Home.
- `AndroidBackBoundary` is mounted once at the root. It lets normal navigation handle routes with history. For a route without history, it returns Home; on Home it consumes Back rather than letting Android close the app.
- The fallback registers during layout effects before passive/focus handlers and does not re-register on route changes. Focused forms retain priority: step two returns to step one, pending submission consumes Back, and dirty form removal uses the existing confirmation guard. Native modals retain `onRequestClose` cancellation. iOS is unchanged.

Verification on 5 November 2026:

- 33 focused tests across four suites passed: fallback paths/cleanup/platform handling, form hardware Back and unsaved-change confirmation, feedback and admin dialogs.
- Android emulator: More → hardware Back → Home; repeated hardware Back on Home retained the application foreground activity; More → Sign In → hardware Back → More. No credentials were entered and no account data was modified.
- Source typecheck passed before unrelated concurrent animation tests were added. The later whole-workspace run had two type errors and three assertions in the newly edited `animated-success-check.test.tsx`; these files are outside this change. No global all-checks-pass claim is made for that snapshot.
- Physical-device predictive gestures and every route were not individually device-tested. The shared root fallback covers them; representative no-history routes have automated tests.

## Edge-swipe correction

Android edge gestures were not covered by the original three-button/key-event check. The app had `android.predictiveBackGestureEnabled: true`, which can bypass JS BackHandler on affected Android/React Native combinations. Set it to `false` through app.json and regenerated Android using Expo prebuild; the generated manifest now has `android:enableOnBackInvokedCallback="false"`. Ordinary edge-swipe navigation remains available; the predictive preview is disabled. No hand-edited native patch or dependency upgrade is used.

This is a native configuration fix: rebuild and reinstall the application. Metro reload/OTA updates alone cannot change an already installed AndroidManifest. The existing JS navigation/form/modal guards are preserved. A config regression assertion prevents accidental re-enabling while this compatibility workaround is required.

Upstream report: https://github.com/react/react-native/issues/58407. The report documents similar behavior; it is not proof of a particular physical device's behavior.

### Native APK verification — 6 November 2026

- Installed `android/app/build/outputs/apk/debug/app-debug.apk` on the local emulator using replacement install (data retained).
- `aapt2 dump xmltree` confirmed the **packaged APK**, not only the source manifest, has `enableOnBackInvokedCallback=false`.
- Enabled the emulator's gesture navigation overlay and confirmed `config_navBarInteractionMode=2`.
- Left-edge Back navigated to the prior in-app screen without closing the activity. Right-edge Back from Privacy returned to Home. Left/right edge swipes on fresh Home kept the app in the foreground.
- Restored the original three-button navigation overlay after testing. No credentials were entered and no production records were modified.
- Fresh verification: 20 focused tests passed, TypeScript and ESLint passed. This APK is a debug/development build; no signed production release or store upload was performed.

Install a rebuilt Android binary on the affected physical phone to apply this native fix. A JS reload or OTA update does not update its manifest. The physical phone itself was not available for these tests.
