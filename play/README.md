# Google Play release package

This directory contains the material needed to create the first Google Play internal-testing release for `eu.vespy.weather`.

## Store listing

Upload the files from `store-listing/en-US` to the English (United States) main store listing:

- `title.txt`: app title, maximum 30 characters.
- `short-description.txt`: short description, maximum 80 characters.
- `full-description.txt`: full description, maximum 4,000 characters.
- `release-notes.txt`: testing-release notes.
- `graphics/icon.png`: 512 x 512, 32-bit PNG.
- `graphics/feature-graphic.png`: 1024 x 500, 24-bit PNG without transparency.
- `graphics/phone-screenshots`: four 1920 x 1080, 24-bit PNG screenshots.
- `graphics/alt-text.txt`: accessible descriptions for uploaded graphics.

Editable SVGs, raw captures and the original approved icon are in `store-listing/source`.

## Policy material

- `app-content.md` contains proposed Play Console declarations.
- `data-safety.md` maps actual app behaviour to the Data Safety form.
- `internal-testing-checklist.md` lists the remaining account and upload steps.
- The public policy source is `apps/web/privacy.html` and should be deployed at `https://weather.vespy.eu/privacy.html` before submission.

## Release signing

Google Play requires an Android App Bundle signed with the upload key. Create and back up the key securely:

```bash
cd apps/android
keytool -genkeypair -v -keystore weather-upload.jks -alias weather-upload -keyalg RSA -keysize 4096 -validity 10000
cp keystore.properties.example keystore.properties
```

Replace the placeholders in `keystore.properties`, then build and verify the release:

```bash
./gradlew clean test bundleRelease
jarsigner -verify -verbose -certs app/build/outputs/bundle/release/app-release.aab
```

The real keystore and property file are ignored by Git. Store the key and passwords in a secure backup. Losing the upload key requires an upload-key reset through Play Console.

## Current Google Play specifications

- Preview assets: https://support.google.com/googleplay/android-developer/answer/9866151
- Internal testing: https://support.google.com/googleplay/android-developer/answer/9845334
- App signing: https://developer.android.com/studio/publish/app-signing
