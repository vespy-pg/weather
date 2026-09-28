import {numericValue} from './components.js';

export const POLLEN_TYPES = ['alder', 'birch', 'grass', 'mugwort', 'olive', 'ragweed'];
export const POLLUTANTS = [
  ['pm25', 'PM2.5', 75],
  ['pm10', 'PM10', 150],
  ['nitrogenDioxide', 'NO2', 340],
  ['ozone', 'O3', 380],
  ['sulphurDioxide', 'SO2', 750],
  ['carbonMonoxide', 'CO', 10000]
];

export function pointsForDate(hourly, date) {
  return (hourly || []).filter(point => String(point.timestamp || '').slice(0, 10) === date);
}

export function dateAtTimelinePosition(points, position) {
  if (!points?.length) return null;
  const index = Math.max(0, Math.min(points.length - 1, Math.floor(Number(position) || 0)));
  return String(points[index]?.timestamp || '').slice(0, 10) || null;
}

export function aggregate(values, mode = 'average') {
  const valid = values.map(numericValue).filter(value => value !== null);
  if (!valid.length) return null;
  if (mode === 'maximum') return Math.max(...valid);
  if (mode === 'minimum') return Math.min(...valid);
  if (mode === 'sum') return valid.reduce((sum, value) => sum + value, 0);
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

export function estimatedDaylightSeconds(date, latitude) {
  const parsed = new Date(`${date}T12:00:00Z`);
  const start = Date.UTC(parsed.getUTCFullYear(), 0, 0);
  const day = Math.floor((parsed.getTime() - start) / 86400000);
  const safeLatitude = Math.max(-89.8, Math.min(89.8, Number(latitude) || 0));
  const declination = -23.44 * Math.cos(2 * Math.PI * (day + 10) / 365);
  const product = -Math.tan(safeLatitude * Math.PI / 180) * Math.tan(declination * Math.PI / 180);
  if (product <= -1) return 86400;
  if (product >= 1) return 0;
  return 2 * Math.acos(product) * 24 * 3600 / (2 * Math.PI);
}

export function daylightComparison(date, latitude, measuredSeconds) {
  const year = Number(String(date).slice(0, 4)) || new Date().getFullYear();
  const solstices = [
    estimatedDaylightSeconds(`${year}-06-21`, latitude),
    estimatedDaylightSeconds(`${year}-12-21`, latitude)
  ];
  const current = numericValue(measuredSeconds) ?? estimatedDaylightSeconds(date, latitude);
  const shortest = Math.min(...solstices);
  const longest = Math.max(...solstices);
  return {current, shortest, longest, aboveShortest: Math.max(0, current - shortest), belowLongest: Math.max(0, longest - current)};
}

export function moonPhase(date) {
  const epoch = Date.UTC(2000, 0, 6);
  const current = new Date(`${date}T18:00:00Z`).getTime();
  const days = (current - epoch) / 86400000 + .76;
  return ((days / 29.53058867) % 1 + 1) % 1;
}

export function moonPhaseIndex(phase) {
  return Math.round((((Number(phase) || 0) % 1 + 1) % 1) * 8) % 8;
}

export function pollenPeak(pollen) {
  return Math.max(0, ...POLLEN_TYPES.map(type => numericValue(pollen?.[type]) ?? 0));
}

export function airQualityColor(value) {
  const number = numericValue(value);
  if (number === null) return '#8d98aa';
  if (number <= 20) return '#55cf8a';
  if (number <= 40) return '#b3d14b';
  if (number <= 60) return '#ffc83d';
  if (number <= 80) return '#ff8a3d';
  return '#ff4055';
}

export function windColor(value) {
  const number = numericValue(value);
  if (number === null) return '#8d98aa';
  if (number < 12) return '#55cf8a';
  if (number < 30) return '#ffc83d';
  if (number < 50) return '#ff8a3d';
  return '#ff4055';
}

export function uvColor(value) {
  const number = numericValue(value);
  if (number === null) return '#8d98aa';
  if (number < 3) return '#55cf8a';
  if (number < 6) return '#ffc83d';
  if (number < 8) return '#ff8a3d';
  return '#ff4055';
}
