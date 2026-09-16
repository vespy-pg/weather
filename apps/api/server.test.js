import assert from 'node:assert/strict';
import test from 'node:test';
import {forecastUrl, isForecastRoutePath, locationSearchUrl, mushroomCondition, mushroomObservationsUrl, normalizeForecast, normalizeGoogleAnalyticsId, normalizeLocale, normalizeMushroomObservations, normalizePostalLocations, normalizeReverseLocation, postalCodeSearchUrl, preferredLanguageForCountry, promotionFeed, renderIndexHtml, selectCapitalResult, seoPageMetadata} from './server.js';

test('normalizeGoogleAnalyticsId accepts only GA4 measurement IDs', () => {
  assert.equal(normalizeGoogleAnalyticsId(' g-ab12cd34 '), 'G-AB12CD34');
  assert.equal(normalizeGoogleAnalyticsId('UA-123-4'), null);
  assert.equal(normalizeGoogleAnalyticsId('G-ABC<script>'), null);
});

test('recognizes localized forecast application routes', () => {
  assert.equal(isForecastRoutePath('/pl-PL'), true);
  assert.equal(isForecastRoutePath('/pl-PL/London'), true);
  assert.equal(isForecastRoutePath('/en-US/New-York'), true);
  assert.equal(isForecastRoutePath('/assets/app.js'), false);
  assert.equal(isForecastRoutePath('/pl-PL/London/extra'), false);
});

test('creates localized canonical metadata for forecast routes', () => {
  const polish = seoPageMetadata(new URL('https://weather.vespy.eu/pl-PL/Warszawa?ll=52.23,21.01&theme=dark'));
  assert.equal(polish.title, 'Warszawa - prognoza pogody | Vespy Weather');
  assert.match(polish.description, /prognozę pogody dla lokalizacji Warszawa/);
  assert.equal(polish.canonical, 'https://weather.vespy.eu/pl-PL/Warszawa?ll=52.23000%2C21.01000');
  assert.equal(polish.alternateUrls['en-US'], 'https://weather.vespy.eu/en-US/Warszawa?ll=52.23000%2C21.01000');
  assert.equal(polish.robots, 'index, follow, max-image-preview:large');
  assert.equal(seoPageMetadata(new URL('https://weather.vespy.eu/en-US?embed=1')).robots, 'noindex, follow');
});

test('renders localized metadata and visible HTML before JavaScript runs', () => {
  const template = '<html lang="en-US"><head><title>Old</title><meta name="description" content="Old"><meta name="robots" content="index"><meta property="og:title" content="Old"><meta property="og:description" content="Old"><meta property="og:url" content="Old"><meta property="og:locale" content="en_US"><meta name="twitter:title" content="Old"><meta name="twitter:description" content="Old"><link rel="canonical" href="Old"><link rel="alternate" hreflang="en-US" href="Old"><link rel="alternate" hreflang="pl-PL" href="Old"><link rel="alternate" hreflang="x-default" href="Old"><script id="seoStructuredData" type="application/ld+json">{}</script></head><body><h1 id="locationTitle">London</h1><h2 data-i18n="forecast.title">Weather</h2></body></html>';
  const html = renderIndexHtml(template, new URL('https://weather.vespy.eu/pl-PL/Warszawa?ll=52.23,21.01'));
  assert.match(html, /<html lang="pl-PL">/);
  assert.match(html, /<title>Warszawa - prognoza pogody \| Vespy Weather<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/weather\.vespy\.eu\/pl-PL\/Warszawa\?ll=52\.23000%2C21\.01000">/);
  assert.match(html, /<h1 id="locationTitle">Warszawa<\/h1>/);
  assert.match(html, /<h2 data-i18n="forecast.title">Temperatura, zachmurzenie i opady<\/h2>/);
});

test('forecastUrl requests the fields shared by web and Android clients', () => {
  const url = new URL(forecastUrl({latitude: 50.67, longitude: 19.12, timezone: 'Europe/Warsaw'}));
  assert.equal(url.searchParams.get('latitude'), '50.67');
  assert.equal(url.searchParams.get('longitude'), '19.12');
  assert.equal(url.searchParams.get('timezone'), 'Europe/Warsaw');
  assert.equal(url.searchParams.get('forecast_days'), '15');
  assert.equal(url.searchParams.has('past_days'), false);
  assert.match(url.searchParams.get('hourly'), /apparent_temperature/);
  assert.doesNotMatch(url.searchParams.get('hourly'), /soil_moisture_0_to_1cm/);
  assert.match(url.searchParams.get('daily'), /sunrise/);
  const mushroomUrl = new URL(forecastUrl({latitude: 50.67, longitude: 19.12, timezone: 'Europe/Warsaw', includeMushrooms: true}));
  assert.equal(mushroomUrl.searchParams.get('past_days'), '7');
  assert.match(mushroomUrl.searchParams.get('hourly'), /soil_moisture_0_to_1cm/);
  const historyUrl = new URL(forecastUrl({latitude: 50.67, longitude: 19.12, timezone: 'Europe/Warsaw', pastDays: 3}));
  assert.equal(historyUrl.searchParams.get('past_days'), '3');
});

test('scores mushroom conditions from recent rain, moisture, humidity, and temperature', () => {
  const source = {
    hourly: {
      time: ['2026-09-10T00:00', '2026-09-10T12:00'],
      relative_humidity_2m: [88, 82],
      soil_moisture_0_to_1cm: [.3, .28]
    },
    daily: {
      time: ['2026-09-08', '2026-09-09', '2026-09-10'],
      precipitation_sum: [12, 10, 8],
      temperature_2m_min: [10, 11, 12],
      temperature_2m_max: [18, 19, 20]
    }
  };
  const condition = mushroomCondition(source, 2);
  assert.ok(condition.score >= 75);
  assert.equal(condition.level, 'excellent');
  assert.equal(condition.recentRainfall, 22);
  assert.equal(condition.relativeHumidity, 85);
  assert.equal(condition.soilMoisture, .29);
});

test('builds and normalizes localized mushroom observation requests', () => {
  const url = new URL(mushroomObservationsUrl(
    {latitude: 50.26489, longitude: 19.02378, language: 'pl-PL'},
    new Date('2026-09-14T12:00:00Z')
  ));
  assert.equal(url.hostname, 'api.inaturalist.org');
  assert.equal(url.searchParams.get('taxon_id'), '47170');
  assert.equal(url.searchParams.get('radius'), '30');
  assert.equal(url.searchParams.get('d1'), '2026-08-15');
  assert.equal(url.searchParams.get('locale'), 'pl');
  const normalized = normalizeMushroomObservations({
    total_results: 2,
    results: [{id: 123, observed_on: '2026-09-14', taxon: {preferred_common_name: 'Borowik', name: 'Boletus'}}]
  });
  assert.equal(normalized.count, 2);
  assert.equal(normalized.latestDate, '2026-09-14');
  assert.equal(normalized.observations[0].commonName, 'Borowik');
  assert.equal(normalized.observations[0].url, 'https://www.inaturalist.org/observations/123');
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
  assert.ok(Number.isFinite(Date.parse(result.fetchedAt)));
  assert.equal(result.current.temperature, 21);
  assert.equal(result.hourly[0].apparentTemperature, 23);
  assert.equal(result.hourly[0].precipitationProbability, 20);
  assert.equal(result.daily[0].temperatureMaximum, 25);
  assert.equal(result.daily[0].mushroom.level, 'unavailable');
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

test('normalizeForecast includes requested history and preserves the future horizon', () => {
  const start = Date.UTC(2026, 8, 8);
  const time = Array.from({length: 14 * 24}, (_, index) => new Date(start + index * 60 * 60 * 1000).toISOString().slice(0, 16));
  const dailyTime = Array.from({length: 14}, (_, index) => new Date(start + index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const source = {
    current: {time: '2026-09-11T00:15'},
    hourly: {time, temperature_2m: time.map((_, index) => index)},
    daily: {time: dailyTime}
  };
  const result = normalizeForecast(source, {name: 'Test'}, {pastDays: 3});
  assert.equal(result.hourly[0].timestamp, '2026-09-08T00:00');
  assert.equal(result.hourly[72].timestamp, '2026-09-11T00:00');
  assert.equal(result.hourly.at(-1).timestamp, '2026-09-20T23:00');
  assert.deepEqual(result.daily.map(day => day.date), source.daily.time);
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

test('postal code fallback supports localized Polish and US formats', () => {
  assert.equal(postalCodeSearchUrl('00-001', 'pl-PL'), 'https://api.zippopotam.us/PL/00-001');
  assert.equal(postalCodeSearchUrl('94016', 'en-US'), 'https://api.zippopotam.us/US/94016');
  assert.equal(postalCodeSearchUrl('London', 'pl-PL'), null);
  assert.deepEqual(normalizePostalLocations({
    country: 'Poland',
    'country abbreviation': 'PL',
    'post code': '00-001',
    places: [{'place name': 'Warszawa', state: 'Mazowieckie', latitude: '52.25', longitude: '21'}]
  }), [{
    id: 'postal-PL-00-001-0',
    name: 'Warszawa',
    country: 'Poland',
    admin1: 'Mazowieckie',
    postalCode: '00-001',
    latitude: 52.25,
    longitude: 21,
    timezone: 'auto'
  }]);
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

test('normalizeReverseLocation prefers a city over its district', () => {
  const fallback = {id: 'device', name: 'Current location', country: '', latitude: 52.23, longitude: 21.01, timezone: 'Europe/Warsaw'};
  assert.equal(normalizeReverseLocation({
    addresstype: 'suburb',
    name: 'Śródmieście',
    address: {suburb: 'Śródmieście', city: 'Warszawa', country: 'Polska'}
  }, fallback).name, 'Warszawa');
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
