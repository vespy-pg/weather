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

export function locationKey(item) {
  if (item?.id !== undefined && item?.id !== null) return String(item.id);
  return `${Number(item?.latitude).toFixed(4)}:${Number(item?.longitude).toFixed(4)}`;
}

export function sameLocation(first, second) {
  return locationKey(first) === locationKey(second);
}

export function withLocation(collection, item) {
  const index = collection.findIndex(location => sameLocation(location, item));
  if (index < 0) return [...collection, item];
  return collection.map((location, locationIndex) => locationIndex === index ? item : location);
}

export function replacingLocation(collection, current, replacement) {
  const currentIndex = collection.findIndex(item => sameLocation(item, current));
  const replacementIndex = collection.findIndex(item => sameLocation(item, replacement));
  if (currentIndex < 0) return withLocation(collection, replacement);
  return collection
    .map((item, index) => index === currentIndex ? replacement : item)
    .filter((item, index) => index === currentIndex || index !== replacementIndex);
}
