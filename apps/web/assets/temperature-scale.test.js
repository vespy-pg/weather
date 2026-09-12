import assert from 'node:assert/strict';
import test from 'node:test';

import {
  celsiusToDisplay,
  displayToCelsius,
  normalizeTemperatureThresholds,
  temperatureColorStops
} from './temperature-scale.js';

test('converts temperature values between Celsius and Fahrenheit', () => {
  assert.equal(celsiusToDisplay(0, 'F'), 32);
  assert.equal(celsiusToDisplay(100, 'F'), 212);
  assert.equal(displayToCelsius(32, 'F'), 0);
});

test('keeps temperature color thresholds ordered', () => {
  assert.deepEqual(normalizeTemperatureThresholds({deepFrost: -8, mild: 20, warm: 20, hot: 20}), {
    deepFrost: -8,
    mild: 20,
    warm: 21,
    hot: 22
  });
});

test('always changes from gray to blue at water freezing point', () => {
  const stops = temperatureColorStops({deepFrost: -8, mild: 20, warm: 28, hot: 35});
  assert.deepEqual(stops.filter(stop => stop.temperature >= -.001 && stop.temperature <= 0), [
    {temperature: -.001, color: '#7f8996'},
    {temperature: 0, color: '#2358c7'}
  ]);
});
