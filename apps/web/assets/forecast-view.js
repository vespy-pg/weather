import {numericValue} from './components.js';

const HOUR_GROUPS = new Map([
  [.25, 6],
  [.375, 4],
  [.5, 3],
  [.75, 2]
]);

const WEATHER_SEVERITY = new Map([
  [99, 12], [96, 11], [95, 10],
  [82, 9], [86, 9], [75, 9], [67, 9],
  [81, 8], [65, 8], [85, 8], [73, 8], [57, 8],
  [80, 7], [63, 7], [71, 7], [66, 7], [56, 7],
  [55, 6], [53, 5], [51, 4],
  [48, 3], [45, 2], [3, 1]
]);

export function hoursPerGroup(zoom) {
  return HOUR_GROUPS.get(Number(zoom)) || 1;
}

function average(points, property) {
  const values = points.map(point => numericValue(point[property])).filter(value => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function total(points, property) {
  const values = points.map(point => numericValue(point[property])).filter(value => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

function maximum(points, property) {
  const values = points.map(point => numericValue(point[property])).filter(value => value !== null);
  return values.length ? Math.max(...values) : null;
}

function representativeWeatherCode(points) {
  return points.reduce((selected, point) => {
    const code = numericValue(point.weatherCode);
    return (WEATHER_SEVERITY.get(code) || 0) > (WEATHER_SEVERITY.get(selected) || 0) ? code : selected;
  }, numericValue(points[0]?.weatherCode));
}

function averageWindDirection(points) {
  const vectors = points.map(point => numericValue(point.windDirection)).filter(value => value !== null);
  if (!vectors.length) return null;
  const sum = vectors.reduce((result, degrees) => {
    const radians = degrees * Math.PI / 180;
    result.x += Math.cos(radians);
    result.y += Math.sin(radians);
    return result;
  }, {x: 0, y: 0});
  return (Math.atan2(sum.y, sum.x) * 180 / Math.PI + 360) % 360;
}

export function groupHourlyForecast(hourly, size) {
  const groupSize = Math.max(1, Math.round(Number(size) || 1));
  if (groupSize === 1) return hourly;
  const buckets = [];
  hourly.forEach(point => {
    const timestamp = String(point.timestamp || '');
    const hour = Number(timestamp.slice(11, 13));
    const key = `${timestamp.slice(0, 10)}-${Math.floor(hour / groupSize)}`;
    const current = buckets[buckets.length - 1];
    if (current?.key === key) current.points.push(point);
    else buckets.push({key, points: [point]});
  });
  return buckets.map(bucket => {
    const {points} = bucket;
    return {
      ...points[0],
      temperature: average(points, 'temperature'),
      apparentTemperature: average(points, 'apparentTemperature'),
      relativeHumidity: average(points, 'relativeHumidity'),
      surfacePressure: average(points, 'surfacePressure'),
      cloudCover: average(points, 'cloudCover'),
      precipitation: total(points, 'precipitation'),
      precipitationProbability: maximum(points, 'precipitationProbability'),
      snowfall: total(points, 'snowfall'),
      weatherCode: representativeWeatherCode(points),
      windSpeed: average(points, 'windSpeed'),
      windDirection: averageWindDirection(points),
      windGusts: maximum(points, 'windGusts'),
      tornado: points.some(point => point.tornado === true),
      groupHours: points.length
    };
  });
}

export function temperatureRange(points, includeApparent = true) {
  const properties = includeApparent ? ['temperature', 'apparentTemperature'] : ['temperature'];
  const values = points.flatMap(point => properties.map(property => numericValue(point[property]))).filter(value => value !== null);
  if (!values.length) return {minimum: -5, maximum: 5};
  const rawMinimum = Math.min(...values);
  const rawMaximum = Math.max(...values);
  const margin = Math.max(2, (rawMaximum - rawMinimum) * .12);
  let minimum = Math.floor((rawMinimum - margin) / 2) * 2;
  let maximum = Math.ceil((rawMaximum + margin) / 2) * 2;
  if (maximum - minimum < 8) {
    const center = (minimum + maximum) / 2;
    minimum = Math.floor((center - 4) / 2) * 2;
    maximum = minimum + 8;
  }
  return {minimum, maximum};
}
