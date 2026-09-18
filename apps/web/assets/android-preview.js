import {drawForecastSky, drawWeatherChart, drawWindFlow} from './charts.js';
import {groupHourlyForecast, temperatureRange} from './forecast-view.js';
import {createWeatherDemo} from './weather-demo.js';

const previewParameters = new URLSearchParams(window.location.search);
document.documentElement.classList.toggle('capture', previewParameters.has('capture'));

const device = document.getElementById('device');
const forecastView = document.getElementById('forecastView');
const widgetView = document.getElementById('widgetView');
const skyCanvas = document.getElementById('appSkyCanvas');
const temperatureCanvas = document.getElementById('appTemperatureCanvas');
const windCanvas = document.getElementById('appWindCanvas');
const forecastTrack = document.getElementById('appForecastTrack');
const weather = createWeatherDemo(new Date(2026, 8, 12, 13));

function drawForecast() {
  const points = groupHourlyForecast(weather.hourly, 3);
  forecastTrack.style.width = `${Math.max(690, points.length * 41 + 34)}px`;
  const range = temperatureRange(points, true);
  const visualScale = device.classList.contains('landscape') ? 1 : .8;
  drawForecastSky(skyCanvas, points, weather.daily, {groupHours: 3, visualScale});
  drawWeatherChart(temperatureCanvas, points, weather.daily, {
    interactive: false,
    showApparentTemperature: true,
    temperatureRange: range,
    timeline: true,
    visualScale
  });
  drawWindFlow(windCanvas, points, {visualScale});
}

const promoCards = [...document.querySelectorAll('[data-promo]')];
const promoButtons = [...document.querySelectorAll('[data-promo-target]')];
let activePromo = 0;

function showPromo(index) {
  activePromo = index;
  promoCards.forEach((card, cardIndex) => card.classList.toggle('active', cardIndex === index));
  promoButtons.forEach((button, buttonIndex) => button.classList.toggle('active', buttonIndex === index));
}

promoButtons.forEach(button => button.addEventListener('click', () => showPromo(Number(button.dataset.promoTarget))));
window.setInterval(() => showPromo((activePromo + 1) % promoCards.length), 6000);

function activateButton(button) {
  button.parentElement.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
}

document.querySelectorAll('[data-screen]').forEach(button => button.addEventListener('click', () => {
  activateButton(button);
  const forecast = button.dataset.screen === 'forecast';
  forecastView.hidden = !forecast;
  widgetView.hidden = forecast;
  if (forecast) requestAnimationFrame(drawForecast);
}));

document.querySelectorAll('[data-orientation]').forEach(button => button.addEventListener('click', () => {
  activateButton(button);
  device.classList.toggle('portrait', button.dataset.orientation === 'portrait');
  device.classList.toggle('landscape', button.dataset.orientation === 'landscape');
  requestAnimationFrame(drawForecast);
}));

document.getElementById('favoriteLocationSelect').addEventListener('change', event => {
  document.getElementById('activeLocation').textContent = event.target.value;
});

document.querySelectorAll('.segmented').forEach(group => group.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (button) activateButton(button);
}));

function updateWidgetSummary() {
  const columns = Number(document.getElementById('configColumns').value);
  const rows = Number(document.getElementById('configRows').value);
  const hours = columns * 12;
  document.getElementById('widgetSizeSummary').textContent = `${columns} x ${rows} - ${hours} hours`;
  document.getElementById('forecastRange').textContent = `${hours} hours`;
  document.getElementById('verticalLayout').textContent = rows === 2
    ? 'Compact chart'
    : rows === 3
      ? 'Expanded chart'
      : rows === 4
        ? 'Maximum sky'
        : 'Chart grows only';
}

document.getElementById('configColumns').addEventListener('change', updateWidgetSummary);
document.getElementById('configRows').addEventListener('change', updateWidgetSummary);
window.addEventListener('resize', () => requestAnimationFrame(drawForecast));

if (previewParameters.get('orientation') === 'landscape') document.querySelector('[data-orientation="landscape"]').click();
if (previewParameters.get('screen') === 'widget') document.querySelector('[data-screen="widget"]').click();
requestAnimationFrame(drawForecast);
