import http from 'node:http';
import {mkdir, readFile, readdir, rm, stat, writeFile} from 'node:fs/promises';
import {randomUUID, timingSafeEqual} from 'node:crypto';
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
import {meteoAlarmWarnings} from './meteoalarm.js';

const PORT = Number(process.env.PORT || 8080);
const CACHE_TTL_MS = Number(process.env.WEATHER_CACHE_TTL_MS || 10 * 60 * 1000);
const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web');
const WEB_ORIGIN = 'https://weather.vespy.eu';
const MUSHROOM_OBSERVATION_DAYS = 30;
const MUSHROOM_OBSERVATION_RADIUS_KM = 30;
const cache = new Map();
const issueReportRateLimits = new Map();
const MAX_ISSUE_REPORT_BYTES = 24 * 1024 * 1024;
const MAX_ISSUE_ATTACHMENT_BYTES = 3 * 1024 * 1024;
const MAX_ISSUE_ATTACHMENTS = 64;
const DEFAULT_ISSUE_REPORT_RETENTION_DAYS = 30;
const ISSUE_REPORT_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

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

async function jsonRequestBody(request, maximumBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximumBytes) {
      const error = new Error('Request body is too large.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('Invalid JSON body.');
    error.statusCode = 400;
    throw error;
  }
}

async function requestBody(request, maximumBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximumBytes) {
      const error = new Error('Request body is too large.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function normalizeIssueReport(source) {
  const description = String(source?.description || '').trim();
  if (description.length < 10 || description.length > 4000) {
    const error = new Error('Description must contain between 10 and 4000 characters.');
    error.statusCode = 400;
    throw error;
  }
  const sourceAttachments = Array.isArray(source?.attachments) ? source.attachments : [];
  if (sourceAttachments.length > MAX_ISSUE_ATTACHMENTS) {
    const error = new Error('Too many attachments.');
    error.statusCode = 400;
    throw error;
  }
  let totalAttachmentBytes = 0;
  const attachments = sourceAttachments.map((attachment, index) => {
    const contentType = ['image/png', 'image/jpeg'].includes(attachment?.contentType) ? attachment.contentType : null;
    const encoded = String(attachment?.base64 || '');
    const bytes = /^[A-Za-z0-9+/]*={0,2}$/.test(encoded) ? Buffer.from(encoded, 'base64') : Buffer.alloc(0);
    if (!contentType || !bytes.length || bytes.length > MAX_ISSUE_ATTACHMENT_BYTES) {
      const error = new Error(`Attachment ${index + 1} is invalid.`);
      error.statusCode = 400;
      throw error;
    }
    totalAttachmentBytes += bytes.length;
    if (totalAttachmentBytes > 16 * 1024 * 1024) {
      const error = new Error('Attachments are too large.');
      error.statusCode = 400;
      throw error;
    }
    const extension = contentType === 'image/png' ? 'png' : 'jpg';
    const baseName = String(attachment?.name || `attachment-${index + 1}`)
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || `attachment-${index + 1}`;
    return {name: `${baseName}.${extension}`, contentType, bytes};
  });
  return {
    metadata: {
      schemaVersion: 1,
      description,
      submittedAt: new Date().toISOString(),
      clientSubmittedAt: typeof source?.submittedAt === 'string' ? source.submittedAt.slice(0, 40) : null,
      app: source?.app && typeof source.app === 'object' ? source.app : {},
      device: source?.device && typeof source.device === 'object' ? source.device : {},
      activeLocation: source?.activeLocation && typeof source.activeLocation === 'object' ? source.activeLocation : null,
      widgets: Array.isArray(source?.widgets) ? source.widgets.slice(0, 64) : [],
      attachments: attachments.map(({name, contentType, bytes}) => ({name, contentType, bytes: bytes.length}))
    },
    attachments
  };
}

function issueReportClientKey(request) {
  const forwarded = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || request.socket.remoteAddress || 'unknown';
}

function allowIssueReport(request, now = Date.now()) {
  const key = issueReportClientKey(request);
  const recent = (issueReportRateLimits.get(key) || []).filter(timestamp => now - timestamp < 60 * 60 * 1000);
  if (recent.length >= 5) return false;
  recent.push(now);
  issueReportRateLimits.set(key, recent);
  return true;
}

async function issueReport(request, response) {
  if (!allowIssueReport(request)) return json(response, 429, {error: 'Too many reports. Try again later.'});
  const source = await jsonRequestBody(request, MAX_ISSUE_REPORT_BYTES);
  const report = normalizeIssueReport(source);
  const reportId = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}`;
  const root = path.resolve(process.env.WEATHER_REPORT_DIRECTORY || '/tmp/weather-issue-reports');
  const reportDirectory = path.join(root, reportId);
  await mkdir(reportDirectory, {recursive: true, mode: 0o700});
  await Promise.all([
    writeFile(path.join(reportDirectory, 'report.json'), `${JSON.stringify({...report.metadata, reportId, status: 'new'}, null, 2)}\n`, {mode: 0o600}),
    ...report.attachments.map(attachment => writeFile(path.join(reportDirectory, attachment.name), attachment.bytes, {mode: 0o600}))
  ]);
  void notifyIssueReport(reportId, report.metadata).catch(error => console.error('Issue report notification failed:', error));
  return json(response, 201, {reportId});
}

function issueReportRoot() {
  return path.resolve(process.env.WEATHER_REPORT_DIRECTORY || '/tmp/weather-issue-reports');
}

function issueReportRetentionDays() {
  const configured = Number(process.env.WEATHER_REPORT_RETENTION_DAYS || DEFAULT_ISSUE_REPORT_RETENTION_DAYS);
  return Number.isInteger(configured) && configured >= 1 && configured <= 365
    ? configured
    : DEFAULT_ISSUE_REPORT_RETENTION_DAYS;
}

export async function purgeExpiredIssueReports({
  root = issueReportRoot(),
  retentionDays = issueReportRetentionDays(),
  now = Date.now()
} = {}) {
  await mkdir(root, {recursive: true, mode: 0o700});
  const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;
  const entries = await readdir(root, {withFileTypes: true});
  let deleted = 0;
  await Promise.all(entries.map(async entry => {
    if (!entry.isDirectory() || !issueReportId(entry.name)) return;
    const reportDirectory = path.join(root, entry.name);
    const report = await readFile(path.join(reportDirectory, 'report.json'), 'utf8')
      .then(JSON.parse)
      .catch(() => null);
    const submittedAt = Date.parse(report?.submittedAt || `${entry.name.slice(0, 10)}T00:00:00.000Z`);
    if (!Number.isFinite(submittedAt) || submittedAt > cutoff) return;
    await rm(reportDirectory, {recursive: true, force: true});
    deleted += 1;
  }));
  return deleted;
}

function startIssueReportCleanup() {
  const options = {root: issueReportRoot(), retentionDays: issueReportRetentionDays()};
  const cleanup = () => void purgeExpiredIssueReports(options)
    .then(deleted => {
      if (deleted) console.log(`Deleted ${deleted} expired issue report(s).`);
    })
    .catch(error => console.error('Issue report cleanup failed:', error));
  cleanup();
  const timer = setInterval(cleanup, ISSUE_REPORT_CLEANUP_INTERVAL_MS);
  timer.unref();
}

async function notifyIssueReport(reportId, metadata) {
  const notificationUrl = String(process.env.WEATHER_REPORT_NTFY_URL || '').trim();
  if (!notificationUrl) return;
  const parsedUrl = new URL(notificationUrl);
  if (parsedUrl.protocol !== 'https:') throw new Error('Notification URL must use HTTPS.');
  const adminOrigin = String(process.env.WEATHER_REPORT_ADMIN_ORIGIN || 'https://api.weather.vespy.eu').replace(/\/$/, '');
  const version = String(metadata.app?.versionName || 'unknown');
  const response = await fetch(parsedUrl, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      title: 'New Vespy Weather issue report',
      message: `Report ${reportId} from app version ${version}`,
      priority: 4,
      tags: ['bug'],
      click: `${adminOrigin}/admin/issues/${encodeURIComponent(reportId)}`
    })
  });
  if (!response.ok) throw new Error(`Notification provider returned ${response.status}`);
}

function secureEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function issueAdminAuthorized(request) {
  const expectedUser = process.env.WEATHER_REPORT_ADMIN_USER;
  const expectedPassword = process.env.WEATHER_REPORT_ADMIN_PASSWORD;
  if (!expectedUser || !expectedPassword) return false;
  const authorization = String(request.headers.authorization || '');
  if (!authorization.startsWith('Basic ')) return false;
  const decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
  const separator = decoded.indexOf(':');
  return separator >= 0
    && secureEqual(decoded.slice(0, separator), expectedUser)
    && secureEqual(decoded.slice(separator + 1), expectedPassword);
}

function requireIssueAdmin(request, response) {
  if (issueAdminAuthorized(request)) return true;
  response.writeHead(401, {
    'Cache-Control': 'no-store',
    'Content-Type': 'text/plain; charset=utf-8',
    'WWW-Authenticate': 'Basic realm="Vespy Weather reports", charset="UTF-8"',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end('Authentication required.');
  return false;
}

function issueReportId(value) {
  return /^\d{4}-\d{2}-\d{2}-[0-9a-f-]{36}$/i.test(String(value || '')) ? String(value) : null;
}

async function readStoredIssueReport(reportId) {
  const validId = issueReportId(reportId);
  if (!validId) return null;
  return JSON.parse(await readFile(path.join(issueReportRoot(), validId, 'report.json'), 'utf8'));
}

function adminHtml(title, content) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)}</title><style>
  :root{color-scheme:dark;font-family:ui-sans-serif,system-ui,sans-serif;background:#080c12;color:#e7edf7}body{margin:0}main{width:min(100% - 32px,1100px);margin:auto;padding:32px 0 64px}a{color:#79bbff}header{display:flex;align-items:center;justify-content:space-between;gap:16px}section,.report{background:#111923;border:1px solid #29384b;border-radius:12px;padding:16px;margin:12px 0}.report{display:grid;grid-template-columns:1fr auto;gap:8px 16px}.new{border-color:#58a6ff}.muted{color:#9aa8ba}.status{font-weight:700;text-transform:uppercase;font-size:12px}img{max-width:100%;height:auto;border-radius:8px;border:1px solid #29384b}pre{overflow:auto;white-space:pre-wrap;word-break:break-word;background:#080c12;padding:12px;border-radius:8px}button{background:#176fc1;color:#fff;border:0;border-radius:8px;padding:10px 14px;font-weight:700;cursor:pointer}form{display:inline-block;margin-right:8px}@media(max-width:600px){.report{grid-template-columns:1fr}}
  </style></head><body><main>${content}</main></body></html>`;
}

function html(response, status, body) {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    'Content-Type': 'text/html; charset=utf-8',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(body);
}

async function issueAdmin(request, requestUrl, response) {
  if (!requireIssueAdmin(request, response)) return;
  const parts = requestUrl.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (parts.length === 2) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return json(response, 405, {error: 'Method not allowed.'});
    await mkdir(issueReportRoot(), {recursive: true, mode: 0o700});
    const reports = (await readdir(issueReportRoot(), {withFileTypes: true}))
      .filter(entry => entry.isDirectory() && issueReportId(entry.name))
      .map(entry => entry.name)
      .sort().reverse();
    const loaded = (await Promise.all(reports.slice(0, 500).map(id => readStoredIssueReport(id).catch(() => null)))).filter(Boolean);
    const newCount = loaded.filter(report => report.status === 'new').length;
    const cards = loaded.map(report => `<a class="report ${report.status === 'new' ? 'new' : ''}" href="/admin/issues/${encodeURIComponent(report.reportId)}"><span><strong>${escapeHtml(report.description || 'No description')}</strong><br><span class="muted">${escapeHtml(report.submittedAt || '')} - ${escapeHtml(report.app?.versionName || 'unknown version')} - ${escapeHtml(report.device?.model || 'no diagnostics')}</span></span><span class="status">${escapeHtml(report.status || 'new')}</span></a>`).join('');
    return html(response, 200, adminHtml('Issue reports', `<header><div><h1>Issue reports</h1><p class="muted">${newCount} new - ${loaded.length} stored</p></div></header>${cards || '<section>No reports yet.</section>'}`));
  }
  const reportId = issueReportId(parts[2]);
  if (!reportId) return html(response, 404, adminHtml('Not found', '<h1>Report not found</h1>'));
  const reportPath = path.join(issueReportRoot(), reportId, 'report.json');
  const report = await readStoredIssueReport(reportId).catch(() => null);
  if (!report) return html(response, 404, adminHtml('Not found', '<h1>Report not found</h1>'));

  if (parts.length === 4 && parts[3] === 'status') {
    if (request.method !== 'POST') return json(response, 405, {error: 'Method not allowed.'});
    const form = new URLSearchParams(await requestBody(request, 10_000));
    const status = ['new', 'seen', 'resolved'].includes(form.get('status')) ? form.get('status') : null;
    if (!status) return json(response, 400, {error: 'Invalid status.'});
    await writeFile(reportPath, `${JSON.stringify({...report, status}, null, 2)}\n`, {mode: 0o600});
    response.writeHead(303, {Location: `/admin/issues/${encodeURIComponent(reportId)}`});
    return response.end();
  }

  if (parts.length === 5 && parts[3] === 'attachments') {
    if (request.method !== 'GET' && request.method !== 'HEAD') return json(response, 405, {error: 'Method not allowed.'});
    const attachment = report.attachments?.find(item => item.name === parts[4]);
    if (!attachment) return json(response, 404, {error: 'Attachment not found.'});
    const body = await readFile(path.join(issueReportRoot(), reportId, attachment.name));
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Length': body.length,
      'Content-Type': attachment.contentType,
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Content-Type-Options': 'nosniff'
    });
    return request.method === 'HEAD' ? response.end() : response.end(body);
  }

  if (parts.length !== 3 || (request.method !== 'GET' && request.method !== 'HEAD')) return json(response, 405, {error: 'Method not allowed.'});
  if (report.status === 'new') {
    report.status = 'seen';
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, {mode: 0o600});
  }
  const images = (report.attachments || []).map(attachment => `<section><h2>${escapeHtml(attachment.name)}</h2><a href="/admin/issues/${encodeURIComponent(reportId)}/attachments/${encodeURIComponent(attachment.name)}"><img src="/admin/issues/${encodeURIComponent(reportId)}/attachments/${encodeURIComponent(attachment.name)}" alt="${escapeHtml(attachment.name)}"></a></section>`).join('');
  const metadata = {...report};
  delete metadata.description;
  const content = `<header><div><a href="/admin/issues">Back to reports</a><h1>${escapeHtml(reportId)}</h1></div><span class="status">${escapeHtml(report.status)}</span></header><section><h2>Description</h2><p>${escapeHtml(report.description).replaceAll('\n', '<br>')}</p><form method="post" action="/admin/issues/${encodeURIComponent(reportId)}/status"><input type="hidden" name="status" value="resolved"><button>Mark resolved</button></form><form method="post" action="/admin/issues/${encodeURIComponent(reportId)}/status"><input type="hidden" name="status" value="new"><button>Mark new</button></form></section>${images}<section><h2>Diagnostics</h2><pre>${escapeHtml(JSON.stringify(metadata, null, 2))}</pre></section>`;
  return html(response, 200, adminHtml(`Issue ${reportId}`, content));
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

async function cachedFetchText(url) {
  const cacheKey = `text:${url}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const response = await fetch(url, {headers: {'User-Agent': 'weather/0.1 (https://weather.vespy.eu/)'}});
  if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
  const value = await response.text();
  cache.set(cacheKey, {expiresAt: Date.now() + CACHE_TTL_MS, value});
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

const POLLEN_FIELDS = ['alder_pollen', 'birch_pollen', 'grass_pollen', 'mugwort_pollen', 'olive_pollen', 'ragweed_pollen'];

export function dailyPollen(source, date) {
  const timestamps = source?.hourly?.time || [];
  const values = POLLEN_FIELDS.reduce((result, field) => {
    const readings = timestamps.flatMap((timestamp, index) => String(timestamp).startsWith(date) ? [at(source.hourly, field, index)] : [])
      .filter(value => value !== null && value !== undefined && value !== '')
      .map(Number)
      .filter(Number.isFinite);
    result[field.replace('_pollen', '')] = readings.length ? Number(Math.max(...readings).toFixed(1)) : null;
    return result;
  }, {});
  return Object.values(values).some(value => value !== null) ? values : null;
}

export function normalizeForecast(source, location, {pastDays = 0, pollenSource = null} = {}) {
  const allHourlyTimes = source.hourly?.time || [];
  const currentHour = String(source.current?.time || '').slice(0, 13);
  const matchingHourIndex = allHourlyTimes.findIndex(timestamp => String(timestamp).slice(0, 13) === currentHour);
  const currentHourIndex = matchingHourIndex < 0 ? 0 : matchingHourIndex;
  const historyDays = Math.max(0, Math.min(7, Math.trunc(Number(pastDays) || 0)));
  const hourlyStartIndex = Math.max(0, currentHourIndex - historyDays * 24);
  const hourlyTimes = allHourlyTimes.slice(hourlyStartIndex, currentHourIndex + 240);
  const allDailyTimes = source.daily?.time || [];
  const currentDate = String(source.current?.time || '').slice(0, 10);
  const matchingDayIndex = allDailyTimes.findIndex(date => String(date) >= currentDate);
  const currentDayIndex = matchingDayIndex < 0 ? 0 : matchingDayIndex;
  const dailyStartIndex = Math.max(0, currentDayIndex - historyDays);
  const dailyTimes = allDailyTimes.slice(dailyStartIndex, currentDayIndex + 15);
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
      pollen: dailyPollen(pollenSource, date),
      mushroom: mushroomCondition(source, sourceIndex)
    };
    }),
    location
  };
}

export function forecastUrl({latitude, longitude, timezone, includeMushrooms = false, pastDays = 0}) {
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
  const requestedPastDays = Math.max(includeMushrooms ? 7 : 0, Math.max(0, Math.min(7, Math.trunc(Number(pastDays) || 0))));
  if (requestedPastDays) parameters.set('past_days', String(requestedPastDays));
  return `https://api.open-meteo.com/v1/forecast?${parameters}`;
}

export function pollenForecastUrl({latitude, longitude, timezone}) {
  const parameters = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone: timezone || 'auto',
    forecast_days: '4',
    hourly: POLLEN_FIELDS.join(',')
  });
  return `https://air-quality-api.open-meteo.com/v1/air-quality?${parameters}`;
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

export function locationSearchUrl(query, language = DEFAULT_LOCALE, count = 8) {
  const providerLanguage = PROVIDER_LANGUAGES[normalizeLocale(language)] || PROVIDER_LANGUAGES[DEFAULT_LOCALE];
  const parameters = new URLSearchParams({name: query, count: String(Math.max(1, Math.min(100, count))), language: providerLanguage, format: 'json'});
  return `https://geocoding-api.open-meteo.com/v1/search?${parameters}`;
}

const SEARCH_TRANSLITERATIONS = [
  ['ae', 'æ'],
  ['d', 'đ'],
  ['d', 'ð'],
  ['h', 'ħ'],
  ['i', 'ı'],
  ['ij', 'ĳ'],
  ['k', 'ĸ'],
  ['l', 'ł'],
  ['n', 'ŋ'],
  ['o', 'ø'],
  ['oe', 'œ'],
  ['ss', 'ß'],
  ['t', 'ŧ'],
  ['th', 'þ']
];
const SEARCH_TRANSLITERATION_MAP = new Map(SEARCH_TRANSLITERATIONS.map(([ascii, letter]) => [letter, ascii]));

export function normalizedSearchText(value) {
  return Array.from(String(value || '').normalize('NFKD').toLowerCase())
    .filter(character => !/\p{M}/u.test(character))
    .map(character => SEARCH_TRANSLITERATION_MAP.get(character) || character)
    .join('');
}

export function locationSearchVariants(value, limit = 8) {
  const source = String(value || '').normalize('NFC').toLowerCase();
  const variants = [source];
  const seen = new Set(variants);
  for (const [ascii, letter] of SEARCH_TRANSLITERATIONS) {
    let position = source.indexOf(ascii);
    while (position >= 0 && variants.length < limit) {
      const candidate = `${source.slice(0, position)}${letter}${source.slice(position + ascii.length)}`;
      if (!seen.has(candidate)) {
        seen.add(candidate);
        variants.push(candidate);
      }
      position = source.indexOf(ascii, position + 1);
    }
  }
  return variants;
}

export function rankLocationCandidates(candidates, query) {
  const normalizedQuery = normalizedSearchText(query);
  return candidates
    .map((item, index) => ({item, index, normalizedName: normalizedSearchText(item.name)}))
    .filter(({normalizedName}) => normalizedName.startsWith(normalizedQuery))
    .sort((left, right) => {
      const exactDifference = Number(right.normalizedName === normalizedQuery) - Number(left.normalizedName === normalizedQuery);
      if (exactDifference) return exactDifference;
      const populationDifference = Number(right.item.population || 0) - Number(left.item.population || 0);
      return populationDifference || left.index - right.index;
    })
    .map(({item}) => item);
}

export function locationMatchesQualifiers(location, qualifiers) {
  const haystack = normalizedSearchText([
    location.name,
    location.admin1,
    location.admin2,
    location.admin3,
    location.country
  ].filter(Boolean).join(' '));
  return qualifiers.every(qualifier => haystack.includes(normalizedSearchText(qualifier)));
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
    countryCode: source['country abbreviation'] || null,
    admin1: item.state || null,
    admin2: null,
    admin3: null,
    postalCode: source['post code'] || null,
    latitude: Number(item.latitude),
    longitude: Number(item.longitude),
    timezone: 'auto'
  })).filter(item => item.name && Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
}

async function locations(requestUrl, response) {
  const query = requestUrl.searchParams.get('q')?.trim();
  if (!query || query.length < 2) return json(response, 400, {error: 'Enter at least two characters.'});
  const language = requestUrl.searchParams.get('language');
  const resultLimit = Math.max(1, Math.min(50, Number.parseInt(requestUrl.searchParams.get('limit') || '8', 10) || 8));
  const commaParts = query.split(',').map(value => value.trim()).filter(Boolean);
  const fetchLocations = async value => {
    const directResults = (await cachedFetch(locationSearchUrl(value, language, 100))).results || [];
    const variants = directResults.length < 100 ? locationSearchVariants(value).slice(1) : [];
    const variantResults = await Promise.all(variants.map(async variant => (
      (await cachedFetch(locationSearchUrl(variant, language, 100))).results || []
    )));
    const uniqueResults = [];
    const seenIds = new Set();
    for (const item of [directResults, ...variantResults].flat()) {
      const id = String(item.id ?? `${item.latitude}:${item.longitude}:${item.name}`);
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      uniqueResults.push(item);
    }
    return rankLocationCandidates(uniqueResults, value);
  };
  let providerResults;
  if (commaParts.length > 1) {
    providerResults = (await fetchLocations(commaParts[0])).filter(item => locationMatchesQualifiers(item, commaParts.slice(1)));
  } else {
    providerResults = await fetchLocations(query);
    const words = query.split(/\s+/).filter(Boolean);
    for (let split = words.length - 1; providerResults.length === 0 && split > 0; split -= 1) {
      const candidates = await fetchLocations(words.slice(0, split).join(' '));
      providerResults = candidates.filter(item => locationMatchesQualifiers(item, words.slice(split)));
    }
  }
  let results = providerResults.map(item => ({
    id: item.id,
    name: item.name,
    country: item.country,
    countryCode: item.country_code || null,
    admin1: item.admin1 || null,
    admin2: item.admin2 || null,
    admin3: item.admin3 || null,
    postalCode: item.postcodes?.[0] || null,
    latitude: item.latitude,
    longitude: item.longitude,
    timezone: item.timezone
  }));
  const postalUrl = results.length ? null : postalCodeSearchUrl(query, language);
  if (postalUrl) {
    try {
      results = normalizePostalLocations(await cachedFetch(postalUrl));
    } catch (error) {
      if (error.message !== 'Upstream returned 404') throw error;
    }
  }
  const hasMore = results.length > resultLimit;
  return json(response, 200, {results: results.slice(0, resultLimit), hasMore});
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
    countryCode,
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
    country: address.country || fallback.country || '',
    countryCode: String(address.country_code || fallback.countryCode || '').toUpperCase() || null,
    admin1: address.state || address.region || null,
    admin2: address.county || address.state_district || null,
    admin3: address.municipality || address.city_district || null,
    postalCode: address.postcode || null
  };
}

async function resolvedWeatherLocation(location, language) {
  if (location.countryCode && (location.admin2 || location.admin3)) return location;
  const providerLanguage = PROVIDER_LANGUAGES[normalizeLocale(language)] || PROVIDER_LANGUAGES[DEFAULT_LOCALE];
  const parameters = new URLSearchParams({
    format: 'jsonv2',
    lat: Number(location.latitude).toFixed(5),
    lon: Number(location.longitude).toFixed(5),
    zoom: '14',
    addressdetails: '1',
    'accept-language': providerLanguage
  });
  const source = await cachedFetch(`https://nominatim.openstreetmap.org/reverse?${parameters}`);
  const resolved = normalizeReverseLocation(source, location);
  return {...resolved, name: location.name, timezone: location.timezone};
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
  const language = normalizeLocale(requestUrl.searchParams.get('language'));
  const pastDays = Math.max(0, Math.min(3, Math.trunc(Number(requestUrl.searchParams.get('past_days')) || 0)));
  const location = {
    name,
    latitude,
    longitude,
    timezone,
    country: requestUrl.searchParams.get('country') || '',
    countryCode: requestUrl.searchParams.get('country_code')?.toUpperCase() || null,
    admin1: requestUrl.searchParams.get('admin1') || null,
    admin2: requestUrl.searchParams.get('admin2') || null,
    admin3: requestUrl.searchParams.get('admin3') || null
  };
  const [source, resolvedLocation, pollenSource] = await Promise.all([
    cachedFetch(forecastUrl({
    ...location,
    includeMushrooms: ['1', 'true'].includes(requestUrl.searchParams.get('mushrooms')),
    pastDays
    })),
    resolvedWeatherLocation(location, language).catch(() => location),
    cachedFetch(pollenForecastUrl(location)).catch(() => null)
  ]);
  const alerts = await meteoAlarmWarnings(resolvedLocation, language, cachedFetchText).catch(() => []);
  return json(response, 200, {...normalizeForecast(source, resolvedLocation, {pastDays, pollenSource}), alerts});
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
    response.writeHead(200, {
      'Cache-Control': staticCacheControl(requestUrl.pathname),
      'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream'
    });
    response.end(body);
  } catch {
    json(response, 404, {error: 'Not found.'});
  }
}

export function staticCacheControl(pathname) {
  return pathname === '/sw.js' ? 'no-store' : 'no-cache';
}

export function createServer() {
  return http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    try {
      if (request.method === 'OPTIONS') {
        response.writeHead(204, {
          'Access-Control-Allow-Origin': process.env.WEATHER_ALLOWED_ORIGIN || '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS'
        });
        return response.end();
      }
      if (requestUrl.pathname === '/admin/issues' || requestUrl.pathname.startsWith('/admin/issues/')) return await issueAdmin(request, requestUrl, response);
      if (request.method === 'POST' && requestUrl.pathname === '/issue-reports') return await issueReport(request, response);
      if (request.method !== 'GET' && request.method !== 'HEAD') return json(response, 405, {error: 'Method not allowed.'});
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
      if (error.statusCode) return json(response, error.statusCode, {error: error.message});
      return json(response, 502, {error: 'Weather provider is temporarily unavailable.'});
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startIssueReportCleanup();
  createServer().listen(PORT, () => console.log(`Weather is available at http://127.0.0.1:${PORT}`));
}
