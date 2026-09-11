'use strict';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const TEMPERATURE_RANGES = [
  {minimum: 14, maximum: 25},
  {minimum: 16, maximum: 29},
  {minimum: 8, maximum: 32},
  {minimum: -6, maximum: 22},
  {minimum: -4, maximum: 3},
  {minimum: -18, maximum: -6},
  {minimum: -2, maximum: 7},
  {minimum: 24, maximum: 38},
  {minimum: 16, maximum: 27},
  {minimum: 9, maximum: 18}
];

const FUTURE_SCENARIOS = [
  {code: 0, cloudCover: 0},
  {code: 1, cloudCover: 18},
  {code: 2, cloudCover: 48},
  {code: 3, cloudCover: 100},
  {code: 45, cloudCover: 85, visibility: 450},
  {code: 48, cloudCover: 95, visibility: 180},
  {code: 53, cloudCover: 75, probability: 62, precipitation: .2},
  {code: 57, cloudCover: 88, probability: 76, precipitation: .3, temperature: -1},
  {code: 63, cloudCover: 92, probability: 86, precipitation: 1.4},
  {code: 67, cloudCover: 96, probability: 82, precipitation: 1.1, temperature: -2},
  {code: 73, cloudCover: 100, probability: 90, precipitation: .8, snowfall: 1.5, temperature: -4},
  {code: 77, cloudCover: 90, probability: 68, precipitation: .2, snowfall: .4, temperature: -3},
  {code: 82, cloudCover: 86, probability: 94, precipitation: 3.2},
  {code: 86, cloudCover: 100, probability: 91, precipitation: 1.2, snowfall: 2.4, temperature: -5},
  {code: 95, cloudCover: 100, probability: 96, precipitation: 4.2},
  {code: 99, cloudCover: 100, probability: 100, precipitation: 5.5}
];

function pad(value) {
  return String(value).padStart(2, '0');
}

function localTimestamp(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localDate(date) {
  return localTimestamp(date).slice(0, 10);
}

function temperatureForRange(date, start, dayIndex, {minimum, maximum}) {
  let warmth;
  if (dayIndex === 0) {
    const lastHour = new Date(start);
    lastHour.setHours(23, 0, 0, 0);
    const progress = Math.max(0, Math.min(1, (date - start) / Math.max(HOUR, lastHour - start)));
    warmth = Math.sin(Math.PI * progress);
  } else {
    warmth = (1 + Math.sin((date.getHours() - 9) / 24 * Math.PI * 2)) / 2;
  }
  return minimum + (maximum - minimum) * warmth;
}

function weatherScenario(code, cloudCover, probability = 0, precipitation = 0, snowfall = 0, visibility = 24000) {
  return {code, cloudCover, probability, precipitation, snowfall, visibility};
}

function weatherForHour(dayIndex, hour) {
  if (dayIndex === 0) {
    return weatherScenario(hour < 18 ? 0 : 1, hour < 18 ? 0 : 18);
  }
  if (dayIndex === 1) {
    if (hour < 14) return weatherScenario(hour < 7 ? 1 : 0, hour < 7 ? 18 : 5);
    if (hour === 14) return weatherScenario(2, 42, 10);
    if (hour === 15) return weatherScenario(3, 68, 22, .1);
    if (hour >= 16 && hour <= 18) {
      const phase = hour - 16;
      return weatherScenario(95, 78 + phase * 7, 30 + phase * 12, .25 + phase * .25);
    }
    if (hour === 19) return weatherScenario(61, 72, 38, .35);
    return weatherScenario(2, 45, 12);
  }
  if (dayIndex === 2) {
    if (hour < 8) return weatherScenario(1, 15);
    if (hour < 18) return weatherScenario(0, 3);
    return weatherScenario(2, 28);
  }
  if (dayIndex === 3) {
    if (hour === 0) return weatherScenario(45, 82, 5, 0, 0, 420);
    if (hour <= 2) return weatherScenario(48, 96, 8, 0, 0, 150);
    if (hour === 3) return weatherScenario(71, 78, 20, .08, .2);
    if (hour === 4) return weatherScenario(73, 88, 46, .28, .8);
    if (hour >= 5 && hour <= 6) return weatherScenario(hour === 5 ? 75 : 86, 100, hour === 5 ? 88 : 98, hour === 5 ? 1.1 : 1.8, hour === 5 ? 2.6 : 4.1);
    if (hour === 7) return weatherScenario(67, 98, 76, .9, 0, 900);
    if (hour === 8) return weatherScenario(53, 88, 48, .25);
    if (hour <= 10) return weatherScenario(63, 92, hour === 9 ? 68 : 82, hour === 9 ? 1.2 : 2.2);
    if (hour === 11) return weatherScenario(3, 80, 32, .15);
    if (hour === 12) return weatherScenario(2, 58, 18);
    if (hour === 13) return weatherScenario(3, 72, 22, .1);
    if (hour === 14) return weatherScenario(96, 88, 38, .45);
    if (hour === 15) return weatherScenario(99, 100, 98, 5.5);
    if (hour >= 16 && hour <= 19) return {...weatherScenario(99, 100, 96, 5.2), tornado: true};
    if (hour === 20) return weatherScenario(95, 95, 84, 3.2);
    if (hour === 21) return weatherScenario(63, 82, 62, 1.2);
    return weatherScenario(2, 55, 20, .1);
  }
  if (dayIndex === 4) {
    if (hour < 4) return weatherScenario(3, 72, 12);
    if (hour >= 5 && hour <= 10) {
      const probability = [18, 28, 38, 46, 34, 22][hour - 5];
      return weatherScenario(hour < 7 ? 71 : 73, 68 + probability / 2, probability, .08 + probability / 250, .1 + probability / 90);
    }
    return weatherScenario(2, hour < 16 ? 52 : 35, 8);
  }
  if (dayIndex === 5) {
    if (hour < 5) return weatherScenario(3, 90, 42, .2, .5);
    if (hour <= 15) {
      const intensity = Math.sin((hour - 5) / 10 * Math.PI);
      return weatherScenario(intensity > .72 ? 86 : 75, 96 + intensity * 4, 72 + intensity * 27, .5 + intensity * 1.7, 1 + intensity * 3.2);
    }
    return weatherScenario(73, 82, 48, .25, .7);
  }
  if (dayIndex === 6) {
    if (hour < 7) return weatherScenario(48, 96, 8, 0, 0, 160);
    if (hour < 10) return weatherScenario(67, 92, 66, .7, 0, 700);
    if (hour < 15) return weatherScenario(3, 78, 20);
    return weatherScenario(2, 45, 8);
  }
  if (dayIndex === 7) {
    return weatherScenario(hour < 8 || hour > 20 ? 1 : 0, hour < 8 || hour > 20 ? 18 : 2);
  }
  if (dayIndex === 8) {
    if (hour < 8) return weatherScenario(45, 82, 5, 0, 0, 450);
    if (hour < 14) return weatherScenario(53, 75, 58, .2);
    return weatherScenario(61, 88, 78, .8);
  }
  if (dayIndex === 9) {
    return hour < 12 ? weatherScenario(3, 88, 25, .1) : weatherScenario(2, 48, 8);
  }
  return weatherScenario(2, 45);
}

function apparentTemperatureFor({temperature, humidity, windSpeed, cloudCover, precipitation, hour}) {
  let apparentTemperature = temperature;
  if (temperature <= 10 && windSpeed >= 4.8) {
    const windFactor = Math.pow(windSpeed, .16);
    apparentTemperature = 13.12 + .6215 * temperature - 11.37 * windFactor + .3965 * temperature * windFactor;
  } else {
    const vaporPressure = humidity / 100 * 6.105 * Math.exp(17.27 * temperature / (237.7 + temperature));
    const windSpeedMetersPerSecond = windSpeed / 3.6;
    apparentTemperature = temperature + .33 * vaporPressure - .7 * windSpeedMetersPerSecond - 4;
  }
  const daylightFactor = hour >= 6 && hour <= 19 ? Math.sin((hour - 6) / 13 * Math.PI) : 0;
  const radiantWarmth = Math.max(0, daylightFactor) * (1 - cloudCover / 100) * 3;
  const rainCooling = Math.min(3.5, precipitation * .55);
  return apparentTemperature + radiantWarmth - rainCooling;
}

export function createWeatherDemo() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  const firstDay = new Date(start);
  firstDay.setHours(0, 0, 0, 0);

  const hourly = Array.from({length: 240}, (_, index) => {
    const date = new Date(start.getTime() + index * HOUR);
    const dayIndex = Math.floor((date - firstDay) / DAY);
    const temperatureRange = TEMPERATURE_RANGES[dayIndex];
    const naturalTemperature = 8 + Math.sin((date.getHours() - 7) / 24 * Math.PI * 2) * 8;
    const temperature = temperatureRange ? temperatureForRange(date, start, dayIndex, temperatureRange) : naturalTemperature;
    const scenario = weatherForHour(dayIndex, date.getHours());
    const humidity = Math.min(100, 45 + scenario.cloudCover * .48);
    const isThunderstorm = [95, 96, 99].includes(scenario.code);
    const windSpeed = isThunderstorm
      ? 8 + scenario.probability * .18
      : scenario.precipitation > 0 ? 5 + scenario.probability * .05 : 2 + index % 5;
    const apparentTemperature = apparentTemperatureFor({
      temperature,
      humidity,
      windSpeed,
      cloudCover: scenario.cloudCover,
      precipitation: scenario.precipitation,
      hour: date.getHours()
    });
    return {
      timestamp: localTimestamp(date),
      temperature: Number(temperature.toFixed(1)),
      apparentTemperature: Number(apparentTemperature.toFixed(1)),
      relativeHumidity: Number(humidity.toFixed(0)),
      cloudCover: scenario.cloudCover,
      weatherCode: scenario.code,
      precipitationProbability: scenario.probability ?? 0,
      precipitation: scenario.precipitation ?? 0,
      rain: [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(scenario.code) ? scenario.precipitation ?? 0 : 0,
      snowfall: scenario.snowfall ?? 0,
      windSpeed,
      windDirection: index * 23 % 360,
      windGusts: windSpeed + 9,
      tornado: scenario.tornado === true,
      visibility: scenario.visibility ?? 24000,
      surfacePressure: 1007 + Math.sin(index / 18) * 9,
      uvIndex: scenario.cloudCover < 50 ? 4 : 1
    };
  });

  const daily = Array.from({length: 15}, (_, index) => {
    const date = new Date(firstDay.getTime() + index * 24 * HOUR);
    const sunrise = new Date(date); sunrise.setHours(6, 30, 0, 0);
    const sunset = new Date(date); sunset.setHours(18, 45, 0, 0);
    const scenario = FUTURE_SCENARIOS[index % FUTURE_SCENARIOS.length];
    const temperatureRange = TEMPERATURE_RANGES[index];
    return {
      date: localDate(date),
      weatherCode: scenario.code,
      temperatureMaximum: temperatureRange?.maximum ?? scenario.temperature ?? 16,
      temperatureMinimum: temperatureRange?.minimum ?? (scenario.temperature === undefined ? 6 : scenario.temperature - 3),
      sunrise: localTimestamp(sunrise),
      sunset: localTimestamp(sunset),
      daylightDuration: (sunset - sunrise) / 1000,
      sunshineDuration: Math.max(0, (sunset - sunrise) / 1000 * (1 - scenario.cloudCover / 100)),
      precipitation: (scenario.precipitation ?? 0) * 5,
      precipitationProbability: scenario.probability ?? 0,
      windSpeedMaximum: 8 + index * 2,
      windGustsMaximum: 18 + index * 2,
      windDirection: index * 31 % 360,
      uvIndexMaximum: scenario.cloudCover < 50 ? 5 : 1
    };
  });

  return {
    available: true,
    demo: true,
    current: {
      timestamp: hourly[0].timestamp,
      temperature: hourly[0].temperature,
      apparentTemperature: hourly[0].apparentTemperature,
      relativeHumidity: hourly[0].relativeHumidity,
      surfacePressure: hourly[0].surfacePressure,
      cloudCover: hourly[0].cloudCover,
      weatherCode: hourly[0].weatherCode,
      windSpeed: hourly[0].windSpeed,
      windDirection: hourly[0].windDirection,
      windGusts: hourly[0].windGusts
    },
    hourly,
    daily,
    location: {latitude: 50.6709, longitude: 19.12265}
  };
}
