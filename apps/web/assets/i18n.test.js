import assert from 'node:assert/strict';
import test from 'node:test';

import {normalizeLanguage, preferredSupportedLanguage, supportedLanguages} from './i18n.js';

test('normalizes exact locales and legacy base-language values', () => {
  assert.equal(normalizeLanguage('pl-PL'), 'pl-PL');
  assert.equal(normalizeLanguage('pl'), 'pl-PL');
  assert.equal(normalizeLanguage('en_GB'), 'en-US');
  assert.equal(normalizeLanguage('unknown'), 'en-US');
});

test('selects the first supported browser language', () => {
  assert.equal(preferredSupportedLanguage(['de-DE', 'pl-PL', 'en-US']), 'pl-PL');
  assert.equal(preferredSupportedLanguage(['de-DE']), 'en-US');
  assert.deepEqual(supportedLanguages().map(item => item.tag), ['en-US', 'pl-PL']);
});
