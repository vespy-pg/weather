'use strict';

export function parseCoordinatePair(value) {
  const [latitude, longitude, ...rest] = String(value || '').split(',').map(Number);
  if (rest.length || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return {latitude, longitude};
}

export function locationSlug(name) {
  return String(name || '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'location';
}

export function parseForecastRoute(pathname, locales) {
  const parts = String(pathname || '').split('/').filter(Boolean);
  if (parts.length !== 2) return null;
  const language = locales.find(locale => locale.toLowerCase() === parts[0].toLowerCase());
  if (!language) return null;
  try {
    const locationName = decodeURIComponent(parts[1]).replaceAll('-', ' ').trim();
    return locationName ? {language, locationName} : null;
  } catch {
    return null;
  }
}

export function forecastRouteUrl(base, {language, location, query = {}}) {
  const url = new URL('/', base);
  url.pathname = `/${encodeURIComponent(language)}/${encodeURIComponent(locationSlug(location.name))}`;
  url.searchParams.set('ll', `${Number(location.latitude).toFixed(5)},${Number(location.longitude).toFixed(5)}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  return url;
}
