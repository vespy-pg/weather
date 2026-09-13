import {drawForecastSky, drawWeatherChart, drawWindFlow, setTemperatureColorThresholds} from './charts.js';
import {initializeAnalytics, trackEvent} from './analytics.js';
import {createWeatherDemo} from './weather-demo.js';
import {escapeHtml, formatForecastDate, formatTime, measurement, numericValue, shortTemperature, temperature} from './components.js';
import {groupHourlyForecast, hoursPerGroup, temperatureRange} from './forecast-view.js';
import {normalizeLanguage, preferredSupportedLanguage, setLanguage, supportedLanguages, t} from './i18n.js';
import {replacingLocation, sameLocation, withLocation} from './location-state.js';
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
const DEFAULT_ZOOM = .5;
const LAYOUT_VERSION = 3;
const ZOOM_LEVELS = [.25, .375, .5, .75, 1, 1.25, 1.5, 2];
const QUERY = new URLSearchParams(location.search);
const IS_GITHUB_PAGES = location.hostname.endsWith('.github.io');
const IS_DEMO = QUERY.get('demo') === '1' || IS_GITHUB_PAGES;
const IS_EMBEDDED = QUERY.get('embed') === '1';
const API_ROOT = ['localhost', '127.0.0.1'].includes(location.hostname)
  ? new URL('./', location.href)
  : new URL('https://api.weather.vespy.eu/');
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
  showWindArrows: false
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
let zoomIndex = Math.max(0, ZOOM_LEVELS.indexOf(Number(settings.zoom)));
let forecastDrawFrame = 0;
let locationSearchTimer = 0;
let locationSearchRequest = 0;
let promotionRequest = 0;
const promotionImpressions = new Set();
let forecastWelcomeDisplayed = false;

function safePromotionUrl(value, {asset = false} = {}) {
  try {
    const url = new URL(String(value || ''), location.href);
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
    const eyebrow = document.createElement('span');
    eyebrow.className = 'web-promotion-label';
    eyebrow.textContent = String(campaign.eyebrow || 'VESPY');
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
    const stored = {...DEFAULT_SETTINGS, ...saved};
    if (saved.layoutVersion !== LAYOUT_VERSION) {
      stored.zoom = DEFAULT_ZOOM;
      stored.layoutVersion = LAYOUT_VERSION;
    }
    const legacyPlaceholder = stored.location?.name === 'Kamienica Polska'
      || (stored.location?.name === 'Aurora Vale' && stored.location?.country === 'Northland');
    if (legacyPlaceholder) {
      stored.location = {...DEFAULT_LOCATION};
      stored.locations = [{...DEFAULT_LOCATION}];
      stored.configured = false;
    }
    stored.locations = Array.isArray(saved.locations) && saved.locations.length ? saved.locations : [stored.location];
    if (!stored.locations.some(item => sameLocation(item, stored.location))) stored.locations.push(stored.location);
    const latitude = Number(QUERY.get('lat'));
    const longitude = Number(QUERY.get('lon'));
    if (QUERY.has('lat') && QUERY.has('lon') && Number.isFinite(latitude) && Number.isFinite(longitude)) {
      stored.location = {
        name: QUERY.get('name') || 'Embedded location',
        country: '',
        latitude,
        longitude,
        timezone: QUERY.get('timezone') || 'auto'
      };
      stored.locations = [stored.location];
      stored.configured = true;
    }
    if (['dark', 'light'].includes(QUERY.get('theme'))) stored.theme = QUERY.get('theme');
    if (QUERY.has('lang')) {
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
    stored.temperatureThresholds = normalizeTemperatureThresholds(stored.temperatureThresholds);
    if (ZOOM_LEVELS.includes(Number(QUERY.get('zoom')))) stored.zoom = Number(QUERY.get('zoom'));
    return stored;
  } catch {
    return {...DEFAULT_SETTINGS, location: {...DEFAULT_LOCATION}, locations: [{...DEFAULT_LOCATION}]};
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
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('embed', '1');
  url.searchParams.set('lat', locationOverride.latitude);
  url.searchParams.set('lon', locationOverride.longitude);
  url.searchParams.set('name', locationOverride.name);
  url.searchParams.set('timezone', locationOverride.timezone || 'auto');
  url.searchParams.set('theme', theme);
  url.searchParams.set('lang', languageOverride);
  url.searchParams.set('unit', settings.temperatureUnit);
  url.searchParams.set('zoom', settings.zoom);
  if (IS_DEMO) url.searchParams.set('demo', '1');
  return `<iframe src="${url}" title="${t('embed.title')}" width="100%" height="680" loading="lazy" style="border:0;border-radius:12px" allow="geolocation"></iframe>`;
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

function applyZoom(nextIndex, preserveCenter = true) {
  const scroll = document.getElementById('forecastTimelineScroll');
  const timeline = document.getElementById('forecastTimeline');
  const center = preserveCenter && scroll.scrollWidth
    ? (scroll.scrollLeft + scroll.clientWidth / 2) / scroll.scrollWidth
    : 0;
  zoomIndex = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, nextIndex));
  const zoom = ZOOM_LEVELS[zoomIndex];
  const groupHours = hoursPerGroup(zoom);
  const visualScale = zoomVisualScale(zoom);
  timeline.style.setProperty('--forecast-slot-width', `${forecastBaseHourWidth() * zoom * groupHours}px`);
  timeline.style.setProperty('--forecast-wind-height', `${46 * visualScale}px`);
  timeline.style.setProperty('--forecast-wind-arrow-row', `${24 * visualScale}px`);
  timeline.style.setProperty('--forecast-wind-speed-row', `${11 * visualScale}px`);
  timeline.style.setProperty('--forecast-wind-arrow-size', `${19 * visualScale}px`);
  timeline.style.setProperty('--forecast-wind-arrow-line', `${22 * visualScale}px`);
  timeline.style.setProperty('--forecast-wind-speed-size', `${8 * visualScale}px`);
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

function drawLegendPreviews() {
  document.querySelector('[data-i18n="legend.temperatureText"]').textContent = t('legend.temperatureText', {
    deepFrost: temperature(settings.temperatureThresholds.deepFrost),
    freezing: temperature(0),
    mild: temperature(settings.temperatureThresholds.mild),
    warm: temperature(settings.temperatureThresholds.warm),
    hot: temperature(settings.temperatureThresholds.hot)
  });
  drawWeatherChart(document.getElementById('legendTemperatureCanvas'), LEGEND_TEMPERATURE_POINTS, [], {timeline: true, showApparentTemperature: false, interactive: false});
  drawWeatherChart(document.getElementById('legendFeelsCanvas'), LEGEND_FEELS_POINTS, [], {timeline: true, showApparentTemperature: true, apparentAreaOpacity: .46, interactive: false});
  drawForecastSky(document.getElementById('legendSkyCanvas'), LEGEND_SKY_POINTS, LEGEND_SKY_DAYS, {showHourlyTemperatures: false});
  drawWindFlow(document.getElementById('legendWindCanvas'), LEGEND_WIND_POINTS);
}

function firstSentences(key, count) {
  const sentences = t(key).match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  return sentences.slice(0, count).join(' ').trim();
}

function selectedSentences(value, start, count) {
  const sentences = value.split('. ');
  const selected = sentences.slice(start, start + count).join('. ').trim();
  return selected && !/[.!?]$/.test(selected) ? `${selected}.` : selected;
}

function drawForecastWelcome() {
  document.getElementById('welcomeSkyText').textContent = firstSentences('legend.skyText', 2);
  const temperatureLegend = t('legend.temperatureText', {
    deepFrost: temperature(settings.temperatureThresholds.deepFrost),
    freezing: temperature(0),
    mild: temperature(settings.temperatureThresholds.mild),
    warm: temperature(settings.temperatureThresholds.warm),
    hot: temperature(settings.temperatureThresholds.hot)
  });
  document.getElementById('welcomeTemperatureText').textContent = selectedSentences(temperatureLegend, 2, 3);
  document.getElementById('welcomeWindText').textContent = firstSentences('legend.windText', 3);
  drawForecastSky(document.getElementById('welcomeSkyCanvas'), LEGEND_SKY_POINTS, LEGEND_SKY_DAYS, {showHourlyTemperatures: false});
  drawWeatherChart(document.getElementById('welcomeTemperatureCanvas'), LEGEND_TEMPERATURE_POINTS, [], {timeline: true, showApparentTemperature: false, interactive: false});
  drawWindFlow(document.getElementById('welcomeWindCanvas'), LEGEND_WIND_POINTS);
}

function showForecastWelcomeOnce() {
  if (IS_EMBEDDED || forecastWelcomeDisplayed) return;
  try {
    if (localStorage.getItem(FORECAST_WELCOME_KEY) === 'complete') return;
  } catch {}
  forecastWelcomeDisplayed = true;
  const dialog = document.getElementById('forecastWelcome');
  dialog.showModal();
  requestAnimationFrame(drawForecastWelcome);
  trackEvent('forecast_guide_shown');
}

function drawForecast() {
  if (!weather?.available) return;
  const hourly = weather.hourly.slice(0, 240);
  const zoom = ZOOM_LEVELS[zoomIndex];
  const groupHours = hoursPerGroup(zoom);
  const displayedHourly = groupHourlyForecast(hourly, groupHours);
  const visualScale = zoomVisualScale(zoom);
  const skyHourly = settings.showPrecipitation ? displayedHourly : displayedHourly.map(point => ({...point, precipitation: 0, precipitationProbability: 0, snowfall: 0}));
  const range = temperatureRange(displayedHourly, settings.showApparentTemperature);
  const timeline = document.getElementById('forecastTimeline');
  timeline.style.setProperty('--forecast-slots', displayedHourly.length);
  updateTemperatureAxis(range);
  renderDayDividers(displayedHourly);
  const windVisual = document.getElementById('forecastWindVisual');
  windVisual.hidden = !settings.showWind;
  drawForecastSky(document.getElementById('forecastWeatherCanvas'), skyHourly, weather.daily, {showHourlyTemperatures: settings.showHourlyTemperatures, visualScale, groupHours});
  drawWeatherChart(document.getElementById('forecastChart'), displayedHourly, weather.daily, {timeline: true, showApparentTemperature: settings.showApparentTemperature, visualScale, temperatureRange: range});
  if (settings.showWind) drawWindFlow(document.getElementById('forecastWindCanvas'), displayedHourly, {visualScale});
  renderWind(displayedHourly);
}

function renderForecast() {
  const current = weather?.current;
  if (!weather?.available || !current) return;
  const condition = weatherPresentation(current.weatherCode);
  document.getElementById('forecastRangeLabel').textContent = t(IS_DEMO ? 'forecast.demo' : 'forecast.next');
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

  document.getElementById('dailyForecast').innerHTML = weather.daily.slice(0, 10).map(day => {
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

async function loadWeather() {
  const requestId = ++weatherRequest;
  const requestedLocation = {...settings.location};
  document.getElementById('locationTitle').textContent = requestedLocation.name;
  document.getElementById('updatedAt').textContent = t('status.loading');
  document.querySelector('.forecast-panel').setAttribute('aria-busy', 'true');
  try {
    let nextWeather;
    if (IS_DEMO) {
      nextWeather = createWeatherDemo();
      nextWeather.location = {...requestedLocation, name: `${requestedLocation.name} - demo`};
      document.getElementById('forecastRangeLabel').textContent = t('forecast.demo');
    } else {
      const parameters = new URLSearchParams({
        latitude: requestedLocation.latitude,
        longitude: requestedLocation.longitude,
        timezone: requestedLocation.timezone || 'auto',
        name: requestedLocation.name
      });
      const response = await fetch(new URL(`weather?${parameters}`, API_ROOT));
      if (!response.ok) throw new Error((await response.json()).error || 'Forecast request failed.');
      nextWeather = await response.json();
      document.getElementById('forecastRangeLabel').textContent = t('forecast.next');
    }
    if (requestId !== weatherRequest) return;
    weather = nextWeather;
    renderForecast();
    showForecastWelcomeOnce();
    trackEvent('forecast_loaded', {forecast_mode: IS_DEMO ? 'demo' : 'live', embedded: IS_EMBEDDED});
  } catch (error) {
    if (requestId !== weatherRequest) return;
    renderError(error.message);
  } finally {
    if (requestId === weatherRequest) document.querySelector('.forecast-panel').removeAttribute('aria-busy');
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
    layoutVersion: LAYOUT_VERSION
  };
}

function saveFormChanges({reloadWeather = false} = {}) {
  const previousLanguage = settings.language;
  const previousTheme = settings.theme;
  const previousUnit = settings.temperatureUnit;
  settings = settingsFromForm();
  settings.language = setLanguage(settings.language);
  applyTemperatureSettings();
  saveSettings();
  document.getElementById('languageSelect').value = settings.language;
  applyTheme(settings.theme);
  zoomIndex = ZOOM_LEVELS.indexOf(settings.zoom);
  renderLocationMenu();
  updateEmbedPreview();
  if (previousLanguage !== settings.language) fillSettingsForm();
  else if (previousUnit !== settings.temperatureUnit) renderTemperatureScale();
  applyZoom(zoomIndex, false);
  drawLegendPreviews();
  if (weather) renderForecast();
  if (previousLanguage !== settings.language || previousTheme !== settings.theme) loadPromotion();
  if (reloadWeather) loadWeather();
}

function renderPendingLocations() {
  document.getElementById('selectedLocation').textContent = `${t('settings.activeLocation')}: ${locationLabel(pendingLocation)}`;
  const container = document.getElementById('savedLocations');
  container.innerHTML = pendingLocations.map((item, index) => `<div class="saved-location">
    <button type="button" class="saved-location-select" data-saved-location="${index}" aria-pressed="${sameLocation(item, pendingLocation)}">${escapeHtml(locationLabel(item))}</button>
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
  } finally {
    if (requestId === locationSearchRequest && document.getElementById('locationQuery').value.trim() === query) {
      document.getElementById('locationQuery').value = '';
    }
  }
}

document.getElementById('openSettings').addEventListener('click', openSettingsDialog);
document.getElementById('settingsButton').addEventListener('click', openSettingsDialog);
document.getElementById('editLocation').addEventListener('click', () => {
  if (settings.locations.length === 1) return openSettingsDialog();
  const menu = document.getElementById('locationMenu');
  const opening = menu.hidden;
  menu.hidden = !opening;
  document.getElementById('editLocation').setAttribute('aria-expanded', String(opening));
  if (opening) renderLocationMenu();
});
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
  document.getElementById('languageSetting').value = settings.language;
  applyTheme(settings.theme);
  renderForecast();
  drawLegendPreviews();
  loadPromotion();
  trackEvent('display_preference_changed', {preference: 'language', value: settings.language});
});
document.getElementById('settingsForm').addEventListener('change', event => {
  if (event.target.matches('[data-temperature-threshold]')) return;
  saveFormChanges();
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
    drawForecast();
    drawLegendPreviews();
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
  if (!navigator.geolocation) return document.getElementById('settingsError').textContent = t('error.geolocation');
  const button = event.currentTarget;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  document.getElementById('settingsError').textContent = t('status.waitingLocation');
  navigator.geolocation.getCurrentPosition(async position => {
    try {
      const deviceLocation = await locationFromPosition(position);
      pendingLocations = replacingLocation(pendingLocations, pendingLocation, deviceLocation);
      pendingLocation = deviceLocation;
      document.getElementById('locationQuery').value = '';
      renderPendingLocations();
      saveFormChanges({reloadWeather: true});
      document.getElementById('settingsError').textContent = '';
      document.getElementById('settingsDialog').close();
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }, error => {
    document.getElementById('settingsError').textContent = error.message;
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }, {enableHighAccuracy: false, timeout: 10000});
});
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
  applyZoom(zoomIndex - 1);
  trackEvent('display_preference_changed', {preference: 'timeline_zoom', value: ZOOM_LEVELS[zoomIndex]});
});
document.getElementById('forecastZoomReset').addEventListener('click', () => {
  applyZoom(ZOOM_LEVELS.indexOf(DEFAULT_ZOOM));
  trackEvent('display_preference_changed', {preference: 'timeline_zoom', value: ZOOM_LEVELS[zoomIndex]});
});
document.getElementById('forecastZoomIn').addEventListener('click', () => {
  applyZoom(zoomIndex + 1);
  trackEvent('display_preference_changed', {preference: 'timeline_zoom', value: ZOOM_LEVELS[zoomIndex]});
});
document.getElementById('forecastTimelineScroll').addEventListener('wheel', event => {
  if (!event.ctrlKey) return;
  event.preventDefault();
  applyZoom(zoomIndex + (event.deltaY < 0 ? 1 : -1));
}, {passive: false});

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => applyZoom(zoomIndex), 80);
});

document.body.classList.toggle('embedded', IS_EMBEDDED);
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

async function locationFromPosition(position) {
  const fallback = {
    id: `device-${position.coords.latitude.toFixed(4)}-${position.coords.longitude.toFixed(4)}`,
    name: t('location.current'),
    country: '',
    latitude: Number(position.coords.latitude.toFixed(5)),
    longitude: Number(position.coords.longitude.toFixed(5)),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'auto'
  };
  return resolveDeviceLocation(fallback);
}

async function resolveDeviceLocation(fallback) {
  try {
    const parameters = new URLSearchParams({
      latitude: fallback.latitude,
      longitude: fallback.longitude,
      timezone: fallback.timezone,
      language: settings.language
    });
    const response = await fetch(new URL(`reverse-location?${parameters}`, API_ROOT));
    const payload = await response.json();
    return response.ok && payload.location ? payload.location : fallback;
  } catch {
    return fallback;
  }
}

async function initialize() {
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
    return loadWeather();
  }
  document.getElementById('updatedAt').textContent = t('status.waitingLocation');
  const bootstrapRequest = (async () => {
    try {
      const response = await fetch(new URL('bootstrap-location', API_ROOT));
      const payload = await response.json();
      return response.ok ? payload : null;
    } catch {
      return null;
    }
  })();
  const [position, payload] = await Promise.all([devicePosition(), bootstrapRequest]);
  if (settings.languageSource === 'fallback' && payload?.language) {
    settings.language = setLanguage(payload.language);
    settings.languageSource = 'country';
    document.getElementById('languageSelect').value = settings.language;
    document.getElementById('languageSetting').value = settings.language;
    applyTheme(settings.theme);
    drawLegendPreviews();
  }
  const selectedLocation = position
    ? await locationFromPosition(position)
    : payload?.location || settings.location;
  settings.location = selectedLocation;
  settings.locations = [selectedLocation];
  settings.configured = true;
  saveSettings();
  renderLocationMenu();
  await loadWeather();
}

initializeAnalytics(API_ROOT);
initialize().finally(loadPromotion);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
