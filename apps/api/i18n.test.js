import assert from 'node:assert/strict';
import test from 'node:test';

import {locationSearchUrl, normalizeLocale, preferredLanguageForCountry} from './server.js';

test('location search accepts canonical locale tags and legacy aliases', () => {
  const url = new URL(locationSearchUrl('00-001', 'pl-PL'));
  assert.equal(url.searchParams.get('name'), '00-001');
  assert.equal(url.searchParams.get('language'), 'pl');
  assert.equal(normalizeLocale('pl'), 'pl-PL');
  assert.equal(normalizeLocale('en_GB'), 'en-US');
});

test('country defaults use the shared locale configuration', () => {
  assert.equal(preferredLanguageForCountry('pl'), 'pl-PL');
  assert.equal(preferredLanguageForCountry('DE'), 'en-US');
});
