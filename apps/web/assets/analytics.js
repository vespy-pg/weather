'use strict';

const CONSENT_KEY = 'weather.analytics-consent.v1';
const ANALYTICS_HOSTS = new Set(['pogoda.vespy.eu', 'weather.vespy.eu']);
const pendingEvents = [];
let analyticsEnabled = false;
let googleTagLoaded = false;
let measurementId = null;

function consentValue() {
  try {
    return localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
}

function storeConsent(value) {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {}
}

function setGoogleConsent(value) {
  if (!window.gtag) return;
  const granted = value === 'granted' ? 'granted' : 'denied';
  window.gtag('consent', 'update', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: granted
  });
}

function loadGoogleTag() {
  if (googleTagLoaded || !measurementId) return;
  googleTagLoaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied'
  });
  setGoogleConsent('granted');
  window.gtag('js', new Date());
  window.gtag('config', measurementId);
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.append(script);
  pendingEvents.splice(0).forEach(([name, parameters]) => window.gtag('event', name, parameters));
}

function applyConsent(value) {
  analyticsEnabled = value === 'granted';
  storeConsent(value);
  if (analyticsEnabled) loadGoogleTag();
  else {
    pendingEvents.length = 0;
    setGoogleConsent('denied');
  }
}

function removeConsentPrompt() {
  document.getElementById('analyticsConsent')?.remove();
}

function showConsentPrompt() {
  removeConsentPrompt();
  const prompt = document.createElement('aside');
  prompt.id = 'analyticsConsent';
  prompt.className = 'analytics-consent';
  prompt.setAttribute('role', 'dialog');
  prompt.setAttribute('aria-labelledby', 'analyticsConsentTitle');
  prompt.innerHTML = `
    <div>
      <strong id="analyticsConsentTitle">Cookies consent</strong>
      <p>Analytics cookies help us understand which forecast features are useful. We do not send searched place names or coordinates.</p>
    </div>
    <div class="analytics-consent-actions">
      <button class="secondary-button" type="button" data-analytics-consent="denied">Decline</button>
      <button class="primary-button" type="button" data-analytics-consent="granted">Allow analytics cookies</button>
    </div>`;
  prompt.querySelectorAll('[data-analytics-consent]').forEach(button => button.addEventListener('click', () => {
    applyConsent(button.dataset.analyticsConsent);
    removeConsentPrompt();
  }));
  document.body.append(prompt);
}

function addPrivacyChoicesButton() {
  const footer = document.querySelector('.data-attribution');
  if (!footer || footer.querySelector('[data-analytics-choices]')) return;
  const separator = document.createTextNode(' · ');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'privacy-choices';
  button.dataset.analyticsChoices = '';
  button.textContent = 'Cookie choices';
  button.addEventListener('click', showConsentPrompt);
  footer.append(separator, button);
}

export function trackEvent(name, parameters = {}) {
  if (consentValue() === 'denied') return;
  if (!analyticsEnabled || !measurementId || !googleTagLoaded || !window.gtag) {
    pendingEvents.push([name, parameters]);
    return;
  }
  window.gtag('event', name, parameters);
}

export async function initializeAnalytics(apiRoot) {
  if (!ANALYTICS_HOSTS.has(location.hostname)) return;
  try {
    const response = await fetch(new URL('client-config', apiRoot));
    if (!response.ok) return;
    const config = await response.json();
    if (!/^G-[A-Z0-9]+$/.test(config.googleAnalyticsId || '')) return;
    measurementId = config.googleAnalyticsId;
    addPrivacyChoicesButton();
    const consent = consentValue();
    if (consent === 'granted') {
      analyticsEnabled = true;
      loadGoogleTag();
    } else if (consent !== 'denied') {
      showConsentPrompt();
    }
  } catch {}
}
