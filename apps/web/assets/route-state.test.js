import assert from 'node:assert/strict';
import test from 'node:test';

import {applicationRouteUrl, forecastRouteUrl, locationSlug, parseCoordinatePair, parseForecastRoute, persistentRouteQuery, shouldUseRouteLocation} from './route-state.js';

test('parses localized forecast paths and coordinate pairs', () => {
  assert.deepEqual(parseForecastRoute('/pl-PL', ['en-US', 'pl-PL']), {language: 'pl-PL', locationName: null});
  assert.deepEqual(parseForecastRoute('/pl-PL/Jastrzab-Rozparcelowany', ['en-US', 'pl-PL']), {
    language: 'pl-PL',
    locationName: 'Jastrzab Rozparcelowany'
  });
  assert.deepEqual(parseCoordinatePair('50.67244,19.18239'), {latitude: 50.67244, longitude: 19.18239});
  assert.equal(parseCoordinatePair('91,19'), null);
});

test('creates an application URL without a location', () => {
  assert.equal(applicationRouteUrl('https://weather.vespy.eu/anything', 'pl-PL').href, 'https://weather.vespy.eu/pl-PL');
});

test('creates readable forecast URLs with exact coordinates', () => {
  assert.equal(locationSlug('Bielsko-Biała'), 'Bielsko-Biała');
  const url = forecastRouteUrl('https://weather.vespy.eu/anything', {
    language: 'pl-PL',
    location: {name: 'London', latitude: 51.5074, longitude: -0.1278},
    query: {share: 1}
  });
  assert.equal(url.href, 'https://weather.vespy.eu/pl-PL/London?ll=51.50740%2C-0.12780&share=1');
});

test('restores an active location unless the route was explicitly shared or embedded', () => {
  assert.equal(shouldUseRouteLocation({hasActiveLocation: true}), false);
  assert.equal(shouldUseRouteLocation({hasActiveLocation: true, shared: true}), true);
  assert.equal(shouldUseRouteLocation({hasActiveLocation: true, embedded: true}), true);
  assert.equal(shouldUseRouteLocation({hasActiveLocation: false}), true);
});

test('keeps embed settings and the selected location across a reload', () => {
  const location = {name: 'Zawada', latitude: 50.68069, longitude: 19.11596};
  const query = new URLSearchParams('ll=52.23000%2C21.01000&embed=1&days=10&theme=dark&zoom=0.5&share=1');
  const url = forecastRouteUrl('https://weather.vespy.eu/', {
    language: 'pl-PL', location, query: persistentRouteQuery(query, true)
  });
  assert.equal(url.pathname, '/pl-PL/Zawada');
  assert.equal(url.searchParams.get('ll'), '50.68069,19.11596');
  assert.equal(url.searchParams.get('embed'), '1');
  assert.equal(url.searchParams.get('days'), '10');
  assert.equal(url.searchParams.get('theme'), 'dark');
  assert.equal(url.searchParams.get('zoom'), '0.5');
  assert.equal(shouldUseRouteLocation({hasActiveLocation: true, embedded: url.searchParams.get('embed') === '1'}), true);
  assert.deepEqual(persistentRouteQuery(query), {share: '1'});
});
