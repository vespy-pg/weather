# Google Play internal testing checklist

## Before upload

- [ ] Create the Play Console app with package name `eu.vespy.weather`.
- [ ] Confirm Android developer identity and device verification are complete.
- [ ] Enrol the app in Play App Signing.
- [ ] Create and securely back up an upload key.
- [ ] Copy `apps/android/keystore.properties.example` to `apps/android/keystore.properties` and enter the real upload-key values.
- [ ] Run `./gradlew clean test bundleRelease` from `apps/android`.
- [ ] Confirm the generated AAB is signed with the upload key.
- [ ] Upload `apps/android/app/build/outputs/bundle/release/app-release.aab` to Internal testing.

## Play Console setup

- [ ] Upload the title, descriptions, icon, feature graphic and screenshots from `play/store-listing/en-US`.
- [ ] Set category to Weather and contact email to `vespy.weather@gmail.com`.
- [ ] Publish `https://weather.vespy.eu/privacy.html` before entering it as the privacy-policy URL.
- [ ] Complete App access, Ads, Target audience, Content rating and Data Safety using the drafts in `play/`.
- [ ] Add tester email addresses or a Google Group to the internal track.
- [ ] Add release notes from `play/store-listing/en-US/release-notes.txt`.
- [ ] Review automated pre-launch and policy reports before promoting the build.

## New personal account production path

- [ ] After internal testing, create a closed test.
- [ ] Keep at least 12 testers opted in continuously for 14 days.
- [ ] Collect feedback and record changes made from it.
- [ ] Apply for production access after the testing requirement is satisfied.
