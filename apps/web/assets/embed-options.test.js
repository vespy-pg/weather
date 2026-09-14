import assert from 'node:assert/strict';
import test from 'node:test';

import {applyWidgetQuery, widgetBoolean, widgetDays, widgetQuery} from './embed-options.js';

const settings = {
  showHourlyTemperatures: true,
  showApparentTemperature: true,
  showPrecipitation: true,
  showWind: true,
  showWindArrows: false,
  temperatureThresholds: {deepFrost: -12, mild: 18, warm: 27, hot: 32}
};

test('validates widget booleans and forecast days', () => {
  assert.equal(widgetBoolean('1', false), true);
  assert.equal(widgetBoolean('false', true), false);
  assert.equal(widgetBoolean('invalid', true), true);
  assert.equal(widgetDays('2'), 2);
  assert.equal(widgetDays('11'), 10);
  assert.equal(widgetDays('2.5'), 10);
});

test('applies every supported display and temperature option', () => {
  const query = new URLSearchParams({
    hourlyTemperatures: '0',
    apparentTemperature: '0',
    precipitation: '0',
    wind: '1',
    windArrows: '1',
    deepFrost: '-15',
    mild: '20',
    warm: '29',
    hot: '35'
  });
  assert.deepEqual(applyWidgetQuery(settings, query), {
    showHourlyTemperatures: false,
    showApparentTemperature: false,
    showPrecipitation: false,
    showWind: true,
    showWindArrows: true,
    temperatureThresholds: {deepFrost: -15, mild: 20, warm: 29, hot: 35}
  });
});

test('serializes a self-contained widget configuration', () => {
  assert.deepEqual(widgetQuery(settings, {days: 2, legend: false}), {
    days: 2,
    legend: 0,
    hourlyTemperatures: 1,
    apparentTemperature: 1,
    precipitation: 1,
    wind: 1,
    windArrows: 0,
    deepFrost: -12,
    mild: 18,
    warm: 27,
    hot: 32
  });
});
