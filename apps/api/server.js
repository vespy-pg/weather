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
import {MESSAGES} from '../web/assets/generated/i18n.js';

const PORT = Number(process.env.PORT || 8080);
const CACHE_TTL_MS = Number(process.env.WEATHER_CACHE_TTL_MS || 10 * 60 * 1000);
const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web');
const WEB_ORIGIN = 'https://weather.vespy.eu';
const MUSHROOM_OBSERVATION_DAYS = 30;
const MUSHROOM_OBSERVATION_RADIUS_KM = 30;
const cache = new Map();

export function normalizeGoogleAnalyticsId(value) {
  const id = String(value || '').trim().toUpperCase();
  return /^G-[A-Z0-9]+$/.test(id) ? id : null;
}

export function isForecastRoutePath(pathname) {
  const parts = String(pathname || '').split('/').filter(Boolean);
  return (parts.length === 1 || parts.length === 2)
    && SUPPORTED_LOCALES.some(locale => locale.toLowerCase() === parts[0].toLowerCase())
    && (parts.length === 1 || parts[1].length > 0);
}

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webp': 'image/webp'
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
  const supportedPlacements = ['web_forecast', 'forecast_landscape', 'forecast_portrait'];
  const campaigns = supportedPlacements.includes(placement) ? [{
    id: 'dinpanel-web-2026-09',
    type: 'native-card',
    eyebrow: normalizedPlatform === 'web' ? '' : localized ? 'APLIKACJA VESPY' : 'A VESPY APP',
    title: normalizedPlatform === 'web'
      ? localized ? 'Projektuj instalacje elektryczne oraz budynki w 2D i 3D' : 'Design electrical installations and buildings in 2D and 3D'
      : 'DINPanel',
    description: normalizedPlatform === 'web'
      ? localized ? 'Rozdzielnice i kompletna dokumentacja w jednym miejscu.' : 'Distribution boards and complete documentation in one place.'
      : localized ? 'Projektuj instalacje elektryczne, rozdzielnice i dokumentację w jednym miejscu.' : 'Design electrical installations, distribution boards, and documentation in one place.',
    actionLabel: localized ? 'Poznaj DINPanel' : 'Explore DINPanel',
    logoUrl: normalizedPlatform === 'web'
      ? `assets/dinpanel-logo-${normalizedTheme}.png`
      : 'assets/dinpanel-logo-square.png',
    imageUrl: normalizedPlatform === 'web' ? 'assets/dinpanel-workbench.webp' : undefined,
    imageAlt: 'DINPanel application preview',
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
  const response = await fetch(url, {headers: {'User-Agent': 'weather/0.1 (https://weather.vespy.eu/)'}});
  if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
  const value = await response.json();
  cache.set(url, {expiresAt: Date.now() + CACHE_TTL_MS, value});
  return value;
}

function at(source, key, index) {
  return source?.[key]?.[index] ?? null;
}

function bounded(value, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

function average(values) {
  const available = values
    .filter(value => value !== null && value !== undefined && value !== '')
    .map(Number)
    .filter(Number.isFinite);
  return available.length ? available.reduce((sum, value) => sum + value, 0) / available.length : null;
}

function mushroomTemperatureScore(temperature) {
  if (!Number.isFinite(temperature) || temperature <= 2 || temperature >= 30) return 0;
  if (temperature >= 12 && temperature <= 20) return 1;
  return temperature < 12 ? (temperature - 2) / 10 : (30 - temperature) / 10;
}

export function mushroomCondition(source, dailyIndex) {
  const date = source.daily?.time?.[dailyIndex];
  if (!date) return {score: null, level: 'unavailable'};
  const rainfallValues = (source.daily?.precipitation_sum || [])
    .slice(Math.max(0, dailyIndex - 7), dailyIndex)
    .filter(value => value !== null && value !== undefined && value !== '')
    .map(Number)
    .filter(Number.isFinite);
  const recentRainfall = rainfallValues.length ? rainfallValues.reduce((sum, value) => sum + value, 0) : null;
  const hourlyIndices = (source.hourly?.time || []).flatMap((timestamp, index) => String(timestamp).startsWith(date) ? [index] : []);
  const relativeHumidity = average(hourlyIndices.map(index => at(source.hourly, 'relative_humidity_2m', index)));
  const soilMoisture = average(hourlyIndices.map(index => at(source.hourly, 'soil_moisture_0_to_1cm', index)));
  const temperature = average([
    at(source.daily, 'temperature_2m_min', dailyIndex),
    at(source.daily, 'temperature_2m_max', dailyIndex)
  ]);
  const factors = [
    {value: Number.isFinite(recentRainfall) ? bounded((recentRainfall - 2) / 33) : null, weight: .3},
    {value: mushroomTemperatureScore(temperature), weight: .25},
    {value: Number.isFinite(relativeHumidity) ? bounded((relativeHumidity - 55) / 35) : null, weight: .15},
    {value: Number.isFinite(soilMoisture) ? bounded((soilMoisture - .1) / .22) : null, weight: .3}
  ].filter(factor => factor.value !== null);
  const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);
  const score = totalWeight >= .5 ? Math.round(factors.reduce((sum, factor) => sum + factor.value * factor.weight, 0) / totalWeight * 100) : null;
  const level = score === null ? 'unavailable' : score >= 75 ? 'excellent' : score >= 50 ? 'good' : score >= 25 ? 'fair' : 'poor';
  return {
    score,
    level,
    recentRainfall: recentRainfall === null ? null : Number(recentRainfall.toFixed(1)),
    relativeHumidity: relativeHumidity === null ? null : Math.round(relativeHumidity),
    soilMoisture: soilMoisture === null ? null : Number(soilMoisture.toFixed(3))
  };
}

export function normalizeForecast(source, location) {
  const allHourlyTimes = source.hourly?.time || [];
  const currentHour = String(source.current?.time || '').slice(0, 13);
  const matchingHourIndex = allHourlyTimes.findIndex(timestamp => String(timestamp).slice(0, 13) === currentHour);
  const hourlyStartIndex = matchingHourIndex < 0 ? 0 : matchingHourIndex;
  const hourlyTimes = allHourlyTimes.slice(hourlyStartIndex, hourlyStartIndex + 240);
  const allDailyTimes = source.daily?.time || [];
  const currentDate = String(source.current?.time || '').slice(0, 10);
  const matchingDayIndex = allDailyTimes.findIndex(date => String(date) >= currentDate);
  const dailyStartIndex = matchingDayIndex < 0 ? 0 : matchingDayIndex;
  const dailyTimes = allDailyTimes.slice(dailyStartIndex, dailyStartIndex + 15);
  return {
    available: true,
    fetchedAt: new Date().toISOString(),
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
    daily: dailyTimes.map((date, index) => {
      const sourceIndex = dailyStartIndex + index;
      return {
      date,
      weatherCode: at(source.daily, 'weather_code', sourceIndex),
      temperatureMaximum: at(source.daily, 'temperature_2m_max', sourceIndex),
      temperatureMinimum: at(source.daily, 'temperature_2m_min', sourceIndex),
      apparentTemperatureMaximum: at(source.daily, 'apparent_temperature_max', sourceIndex),
      apparentTemperatureMinimum: at(source.daily, 'apparent_temperature_min', sourceIndex),
      sunrise: at(source.daily, 'sunrise', sourceIndex),
      sunset: at(source.daily, 'sunset', sourceIndex),
      daylightDuration: at(source.daily, 'daylight_duration', sourceIndex),
      sunshineDuration: at(source.daily, 'sunshine_duration', sourceIndex),
      precipitation: at(source.daily, 'precipitation_sum', sourceIndex),
      precipitationProbability: at(source.daily, 'precipitation_probability_max', sourceIndex),
      windSpeedMaximum: at(source.daily, 'wind_speed_10m_max', sourceIndex),
      windGustsMaximum: at(source.daily, 'wind_gusts_10m_max', sourceIndex),
      windDirection: at(source.daily, 'wind_direction_10m_dominant', sourceIndex),
      uvIndexMaximum: at(source.daily, 'uv_index_max', sourceIndex),
      mushroom: mushroomCondition(source, sourceIndex)
    };
    }),
    location
  };
}

export function forecastUrl({latitude, longitude, timezone, includeMushrooms = false}) {
  const hourly = [
    'temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'precipitation_probability',
    'precipitation', 'rain', 'snowfall', 'weather_code', 'cloud_cover', 'surface_pressure',
    'visibility', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'uv_index'
  ];
  if (includeMushrooms) hourly.push('soil_moisture_0_to_1cm');
  const parameters = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone: timezone || 'auto',
    forecast_days: '15',
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    hourly: hourly.join(','),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,daylight_duration,sunshine_duration,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,uv_index_max'
  });
  if (includeMushrooms) parameters.set('past_days', '7');
  return `https://api.open-meteo.com/v1/forecast?${parameters}`;
}

export function mushroomObservationsUrl({latitude, longitude, language = DEFAULT_LOCALE}, now = new Date()) {
  const earliest = new Date(now);
  earliest.setUTCDate(earliest.getUTCDate() - MUSHROOM_OBSERVATION_DAYS);
  const parameters = new URLSearchParams({
    taxon_id: '47170',
    lat: String(latitude),
    lng: String(longitude),
    radius: String(MUSHROOM_OBSERVATION_RADIUS_KM),
    d1: earliest.toISOString().slice(0, 10),
    quality_grade: 'research',
    geo: 'true',
    order_by: 'observed_on',
    order: 'desc',
    per_page: '6',
    locale: normalizeLocale(language).split('-')[0]
  });
  return `https://api.inaturalist.org/v1/observations?${parameters}`;
}

export function normalizeMushroomObservations(source) {
  const observations = Array.isArray(source?.results) ? source.results.slice(0, 6).map(item => ({
    id: Number(item.id),
    date: item.observed_on || null,
    commonName: item.taxon?.preferred_common_name || null,
    scientificName: item.taxon?.name || null,
    url: Number.isFinite(Number(item.id)) ? `https://www.inaturalist.org/observations/${Number(item.id)}` : null
  })).filter(item => item.id && item.date) : [];
  return {
    available: true,
    count: Math.max(0, Number(source?.total_results) || 0),
    radiusKm: MUSHROOM_OBSERVATION_RADIUS_KM,
    periodDays: MUSHROOM_OBSERVATION_DAYS,
    latestDate: observations[0]?.date || null,
    observations
  };
}

export function normalizeLocale(language) {
  const requested = String(language || '').replaceAll('_', '-').toLowerCase();
  const exact = SUPPORTED_LOCALES.find(locale => locale.toLowerCase() === requested);
  return exact || LANGUAGE_ALIASES[requested] || LANGUAGE_ALIASES[requested.split('-')[0]] || DEFAULT_LOCALE;
}

function localizedMessage(locale, key, replacements = {}) {
  const template = MESSAGES[locale]?.[key] || MESSAGES[DEFAULT_LOCALE]?.[key] || key;
  return Object.entries(replacements).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, replacement), template);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function seoLocationName(pathname) {
  const parts = String(pathname || '').split('/').filter(Boolean);
  if (parts.length !== 2 || !SUPPORTED_LOCALES.some(locale => locale.toLowerCase() === parts[0].toLowerCase())) return null;
  try {
    return decodeURIComponent(parts[1]).replaceAll('-', ' ').trim() || null;
  } catch {
    return null;
  }
}

function localizedPageUrl(locale, locationName = null, coordinates = null) {
  const url = new URL(WEB_ORIGIN);
  url.pathname = `/${encodeURIComponent(locale)}${locationName ? `/${encodeURIComponent(locationName.replaceAll(' ', '-'))}` : ''}`;
  if (coordinates) url.searchParams.set('ll', coordinates);
  return url.toString();
}

function normalizeSeoCoordinates(value) {
  const [latitude, longitude, ...extra] = String(value || '').split(',').map(Number);
  if (extra.length || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
}

export function seoPageMetadata(requestUrl) {
  const parts = String(requestUrl.pathname || '').split('/').filter(Boolean);
  const locale = normalizeLocale(parts[0]);
  const locationName = seoLocationName(requestUrl.pathname);
  const coordinates = normalizeSeoCoordinates(requestUrl.searchParams.get('ll'));
  const replacements = locationName ? {location: locationName} : {};
  const title = localizedMessage(locale, locationName ? 'seo.locationTitle' : 'seo.title', replacements);
  const description = localizedMessage(locale, locationName ? 'seo.locationDescription' : 'seo.description', replacements);
  const canonical = localizedPageUrl(locale, locationName, coordinates);
  const alternateUrls = Object.fromEntries(SUPPORTED_LOCALES.map(language => [language, localizedPageUrl(language, locationName, coordinates)]));
  return {
    locale,
    locationName,
    title,
    description,
    canonical,
    alternateUrls,
    robots: requestUrl.searchParams.get('embed') === '1' || requestUrl.searchParams.get('demo') === '1'
      ? 'noindex, follow'
      : 'index, follow, max-image-preview:large'
  };
}

export function renderIndexHtml(template, requestUrl) {
  const metadata = seoPageMetadata(requestUrl);
  const alternateLocale = metadata.locale === 'pl-PL' ? 'en_US' : 'pl_PL';
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Vespy Weather',
    url: metadata.canonical,
    applicationCategory: 'WeatherApplication',
    operatingSystem: 'Any',
    inLanguage: metadata.locale,
    description: metadata.description,
    isAccessibleForFree: true
  }).replaceAll('<', '\\u003c');
  const replacements = [
    [/<html lang="[^"]+">/, `<html lang="${metadata.locale}">`],
    [/<title>[^<]*<\/title>/, `<title>${escapeHtml(metadata.title)}</title>`],
    [/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escapeHtml(metadata.description)}">`],
    [/<meta name="robots" content="[^"]*">/, `<meta name="robots" content="${metadata.robots}">`],
    [/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escapeHtml(metadata.title)}">`],
    [/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escapeHtml(metadata.description)}">`],
    [/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${escapeHtml(metadata.canonical)}">`],
    [/<meta property="og:locale" content="[^"]*">/, `<meta property="og:locale" content="${metadata.locale.replace('-', '_')}">\n  <meta property="og:locale:alternate" content="${alternateLocale}">`],
    [/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${escapeHtml(metadata.title)}">`],
    [/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${escapeHtml(metadata.description)}">`],
    [/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${escapeHtml(metadata.canonical)}">`],
    [/<link rel="alternate" hreflang="en-US" href="[^"]*">/, `<link rel="alternate" hreflang="en-US" href="${escapeHtml(metadata.alternateUrls['en-US'])}">`],
    [/<link rel="alternate" hreflang="pl-PL" href="[^"]*">/, `<link rel="alternate" hreflang="pl-PL" href="${escapeHtml(metadata.alternateUrls['pl-PL'])}">`],
    [/<link rel="alternate" hreflang="x-default" href="[^"]*">/, `<link rel="alternate" hreflang="x-default" href="${escapeHtml(metadata.alternateUrls['en-US'])}">`],
    [/<script id="seoStructuredData" type="application\/ld\+json">[^<]*<\/script>/, `<script id="seoStructuredData" type="application/ld+json">${structuredData}</script>`]
  ];
  let html = replacements.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), template);
  html = html.replace(/(<([a-z][\w-]*)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)([^<]*)(<\/\2>)/gi, (match, opening, tag, key, content, closing) => (
    MESSAGES[metadata.locale]?.[key] ? `${opening}${escapeHtml(MESSAGES[metadata.locale][key])}${closing}` : match
  ));
  if (metadata.locationName) html = html.replace(/<h1 id="locationTitle">[^<]*<\/h1>/, `<h1 id="locationTitle">${escapeHtml(metadata.locationName)}</h1>`);
  return html;
}

export function locationSearchUrl(query, language = DEFAULT_LOCALE) {
  const providerLanguage = PROVIDER_LANGUAGES[normalizeLocale(language)] || PROVIDER_LANGUAGES[DEFAULT_LOCALE];
  const parameters = new URLSearchParams({name: query, count: '8', language: providerLanguage, format: 'json'});
  return `https://geocoding-api.open-meteo.com/v1/search?${parameters}`;
}

export function postalCodeSearchUrl(query, language = DEFAULT_LOCALE) {
  const locale = normalizeLocale(language);
  const country = locale === 'pl-PL' ? 'PL' : locale === 'en-US' ? 'US' : null;
  const postalCode = String(query || '').trim();
  const valid = country === 'PL'
    ? /^\d{2}-?\d{3}$/.test(postalCode)
    : country === 'US' && /^\d{5}(?:-\d{4})?$/.test(postalCode);
  return valid ? `https://api.zippopotam.us/${country}/${encodeURIComponent(postalCode)}` : null;
}

export function normalizePostalLocations(source) {
  return (source?.places || []).map((item, index) => ({
    id: `postal-${source['country abbreviation']}-${source['post code']}-${index}`,
    name: item['place name'],
    country: source.country,
    admin1: item.state || null,
    postalCode: source['post code'] || null,
    latitude: Number(item.latitude),
    longitude: Number(item.longitude),
    timezone: 'auto'
  })).filter(item => item.name && Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
}

async function locations(requestUrl, response) {
  const query = requestUrl.searchParams.get('q')?.trim();
  if (!query || query.length < 2) return json(response, 400, {error: 'Enter at least two characters.'});
  const source = await cachedFetch(locationSearchUrl(query, requestUrl.searchParams.get('language')));
  let results = (source.results || []).map(item => ({
    id: item.id,
    name: item.name,
    country: item.country,
    admin1: item.admin1 || null,
    postalCode: item.postcodes?.[0] || null,
    latitude: item.latitude,
    longitude: item.longitude,
    timezone: item.timezone
  }));
  const postalUrl = results.length ? null : postalCodeSearchUrl(query, requestUrl.searchParams.get('language'));
  if (postalUrl) {
    try {
      results = normalizePostalLocations(await cachedFetch(postalUrl));
    } catch (error) {
      if (error.message !== 'Upstream returned 404') throw error;
    }
  }
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
  const namedLocality = ['city', 'town', 'village', 'hamlet'].includes(source?.addresstype) ? source.name : null;
  const city = address.city
    || address.town
    || address.village
    || address.hamlet
    || address.municipality;
  const name = namedLocality
    || city
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
  const source = await cachedFetch(forecastUrl({
    ...location,
    includeMushrooms: ['1', 'true'].includes(requestUrl.searchParams.get('mushrooms'))
  }));
  return json(response, 200, normalizeForecast(source, location));
}

async function mushroomObservations(requestUrl, response) {
  const latitude = Number(requestUrl.searchParams.get('latitude'));
  const longitude = Number(requestUrl.searchParams.get('longitude'));
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return json(response, 400, {error: 'Valid latitude and longitude are required.'});
  }
  const source = await cachedFetch(mushroomObservationsUrl({
    latitude,
    longitude,
    language: requestUrl.searchParams.get('language')
  }));
  return json(response, 200, normalizeMushroomObservations(source), {'Cache-Control': 'public, max-age=900'});
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
  if (requestUrl.pathname === '/' || requestUrl.pathname === '/index.html' || isForecastRoutePath(requestUrl.pathname)) {
    const template = await readFile(path.join(WEB_ROOT, 'index.html'), 'utf8');
    response.writeHead(200, {
      'Cache-Control': 'no-cache',
      'Content-Language': seoPageMetadata(requestUrl).locale,
      'Content-Type': contentTypes['.html']
    });
    return response.end(renderIndexHtml(template, requestUrl));
  }
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
      if (requestUrl.pathname === '/health') return json(response, 200, {status: 'ok'});
      if (requestUrl.pathname === '/client-config') return json(response, 200, {
        googleAnalyticsId: normalizeGoogleAnalyticsId(process.env.GOOGLE_ANALYTICS_ID)
      });
      if (requestUrl.pathname === '/bootstrap-location') return await bootstrapLocation(request, response);
      if (requestUrl.pathname === '/locations') return await locations(requestUrl, response);
      if (requestUrl.pathname === '/reverse-location') return await reverseLocation(requestUrl, response);
      if (requestUrl.pathname === '/promotions') return promotions(requestUrl, response);
      if (requestUrl.pathname === '/weather') return await weather(requestUrl, response);
      if (requestUrl.pathname === '/mushroom-observations') return await mushroomObservations(requestUrl, response);
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
