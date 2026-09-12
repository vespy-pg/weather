'use strict';

import {
  DEFAULT_LOCALE,
  LANGUAGES,
  LANGUAGE_ALIASES,
  MESSAGES
} from './generated/i18n.js';

const LANGUAGE_BY_TAG = new Map(LANGUAGES.map(item => [item.tag.toLowerCase(), item]));
let activeLanguage = DEFAULT_LOCALE;

export function normalizeLanguage(language) {
  const requested = String(language || '').replaceAll('_', '-').toLowerCase();
  if (LANGUAGE_BY_TAG.has(requested)) return LANGUAGE_BY_TAG.get(requested).tag;
  const alias = LANGUAGE_ALIASES[requested] || LANGUAGE_ALIASES[requested.split('-')[0]];
  return alias && LANGUAGE_BY_TAG.has(alias.toLowerCase()) ? alias : DEFAULT_LOCALE;
}

export function preferredSupportedLanguage(preferences = []) {
  for (const preference of preferences) {
    const requested = String(preference || '').replaceAll('_', '-').toLowerCase();
    if (LANGUAGE_BY_TAG.has(requested) || LANGUAGE_ALIASES[requested] || LANGUAGE_ALIASES[requested.split('-')[0]]) {
      return normalizeLanguage(preference);
    }
  }
  return DEFAULT_LOCALE;
}

export function t(key, replacements = {}) {
  const template = MESSAGES[activeLanguage]?.[key] ?? MESSAGES[DEFAULT_LOCALE]?.[key] ?? key;
  return Object.entries(replacements).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, replacement), template);
}

export function setLanguage(language) {
  activeLanguage = normalizeLanguage(language);
  const languageConfig = LANGUAGE_BY_TAG.get(activeLanguage.toLowerCase());
  document.documentElement.lang = activeLanguage;
  document.documentElement.dir = languageConfig?.direction || 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => { element.placeholder = t(element.dataset.i18nPlaceholder); });
  return activeLanguage;
}

export function language() {
  return activeLanguage;
}

export function locale() {
  return activeLanguage;
}

export function supportedLanguages() {
  return LANGUAGES;
}
