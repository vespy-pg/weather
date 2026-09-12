'use strict';

const DEFAULT_THRESHOLDS = Object.freeze({
  deepFrost: -12,
  mild: 18,
  warm: 27,
  hot: 32
});

let activeUnit = 'C';

export function setTemperatureUnit(unit) {
  activeUnit = unit === 'F' ? 'F' : 'C';
  return activeUnit;
}

export function temperatureUnit() {
  return activeUnit;
}

export function celsiusToDisplay(value, unit = activeUnit) {
  return unit === 'F' ? value * 9 / 5 + 32 : value;
}

export function displayToCelsius(value, unit = activeUnit) {
  return unit === 'F' ? (value - 32) * 5 / 9 : value;
}

export function normalizeTemperatureThresholds(value = {}) {
  const deepFrost = Math.max(-30, Math.min(-1, Number(value.deepFrost) || DEFAULT_THRESHOLDS.deepFrost));
  const mild = Math.max(1, Math.min(25, Number(value.mild) || DEFAULT_THRESHOLDS.mild));
  const warm = Math.max(mild + 1, Math.min(35, Number(value.warm) || DEFAULT_THRESHOLDS.warm));
  const hot = Math.max(warm + 1, Math.min(45, Number(value.hot) || DEFAULT_THRESHOLDS.hot));
  return {deepFrost, mild, warm, hot};
}

export function temperatureColorStops(thresholds = DEFAULT_THRESHOLDS) {
  const value = normalizeTemperatureThresholds(thresholds);
  return [
    {temperature: -40, color: '#ffffff'},
    {temperature: value.deepFrost - .001, color: '#ffffff'},
    {temperature: value.deepFrost, color: '#7f8996'},
    {temperature: -.001, color: '#7f8996'},
    {temperature: 0, color: '#2358c7'},
    {temperature: value.mild - .001, color: '#3b9ee5'},
    {temperature: value.mild, color: '#45cf88'},
    {temperature: value.warm - .001, color: '#45cf88'},
    {temperature: value.warm, color: '#f28e3e'},
    {temperature: value.hot - .001, color: '#f28e3e'},
    {temperature: value.hot, color: '#ff263f'},
    {temperature: 50, color: '#ff263f'}
  ];
}

export {DEFAULT_THRESHOLDS};
