'use strict';

import {
  formatForecastDate,
  installChartTooltip,
  measurement,
  numericValue,
  shortTemperature,
  temperature
} from './components.js';
import {temperatureRange} from './forecast-view.js';
import {t} from './i18n.js';
import {roundedTemperatureCelsius, temperatureColorStops} from './temperature-scale.js';

const HOME_LATITUDE = 46.81;
const HOME_LONGITUDE = 9.84;

let temperatureThresholds = null;

export function setTemperatureColorThresholds(value) {
  temperatureThresholds = value;
}

function activeTemperatureColorStops() {
  return temperatureColorStops(temperatureThresholds || undefined);
}

function chartColor(property, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(property).trim() || fallback;
}

function isLightTheme() {
  return document.documentElement.dataset.theme === 'light';
}

function canvasPixelRatio(rect) {
  const deviceRatio = window.devicePixelRatio || 1;
  return Math.max(.25, Math.min(deviceRatio, 16384 / rect.width, 4096 / rect.height));
}

function colorWithAlpha(color, alpha) {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color);
  if (!match) return color;
  const channels = match.slice(1).map(value => Number.parseInt(value, 16));
  return `rgba(${channels.join(', ')}, ${Math.max(0, Math.min(1, alpha))})`;
}

function interpolateHexColor(start, end, progress) {
  const channel = (color, offset) => Number.parseInt(color.slice(offset, offset + 2), 16);
  const channels = [1, 3, 5].map(offset => Math.round(channel(start, offset) + (channel(end, offset) - channel(start, offset)) * progress));
  return `rgb(${channels.join(', ')})`;
}

function temperatureColor(value) {
  const stops = activeTemperatureColorStops();
  const source = numericValue(value);
  const numeric = source === null ? null : roundedTemperatureCelsius(source);
  if (numeric === null || numeric <= stops[0].temperature) return stops[0].color;
  const finalStop = stops[stops.length - 1];
  if (numeric >= finalStop.temperature) return finalStop.color;
  const upperIndex = stops.findIndex(stop => stop.temperature >= numeric);
  const lower = stops[upperIndex - 1];
  const upper = stops[upperIndex];
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

function drawTornadoFunnel(context, centerX, height, width, color, visualScale, verticalScale = 1) {
  const availableHeight = height - 8 * visualScale;
  const funnelHeight = availableHeight * Math.max(.35, Math.min(1, verticalScale));
  const top = (height - funnelHeight) / 2;
  const bottom = top + funnelHeight;
  context.save();
  context.strokeStyle = color;
  context.lineCap = 'round';
  context.lineWidth = 1.35 * visualScale;
  context.globalAlpha = .9;
  context.shadowColor = color;
  context.shadowBlur = 5 * visualScale;
  for (let row = 0; row < 7; row += 1) {
    const progress = row / 6;
    const y = top + (bottom - top) * progress;
    const radiusX = Math.max(2.2 * visualScale, width * .5 * Math.pow(1 - progress, .72));
    const radiusY = Math.max(1.4 * visualScale, radiusX * .2);
    const direction = row % 2 ? -1 : 1;
    context.beginPath();
    context.ellipse(centerX, y, radiusX, radiusY, 0, direction > 0 ? Math.PI * .16 : Math.PI * .84, direction > 0 ? Math.PI * 1.92 : -Math.PI * .92, direction < 0);
    context.stroke();
  }
  context.restore();
}

export function drawForecastSky(canvas, points, days = [], options = {}) {
  const rect = canvas.getBoundingClientRect();
  if (!points.length || rect.width < 1) return;
  const ratio = canvasPixelRatio(rect);
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  const context = canvas.getContext('2d');
  context.scale(ratio, ratio);
  const width = rect.width;
  const height = rect.height;
  const configuredRightPadding = Number(options.rightPadding);
  const rightPadding = Number.isFinite(configuredRightPadding) ? Math.max(0, configuredRightPadding) : 34;
  const padding = {left: 0, right: rightPadding};
  const plotWidth = width - padding.left - padding.right;
  const columnWidth = plotWidth / points.length;
  const visualScale = Math.max(.7, Math.min(1.6, Number(options.visualScale) || 1));
  const daylightByDate = forecastDaylightByDate(days);
  const daylight = points.map(point => pointIsDaylight(point, daylightByDate));
  const configuredNumber = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const weatherLineY = configuredNumber(options.weatherLineY, 45);
  const maximumWeatherDepth = configuredNumber(options.maximumWeatherDepth, 25);
  const sunlightGlowDepth = configuredNumber(options.sunlightGlowDepth, 44);
  const moonY = configuredNumber(options.moonY, 64);
  const precipitationY = configuredNumber(options.precipitationY, 84);
  const precipitationLaneTop = Number(options.precipitationLaneTop);
  const fogRows = Array.isArray(options.fogRows) ? options.fogRows : [74, 80, 86];

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
  const sunlightTransitionInset = Math.min(columnWidth * .18, 10 * visualScale);
  let sunlightSegment = [];
  const paintSunlightSegment = values => {
    if (!values.length) return;
    if (values[0].x <= padding.left + columnWidth) values.unshift({...values[0], x: padding.left});
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
    const glowGradient = context.createLinearGradient(0, weatherLineY, 0, weatherLineY + sunlightGlowDepth);
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
        const entersNight = daylight[index - 1] && !daylight[index];
        const fadeX = entersNight
          ? padding.left + index * columnWidth - sunlightTransitionInset
          : padding.left + (index + .5) * columnWidth;
        sunlightSegment.push({x: fadeX, y: weatherLineY, glowY: weatherLineY, value: 0});
      }
      paintSunlightSegment(sunlightSegment);
      sunlightSegment = [];
      return;
    }
    if (!sunlightSegment.length && index > 0 && sunlight[index - 1] !== null) {
      const leavesNight = !daylight[index - 1] && daylight[index];
      const fadeX = leavesNight
        ? padding.left + index * columnWidth + sunlightTransitionInset
        : padding.left + (index - .5) * columnWidth;
      sunlightSegment.push({x: fadeX, y: weatherLineY, glowY: weatherLineY, value: 0});
    }
    sunlightSegment.push({
      x: padding.left + (index + .5) * columnWidth,
      y: weatherLineY + Math.sqrt(value / 100) * maximumWeatherDepth,
      glowY: weatherLineY + value / 100 * sunlightGlowDepth,
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
    context.arc(center, moonY, 7 * visualScale, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = chartColor('--chart-night-cutout', '#080c12');
    context.beginPath();
    context.arc(center + 3 * visualScale, moonY - 3 * visualScale, 7 * visualScale, 0, Math.PI * 2);
    context.fill();
    context.restore();
    nightStart = null;
  });

  let cloudSegment = [];
  const paintCloudSegment = values => {
    if (!values.length) return;
    if (values[0].x <= padding.left + columnWidth) values.unshift({...values[0], x: padding.left});
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
      if (cloudSegment.length && value !== null) {
        cloudSegment.push({x: padding.left + (index + .5) * columnWidth, y: weatherLineY, value: 0});
      }
      paintCloudSegment(cloudSegment);
      cloudSegment = [];
      return;
    }
    if (!cloudSegment.length && index > 0 && cloudCover[index - 1] !== null) {
      cloudSegment.push({x: padding.left + (index - .5) * columnWidth, y: weatherLineY, value: 0});
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
    fogRows.forEach((y, line) => {
      context.beginPath();
      context.moveTo(x + (line % 2 ? 3 : 0), y);
      context.lineTo(x + columnWidth - (line % 2 ? 0 : 3), y);
      context.stroke();
    });
    context.restore();
  });

  if (Number.isFinite(precipitationLaneTop)) {
    context.save();
    context.fillStyle = chartColor('--chart-surface', '#0d1118');
    context.fillRect(0, precipitationLaneTop, width, height - precipitationLaneTop);
    context.strokeStyle = chartColor('--chart-grid', '#293141');
    context.beginPath();
    context.moveTo(0, precipitationLaneTop + .5);
    context.lineTo(width, precipitationLaneTop + .5);
    context.stroke();
    context.restore();
  }

  points.forEach((point, index) => {
    const probability = numericValue(point.precipitationProbability);
    const amount = numericValue(point.precipitation);
    if (probability === null || probability <= 0) return;
    const code = numericValue(point.weatherCode);
    const precipitationAmount = Math.sqrt(Math.max(0, amount ?? 0));
    const rainSize = 4.2 + Math.min(9.2, precipitationAmount * 4.4);
    const opacity = (isLightTheme() ? .3 : .2) + Math.min(100, probability) / 100 * (isLightTheme() ? .7 : .8);
    const center = padding.left + (index + .5) * columnWidth;
    if ([71, 73, 75, 77, 85, 86].includes(code)) {
      const snowfall = numericValue(point.snowfall);
      drawSnowflake(context, center, precipitationY, (3 + Math.min(6, Math.sqrt(Math.max(0, snowfall ?? 0)) * 3)) * visualScale, opacity);
    } else if ([96, 99].includes(code)) {
      const hailSize = 2.1 + Math.min(2.7, precipitationAmount * 1.25);
      drawHailstone(context, center, precipitationY - 1, hailSize * visualScale, opacity);
    } else {
      drawRainDrop(context, center, precipitationY, rainSize * visualScale, opacity);
    }
  });

  const groupedHours = Math.max(1, Number(options.groupHours) || 1);
  const temperatureStep = Math.max(1, Math.round(Number(options.temperatureStep) || 1));
  const hourFontSize = Math.max(9, 9 * visualScale);
  const dayFontSize = Math.min(16, Math.max(14, 14 * visualScale));
  const temperatureFontSize = Math.min(18, Math.max(14, 12 * visualScale));
  const hourY = configuredNumber(options.hourY, 24);
  const temperatureY = configuredNumber(options.temperatureY, 36);
  context.font = `700 ${hourFontSize}px ui-monospace, monospace`;
  context.textAlign = 'center';
  points.forEach((point, index) => {
    const x = padding.left + (index + .5) * columnWidth;
    if (options.showHours !== false) {
      context.fillStyle = chartColor('--chart-muted', '#8d98aa');
      context.fillText(String(point.timestamp).slice(11, 13), x, hourY);
    }
    const numericTemperature = numericValue(point.temperature);
    if (options.showHourlyTemperatures !== false && index % temperatureStep === 0 && numericTemperature !== null) {
      const label = shortTemperature(numericTemperature);
      context.fillStyle = temperatureColor(numericTemperature);
      context.font = `700 ${temperatureFontSize}px ui-monospace, monospace`;
      context.save();
      context.lineJoin = 'round';
      const whiteTemperature = roundedTemperatureCelsius(numericTemperature) <= (temperatureThresholds?.deepFrost ?? -12);
      if (!isLightTheme() || whiteTemperature) {
        context.miterLimit = 2;
        context.strokeStyle = chartColor('--chart-temperature-label-outline', 'rgba(5, 9, 15, .92)');
        context.lineWidth = isLightTheme() ? Math.max(1.4, temperatureFontSize * .14) : Math.max(2, temperatureFontSize * .28);
        context.strokeText(label, x, temperatureY);
      }
      context.fillText(label, x, temperatureY);
      context.restore();
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
    if (options.showDayLabels === false) return;
    context.fillStyle = chartColor('--chart-text', '#e7edf7');
    context.textAlign = 'left';
    const dayLabel = index === 0
      ? t('forecast.today')
      : formatForecastDate(point.timestamp, {weekday: options.fullDayLabels ? 'long' : 'short'});
    const nextDayIndex = points.findIndex((candidate, candidateIndex) => (
      candidateIndex > index && String(candidate.timestamp).slice(0, 10) !== date
    ));
    const dayStartX = padding.left + index * columnWidth;
    const dayEndX = padding.left + (nextDayIndex === -1 ? points.length : nextDayIndex) * columnWidth;
    context.font = `900 ${dayFontSize}px ui-monospace, monospace`;
    context.save();
    context.beginPath();
    context.rect(dayStartX, 0, Math.max(0, dayEndX - dayStartX), dayFontSize + 3);
    context.clip();
    context.fillText(dayLabel.toUpperCase(), dayStartX + 5, dayFontSize);
    context.restore();
    context.font = `700 ${hourFontSize}px ui-monospace, monospace`;
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

export function drawWindFlow(canvas, points, options = {}) {
  const rect = canvas.getBoundingClientRect();
  if (!points.length || rect.width < 1 || rect.height < 1) return;
  const ratio = canvasPixelRatio(rect);
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  const context = canvas.getContext('2d');
  context.scale(ratio, ratio);
  const width = rect.width;
  const height = rect.height;
  const configuredRightPadding = Number(options.rightPadding);
  const rightPadding = Number.isFinite(configuredRightPadding) ? Math.max(0, configuredRightPadding) : 34;
  const plotWidth = width - rightPadding;
  const columnWidth = plotWidth / points.length;
  const visualScale = Math.max(.7, Math.min(1.6, Number(options.visualScale) || 1));
  const rawSpeeds = points.map(point => Math.max(0, numericValue(point.windSpeed) ?? 0));
  const gustiness = points.map((point, index) => {
    const gust = Math.max(rawSpeeds[index], numericValue(point.windGusts) ?? rawSpeeds[index]);
    return Math.min(1, Math.max(0, gust - rawSpeeds[index]) / 30);
  });
  const speeds = rawSpeeds.map((speed, index) => {
    const weighted = [-3, -2, -1, 0, 1, 2, 3]
      .map((offset, weightIndex) => ({value: rawSpeeds[index + offset], weight: [1, 2, 3, 4, 3, 2, 1][weightIndex]}))
      .filter(item => item.value !== undefined);
    const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
    return weighted.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
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
  const strength = speeds.map(speed => Math.min(1, speed / 32));
  const cumulativePhases = frequencies => frequencies.reduce((phases, frequency, index) => {
    phases.push(index === 0 ? 0 : phases[index - 1] + (frequencies[index - 1] + frequency) / 2);
    return phases;
  }, []);
  const waveFrequencies = strength.map((value, index) => .28 + value * .06 + Math.pow(gustiness[index], 1.35) * 5);
  const gustFrequencies = gustiness.map(value => .68 + value * 6);
  const wavePhases = cumulativePhases(waveFrequencies);
  const gustPhases = cumulativePhases(gustFrequencies);
  const strandPositions = [-1, -.6, -.2, .2, .6, 1];
  const strandWeights = [.58, .78, 1, .96, .76, .56];
  const windColor = chartColor('--chart-wind-flow', '#9bc7d7');
  const flowCenterY = index => height * .61
    + Math.sin(index * .085 + directions[index] * .2) * (.15 + strength[index] * 1.2) * visualScale;
  const flowCenters = points.map((unused, index) => flowCenterY(index));
  const sampleSeries = (values, position) => {
    const start = Math.max(0, Math.min(values.length - 1, Math.floor(position)));
    const end = Math.min(values.length - 1, start + 1);
    const progress = Math.max(0, Math.min(1, position - start));
    return values[start] + (values[end] - values[start]) * progress;
  };
  const lineY = (position, lineIndex) => {
    const currentStrength = sampleSeries(strength, position);
    const currentGustiness = sampleSeries(gustiness, position);
    const direction = sampleSeries(directions, position);
    const lanePosition = strandPositions[lineIndex];
    const baseAmplitude = Math.pow(currentStrength, 1.08) * height * .18 * visualScale;
    const gustMultiplier = 1 + Math.pow(currentGustiness, 1.6) * 1.8;
    const amplitude = Math.min(height * .34 * visualScale, baseAmplitude * gustMultiplier);
    const mainWave = Math.sin(sampleSeries(wavePhases, position) + direction * .14 + lineIndex * .11) * amplitude;
    const secondaryWave = Math.sin(position * .16 + lineIndex * .23) * amplitude * .28;
    const gustWave = Math.sin(sampleSeries(gustPhases, position) + lineIndex * .37) * currentGustiness * baseAmplitude * .8;
    const separation = lanePosition * (2.2 + currentStrength * 5.1) * visualScale;
    return Math.max(3 * visualScale, Math.min(height - 3 * visualScale, sampleSeries(flowCenters, position) + separation + mainWave + secondaryWave + gustWave));
  };

  context.clearRect(0, 0, width, height);
  points.forEach((point, index) => {
    const x = index * columnWidth;
    context.strokeStyle = chartColor('--chart-hour-grid', 'rgba(154, 164, 178, .1)');
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  });
  const lineCount = strandPositions.length;
  const samplesPerHour = 8;
  const windGradient = opacity => {
    const gradient = context.createLinearGradient(0, 0, plotWidth, 0);
    points.forEach((point, index) => {
      gradient.addColorStop(index / Math.max(1, points.length - 1), colorWithAlpha(windColor, opacity(strength[index])));
    });
    return gradient;
  };
  context.save();
  context.beginPath();
  for (let index = 0; index < points.length - 1; index += 1) {
    const startX = (index + .5) * columnWidth;
    const endX = (index + 1.5) * columnWidth;
    const startLines = strandPositions.map((unused, lineIndex) => lineY(index, lineIndex));
    const endLines = strandPositions.map((unused, lineIndex) => lineY(index + 1, lineIndex));
    const startTop = Math.min(...startLines);
    const startBottom = Math.max(...startLines);
    const endTop = Math.min(...endLines);
    const endBottom = Math.max(...endLines);
    context.moveTo(startX, startTop);
    context.bezierCurveTo(startX + columnWidth * .42, startTop, endX - columnWidth * .42, endTop, endX, endTop);
    context.lineTo(endX, endBottom);
    context.bezierCurveTo(endX - columnWidth * .42, endBottom, startX + columnWidth * .42, startBottom, startX, startBottom);
    context.closePath();
  }
  context.fillStyle = windGradient(value => .001 + Math.pow(value, 1.35) * .045);
  context.filter = `blur(${2.5 * visualScale}px)`;
  context.fill();
  context.restore();

  for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
    const strandWeight = strandWeights[lineIndex];
    context.save();
    context.beginPath();
    context.moveTo(0, lineY(0, lineIndex));
    context.lineTo(.5 * columnWidth, lineY(0, lineIndex));
    for (let index = 0; index < points.length - 1; index += 1) {
      for (let sample = 1; sample <= samplesPerHour; sample += 1) {
        const position = index + sample / samplesPerHour;
        context.lineTo((position + .5) * columnWidth, lineY(position, lineIndex));
      }
    }
    context.strokeStyle = windGradient(value => .002 + Math.pow(value, 1.35) * .12);
    context.globalAlpha = .6 + strandWeight * .4;
    context.lineWidth = 5 * strandWeight * visualScale;
    context.shadowColor = windColor;
    context.shadowBlur = 5 * visualScale;
    context.stroke();
    context.restore();
    for (let index = 0; index < points.length - 1; index += 1) {
      const startX = (index + .5) * columnWidth;
      const averageStrength = (strength[index] + strength[index + 1]) / 2;
      const traceSegment = () => {
        context.beginPath();
        context.moveTo(startX, lineY(index, lineIndex));
        for (let sample = 1; sample <= samplesPerHour; sample += 1) {
          const position = index + sample / samplesPerHour;
          context.lineTo((position + .5) * columnWidth, lineY(position, lineIndex));
        }
      };

      context.save();
      traceSegment();
      context.strokeStyle = windColor;
      context.globalAlpha = (.001 + Math.pow(averageStrength, 1.22) * .92) * (.65 + strandWeight * .35);
      context.lineWidth = (.35 + averageStrength * 1.85) * (.82 + strandWeight * .18) * visualScale;
      context.lineCap = 'round';
      context.stroke();
      context.restore();
    }
  }

  context.save();
  context.beginPath();
  context.rect(0, 0, plotWidth, height);
  context.clip();
  let tornadoStart = null;
  points.forEach((point, index) => {
    if (point.tornado === true && tornadoStart === null) tornadoStart = index;
    const closesTornado = tornadoStart !== null && (point.tornado !== true || index === points.length - 1);
    if (!closesTornado) return;
    const tornadoEnd = point.tornado === true ? index : index - 1;
    const centerX = ((tornadoStart + tornadoEnd + 1) / 2) * columnWidth;
    const tornadoWidth = Math.max(22 * visualScale, Math.min(40 * visualScale, (tornadoEnd - tornadoStart + 1) * columnWidth * 1.4));
    drawTornadoFunnel(context, centerX, height, tornadoWidth, windColor, visualScale, options.tornadoVerticalScale);
    tornadoStart = null;
  });
  context.restore();
}

export function drawWeatherChart(canvas, points, days = [], options = {}) {
  const rect = canvas.getBoundingClientRect();
  if (!points.length || rect.width < 1) return;
  const ratio = canvasPixelRatio(rect);
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  const context = canvas.getContext('2d');
  context.scale(ratio, ratio);
  const width = rect.width;
  const height = rect.height;
  const configuredRightPadding = Number(options.rightPadding);
  const rightPadding = Number.isFinite(configuredRightPadding) ? Math.max(0, configuredRightPadding) : 34;
  const padding = {left: options.timeline ? 0 : 30, right: rightPadding, top: options.timeline ? 0 : 24, bottom: options.timeline ? 0 : 22};
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const columnWidth = plotWidth / points.length;
  const visualScale = Math.max(.7, Math.min(1.6, Number(options.visualScale) || 1));
  const configuredAreaOpacity = Number(options.apparentAreaOpacity);
  const apparentAreaOpacity = Number.isFinite(configuredAreaOpacity) ? Math.max(0, Math.min(1, configuredAreaOpacity)) : .18;
  const precipitationValues = points.map(point => numericValue(point.precipitation)).filter(value => value !== null);
  const forecastMaximum = Math.max(0, ...(precipitationValues.length ? precipitationValues : [0]));
  const maxPrecipitation = Math.max(10, Math.ceil(forecastMaximum / 5) * 5);
  const percentY = value => padding.top + (1 - value / 100) * plotHeight;
  const range = options.timeline
    ? (options.temperatureRange || temperatureRange(points, options.showApparentTemperature !== false))
    : {minimum: -20, maximum: 40};
  const temperatureSpan = Math.max(1, range.maximum - range.minimum);
  const temperatureY = value => padding.top + (1 - (value - range.minimum) / temperatureSpan) * plotHeight;

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
  if (range.minimum <= 0 && range.maximum >= 0) {
    context.strokeStyle = 'rgba(86, 215, 229, .55)';
    context.setLineDash([4, 4]);
    context.beginPath(); context.moveTo(padding.left, zeroY); context.lineTo(width - padding.right, zeroY); context.stroke();
    context.setLineDash([]);
  }
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
        context.moveTo(options.timeline ? padding.left : pointX, pointY);
        if (options.timeline) context.lineTo(pointX, pointY);
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
    return value === null || options.timeline ? value : Math.max(-20, Math.min(40, value));
  });
  const displayedTemperatures = temperatures;
  const apparentTemperatures = points.map(point => {
    const value = numericValue(point.apparentTemperature);
    return value === null || options.timeline ? value : Math.max(-20, Math.min(40, value));
  });
  const displayedApparentTemperatures = apparentTemperatures;
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
      context.fillStyle = averageDifference >= 0
        ? `rgba(242, 142, 62, ${apparentAreaOpacity})`
        : `rgba(59, 142, 229, ${apparentAreaOpacity})`;
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
    temperatureGradient.addColorStop(0, temperatureColor(range.maximum));
    [...activeTemperatureColorStops()].reverse().filter(stop => stop.temperature < range.maximum && stop.temperature > range.minimum).forEach(stop => {
      temperatureGradient.addColorStop((range.maximum - stop.temperature) / temperatureSpan, stop.color);
    });
    temperatureGradient.addColorStop(1, temperatureColor(range.minimum));
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
