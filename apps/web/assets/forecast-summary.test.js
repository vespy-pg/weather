import assert from 'node:assert/strict';
import test from 'node:test';
import {forecastSummaryEvents} from './forecast-summary.js';

function forecast(points) {
  return {current: {timestamp: '2026-09-18T00:00'}, hourly: points.map((point, index) => ({
    timestamp: `2026-09-${String(18 + Math.floor(index / 24)).padStart(2, '0')}T${String(index % 24).padStart(2, '0')}:00`,
    temperature: 15,
    windSpeed: 8,
    windGusts: 14,
    weatherCode: 1,
    ...point
  }))};
}

test('summarizes easing wind followed by rain as two events', () => {
  const points = Array.from({length: 72}, (_, index) => ({
    windSpeed: index < 24 ? 32 : 12,
    windGusts: index < 24 ? 48 : 22,
    weatherCode: index >= 36 ? 61 : 1,
    rain: index >= 36 ? .4 : 0
  }));
  assert.deepEqual(forecastSummaryEvents(forecast(points)), ['windEasing', 'rain']);
});

test('prioritizes freezing precipitation and thunderstorms', () => {
  const points = Array.from({length: 72}, (_, index) => ({weatherCode: index === 12 ? 67 : index === 30 ? 95 : 1}));
  assert.deepEqual(forecastSummaryEvents(forecast(points)), ['freezingPrecipitation', 'thunderstorms']);
});

test('returns stable weather when no meaningful change is detected', () => {
  assert.deepEqual(forecastSummaryEvents(forecast(Array.from({length: 72}, () => ({})))), ['stable']);
});
