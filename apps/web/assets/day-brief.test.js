import test from 'node:test';
import assert from 'node:assert/strict';
import {adjacentForecastDate, aggregate, dateAtTimelinePosition, daylightComparison, moonPhase, pointsForDate, sunMarkerMinutes} from './day-brief.js';

test('selects the day represented by a settled timeline position', () => {
  const points = [
    {timestamp: '2026-09-20T22:00'},
    {timestamp: '2026-09-20T23:00'},
    {timestamp: '2026-09-21T00:00'}
  ];
  assert.equal(dateAtTimelinePosition(points, 1), '2026-09-20');
  assert.equal(dateAtTimelinePosition(points, 2), '2026-09-21');
  assert.equal(pointsForDate(points, '2026-09-20').length, 2);
});

test('moves between forecast days only within the available range', () => {
  const dates = ['2026-09-20', '2026-09-21', '2026-09-22'];
  assert.equal(adjacentForecastDate(dates, dates[1], -1), dates[0]);
  assert.equal(adjacentForecastDate(dates, dates[1], 1), dates[2]);
  assert.equal(adjacentForecastDate(dates, dates[0], -1), null);
  assert.equal(adjacentForecastDate(dates, dates[2], 1), null);
});

test('sun marker follows local daylight time and disappears at night or on other days', () => {
  const args = ['2026-06-21', '2026-06-21T04:30', '2026-06-21T21:00', 'Europe/Warsaw'];
  assert.equal(sunMarkerMinutes(...args, new Date('2026-06-21T10:00:00Z')), 720);
  assert.equal(sunMarkerMinutes(...args, new Date('2026-06-21T00:00:00Z')), null);
  assert.equal(sunMarkerMinutes(...args, new Date('2026-06-22T10:00:00Z')), null);
});

test('aggregates only available numeric readings', () => {
  assert.equal(aggregate([null, 2, 4]), 3);
  assert.equal(aggregate([null, 2, 4], 'maximum'), 4);
  assert.equal(aggregate([null, 2, 4], 'sum'), 6);
});

test('keeps daylight estimates finite at the equator and near the poles', () => {
  [0, 89.9, -89.9].forEach(latitude => {
    const result = daylightComparison('2026-06-21', latitude, null);
    Object.values(result).forEach(value => assert.equal(Number.isFinite(value), true));
    assert.ok(result.current >= 0 && result.current <= 86400);
  });
});

test('returns a stable normalized moon phase', () => {
  const phase = moonPhase('2026-09-20');
  assert.ok(phase >= 0 && phase < 1);
  assert.equal(phase, moonPhase('2026-09-20'));
});
