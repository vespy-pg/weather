import test from 'node:test';
import assert from 'node:assert/strict';
import {weatherRefreshIsDue} from './weather-refresh.js';

const REFRESH_INTERVAL = 15 * 60 * 1000;

test('refreshes when weather has never loaded', () => {
  assert.equal(weatherRefreshIsDue({refreshInterval: REFRESH_INTERVAL, now: 1000}), true);
});

test('refreshes weather after the interval has elapsed', () => {
  assert.equal(weatherRefreshIsDue({
    loadedAt: 1000,
    refreshInterval: REFRESH_INTERVAL,
    now: 1000 + REFRESH_INTERVAL
  }), true);
});

test('does not duplicate a recent refresh attempt', () => {
  assert.equal(weatherRefreshIsDue({
    loadedAt: 1000,
    refreshStartedAt: 1000 + REFRESH_INTERVAL,
    refreshInterval: REFRESH_INTERVAL,
    now: 1000 + REFRESH_INTERVAL + 1000
  }), false);
});

test('restarts a refresh attempt that has been suspended past the interval', () => {
  assert.equal(weatherRefreshIsDue({
    loadedAt: 1000,
    refreshStartedAt: 1000 + REFRESH_INTERVAL,
    refreshInterval: REFRESH_INTERVAL,
    now: 1000 + REFRESH_INTERVAL * 2
  }), true);
});
