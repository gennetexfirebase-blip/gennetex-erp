# Android production build

Project: `@gennetex-llc/gennetex-erp` (`cb452a57-01d9-4222-ab7e-a46e17c7e673`).
Application ID: `com.gennetex.erp`. Production output: signed Android App Bundle (`.aab`).

## Changes

- `.easignore`: carries over the existing Git exclusions, excludes local tooling and
  generated APK/AAB files, and ends with `!google-services.json`. Being tracked by
  Git did not override the ignore rule used when EAS prepared the upload.
  The Firebase client configuration is included; `.env*`, service-account keys,
  signing credentials, and generated native files remain excluded.
- `app.config.js`: inherits the plugin list from `app.json` without conditionally
  removing or duplicating native plugins. Android uses the optional EAS file
  variable `GOOGLE_SERVICES_JSON`, falling back to `./google-services.json`.
  The optional iOS file existence check is relative to the project directory.
- `app.json`: registers Firebase Messaging once; migrates the obsolete `splash`
  field to `expo-splash-screen` with the same logo, background, and resize mode;
  registers `expo-font` and `expo-sharing`. Preserves the existing owner, EAS
  project ID, application ID, permissions, and application functionality.
- `eas.json`: explicitly selects the `production` environment and `store`
  distribution. Retains `app-bundle`, remote version management, and automatic
  version increments. Removes the manually set `NODE_ENV=production` so dependency
  installation is not forced to omit development build tools.
- `package.json` and `package-lock.json`: align Expo dependencies with SDK 57 patch
  versions; add the required `expo-font` peer dependency and `expo-system-ui`
  for the existing automatic UI style setting.
- `scripts/sync-google-services.js`: respects the same optional Firebase file
  variable as the Expo config.
- `.gitignore`: inspected and left unchanged by this fix; `.easignore` controls
  the build upload independently.

The existing public Supabase URL, public anon key, and developer email were stored
as sensitive EAS production environment variables. Their values are not hardcoded
in the source. Backend credentials and private AI keys were not uploaded.

## Verification

- EAS production build: **FINISHED**, version `1.4.1`, Android version code `10`.
  [Build page](https://expo.dev/accounts/gennetex-llc/projects/gennetex-erp/builds/71b72365-f596-4750-ac20-45d4dc530bb7)
  and [signed AAB download](https://expo.dev/artifacts/eas/LJPJma3UhWerM9poS41OJGx7cxs4EFkVoVTOGF_hqls.aab).
  Cloud prebuild, release compilation, release lint, signing, and artifact upload
  completed. This does not certify Google Play review or physical-device behavior.
- `expo config --type prebuild`: passed with the expected owner, Android package,
  Firebase file, and a consistent plugin list.
- Clean Android prebuild: passed. `android/app/google-services.json` matches the
  root file byte for byte. Firebase manifest conflict overrides and incoming-call
  activity/service declarations are present.
- EAS archive inspection: the uploaded Firebase file matches the root file's
  SHA-256. No environment files, Firebase admin credentials, signing files, or
  generated Android files are included (the inspection copy has empty directories).
- Expo Doctor: 20/21 checks pass. The remaining React Native Directory metadata
  check reports untested New Architecture support for CallKeep, incoming-call,
  in-call-manager, and WebRTC, and missing metadata for ML Kit and ONNX packages.
  These warnings are not suppressed. A successful compile does not replace
  physical-device testing of calls, notifications, and face recognition.

The Expo CLI no longer supports `npx expo doctor`; use `npx expo-doctor`.
On Windows PowerShell with script execution disabled, use the `.cmd` wrappers below.
The clean prebuild regenerates `android/`; a backup of the previous native tree is
in `tmp/android-before-eas-20260916/android`.

## Commands

```powershell
npx.cmd expo-doctor
npx.cmd expo config --type prebuild
npx.cmd expo prebuild --platform android --clean
eas.cmd build -p android --profile production
```

Download the finished `.aab` from the production build page on Expo.dev and upload
it to the intended Google Play Closed Testing track. No Play submission is run by
the build command. The existing submit profile targets internal testing and is
not used here.

References: [EAS ignore rules](https://docs.expo.dev/build-reference/easignore/),
[Expo Doctor](https://docs.expo.dev/develop/tools/#expo-doctor),
[app config resolution](https://docs.expo.dev/workflow/configuration/).
