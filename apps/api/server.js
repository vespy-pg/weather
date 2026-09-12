import http from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {findByIso2} from 'country-list-js';
import {
  COUNTRY_LANGUAGE,
  DEFAULT_LOCALE,
  LANGUAGE_ALIASES,
  PROVIDER_LANGUAGES,
  SUPPORTED_LOCALES
} from './generated/i18n-config.js';

const PORT = Number(process.env.PORT || 8080);
const CACHE_TTL_MS = Number(process.env.WEATHER_CACHE_TTL_MS || 10 * 60 * 1000);
const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web');
const cache = new Map();

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function json(response, status, body, additionalHeaders = {}) {
  response.writeHead(status, {
    'Access-Control-Allow-Origin': process.env.WEATHER_ALLOWED_ORIGIN || '*',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    ...additionalHeaders
  });
  response.end(JSON.stringify(body));
}

export function promotionFeed({platform = 'web', placement = 'web_forecast', language = DEFAULT_LOCALE, theme = 'dark'} = {}) {
  const localized = normalizeLocale(language) === 'pl-PL';
  const supportedPlatforms = ['web', 'android', 'ios'];
  const normalizedPlatform = supportedPlatforms.includes(platform) ? platform : 'web';
  const normalizedTheme = theme === 'light' ? 'light' : 'dark';
  const campaigns = placement === 'web_forecast' ? [{
    id: 'dinpanel-web-2026-09',
    type: 'native-card',
    eyebrow: localized ? 'APLIKACJA VESPY' : 'A VESPY APP',
    title: 'DINPanel',
    description: localized
      ? 'Projektuj instalacje elektryczne, rozdzielnice i dokumentację w jednym miejscu.'
      : 'Design electrical installations, distribution boards, and documentation in one place.',
    actionLabel: localized ? 'Poznaj DINPanel' : 'Explore DINPanel',
    logoUrl: 'assets/dinpanel-promo.svg',
    targetUrl: localized ? 'https://dinpanel.com/pl/' : 'https://dinpanel.com/',
    backgroundColor: normalizedTheme === 'light' ? '#fff8f3' : '#181513',
    accentColor: '#f47b32',
    priority: 100
  }] : [];
  return {
    schemaVersion: 1,
    platform: normalizedPlatform,
    placement,
    rotationSeconds: 8,
    cacheSeconds: 3600,
    campaigns
  };
}

async function cachedFetch(url) {
  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const response = await fetch(url, {headers: {'User-Agent': 'weather/0.1 (https://vespy.pl/pogoda/)'}});
  if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
  const value = await response.json();
  cache.set(url, {expiresAt: Date.now() + CACHE_TTL_MS, value});
  return value;
}

function at(source, key, index) {
  return source?.[key]?.[index] ?? null;
}

export function normalizeForecast(source, location) {
  const allHourlyTimes = source.hourly?.time || [];
  const currentHour = String(source.current?.time || '').slice(0, 13);
  const matchingHourIndex = allHourlyTimes.findIndex(timestamp => String(timestamp).slice(0, 13) === currentHour);
  const hourlyStartIndex = matchingHourIndex < 0 ? 0 : matchingHourIndex;
  const hourlyTimes = allHourlyTimes.slice(hourlyStartIndex, hourlyStartIndex + 240);
  const dailyTimes = source.daily?.time || [];
  return {
    available: true,
    current: {
      timestamp: source.current?.time ?? null,
      temperature: source.current?.temperature_2m ?? null,
      apparentTemperature: source.current?.apparent_temperature ?? null,
      relativeHumidity: source.current?.relative_humidity_2m ?? null,
      cloudCover: source.current?.cloud_cover ?? null,
      weatherCode: source.current?.weather_code ?? null,
      precipitation: source.current?.precipitation ?? null,
      windSpeed: source.current?.wind_speed_10m ?? null,
      windDirection: source.current?.wind_direction_10m ?? null,
      windGusts: source.current?.wind_gusts_10m ?? null,
      surfacePressure: source.current?.surface_pressure ?? null
    },
    hourly: hourlyTimes.map((timestamp, index) => {
      const sourceIndex = hourlyStartIndex + index;
      return {
      timestamp,
      temperature: at(source.hourly, 'temperature_2m', sourceIndex),
      apparentTemperature: at(source.hourly, 'apparent_temperature', sourceIndex),
      relativeHumidity: at(source.hourly, 'relative_humidity_2m', sourceIndex),
      precipitationProbability: at(source.hourly, 'precipitation_probability', sourceIndex),
      precipitation: at(source.hourly, 'precipitation', sourceIndex),
      rain: at(source.hourly, 'rain', sourceIndex),
      snowfall: at(source.hourly, 'snowfall', sourceIndex),
      weatherCode: at(source.hourly, 'weather_code', sourceIndex),
      cloudCover: at(source.hourly, 'cloud_cover', sourceIndex),
      windSpeed: at(source.hourly, 'wind_speed_10m', sourceIndex),
      windDirection: at(source.hourly, 'wind_direction_10m', sourceIndex),
      windGusts: at(source.hourly, 'wind_gusts_10m', sourceIndex),
      visibility: at(source.hourly, 'visibility', sourceIndex),
      surfacePressure: at(source.hourly, 'surface_pressure', sourceIndex),
      uvIndex: at(source.hourly, 'uv_index', sourceIndex)
    };
    }),
    daily: dailyTimes.map((date, index) => ({
      date,
      weatherCode: at(source.daily, 'weather_code', index),
      temperatureMaximum: at(source.daily, 'temperature_2m_max', index),
      temperatureMinimum: at(source.daily, 'temperature_2m_min', index),
      apparentTemperatureMaximum: at(source.daily, 'apparent_temperature_max', index),
      apparentTemperatureMinimum: at(source.daily, 'apparent_temperature_min', index),
      sunrise: at(source.daily, 'sunrise', index),
      sunset: at(source.daily, 'sunset', index),
      daylightDuration: at(source.daily, 'daylight_duration', index),
      sunshineDuration: at(source.daily, 'sunshine_duration', index),
      precipitation: at(source.daily, 'precipitation_sum', index),
      precipitationProbability: at(source.daily, 'precipitation_probability_max', index),
      windSpeedMaximum: at(source.daily, 'wind_speed_10m_max', index),
      windGustsMaximum: at(source.daily, 'wind_gusts_10m_max', index),
      windDirection: at(source.daily, 'wind_direction_10m_dominant', index),
      uvIndexMaximum: at(source.daily, 'uv_index_max', index)
    })),
    location
  };
}

export function forecastUrl({latitude, longitude, timezone}) {
  const parameters = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone: timezone || 'auto',
    forecast_days: '15',
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    hourly: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,rain,snowfall,weather_code,cloud_cover,surface_pressure,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,daylight_duration,sunshine_duration,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,uv_index_max'
  });
  return `https://api.open-meteo.com/v1/forecast?${parameters}`;
}

export function normalizeLocale(language) {
  const requested = String(language || '').replaceAll('_', '-').toLowerCase();
  const exact = SUPPORTED_LOCALES.find(locale => locale.toLowerCase() === requested);
  return exact || LANGUAGE_ALIASES[requested] || LANGUAGE_ALIASES[requested.split('-')[0]] || DEFAULT_LOCALE;
}

export function locationSearchUrl(query, language = DEFAULT_LOCALE) {
  const providerLanguage = PROVIDER_LANGUAGES[normalizeLocale(language)] || PROVIDER_LANGUAGES[DEFAULT_LOCALE];
  const parameters = new URLSearchParams({name: query, count: '8', language: providerLanguage, format: 'json'});
  return `https://geocoding-api.open-meteo.com/v1/search?${parameters}`;
}

async function locations(requestUrl, response) {
  const query = requestUrl.searchParams.get('q')?.trim();
  if (!query || query.length < 2) return json(response, 400, {error: 'Enter at least two characters.'});
  const source = await cachedFetch(locationSearchUrl(query, requestUrl.searchParams.get('language')));
  const results = (source.results || []).map(item => ({
    id: item.id,
    name: item.name,
    country: item.country,
    admin1: item.admin1 || null,
    postalCode: item.postcodes?.[0] || null,
    latitude: item.latitude,
    longitude: item.longitude,
    timezone: item.timezone
  }));
  return json(response, 200, {results});
}

export function preferredLanguageForCountry(countryCode) {
  return COUNTRY_LANGUAGE[String(countryCode || '').toUpperCase()] || DEFAULT_LOCALE;
}

export function selectCapitalResult(results, countryCode) {
  const normalizedCode = String(countryCode || '').toUpperCase();
  return (results || []).find(item => item.country_code === normalizedCode && item.feature_code === 'PPLC')
    || (results || []).find(item => item.country_code === normalizedCode)
    || null;
}

async function bootstrapLocation(request, response) {
  const countryCode = String(request.headers['x-visitor-country'] || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) return json(response, 200, {location: null});
  const country = findByIso2(countryCode);
  if (!country?.capital) return json(response, 200, {location: null});
  const parameters = new URLSearchParams({name: country.capital, count: '10', language: 'en', format: 'json'});
  const source = await cachedFetch(`https://geocoding-api.open-meteo.com/v1/search?${parameters}`);
  const capital = selectCapitalResult(source.results, countryCode);
  if (!capital) return json(response, 200, {location: null});
  return json(response, 200, {countryCode, language: preferredLanguageForCountry(countryCode), location: {
    id: `capital-${countryCode}`,
    name: capital.name,
    country: country.name,
    latitude: capital.latitude,
    longitude: capital.longitude,
    timezone: capital.timezone || 'auto'
  }});
}

export function normalizeReverseLocation(source, fallback) {
  const address = source?.address || {};
  const namedPlace = ['city', 'town', 'village', 'hamlet', 'suburb'].includes(source?.addresstype) ? source.name : null;
  const name = namedPlace
    || address.city
    || address.town
    || address.village
    || address.hamlet
    || address.municipality
    || address.suburb
    || source?.name
    || fallback.name;
  return {
    ...fallback,
    name,
    country: address.country || fallback.country || ''
  };
}

async function reverseLocation(requestUrl, response) {
  const latitude = Number(requestUrl.searchParams.get('latitude'));
  const longitude = Number(requestUrl.searchParams.get('longitude'));
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return json(response, 400, {error: 'Valid latitude and longitude are required.'});
  }
  const language = PROVIDER_LANGUAGES[normalizeLocale(requestUrl.searchParams.get('language'))] || PROVIDER_LANGUAGES[DEFAULT_LOCALE];
  const fallback = {
    id: `device-${latitude.toFixed(4)}-${longitude.toFixed(4)}`,
    name: 'Current location',
    country: '',
    latitude: Number(latitude.toFixed(5)),
    longitude: Number(longitude.toFixed(5)),
    timezone: requestUrl.searchParams.get('timezone') || 'auto'
  };
  const parameters = new URLSearchParams({
    format: 'jsonv2',
    lat: latitude.toFixed(5),
    lon: longitude.toFixed(5),
    zoom: '14',
    addressdetails: '1',
    'accept-language': language
  });
  const source = await cachedFetch(`https://nominatim.openstreetmap.org/reverse?${parameters}`);
  return json(response, 200, {location: normalizeReverseLocation(source, fallback)});
}

async function weather(requestUrl, response) {
  const latitude = Number(requestUrl.searchParams.get('latitude'));
  const longitude = Number(requestUrl.searchParams.get('longitude'));
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return json(response, 400, {error: 'Valid latitude and longitude are required.'});
  }
  const timezone = requestUrl.searchParams.get('timezone') || 'auto';
  const name = requestUrl.searchParams.get('name') || `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
  const location = {name, latitude, longitude, timezone};
  const source = await cachedFetch(forecastUrl(location));
  return json(response, 200, normalizeForecast(source, location));
}

function promotions(requestUrl, response) {
  const feed = promotionFeed({
    platform: requestUrl.searchParams.get('platform') || 'web',
    placement: requestUrl.searchParams.get('placement') || 'web_forecast',
    language: requestUrl.searchParams.get('language') || 'en',
    theme: requestUrl.searchParams.get('theme') || 'dark'
  });
  return json(response, 200, feed, {'Cache-Control': `public, max-age=${feed.cacheSeconds}`});
}

async function staticFile(requestUrl, response) {
  const requestedPath = decodeURIComponent(requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname);
  const filePath = path.resolve(WEB_ROOT, `.${requestedPath}`);
  if (!filePath.startsWith(`${WEB_ROOT}${path.sep}`)) return json(response, 403, {error: 'Forbidden.'});
  try {
    const metadata = await stat(filePath);
    if (!metadata.isFile()) throw new Error('Not a file');
    const body = await readFile(filePath);
    response.writeHead(200, {'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream'});
    response.end(body);
  } catch {
    json(response, 404, {error: 'Not found.'});
  }
}

export function createServer() {
  return http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    try {
      if (request.method === 'OPTIONS') {
        response.writeHead(204, {'Access-Control-Allow-Origin': process.env.WEATHER_ALLOWED_ORIGIN || '*'});
        return response.end();
      }
      if (request.method !== 'GET') return json(response, 405, {error: 'Method not allowed.'});
      if (requestUrl.pathname === '/api/health') return json(response, 200, {status: 'ok'});
      if (requestUrl.pathname === '/api/bootstrap-location') return await bootstrapLocation(request, response);
      if (requestUrl.pathname === '/api/locations') return await locations(requestUrl, response);
      if (requestUrl.pathname === '/api/reverse-location') return await reverseLocation(requestUrl, response);
      if (requestUrl.pathname === '/api/promotions') return promotions(requestUrl, response);
      if (requestUrl.pathname === '/api/weather') return await weather(requestUrl, response);
      return await staticFile(requestUrl, response);
    } catch (error) {
      console.error(error);
      return json(response, 502, {error: 'Weather provider is temporarily unavailable.'});
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer().listen(PORT, () => console.log(`Weather is available at http://127.0.0.1:${PORT}`));
}
