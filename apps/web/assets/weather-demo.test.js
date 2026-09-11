import assert from 'node:assert/strict';
import test from 'node:test';

import {createWeatherDemo} from './weather-demo.js';

test('demo wind contains a gradual 24-hour event and a sharp 12-hour event', () => {
  const {hourly} = createWeatherDemo();

  assert.ok(hourly[10].windSpeed < 3);
  assert.ok(hourly[22].windSpeed >= 29);
  assert.ok(hourly[34].windSpeed < 3);

  assert.ok(hourly[82].windSpeed < 3);
  assert.ok(hourly[88].windSpeed >= 36);
  assert.ok(hourly[94].windSpeed < 3);
});
