'use strict';

export const ACTIVE_LOCATION_COOKIE = 'weather.active-location.v1';
const ACTIVE_LOCATION_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export function normalizeStoredLocation(item) {
  const latitude = Number(item?.latitude);
  const longitude = Number(item?.longitude);
  const name = String(item?.name || '').trim();
  if (!name || !Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return {
    ...(item?.id === undefined || item?.id === null ? {} : {id: String(item.id)}),
    name,
    country: String(item?.country || ''),
    latitude,
    longitude,
    timezone: String(item?.timezone || 'auto')
  };
}

export function activeLocationFromCookies(cookies) {
  const entry = String(cookies || '').split(';').map(item => item.trim()).find(item => item.startsWith(`${ACTIVE_LOCATION_COOKIE}=`));
  if (!entry) return null;
  try {
    return normalizeStoredLocation(JSON.parse(decodeURIComponent(entry.slice(ACTIVE_LOCATION_COOKIE.length + 1))));
  } catch {
    return null;
  }
}

export function activeLocationCookie(item, {secure = true} = {}) {
  const location = normalizeStoredLocation(item);
  if (!location) return null;
  const attributes = [`Max-Age=${ACTIVE_LOCATION_MAX_AGE_SECONDS}`, 'Path=/', 'SameSite=Lax'];
  if (secure) attributes.push('Secure');
  return `${ACTIVE_LOCATION_COOKIE}=${encodeURIComponent(JSON.stringify(location))}; ${attributes.join('; ')}`;
}

export function preferredActiveLocation({cookieLocation, savedLocation, savedConfigured = false} = {}) {
  return normalizeStoredLocation(cookieLocation)
    || (savedConfigured ? normalizeStoredLocation(savedLocation) : null);
}

export function isLegacyPlaceholderLocation(item, configured) {
  return configured !== true && (
    item?.name === 'Kamienica Polska'
    || (item?.name === 'Aurora Vale' && item?.country === 'Northland')
  );
}

export function locationKey(item) {
  if (item?.id !== undefined && item?.id !== null) return String(item.id);
  return `${Number(item?.latitude).toFixed(4)}:${Number(item?.longitude).toFixed(4)}`;
}

export function sameLocation(first, second) {
  const firstId = first?.id === undefined || first?.id === null ? null : String(first.id);
  const secondId = second?.id === undefined || second?.id === null ? null : String(second.id);
  if (firstId !== null && secondId !== null && firstId === secondId) return true;
  const coordinateKey = item => {
    const latitude = Number(item?.latitude);
    const longitude = Number(item?.longitude);
    return Number.isFinite(latitude) && Number.isFinite(longitude)
      ? `${latitude.toFixed(4)}:${longitude.toFixed(4)}`
      : null;
  };
  const firstCoordinates = coordinateKey(first);
  return firstCoordinates !== null && firstCoordinates === coordinateKey(second);
}

export function withLocation(collection, item) {
  const index = collection.findIndex(location => sameLocation(location, item));
  if (index < 0) return [...collection, item];
  return collection.map((location, locationIndex) => locationIndex === index ? item : location);
}

export function uniqueLocations(collection) {
  return collection.reduce((locations, item) => withLocation(locations, item), []);
}

export function replacingLocation(collection, current, replacement) {
  const currentIndex = collection.findIndex(item => sameLocation(item, current));
  const replacementIndex = collection.findIndex(item => sameLocation(item, replacement));
  if (currentIndex < 0) return withLocation(collection, replacement);
  return collection
    .map((item, index) => index === currentIndex ? replacement : item)
    .filter((item, index) => index === currentIndex || index !== replacementIndex);
}
