# Google Play Data Safety declaration

Verify every answer against the production build and the current Play Console wording before submission.

The response matrix below was verified against the Play Console CSV export on 2026-09-19. Treat it as the canonical declaration until the application's data handling changes.

## Play Console response matrix

### General responses

- Collects or shares required user data types: Yes.
- All collected user data is encrypted in transit: Yes.
- Account creation methods: The app does not allow users to create an account.
- Users can sign in with accounts created outside the app: No.
- Users can request data deletion: Yes.
- Data deletion information URL: `https://weather.vespy.eu/privacy.html`.
- Families policy badge: Not selected.
- Independent security review badge: Not selected.
- UPI badge: Not selected.

### Selected data types and handling

All selected types are marked as collected, not shared, not processed ephemerally, and optional.

| Data type | Collection purposes |
| --- | --- |
| Approximate location | App functionality |
| Diagnostics | App functionality, Analytics |
| App interactions | Analytics |
| In-app search history | App functionality |
| Other user-generated content | App functionality |
| Device or other IDs | Analytics |

No other data types are selected. In particular, precise location, crash logs, photos, videos, files, personal information, financial information and installed apps are not selected.

## Data collection and sharing

- The app collects or transmits user data: Yes.
- Data is encrypted in transit: Yes, production endpoints use HTTPS.
- Users can request deletion: Yes. Issue reports return a report ID that can be sent to `vespy.weather@gmail.com` with a deletion request. Reports are also deleted automatically no later than 30 days after submission. Local data can be deleted by clearing app storage or uninstalling the app. Operational logs follow server log rotation.
- The app allows users to request that data is deleted without deleting an account: Yes, for optional issue reports. The app has no account.

## Data types

### Approximate location

- Collected: Yes. A searched or device-derived location is sent to the Weather API to obtain forecasts.
- Shared: No. Open-Meteo and OpenStreetMap Nominatim process it as service providers. Official warnings are retrieved from MeteoAlarm country feeds without sending the selected coordinates to MeteoAlarm.
- Purpose: App functionality.
- Processing: Not ephemeral. The API uses short-lived in-memory caches and operational request logs may contain request parameters.
- Optional: Yes. Device location permission is optional because users can search manually.

### App activity

- App interactions are collected only after explicit analytics consent. Examples include forecast loads, display-setting changes, and promotion impressions or clicks.
- App interactions are not shared, not processed ephemerally, optional, and used for analytics.
- In-app search history is collected to return place search results. It is not shared, not processed ephemerally, optional, and used for app functionality.
- Other user-generated content is collected only when the user submits an issue description. It is not shared, not processed ephemerally, optional, and used for app functionality.

### Device or other identifiers

- Collected: Treat the Firebase app instance identifier as collected only after analytics consent. Advertising ID permissions are explicitly removed from the merged manifest.
- Shared: No.
- Processing: Not ephemeral.
- Purpose: Analytics.
- Optional: Yes.

### User-generated content and diagnostics

- Collected: Only when the user explicitly submits an issue report.
- Data: The entered problem description and app version. If the diagnostic option remains enabled, the report also contains the device manufacturer and model, Android/API version, screen dimensions, display density, font scale, app and widget display settings, location names, diagnostic images of the app and every widget, exact rendering dimensions, and sanitized forecast values needed to reproduce widget rendering.
- Excluded: Precise coordinates are not included in issue reports.
- Purpose: The issue description is used for app functionality. Diagnostic data is used for app functionality and analytics, specifically troubleshooting and resolving the reported problem.
- Optional: Yes. Sending a report is optional, and diagnostic details and images can be disabled before submission.
- Retention: Reports and their diagnostic attachments are automatically deleted no later than 30 days after submission.
- Sharing: No sale or advertising use. Hosting providers may process the report as service providers. A notification provider may receive only the opaque report ID and app version, never the description, device details, location names, or images.

### Play Console checklist for optional issue reports

- Other user-generated content: Collected, optional, not shared, used for app functionality. This covers the free-form issue description.
- Diagnostics: Collected, optional, not shared, used for analytics and app functionality. This covers device and display characteristics, rendering manifests, widget images, and sanitized render inputs used to diagnose and reproduce defects.
- App interactions: Collected, optional, not shared, used for analytics. This covers the app and widget display choices included in a diagnostic report.
- Approximate location: Keep the existing declaration. A diagnostic report can include a location name and timezone only when the user leaves diagnostics enabled; precise coordinates are excluded.
- Device or other IDs: No additional identifier is collected by issue reports. Widget IDs are local application object IDs and are not persistent device or advertising identifiers.
- Photos and videos: Diagnostic app and widget renderings are generated by the application and do not access the user's photo or video library. Verify this answer against the exact current Play Console wording when submitting the form.
- Collection is initiated by an explicit user action and can be submitted without diagnostics. Mark these report-specific data types as optional.

### Search input and saved preferences

- Place searches are transmitted to the Weather API and geocoding provider to return results.
- Saved locations, widget settings, theme, units and display preferences remain on the device.
- Coordinates and place names are not included in Firebase Analytics events.

## Security practices

- HTTPS is required by the Android network configuration.
- Advertising storage, advertising user data and ad personalization are denied.
- Firebase Analytics collection is disabled until consent is granted.
- No account, password, payment or contact information is requested.
