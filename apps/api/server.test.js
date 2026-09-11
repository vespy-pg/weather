import assert from 'node:assert/strict';
import test from 'node:test';
import {forecastUrl, normalizeForecast, normalizeReverseLocation, selectCapitalResult} from './server.js';

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
