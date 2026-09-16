import {drawForecastSky, drawWeatherChart, drawWindFlow, setTemperatureColorThresholds} from './charts.js';
import {initializeAnalytics, trackEvent} from './analytics.js';
import {createWeatherDemo} from './weather-demo.js';
import {escapeHtml, formatForecastDate, formatTime, measurement, numericValue, shortTemperature, temperature} from './components.js';
import {forecastSkyLayout, groupHourlyForecast, hoursPerGroup, resistedHistoryPosition, stopTimelineAtNow, temperatureRange, timelineCurrentIndex, timelineHourlyWindow, withinTimelineMagnet} from './forecast-view.js';
import {applyWidgetQuery, widgetBoolean, widgetDays, widgetQuery} from './embed-options.js';
import {normalizeLanguage, preferredSupportedLanguage, setLanguage, supportedLanguages, t} from './i18n.js';
import {
  activeLocationCookie,
  activeLocationFromCookies,
  isLegacyPlaceholderLocation,
  normalizeStoredLocation,
  preferredActiveLocation,
  replacingLocation,
  sameLocation,
  uniqueLocations,
  withLocation
} from './location-state.js';
import {applicationRouteUrl, forecastRouteUrl, parseCoordinatePair, parseForecastRoute, shouldUseRouteLocation} from './route-state.js';
import {
  celsiusToDisplay,
  DEFAULT_THRESHOLDS,
  displayToCelsius,
  normalizeTemperatureThresholds,
  setTemperatureUnit,
  temperatureUnit
} from './temperature-scale.js';

const SETTINGS_KEY = 'weather.settings.v1';
const FORECAST_WELCOME_KEY = 'weather.forecast-welcome.v1';
const SHARE_PROMPT_KEY = 'weather.share-prompt.v1';
const LOCATION_REQUEST_TIMEOUT_MS = 10000;
const WEATHER_RETRY_DELAY_MS = 3000;
const WEATHER_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const WEATHER_STALE_AFTER_MS = 60 * 60 * 1000;
const WEATHER_HISTORY_DAYS = 3;
const DEFAULT_ZOOM = .5;
const LAYOUT_VERSION = 3;
const ZOOM_LEVELS = [.25, .3, .5, .75, 1, 2];
const QUERY = new URLSearchParams(location.search);
const FORECAST_ROUTE = parseForecastRoute(location.pathname, supportedLanguages().map(item => item.tag));
const ROUTE_COORDINATES = parseCoordinatePair(QUERY.get('ll'));
const IS_GITHUB_PAGES = location.hostname.endsWith('.github.io');
const IS_DEMO = QUERY.get('demo') === '1' || IS_GITHUB_PAGES;
const IS_EMBEDDED = QUERY.get('embed') === '1';
const EMBED_DAYS = IS_EMBEDDED ? widgetDays(QUERY.get('days')) : 10;
const EMBED_LEGEND = !IS_EMBEDDED || widgetBoolean(QUERY.get('legend'), true);
const API_ROOT = IS_GITHUB_PAGES
  ? new URL('https://api.weather.vespy.eu/')
  : new URL('/', location.href);
const PUBLIC_WEB_ROOT = 'https://weather.vespy.eu/';
const DEFAULT_LOCATION = {id: 'capital-GB', name: 'London', country: 'United Kingdom', latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London'};
const DEFAULT_SETTINGS = {
  location: DEFAULT_LOCATION,
  locations: [DEFAULT_LOCATION],
  configured: false,
  zoom: DEFAULT_ZOOM,
  layoutVersion: LAYOUT_VERSION,
  theme: 'dark',
  language: 'en-US',
  languageSource: 'fallback',
  temperatureUnit: 'C',
  temperatureThresholds: DEFAULT_THRESHOLDS,
  showHourlyTemperatures: true,
  showApparentTemperature: true,
  showPrecipitation: true,
  showWind: true,
  showWindArrows: false,
  showMushrooms: false,
  showHistoricalData: true,
  showDates: false,
  embedDays: 10,
  embedLegend: false
};
const LEGEND_SKY_CLOUDS = [70, 78, 62, 42, 20, 4, 12, 35, 58, 82, 68, 38];
const LEGEND_SKY_POINTS = LEGEND_SKY_CLOUDS.map((cloudCover, index) => ({
  timestamp: `2026-06-01T${String(index + 5).padStart(2, '0')}:00`,
  temperature: 20,
  cloudCover,
  weatherCode: cloudCover > 70 ? 3 : cloudCover > 25 ? 2 : 1,
  precipitation: 0,
  precipitationProbability: 0,
  snowfall: 0
}));
const LEGEND_SKY_DAYS = [{
  date: '2026-06-01',
  sunrise: '2026-06-01T08:00',
  sunset: '2026-06-01T18:00'
}];
const WELCOME_HOURS = [0, 3, 6, 9, 12, 15, 18, 21];
const welcomeSkyPoints = (clouds, rain = false) => WELCOME_HOURS.map((hour, index) => ({
  timestamp: `2026-06-01T${String(hour).padStart(2, '0')}:00`,
  temperature: 20,
  cloudCover: clouds[index],
  weatherCode: rain ? 61 : clouds[index] > 70 ? 3 : clouds[index] > 25 ? 2 : 1,
  precipitation: rain ? .8 + index % 3 * .4 : 0,
  precipitationProbability: rain ? 75 + index % 3 * 10 : 0,
  snowfall: 0
}));
const WELCOME_SKY_CLEAR = welcomeSkyPoints([0, 0, 2, 0, 4, 2, 0, 0]);
const WELCOME_SKY_MIXED = welcomeSkyPoints([55, 45, 30, 12, 20, 38, 58, 70]);
const WELCOME_SKY_RAIN = welcomeSkyPoints([88, 92, 84, 78, 90, 96, 86, 82], true);
const WELCOME_TEMPERATURES = [-4, -12, -20, -14, -2, 10, 20, 29, 36, 38, 33, 25];
const WELCOME_TEMPERATURE_POINTS = WELCOME_TEMPERATURES.map((temperatureValue, index) => ({
  timestamp: `2026-06-01T${String(index * 2).padStart(2, '0')}:00`,
  temperature: temperatureValue,
  apparentTemperature: temperatureValue,
  precipitation: 0,
  precipitationProbability: 0,
  weatherCode: 0
}));
const welcomeWindPoints = (speed, gusts, directionSwing) => WELCOME_HOURS.map((hour, index) => ({
  timestamp: `2026-06-01T${String(hour).padStart(2, '0')}:00`,
  windSpeed: speed + Math.sin(index * .8) * directionSwing,
  windGusts: gusts + index % 3 * directionSwing,
  windDirection: 230 + Math.sin(index * .65) * 40
}));
const WELCOME_WIND_CALM = welcomeWindPoints(8, 11, .5);
const WELCOME_WIND_MODERATE = welcomeWindPoints(18, 27, 2);
const WELCOME_WIND_STRONG = welcomeWindPoints(32, 48, 5);
const LEGEND_WIND_SPEEDS = [2, 3, 5, 8, 13, 21, 32, 27, 18, 10, 25, 30];
const LEGEND_WIND_POINTS = LEGEND_WIND_SPEEDS.map((windSpeed, index) => ({
  timestamp: `2026-06-01T${String(index + 5).padStart(2, '0')}:00`,
  windSpeed,
  windGusts: windSpeed + 3 + index % 4,
  windDirection: 225 + Math.sin(index * .65) * 55,
  tornado: index === 9 || index === 10
}));
const LEGEND_TEMPERATURES = [-16, -13, -9, -4, -.2, 0, 5, 11, 17, 18, 23, 27, 30, 32, 36, 40];
const LEGEND_TEMPERATURE_POINTS = LEGEND_TEMPERATURES.map((value, index) => ({
  timestamp: `2026-06-01T${String(index).padStart(2, '0')}:00`,
  temperature: value,
  apparentTemperature: value,
  cloudCover: 0,
  precipitation: 0,
  precipitationProbability: 0,
  windSpeed: 0,
  weatherCode: 0
}));
const LEGEND_FEELS_TEMPERATURES = [10, 11, 13, 16, 18, 20, 22, 24, 24, 22, 19, 16, 14, 12];
const LEGEND_FEELS_DIFFERENCES = [-14, -14, -13, -10, -5, 4, 10, 14, 14, 12, 9, 4, -6, -12];
const LEGEND_FEELS_POINTS = LEGEND_FEELS_TEMPERATURES.map((value, index) => ({
  timestamp: `2026-06-01T${String(index).padStart(2, '0')}:00`,
  temperature: value,
  apparentTemperature: value + LEGEND_FEELS_DIFFERENCES[index],
  cloudCover: 0,
  precipitation: 0,
  precipitationProbability: 0,
  windSpeed: 0,
  weatherCode: 0
}));

let settings = loadSettings();
let pendingLocation = settings.location;
let pendingLocations = settings.locations;
let weather = null;
let weatherRequest = 0;
let weatherAbortController = null;
let weatherLoadedAt = 0;
let zoomIndex = Math.max(0, ZOOM_LEVELS.indexOf(Number(settings.zoom)));
let forecastDrawFrame = 0;
let timelineInitialPositionPending = true;
let timelineNowScrollLeft = 0;
let locationSearchTimer = 0;
let locationSearchRequest = 0;
let promotionRequest = 0;
let activeShareData = null;
let settingsPreviewTimer = 0;
let pendingFullForecastRender = false;
let pendingForecastDraw = false;
let pendingLegendDraw = false;
let notificationTimer = 0;
let mushroomObservationRequest = 0;
let mushroomObservations = null;
const promotionImpressions = new Set();
let forecastWelcomeDisplayed = false;

function safePromotionUrl(value, {asset = false} = {}) {
  try {
    const url = new URL(String(value || ''), asset ? new URL('/', location.href) : location.href);
    if (url.protocol === 'https:' || (asset && url.origin === location.origin)) return url.href;
  } catch {}
  return null;
}

function safePromotionColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : fallback;
}

function renderPromotion(campaign) {
  const slot = document.getElementById('webPromotion');
  const targetUrl = safePromotionUrl(campaign?.targetUrl);
  if (!targetUrl || !['native-card', 'image-banner'].includes(campaign?.type)) {
    slot.hidden = true;
    slot.replaceChildren();
    return;
  }

  const link = document.createElement('a');
  link.href = targetUrl;
  link.target = '_blank';
  link.rel = 'noreferrer sponsored';
  link.addEventListener('click', () => trackEvent('promotion_click', {campaign_id: String(campaign.id || 'unknown')}));

  if (campaign.type === 'image-banner') {
    const imageUrl = safePromotionUrl(campaign.imageUrl, {asset: true});
    if (!imageUrl) return;
    link.className = 'web-promotion-image-link';
    const image = document.createElement('img');
    image.className = 'web-promotion-image';
    image.src = imageUrl;
    image.alt = String(campaign.imageAlt || campaign.title || '');
    image.loading = 'lazy';
    link.append(image);
  } else {
    const logoUrl = safePromotionUrl(campaign.logoUrl, {asset: true});
    if (!logoUrl) return;
    link.className = 'web-promotion-link';
    const logo = document.createElement('img');
    logo.className = 'web-promotion-logo';
    logo.src = logoUrl;
    logo.alt = '';

    const previewUrl = safePromotionUrl(campaign.imageUrl, {asset: true});
    const preview = document.createElement('img');
    preview.className = 'web-promotion-preview';
    preview.src = previewUrl || '';
    preview.alt = String(campaign.imageAlt || '');
    preview.loading = 'lazy';
    preview.hidden = !previewUrl;

    const copy = document.createElement('span');
    copy.className = 'web-promotion-copy';
    const eyebrowText = String(campaign.eyebrow || '').trim();
    const eyebrow = document.createElement('span');
    eyebrow.className = 'web-promotion-label';
    eyebrow.textContent = eyebrowText;
    eyebrow.hidden = !eyebrowText;
    const title = document.createElement('strong');
    title.className = 'web-promotion-title';
    title.textContent = String(campaign.title || '');
    const description = document.createElement('span');
    description.className = 'web-promotion-description';
    description.textContent = String(campaign.description || '');
    copy.append(eyebrow, title, description);

    const action = document.createElement('span');
    action.className = 'web-promotion-action';
    action.textContent = String(campaign.actionLabel || 'Open');
    link.append(logo, copy, preview, action);
    slot.style.setProperty('--promotion-background', safePromotionColor(campaign.backgroundColor, 'var(--panel)'));
    slot.style.setProperty('--promotion-accent', safePromotionColor(campaign.accentColor, 'var(--orange)'));
  }

  slot.replaceChildren(link);
  slot.hidden = false;
  const campaignId = String(campaign.id || 'unknown');
  if (!promotionImpressions.has(campaignId)) {
    promotionImpressions.add(campaignId);
    trackEvent('promotion_impression', {campaign_id: campaignId});
  }
}

async function loadPromotion() {
  if (IS_EMBEDDED) return;
  const requestId = ++promotionRequest;
  try {
    const parameters = new URLSearchParams({
      platform: 'web',
      placement: 'web_forecast',
      language: settings.language,
      theme: settings.theme
    });
    const response = await fetch(new URL(`promotions?${parameters}`, API_ROOT));
    if (!response.ok) throw new Error('Promotion request failed.');
    const feed = await response.json();
    if (requestId !== promotionRequest) return;
    const campaign = Array.isArray(feed.campaigns)
      ? [...feed.campaigns].sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0))[0]
      : null;
    renderPromotion(campaign);
  } catch {
    if (requestId === promotionRequest) renderPromotion(null);
  }
}

function locationLabel(item) {
  return `${item.name}${item.country ? `, ${item.country}` : ''}`;
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    let stored = {...DEFAULT_SETTINGS, ...saved};
    if (saved.layoutVersion !== LAYOUT_VERSION) {
      stored.zoom = DEFAULT_ZOOM;
      stored.layoutVersion = LAYOUT_VERSION;
    }
    const legacyPlaceholder = isLegacyPlaceholderLocation(stored.location, saved.configured);
    if (legacyPlaceholder) {
      stored.location = {...DEFAULT_LOCATION};
      stored.locations = [{...DEFAULT_LOCATION}];
      stored.configured = false;
    }
    const savedLocations = uniqueLocations((Array.isArray(saved.locations) ? saved.locations : [])
      .map(normalizeStoredLocation)
      .filter(Boolean));
    const activeLocation = preferredActiveLocation({
      cookieLocation: legacyPlaceholder ? null : activeLocationFromCookies(document.cookie),
      savedLocation: saved.location,
      savedConfigured: !legacyPlaceholder && saved.configured
    });
    const useRouteLocation = shouldUseRouteLocation({
      hasActiveLocation: Boolean(activeLocation),
      embedded: IS_EMBEDDED,
      shared: QUERY.get('share') === '1'
    });
    stored.location = activeLocation || {...DEFAULT_LOCATION};
    stored.locations = savedLocations.length ? savedLocations : [{...DEFAULT_LOCATION}];
    if (activeLocation) stored.locations = withLocation(stored.locations, activeLocation);
    stored.configured = Boolean(activeLocation);
    const latitude = Number(QUERY.get('lat'));
    const longitude = Number(QUERY.get('lon'));
    if (FORECAST_ROUTE?.locationName && ROUTE_COORDINATES && useRouteLocation) {
      stored.location = {
        id: `route-${ROUTE_COORDINATES.latitude.toFixed(5)}-${ROUTE_COORDINATES.longitude.toFixed(5)}`,
        name: FORECAST_ROUTE.locationName,
        country: '',
        ...ROUTE_COORDINATES,
        timezone: 'auto'
      };
      stored.locations = withLocation(stored.locations, stored.location);
      stored.configured = true;
    } else if (QUERY.has('lat') && QUERY.has('lon') && Number.isFinite(latitude) && Number.isFinite(longitude)) {
      stored.location = {
        name: QUERY.get('name') || 'Embedded location',
        country: '',
        latitude,
        longitude,
        timezone: QUERY.get('timezone') || 'auto'
      };
      stored.locations = withLocation(stored.locations, stored.location);
      stored.configured = true;
    }
    if (['dark', 'light'].includes(QUERY.get('theme'))) stored.theme = QUERY.get('theme');
    if (FORECAST_ROUTE) {
      stored.language = FORECAST_ROUTE.language;
      stored.languageSource = 'explicit';
    } else if (QUERY.has('lang')) {
      stored.language = normalizeLanguage(QUERY.get('lang'));
      stored.languageSource = 'explicit';
    } else if (saved.language) {
      stored.language = normalizeLanguage(saved.language);
      stored.languageSource = saved.languageSource || 'user';
    } else {
      const preferences = navigator.languages || [navigator.language];
      const supportedBaseLanguages = new Set(supportedLanguages().map(item => item.tag.split('-')[0].toLowerCase()));
      const hasSupportedPreference = preferences.some(item => supportedBaseLanguages.has(String(item).split('-')[0].toLowerCase()));
      stored.language = preferredSupportedLanguage(preferences);
      stored.languageSource = hasSupportedPreference ? 'device' : 'fallback';
    }
    if (['C', 'F'].includes(QUERY.get('unit'))) stored.temperatureUnit = QUERY.get('unit');
    stored.temperatureUnit = stored.temperatureUnit === 'F' ? 'F' : 'C';
    if (IS_EMBEDDED) stored = applyWidgetQuery(stored, QUERY);
    stored.temperatureThresholds = normalizeTemperatureThresholds(stored.temperatureThresholds);
    const requestedZoom = Number(QUERY.get('zoom'));
    if (ZOOM_LEVELS.includes(requestedZoom)) stored.zoom = requestedZoom;
    stored.zoom = ZOOM_LEVELS.reduce((closest, zoom) => Math.abs(zoom - Number(stored.zoom)) < Math.abs(closest - Number(stored.zoom)) ? zoom : closest, DEFAULT_ZOOM);
    return stored;
  } catch {
    const activeLocation = activeLocationFromCookies(document.cookie);
    return {
      ...DEFAULT_SETTINGS,
      location: activeLocation || {...DEFAULT_LOCATION},
      locations: activeLocation ? [{...DEFAULT_LOCATION}, activeLocation] : [{...DEFAULT_LOCATION}],
      configured: Boolean(activeLocation)
    };
  }
}

function applyTemperatureSettings() {
  setTemperatureUnit(settings.temperatureUnit);
  setTemperatureColorThresholds(settings.temperatureThresholds);
}

function renderLanguageOptions() {
  const options = supportedLanguages().map(item => `<option value="${item.tag}">${escapeHtml(item.nativeName)}</option>`).join('');
  document.getElementById('languageSelect').innerHTML = options;
  document.getElementById('languageSetting').innerHTML = options;
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
  if (settings.configured && !IS_EMBEDDED) {
    const cookie = activeLocationCookie(settings.location, {secure: location.protocol === 'https:'});
    if (cookie) document.cookie = cookie;
  }
}

function applyTheme(theme, persist = false) {
  settings.theme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = settings.theme;
  const lightMode = settings.theme === 'light';
  document.getElementById('themeIcon').textContent = lightMode ? '☾' : '☀';
  document.getElementById('themeLabel').textContent = t(lightMode ? 'action.dark' : 'action.light');
  const modeName = t(lightMode ? 'action.dark' : 'action.light').toLowerCase();
  document.getElementById('themeToggle').setAttribute('aria-label', modeName);
  document.getElementById('themeToggle').title = modeName;
  document.querySelector('meta[name="theme-color"]').content = lightMode ? '#edf3f9' : '#0a0e14';
  if (persist) saveSettings();
}

function embedCode(locationOverride = settings.location, theme = settings.theme, languageOverride = settings.language) {
  const url = forecastRouteUrl(location.origin, {
    language: languageOverride,
    location: locationOverride,
    query: {
      embed: 1,
      theme,
      unit: settings.temperatureUnit,
      zoom: settings.zoom,
      ...widgetQuery(settings, {days: settings.embedDays, legend: settings.embedLegend}),
      demo: IS_DEMO ? 1 : null
    }
  });
  const height = (settings.embedLegend ? 680 : 390) + (settings.showMushrooms ? 54 : 0);
  return `<iframe src="${url}" title="${t('embed.title')}" width="100%" height="${height}" loading="lazy" scrolling="no" style="border:0;border-radius:12px" allow="geolocation"></iframe>`;
}

function forecastShareUrl(locationOverride = settings.location) {
  return forecastRouteUrl(PUBLIC_WEB_ROOT, {
    language: settings.language,
    location: locationOverride,
    query: {share: 1, demo: IS_DEMO ? 1 : null}
  }).toString();
}

function applicationShareUrl() {
  const url = applicationRouteUrl(PUBLIC_WEB_ROOT, settings.language);
  if (IS_DEMO) url.searchParams.set('demo', '1');
  return url.toString();
}

function updateSeoMetadata(locationOverride = settings.location) {
  const label = locationLabel(locationOverride);
  const title = t('seo.locationTitle', {location: label});
  const description = t('seo.locationDescription', {location: label});
  const canonicalUrl = forecastRouteUrl(PUBLIC_WEB_ROOT, {language: settings.language, location: locationOverride});
  const alternateUrl = language => forecastRouteUrl(PUBLIC_WEB_ROOT, {language, location: locationOverride}).toString();
  document.title = title;
  document.querySelector('meta[name="description"]').content = description;
  document.querySelector('meta[property="og:title"]').content = title;
  document.querySelector('meta[property="og:description"]').content = description;
  document.querySelector('meta[property="og:url"]').content = canonicalUrl.toString();
  document.querySelector('meta[property="og:locale"]').content = settings.language.replace('-', '_');
  document.querySelector('meta[property="og:locale:alternate"]')?.setAttribute('content', settings.language === 'pl-PL' ? 'en_US' : 'pl_PL');
  document.querySelector('meta[name="twitter:title"]').content = title;
  document.querySelector('meta[name="twitter:description"]').content = description;
  document.querySelector('link[rel="canonical"]').href = canonicalUrl.toString();
  document.querySelector('link[rel="alternate"][hreflang="en-US"]').href = alternateUrl('en-US');
  document.querySelector('link[rel="alternate"][hreflang="pl-PL"]').href = alternateUrl('pl-PL');
  document.querySelector('link[rel="alternate"][hreflang="x-default"]').href = alternateUrl('en-US');
  document.getElementById('seoStructuredData').textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Vespy Weather',
    url: canonicalUrl.toString(),
    applicationCategory: 'WeatherApplication',
    operatingSystem: 'Any',
    inLanguage: settings.language,
    description,
    isAccessibleForFree: true
  });
}

function updateBrowserRoute() {
  if (IS_GITHUB_PAGES || !Number.isFinite(Number(settings.location?.latitude)) || !Number.isFinite(Number(settings.location?.longitude))) return;
  const query = {};
  ['demo', 'guide', 'share'].forEach(key => {
    if (QUERY.has(key)) query[key] = QUERY.get(key);
  });
  const url = forecastRouteUrl(location.origin, {language: settings.language, location: settings.location, query});
  history.replaceState(null, '', `${url.pathname}${url.search}`);
  updateSeoMetadata();
}

function collapseSharePrompt(persist = true) {
  document.documentElement.dataset.sharePrompt = 'collapsed';
  document.querySelector('.share-forecast').hidden = true;
  document.getElementById('shareForecastCompact').hidden = false;
  if (persist) {
    try { localStorage.setItem(SHARE_PROMPT_KEY, 'collapsed'); } catch {}
  }
}

function currentShareData(locationOverride = null) {
  if (!locationOverride) {
    return {
      title: t('share.dialogTitle'),
      text: t('share.appMessage'),
      url: applicationShareUrl()
    };
  }
  return {
    title: `${t('share.dialogTitle')} - ${locationLabel(locationOverride)}`,
    text: t('share.message', {location: locationLabel(locationOverride)}),
    url: forecastShareUrl(locationOverride)
  };
}

function openShareDialog(locationOverride = null) {
  collapseSharePrompt();
  if (document.getElementById('settingsDialog').open) document.getElementById('settingsDialog').close();
  activeShareData = currentShareData(locationOverride);
  const sharedText = `${activeShareData.text}\n${activeShareData.url}`;
  const hasNativeShare = Boolean(navigator.share);
  document.getElementById('shareNative').hidden = !hasNativeShare;
  document.querySelector('.share-options').classList.toggle('has-native-share', hasNativeShare);
  document.getElementById('shareWhatsApp').href = `https://wa.me/?text=${encodeURIComponent(sharedText)}`;
  document.getElementById('shareFacebook').href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(activeShareData.url)}`;
  document.getElementById('shareEmail').href = `mailto:?subject=${encodeURIComponent(activeShareData.title)}&body=${encodeURIComponent(sharedText)}`;
  document.getElementById('shareDialogStatus').textContent = '';
  document.getElementById('shareDialog').showModal();
  trackEvent('share_dialog_opened');
}

async function copyShareLink() {
  const shareUrl = activeShareData?.url || applicationShareUrl();
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(shareUrl);
    return;
  }
  const input = document.createElement('textarea');
  input.value = shareUrl;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.append(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  if (!copied) throw new Error('Copy failed.');
}

function weatherPresentation(code) {
  const value = numericValue(code);
  if (value === 0) return ['☀️', t('condition.clear')];
  if ([1, 2].includes(value)) return ['🌤️', t('condition.partlyCloudy')];
  if (value === 3) return ['☁️', t('condition.overcast')];
  if ([45, 48].includes(value)) return ['🌫️', t('condition.fog')];
  if ([51, 53, 55].includes(value)) return ['🌦️', t('condition.drizzle')];
  if ([56, 57].includes(value)) return ['🌧️', t('condition.freezingDrizzle')];
  if ([61, 63, 65, 80, 81, 82].includes(value)) return ['🌧️', t('condition.rain')];
  if ([66, 67].includes(value)) return ['🌧️', t('condition.freezingRain')];
  if ([71, 73, 75, 77, 85, 86].includes(value)) return ['🌨️', t('condition.snow')];
  if ([96, 99].includes(value)) return ['⛈️', t('condition.stormHail')];
  if (value === 95) return ['⛈️', t('condition.storm')];
  return ['❔', t('condition.unknown')];
}

function windDirection(degrees) {
  const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return labels[Math.round(Number(degrees || 0) / 45) % 8];
}

function windVisual(speed) {
  const value = Math.max(0, numericValue(speed) ?? 0);
  const lightMode = document.documentElement.dataset.theme === 'light';
  const minimumOpacity = lightMode ? .22 : .12;
  return {
    color: lightMode ? '#486d80' : '#9bc7d7',
    opacity: minimumOpacity + Math.pow(Math.min(1, value / 30), 1.35) * (1 - minimumOpacity)
  };
}

function forecastBaseHourWidth() {
  return window.matchMedia('(max-width: 760px)').matches ? 22 : 18;
}

function zoomVisualScale(zoom) {
  return zoom < 1 ? .5 + zoom * .5 : 1 + (zoom - 1) * .5;
}

function applyZoom(nextIndex, preserveCenter = true, persist = false) {
  const scroll = document.getElementById('forecastTimelineScroll');
  const timeline = document.getElementById('forecastTimeline');
  const center = preserveCenter && scroll.scrollWidth
    ? (scroll.scrollLeft + scroll.clientWidth / 2) / scroll.scrollWidth
    : 0;
  zoomIndex = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, nextIndex));
  const zoom = ZOOM_LEVELS[zoomIndex];
  if (persist) {
    settings.zoom = zoom;
    saveSettings();
  }
  const groupHours = hoursPerGroup(zoom);
  const visualScale = zoomVisualScale(zoom);
  timeline.style.setProperty('--forecast-slot-width', `${forecastBaseHourWidth() * zoom * groupHours}px`);
  timeline.style.setProperty('--forecast-sky-compact-height', `${68 + Math.max(0, visualScale - 1) * 36}px`);
  timeline.style.setProperty('--forecast-wind-height', `${46 * visualScale}px`);
  timeline.style.setProperty('--forecast-wind-arrow-row', `${24 * visualScale}px`);
  timeline.style.setProperty('--forecast-wind-speed-row', `${11 * visualScale}px`);
  timeline.style.setProperty('--forecast-wind-arrow-size', `${19 * visualScale}px`);
  timeline.style.setProperty('--forecast-wind-arrow-line', `${22 * visualScale}px`);
  timeline.style.setProperty('--forecast-wind-speed-size', `${8 * visualScale}px`);
  timeline.style.setProperty('--forecast-mushroom-height', `${54 + Math.max(0, visualScale - 1) * 20}px`);
  timeline.style.setProperty('--forecast-mushroom-icon-size', `${18 * visualScale}px`);
  timeline.style.setProperty('--forecast-mushroom-label-size', `${9 * visualScale}px`);
  document.getElementById('forecastZoomReset').textContent = `${Math.round(zoom * 100)}%`;
  document.getElementById('forecastZoomOut').disabled = zoomIndex === 0;
  document.getElementById('forecastZoomIn').disabled = zoomIndex === ZOOM_LEVELS.length - 1;
  cancelAnimationFrame(forecastDrawFrame);
  forecastDrawFrame = requestAnimationFrame(() => {
    if (preserveCenter) scroll.scrollLeft = Math.max(0, center * scroll.scrollWidth - scroll.clientWidth / 2);
    drawForecast();
  });
}

function renderWind(hourly) {
  const strip = document.getElementById('forecastWindStrip');
  strip.hidden = !settings.showWind || !settings.showWindArrows;
  strip.innerHTML = hourly.map((hour, index) => {
    const speed = numericValue(hour.windSpeed);
    const direction = numericValue(hour.windDirection);
    const visual = windVisual(speed);
    const date = String(hour.timestamp || '').slice(0, 10);
    const previousDate = String(hourly[index - 1]?.timestamp || '').slice(0, 10);
    const description = `${t('metric.wind')} ${measurement(speed, ' km/h')}${direction === null ? '' : ` ${windDirection(direction)}`}`;
    return `<div class="forecast-wind-hour ${date !== previousDate ? 'new-day' : ''}" title="${escapeHtml(description)}">
      <span class="forecast-wind-arrow" style="color:${visual.color};opacity:${visual.opacity};transform:rotate(${direction ?? 0}deg)" aria-hidden="true">↑</span>
      <span class="forecast-wind-speed">${speed === null ? '-' : Math.round(speed)}</span>
    </div>`;
  }).join('');
}

function mushroomColor(score) {
  if (!Number.isFinite(score)) return 'color-mix(in srgb, var(--chart-muted) 28%, var(--chart-mushroom))';
  const hue = 24 + score * 1.16;
  const lightness = document.documentElement.dataset.theme === 'light' ? 74 - score * .2 : 24 + score * .13;
  return `hsl(${hue.toFixed(0)} 48% ${lightness.toFixed(0)}%)`;
}

function mushroomDescription(condition) {
  if (!condition || !Number.isFinite(condition.score)) return t('mushroom.unavailable');
  return [
    t(`mushroom.level.${condition.level}`),
    t('mushroom.score', {score: condition.score}),
    t('mushroom.factors', {
      rain: measurement(condition.recentRainfall, ' mm', 1),
      humidity: measurement(condition.relativeHumidity, '%'),
      soil: measurement(Number.isFinite(condition.soilMoisture) ? condition.soilMoisture * 100 : null, '%')
    })
  ].join(' - ');
}

function renderMushroomObservations() {
  const element = document.getElementById('forecastMushroomObservations');
  const count = document.getElementById('forecastMushroomCount');
  const summaryElement = document.getElementById('forecastMushroomSummary');
  const observationsUrl = new URL('https://www.inaturalist.org/observations');
  const observationStart = new Date();
  observationStart.setDate(observationStart.getDate() - 30);
  observationsUrl.search = new URLSearchParams({
    taxon_id: '47170',
    lat: settings.location.latitude,
    lng: settings.location.longitude,
    radius: '30',
    d1: observationStart.toISOString().slice(0, 10),
    quality_grade: 'research',
    order_by: 'observed_on',
    order: 'desc'
  });
  summaryElement.href = observationsUrl;
  if (!mushroomObservations) {
    count.textContent = '...';
    element.title = t('mushroom.observationsLoading');
    summaryElement.textContent = element.title;
    summaryElement.title = element.title;
    element.setAttribute('aria-label', element.title);
    return;
  }
  if (!mushroomObservations.available) {
    count.textContent = '?';
    element.title = t('mushroom.observationsUnavailable');
    summaryElement.textContent = element.title;
    summaryElement.title = element.title;
    element.setAttribute('aria-label', element.title);
    return;
  }
  count.textContent = mushroomObservations.count > 999 ? '999+' : String(mushroomObservations.count);
  const summary = t('mushroom.observationsSummary', {
    count: mushroomObservations.count,
    radius: mushroomObservations.radiusKm,
    days: mushroomObservations.periodDays
  });
  const species = mushroomObservations.observations
    .map(item => item.commonName || item.scientificName)
    .filter((name, index, names) => name && names.indexOf(name) === index)
    .slice(0, 3);
  element.title = species.length ? `${summary} - ${species.join(', ')}` : summary;
  summaryElement.textContent = t('mushroom.observationsCompact', {
    count: mushroomObservations.count,
    radius: mushroomObservations.radiusKm,
    days: mushroomObservations.periodDays
  });
  summaryElement.title = element.title;
  element.setAttribute('aria-label', element.title);
}

function renderMushrooms(hourly) {
  const track = document.getElementById('forecastMushroomTrack');
  track.hidden = !settings.showMushrooms;
  document.getElementById('mushroomAttribution').hidden = !settings.showMushrooms;
  if (!settings.showMushrooms) return;
  const conditions = new Map((weather.daily || []).map(day => [day.date, day.mushroom]));
  const strip = document.getElementById('forecastMushroomStrip');
  strip.setAttribute('aria-label', t('chart.mushroomLabel'));
  strip.innerHTML = hourly.map((point, index) => {
    const date = String(point.timestamp || '').slice(0, 10);
    const previousDate = String(hourly[index - 1]?.timestamp || '').slice(0, 10);
    const condition = conditions.get(date);
    const newDay = index === 0 || date !== previousDate;
    const label = condition && Number.isFinite(condition.score) ? `${condition.score}` : '?';
    return `<div class="forecast-mushroom-hour ${newDay ? 'new-day' : ''}" style="--mushroom-color:${mushroomColor(condition?.score)}" title="${escapeHtml(mushroomDescription(condition))}">
      ${newDay ? `<span class="forecast-mushroom-day-label" aria-hidden="true"><svg viewBox="0 0 40 40"><path d="M5 20C6 10 12 5 20 5s14 5 15 15H5ZM15 20c1 5 0 9-3 14 5 2 11 2 16 0-3-5-4-9-3-14Z"></path></svg>${label}</span>` : ''}
    </div>`;
  }).join('');
  renderMushroomObservations();
}

function updateTemperatureAxis(range) {
  const canvasTop = document.querySelector('.forecast-track-temperature').offsetTop;
  const chartHeight = document.getElementById('forecastChart').getBoundingClientRect().height || 140;
  const plotTop = canvasTop;
  const plotHeight = chartHeight;
  const middle = (range.maximum + range.minimum) / 2;
  const values = [range.maximum, middle, range.minimum];
  document.querySelector('.forecast-chart-y-axis-temperature').innerHTML = values.map((value, index) => {
    const position = plotTop + index / 2 * plotHeight;
    const className = value > 27 ? 'hot' : value <= -12 ? 'deep-frost' : value <= 0 ? 'zero' : '';
    const displayed = celsiusToDisplay(value);
    const rounded = Math.round(displayed);
    return `<span class="${className}" style="--axis-position:${position}px">${rounded > 0 ? '+' : ''}${rounded}°</span>`;
  }).join('');
}

function renderDayDividers(hourly) {
  const container = document.getElementById('forecastDayDividers');
  container.innerHTML = hourly.map((point, index) => {
    if (index === 0) return '';
    const date = String(point.timestamp || '').slice(0, 10);
    const previousDate = String(hourly[index - 1]?.timestamp || '').slice(0, 10);
    return date === previousDate ? '' : `<i style="left:${index / hourly.length * 100}%"></i>`;
  }).join('');
}

function updateTimelineNowPosition(hourly) {
  const scroll = document.getElementById('forecastTimelineScroll');
  const timeline = document.getElementById('forecastTimeline');
  const marker = document.getElementById('forecastNowMarker');
  const history = document.getElementById('forecastHistoryShade');
  scroll.classList.remove('now-boundary-locked');
  if (!settings.showHistoricalData) {
    marker.hidden = true;
    history.hidden = true;
    timelineNowScrollLeft = 0;
    scroll.scrollLeft = 0;
    timeline.style.setProperty('--forecast-legend-offset', '0px');
    return;
  }
  const currentIndex = timelineCurrentIndex(hourly, weather?.current?.timestamp);
  if (currentIndex < 0 || !hourly.length) {
    marker.hidden = true;
    history.hidden = true;
    return;
  }
  const wasAtNow = Math.abs(scroll.scrollLeft - timelineNowScrollLeft) <= 2;
  const dataWidth = Math.max(0, timeline.clientWidth - 86);
  const markerLeft = 52 + currentIndex / hourly.length * dataWidth;
  marker.hidden = false;
  history.hidden = false;
  marker.style.left = `${markerLeft}px`;
  history.style.width = `${Math.max(0, markerLeft - 52)}px`;
  timelineNowScrollLeft = Math.max(0, markerLeft - 52);
  if (timelineInitialPositionPending || wasAtNow) {
    scroll.scrollLeft = timelineNowScrollLeft;
    timelineInitialPositionPending = false;
  }
  updateTimelineLegendPosition();
}

function updateTimelineLegendPosition() {
  const scroll = document.getElementById('forecastTimelineScroll');
  const timeline = document.getElementById('forecastTimeline');
  const offset = settings.showHistoricalData
    ? Math.min(scroll.scrollLeft, timelineNowScrollLeft)
    : 0;
  timeline.style.setProperty('--forecast-legend-offset', `${Math.max(0, offset)}px`);
}

function drawLegendPreviews() {
  const deepFrost = temperature(settings.temperatureThresholds.deepFrost);
  const freezing = temperature(0);
  const mild = temperature(settings.temperatureThresholds.mild);
  const warm = temperature(settings.temperatureThresholds.warm);
  const hot = temperature(settings.temperatureThresholds.hot);
  document.getElementById('legendDeepFrostRange').textContent = `<= ${deepFrost}`;
  document.getElementById('legendFrostRange').textContent = `${deepFrost} - ${freezing}`;
  document.getElementById('legendCoolRange').textContent = `${freezing} - ${mild}`;
  document.getElementById('legendPleasantRange').textContent = `${mild} - ${warm}`;
  document.getElementById('legendHotRange').textContent = `${warm} - ${hot}`;
  document.getElementById('legendExtremeHeatRange').textContent = `>= ${hot}`;
  drawWeatherChart(document.getElementById('legendTemperatureCanvas'), LEGEND_TEMPERATURE_POINTS, [], {timeline: true, showApparentTemperature: false, interactive: false});
  drawWeatherChart(document.getElementById('legendFeelsCanvas'), LEGEND_FEELS_POINTS, [], {timeline: true, showApparentTemperature: true, apparentAreaOpacity: .46, interactive: false});
  drawForecastSky(document.getElementById('legendSkyCanvas'), LEGEND_SKY_POINTS, LEGEND_SKY_DAYS, {showHourlyTemperatures: false});
  drawWindFlow(document.getElementById('legendWindCanvas'), LEGEND_WIND_POINTS, {tornadoVerticalScale: .42});
}

function setForecastGuideExpanded(expanded) {
  const toggle = document.getElementById('forecastGuideToggle');
  const content = document.getElementById('forecastGuideContent');
  const label = document.getElementById('forecastGuideToggleLabel');
  toggle.setAttribute('aria-expanded', String(expanded));
  content.hidden = !expanded;
  label.dataset.i18n = expanded ? 'legend.hide' : 'legend.show';
  label.textContent = t(label.dataset.i18n);
  if (expanded) requestAnimationFrame(drawLegendPreviews);
}

document.getElementById('forecastGuideToggle').addEventListener('click', event => {
  setForecastGuideExpanded(event.currentTarget.getAttribute('aria-expanded') !== 'true');
});

function drawForecastWelcome() {
  const skyOptions = {
    showHourlyTemperatures: false,
    groupHours: 3,
    visualScale: .75,
    weatherLineY: 31,
    maximumWeatherDepth: 14,
    sunlightGlowDepth: 26,
    moonY: 43,
    precipitationY: 49,
    rightPadding: 0
  };
  drawForecastSky(document.getElementById('welcomeSkyClearCanvas'), WELCOME_SKY_CLEAR, LEGEND_SKY_DAYS, skyOptions);
  drawForecastSky(document.getElementById('welcomeSkyMixedCanvas'), WELCOME_SKY_MIXED, LEGEND_SKY_DAYS, skyOptions);
  drawForecastSky(document.getElementById('welcomeSkyRainCanvas'), WELCOME_SKY_RAIN, LEGEND_SKY_DAYS, skyOptions);
  drawWeatherChart(document.getElementById('welcomeTemperatureCanvas'), WELCOME_TEMPERATURE_POINTS, [], {timeline: true, showApparentTemperature: false, interactive: false, rightPadding: 0});
  drawWindFlow(document.getElementById('welcomeWindCalmCanvas'), WELCOME_WIND_CALM, {rightPadding: 0, visualScale: .75});
  drawWindFlow(document.getElementById('welcomeWindModerateCanvas'), WELCOME_WIND_MODERATE, {rightPadding: 0, visualScale: .75});
  drawWindFlow(document.getElementById('welcomeWindStrongCanvas'), WELCOME_WIND_STRONG, {rightPadding: 0, visualScale: .75});
}

function showForecastWelcomeOnce() {
  if (IS_EMBEDDED || forecastWelcomeDisplayed) return;
  try {
    if (QUERY.get('guide') !== '1' && localStorage.getItem(FORECAST_WELCOME_KEY) === 'complete') return;
  } catch {}
  forecastWelcomeDisplayed = true;
  const dialog = document.getElementById('forecastWelcome');
  dialog.showModal();
  requestAnimationFrame(drawForecastWelcome);
  trackEvent('forecast_guide_shown');
}

function drawForecast() {
  if (!weather?.available) return;
  const historyDays = settings.showHistoricalData ? WEATHER_HISTORY_DAYS : 0;
  const hourly = timelineHourlyWindow(weather.hourly, weather.current?.timestamp, EMBED_DAYS, historyDays);
  const zoom = ZOOM_LEVELS[zoomIndex];
  const groupHours = hoursPerGroup(zoom);
  const displayedHourly = groupHourlyForecast(hourly, groupHours);
  const visualScale = zoomVisualScale(zoom);
  const skyHourly = settings.showPrecipitation ? displayedHourly : displayedHourly.map(point => ({...point, precipitation: 0, precipitationProbability: 0, snowfall: 0}));
  const range = temperatureRange(displayedHourly, settings.showApparentTemperature);
  const timeline = document.getElementById('forecastTimeline');
  timeline.style.setProperty('--forecast-slots', displayedHourly.length);
  updateTimelineNowPosition(displayedHourly);
  updateTemperatureAxis(range);
  renderDayDividers(displayedHourly);
  const windVisual = document.getElementById('forecastWindVisual');
  windVisual.hidden = !settings.showWind;
  const skyCanvas = document.getElementById('forecastWeatherCanvas');
  const skyHeight = skyCanvas.getBoundingClientRect().height;
  const enlargedLabelOffset = Math.max(0, visualScale - 1);
  const compactSky = skyHeight < 90;
  const weatherLineY = (compactSky ? 45 : 49) + enlargedLabelOffset * 24;
  const skyLayout = forecastSkyLayout(skyHeight, weatherLineY);
  const fogRows = skyLayout.precipitationLaneTop === null
    ? [skyHeight - 26, skyHeight - 20, skyHeight - 14]
    : [skyLayout.precipitationLaneTop - 12, skyLayout.precipitationLaneTop - 7, skyLayout.precipitationLaneTop - 2];
  drawForecastSky(skyCanvas, skyHourly, weather.daily, {
    showHourlyTemperatures: settings.showHourlyTemperatures,
    visualScale,
    groupHours,
    fullDayLabels: zoom >= .5,
    currentTimestamp: weather.current?.timestamp,
    showDates: settings.showDates,
    hourY: 24 + enlargedLabelOffset * 16,
    temperatureY: 40 + enlargedLabelOffset * 26,
    weatherLineY,
    maximumWeatherDepth: skyLayout.maximumWeatherDepth,
    sunlightGlowDepth: skyLayout.sunlightGlowDepth,
    moonY: compactSky ? 50 : Math.min(skyHeight - 18, 64 + enlargedLabelOffset * 18),
    precipitationLaneTop: skyLayout.precipitationLaneTop,
    precipitationY: compactSky ? skyHeight - 11 : Math.min(skyHeight - 10, 84 + enlargedLabelOffset * 20),
    fogRows
  });
  drawWeatherChart(document.getElementById('forecastChart'), displayedHourly, weather.daily, {timeline: true, showApparentTemperature: settings.showApparentTemperature, visualScale, temperatureRange: range});
  if (settings.showWind) drawWindFlow(document.getElementById('forecastWindCanvas'), displayedHourly, {visualScale});
  renderWind(displayedHourly);
  renderMushrooms(displayedHourly);
}

function scheduleSettingsPreview({fullForecast = false, forecast = true, legend = false} = {}) {
  pendingFullForecastRender ||= fullForecast;
  pendingForecastDraw ||= forecast;
  pendingLegendDraw ||= legend;
  clearTimeout(settingsPreviewTimer);
  settingsPreviewTimer = setTimeout(() => {
    if (pendingFullForecastRender) renderForecast();
    else if (pendingForecastDraw) drawForecast();
    if (pendingLegendDraw) drawLegendPreviews();
    pendingFullForecastRender = false;
    pendingForecastDraw = false;
    pendingLegendDraw = false;
  }, 0);
}

function renderForecast() {
  const current = weather?.current;
  if (!weather?.available || !current) return;
  const condition = weatherPresentation(current.weatherCode);
  const rangeKey = IS_DEMO
    ? EMBED_DAYS === 1 ? 'forecast.demoDay' : 'forecast.demoDays'
    : EMBED_DAYS === 1 ? 'forecast.nextDay' : 'forecast.nextDays';
  document.getElementById('forecastRangeLabel').textContent = t(rangeKey, {days: EMBED_DAYS});
  document.getElementById('locationTitle').textContent = weather.location?.name || settings.location.name;
  document.getElementById('updatedAt').textContent = t('status.updated', {time: formatTime(current.timestamp)});
  document.getElementById('currentWeather').innerHTML = [
    [t('metric.weather'), `${condition[0]} ${temperature(current.temperature)}`, condition[1]],
    [t('metric.feels'), temperature(current.apparentTemperature), t('metric.apparent')],
    [t('metric.humidity'), measurement(current.relativeHumidity, '%'), t('metric.relativeHumidity')],
    [t('metric.clouds'), measurement(current.cloudCover, '%'), t('metric.skyCoverage')],
    [t('metric.wind'), measurement(current.windSpeed, ' km/h'), t('metric.gusts', {direction: windDirection(current.windDirection), value: measurement(current.windGusts, ' km/h')})],
    [t('metric.pressure'), measurement(current.surfacePressure, ' hPa'), t('metric.surfacePressure')]
  ].map(([label, value, detail]) => `<article class="metric-card"><div class="metric-label">${escapeHtml(label)}</div><div class="metric-value">${value}</div><div class="metric-detail">${escapeHtml(detail)}</div></article>`).join('');

  const currentDate = String(current.timestamp || '').slice(0, 10);
  document.getElementById('dailyForecast').innerHTML = weather.daily.filter(day => day.date >= currentDate).slice(0, 10).map(day => {
    const dayCondition = weatherPresentation(day.weatherCode);
    return `<article class="forecast-day">
      <div class="forecast-day-heading"><strong>${escapeHtml(formatForecastDate(day.date, {weekday: 'short', day: 'numeric', month: 'short'}))}</strong><span class="forecast-day-symbol">${dayCondition[0]}</span></div>
      <div class="forecast-day-temperature">${temperature(day.temperatureMinimum)} / ${temperature(day.temperatureMaximum)}</div>
      <div class="forecast-day-detail">${escapeHtml(dayCondition[1])}<br>${t('metric.precipitation')}: ${measurement(day.precipitation, ' mm', 1)} (${measurement(day.precipitationProbability, '%')})<br>${t('metric.wind')}: ${measurement(day.windSpeedMaximum, ' km/h')}</div>
    </article>`;
  }).join('');
  drawForecast();
}

function renderError(message) {
  document.getElementById('currentWeather').innerHTML = `<article class="metric-card error-card"><div class="metric-label">${t('error.forecast')}</div><div class="metric-value">${t('error.unavailable')}</div><div class="metric-detail">${escapeHtml(message)}</div></article>`;
  document.getElementById('updatedAt').textContent = t('error.update');
}

function weatherIsStale() {
  return Boolean(weather?.available && weatherLoadedAt && Date.now() - weatherLoadedAt >= WEATHER_STALE_AFTER_MS);
}

function weatherFetchTime(nextWeather) {
  const fetchedAt = Date.parse(nextWeather?.fetchedAt);
  return Number.isFinite(fetchedAt) ? fetchedAt : Date.now();
}

function updateWeatherFreshnessWarning() {
  const stale = weatherIsStale();
  document.getElementById('staleWeatherWarning').hidden = !stale;
  document.body.classList.toggle('weather-stale', stale);
  return stale;
}

function renderWeatherRetryStatus() {
  document.getElementById('updatedAt').textContent = t(updateWeatherFreshnessWarning() ? 'status.staleWeather' : 'status.retryingWeather');
}

async function requestWeather(requestedLocation, {signal} = {}) {
  if (IS_DEMO) {
    const nextWeather = createWeatherDemo();
    nextWeather.location = {...requestedLocation, name: `${requestedLocation.name} - demo`};
    return nextWeather;
  }
  const parameters = new URLSearchParams({
    latitude: requestedLocation.latitude,
    longitude: requestedLocation.longitude,
    timezone: requestedLocation.timezone || 'auto',
    name: requestedLocation.name,
    mushrooms: settings.showMushrooms ? '1' : '0',
    past_days: String(settings.showHistoricalData ? WEATHER_HISTORY_DAYS : 0)
  });
  const response = await fetch(new URL(`weather?${parameters}`, API_ROOT), {signal});
  if (!response.ok) throw new Error((await response.json()).error || 'Forecast request failed.');
  return response.json();
}

function waitForRetry(delay, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason || new DOMException('Aborted', 'AbortError'));
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort);
      resolve();
    }, delay);
    const handleAbort = () => {
      clearTimeout(timeout);
      reject(signal.reason || new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', handleAbort, {once: true});
  });
}

async function requestWeatherWithRetry(requestedLocation, {signal, onRetry} = {}) {
  while (true) {
    try {
      return await requestWeather(requestedLocation, {signal});
    } catch (error) {
      if (signal?.aborted) throw error;
      onRetry?.();
      await waitForRetry(WEATHER_RETRY_DELAY_MS, signal);
    }
  }
}

async function loadMushroomObservations(requestedLocation = settings.location) {
  const requestId = ++mushroomObservationRequest;
  mushroomObservations = null;
  if (weather?.available) drawForecast();
  if (!settings.showMushrooms) return;
  if (IS_DEMO) {
    mushroomObservations = {
      available: true,
      count: 18,
      radiusKm: 30,
      periodDays: 30,
      observations: []
    };
    if (weather?.available) drawForecast();
    return;
  }
  try {
    const parameters = new URLSearchParams({
      latitude: requestedLocation.latitude,
      longitude: requestedLocation.longitude,
      language: settings.language
    });
    const response = await fetch(new URL(`mushroom-observations?${parameters}`, API_ROOT));
    if (!response.ok) throw new Error('Mushroom observation request failed.');
    const result = await response.json();
    if (requestId !== mushroomObservationRequest || !settings.showMushrooms || !sameLocation(settings.location, requestedLocation)) return;
    mushroomObservations = result;
  } catch {
    if (requestId !== mushroomObservationRequest) return;
    mushroomObservations = {available: false};
  }
  if (weather?.available) drawForecast();
}

async function loadWeather() {
  weatherAbortController?.abort();
  const controller = new AbortController();
  weatherAbortController = controller;
  const requestId = ++weatherRequest;
  const requestedLocation = {...settings.location};
  document.getElementById('locationTitle').textContent = requestedLocation.name;
  document.getElementById('updatedAt').textContent = t('status.loading');
  document.querySelector('.forecast-panel').setAttribute('aria-busy', 'true');
  try {
    const nextWeather = await requestWeatherWithRetry(requestedLocation, {
      signal: controller.signal,
      onRetry: () => {
        if (requestId === weatherRequest) renderWeatherRetryStatus();
      }
    });
    document.getElementById('forecastRangeLabel').textContent = t(IS_DEMO ? 'forecast.demo' : 'forecast.next');
    if (requestId !== weatherRequest) return;
    if (sameLocation(settings.location, requestedLocation)) {
      nextWeather.location = {...nextWeather.location, ...settings.location};
    }
    weather = nextWeather;
    weatherLoadedAt = weatherFetchTime(nextWeather);
    updateWeatherFreshnessWarning();
    renderForecast();
    if (settings.showMushrooms) loadMushroomObservations(requestedLocation);
    showForecastWelcomeOnce();
    trackEvent('forecast_loaded', {forecast_mode: IS_DEMO ? 'demo' : 'live', embedded: IS_EMBEDDED});
  } catch (error) {
    if (requestId !== weatherRequest) return;
    if (controller.signal.aborted) return;
    renderError(error.message);
  } finally {
    if (requestId === weatherRequest) {
      if (weatherAbortController === controller) weatherAbortController = null;
      document.querySelector('.forecast-panel').removeAttribute('aria-busy');
    }
  }
}

function renderLocationLoading(status = t('status.loading')) {
  document.body.classList.add('location-loading');
  document.getElementById('locationTitle').textContent = '';
  document.getElementById('updatedAt').textContent = status;
  document.querySelector('.forecast-panel').setAttribute('aria-busy', 'true');
  document.getElementById('currentWeather').innerHTML = Array.from({length: 6}, () => `<article class="metric-card skeleton-card" aria-hidden="true"><span class="skeleton-line short"></span><span class="skeleton-line large"></span><span class="skeleton-line medium"></span></article>`).join('');
  document.getElementById('dailyForecast').innerHTML = Array.from({length: 10}, () => `<article class="forecast-day skeleton-card" aria-hidden="true"><span class="skeleton-line medium"></span><span class="skeleton-line large"></span><span class="skeleton-line"></span><span class="skeleton-line medium"></span></article>`).join('');
}

function clearLocationLoading() {
  document.body.classList.remove('location-loading');
  document.querySelector('.forecast-panel').removeAttribute('aria-busy');
}

async function restoreLocationAfterFailure() {
  if (weather?.available) renderForecast();
  else await loadWeather();
  clearLocationLoading();
  showNotification(t('error.deviceLocationUpdate'));
}

function hideNotification() {
  clearTimeout(notificationTimer);
  document.getElementById('appNotification').hidden = true;
}

function showNotification(message) {
  clearTimeout(notificationTimer);
  document.getElementById('appNotificationMessage').textContent = message;
  document.getElementById('appNotification').hidden = false;
  notificationTimer = setTimeout(hideNotification, 8000);
}

async function loadDeviceLocation(position) {
  const previous = {
    location: settings.location,
    locations: [...settings.locations],
    pendingLocation,
    pendingLocations: [...pendingLocations],
    weather
  };
  const deviceLocation = deviceLocationFromPosition(position);
  const locationController = new AbortController();
  const weatherController = new AbortController();
  const timeout = setTimeout(() => locationController.abort(), LOCATION_REQUEST_TIMEOUT_MS);
  weatherAbortController?.abort();
  weatherAbortController = weatherController;
  weatherRequest += 1;
  renderLocationLoading();
  try {
    const [resolvedLocation, nextWeather] = await Promise.all([
      IS_DEMO ? deviceLocation : resolveDeviceLocation(deviceLocation, {signal: locationController.signal, strict: true}),
      requestWeatherWithRetry(deviceLocation, {
        signal: weatherController.signal,
        onRetry: () => renderLocationLoading(t('status.retryingWeather'))
      })
    ]);
    nextWeather.location = {...nextWeather.location, ...resolvedLocation};
    settings.location = resolvedLocation;
    settings.locations = withLocation(previous.locations, resolvedLocation);
    settings.configured = true;
    pendingLocation = resolvedLocation;
    pendingLocations = [...settings.locations];
    weather = nextWeather;
    weatherLoadedAt = weatherFetchTime(nextWeather);
    updateWeatherFreshnessWarning();
    saveSettings();
    updateBrowserRoute();
    renderLocationMenu();
    renderForecast();
    showForecastWelcomeOnce();
    trackEvent('location_selected', {source: 'device'});
  } catch {
    weatherController.abort();
    settings.location = previous.location;
    settings.locations = previous.locations;
    pendingLocation = previous.pendingLocation;
    pendingLocations = previous.pendingLocations;
    weather = previous.weather;
    saveSettings();
    updateBrowserRoute();
    renderLocationMenu();
    await restoreLocationAfterFailure();
  } finally {
    clearTimeout(timeout);
    if (weatherAbortController === weatherController) weatherAbortController = null;
    clearLocationLoading();
  }
}

function fillSettingsForm() {
  pendingLocation = settings.location;
  pendingLocations = [...settings.locations];
  document.getElementById('locationQuery').value = '';
  renderPendingLocations();
  document.getElementById('defaultZoom').value = String(settings.zoom);
  document.getElementById('colorTheme').value = settings.theme;
  document.getElementById('languageSetting').value = settings.language;
  document.getElementById('temperatureUnit').checked = settings.temperatureUnit === 'F';
  renderTemperatureScale();
  document.getElementById('showHourlyTemperatures').checked = settings.showHourlyTemperatures;
  document.getElementById('showApparentTemperature').checked = settings.showApparentTemperature;
  document.getElementById('showPrecipitation').checked = settings.showPrecipitation;
  document.getElementById('showWind').checked = settings.showWind;
  document.getElementById('showWindArrows').checked = settings.showWindArrows;
  document.getElementById('showMushrooms').checked = settings.showMushrooms;
  document.getElementById('showHistoricalData').checked = settings.showHistoricalData;
  document.getElementById('showDates').checked = settings.showDates;
  document.getElementById('embedDays').value = String(settings.embedDays);
  document.getElementById('embedLegend').checked = settings.embedLegend;
  document.getElementById('locationResults').innerHTML = '';
  document.getElementById('locationResults').hidden = true;
  document.getElementById('locationStatus').textContent = '';
  document.getElementById('settingsError').textContent = '';
  document.getElementById('copyStatus').textContent = '';
  document.getElementById('embedCode').value = embedCode(pendingLocation, settings.theme, settings.language);
}

function temperatureScaleBounds() {
  return temperatureUnit() === 'F' ? {minimum: -40, maximum: 122, freezing: 32} : {minimum: -40, maximum: 50, freezing: 0};
}

function renderTemperatureScale() {
  const bounds = temperatureScaleBounds();
  const thresholds = settings.temperatureThresholds;
  const values = {
    deepFrost: celsiusToDisplay(thresholds.deepFrost),
    freezing: bounds.freezing,
    mild: celsiusToDisplay(thresholds.mild),
    warm: celsiusToDisplay(thresholds.warm),
    hot: celsiusToDisplay(thresholds.hot)
  };
  document.querySelectorAll('[data-temperature-threshold]').forEach(input => {
    input.min = String(bounds.minimum);
    input.max = String(bounds.maximum);
    input.step = temperatureUnit() === 'F' ? '1' : '.5';
    input.value = String(values[input.dataset.temperatureThreshold]);
  });
  const range = bounds.maximum - bounds.minimum;
  const position = value => (value - bounds.minimum) / range * 100;
  const deepFrostPosition = position(values.deepFrost);
  const freezingPosition = position(values.freezing);
  const mildPosition = position(values.mild);
  const warmPosition = position(values.warm);
  const hotPosition = position(values.hot);
  document.querySelector('.temperature-scale-gradient').style.background = `linear-gradient(90deg,
    #fff 0 ${deepFrostPosition}%, #7f8996 ${deepFrostPosition}% ${freezingPosition}%,
    #2358c7 ${freezingPosition}% ${mildPosition}%, #45cf88 ${mildPosition}% ${warmPosition}%,
    #f28e3e ${warmPosition}% ${hotPosition}%, #ff263f ${hotPosition}% 100%)`;
  document.getElementById('temperatureScaleValues').innerHTML = Object.entries(values).map(([name, value]) => {
    const labelPosition = position(value);
    return `<span style="left:${labelPosition}%" data-scale-value="${name}">${shortTemperature(displayToCelsius(value))}</span>`;
  }).join('');
  document.querySelectorAll('[data-scale-value]').forEach(label => {
    const position = Number.parseFloat(label.style.left);
    label.style.transform = `translateX(${position < 8 ? 0 : position > 92 ? -100 : -50}%)`;
  });
}

function settingsFromForm() {
  return {
    ...settings,
    location: pendingLocation,
    locations: pendingLocations,
    configured: true,
    zoom: Number(document.getElementById('defaultZoom').value),
    theme: document.getElementById('colorTheme').value,
    language: document.getElementById('languageSetting').value,
    languageSource: 'user',
    temperatureUnit: document.getElementById('temperatureUnit').checked ? 'F' : 'C',
    showHourlyTemperatures: document.getElementById('showHourlyTemperatures').checked,
    showApparentTemperature: document.getElementById('showApparentTemperature').checked,
    showPrecipitation: document.getElementById('showPrecipitation').checked,
    showWind: document.getElementById('showWind').checked,
    showWindArrows: document.getElementById('showWindArrows').checked,
    showMushrooms: document.getElementById('showMushrooms').checked,
    showHistoricalData: document.getElementById('showHistoricalData').checked,
    showDates: document.getElementById('showDates').checked,
    embedDays: widgetDays(document.getElementById('embedDays').value),
    embedLegend: document.getElementById('embedLegend').checked,
    layoutVersion: LAYOUT_VERSION
  };
}

function saveFormChanges({reloadWeather = false} = {}) {
  const previousLocation = settings.location;
  const previousLanguage = settings.language;
  const previousTheme = settings.theme;
  const previousUnit = settings.temperatureUnit;
  const previousZoom = settings.zoom;
  const previousHourlyTemperatures = settings.showHourlyTemperatures;
  const previousApparentTemperature = settings.showApparentTemperature;
  const previousPrecipitation = settings.showPrecipitation;
  const previousWind = settings.showWind;
  const previousWindArrows = settings.showWindArrows;
  const previousMushrooms = settings.showMushrooms;
  const previousHistoricalData = settings.showHistoricalData;
  const previousDates = settings.showDates;
  settings = settingsFromForm();
  const locationChanged = !sameLocation(previousLocation, settings.location);
  const languageChanged = previousLanguage !== settings.language;
  const themeChanged = previousTheme !== settings.theme;
  const unitChanged = previousUnit !== settings.temperatureUnit;
  const zoomChanged = previousZoom !== settings.zoom;
  const historicalDataChanged = previousHistoricalData !== settings.showHistoricalData;
  const forecastDisplayChanged = previousHourlyTemperatures !== settings.showHourlyTemperatures
    || previousApparentTemperature !== settings.showApparentTemperature
    || previousPrecipitation !== settings.showPrecipitation
    || previousWind !== settings.showWind
    || previousWindArrows !== settings.showWindArrows
    || previousMushrooms !== settings.showMushrooms
    || historicalDataChanged
    || previousDates !== settings.showDates;
  settings.language = languageChanged ? setLanguage(settings.language) : normalizeLanguage(settings.language);
  applyTemperatureSettings();
  saveSettings();
  if (locationChanged || languageChanged) updateBrowserRoute();
  document.getElementById('languageSelect').value = settings.language;
  if (themeChanged) applyTheme(settings.theme);
  zoomIndex = ZOOM_LEVELS.indexOf(settings.zoom);
  if (locationChanged) renderLocationMenu();
  if (locationChanged || languageChanged || themeChanged || unitChanged || zoomChanged) updateEmbedPreview();
  if (languageChanged) fillSettingsForm();
  else if (unitChanged) renderTemperatureScale();
  if (zoomChanged) applyZoom(zoomIndex, false);
  else if (weather && (languageChanged || unitChanged)) scheduleSettingsPreview({fullForecast: true, legend: true});
  else if (weather && (themeChanged || forecastDisplayChanged)) scheduleSettingsPreview({legend: themeChanged});
  else if (languageChanged || unitChanged || themeChanged) scheduleSettingsPreview({forecast: false, legend: true});
  if (languageChanged || themeChanged) loadPromotion();
  if (!settings.showMushrooms) {
    mushroomObservationRequest += 1;
    mushroomObservations = null;
  } else if (previousMushrooms && languageChanged) {
    loadMushroomObservations();
  }
  if (historicalDataChanged) {
    timelineInitialPositionPending = true;
    loadWeather();
  } else if (!previousMushrooms && settings.showMushrooms) loadWeather();
  else if (reloadWeather) loadWeather();
}

function renderPendingLocations() {
  document.getElementById('selectedLocation').textContent = `${t('settings.activeLocation')}: ${locationLabel(pendingLocation)}`;
  const container = document.getElementById('savedLocations');
  container.innerHTML = pendingLocations.map((item, index) => `<div class="saved-location">
    <button type="button" class="saved-location-select" data-saved-location="${index}" aria-pressed="${sameLocation(item, pendingLocation)}">${escapeHtml(locationLabel(item))}</button>
    <button type="button" class="saved-location-share" data-share-location="${index}" aria-label="${escapeHtml(t('action.shareLocation'))}" title="${escapeHtml(t('action.shareLocation'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"></circle><circle cx="6" cy="12" r="2.5"></circle><circle cx="18" cy="19" r="2.5"></circle><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"></path></svg></button>
    <button type="button" class="saved-location-remove" data-remove-location="${index}" aria-label="${escapeHtml(t('action.removeLocation'))}" title="${escapeHtml(t('action.removeLocation'))}" ${pendingLocations.length === 1 ? 'disabled' : ''}>×</button>
  </div>`).join('');
  container.querySelectorAll('[data-saved-location]').forEach(button => button.addEventListener('click', () => {
    pendingLocation = pendingLocations[Number(button.dataset.savedLocation)];
    renderPendingLocations();
    saveFormChanges({reloadWeather: true});
  }));
  container.querySelectorAll('[data-remove-location]').forEach(button => button.addEventListener('click', () => {
    if (pendingLocations.length === 1) return;
    const removed = pendingLocations[Number(button.dataset.removeLocation)];
    pendingLocations = pendingLocations.filter(item => !sameLocation(item, removed));
    if (sameLocation(removed, pendingLocation)) pendingLocation = pendingLocations[0];
    renderPendingLocations();
    saveFormChanges({reloadWeather: true});
  }));
  container.querySelectorAll('[data-share-location]').forEach(button => button.addEventListener('click', () => {
    openShareDialog(pendingLocations[Number(button.dataset.shareLocation)]);
  }));
}

function updateEmbedPreview() {
  document.getElementById('embedCode').value = embedCode(pendingLocation, document.getElementById('colorTheme').value, document.getElementById('languageSetting').value);
}

function renderLocationMenu() {
  const list = document.getElementById('locationMenuList');
  list.innerHTML = settings.locations.map((item, index) => `<button type="button" class="location-menu-location" data-menu-location="${index}" aria-current="${sameLocation(item, settings.location)}">${escapeHtml(locationLabel(item))}</button>`).join('');
  list.querySelectorAll('[data-menu-location]').forEach(button => button.addEventListener('click', () => {
    activateLocation(settings.locations[Number(button.dataset.menuLocation)]);
    closeLocationMenu();
  }));
}

function closeLocationMenu() {
  document.getElementById('locationMenu').hidden = true;
  document.getElementById('editLocation').setAttribute('aria-expanded', 'false');
  document.getElementById('locationTitle').setAttribute('aria-expanded', 'false');
}

function openSettingsDialog() {
  closeLocationMenu();
  fillSettingsForm();
  document.getElementById('settingsDialog').showModal();
}

function activateLocation(item, locations = settings.locations) {
  settings.location = item;
  settings.locations = withLocation(locations, item);
  settings.configured = true;
  saveSettings();
  updateBrowserRoute();
  renderLocationMenu();
  trackEvent('location_selected');
  loadWeather();
}

async function searchLocations() {
  clearTimeout(locationSearchTimer);
  const query = document.getElementById('locationQuery').value.trim();
  const resultsElement = document.getElementById('locationResults');
  if (query.length < 2) return;
  const requestId = ++locationSearchRequest;
  resultsElement.textContent = t('status.searching');
  resultsElement.hidden = false;
  document.getElementById('locationStatus').textContent = '';
  document.getElementById('settingsError').textContent = '';
  try {
    if (IS_GITHUB_PAGES) throw new Error(t('error.locationApi'));
    const parameters = new URLSearchParams({q: query, language: settings.language});
    const response = await fetch(new URL(`locations?${parameters}`, API_ROOT));
    const payload = await response.json();
    if (requestId !== locationSearchRequest) return;
    if (!response.ok) throw new Error(payload.error);
    resultsElement.innerHTML = payload.results.length ? payload.results.map((item, index) => `<button type="button" class="location-result" data-location-index="${index}"><strong>${escapeHtml(item.name)}</strong> - ${escapeHtml([item.postalCode, item.admin1, item.country].filter(Boolean).join(', '))}</button>`).join('') : `<p class="muted">${t('error.noLocations')}</p>`;
    resultsElement.querySelectorAll('[data-location-index]').forEach(button => button.addEventListener('click', () => {
      pendingLocation = payload.results[Number(button.dataset.locationIndex)];
      pendingLocations = withLocation(pendingLocations, pendingLocation);
      document.getElementById('locationQuery').value = '';
      resultsElement.innerHTML = '';
      resultsElement.hidden = true;
      document.getElementById('locationStatus').textContent = t('status.locationAdded');
      renderPendingLocations();
      saveFormChanges({reloadWeather: true});
    }));
  } catch (error) {
    if (requestId !== locationSearchRequest) return;
    resultsElement.innerHTML = '';
    document.getElementById('settingsError').textContent = error.message;
  }
}

document.getElementById('openSettings').addEventListener('click', openSettingsDialog);
document.getElementById('settingsButton').addEventListener('click', openSettingsDialog);
function toggleLocationMenu() {
  if (settings.locations.length === 1) return openSettingsDialog();
  const menu = document.getElementById('locationMenu');
  const opening = menu.hidden;
  menu.hidden = !opening;
  document.getElementById('editLocation').setAttribute('aria-expanded', String(opening));
  document.getElementById('locationTitle').setAttribute('aria-expanded', String(opening));
  if (opening) renderLocationMenu();
}
document.getElementById('editLocation').addEventListener('click', toggleLocationMenu);
document.getElementById('locationTitle').addEventListener('click', toggleLocationMenu);
document.addEventListener('click', event => {
  if (!event.target.closest('.location-title-row')) closeLocationMenu();
});
document.getElementById('themeToggle').addEventListener('click', () => {
  applyTheme(settings.theme === 'dark' ? 'light' : 'dark', true);
  document.getElementById('colorTheme').value = settings.theme;
  drawForecast();
  drawLegendPreviews();
  loadPromotion();
  trackEvent('display_preference_changed', {preference: 'theme', value: settings.theme});
});
document.getElementById('languageSelect').addEventListener('change', event => {
  settings.language = setLanguage(event.target.value);
  settings.languageSource = 'user';
  saveSettings();
  updateBrowserRoute();
  document.getElementById('languageSetting').value = settings.language;
  applyTheme(settings.theme);
  renderForecast();
  drawLegendPreviews();
  loadPromotion();
  if (settings.showMushrooms) loadMushroomObservations();
  trackEvent('display_preference_changed', {preference: 'language', value: settings.language});
});
document.getElementById('settingsForm').addEventListener('change', event => {
  if (event.target.matches('[data-temperature-threshold]')) return;
  saveFormChanges();
  updateEmbedPreview();
});
document.querySelectorAll('[data-temperature-threshold]:not(:disabled)').forEach(input => {
  input.addEventListener('input', event => {
    const name = event.currentTarget.dataset.temperatureThreshold;
    settings.temperatureThresholds = normalizeTemperatureThresholds({
      ...settings.temperatureThresholds,
      [name]: displayToCelsius(Number(event.currentTarget.value))
    });
    setTemperatureColorThresholds(settings.temperatureThresholds);
    renderTemperatureScale();
    scheduleSettingsPreview({legend: true});
  });
  input.addEventListener('change', () => {
    saveSettings();
    updateEmbedPreview();
  });
});
document.getElementById('copyEmbedCode').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(document.getElementById('embedCode').value);
    document.getElementById('copyStatus').textContent = t('status.copied');
    trackEvent('embed_code_copied');
  } catch {
    document.getElementById('embedCode').select();
    document.getElementById('copyStatus').textContent = t('status.copyManual');
  }
});
document.querySelectorAll('[data-share-forecast]').forEach(button => button.addEventListener('click', () => openShareDialog()));
document.getElementById('shareActiveLocation').addEventListener('click', () => openShareDialog(pendingLocation));
document.getElementById('shareNative').addEventListener('click', async () => {
  if (!navigator.share) return;
  try {
    await navigator.share(activeShareData || currentShareData());
    document.getElementById('shareDialogStatus').textContent = t('share.thanks');
    trackEvent('forecast_shared', {method: 'native'});
  } catch (error) {
    if (error?.name !== 'AbortError') document.getElementById('shareDialogStatus').textContent = t('share.copyFailed');
  }
});
document.getElementById('shareCopy').addEventListener('click', async () => {
  try {
    await copyShareLink();
    document.getElementById('shareDialogStatus').textContent = t('share.copied');
    trackEvent('forecast_shared', {method: 'clipboard'});
  } catch {
    document.getElementById('shareDialogStatus').textContent = t('share.copyFailed');
  }
});
document.querySelectorAll('[data-share-method]').forEach(link => link.addEventListener('click', () => {
  trackEvent('forecast_shared', {method: link.dataset.shareMethod});
}));
document.getElementById('closeShareDialog').addEventListener('click', () => document.getElementById('shareDialog').close());
document.getElementById('shareDialog').addEventListener('click', event => {
  if (event.target === event.currentTarget) event.currentTarget.close();
});
document.getElementById('searchLocation').addEventListener('click', searchLocations);
document.getElementById('locationQuery').addEventListener('input', event => {
  clearTimeout(locationSearchTimer);
  const query = event.currentTarget.value.trim();
  if (query.length < 2) {
    locationSearchRequest += 1;
    document.getElementById('locationResults').hidden = true;
    document.getElementById('settingsError').textContent = '';
    return;
  }
  locationSearchTimer = setTimeout(searchLocations, 350);
});
document.getElementById('locationQuery').addEventListener('keydown', event => {
  if (event.key === 'Enter') { event.preventDefault(); searchLocations(); }
});
document.getElementById('useDeviceLocation').addEventListener('click', event => {
  if (!navigator.geolocation) {
    document.getElementById('settingsDialog').close();
    return showNotification(t('error.deviceLocationUpdate'));
  }
  const button = event.currentTarget;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  document.getElementById('settingsError').textContent = t('status.waitingLocation');
  document.getElementById('settingsDialog').close();
  weatherAbortController?.abort();
  weatherAbortController = null;
  weatherRequest += 1;
  renderLocationLoading(t('status.waitingLocation'));
  navigator.geolocation.getCurrentPosition(async position => {
    console.log('[Weather] Browser geolocation response:', {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      altitudeAccuracy: position.coords.altitudeAccuracy,
      heading: position.coords.heading,
      speed: position.coords.speed,
      timestamp: position.timestamp
    });
    document.getElementById('settingsError').textContent = '';
    button.disabled = false;
    button.removeAttribute('aria-busy');
    await loadDeviceLocation(position);
  }, async () => {
    document.getElementById('settingsError').textContent = '';
    button.disabled = false;
    button.removeAttribute('aria-busy');
    await restoreLocationAfterFailure();
  }, {enableHighAccuracy: false, timeout: 10000});
});
document.getElementById('closeAppNotification').addEventListener('click', hideNotification);
document.getElementById('settingsForm').addEventListener('submit', event => {
  event.preventDefault();
  document.getElementById('settingsDialog').close();
});
document.getElementById('closeForecastWelcome').addEventListener('click', () => {
  document.getElementById('forecastWelcome').close();
});
document.getElementById('forecastWelcome').addEventListener('close', () => {
  try { localStorage.setItem(FORECAST_WELCOME_KEY, 'complete'); } catch {}
  trackEvent('forecast_guide_completed');
});

document.getElementById('forecastZoomOut').addEventListener('click', () => {
  applyZoom(zoomIndex - 1, true, true);
  trackEvent('display_preference_changed', {preference: 'timeline_zoom', value: ZOOM_LEVELS[zoomIndex]});
});
document.getElementById('forecastZoomReset').addEventListener('click', () => {
  applyZoom(ZOOM_LEVELS.indexOf(DEFAULT_ZOOM), true, true);
  trackEvent('display_preference_changed', {preference: 'timeline_zoom', value: ZOOM_LEVELS[zoomIndex]});
});
document.getElementById('forecastZoomIn').addEventListener('click', () => {
  applyZoom(zoomIndex + 1, true, true);
  trackEvent('display_preference_changed', {preference: 'timeline_zoom', value: ZOOM_LEVELS[zoomIndex]});
});
document.getElementById('forecastTimelineScroll').addEventListener('wheel', event => {
  if (!event.ctrlKey) return;
  event.preventDefault();
  applyZoom(zoomIndex + (event.deltaY < 0 ? 1 : -1), true, true);
}, {passive: false});

const forecastTimelineScroll = document.getElementById('forecastTimelineScroll');
const timelineHistoryResistance = () => Math.min(150, Math.max(80, forecastTimelineScroll.clientWidth * .16)) * .0625;
const timelineMagneticDistance = () => forecastBaseHourWidth() * ZOOM_LEVELS[zoomIndex] * 6;
let timelineWheelResistance = 0;
let timelineWheelResetTimer = 0;
let timelineWheelStartPosition = null;
let timelineTouchActive = false;
let timelineTouchStartPosition = null;
let timelineTouchBoundaryLocked = false;
let timelineTouchSettleTimer = 0;

function snapTimelineToNowIfClose() {
  if (!settings.showHistoricalData || !withinTimelineMagnet(forecastTimelineScroll.scrollLeft, timelineNowScrollLeft, timelineMagneticDistance())) return;
  forecastTimelineScroll.scrollTo({left: timelineNowScrollLeft, behavior: 'smooth'});
}

function scheduleTimelineNowSnap() {
  window.clearTimeout(timelineWheelResetTimer);
  timelineWheelResetTimer = window.setTimeout(() => {
    timelineWheelResistance = 0;
    timelineWheelStartPosition = null;
    snapTimelineToNowIfClose();
  }, 180);
}

forecastTimelineScroll.addEventListener('wheel', event => {
  if (event.ctrlKey || !settings.showHistoricalData) return;
  const delta = Math.abs(event.deltaX) >= Math.abs(event.deltaY)
    ? event.deltaX
    : event.shiftKey ? event.deltaY : 0;
  if (!delta) return;
  event.preventDefault();
  if (timelineWheelStartPosition === null) {
    timelineWheelStartPosition = forecastTimelineScroll.scrollLeft;
  }
  const attempted = Math.max(0, forecastTimelineScroll.scrollLeft + delta);
  const bounded = stopTimelineAtNow(timelineWheelStartPosition, attempted, timelineNowScrollLeft);
  if (bounded !== attempted) {
    forecastTimelineScroll.scrollLeft = bounded;
  } else if (Math.abs(timelineWheelStartPosition - timelineNowScrollLeft) <= 1 && attempted < timelineNowScrollLeft) {
    timelineWheelResistance += Math.max(0, -delta);
    forecastTimelineScroll.scrollLeft = resistedHistoryPosition(
      timelineNowScrollLeft,
      timelineNowScrollLeft - timelineWheelResistance,
      timelineNowScrollLeft,
      timelineHistoryResistance()
    );
  } else {
    forecastTimelineScroll.scrollLeft = bounded;
  }
  scheduleTimelineNowSnap();
}, {passive: false});

forecastTimelineScroll.addEventListener('touchstart', event => {
  if (event.touches.length !== 1 || !settings.showHistoricalData) return;
  window.clearTimeout(timelineTouchSettleTimer);
  forecastTimelineScroll.classList.remove('now-boundary-locked');
  timelineTouchActive = true;
  timelineTouchStartPosition = forecastTimelineScroll.scrollLeft;
  timelineTouchBoundaryLocked = false;
}, {passive: true});

function settleTimelineTouch() {
  window.clearTimeout(timelineTouchSettleTimer);
  timelineTouchSettleTimer = window.setTimeout(() => {
    if (timelineTouchActive) {
      settleTimelineTouch();
      return;
    }
    const wasLocked = timelineTouchBoundaryLocked;
    timelineTouchStartPosition = null;
    timelineTouchBoundaryLocked = false;
    forecastTimelineScroll.classList.remove('now-boundary-locked');
    if (wasLocked) forecastTimelineScroll.scrollLeft = timelineNowScrollLeft;
    snapTimelineToNowIfClose();
  }, 140);
}

forecastTimelineScroll.addEventListener('scroll', () => {
  updateTimelineLegendPosition();
  if (!settings.showHistoricalData || timelineTouchStartPosition === null) return;
  const bounded = stopTimelineAtNow(timelineTouchStartPosition, forecastTimelineScroll.scrollLeft, timelineNowScrollLeft);
  if (bounded !== forecastTimelineScroll.scrollLeft) {
    timelineTouchBoundaryLocked = true;
    forecastTimelineScroll.classList.add('now-boundary-locked');
    forecastTimelineScroll.scrollLeft = bounded;
  }
  settleTimelineTouch();
}, {passive: true});

forecastTimelineScroll.addEventListener('touchend', () => {
  timelineTouchActive = false;
  settleTimelineTouch();
});

forecastTimelineScroll.addEventListener('touchcancel', () => {
  timelineTouchActive = false;
  settleTimelineTouch();
});

let pinchStartDistance = 0;
let pinchStartZoom = DEFAULT_ZOOM;
const touchDistance = touches => Math.hypot(
  touches[0].clientX - touches[1].clientX,
  touches[0].clientY - touches[1].clientY
);
forecastTimelineScroll.addEventListener('touchstart', event => {
  if (event.touches.length !== 2) return;
  event.preventDefault();
  window.clearTimeout(timelineTouchSettleTimer);
  timelineTouchActive = false;
  timelineTouchStartPosition = null;
  timelineTouchBoundaryLocked = false;
  forecastTimelineScroll.classList.remove('now-boundary-locked');
  pinchStartDistance = touchDistance(event.touches);
  pinchStartZoom = ZOOM_LEVELS[zoomIndex];
}, {passive: false});
forecastTimelineScroll.addEventListener('touchmove', event => {
  if (event.touches.length !== 2 || !pinchStartDistance) return;
  event.preventDefault();
  const targetZoom = pinchStartZoom * touchDistance(event.touches) / pinchStartDistance;
  const targetIndex = ZOOM_LEVELS.reduce((closestIndex, zoom, index) => (
    Math.abs(Math.log(zoom / targetZoom)) < Math.abs(Math.log(ZOOM_LEVELS[closestIndex] / targetZoom)) ? index : closestIndex
  ), 0);
  if (targetIndex === zoomIndex) return;
  applyZoom(targetIndex, true, true);
  trackEvent('display_preference_changed', {preference: 'timeline_zoom', value: ZOOM_LEVELS[zoomIndex], input: 'pinch'});
}, {passive: false});
const finishPinch = event => {
  if (event.touches.length < 2) pinchStartDistance = 0;
};
forecastTimelineScroll.addEventListener('touchend', finishPinch);
forecastTimelineScroll.addEventListener('touchcancel', finishPinch);

function openEmbeddedForecast() {
  if (!IS_EMBEDDED || window.parent === window) return;
  window.parent.postMessage({type: 'weather:open-forecast'}, '*');
}

const forecastHeadingLink = document.getElementById('forecastHeadingLink');
document.querySelector('.forecast-panel').addEventListener('click', event => {
  if (event.target.closest('button, a')) return;
  openEmbeddedForecast();
});
forecastHeadingLink.addEventListener('keydown', event => {
  if (!IS_EMBEDDED || !['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  openEmbeddedForecast();
});
if (IS_EMBEDDED) {
  forecastHeadingLink.setAttribute('role', 'link');
  forecastHeadingLink.setAttribute('tabindex', '0');
}

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => applyZoom(zoomIndex), 80);
});

document.body.classList.toggle('embedded', IS_EMBEDDED);
document.body.classList.toggle('embedded-without-legend', IS_EMBEDDED && !EMBED_LEGEND);
if (document.documentElement.dataset.sharePrompt === 'collapsed') collapseSharePrompt(false);
renderLanguageOptions();
settings.language = setLanguage(settings.language);
applyTemperatureSettings();
document.getElementById('languageSelect').value = settings.language;
applyTheme(settings.theme);
drawLegendPreviews();
applyZoom(zoomIndex, false);
renderLocationMenu();

function devicePosition() {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {enableHighAccuracy: false, timeout: 10000});
  });
}

function deviceLocationFromPosition(position) {
  return {
    id: `device-${position.coords.latitude.toFixed(4)}-${position.coords.longitude.toFixed(4)}`,
    name: t('location.current'),
    country: '',
    latitude: Number(position.coords.latitude.toFixed(5)),
    longitude: Number(position.coords.longitude.toFixed(5)),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'auto'
  };
}

function applyResolvedDeviceLocation(fallback, resolved) {
  if (!sameLocation(settings.location, fallback)) return;
  settings.locations = replacingLocation(settings.locations, fallback, resolved);
  settings.location = resolved;
  pendingLocations = replacingLocation(pendingLocations, fallback, resolved);
  if (sameLocation(pendingLocation, fallback)) pendingLocation = resolved;
  if (weather && Number(weather.location?.latitude) === fallback.latitude && Number(weather.location?.longitude) === fallback.longitude) {
    weather.location = resolved;
    document.getElementById('locationTitle').textContent = resolved.name;
  }
  saveSettings();
  updateBrowserRoute();
  renderLocationMenu();
  if (document.getElementById('settingsDialog').open) renderPendingLocations();
}

async function resolveAndApplyDeviceLocation(fallback) {
  const resolved = await resolveDeviceLocation(fallback);
  applyResolvedDeviceLocation(fallback, resolved);
}

function usesAutomaticLocation(item = settings.location) {
  const id = String(item?.id || '');
  return id.startsWith('device-');
}

async function refreshAutomaticDeviceLocation({reloadWeather = true} = {}) {
  if (IS_DEMO || IS_EMBEDDED || !usesAutomaticLocation()) return false;
  const position = await devicePosition();
  if (!position) return false;
  const deviceLocation = deviceLocationFromPosition(position);
  settings.locations = withLocation(settings.locations, deviceLocation);
  settings.location = deviceLocation;
  settings.configured = true;
  pendingLocations = [...settings.locations];
  pendingLocation = deviceLocation;
  saveSettings();
  updateBrowserRoute();
  renderLocationMenu();
  document.getElementById('locationTitle').textContent = deviceLocation.name;
  document.getElementById('updatedAt').textContent = t('status.loading');
  if (reloadWeather) loadWeather();
  resolveAndApplyDeviceLocation(deviceLocation);
  return true;
}

async function monitorGeolocationPermission() {
  if (!navigator.permissions?.query || !navigator.geolocation) return;
  try {
    const permission = await navigator.permissions.query({name: 'geolocation'});
    permission.addEventListener('change', () => {
      if (permission.state === 'granted') refreshAutomaticDeviceLocation();
    });
  } catch {}
}

async function resolveDeviceLocation(fallback, {signal, strict = false} = {}) {
  try {
    const parameters = new URLSearchParams({
      latitude: fallback.latitude,
      longitude: fallback.longitude,
      timezone: fallback.timezone,
      language: settings.language
    });
    const response = await fetch(new URL(`reverse-location?${parameters}`, API_ROOT), {signal});
    const payload = await response.json();
    if (response.ok && payload.location) return payload.location;
    if (strict) throw new Error('Device location could not be resolved.');
    return fallback;
  } catch (error) {
    if (strict) throw error;
    return fallback;
  }
}

async function resolveForecastRouteLocation() {
  if (!FORECAST_ROUTE?.locationName || ROUTE_COORDINATES) return;
  if (!shouldUseRouteLocation({
    hasActiveLocation: settings.configured,
    embedded: IS_EMBEDDED,
    shared: QUERY.get('share') === '1'
  })) return;
  try {
    const parameters = new URLSearchParams({q: FORECAST_ROUTE.locationName, language: settings.language});
    const response = await fetch(new URL(`locations?${parameters}`, API_ROOT));
    const payload = await response.json();
    const routeLocation = response.ok ? payload.results?.[0] : null;
    if (!routeLocation) return;
    settings.location = routeLocation;
    settings.locations = withLocation(settings.locations, routeLocation);
    settings.configured = true;
    saveSettings();
    renderLocationMenu();
  } catch {}
}

async function initialize() {
  await resolveForecastRouteLocation();
  if (settings.configured || IS_DEMO || IS_EMBEDDED) {
    const unresolvedDeviceLocation = String(settings.location.id || '').startsWith('device-')
      && ['Current location', 'Bieżąca lokalizacja'].includes(settings.location.name);
    if (unresolvedDeviceLocation && !IS_DEMO && !IS_EMBEDDED) {
      const resolvedLocation = await resolveDeviceLocation(settings.location);
      settings.locations = replacingLocation(settings.locations, settings.location, resolvedLocation);
      settings.location = resolvedLocation;
      saveSettings();
      renderLocationMenu();
    }
    saveSettings();
    updateBrowserRoute();
    return loadWeather();
  }
  renderLocationLoading(t('status.waitingLocation'));
  try {
    const payload = await (async () => {
      try {
        const response = await fetch(new URL('bootstrap-location', API_ROOT));
        const payload = await response.json();
        return response.ok ? payload : null;
      } catch {
        return null;
      }
    })();
    if (settings.languageSource === 'fallback' && payload?.language) {
      settings.language = setLanguage(payload.language);
      settings.languageSource = 'country';
      document.getElementById('languageSelect').value = settings.language;
      document.getElementById('languageSetting').value = settings.language;
      applyTheme(settings.theme);
      drawLegendPreviews();
    }
    renderLocationLoading();
    const selectedLocation = payload?.location || DEFAULT_LOCATION;
    settings.location = selectedLocation;
    settings.locations = withLocation(settings.locations, selectedLocation);
    settings.configured = true;
    saveSettings();
    renderLocationMenu();
    updateBrowserRoute();
    await loadWeather();
  } finally {
    clearLocationLoading();
  }
}

initializeAnalytics(API_ROOT);
initialize().finally(() => {
  loadPromotion();
  monitorGeolocationPermission();
  setInterval(() => {
    if (!IS_DEMO && document.visibilityState === 'visible' && !document.body.classList.contains('location-loading')) loadWeather();
  }, WEATHER_REFRESH_INTERVAL_MS);
  setInterval(updateWeatherFreshnessWarning, 60 * 1000);
});

document.addEventListener('visibilitychange', () => {
  if (!IS_DEMO && weatherLoadedAt && document.visibilityState === 'visible' && !document.body.classList.contains('location-loading') && Date.now() - weatherLoadedAt >= WEATHER_REFRESH_INTERVAL_MS) loadWeather();
  updateWeatherFreshnessWarning();
});

if ('serviceWorker' in navigator) {
  const reloadOnUpdate = Boolean(navigator.serviceWorker.controller);
  let updateReloadStarted = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloadOnUpdate || updateReloadStarted) return;
    updateReloadStarted = true;
    location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', {updateViaCache: 'none'})
      .then(registration => registration.update())
      .catch(() => {});
  });
}
