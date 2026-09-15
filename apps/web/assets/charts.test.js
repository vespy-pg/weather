import test from 'node:test';
import assert from 'node:assert/strict';
import {drawForecastSky} from './charts.js';

function forecastCanvas() {
  const fillRects = [];
  const context = {
    arc() {},
    beginPath() {},
    clearRect() {},
    clip() {},
    closePath() {},
    createLinearGradient() { return {addColorStop() {}}; },
    fill() {},
    fillRect(...values) { fillRects.push(values); },
    fillText() {},
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
  return {canvas, fillRects};
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
