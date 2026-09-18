const FREEZING_PRECIPITATION_CODES = new Set([56, 57, 66, 67]);
const THUNDERSTORM_CODES = new Set([95, 96, 99]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const RAIN_CODES = new Set([51, 53, 55, 61, 63, 65, 80, 81, 82]);

function average(values) {
  const available = values.map(Number).filter(Number.isFinite);
  return available.length ? available.reduce((sum, value) => sum + value, 0) / available.length : null;
}

function maximum(points, key) {
  const values = points.map(point => Number(point?.[key])).filter(Number.isFinite);
  return values.length ? Math.max(...values) : 0;
}

function firstIndex(points, predicate) {
  const index = points.findIndex(predicate);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

export function forecastSummaryEvents(forecast, limit = 2) {
  const currentHour = String(forecast?.current?.timestamp || '').slice(0, 13);
  const points = (forecast?.hourly || [])
    .filter(point => !currentHour || String(point.timestamp || '').slice(0, 13) >= currentHour)
    .slice(0, 72);
  if (!points.length) return ['stable'];

  const candidates = [];
  const add = (code, priority, start) => candidates.push({code, priority, start});
  const hasFreezingPrecipitation = point => FREEZING_PRECIPITATION_CODES.has(Number(point.weatherCode));
  const hasThunderstorm = point => point.tornado === true || THUNDERSTORM_CODES.has(Number(point.weatherCode));
  const hasSnow = point => Number(point.snowfall || 0) > 0 || SNOW_CODES.has(Number(point.weatherCode));
  const hasRain = point => Number(point.rain ?? point.precipitation ?? 0) > 0 || RAIN_CODES.has(Number(point.weatherCode));

  if (points.some(hasFreezingPrecipitation)) add('freezingPrecipitation', 100, firstIndex(points, hasFreezingPrecipitation));
  if (points.some(hasThunderstorm)) add('thunderstorms', 95, firstIndex(points, hasThunderstorm));
  if (points.reduce((sum, point) => sum + Number(point.snowfall || 0), 0) >= 1 || points.some(hasSnow)) {
    add('snow', 85, firstIndex(points, hasSnow));
  }
  if (points.reduce((sum, point) => sum + Number(point.rain ?? point.precipitation ?? 0), 0) >= 5 || points.some(point => RAIN_CODES.has(Number(point.weatherCode)))) {
    add('rain', 75, firstIndex(points, hasRain));
  }

  const sampleSize = Math.min(24, Math.floor(points.length / 2));
  if (sampleSize >= 6) {
    const initial = points.slice(0, sampleSize);
    const final = points.slice(-sampleSize);
    const initialWind = average(initial.map(point => point.windSpeed));
    const finalWind = average(final.map(point => point.windSpeed));
    const initialGust = maximum(initial, 'windGusts');
    const finalGust = maximum(final, 'windGusts');
    const strongestWind = Math.max(maximum(points, 'windSpeed'), maximum(points, 'windGusts'));
    const windCurrentlyStrong = (initialWind || 0) >= 25 || initialGust >= 40;
    const windLaterStrong = (finalWind || 0) >= 25 || finalGust >= 40;
    if (windCurrentlyStrong && (initialWind || 0) - (finalWind || 0) >= 8 && initialGust - finalGust >= 10) {
      add('windEasing', 80, 0);
    } else if (windLaterStrong && (finalWind || 0) - (initialWind || 0) >= 8 && finalGust - initialGust >= 10) {
      add('windIncreasing', 80, sampleSize);
    } else if (maximum(points, 'windSpeed') >= 35 || maximum(points, 'windGusts') >= 55 || strongestWind >= 55) {
      add('windy', 80, firstIndex(points, point => Number(point.windSpeed || 0) >= 35 || Number(point.windGusts || 0) >= 55));
    }

    const initialTemperature = average(initial.map(point => point.temperature));
    const finalTemperature = average(final.map(point => point.temperature));
    if (initialTemperature !== null && finalTemperature !== null) {
      const change = finalTemperature - initialTemperature;
      if (change >= 3) add('warming', 50, sampleSize);
      else if (change <= -3) add('cooling', 50, sampleSize);
    }
  }

  if (!candidates.length) return ['stable'];
  return candidates
    .sort((left, right) => right.priority - left.priority || left.start - right.start)
    .slice(0, Math.max(1, limit))
    .sort((left, right) => left.start - right.start || right.priority - left.priority)
    .map(item => item.code);
}
