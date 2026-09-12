import {drawForecastSky, drawWeatherChart, drawWindFlow} from './charts.js';
import {groupHourlyForecast, temperatureRange} from './forecast-view.js';
import {createWeatherDemo} from './weather-demo.js';

const baseCanvas = document.getElementById('widgetCanvas');
const skyCanvas = document.getElementById('widgetSkyCanvas');
const temperatureCanvas = document.getElementById('widgetTemperatureCanvas');
const windCanvas = document.getElementById('widgetWindCanvas');
const widget = document.getElementById('weatherWidget');
const columnsControl = document.getElementById('widgetColumns');
const rowsControl = document.getElementById('widgetRows');
const gridValue = document.getElementById('widgetGridValue');
const sizeValue = document.getElementById('widgetSizeValue');
const forecastHoursValue = document.getElementById('forecastHoursValue');
const devicePreview = document.getElementById('devicePreview');
const weather = createWeatherDemo(new Date(2026, 8, 12, 13));

const CELL_WIDTH = 64;
const CELL_HEIGHT = 55;
const HEADER_HEIGHT = 20;
const MAX_SKY_HEIGHT = (CELL_HEIGHT * 4 - HEADER_HEIGHT) * .2;

const previewParameters = new URLSearchParams(window.location.search);
const requestedColumns = Number(previewParameters.get('columns'));
const requestedRows = Number(previewParameters.get('rows'));
if (requestedColumns >= 2 && requestedColumns <= 8) columnsControl.value = String(requestedColumns);
if (requestedRows >= 1 && requestedRows <= 8) rowsControl.value = String(requestedRows);
if (previewParameters.get('theme') === 'light') {
  document.documentElement.dataset.theme = 'light';
  devicePreview.classList.add('light');
  document.getElementById('toggleTheme').textContent = 'Dark background';
}

function themeColor(property, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(property).trim() || fallback;
}

function setLayerBounds(canvas, top, height) {
  canvas.style.top = `${top}px`;
  canvas.style.height = `${height}px`;
}

function drawBase(points) {
  const rect = baseCanvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 3);
  baseCanvas.width = Math.max(1, Math.round(rect.width * ratio));
  baseCanvas.height = Math.max(1, Math.round(rect.height * ratio));
  const context = baseCanvas.getContext('2d');
  context.scale(ratio, ratio);
  context.fillStyle = themeColor('--chart-surface', '#0c121b');
  context.fillRect(0, 0, rect.width, rect.height);

  const columnWidth = rect.width / points.length;
  points.forEach((point, index) => {
    if (index === 0) return;
    const date = String(point.timestamp).slice(0, 10);
    const previousDate = String(points[index - 1].timestamp).slice(0, 10);
    if (date === previousDate) return;
    const x = index * columnWidth;
    context.strokeStyle = themeColor('--chart-day-separator', 'rgba(205, 214, 225, .65)');
    context.lineWidth = 1.25;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, rect.height);
    context.stroke();
  });
}

function drawWidget() {
  const {width, height} = widget.getBoundingClientRect();
  const columns = Number(columnsControl.value);
  const forecastHours = columns * 12;
  const groupHours = 3;
  const points = groupHourlyForecast(weather.hourly.slice(0, forecastHours), groupHours);
  const contentHeight = height - HEADER_HEIGHT;
  const skyHeight = Math.min(MAX_SKY_HEIGHT, contentHeight * .2);
  const skyBottom = HEADER_HEIGHT + skyHeight;
  const windHeight = contentHeight * .1;
  const windTop = height - windHeight;
  const chartHeight = Math.max(1, windTop - skyBottom);
  const precipitationY = Math.min(
    HEADER_HEIGHT + skyHeight * .82,
    skyBottom - 7
  );
  const visualScale = .7;

  setLayerBounds(skyCanvas, 0, skyBottom);
  setLayerBounds(temperatureCanvas, skyBottom, chartHeight);
  setLayerBounds(windCanvas, windTop, windHeight);
  drawBase(points);

  drawForecastSky(skyCanvas, points, weather.daily, {
    fogRows: [
      HEADER_HEIGHT + skyHeight * .67,
      HEADER_HEIGHT + skyHeight * .8,
      HEADER_HEIGHT + skyHeight * .93
    ],
    groupHours,
    maximumWeatherDepth: skyHeight * .6,
    moonY: HEADER_HEIGHT + skyHeight * .52,
    precipitationY,
    rightPadding: 0,
    showDayLabels: false,
    showHours: false,
    showHourlyTemperatures: true,
    sunlightGlowDepth: skyHeight * .6,
    temperatureStep: 2,
    temperatureY: 10,
    visualScale,
    weatherLineY: HEADER_HEIGHT
  });

  drawWeatherChart(temperatureCanvas, points, weather.daily, {
    interactive: false,
    rightPadding: 0,
    showApparentTemperature: true,
    temperatureRange: temperatureRange(points, true),
    timeline: true,
    visualScale
  });

  drawWindFlow(windCanvas, points, {rightPadding: 0, visualScale});
}

function resizeWidget() {
  const columns = Number(columnsControl.value);
  const rows = Number(rowsControl.value);
  const width = columns * CELL_WIDTH;
  const height = rows * CELL_HEIGHT;
  widget.style.width = `${width}px`;
  widget.style.height = `${height}px`;
  gridValue.textContent = `${columns} x ${rows}`;
  sizeValue.textContent = `${width} x ${height} dp`;
  forecastHoursValue.textContent = String(columns * 12);
  requestAnimationFrame(drawWidget);
}

columnsControl.addEventListener('change', resizeWidget);
rowsControl.addEventListener('change', resizeWidget);
document.getElementById('toggleTheme').addEventListener('click', event => {
  const light = devicePreview.classList.toggle('light');
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  event.currentTarget.textContent = light ? 'Dark background' : 'Light background';
  requestAnimationFrame(drawWidget);
});
window.addEventListener('resize', drawWidget);
resizeWidget();
