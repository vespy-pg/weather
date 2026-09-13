# Weather

A visual ten-day weather forecast that makes changing conditions easy to understand at a glance. Instead of stacking many unrelated charts, Weather puts temperature, apparent temperature, sunlight, clouds, rain, snow, hail, thunderstorms, and wind on one continuous hourly timeline.

[Open the live demo](https://vespy-pg.github.io/weather/)

The public demo uses fictional data so every weather phenomenon can be inspected without an API server. Run the project locally or deploy its Node.js server to use live Open-Meteo forecasts and location search.

## What the forecast shows

- A scrollable ten-day hourly timeline that stays readable on phones.
- Temperature and apparent temperature with meaningful cold, comfort, heat, and frost colors.
- Continuous sunlight and cloud cover instead of a row of repeated weather icons.
- Rain, snow, hail, fog, and thunderstorms with probability and intensity encoded visually.
- Flowing wind bands that progress from nearly straight and faded in calm conditions to wider waves with increasing amplitude in stronger wind, with tapered event edges, an explicit tornado funnel, and optional hourly direction arrows and speed values.
- Ten daily forecast cards, starting today.
- Dark and light themes saved for the next visit.
- Celsius or Fahrenheit display with adjustable temperature color thresholds and a fixed water-freezing boundary.
- English and Polish interfaces, also available to embedded widgets.
- A clear built-in legend explaining every symbol and color.

## Install it like an app

Weather is a Progressive Web App. No app store is required.

### Android

1. Open the deployed Weather URL in Chrome.
2. Open the browser menu.
3. Choose **Install app** or **Add to Home screen**.
4. Confirm the installation. Weather will open from its own home-screen icon.

### Desktop

1. Open Weather in Chrome or Edge.
2. Select the install icon in the address bar, or open the browser menu and choose **Install Weather**.
3. Confirm the installation. Weather will run in its own window.

### iPhone and iPad

1. Open Weather in Safari.
2. Tap **Share**.
3. Choose **Add to Home Screen** and confirm.

The native Android home-screen widget is planned as a separate client of the same weather API. The current PWA can already be installed and launched like an application.

## Embed the weather widget on a website

Open **Settings** in Weather and use **Embed on a website** to copy an iframe configured for the selected location and theme. Paste that code into any HTML page:

```html
<iframe
  src="https://weather.vespy.eu/pl-PL/Katowice?ll=50.26489%2C19.02378&embed=1&theme=dark"
  title="10-day weather forecast"
  width="100%"
  height="680"
  loading="lazy"
  style="border:0;border-radius:12px"
></iframe>
```

The embedded view contains the forecast timeline and its legend without the dashboard header or daily cards. It is responsive and can be placed in a page, dashboard, kiosk, or web-based desktop panel.

Public forecast URLs use `/{language}/{location}` paths and keep exact coordinates in `ll`, for example `https://weather.vespy.eu/pl-PL/London?ll=51.50740%2C-0.12780`. The readable location segment is used for display while `ll` prevents ambiguity between places with the same name.

Supported URL parameters:

| Parameter | Purpose | Example |
|---|---|---|
| `embed` | Enable the compact widget layout | `embed=1` |
| `theme` | Select a dark or light appearance | `theme=light` |
| `unit` | Select Celsius or Fahrenheit temperature display | `unit=F` |
| `zoom` | Set the initial timeline zoom from 25% to 200%; compact levels group values into 6, 4, 3, or 2-hour intervals | `zoom=0.5` |
| `ll` | Select an exact latitude and longitude for the location path | `ll=50.67,19.12` |
| `demo` | Use fictional demonstration data | `demo=1` |
| `guide` | Force the first-visit forecast guide to open | `guide=1` |
| `share` | Force the expanded share prompt to appear | `share=1` |

GitHub Pages is a static demonstration, so it always shows the demo dataset. Location parameters return live data only when the Node.js API is deployed with the web application.

## Run your own live weather instance

Node.js 20 or newer is required. There are no third-party runtime dependencies.

```bash
git clone https://github.com/vespy-pg/weather.git
cd weather
npm start
```

Open `http://127.0.0.1:8080/`. On the first visit, the application selects the capital of the visitor's country and requests browser location permission. When permission is granted, it uses OpenStreetMap Nominatim to resolve the coordinates to the nearest named locality and replaces the capital. Open `http://127.0.0.1:8080/?demo=1` to inspect the fictional extreme-weather dataset without contacting a weather provider.

Settings are stored immediately after each change and only in the browser. No account is required. The API caches upstream responses in memory for ten minutes by default.

Optional environment variables:

- `PORT` changes the HTTP port from `8080`.
- `WEATHER_CACHE_TTL_MS` changes the upstream cache duration.
- `WEATHER_ALLOWED_ORIGIN` restricts cross-origin API access. It defaults to `*`.
- `GOOGLE_ANALYTICS_ID` enables consent-gated Google Analytics 4 when set to a valid `G-...` measurement ID.

## Project structure

```text
apps/
  api/      Node.js API and static web server
  web/      Responsive web application and embeddable PWA
  android/  Reserved native Android and Jetpack Glance application
packages/
  i18n/     Shared localization source catalog, locale manifest, validation, and generators
  weather-contract/  OpenAPI contract shared by all clients
```

The server exposes:

- `GET /health`
- `GET /locations?q=...`
- `GET /reverse-location?latitude=...&longitude=...&timezone=...&language=...`
- `GET /promotions?platform=...&placement=...&language=...&theme=...`
- `GET /weather?latitude=...&longitude=...&timezone=...&name=...`

The API contract is available in [`packages/weather-contract/openapi.yaml`](packages/weather-contract/openapi.yaml).
Promotion delivery rules are documented in [`docs/promotion-feed.md`](docs/promotion-feed.md).

## Verify a change

```bash
npm run check
npm test
```

GitHub Pages deploys `apps/web` automatically after every push to `main`.

## Run with Docker

Build and run the complete web application and live API:

```bash
docker build -t weather .
docker run --rm -p 127.0.0.1:8080:8080 weather
```

The application uses root-relative asset and API URLs so localized forecast paths can be opened directly.

The production templates for `vespy.eu`, its `www`, the canonical `weather.vespy.eu` web host, the Polish `pogoda.vespy.eu` redirect, and `api.weather.vespy.eu` are stored in `deploy/`. The Apache virtual hosts proxy to a container bound only to `127.0.0.1:18080`, while the systemd unit keeps that container running after reboots. The virtual hosts use the local GeoIP database and `mod_geoip` to pass only the visitor's country code to the application, so visitor IP addresses are not sent to an external location service.

Search engines receive server-rendered localized titles, descriptions, canonical URLs, `hreflang` alternatives, and WebApplication structured data. `robots.txt` points to the XML sitemap, while demo and embedded URLs are marked `noindex` to keep duplicate or fictional forecast pages out of search results.

## Akacjowa integration

Akacjowa will eventually consume `/weather` from this service instead of maintaining its own provider integration. Its existing forecast remains intact until the standalone service has a stable live API URL.
