import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACTIVE_LOCATION_COOKIE,
  activeLocationCookie,
  activeLocationFromCookies,
  isLegacyPlaceholderLocation,
  normalizeStoredLocation,
  preferredActiveLocation,
  replacingLocation,
  sameLocation,
  uniqueLocations,
  withLocation
} from './location-state.js';

const warsaw = {id: 'warsaw', name: 'Warsaw'};
const berlin = {id: 'berlin', name: 'Berlin'};
const device = {id: 'device', name: 'Current location'};

const warsawLocation = {
  id: 'warsaw',
  name: 'Warsaw',
  country: 'Poland',
  latitude: 52.23,
  longitude: 21.01,
  timezone: 'Europe/Warsaw'
};

test('withLocation adds a new location without changing existing locations', () => {
  assert.deepEqual(withLocation([warsaw], berlin), [warsaw, berlin]);
});

test('locations with matching coordinates are not duplicated by route identifiers', () => {
  const routeWarsaw = {...warsawLocation, id: 'route-52.23000-21.01000'};
  assert.equal(sameLocation(warsawLocation, routeWarsaw), true);
  assert.deepEqual(withLocation([warsawLocation], routeWarsaw), [routeWarsaw]);
  assert.deepEqual(uniqueLocations([warsawLocation, routeWarsaw]), [routeWarsaw]);
});

test('replacingLocation replaces the active location instead of adding one', () => {
  assert.deepEqual(replacingLocation([warsaw, berlin], warsaw, device), [device, berlin]);
});

test('replacingLocation removes an existing duplicate after replacement', () => {
  assert.deepEqual(replacingLocation([device, warsaw, berlin], warsaw, device), [device, berlin]);
});

test('active location cookie preserves a valid location', () => {
  const serialized = activeLocationCookie(warsawLocation);
  assert.match(serialized, new RegExp(`^${ACTIVE_LOCATION_COOKIE}=`));
  assert.match(serialized, /Max-Age=31536000/);
  assert.match(serialized, /SameSite=Lax/);
  assert.match(serialized, /Secure/);
  assert.deepEqual(activeLocationFromCookies(`analytics=no; ${serialized}`), warsawLocation);
});

test('active location cookie supports local HTTP development', () => {
  assert.doesNotMatch(activeLocationCookie(warsawLocation, {secure: false}), /; Secure/);
});

test('invalid stored locations are rejected', () => {
  assert.equal(normalizeStoredLocation({name: 'Missing coordinates'}), null);
  assert.equal(activeLocationFromCookies(`${ACTIVE_LOCATION_COOKIE}=broken`), null);
});

test('cookie location takes precedence over a migrated local storage location', () => {
  const krakow = {...warsawLocation, id: 'krakow', name: 'Krakow', latitude: 50.06, longitude: 19.94};
  assert.deepEqual(preferredActiveLocation({
    cookieLocation: krakow,
    savedLocation: warsawLocation,
    savedConfigured: true
  }), krakow);
  assert.deepEqual(preferredActiveLocation({savedLocation: warsawLocation, savedConfigured: true}), warsawLocation);
  assert.equal(preferredActiveLocation({savedLocation: warsawLocation, savedConfigured: false}), null);
});

test('a deliberately selected former placeholder location remains active', () => {
  const kamienica = {name: 'Kamienica Polska', country: 'Poland', latitude: 50.6709, longitude: 19.12265};
  assert.equal(isLegacyPlaceholderLocation(kamienica, false), true);
  assert.equal(isLegacyPlaceholderLocation(kamienica, true), false);
});
