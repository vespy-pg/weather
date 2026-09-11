'use strict';

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
  return parsed === null ? 'Unavailable' : `${parsed.toFixed(1)}°C`;
}

export function measurement(value, suffix, digits = 0) {
  const parsed = numericValue(value);
  return parsed === null ? 'Unavailable' : `${parsed.toFixed(digits)}${suffix}`;
}

export function formatTime(value) {
  if (!value) return 'No current measurement';
  return new Intl.DateTimeFormat('en-GB', {dateStyle: 'medium', timeStyle: 'short'}).format(new Date(value));
}

export function formatForecastDate(value, options) {
  if (!value) return 'Unavailable';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Unavailable';
  return new Intl.DateTimeFormat('en-GB', options).format(date);
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

  const hide = () => { tooltip.hidden = true; };
  const show = event => {
    const rect = canvas.getBoundingClientRect();
    const result = canvas.chartTooltipResolver?.(event.clientX - rect.left);
    if (!result) {
      hide();
      return;
    }
    tooltip.innerHTML = chartTooltipMarkup(result.title, result.rows);
    tooltip.hidden = false;
    const spacing = 14;
    const left = Math.min(event.clientX + spacing, window.innerWidth - tooltip.offsetWidth - 8);
    const below = event.clientY + spacing;
    const top = below + tooltip.offsetHeight <= window.innerHeight
      ? below
      : Math.max(8, event.clientY - tooltip.offsetHeight - spacing);
    tooltip.style.left = `${Math.max(8, left)}px`;
    tooltip.style.top = `${top}px`;
  };
  canvas.addEventListener('pointermove', show);
  canvas.addEventListener('pointerdown', show);
  canvas.addEventListener('pointerleave', hide);
  canvas.addEventListener('pointercancel', hide);
}
