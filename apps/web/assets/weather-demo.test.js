import assert from 'node:assert/strict';
import test from 'node:test';

import {createWeatherDemo} from './weather-demo.js';

test('demo wind contains matching gradual events with different gusts and a sharp event', () => {
  const {current, hourly} = createWeatherDemo(new Date(2026, 8, 11, 17));
  const now = hourly.findIndex(point => point.timestamp === current.timestamp);
  const forecast = hourly.slice(now);

  assert.ok(forecast[10].windSpeed < 3);
  assert.ok(forecast[22].windSpeed >= 29);
  assert.ok(forecast[34].windSpeed < 3);

  assert.ok(forecast[42].windSpeed < 3);
  assert.equal(forecast[54].windSpeed, forecast[22].windSpeed);
  assert.ok(forecast[66].windSpeed < 3);
  assert.ok(forecast[22].windGusts - forecast[22].windSpeed <= 5);
  assert.ok(Math.max(...forecast.slice(42, 67).map(point => point.windGusts - point.windSpeed)) >= 25);

  assert.ok(forecast[82].windSpeed < 3);
  assert.ok(forecast[88].windSpeed >= 36);
  assert.ok(forecast[94].windSpeed < 3);
});
