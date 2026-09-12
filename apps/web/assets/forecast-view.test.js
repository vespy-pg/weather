import test from 'node:test';
import assert from 'node:assert/strict';
import {groupHourlyForecast, hoursPerGroup, temperatureRange} from './forecast-view.js';

test('selects progressively finer time groups as the timeline is enlarged', () => {
  assert.deepEqual([.25, .375, .5, .75, 1, 2].map(hoursPerGroup), [6, 4, 3, 2, 1, 1]);
});

test('groups forecast values without hiding severe weather', () => {
  const grouped = groupHourlyForecast([
    {timestamp: '2026-09-12T00:00', temperature: 10, apparentTemperature: 8, precipitation: 1, precipitationProbability: 20, weatherCode: 3, windSpeed: 10, windDirection: 350, windGusts: 14},
    {timestamp: '2026-09-12T01:00', temperature: 14, apparentTemperature: 12, precipitation: 2, precipitationProbability: 80, weatherCode: 95, windSpeed: 20, windDirection: 10, windGusts: 32, tornado: true}
  ], 2);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].temperature, 12);
  assert.equal(grouped[0].precipitation, 3);
  assert.equal(grouped[0].precipitationProbability, 80);
  assert.equal(grouped[0].weatherCode, 95);
  assert.equal(grouped[0].windGusts, 32);
  assert.equal(grouped[0].tornado, true);
  assert.ok(grouped[0].windDirection < 1 || grouped[0].windDirection > 359);
});

test('uses a compact temperature range with margin', () => {
  assert.deepEqual(temperatureRange([{temperature: 11, apparentTemperature: 9}, {temperature: 15, apparentTemperature: 14}]), {minimum: 6, maximum: 18});
  assert.deepEqual(temperatureRange([{temperature: 20}, {temperature: 21}], false), {minimum: 16, maximum: 24});
});
