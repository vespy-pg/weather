import assert from 'node:assert/strict';
import test from 'node:test';

import {renderApi, renderWeb, validateCatalog} from './generate.mjs';

const manifest = {
  schemaVersion: 1,
  sourceLocale: 'en-US',
  fallbackLocale: 'en-US',
  aliases: {en: 'en-US', pl: 'pl-PL'},
  countryDefaults: {PL: 'pl-PL'},
  locales: [
    {tag: 'en-US', nativeName: 'English', direction: 'ltr', providerLanguage: 'en'},
    {tag: 'pl-PL', nativeName: 'Polski', direction: 'ltr', providerLanguage: 'pl'}
  ]
};

test('validates complete catalogs with matching placeholders', () => {
  assert.doesNotThrow(() => validateCatalog(manifest, {
    'en-US': {'app.welcome': 'Hello {name}'},
    'pl-PL': {'app.welcome': 'Cześć {name}'}
  }));
});

test('rejects missing messages and placeholder mismatches', () => {
  assert.throws(() => validateCatalog(manifest, {'en-US': {'app.welcome': 'Hello {name}'}, 'pl-PL': {}}), /missing keys/);
  assert.throws(() => validateCatalog(manifest, {
    'en-US': {'app.welcome': 'Hello {name}'},
    'pl-PL': {'app.welcome': 'Cześć {person}'}
  }), /different placeholders/);
});

test('generates platform-neutral web data and API locale configuration', () => {
  const catalogs = {'en-US': {'app.welcome': 'Hello'}, 'pl-PL': {'app.welcome': 'Cześć'}};
  assert.match(renderWeb(manifest, catalogs), /export const MESSAGES/);
  assert.match(renderApi(manifest), /PROVIDER_LANGUAGES/);
});
