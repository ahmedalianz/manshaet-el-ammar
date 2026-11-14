# Firebase token fetch failure — emulator DNS

Observed error: Firestore could not reach its backend because fetching an Auth token failed with auth/network-request-failed.

Read-only diagnosis:
- Mac resolved securetoken.googleapis.com, identitytoolkit.googleapis.com and firestore.googleapis.com and received HTTPS responses.
- Android emulator returned unknown host for securetoken.googleapis.com.
- Emulator was not in airplane mode. Android used the emulator DNS alias 10.0.2.3.

Remedy: gracefully stopped the Pixel_10 emulator, waited for its process to exit, and relaunched it using explicit DNS without loading its prior snapshot:

    ~/Library/Android/sdk/emulator/emulator -avd Pixel_10 -dns-server 8.8.8.8,8.8.4.4 -no-snapshot-load

Restored Metro's adb reverse mapping for port 8081. No app data was cleared, and no Firebase authentication, project configuration, security rules, credentials or production records were changed.

Verified afterward: Android resolved securetoken.googleapis.com and received a ping response. App reopened with its existing signed-in session; connection warning disappeared, actual public provider contact controls loaded, and the health shortcut loaded live doctor/pharmacy categories.

Android documentation: https://developer.android.com/studio/run/emulator-networking-dns

This fixes the current emulator session. If a future emulator launch inherits bad DNS again, close it first and relaunch with the command above. Do not run a second writable emulator instance for the same AVD.
