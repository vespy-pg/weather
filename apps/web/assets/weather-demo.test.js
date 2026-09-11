import assert from 'node:assert/strict';
import test from 'node:test';

import {createWeatherDemo} from './weather-demo.js';

test('demo wind contains matching gradual events with different gusts and a sharp event', () => {
  const {hourly} = createWeatherDemo();

  assert.ok(hourly[10].windSpeed < 3);
  assert.ok(hourly[22].windSpeed >= 29);
  assert.ok(hourly[34].windSpeed < 3);

  assert.ok(hourly[42].windSpeed < 3);
  assert.equal(hourly[54].windSpeed, hourly[22].windSpeed);
  assert.ok(hourly[66].windSpeed < 3);
  assert.ok(hourly[22].windGusts - hourly[22].windSpeed <= 5);
  assert.ok(Math.max(...hourly.slice(42, 67).map(point => point.windGusts - point.windSpeed)) >= 25);

  assert.ok(hourly[82].windSpeed < 3);
  assert.ok(hourly[88].windSpeed >= 36);
  assert.ok(hourly[94].windSpeed < 3);
});
