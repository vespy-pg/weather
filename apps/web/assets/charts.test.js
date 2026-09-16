import test from 'node:test';
import assert from 'node:assert/strict';
import {drawForecastSky} from './charts.js';

function forecastCanvas() {
  const fillRects = [];
  const labels = [];
  const context = {
    arc() {},
    beginPath() {},
    clearRect() {},
    clip() {},
    closePath() {},
    createLinearGradient() { return {addColorStop() {}}; },
    fill() {},
    fillRect(...values) { fillRects.push(values); },
    fillText(text) { labels.push({text, color: this.fillStyle}); },
    lineTo() {},
    moveTo() {},
    quadraticCurveTo() {},
    rect() {},
    restore() {},
    save() {},
    scale() {},
    stroke() {},
    strokeText() {}
  };
  const canvas = {
    getBoundingClientRect() { return {width: 100, height: 100}; },
    getContext() { return context; }
  };
  return {canvas, fillRects, labels};
}

function drawWithPrecipitationLane(precipitationLaneTop) {
  const {canvas, fillRects} = forecastCanvas();
  globalThis.window = {devicePixelRatio: 1};
  globalThis.document = {documentElement: {dataset: {theme: 'dark'}}};
  globalThis.getComputedStyle = () => ({getPropertyValue: () => ''});
  drawForecastSky(canvas, [{
    timestamp: '2026-09-15T12:00',
    cloudCover: null,
    precipitationProbability: 0,
    weatherCode: 0
  }], [], {
    precipitationLaneTop,
    rightPadding: 0,
    showDayLabels: false,
    showHourlyTemperatures: false,
    showHours: false
  });
  return fillRects;
}

test('does not paint a precipitation lane over the complete sky when its position is null', () => {
  const fillRects = drawWithPrecipitationLane(null);
  assert.equal(fillRects.filter(values => values.join(',') === '0,0,100,100').length, 1);
  assert.deepEqual(drawWithPrecipitationLane(60).at(-1), [0, 60, 100, 40]);
});

test('labels the actual current day as today and keeps all day names neutral', () => {
  const {canvas, labels} = forecastCanvas();
  canvas.getBoundingClientRect = () => ({width: 600, height: 100});
  globalThis.window = {devicePixelRatio: 1};
  globalThis.document = {documentElement: {dataset: {theme: 'dark'}}};
  globalThis.getComputedStyle = () => ({getPropertyValue: property => property === '--orange' ? '#ff8800' : ''});
  drawForecastSky(canvas, [
    {timestamp: '2026-09-14T12:00', cloudCover: 0, precipitationProbability: 0, weatherCode: 0},
    {timestamp: '2026-09-15T12:00', cloudCover: 0, precipitationProbability: 0, weatherCode: 0},
    {timestamp: '2026-09-16T12:00', cloudCover: 0, precipitationProbability: 0, weatherCode: 0}
  ], [], {
    currentTimestamp: '2026-09-15T18:30',
    fullDayLabels: true,
    showDates: true,
    showHours: false,
    showHourlyTemperatures: false
  });
  const dayLabels = labels.filter(label => /MONDAY|TODAY|WEDNESDAY/.test(label.text));
  assert.match(dayLabels[0].text, /MONDAY.*SEP.*14/);
  assert.notEqual(dayLabels[0].color, '#ff8800');
  assert.equal(dayLabels[1].text, 'TODAY');
  assert.notEqual(dayLabels[1].color, '#ff8800');
  assert.match(dayLabels[2].text, /WEDNESDAY.*SEP.*16/);
  assert.notEqual(dayLabels[2].color, '#ff8800');
});
