import assert from 'node:assert/strict';
import test from 'node:test';
import {forecastUrl, isForecastRoutePath, locationSearchUrl, normalizeForecast, normalizeGoogleAnalyticsId, normalizeLocale, normalizeReverseLocation, preferredLanguageForCountry, promotionFeed, selectCapitalResult} from './server.js';

test('normalizeGoogleAnalyticsId accepts only GA4 measurement IDs', () => {
  assert.equal(normalizeGoogleAnalyticsId(' g-ab12cd34 '), 'G-AB12CD34');
  assert.equal(normalizeGoogleAnalyticsId('UA-123-4'), null);
  assert.equal(normalizeGoogleAnalyticsId('G-ABC<script>'), null);
});

test('recognizes localized forecast application routes', () => {
  assert.equal(isForecastRoutePath('/pl-PL/London'), true);
  assert.equal(isForecastRoutePath('/en-US/New-York'), true);
  assert.equal(isForecastRoutePath('/assets/app.js'), false);
  assert.equal(isForecastRoutePath('/pl-PL'), false);
});

test('forecastUrl requests the fields shared by web and Android clients', () => {
  const url = new URL(forecastUrl({latitude: 50.67, longitude: 19.12, timezone: 'Europe/Warsaw'}));
  assert.equal(url.searchParams.get('latitude'), '50.67');
  assert.equal(url.searchParams.get('longitude'), '19.12');
  assert.equal(url.searchParams.get('timezone'), 'Europe/Warsaw');
  assert.equal(url.searchParams.get('forecast_days'), '15');
  assert.match(url.searchParams.get('hourly'), /apparent_temperature/);
  assert.match(url.searchParams.get('daily'), /sunrise/);
});

test('normalizeForecast exposes a stable client-facing shape', () => {
  const source = {
    current: {time: '2026-09-11T12:00', temperature_2m: 21, apparent_temperature: 23, weather_code: 1},
    hourly: {
      time: ['2026-09-11T12:00'],
      temperature_2m: [21],
      apparent_temperature: [23],
      precipitation_probability: [20],
      cloud_cover: [30]
    },
    daily: {
      time: ['2026-09-11'],
      temperature_2m_max: [25],
      temperature_2m_min: [14],
      sunrise: ['2026-09-11T06:20'],
      sunset: ['2026-09-11T18:55']
    }
  };
  const location = {name: 'Test', latitude: 1, longitude: 2, timezone: 'UTC'};
  const result = normalizeForecast(source, location);
  assert.equal(result.current.temperature, 21);
  assert.equal(result.hourly[0].apparentTemperature, 23);
  assert.equal(result.hourly[0].precipitationProbability, 20);
  assert.equal(result.daily[0].temperatureMaximum, 25);
  assert.deepEqual(result.location, location);
});

test('normalizeForecast starts the hourly timeline at the current hour', () => {
  const source = {
    current: {time: '2026-09-11T12:45'},
    hourly: {
      time: ['2026-09-11T11:00', '2026-09-11T12:00', '2026-09-11T13:00'],
      temperature_2m: [18, 19, 20]
    },
    daily: {time: []}
  };
  const result = normalizeForecast(source, {name: 'Test'});
  assert.deepEqual(result.hourly.map(point => point.timestamp), ['2026-09-11T12:00', '2026-09-11T13:00']);
  assert.deepEqual(result.hourly.map(point => point.temperature), [19, 20]);
});

test('selectCapitalResult prefers the matching national capital', () => {
  const results = [
    {name: 'London', country_code: 'CA', feature_code: 'PPL'},
    {name: 'London', country_code: 'GB', feature_code: 'PPLC'},
    {name: 'London', country_code: 'GB', feature_code: 'PPL'}
  ];
  assert.equal(selectCapitalResult(results, 'gb'), results[1]);
  assert.equal(selectCapitalResult(results, 'US'), null);
});

test('locationSearchUrl supports postal codes and the selected language', () => {
  const url = new URL(locationSearchUrl('00-001', 'pl-PL'));
  assert.equal(url.searchParams.get('name'), '00-001');
  assert.equal(url.searchParams.get('language'), 'pl');
});

test('preferredLanguageForCountry selects an available interface language', () => {
  assert.equal(preferredLanguageForCountry('pl'), 'pl-PL');
  assert.equal(preferredLanguageForCountry('DE'), 'en-US');
  assert.equal(normalizeLocale('pl'), 'pl-PL');
  assert.equal(normalizeLocale('en_GB'), 'en-US');
});

test('normalizeReverseLocation uses the nearest named locality and country', () => {
  const fallback = {
    id: 'device-50.6724-19.1824',
    name: 'Current location',
    country: '',
    latitude: 50.67244,
    longitude: 19.18239,
    timezone: 'Europe/Warsaw'
  };
  assert.deepEqual(normalizeReverseLocation({
    addresstype: 'hamlet',
    name: 'Jastrząb Rozparcelowany',
    address: {hamlet: 'Jastrząb Rozparcelowany', village: 'Jastrząb', country: 'Poland'}
  }, fallback), {
    ...fallback,
    name: 'Jastrząb Rozparcelowany',
    country: 'Poland'
  });
});

test('promotionFeed returns a localized native card without executable content', () => {
  const feed = promotionFeed({platform: 'web', placement: 'web_forecast', language: 'pl-PL', theme: 'light'});
  assert.equal(feed.schemaVersion, 1);
  assert.equal(feed.campaigns.length, 1);
  assert.equal(feed.campaigns[0].type, 'native-card');
  assert.equal(feed.campaigns[0].eyebrow, '');
  assert.equal(feed.campaigns[0].title, 'Projektuj instalacje elektryczne oraz budynki w 2D i 3D');
  assert.equal(feed.campaigns[0].description, 'Rozdzielnice i kompletna dokumentacja w jednym miejscu.');
  assert.equal(feed.campaigns[0].actionLabel, 'Poznaj DINPanel');
  assert.equal(feed.campaigns[0].backgroundColor, '#fff8f3');
  assert.equal(feed.campaigns[0].logoUrl, 'assets/dinpanel-logo-light.png');
  assert.equal(feed.campaigns[0].imageUrl, 'assets/dinpanel-workbench.webp');
  assert.equal('html' in feed.campaigns[0], false);
});

test('promotionFeed returns no campaign for an unsupported placement', () => {
  const feed = promotionFeed({platform: 'android', placement: 'unknown'});
  assert.deepEqual(feed.campaigns, []);
});

test('promotionFeed serves the same safe campaign contract to Android', () => {
  const feed = promotionFeed({platform: 'android', placement: 'forecast_landscape'});
  assert.equal(feed.platform, 'android');
  assert.equal(feed.campaigns[0].type, 'native-card');
  assert.equal(feed.campaigns[0].logoUrl, 'assets/dinpanel-logo-square.png');
  assert.equal(feed.campaigns[0].imageUrl, undefined);
});
