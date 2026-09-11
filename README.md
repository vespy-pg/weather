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

## User settings

The web application stores these preferences in browser local storage:

- selected location from Open-Meteo geocoding or browser geolocation;
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
