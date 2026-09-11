import {drawForecastSky, drawWeatherChart} from './charts.js';
import {createWeatherDemo} from './weather-demo.js';
import {escapeHtml, formatForecastDate, formatTime, measurement, numericValue, temperature} from './components.js';
import {setLanguage, t} from './i18n.js';

const SETTINGS_KEY = 'weather.settings.v1';
const ZOOM_LEVELS = [.5, .75, 1, 1.25, 1.5, 2];
const QUERY = new URLSearchParams(location.search);
const IS_GITHUB_PAGES = location.hostname.endsWith('.github.io');
const IS_DEMO = QUERY.get('demo') === '1' || IS_GITHUB_PAGES;
const IS_EMBEDDED = QUERY.get('embed') === '1';
const DEFAULT_SETTINGS = {
  location: {name: 'Aurora Vale', country: 'Northland', latitude: 46.81, longitude: 9.84, timezone: 'Europe/Zurich'},
  configured: false,
  zoom: 1,
  theme: 'dark',
  language: 'en',
  showHourlyTemperatures: true,
  showApparentTemperature: true,
  showPrecipitation: true,
  showWind: true
};

let settings = loadSettings();
let pendingLocation = settings.location;
let weather = null;
let zoomIndex = Math.max(0, ZOOM_LEVELS.indexOf(Number(settings.zoom)));

function loadSettings() {
  try {
    const stored = {...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')};
    if (stored.location?.name === 'Kamienica Polska') stored.location = {...DEFAULT_SETTINGS.location};
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
      stored.configured = true;
    }
    if (['dark', 'light'].includes(QUERY.get('theme'))) stored.theme = QUERY.get('theme');
    if (['en', 'pl'].includes(QUERY.get('lang'))) stored.language = QUERY.get('lang');
    return stored;
  } catch {
    return {...DEFAULT_SETTINGS};
  }
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
  const stops = lightMode ? [
    {speed: 0, color: [72, 87, 108]},
    {speed: 5, color: [28, 161, 96]},
    {speed: 15, color: [196, 134, 24]},
    {speed: 30, color: [222, 58, 72]}
  ] : [
    {speed: 0, color: [141, 152, 170]},
    {speed: 5, color: [75, 212, 139]},
    {speed: 15, color: [242, 189, 85]},
    {speed: 30, color: [255, 104, 104]}
  ];
  const upperIndex = stops.findIndex(stop => value <= stop.speed);
  const upper = stops[upperIndex < 0 ? stops.length - 1 : upperIndex];
  const lower = stops[Math.max(0, (upperIndex < 0 ? stops.length - 1 : upperIndex) - 1)];
  const progress = upper.speed === lower.speed ? 0 : Math.min(1, (value - lower.speed) / (upper.speed - lower.speed));
  const color = lower.color.map((channel, index) => Math.round(channel + (upper.color[index] - channel) * progress));
  const minimumOpacity = lightMode ? .22 : .12;
  return {color: `rgb(${color.join(', ')})`, opacity: minimumOpacity + Math.pow(Math.min(1, value / 30), 1.35) * (1 - minimumOpacity)};
}

function forecastBaseHourWidth() {
  return window.matchMedia('(max-width: 760px)').matches ? 22 : 18;
}

function applyZoom(nextIndex, preserveCenter = true) {
  const scroll = document.getElementById('forecastTimelineScroll');
  const timeline = document.getElementById('forecastTimeline');
  const center = preserveCenter && scroll.scrollWidth
    ? (scroll.scrollLeft + scroll.clientWidth / 2) / scroll.scrollWidth
    : 0;
  zoomIndex = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, nextIndex));
  const zoom = ZOOM_LEVELS[zoomIndex];
  timeline.style.setProperty('--forecast-hour-width', `${forecastBaseHourWidth() * zoom}px`);
  document.getElementById('forecastZoomReset').textContent = `${Math.round(zoom * 100)}%`;
  document.getElementById('forecastZoomOut').disabled = zoomIndex === 0;
  document.getElementById('forecastZoomIn').disabled = zoomIndex === ZOOM_LEVELS.length - 1;
  requestAnimationFrame(() => {
    if (preserveCenter) scroll.scrollLeft = Math.max(0, center * scroll.scrollWidth - scroll.clientWidth / 2);
    drawForecast();
  });
}

function renderWind(hourly) {
  const strip = document.getElementById('forecastWindStrip');
  const legend = document.getElementById('forecastWindLegend');
  strip.hidden = !settings.showWind;
  legend.hidden = !settings.showWind;
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

function drawForecast() {
  if (!weather?.available) return;
  const hourly = weather.hourly.slice(0, 240);
  const skyHourly = settings.showPrecipitation ? hourly : hourly.map(point => ({...point, precipitation: 0, precipitationProbability: 0, snowfall: 0}));
  drawForecastSky(document.getElementById('forecastWeatherCanvas'), skyHourly, weather.daily, {showHourlyTemperatures: settings.showHourlyTemperatures});
  drawWeatherChart(document.getElementById('forecastChart'), hourly, weather.daily, {timeline: true, showApparentTemperature: settings.showApparentTemperature});
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

  const hourly = weather.hourly.slice(0, 240);
  document.getElementById('forecastTimeline').style.setProperty('--forecast-hours', hourly.length);
  renderWind(hourly);
  document.querySelector('.forecast-chart-legend .precipitation').hidden = !settings.showPrecipitation;
  document.querySelector('.forecast-chart-legend .apparent-temperature').hidden = !settings.showApparentTemperature;
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
  document.getElementById('updatedAt').textContent = t('status.loading');
  try {
    if (IS_DEMO) {
      weather = createWeatherDemo();
      weather.location = {...settings.location, name: `${settings.location.name} - demo`};
      document.getElementById('forecastRangeLabel').textContent = t('forecast.demo');
    } else {
      const parameters = new URLSearchParams({
        latitude: settings.location.latitude,
        longitude: settings.location.longitude,
        timezone: settings.location.timezone || 'auto',
        name: settings.location.name
      });
      const response = await fetch(`/api/weather?${parameters}`);
      if (!response.ok) throw new Error((await response.json()).error || 'Forecast request failed.');
      weather = await response.json();
      document.getElementById('forecastRangeLabel').textContent = t('forecast.next');
    }
    renderForecast();
  } catch (error) {
    renderError(error.message);
  }
}

function fillSettingsForm() {
  pendingLocation = settings.location;
  document.getElementById('selectedLocation').textContent = `${pendingLocation.name}${pendingLocation.country ? `, ${pendingLocation.country}` : ''}`;
  document.getElementById('defaultZoom').value = String(settings.zoom);
  document.getElementById('colorTheme').value = settings.theme;
  document.getElementById('languageSetting').value = settings.language;
  document.getElementById('showHourlyTemperatures').checked = settings.showHourlyTemperatures;
  document.getElementById('showApparentTemperature').checked = settings.showApparentTemperature;
  document.getElementById('showPrecipitation').checked = settings.showPrecipitation;
  document.getElementById('showWind').checked = settings.showWind;
  document.getElementById('locationResults').innerHTML = '';
  document.getElementById('settingsError').textContent = '';
  document.getElementById('copyStatus').textContent = '';
  document.getElementById('embedCode').value = embedCode(pendingLocation, settings.theme, settings.language);
}

async function searchLocations() {
  const query = document.getElementById('locationQuery').value.trim();
  const resultsElement = document.getElementById('locationResults');
  if (query.length < 2) return document.getElementById('settingsError').textContent = t('error.shortQuery');
  resultsElement.textContent = t('status.searching');
  document.getElementById('settingsError').textContent = '';
  try {
    if (IS_GITHUB_PAGES) throw new Error(t('error.locationApi'));
    const response = await fetch(`/api/locations?q=${encodeURIComponent(query)}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error);
    resultsElement.innerHTML = payload.results.length ? payload.results.map((item, index) => `<button type="button" class="location-result" data-location-index="${index}"><strong>${escapeHtml(item.name)}</strong> - ${escapeHtml([item.admin1, item.country].filter(Boolean).join(', '))}</button>`).join('') : `<p class="muted">${t('error.noLocations')}</p>`;
    resultsElement.querySelectorAll('[data-location-index]').forEach(button => button.addEventListener('click', () => {
      pendingLocation = payload.results[Number(button.dataset.locationIndex)];
      document.getElementById('selectedLocation').textContent = `${pendingLocation.name}, ${pendingLocation.country}`;
      document.getElementById('embedCode').value = embedCode(pendingLocation, document.getElementById('colorTheme').value, document.getElementById('languageSetting').value);
    }));
  } catch (error) {
    resultsElement.innerHTML = '';
    document.getElementById('settingsError').textContent = error.message;
  }
}

document.getElementById('openSettings').addEventListener('click', () => {
  fillSettingsForm();
  document.getElementById('settingsDialog').showModal();
});
document.getElementById('themeToggle').addEventListener('click', () => {
  applyTheme(settings.theme === 'dark' ? 'light' : 'dark', true);
  drawForecast();
});
document.getElementById('languageSelect').addEventListener('change', event => {
  settings.language = setLanguage(event.target.value);
  saveSettings();
  applyTheme(settings.theme);
  renderForecast();
});
document.getElementById('colorTheme').addEventListener('change', event => {
  document.getElementById('embedCode').value = embedCode(pendingLocation, event.target.value, document.getElementById('languageSetting').value);
});
document.getElementById('languageSetting').addEventListener('change', event => {
  document.getElementById('embedCode').value = embedCode(pendingLocation, document.getElementById('colorTheme').value, event.target.value);
});
document.getElementById('copyEmbedCode').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(document.getElementById('embedCode').value);
    document.getElementById('copyStatus').textContent = t('status.copied');
  } catch {
    document.getElementById('embedCode').select();
    document.getElementById('copyStatus').textContent = t('status.copyManual');
  }
});
document.getElementById('searchLocation').addEventListener('click', searchLocations);
document.getElementById('locationQuery').addEventListener('keydown', event => {
  if (event.key === 'Enter') { event.preventDefault(); searchLocations(); }
});
document.getElementById('useDeviceLocation').addEventListener('click', () => {
  if (!navigator.geolocation) return document.getElementById('settingsError').textContent = t('error.geolocation');
  document.getElementById('settingsError').textContent = t('status.waitingLocation');
  navigator.geolocation.getCurrentPosition(position => {
    pendingLocation = {
      name: t('location.current'),
      country: '',
      latitude: Number(position.coords.latitude.toFixed(5)),
      longitude: Number(position.coords.longitude.toFixed(5)),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'auto'
    };
    document.getElementById('selectedLocation').textContent = `${pendingLocation.name} (${pendingLocation.latitude}, ${pendingLocation.longitude})`;
    document.getElementById('embedCode').value = embedCode(pendingLocation, document.getElementById('colorTheme').value, document.getElementById('languageSetting').value);
    document.getElementById('settingsError').textContent = '';
  }, error => { document.getElementById('settingsError').textContent = error.message; }, {enableHighAccuracy: false, timeout: 10000});
});
document.getElementById('settingsForm').addEventListener('submit', event => {
  event.preventDefault();
  if (event.submitter?.value === 'cancel') return document.getElementById('settingsDialog').close();
  settings = {
    location: pendingLocation,
    configured: true,
    zoom: Number(document.getElementById('defaultZoom').value),
    theme: document.getElementById('colorTheme').value,
    language: document.getElementById('languageSetting').value,
    showHourlyTemperatures: document.getElementById('showHourlyTemperatures').checked,
    showApparentTemperature: document.getElementById('showApparentTemperature').checked,
    showPrecipitation: document.getElementById('showPrecipitation').checked,
    showWind: document.getElementById('showWind').checked
  };
  saveSettings();
  settings.language = setLanguage(settings.language);
  document.getElementById('languageSelect').value = settings.language;
  applyTheme(settings.theme);
  zoomIndex = ZOOM_LEVELS.indexOf(settings.zoom);
  document.getElementById('settingsDialog').close();
  applyZoom(zoomIndex, false);
  loadWeather();
});

document.getElementById('forecastZoomOut').addEventListener('click', () => applyZoom(zoomIndex - 1));
document.getElementById('forecastZoomReset').addEventListener('click', () => applyZoom(ZOOM_LEVELS.indexOf(1)));
document.getElementById('forecastZoomIn').addEventListener('click', () => applyZoom(zoomIndex + 1));
document.getElementById('forecastTimelineScroll').addEventListener('wheel', event => {
  if (!event.ctrlKey) return;
  event.preventDefault();
  applyZoom(zoomIndex + (event.deltaY < 0 ? 1 : -1));
}, {passive: false});

window.addEventListener('resize', () => {
  document.getElementById('forecastTimeline').style.setProperty('--forecast-hour-width', `${forecastBaseHourWidth() * ZOOM_LEVELS[zoomIndex]}px`);
  drawForecast();
});

document.body.classList.toggle('embedded', IS_EMBEDDED);
settings.language = setLanguage(settings.language);
document.getElementById('languageSelect').value = settings.language;
applyTheme(settings.theme);
applyZoom(zoomIndex, false);
loadWeather();
if (!settings.configured && !IS_DEMO && !IS_EMBEDDED) {
  fillSettingsForm();
  document.getElementById('settingsDialog').showModal();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
