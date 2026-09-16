import test from 'node:test';
import assert from 'node:assert/strict';
import {forecastSkyLayout, groupHourlyForecast, hoursPerGroup, resistedHistoryPosition, stopTimelineAtNow, temperatureRange, timelineCurrentIndex, timelineHourlyWindow, withinTimelineMagnet} from './forecast-view.js';

test('selects progressively finer time groups as the timeline is enlarged', () => {
  assert.deepEqual([.25, .3, .5, .75, 1, 2].map(hoursPerGroup), [12, 6, 4, 3, 2, 1]);
});

test('keeps sunlight and clouds visible when a compact sky cannot fit a precipitation lane', () => {
  assert.deepEqual(forecastSkyLayout(68, 45), {
    precipitationLaneTop: null,
    maximumWeatherDepth: 22,
    sunlightGlowDepth: 23
  });
  assert.deepEqual(forecastSkyLayout(78, 45), {
    precipitationLaneTop: 56,
    maximumWeatherDepth: 10,
    sunlightGlowDepth: 11
  });
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

test('keeps grouped forecast buckets inside calendar days', () => {
  const grouped = groupHourlyForecast([
    {timestamp: '2026-09-12T22:00', temperature: 10},
    {timestamp: '2026-09-12T23:00', temperature: 12},
    {timestamp: '2026-09-13T00:00', temperature: 14},
    {timestamp: '2026-09-13T01:00', temperature: 16}
  ], 6);
  assert.equal(grouped.length, 2);
  assert.deepEqual(grouped.map(point => point.temperature), [11, 15]);
});

test('selects three historical days without shortening the future forecast', () => {
  const start = Date.UTC(2026, 8, 8);
  const hourly = Array.from({length: 15 * 24}, (_, index) => ({
    timestamp: new Date(start + index * 60 * 60 * 1000).toISOString().slice(0, 16)
  }));
  const selected = timelineHourlyWindow(hourly, '2026-09-11T00:00', 10, 3);
  assert.equal(selected.length, 13 * 24);
  assert.equal(selected[0].timestamp, '2026-09-08T00:00');
  assert.equal(selected[72].timestamp, '2026-09-11T00:00');
});

test('locates now in a grouped timeline and applies live one-sided resistance', () => {
  const grouped = [
    {timestamp: '2026-09-11T08:00'},
    {timestamp: '2026-09-11T12:00'},
    {timestamp: '2026-09-11T16:00'}
  ];
  assert.equal(timelineCurrentIndex(grouped, '2026-09-11T13:42'), 1);
  assert.equal(resistedHistoryPosition(500, 430, 500, 90), 500);
  assert.equal(resistedHistoryPosition(500, 390, 500, 90), 480);
  assert.equal(resistedHistoryPosition(570, 540, 500, 90), 540);
  assert.equal(resistedHistoryPosition(390, 350, 500, 90), 350);
});

test('stops a gesture at now before it can cross the boundary', () => {
  assert.equal(stopTimelineAtNow(600, 400, 500), 500);
  assert.equal(stopTimelineAtNow(400, 600, 500), 500);
  assert.equal(stopTimelineAtNow(600, 550, 500), 550);
  assert.equal(stopTimelineAtNow(500, 400, 500), 400);
  assert.equal(stopTimelineAtNow(500, 600, 500), 600);
});

test('applies the now magnet equally from the historical and future sides', () => {
  assert.equal(withinTimelineMagnet(450, 500, 50), true);
  assert.equal(withinTimelineMagnet(550, 500, 50), true);
  assert.equal(withinTimelineMagnet(449, 500, 50), false);
  assert.equal(withinTimelineMagnet(551, 500, 50), false);
});

test('uses a compact temperature range with margin', () => {
  assert.deepEqual(temperatureRange([{temperature: 11, apparentTemperature: 9}, {temperature: 15, apparentTemperature: 14}]), {minimum: 6, maximum: 18});
  assert.deepEqual(temperatureRange([{temperature: 20}, {temperature: 21}], false), {minimum: 16, maximum: 24});
});
