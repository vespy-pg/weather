import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '../../..');
const PACKAGE_ROOT = path.join(REPOSITORY_ROOT, 'packages/i18n');
const WEB_OUTPUT = path.join(REPOSITORY_ROOT, 'apps/web/assets/generated/i18n.js');
const API_OUTPUT = path.join(REPOSITORY_ROOT, 'apps/api/generated/i18n-config.js');

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

function placeholders(message) {
  return [...message.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\s*(?:[,}])/g)].map(match => match[1]).sort();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function validateCatalog(manifest, catalogs) {
  assert(manifest.schemaVersion === 1, 'Unsupported localization schema version.');
  assert(Array.isArray(manifest.locales) && manifest.locales.length > 0, 'At least one locale is required.');
  const tags = manifest.locales.map(locale => locale.tag);
  assert(new Set(tags).size === tags.length, 'Locale tags must be unique.');
  assert(tags.includes(manifest.sourceLocale), 'The source locale must be registered.');
  assert(tags.includes(manifest.fallbackLocale), 'The fallback locale must be registered.');

  manifest.locales.forEach(locale => {
    assert(new Intl.Locale(locale.tag).toString() === locale.tag, `Locale tag ${locale.tag} is not canonical BCP 47.`);
    assert(['ltr', 'rtl'].includes(locale.direction), `Locale ${locale.tag} has an invalid text direction.`);
    assert(typeof locale.nativeName === 'string' && locale.nativeName.trim(), `Locale ${locale.tag} needs a native name.`);
    assert(typeof locale.providerLanguage === 'string' && locale.providerLanguage.trim(), `Locale ${locale.tag} needs a provider language.`);
  });

  Object.entries(manifest.aliases || {}).forEach(([alias, locale]) => {
    assert(tags.includes(locale), `Alias ${alias} points to unsupported locale ${locale}.`);
  });
  Object.entries(manifest.countryDefaults || {}).forEach(([country, locale]) => {
    assert(/^[A-Z]{2}$/.test(country), `Country code ${country} must be ISO 3166-1 alpha-2.`);
    assert(tags.includes(locale), `Country ${country} points to unsupported locale ${locale}.`);
  });

  const source = catalogs[manifest.sourceLocale];
  assert(source && typeof source === 'object' && !Array.isArray(source), 'The source catalog is missing.');
  const sourceKeys = Object.keys(source).sort();
  assert(sourceKeys.length > 0, 'The source catalog is empty.');
  sourceKeys.forEach(key => assert(/^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/.test(key), `Message key ${key} is invalid.`));

  tags.forEach(tag => {
    const catalog = catalogs[tag];
    assert(catalog && typeof catalog === 'object' && !Array.isArray(catalog), `Locale catalog ${tag} is missing.`);
    const keys = Object.keys(catalog).sort();
    const missing = sourceKeys.filter(key => !(key in catalog));
    const extra = keys.filter(key => !(key in source));
    assert(!missing.length, `Locale ${tag} is missing keys: ${missing.join(', ')}.`);
    assert(!extra.length, `Locale ${tag} has unknown keys: ${extra.join(', ')}.`);
    sourceKeys.forEach(key => {
      assert(typeof catalog[key] === 'string' && catalog[key].length > 0, `Locale ${tag} has an empty message for ${key}.`);
      assert(JSON.stringify(placeholders(catalog[key])) === JSON.stringify(placeholders(source[key])), `Locale ${tag} has different placeholders for ${key}.`);
    });
  });
}

function generatedHeader() {
  return '// Generated from packages/i18n. Do not edit manually.\n';
}

export function renderWeb(manifest, catalogs) {
  const publicLanguages = manifest.locales.map(({tag, nativeName, direction}) => ({tag, nativeName, direction}));
  return `${generatedHeader()}export const DEFAULT_LOCALE = ${JSON.stringify(manifest.fallbackLocale)};\nexport const MESSAGES = Object.freeze(${JSON.stringify(catalogs, null, 2)});\nexport const LANGUAGES = Object.freeze(${JSON.stringify(publicLanguages, null, 2)});\nexport const LANGUAGE_ALIASES = Object.freeze(${JSON.stringify(manifest.aliases, null, 2)});\nexport const COUNTRY_LANGUAGE = Object.freeze(${JSON.stringify(manifest.countryDefaults, null, 2)});\n`;
}

export function renderApi(manifest) {
  const providers = Object.fromEntries(manifest.locales.map(locale => [locale.tag, locale.providerLanguage]));
  return `${generatedHeader()}export const DEFAULT_LOCALE = ${JSON.stringify(manifest.fallbackLocale)};\nexport const SUPPORTED_LOCALES = Object.freeze(${JSON.stringify(manifest.locales.map(locale => locale.tag))});\nexport const LANGUAGE_ALIASES = Object.freeze(${JSON.stringify(manifest.aliases, null, 2)});\nexport const COUNTRY_LANGUAGE = Object.freeze(${JSON.stringify(manifest.countryDefaults, null, 2)});\nexport const PROVIDER_LANGUAGES = Object.freeze(${JSON.stringify(providers, null, 2)});\n`;
}

async function expectedOutputs() {
  const manifest = await readJson(path.join(PACKAGE_ROOT, 'languages.json'));
  const catalogs = Object.fromEntries(await Promise.all(manifest.locales.map(async locale => [
    locale.tag,
    await readJson(path.join(PACKAGE_ROOT, `locales/${locale.tag}.json`))
  ])));
  validateCatalog(manifest, catalogs);
  return new Map([
    [WEB_OUTPUT, renderWeb(manifest, catalogs)],
    [API_OUTPUT, renderApi(manifest)]
  ]);
}

export async function generate({check = false} = {}) {
  const outputs = await expectedOutputs();
  for (const [file, content] of outputs) {
    if (check) {
      const existing = await readFile(file, 'utf8').catch(() => '');
      assert(existing === content, `${path.relative(REPOSITORY_ROOT, file)} is stale. Run npm run i18n:generate.`);
    } else {
      await writeFile(file, content);
    }
  }
}

if (process.argv[1] === SCRIPT_PATH) {
  generate({check: process.argv.includes('--check')}).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
