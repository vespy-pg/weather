'use strict';

export const DEFAULT_WIDGET_DAYS = 10;
export const MAX_WIDGET_DAYS = 10;

const DISPLAY_PARAMETERS = Object.freeze({
  hourlyTemperatures: 'showHourlyTemperatures',
  apparentTemperature: 'showApparentTemperature',
  precipitation: 'showPrecipitation',
  wind: 'showWind',
  windArrows: 'showWindArrows'
});

const THRESHOLD_PARAMETERS = Object.freeze(['deepFrost', 'mild', 'warm', 'hot']);

export function widgetBoolean(value, fallback) {
  if (value === '1' || value === 'true') return true;
  if (value === '0' || value === 'false') return false;
  return fallback;
}

export function widgetDays(value, fallback = DEFAULT_WIDGET_DAYS) {
  const days = Number(value);
  return Number.isInteger(days) && days >= 1 && days <= MAX_WIDGET_DAYS ? days : fallback;
}

export function applyWidgetQuery(settings, query) {
  const result = {
    ...settings,
    temperatureThresholds: {...settings.temperatureThresholds}
  };
  Object.entries(DISPLAY_PARAMETERS).forEach(([parameter, setting]) => {
    result[setting] = widgetBoolean(query.get(parameter), result[setting]);
  });
  THRESHOLD_PARAMETERS.forEach(parameter => {
    const value = Number(query.get(parameter));
    if (query.has(parameter) && Number.isFinite(value)) result.temperatureThresholds[parameter] = value;
  });
  return result;
}

export function widgetQuery(settings, {days = DEFAULT_WIDGET_DAYS, legend = false} = {}) {
  const query = {
    days: widgetDays(days),
    legend: legend ? 1 : 0
  };
  Object.entries(DISPLAY_PARAMETERS).forEach(([parameter, setting]) => {
    query[parameter] = settings[setting] ? 1 : 0;
  });
  THRESHOLD_PARAMETERS.forEach(parameter => {
    query[parameter] = settings.temperatureThresholds[parameter];
  });
  return query;
}
