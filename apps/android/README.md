# Vespy Weather for Android

The native Android application uses Kotlin and Jetpack Compose. It shares the Weather API contract, localization terminology, visual language, and promotion feed with the web client.

## Requirements

- JDK 17
- Android SDK 37
- Android build tools 36.0.0

## Build

From this directory:

```bash
./gradlew assembleDebug
```

The API base URL is configurable without source changes:

```bash
./gradlew assembleDebug -PWEATHER_API_BASE_URL=https://api.weather.vespy.eu/
```

Builds use `https://api.weather.vespy.eu/` by default.

The debug APK is written to `app/build/outputs/apk/debug/app-debug.apk`.

## Firebase Analytics

The app is registered in Firebase as Android package `eu.vespy.weather`. Its `google-services.json` file belongs in the `app/` directory and is processed by the Google Services Gradle plugin.

Analytics collection is disabled by default. On first launch, the app asks for consent and also exposes the same preference in Settings. Advertising storage, user data, and personalization remain disabled even when usage analytics are enabled.

The app records privacy-safe events for successful forecast loads, location selection source, display preference changes, and promotion impressions and clicks. It does not send place names, coordinates, or weather search text as event parameters.

## Issue reports

The app and widget settings include an optional issue-report form. Every report contains the user's description and app version. With the diagnostic option enabled, it also contains device and display characteristics, app and widget display settings, location names, an application screenshot, and cached images of rendered widgets. Precise coordinates and raw forecast data are excluded. Reports are uploaded over HTTPS to `POST /issue-reports` and stored in the server directory configured by `WEATHER_REPORT_DIRECTORY`.
