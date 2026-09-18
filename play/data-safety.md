# Google Play Data Safety draft

Verify every answer against the production build and the current Play Console wording before submission.

## Data collection and sharing

- The app collects or transmits user data: Yes.
- Data is encrypted in transit: Yes, production endpoints use HTTPS.
- Users can request deletion: No account or server-side profile is created. Local data can be deleted by clearing app storage or uninstalling the app. Operational logs follow server log rotation.
- The app allows users to request that data is deleted without deleting an account: Review this answer in Play Console. The app has no account and no durable user profile.

## Data types

### Approximate location

- Collected: Yes. A searched or device-derived location is sent to the Weather API to obtain forecasts.
- Shared: Service-provider processing may apply for Open-Meteo and OpenStreetMap Nominatim. Official warnings are retrieved from MeteoAlarm country feeds without sending the selected coordinates to MeteoAlarm. Use Play Console's service-provider exception where applicable.
- Purpose: App functionality.
- Processing: Required for a selected forecast. Device permission itself is optional because users can search manually.

### App activity

- Collected: Only after explicit analytics consent.
- Data: App interactions such as forecast loads, display-setting changes, and promotion impressions or clicks.
- Purpose: Analytics.
- Optional: Yes. Collection is disabled by default and can be withdrawn in Settings.

### Device or other identifiers

- Collected: Treat the Firebase app instance identifier as collected only after analytics consent. Advertising ID permissions are explicitly removed from the merged manifest.
- Purpose: Analytics.
- Optional: Yes.

### Search input and saved preferences

- Place searches are transmitted to the Weather API and geocoding provider to return results.
- Saved locations, widget settings, theme, units and display preferences remain on the device.
- Coordinates and place names are not included in Firebase Analytics events.

## Security practices

- HTTPS is required by the Android network configuration.
- Advertising storage, advertising user data and ad personalization are denied.
- Firebase Analytics collection is disabled until consent is granted.
- No account, password, payment or contact information is requested.
