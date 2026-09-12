'use strict';

import {locale, t} from './i18n.js';
import {celsiusToDisplay, temperatureUnit} from './temperature-scale.js';

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function numericValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function temperature(value) {
  const parsed = numericValue(value);
  return parsed === null ? t('error.unavailable') : `${celsiusToDisplay(parsed).toFixed(1)}°${temperatureUnit()}`;
}

export function shortTemperature(value, digits = 0) {
  const parsed = numericValue(value);
  return parsed === null ? t('error.unavailable') : `${celsiusToDisplay(parsed).toFixed(digits)}°`;
}

export function measurement(value, suffix, digits = 0) {
  const parsed = numericValue(value);
  return parsed === null ? t('error.unavailable') : `${parsed.toFixed(digits)}${suffix}`;
}

export function formatTime(value) {
  if (!value) return t('error.unavailable');
  return new Intl.DateTimeFormat(locale(), {dateStyle: 'medium', timeStyle: 'short'}).format(new Date(value));
}

export function formatForecastDate(value, options) {
  if (!value) return t('error.unavailable');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return t('error.unavailable');
  return new Intl.DateTimeFormat(locale(), options).format(date);
}

function chartTooltipMarkup(title, rows) {
  return `<div class="chart-tooltip-title">${escapeHtml(title)}</div>${rows.map(row => `
    <div class="chart-tooltip-row">
      <span class="chart-tooltip-label"><i style="background:${row.color}"></i>${escapeHtml(row.label)}</span>
      <strong>${escapeHtml(row.value)}</strong>
    </div>`).join('')}`;
}

export function installChartTooltip(canvas, resolver) {
  canvas.chartTooltipResolver = resolver;
  if (canvas.dataset.tooltipReady) return;
  canvas.dataset.tooltipReady = 'true';
  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.hidden = true;
  document.body.appendChild(tooltip);

  let pinned = false;
  let touchGesture = null;
  const hide = () => {
    pinned = false;
    tooltip.hidden = true;
  };
  const show = (event, pin = false) => {
    const rect = canvas.getBoundingClientRect();
    const result = canvas.chartTooltipResolver?.(event.clientX - rect.left);
    if (!result) {
      hide();
      return;
    }
    tooltip.innerHTML = chartTooltipMarkup(result.title, result.rows);
    tooltip.hidden = false;
    pinned = pin;
    const spacing = 14;
    const left = Math.min(event.clientX + spacing, window.innerWidth - tooltip.offsetWidth - 8);
    const below = event.clientY + spacing;
    const top = below + tooltip.offsetHeight <= window.innerHeight
      ? below
      : Math.max(8, event.clientY - tooltip.offsetHeight - spacing);
    tooltip.style.left = `${Math.max(8, left)}px`;
    tooltip.style.top = `${top}px`;
  };
  canvas.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') return show(event);
    hide();
    touchGesture = {x: event.clientX, y: event.clientY, moved: false};
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerType !== 'touch') return show(event);
    if (!touchGesture) return;
    if (Math.hypot(event.clientX - touchGesture.x, event.clientY - touchGesture.y) > 8) {
      touchGesture.moved = true;
      hide();
    }
  });
  canvas.addEventListener('pointerup', event => {
    if (event.pointerType !== 'touch' || !touchGesture) return;
    if (!touchGesture.moved) show(event, true);
    touchGesture = null;
  });
  canvas.addEventListener('pointerleave', event => {
    if (event.pointerType !== 'touch' && !pinned) hide();
  });
  canvas.addEventListener('pointercancel', hide);
  canvas.closest('.forecast-timeline-scroll')?.addEventListener('scroll', hide, {passive: true});
  document.addEventListener('pointerdown', event => {
    if (pinned && event.target !== canvas) hide();
  }, {passive: true});
}
