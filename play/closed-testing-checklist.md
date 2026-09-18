# Google Play closed testing checklist

## Release artifact

- [x] Increase the Android version to `0.1.5` with version code `6`.
- [x] Run `./gradlew clean test lint bundleRelease` from `apps/android`.
- [x] Verify the generated AAB with `jarsigner`.
- [ ] Upload `apps/android/app/build/outputs/bundle/release/app-release.aab` as an update to the main Closed testing track.
- [ ] Add the English and Polish notes from `play/store-listing`.

## Closed track

- [ ] Open Test and release > Testing > Closed testing in Play Console.
- [ ] Create a track named `closed` or manage the default closed track.
- [ ] Select the existing tester email list or a Google Group.
- [ ] Set the feedback address to `webmaster@vespy.eu`.
- [ ] Select the intended countries and regions.
- [ ] Review the release, resolve all errors, and start the rollout.
- [ ] Share the closed-test opt-in link with eligible testers.

## Production eligibility for new personal accounts

- [ ] Keep at least 12 testers opted in continuously for 14 days.
- [ ] Ask testers to exercise locations, themes, forecasts, warnings, and both widget types.
- [ ] Collect feedback through Play testing feedback or the published feedback address.
- [ ] Record tester feedback and the changes made in response.
- [ ] Apply for production access from the Play Console dashboard after the requirement is met.
