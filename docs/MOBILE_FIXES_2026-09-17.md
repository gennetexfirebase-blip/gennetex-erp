# Gennetex ERP mobile fixes — 2026-09-17

## Changes

| Files | Result |
| --- | --- |
| `src/services/backgroundLocationService.js` | Exact Mongolian disclosure via native Alert, before foreground/background requests. Cancellation/denial does not start tracking. Passive startup only resumes an already authorized active session. Failed native startup clears saved tracking state. |
| `src/components/LocationTracker.js` | Removed automatic disclosure navigation and permission prompts. Foreground uploads also require successful authorized tracking. Cancels stale resume work when the effect ends. |
| `src/context/AppContext.js` | Explicit check-in may request tracking; startup and polling stay silent. Inventory/fuel loading waits for authentication/demo restoration. Ignores unrelated real-auth events during demo. |
| `src/screens/AttendanceScreen.js` | Successful check-in explicitly enters the tracking disclosure flow; check-out does not prompt. Attendance itself remains saved if tracking is declined. |
| `src/screens/LocationConsentScreen.js`, `src/screens/ProfileScreen.js` | Manual tracking controls use the same disclosure/permission flow. |
| `src/lib/demoClient.js` | Fixed `.single()` method collision, upsert, filtering, cardinality, counts and repeat mutation execution. Profile edits survive reload. Employee RPC mutations update sample data. Box list returns an array. Local change subscriptions update chat immediately. |
| `src/lib/demoData.js`, `src/services/authService.js` | Consistent UUID employee identities and current inventory/vehicle schema for sample data. |
| `src/services/deviceAuthService.js`, `App.js` | Demo does not wait for real device approval or a personal device PIN. Real account gates remain in place. |
| `src/screens/StoreReadinessScreen.js` | Correct legacy file-system import for the cache-directory API. |
| `src/screens/LoginScreen.js`, `src/components/LegalLinks.js` | Compact branded login, clear labels and focus states, password visibility, keyboard Next/Go, accessible fields/errors, scrollable small-screen layout and compact legal links. Existing Google/Apple/password authentication retained. |
| `src/context/CallContext.js` | Clears the 45-second unanswered-call timer on server acceptance or WebRTC connection. Queued stale timeout callbacks cannot end an accepted/connected call. Unanswered calls still time out. |
| `src/services/voiceRecordingSession.js`, `src/components/VoiceRecorderBar.js` | Serializes press/prepare/release, avoids starting the microphone after release, cleans up on cancellation/unmount, uses actual recording duration, reports permission/errors, records mono microphone input. |
| `src/components/VoiceMessageBubble.js` | Restores speaker playback mode, volume and mute state, prevents duplicate starts, releases players and shows playback errors. |
| `src/services/chatService.js`, `src/screens/ConversationScreen.js` | Native uploads use actual file bytes and reject empty files. Voice attachments use native MP4/M4A or web WebM metadata. Demo attachments stay local. Recording is disabled during an active app call. |

Existing unrelated workspace changes have been retained.

## Verification

- 33 regression tests passed across `tests/location-disclosure.test.cjs`, `tests/demo-client.test.cjs`, `tests/call-timeout.test.cjs`, `tests/voice-recording.test.cjs`; shared module loader in `tests/helpers/load-app-module.cjs`.
- Targeted ESLint checks passed.
- Android Hermes bundle export succeeded: `tmp/android-final-fixes-export`.
- EAS production build `5750e074-37e3-41ce-9ef3-ac42c8068ff9` finished successfully with Android versionCode 11 and a `.aab` artifact. [Build details](https://expo.dev/accounts/gennetex-llc/projects/gennetex-erp/builds/5750e074-37e3-41ce-9ef3-ac42c8068ff9). [Download AAB](https://expo.dev/artifacts/eas/6XXgWWFGDAtPz85HzCam-l2OkizE4vkyAHvgeFaGp1k.aab).
- Cloud `expo doctor` reported 19/21 checks: React Native Directory has no/untested metadata for existing native libraries, and `expo-build-properties` was 57.0.19 while its recommended patch is 57.0.20. Prebuild, bundle and Gradle still completed.
- Browser: mobile login at 390×844, password visibility and demo sign-in; inventory list, employee directory, direct chat and immediate local message display.
- Screenshots: `tmp/login-final-mobile.png`, `tmp/demo-inventory-fixed.png`, `tmp/demo-chat-fixed.png`.
- No Android device was connected. Actual two-device call audio/video beyond one minute, recorded voice audibility, and the native Android disclosure/system-dialog sequence still require device verification. Automated tests exercise the permission ordering and timeout behavior, not native hardware.
- Demo fixes cover the reproduced paths above; the demo adapter does not implement every backend capability. This is not a claim that every ERP screen has been tested.

## Build

```powershell
eas.cmd build -p android --profile production
```

Owner remains `gennetex-llc`, Android package remains `com.gennetex.erp`, production output remains an Android App Bundle.

Audio API reference: [Expo Audio documentation](https://docs.expo.dev/versions/latest/sdk/audio/).
Native file-upload reference: [Supabase React Native Storage guidance](https://supabase.com/docs/reference/javascript/v1/storage-from-upload).
