'use strict';

import {
  formatForecastDate,
  installChartTooltip,
  measurement,
  numericValue,
  temperature
} from './components.js';
import {t} from './i18n.js';

const HOME_LATITUDE = 46.81;
const HOME_LONGITUDE = 9.84;

const TEMPERATURE_COLOR_STOPS = [
  {temperature: -20, color: '#ffffff'},
  {temperature: -12, color: '#ffffff'},
  {temperature: -10, color: '#7f8996'},
  {temperature: -.001, color: '#7f8996'},
  {temperature: 0, color: '#2358c7'},
  {temperature: 12, color: '#3b9ee5'},
  {temperature: 18, color: '#45cf88'},
  {temperature: 27, color: '#45cf88'},
  {temperature: 32, color: '#f28e3e'},
  {temperature: 40, color: '#ff263f'}
];

function chartColor(property, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(property).trim() || fallback;
}

function isLightTheme() {
  return document.documentElement.dataset.theme === 'light';
}

function interpolateHexColor(start, end, progress) {
  const channel = (color, offset) => Number.parseInt(color.slice(offset, offset + 2), 16);
  const channels = [1, 3, 5].map(offset => Math.round(channel(start, offset) + (channel(end, offset) - channel(start, offset)) * progress));
  return `rgb(${channels.join(', ')})`;
}

function temperatureColor(value) {
  const numeric = numericValue(value);
  if (numeric === null || numeric <= TEMPERATURE_COLOR_STOPS[0].temperature) return TEMPERATURE_COLOR_STOPS[0].color;
  const finalStop = TEMPERATURE_COLOR_STOPS[TEMPERATURE_COLOR_STOPS.length - 1];
  if (numeric >= finalStop.temperature) return finalStop.color;
  const upperIndex = TEMPERATURE_COLOR_STOPS.findIndex(stop => stop.temperature >= numeric);
  const lower = TEMPERATURE_COLOR_STOPS[upperIndex - 1];
  const upper = TEMPERATURE_COLOR_STOPS[upperIndex];
  const progress = (numeric - lower.temperature) / (upper.temperature - lower.temperature);
  return interpolateHexColor(lower.color, upper.color, progress);
}

function paintDayNightBands(context, nightSegments, padding, plotWidth, plotHeight) {
  if (!nightSegments.length) return;
  context.fillStyle = chartColor('--chart-day-band', 'rgba(88, 166, 255, .07)');
  context.fillRect(padding.left, padding.top, plotWidth, plotHeight);

  context.fillStyle = chartColor('--chart-night-band', 'rgba(0, 0, 0, .72)');
  nightSegments.forEach(segment => {
    context.fillRect(segment.start, padding.top, segment.end - segment.start, plotHeight);
    context.strokeStyle = chartColor('--chart-day-separator', 'rgba(154, 164, 178, .24)');
    context.beginPath();
    context.moveTo(segment.start, padding.top);
    context.lineTo(segment.start, padding.top + plotHeight);
    context.moveTo(segment.end, padding.top);
    context.lineTo(segment.end, padding.top + plotHeight);
    context.stroke();
  });
}

function drawForecastDayNightBands(context, points, days, padding, columnWidth, plotHeight) {
  const daylightByDate = new Map((days || []).map(day => [String(day.date), {
    sunrise: Date.parse(day.sunrise),
    sunset: Date.parse(day.sunset)
  }]));
  const parsedTimes = points.map(point => Date.parse(point.timestamp));
  const inferredStep = parsedTimes.length > 1 && Number.isFinite(parsedTimes[0]) && Number.isFinite(parsedTimes[1])
    ? parsedTimes[1] - parsedTimes[0]
    : 60 * 60 * 1000;
  const nightSegments = [];

  points.forEach((point, index) => {
    const start = parsedTimes[index];
    const end = Number.isFinite(parsedTimes[index + 1]) ? parsedTimes[index + 1] : start + inferredStep;
    const daylight = daylightByDate.get(String(point.timestamp).slice(0, 10));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !daylight || !Number.isFinite(daylight.sunrise) || !Number.isFinite(daylight.sunset)) return;

    [[start, Math.min(end, daylight.sunrise)], [Math.max(start, daylight.sunset), end]].forEach(([nightStart, nightEnd]) => {
      if (nightEnd <= nightStart) return;
      const offset = (nightStart - start) / (end - start);
      const duration = (nightEnd - nightStart) / (end - start);
      const segment = {
        start: padding.left + (index + offset) * columnWidth,
        end: padding.left + (index + offset + duration) * columnWidth
      };
      const previous = nightSegments[nightSegments.length - 1];
      if (previous && segment.start <= previous.end + .5) previous.end = Math.max(previous.end, segment.end);
      else nightSegments.push(segment);
    });
  });

  paintDayNightBands(context, nightSegments, padding, columnWidth * points.length, plotHeight);
}

function forecastDaylightByDate(days) {
  return new Map((days || []).map(day => [String(day.date), {
    sunrise: Date.parse(day.sunrise),
    sunset: Date.parse(day.sunset)
  }]));
}

function pointIsDaylight(point, daylightByDate) {
  const time = Date.parse(point.timestamp);
  const daylight = daylightByDate.get(String(point.timestamp).slice(0, 10));
  if (Number.isFinite(time) && Number.isFinite(daylight?.sunrise) && Number.isFinite(daylight?.sunset)) {
    return time >= daylight.sunrise && time < daylight.sunset;
  }
  const hour = new Date(point.timestamp).getHours();
  return hour >= 7 && hour < 19;
}

function pointSunlightEdgeFactor(point, daylightByDate) {
  const time = Date.parse(point.timestamp);
  const daylight = daylightByDate.get(String(point.timestamp).slice(0, 10));
  if (!Number.isFinite(time) || !Number.isFinite(daylight?.sunrise) || !Number.isFinite(daylight?.sunset) || time <= daylight.sunrise || time >= daylight.sunset) return 0;
  const transitionDuration = 60 * 60 * 1000;
  return Math.min(1, (time - daylight.sunrise) / transitionDuration, (daylight.sunset - time) / transitionDuration);
}

function smoothCloudCover(points) {
  const values = points.map(point => {
    const value = numericValue(point.cloudCover);
    return value === null ? null : Math.max(0, Math.min(100, value));
  });
  return values.map((value, index) => {
    if (value === null) return null;
    const weighted = [[index - 1, 1], [index, 2], [index + 1, 1]]
      .map(([itemIndex, weight]) => [values[itemIndex], weight])
      .filter(([item]) => item !== null && item !== undefined);
    const totalWeight = weighted.reduce((sum, item) => sum + item[1], 0);
    return weighted.reduce((sum, item) => sum + item[0] * item[1], 0) / totalWeight;
  });
}

function drawRainDrop(context, x, y, size, opacity) {
  context.save();
  context.globalAlpha = opacity;
  context.fillStyle = isLightTheme() ? '#1976bd' : '#58a6ff';
  context.beginPath();
  context.moveTo(x, y - size);
  context.bezierCurveTo(x - size * .65, y - size * .15, x - size * .55, y + size * .55, x, y + size * .65);
  context.bezierCurveTo(x + size * .55, y + size * .55, x + size * .65, y - size * .15, x, y - size);
  context.fill();
  context.restore();
}

function drawSnowflake(context, x, y, size, opacity) {
  context.save();
  context.globalAlpha = opacity;
  context.fillStyle = isLightTheme() ? '#2879ae' : '#d9f1ff';
  context.font = `${Math.round(12 + size * .8)}px "DejaVu Sans", sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.shadowColor = isLightTheme() ? 'rgba(40, 121, 174, .42)' : 'rgba(150, 220, 255, .8)';
  context.shadowBlur = 7;
  context.fillText('❄', x, y);
  context.restore();
}

function drawHailstone(context, x, y, size, opacity) {
  context.save();
  context.globalAlpha = opacity;
  context.fillStyle = isLightTheme() ? '#8bd2f4' : '#e9f7ff';
  context.strokeStyle = isLightTheme() ? '#1672aa' : '#7fcfff';
  context.lineWidth = isLightTheme() ? 1.8 : 1.2;
  context.shadowColor = 'rgba(125, 205, 255, .9)';
  context.shadowBlur = 7;
  context.beginPath();
  context.moveTo(x, y - size * 1.35);
  context.lineTo(x + size * .78, y);
  context.lineTo(x, y + size * 1.35);
  context.lineTo(x - size * .78, y);
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
}

function drawLightning(context, x, y, opacity, scale = 1) {
  context.save();
  context.globalAlpha = opacity;
  context.fillStyle = '#ffd34d';
  context.shadowColor = 'rgba(255, 208, 60, .95)';
  context.shadowBlur = 9 * scale;
  context.beginPath();
  context.moveTo(x + 2 * scale, y - 9 * scale);
  context.lineTo(x - 4 * scale, y + 1 * scale);
  context.lineTo(x, y + 1 * scale);
  context.lineTo(x - 2 * scale, y + 10 * scale);
  context.lineTo(x + 6 * scale, y - 2 * scale);
  context.lineTo(x + 2 * scale, y - 2 * scale);
  context.closePath();
  context.fill();
  context.restore();
}

export function drawForecastSky(canvas, points, days = [], options = {}) {
  const rect = canvas.getBoundingClientRect();
  if (!points.length || rect.width < 1) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  const context = canvas.getContext('2d');
  context.scale(ratio, ratio);
  const width = rect.width;
  const height = rect.height;
  const padding = {left: 0, right: 34};
  const plotWidth = width - padding.left - padding.right;
  const columnWidth = plotWidth / points.length;
  const visualScale = Math.max(.7, Math.min(1.6, Number(options.visualScale) || 1));
  const daylightByDate = forecastDaylightByDate(days);
  const daylight = points.map(point => pointIsDaylight(point, daylightByDate));
  const weatherLineY = 45;
  const maximumWeatherDepth = 25;

  context.clearRect(0, 0, width, height);
  points.forEach((point, index) => {
    const x = padding.left + index * columnWidth;
    context.fillStyle = daylight[index]
      ? chartColor('--chart-day-band', 'rgba(88, 166, 255, .10)')
      : chartColor('--chart-night-band', 'rgba(0, 0, 0, .68)');
    context.fillRect(x, 0, columnWidth, height);
    context.strokeStyle = chartColor('--chart-hour-grid', 'rgba(154, 164, 178, .10)');
    context.beginPath();
    context.moveTo(x + columnWidth, 0);
    context.lineTo(x + columnWidth, height);
    context.stroke();
  });

  const cloudCover = smoothCloudCover(points);
  const sunlight = cloudCover.map((value, index) => value === null
    ? null
    : Math.max(0, 100 - value) * pointSunlightEdgeFactor(points[index], daylightByDate));
  let sunlightSegment = [];
  const paintSunlightSegment = values => {
    if (!values.length) return;
    const endX = values.length === 1 ? values[0].x + 1 : values[values.length - 1].x;
    const gradient = context.createLinearGradient(values[0].x, 0, endX, 0);
    values.forEach((item, index) => {
      const green = Math.round(185 + item.value / 100 * 40);
      const blue = Math.round(40 + item.value / 100 * 35);
      gradient.addColorStop(values.length === 1 ? 0 : index / (values.length - 1), `rgba(255, ${green}, ${blue}, ${(.1 + item.value / 100 * .58).toFixed(2)})`);
    });
    const traceArea = property => {
      context.beginPath();
      context.moveTo(values[0].x, weatherLineY);
      context.lineTo(values[0].x, values[0][property]);
      values.forEach((item, index) => {
        if (index === 0) return;
        const previous = values[index - 1];
        context.quadraticCurveTo(previous.x, previous[property], (previous.x + item.x) / 2, (previous[property] + item[property]) / 2);
      });
      const last = values[values.length - 1];
      context.lineTo(last.x, last[property]);
      context.lineTo(last.x, weatherLineY);
      context.closePath();
    };
    context.save();
    const glowGradient = context.createLinearGradient(0, weatherLineY, 0, weatherLineY + 44);
    glowGradient.addColorStop(0, 'rgba(255, 220, 65, .48)');
    glowGradient.addColorStop(.45, 'rgba(255, 205, 50, .25)');
    glowGradient.addColorStop(1, 'rgba(255, 190, 35, 0)');
    traceArea('glowY');
    context.fillStyle = glowGradient;
    context.fill();
    context.shadowColor = 'rgba(255, 215, 55, .62)';
    context.shadowBlur = 12;
    context.shadowOffsetY = 3;
    traceArea('y');
    context.fillStyle = gradient;
    context.fill();
    context.restore();
  };
  sunlight.forEach((value, index) => {
    if (value === null || value < 4) {
      if (sunlightSegment.length && value !== null) {
        sunlightSegment.push({x: padding.left + (index + .5) * columnWidth, y: weatherLineY, glowY: weatherLineY, value: 0});
      }
      paintSunlightSegment(sunlightSegment);
      sunlightSegment = [];
      return;
    }
    if (!sunlightSegment.length && index > 0 && sunlight[index - 1] !== null) {
      sunlightSegment.push({x: padding.left + (index - .5) * columnWidth, y: weatherLineY, glowY: weatherLineY, value: 0});
    }
    sunlightSegment.push({
      x: padding.left + (index + .5) * columnWidth,
      y: weatherLineY + Math.sqrt(value / 100) * maximumWeatherDepth,
      glowY: weatherLineY + value / 100 * 44,
      value
    });
  });
  paintSunlightSegment(sunlightSegment);

  let nightStart = null;
  [...daylight, true].forEach((isDay, index) => {
    if (!isDay && nightStart === null) nightStart = index;
    if (!isDay || nightStart === null) return;
    const nightEnd = index;
    const center = padding.left + ((nightStart + nightEnd) / 2) * columnWidth;
    context.save();
    context.fillStyle = isLightTheme() ? '#50647f' : '#dbe8ff';
    context.shadowColor = isLightTheme() ? 'rgba(55, 91, 138, .5)' : 'rgba(160, 195, 255, .65)';
    context.shadowBlur = (isLightTheme() ? 5 : 8) * visualScale;
    context.beginPath();
    context.arc(center, 64, 7 * visualScale, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = chartColor('--chart-night-cutout', '#080c12');
    context.beginPath();
    context.arc(center + 3 * visualScale, 64 - 3 * visualScale, 7 * visualScale, 0, Math.PI * 2);
    context.fill();
    context.restore();
    nightStart = null;
  });

  let cloudSegment = [];
  const paintCloudSegment = values => {
    if (!values.length) return;
    const gradient = context.createLinearGradient(values[0].x, 0, values[values.length - 1].x, 0);
    values.forEach((item, index) => {
      const alpha = isLightTheme() ? .24 + item.value / 100 * .52 : .18 + item.value / 100 * .62;
      const color = isLightTheme() ? `rgba(91, 107, 128, ${alpha.toFixed(2)})` : `rgba(190, 199, 211, ${alpha.toFixed(2)})`;
      gradient.addColorStop(values.length === 1 ? 0 : index / (values.length - 1), color);
    });
    context.beginPath();
    context.moveTo(values[0].x, weatherLineY);
    context.lineTo(values[0].x, values[0].y);
    values.forEach((item, index) => {
      if (index === 0) return;
      const previous = values[index - 1];
      context.quadraticCurveTo(previous.x, previous.y, (previous.x + item.x) / 2, (previous.y + item.y) / 2);
    });
    const last = values[values.length - 1];
    context.lineTo(last.x, last.y);
    context.lineTo(last.x, weatherLineY);
    context.closePath();
    context.fillStyle = gradient;
    context.fill();
  };
  cloudCover.forEach((value, index) => {
    if (value === null || value < 4) {
      paintCloudSegment(cloudSegment);
      cloudSegment = [];
      return;
    }
    cloudSegment.push({
      x: padding.left + (index + .5) * columnWidth,
      y: weatherLineY + Math.sqrt(value / 100) * maximumWeatherDepth,
      value
    });
  });
  paintCloudSegment(cloudSegment);

  points.forEach((point, index) => {
    const code = numericValue(point.weatherCode);
    if (![45, 48].includes(code)) return;
    const x = padding.left + index * columnWidth;
    context.save();
    context.strokeStyle = code === 48 ? 'rgba(220, 231, 239, .72)' : 'rgba(220, 231, 239, .5)';
    context.lineWidth = 2 * visualScale;
    context.lineCap = 'round';
    [74, 80, 86].forEach((y, line) => {
      context.beginPath();
      context.moveTo(x + (line % 2 ? 3 : 0), y);
      context.lineTo(x + columnWidth - (line % 2 ? 0 : 3), y);
      context.stroke();
    });
    context.restore();
  });

  points.forEach((point, index) => {
    const probability = numericValue(point.precipitationProbability);
    const amount = numericValue(point.precipitation);
    if (probability === null || probability <= 0) return;
    const code = numericValue(point.weatherCode);
    const dropSize = 3 + Math.min(7, Math.sqrt(Math.max(0, amount ?? 0)) * 3.5);
    const opacity = (isLightTheme() ? .3 : .2) + Math.min(100, probability) / 100 * (isLightTheme() ? .7 : .8);
    const center = padding.left + (index + .5) * columnWidth;
    if ([71, 73, 75, 77, 85, 86].includes(code)) {
      const snowfall = numericValue(point.snowfall);
      drawSnowflake(context, center, 84, (3 + Math.min(6, Math.sqrt(Math.max(0, snowfall ?? 0)) * 3)) * visualScale, opacity);
    } else if ([96, 99].includes(code)) {
      drawHailstone(context, center, 83, Math.min(8, dropSize * .7) * visualScale, opacity);
    } else {
      drawRainDrop(context, center, 84, dropSize * visualScale, opacity);
    }
  });

  const hourFontSize = 9 * visualScale;
  const temperatureFontSize = 7 * visualScale;
  context.font = `700 ${hourFontSize}px ui-monospace, monospace`;
  context.textAlign = 'center';
  points.forEach((point, index) => {
    const x = padding.left + (index + .5) * columnWidth;
    context.fillStyle = chartColor('--chart-muted', '#8d98aa');
    context.fillText(String(point.timestamp).slice(11, 13), x, 24);
    const numericTemperature = numericValue(point.temperature);
    if (options.showHourlyTemperatures !== false && numericTemperature !== null) {
      context.fillStyle = temperatureColor(numericTemperature);
      context.font = `700 ${temperatureFontSize}px ui-monospace, monospace`;
      context.fillText(`${Math.round(numericTemperature)}°`, x, 36);
      context.font = `700 ${hourFontSize}px ui-monospace, monospace`;
    }
    const date = String(point.timestamp).slice(0, 10);
    const previousDate = String(points[index - 1]?.timestamp || '').slice(0, 10);
    if (date === previousDate) return;
    context.strokeStyle = chartColor('--chart-day-separator', 'rgba(154, 164, 178, .48)');
    context.beginPath();
    context.moveTo(padding.left + index * columnWidth, 0);
    context.lineTo(padding.left + index * columnWidth, height);
    context.stroke();
    context.fillStyle = chartColor('--chart-text', '#e7edf7');
    context.textAlign = 'left';
    context.fillText(formatForecastDate(point.timestamp, {weekday: 'short', day: 'numeric', month: 'short'}).toUpperCase(), padding.left + index * columnWidth + 4, Math.max(10, hourFontSize));
    context.textAlign = 'center';
  });
}

function approximateSunTimes(dayTimestamp) {
  const noon = new Date(dayTimestamp);
  noon.setHours(12, 0, 0, 0);
  const yearStart = new Date(noon.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((noon - yearStart) / 86400000);
  const gamma = 2 * Math.PI / 365 * (dayOfYear - 1);
  const equationOfTime = 229.18 * (.000075 + .001868 * Math.cos(gamma) - .032077 * Math.sin(gamma) - .014615 * Math.cos(2 * gamma) - .040849 * Math.sin(2 * gamma));
  const declination = .006918 - .399912 * Math.cos(gamma) + .070257 * Math.sin(gamma) - .006758 * Math.cos(2 * gamma) + .000907 * Math.sin(2 * gamma) - .002697 * Math.cos(3 * gamma) + .00148 * Math.sin(3 * gamma);
  const latitude = HOME_LATITUDE * Math.PI / 180;
  const hourAngle = Math.acos(Math.cos(90.833 * Math.PI / 180) / (Math.cos(latitude) * Math.cos(declination)) - Math.tan(latitude) * Math.tan(declination));
  const timezoneHours = -noon.getTimezoneOffset() / 60;
  const solarNoonMinutes = 720 - equationOfTime - 4 * HOME_LONGITUDE + 60 * timezoneHours;
  const daylightMinutes = hourAngle * 180 / Math.PI * 4;
  const midnight = new Date(noon);
  midnight.setHours(0, 0, 0, 0);
  return {
    sunrise: midnight.getTime() + (solarNoonMinutes - daylightMinutes) * 60000,
    sunset: midnight.getTime() + (solarNoonMinutes + daylightMinutes) * 60000
  };
}

function drawCalculatedDayNightBands(context, start, end, x, padding, plotWidth, plotHeight) {
  const nightSegments = [];
  let dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);
  while (dayStart.getTime() <= end) {
    const nextDay = new Date(dayStart);
    nextDay.setDate(nextDay.getDate() + 1);
    const sunlight = approximateSunTimes(dayStart);
    [[dayStart.getTime(), sunlight.sunrise], [sunlight.sunset, nextDay.getTime()]].forEach(([nightStart, nightEnd]) => {
      const clippedStart = Math.max(start, nightStart);
      const clippedEnd = Math.min(end, nightEnd);
      if (clippedEnd <= clippedStart) return;
      const segment = {start: x(clippedStart), end: x(clippedEnd)};
      const previous = nightSegments[nightSegments.length - 1];
      if (previous && segment.start <= previous.end + .5) previous.end = Math.max(previous.end, segment.end);
      else nightSegments.push(segment);
    });
    dayStart = nextDay;
  }
  paintDayNightBands(context, nightSegments, padding, plotWidth, plotHeight);
}

function windFlowColor(speed) {
  const value = Math.max(0, numericValue(speed) ?? 0);
  const stops = isLightTheme() ? [
    {speed: 0, color: '#526176'},
    {speed: 5, color: '#668c9a'},
    {speed: 10, color: '#1ca160'},
    {speed: 18, color: '#d49a1f'},
    {speed: 30, color: '#e52f47'}
  ] : [
    {speed: 0, color: '#8d98aa'},
    {speed: 5, color: '#7ba8b4'},
    {speed: 10, color: '#4bd48b'},
    {speed: 18, color: '#f2bd55'},
    {speed: 30, color: '#ff4d5f'}
  ];
  const upperIndex = stops.findIndex(stop => value <= stop.speed);
  const upper = stops[upperIndex < 0 ? stops.length - 1 : upperIndex];
  const lower = stops[Math.max(0, (upperIndex < 0 ? stops.length - 1 : upperIndex) - 1)];
  const progress = upper.speed === lower.speed ? 0 : Math.min(1, (value - lower.speed) / (upper.speed - lower.speed));
  return interpolateHexColor(lower.color, upper.color, progress);
}

export function drawWindFlow(canvas, points, options = {}) {
  const rect = canvas.getBoundingClientRect();
  if (!points.length || rect.width < 1 || rect.height < 1) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  const context = canvas.getContext('2d');
  context.scale(ratio, ratio);
  const width = rect.width;
  const height = rect.height;
  const plotWidth = width - 34;
  const columnWidth = plotWidth / points.length;
  const visualScale = Math.max(.7, Math.min(1.6, Number(options.visualScale) || 1));
  const rawSpeeds = points.map(point => Math.max(0, numericValue(point.windSpeed) ?? 0));
  const gustiness = points.map((point, index) => {
    const gust = Math.max(rawSpeeds[index], numericValue(point.windGusts) ?? rawSpeeds[index]);
    return Math.min(1, Math.max(0, gust - rawSpeeds[index]) / 18);
  });
  const speeds = rawSpeeds.map((speed, index) => {
    const previous = rawSpeeds[index - 1] ?? speed;
    const next = rawSpeeds[index + 1] ?? speed;
    return (previous + speed * 2 + next) / 4;
  });
  const directions = points.map((point, index) => {
    const nearby = points.slice(Math.max(0, index - 1), index + 2);
    const vector = nearby.reduce((sum, item) => {
      const radians = (numericValue(item.windDirection) ?? 0) * Math.PI / 180;
      sum.x += Math.cos(radians);
      sum.y += Math.sin(radians);
      return sum;
    }, {x: 0, y: 0});
    return Math.atan2(vector.y, vector.x);
  });
  const strength = speeds.map(speed => Math.min(1, speed / 30));
  const liftFactors = [.03, .1, .18, .27, .37, .48, .6, .73, .87, 1];
  const strandWeights = [.42, .58, .72, .86, 1, .95, .82, .7, .55, .4];
  const flowCenterY = index => height * .61
    + Math.sin(index * .12 + directions[index] * .2) * 3.2 * visualScale
    + Math.sin(index * .055 + directions[index] * .7) * 2 * visualScale;
  const lineY = (index, lineIndex) => {
    const lanePosition = .5 - lineIndex / (liftFactors.length - 1);
    const directionLift = (Math.sin(directions[index] + lineIndex * .43) + 1) / 2
      * strength[index] * (1 + lineIndex % 3 * .65) * visualScale;
    const strengthLift = liftFactors[lineIndex] * strength[index] * height * .2;
    const baseSeparation = lanePosition * 9 * visualScale;
    const turbulence = Math.sin(index * (.13 + lineIndex * .009) + lineIndex * 1.17)
      * gustiness[index] * (2.3 + lineIndex % 4 * 1.25) * visualScale;
    return Math.max(3 * visualScale, Math.min(height - 3 * visualScale, flowCenterY(index) + baseSeparation - strengthLift - directionLift + turbulence));
  };

  context.clearRect(0, 0, width, height);
  points.forEach((point, index) => {
    const x = index * columnWidth;
    const date = String(point.timestamp || '').slice(0, 10);
    const previousDate = String(points[index - 1]?.timestamp || '').slice(0, 10);
    context.strokeStyle = index > 0 && date !== previousDate
      ? chartColor('--chart-day-separator', 'rgba(154, 164, 178, .48)')
      : chartColor('--chart-hour-grid', 'rgba(154, 164, 178, .1)');
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  });

  const lineCount = liftFactors.length;
  for (let index = 0; index < points.length - 1; index += 1) {
    const startX = (index + .5) * columnWidth;
    const endX = (index + 1.5) * columnWidth;
    const startLines = liftFactors.map((unused, lineIndex) => lineY(index, lineIndex));
    const endLines = liftFactors.map((unused, lineIndex) => lineY(index + 1, lineIndex));
    const startTop = Math.min(...startLines);
    const startBottom = Math.max(...startLines);
    const endTop = Math.min(...endLines);
    const endBottom = Math.max(...endLines);
    const averageStrength = (strength[index] + strength[index + 1]) / 2;
    const gradient = context.createLinearGradient(startX, 0, endX, 0);
    gradient.addColorStop(0, windFlowColor(speeds[index]));
    gradient.addColorStop(1, windFlowColor(speeds[index + 1]));
    context.save();
    context.beginPath();
    context.moveTo(startX, startTop);
    context.bezierCurveTo(startX + columnWidth * .42, startTop, endX - columnWidth * .42, endTop, endX, endTop);
    context.lineTo(endX, endBottom);
    context.bezierCurveTo(endX - columnWidth * .42, endBottom, startX + columnWidth * .42, startBottom, startX, startBottom);
    context.closePath();
    context.fillStyle = gradient;
    context.globalAlpha = .025 + averageStrength * .12;
    context.filter = `blur(${(1.5 + averageStrength * 4.5) * visualScale}px)`;
    context.fill();
    context.restore();
  }

  for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
    const strandWeight = strandWeights[lineIndex];
    for (let index = 0; index < points.length - 1; index += 1) {
      const startX = (index + .5) * columnWidth;
      const endX = (index + 1.5) * columnWidth;
      const startY = lineY(index, lineIndex);
      const endY = lineY(index + 1, lineIndex);
      const averageStrength = (strength[index] + strength[index + 1]) / 2;
      const gradient = context.createLinearGradient(startX, 0, endX, 0);
      gradient.addColorStop(0, windFlowColor(speeds[index]));
      gradient.addColorStop(1, windFlowColor(speeds[index + 1]));
      const traceSegment = () => {
        context.beginPath();
        context.moveTo(startX, startY);
        context.bezierCurveTo(
          startX + columnWidth * .42,
          startY,
          endX - columnWidth * .42,
          endY,
          endX,
          endY
        );
      };

      context.save();
      traceSegment();
      context.strokeStyle = gradient;
      context.globalAlpha = (.035 + averageStrength * .2) * (.6 + strandWeight * .4);
      context.lineWidth = (4 + averageStrength * 8) * (.72 + strandWeight * .28) * visualScale;
      context.shadowColor = windFlowColor((speeds[index] + speeds[index + 1]) / 2);
      context.shadowBlur = (3 + averageStrength * 11) * visualScale;
      context.stroke();
      context.restore();

      context.save();
      traceSegment();
      context.strokeStyle = gradient;
      context.globalAlpha = (.24 + Math.pow(averageStrength, .75) * .76) * (.65 + strandWeight * .35);
      context.lineWidth = (.9 + averageStrength * 2.1) * (.82 + strandWeight * .18) * visualScale;
      context.lineCap = 'round';
      context.stroke();
      context.restore();
    }
  }
}

export function drawWeatherChart(canvas, points, days = [], options = {}) {
  const rect = canvas.getBoundingClientRect();
  if (!points.length || rect.width < 1) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  const context = canvas.getContext('2d');
  context.scale(ratio, ratio);
  const width = rect.width;
  const height = rect.height;
  const padding = {left: options.timeline ? 0 : 30, right: 34, top: options.timeline ? 14 : 24, bottom: 22};
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const columnWidth = plotWidth / points.length;
  const visualScale = Math.max(.7, Math.min(1.6, Number(options.visualScale) || 1));
  const precipitationValues = points.map(point => numericValue(point.precipitation)).filter(value => value !== null);
  const forecastMaximum = Math.max(0, ...(precipitationValues.length ? precipitationValues : [0]));
  const maxPrecipitation = Math.max(10, Math.ceil(forecastMaximum / 5) * 5);
  const percentY = value => padding.top + (1 - value / 100) * plotHeight;
  const temperatureY = value => padding.top + (1 - (value + 20) / 60) * plotHeight;

  context.clearRect(0, 0, width, height);
  if (!options.timeline) drawForecastDayNightBands(context, points, days, padding, columnWidth, plotHeight);
  context.font = '9px ui-monospace, monospace';
  [0, .5, 1].forEach(ratioValue => {
    const lineY = padding.top + (1 - ratioValue) * plotHeight;
    context.strokeStyle = chartColor('--chart-grid', '#293141');
    context.beginPath(); context.moveTo(padding.left, lineY); context.lineTo(width - padding.right, lineY); context.stroke();
    if (!options.timeline) {
      context.fillStyle = chartColor('--chart-muted', '#8d98aa');
      context.fillText(`${(maxPrecipitation * ratioValue).toFixed(0)} mm`, 2, lineY + 3);
    }
  });
  const zeroY = temperatureY(0);
  context.strokeStyle = 'rgba(86, 215, 229, .55)';
  context.setLineDash([4, 4]);
  context.beginPath(); context.moveTo(padding.left, zeroY); context.lineTo(width - padding.right, zeroY); context.stroke();
  context.setLineDash([]);
  if (!options.timeline) {
    [[40, padding.top], [0, zeroY], [-20, padding.top + plotHeight]].forEach(([value, lineY]) => {
      context.fillStyle = value < 0 ? '#56d7e5' : '#f28e55';
      context.fillText(`${value > 0 ? '+' : ''}${value}°`, width - 31, lineY + 3);
    });
  }
  if (!options.timeline) {
    const legends = [['#58a6ff', 'precip. %'], ['#9aa4b2', 'clouds'], ['#f28e55', 'temp.'], ['#56d7e5', '< 0°C']];
    legends.forEach(([color, label], index) => {
      const legendX = padding.left + index * Math.max(58, (plotWidth - 20) / legends.length);
      context.fillStyle = color;
      context.fillRect(legendX, 6, 7, 3);
      context.fillText(label, legendX + 10, 10);
    });
  }

  const drawPrecipitationBars = () => points.forEach((point, index) => {
    const amount = numericValue(point.precipitation);
    if (amount === null) return;
    const barHeight = amount / maxPrecipitation * plotHeight;
    context.fillStyle = 'rgba(86, 215, 229, .55)';
    context.fillRect(padding.left + index * columnWidth + 1, padding.top + plotHeight - barHeight, Math.max(1, columnWidth - 2), barHeight);
  });
  if (!options.timeline) drawPrecipitationBars();

  function traceLine(values, y, smooth = false) {
    context.beginPath();
    let drawing = false;
    values.forEach((value, index) => {
      if (value === null) {
        drawing = false;
        return;
      }
      const pointX = padding.left + (index + .5) * columnWidth;
      const pointY = y(value);
      if (!drawing) {
        context.moveTo(pointX, pointY);
        drawing = true;
        return;
      }
      if (!smooth || index === values.length - 1 || values[index + 1] === null) {
        context.lineTo(pointX, pointY);
        return;
      }
      const nextX = padding.left + (index + 1.5) * columnWidth;
      const nextY = y(values[index + 1]);
      context.quadraticCurveTo(pointX, pointY, (pointX + nextX) / 2, (pointY + nextY) / 2);
    });
  }

  const probabilities = points.map(point => {
    const value = numericValue(point.precipitationProbability);
    return value === null ? null : Math.max(0, Math.min(100, value));
  });
  if (!options.timeline) {
    traceLine(probabilities, percentY);
    context.strokeStyle = '#58a6ff';
    context.lineWidth = 2;
    context.stroke();
  }

  if (!options.timeline) {
    const cloudCoverValues = smoothCloudCover(points);
    traceLine(cloudCoverValues, percentY, true);
    context.strokeStyle = '#9aa4b2';
    context.lineWidth = 2;
    context.stroke();
  }
  const temperatures = points.map(point => {
    const value = numericValue(point.temperature);
    return value === null ? null : Math.max(-20, Math.min(40, value));
  });
  const displayedTemperatures = temperatures.map((value, index) => {
    if (value === null) return null;
    const weighted = [[index - 1, 1], [index, 2], [index + 1, 1]]
      .map(([itemIndex, weight]) => [temperatures[itemIndex], weight])
      .filter(([item]) => item !== null && item !== undefined);
    const totalWeight = weighted.reduce((sum, item) => sum + item[1], 0);
    return weighted.reduce((sum, item) => sum + item[0] * item[1], 0) / totalWeight;
  });
  const apparentTemperatures = points.map(point => {
    const value = numericValue(point.apparentTemperature);
    return value === null ? null : Math.max(-20, Math.min(40, value));
  });
  const displayedApparentTemperatures = apparentTemperatures.map((value, index) => {
    if (value === null) return null;
    const weighted = [[index - 1, 1], [index, 2], [index + 1, 1]]
      .map(([itemIndex, weight]) => [apparentTemperatures[itemIndex], weight])
      .filter(([item]) => item !== null && item !== undefined);
    const totalWeight = weighted.reduce((sum, item) => sum + item[1], 0);
    return weighted.reduce((sum, item) => sum + item[0] * item[1], 0) / totalWeight;
  });
  if (options.timeline && options.showApparentTemperature !== false) {
    for (let index = 0; index < displayedTemperatures.length - 1; index += 1) {
      const actualStart = displayedTemperatures[index];
      const actualEnd = displayedTemperatures[index + 1];
      const apparentStart = displayedApparentTemperatures[index];
      const apparentEnd = displayedApparentTemperatures[index + 1];
      if ([actualStart, actualEnd, apparentStart, apparentEnd].some(value => value === null)) continue;
      const startX = padding.left + (index + .5) * columnWidth;
      const endX = padding.left + (index + 1.5) * columnWidth;
      const averageDifference = (apparentStart + apparentEnd - actualStart - actualEnd) / 2;
      context.fillStyle = averageDifference >= 0 ? 'rgba(242, 142, 62, .18)' : 'rgba(59, 142, 229, .18)';
      context.beginPath();
      context.moveTo(startX, temperatureY(actualStart));
      context.lineTo(endX, temperatureY(actualEnd));
      context.lineTo(endX, temperatureY(apparentEnd));
      context.lineTo(startX, temperatureY(apparentStart));
      context.closePath();
      context.fill();
    }
  }
  const strokeTemperature = (color, clipTop, clipHeight) => {
    context.save();
    context.beginPath();
    context.rect(padding.left, clipTop, plotWidth, clipHeight);
    context.clip();
    traceLine(displayedTemperatures, temperatureY, true);
    if (isLightTheme()) {
      context.strokeStyle = 'rgba(31, 48, 70, .32)';
      context.lineWidth = 5;
      context.stroke();
    }
    context.strokeStyle = color;
    context.lineWidth = 3;
    context.stroke();
    context.restore();
  };
  if (options.timeline) {
    const temperatureGradient = context.createLinearGradient(0, padding.top, 0, padding.top + plotHeight);
    [...TEMPERATURE_COLOR_STOPS].reverse().forEach(stop => {
      temperatureGradient.addColorStop((40 - stop.temperature) / 60, stop.color);
    });
    strokeTemperature(temperatureGradient, padding.top, plotHeight);
    points.forEach((point, index) => {
      const code = numericValue(point.weatherCode);
      if (![95, 96, 99].includes(code) || displayedTemperatures[index] === null) return;
      const probability = Math.max(0, Math.min(100, numericValue(point.precipitationProbability) ?? 0));
      const pointX = padding.left + (index + .5) * columnWidth;
      const lineY = temperatureY(displayedTemperatures[index]);
      const lightningScale = (.55 + probability / 100 * 1.25) * visualScale;
      drawLightning(
        context,
        pointX,
        Math.max(padding.top + 10 * lightningScale, lineY - 10 * lightningScale),
        .2 + probability / 100 * .8,
        lightningScale
      );
    });
  } else {
    strokeTemperature('#f28e55', padding.top, zeroY - padding.top);
    strokeTemperature('#56d7e5', zeroY, padding.top + plotHeight - zeroY);
  }

  if (!options.timeline) {
    const labelStep = points.length > 24 ? 8 : 4;
    points.forEach((point, index) => {
      if (index % labelStep !== 0) return;
      const label = String(point.timestamp).slice(11, 16);
      context.fillStyle = chartColor('--chart-muted', '#8d98aa');
      context.fillText(label, padding.left + index * columnWidth, height - 6);
    });
  }

  if (options.interactive !== false) installChartTooltip(canvas, relativeX => {
    if (relativeX < padding.left || relativeX > width - padding.right) return null;
    const index = Math.max(0, Math.min(points.length - 1, Math.floor((relativeX - padding.left) / columnWidth)));
    const point = points[index];
    return {
      title: formatForecastDate(point.timestamp, {weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}),
      rows: [
        {color: options.timeline ? temperatureColor(point.temperature) : '#f28e55', label: t('metric.temperature'), value: temperature(point.temperature)},
        {color: '#a78bfa', label: t('metric.feels'), value: temperature(point.apparentTemperature)},
        {color: '#9aa4b2', label: t('metric.clouds'), value: measurement(point.cloudCover, '%')},
        {color: '#56d7e5', label: t('metric.precipitation'), value: measurement(point.precipitation, ' mm', 1)},
        {color: '#58a6ff', label: t('metric.precipitationChance'), value: measurement(point.precipitationProbability, '%')},
        {color: '#7fcfff', label: t('metric.wind'), value: measurement(point.windSpeed, ' km/h')}
      ]
    };
  });
}

export function drawAirQualityChart(canvas, points) {
  const rect = canvas.getBoundingClientRect();
  if (!points.length || rect.width < 1) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  const context = canvas.getContext('2d');
  context.scale(ratio, ratio);
  const width = rect.width;
  const height = rect.height;
  const padding = {left: 42, right: 12, top: 25, bottom: 25};
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const values = points.flatMap(point => [numericValue(point.pm10), numericValue(point.pm25)]).filter(value => value !== null);
  context.clearRect(0, 0, width, height);
  if (!values.length) {
    context.fillStyle = '#8d98aa';
    context.fillText('No PM10 or PM2.5 data', padding.left, height / 2);
    return;
  }
  const maximum = Math.max(10, Math.ceil(Math.max(...values) / 10) * 10);
  const x = index => padding.left + index / Math.max(1, points.length - 1) * plotWidth;
  const y = value => padding.top + (1 - value / maximum) * plotHeight;
  const startTime = Date.parse(points[0].timestamp);
  const endTime = Date.parse(points[points.length - 1].timestamp);
  if (Number.isFinite(startTime) && Number.isFinite(endTime) && endTime > startTime) {
    const timeX = time => padding.left + (time - startTime) / (endTime - startTime) * plotWidth;
    drawCalculatedDayNightBands(context, startTime, endTime, timeX, padding, plotWidth, plotHeight);
  }
  context.font = '9px ui-monospace, monospace';
  [0, .5, 1].forEach(grid => {
    const lineY = padding.top + (1 - grid) * plotHeight;
    context.strokeStyle = '#293141';
    context.beginPath(); context.moveTo(padding.left, lineY); context.lineTo(width - padding.right, lineY); context.stroke();
    context.fillStyle = '#8d98aa';
    context.fillText(`${Math.round(maximum * grid)}`, 6, lineY + 3);
  });
  [['#f2bd55', 'PM10', 'pm10'], ['#58a6ff', 'PM2.5', 'pm25']].forEach(([color, label, key], seriesIndex) => {
    context.fillStyle = color;
    context.fillRect(padding.left + seriesIndex * 65, 7, 8, 3);
    context.fillText(label, padding.left + 12 + seriesIndex * 65, 11);
    context.beginPath();
    let drawing = false;
    points.forEach((point, index) => {
      const value = numericValue(point[key]);
      if (value === null) {
        drawing = false;
        return;
      }
      if (!drawing) context.moveTo(x(index), y(value)); else context.lineTo(x(index), y(value));
      drawing = true;
    });
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.stroke();
  });
  points.forEach((point, index) => {
    if (index % 12 !== 0) return;
    context.fillStyle = '#8d98aa';
    context.fillText(formatForecastDate(point.timestamp, {weekday: 'short', hour: '2-digit'}), x(index), height - 7);
  });
  installChartTooltip(canvas, relativeX => {
    if (relativeX < padding.left || relativeX > width - padding.right) return null;
    const index = Math.max(0, Math.min(points.length - 1, Math.round((relativeX - padding.left) / plotWidth * (points.length - 1))));
    const point = points[index];
    return {
      title: formatForecastDate(point.timestamp, {weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}),
      rows: [
        {color: '#f2bd55', label: 'PM10', value: measurement(point.pm10, ' µg/m³', 1)},
        {color: '#58a6ff', label: 'PM2.5', value: measurement(point.pm25, ' µg/m³', 1)},
        {color: '#a78bfa', label: 'Europejski AQI', value: measurement(point.europeanAqi, '')},
        {color: '#9aa4b2', label: 'Dwutlenek azotu', value: measurement(point.nitrogenDioxide, ' µg/m³', 1)},
        {color: '#6fcf97', label: 'Ozon', value: measurement(point.ozone, ' µg/m³', 1)}
      ]
    };
  });
}

export function drawTemperatureChart(canvas, history, selection) {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  const context = canvas.getContext('2d');
  context.scale(ratio, ratio);
  const width = rect.width;
  const height = rect.height;
  const padding = {left: 48, right: 18, top: 18, bottom: 30};
  const points = history.map(point => ({
    ...point,
    time: new Date(point.timestamp).getTime(),
    reading: numericValue(point.reading),
    minimum: numericValue(point.minimum),
    maximum: numericValue(point.maximum)
  })).filter(point => Number.isFinite(point.time) && point.reading !== null && point.minimum !== null && point.maximum !== null);
  context.clearRect(0, 0, width, height);
  if (!points.length) {
    context.fillStyle = '#8d98aa';
    context.fillText('No data in this period', padding.left, height / 2);
    return;
  }
  const values = points.flatMap(point => [point.minimum, point.maximum, point.reading]);
  const minimum = Math.floor(Math.min(...values) - 1);
  const maximum = Math.ceil(Math.max(...values) + 1);
  const start = points[0].time;
  const end = points[points.length - 1].time;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const x = time => padding.left + (time - start) / Math.max(1, end - start) * plotWidth;
  const y = value => padding.top + (1 - (value - minimum) / Math.max(1, maximum - minimum)) * plotHeight;

  if (end > start) drawCalculatedDayNightBands(context, start, end, x, padding, plotWidth, plotHeight);
  context.font = '10px ui-monospace, monospace';
  context.lineWidth = 1;
  for (let index = 0; index <= 4; index += 1) {
    const value = minimum + (maximum - minimum) * index / 4;
    const lineY = y(value);
    context.strokeStyle = '#293141';
    context.beginPath(); context.moveTo(padding.left, lineY); context.lineTo(width - padding.right, lineY); context.stroke();
    context.fillStyle = '#8d98aa';
    context.fillText(`${value.toFixed(0)}°C`, 5, lineY + 3);
  }

  context.beginPath();
  points.forEach((point, index) => {
    const pointX = x(point.time);
    const pointY = y(point.maximum);
    if (index === 0) context.moveTo(pointX, pointY); else context.lineTo(pointX, pointY);
  });
  [...points].reverse().forEach(point => context.lineTo(x(point.time), y(point.minimum)));
  context.closePath();
  context.fillStyle = selection.sensor === 'outside' ? 'rgba(86, 215, 229, .12)' : 'rgba(88, 166, 255, .08)';
  context.fill();

  context.beginPath();
  points.forEach((point, index) => {
    const pointX = x(point.time);
    const pointY = y(point.reading);
    if (index === 0) context.moveTo(pointX, pointY); else context.lineTo(pointX, pointY);
  });
  context.strokeStyle = '#58a6ff';
  context.lineWidth = 2;
  context.stroke();

  context.fillStyle = '#8d98aa';
  context.fillText(new Date(start).toLocaleString('en-GB'), padding.left, height - 8);
  const endLabel = new Date(end).toLocaleString('en-GB');
  context.fillText(endLabel, width - padding.right - context.measureText(endLabel).width, height - 8);
  installChartTooltip(canvas, relativeX => {
    if (relativeX < padding.left || relativeX > width - padding.right) return null;
    const targetTime = start + (relativeX - padding.left) / plotWidth * (end - start);
    const point = points.reduce((closest, candidate) => Math.abs(candidate.time - targetTime) < Math.abs(closest.time - targetTime) ? candidate : closest);
    return {
      title: formatForecastDate(point.timestamp, {weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}),
      rows: [
        {color: '#58a6ff', label: 'Temperature', value: temperature(point.reading)},
        {color: '#56d7e5', label: 'Minimum', value: temperature(point.minimum)},
        {color: '#f28e55', label: 'Maximum', value: temperature(point.maximum)}
      ]
    };
  });
}
