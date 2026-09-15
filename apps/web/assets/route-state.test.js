import assert from 'node:assert/strict';
import test from 'node:test';

import {applicationRouteUrl, forecastRouteUrl, locationSlug, parseCoordinatePair, parseForecastRoute, shouldUseRouteLocation} from './route-state.js';

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
