# Weather

Weather is a shared weather platform for a responsive web application and native Android home-screen widgets. It extracts the forecast visualization originally developed for Akacjowa into a standalone product with its own location selection, user settings, API, and deployment boundary.

## Repository structure

```text
apps/
  api/      Node.js API and static web server
  web/      Responsive weather application
  android/  Reserved native Android and Jetpack Glance application
packages/
  weather-contract/  OpenAPI contract shared by all clients
```

## Run locally

Node.js 20 or newer is required. The project has no third-party runtime dependencies.

```bash
npm start
```

Open `http://127.0.0.1:8080/`. Use `http://127.0.0.1:8080/?demo=1` to inspect deterministic extreme-weather fixture data without contacting a weather provider.

## Online demo

GitHub Pages deploys the static demo from `apps/web` after every push to `main`. Pages automatically uses the built-in ten-day demonstration dataset because the standalone API is not available on a static host.

## Install and embed

The web client includes a PWA manifest and service worker, so supported browsers can install it on a desktop or mobile home screen.

Open Settings and copy the generated iframe to embed the forecast in another website. The URL accepts these parameters:

- `embed=1` shows the forecast timeline and its legend without the surrounding dashboard.
- `lat`, `lon`, `name`, and `timezone` select a location.
- `theme=dark` or `theme=light` selects the color theme.
- `demo=1` uses the built-in demonstration dataset.

Example:

```html
<iframe src="https://vespy-pg.github.io/weather/?embed=1&demo=1&theme=dark" title="10-day weather forecast" width="100%" height="680" loading="lazy" style="border:0;border-radius:12px"></iframe>
```

An Android home-screen widget should remain a separate native client that consumes the contract in `packages/weather-contract/openapi.yaml`.

## User settings

The web application stores these preferences in browser local storage:

- selected location from Open-Meteo geocoding or browser geolocation;
- light or dark color theme;
- default timeline zoom;
- hourly temperature labels;
- apparent temperature area;
- precipitation symbols;
- wind timeline.

No location account or server-side profile is required. The API caches upstream responses in memory for ten minutes by default. Set `WEATHER_CACHE_TTL_MS` to change the cache duration and `WEATHER_ALLOWED_ORIGIN` to restrict cross-origin API access before exposing it to another application.

## Checks

```bash
npm run check
npm test
```

## Akacjowa integration

Akacjowa will eventually consume `/api/weather` from this service instead of maintaining its own provider integration. The existing Akacjowa forecast remains intact until the standalone service has a stable deployment URL.
