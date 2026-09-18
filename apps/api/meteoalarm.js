const COUNTRY_FEED_SLUGS = Object.freeze({
  AD: 'andorra', AT: 'austria', BA: 'bosnia-herzegovina', BE: 'belgium', BG: 'bulgaria',
  CH: 'switzerland', CY: 'cyprus', CZ: 'czechia', DE: 'germany', DK: 'denmark', EE: 'estonia',
  ES: 'spain', FI: 'finland', FR: 'france', GB: 'united-kingdom', GR: 'greece', HR: 'croatia',
  HU: 'hungary', IE: 'ireland', IL: 'israel', IS: 'iceland', IT: 'italy', LT: 'lithuania',
  LU: 'luxembourg', LV: 'latvia', MD: 'moldova', ME: 'montenegro', MK: 'republic-of-north-macedonia',
  MT: 'malta', NL: 'netherlands', NO: 'norway', PL: 'poland', PT: 'portugal', RO: 'romania',
  RS: 'serbia', SE: 'sweden', SI: 'slovenia', SK: 'slovakia', UA: 'ukraine'
});

function decodeXml(value) {
  return String(value || '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&');
}

function tag(xml, name) {
  const match = String(xml || '').match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return match ? decodeXml(match[1].replace(/<[^>]+>/g, '').trim()) : null;
}

function link(xml, type) {
  for (const match of String(xml || '').matchAll(/<link\b([^>]*)\/?\s*>/gi)) {
    const attributes = match[1];
    const candidateType = attributes.match(/\btype="([^"]+)"/i)?.[1];
    const href = attributes.match(/\bhref="([^"]+)"/i)?.[1];
    if (href && (!type || candidateType === type)) return decodeXml(href);
  }
  return null;
}

export function meteoAlarmFeedUrl(countryCode) {
  const slug = COUNTRY_FEED_SLUGS[String(countryCode || '').toUpperCase()];
  return slug ? `https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-${slug}` : null;
}

export function parseMeteoAlarmFeed(xml) {
  return [...String(xml || '').matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map(match => {
    const entry = match[1];
    return {
      id: tag(entry, 'cap:identifier') || tag(entry, 'id'),
      area: tag(entry, 'cap:areaDesc'),
      event: tag(entry, 'cap:event'),
      onset: tag(entry, 'cap:onset'),
      expires: tag(entry, 'cap:expires'),
      severity: tag(entry, 'cap:severity'),
      status: tag(entry, 'cap:status'),
      scope: tag(entry, 'cap:scope'),
      capUrl: link(entry, 'application/cap+xml'),
      publicUrl: [...entry.matchAll(/<link\b([^>]*)\/?\s*>/gi)]
        .map(item => item[1])
        .find(attributes => /\btitle="[^"]+"/i.test(attributes) && !/\brel="related"/i.test(attributes))
        ?.match(/\bhref="([^"]+)"/i)?.[1] || null
    };
  }).filter(item => item.id && item.area && item.event && item.expires);
}

function normalized(value) {
  return String(value || '').normalize('NFKD').toLowerCase()
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function normalizedAdministrative(value) {
  const ignored = new Set([
    'city', 'county', 'district', 'gmina', 'municipality', 'powiat', 'province', 'region',
    'state', 'voivodeship', 'wojewodztwo'
  ]);
  return normalized(value).split(' ').filter(part => part && !ignored.has(part)).join(' ');
}

export function warningMatchesLocation(warning, location) {
  const area = normalizedAdministrative(warning?.area);
  if (!area) return false;
  const specificTerms = [location?.admin3, location?.admin2, location?.name]
    .map(normalizedAdministrative)
    .filter(term => term.length >= 4);
  const region = normalizedAdministrative(location?.admin1);
  if (specificTerms.length) return specificTerms.some(term => area.includes(term)) || (region.length >= 4 && area === region);
  if (region.length >= 4 && area.includes(region)) return true;
  const country = normalizedAdministrative(location?.country);
  return country.length >= 4 && area === country;
}

export function parseMeteoAlarmCap(xml, language = 'en-US') {
  const blocks = [...String(xml || '').matchAll(/<info>([\s\S]*?)<\/info>/gi)].map(match => match[1]);
  if (!blocks.length) return null;
  const requested = String(language || 'en').slice(0, 2).toLowerCase();
  const selected = blocks.find(block => String(tag(block, 'language')).toLowerCase().startsWith(requested))
    || blocks.find(block => String(tag(block, 'language')).toLowerCase().startsWith('en'))
    || blocks[0];
  const areaBlock = selected.match(/<area>([\s\S]*?)<\/area>/i)?.[1] || '';
  return {
    language: tag(selected, 'language'),
    event: tag(selected, 'event'),
    headline: tag(selected, 'headline'),
    description: tag(selected, 'description'),
    instruction: tag(selected, 'instruction'),
    senderName: tag(selected, 'senderName'),
    sourceUrl: tag(selected, 'web'),
    area: tag(areaBlock, 'areaDesc')
  };
}

export async function meteoAlarmWarnings(location, language, fetchText, now = new Date()) {
  const feedUrl = meteoAlarmFeedUrl(location?.countryCode);
  if (!feedUrl) return [];
  const feed = parseMeteoAlarmFeed(await fetchText(feedUrl));
  const active = feed.filter(item => {
    const expires = Date.parse(item.expires);
    return item.status === 'Actual' && item.scope === 'Public' && Number.isFinite(expires) && expires > now.getTime()
      && warningMatchesLocation(item, location);
  });
  const details = await Promise.all(active.slice(0, 3).map(async item => {
    const safeCapUrl = /^https:\/\/feeds\.meteoalarm\.org\//.test(item.capUrl || '') ? item.capUrl : null;
    const cap = safeCapUrl ? await fetchText(safeCapUrl).then(xml => parseMeteoAlarmCap(xml, language)).catch(() => null) : null;
    return {
      id: item.id,
      event: cap?.event || item.event,
      headline: cap?.headline || item.event,
      description: cap?.description || null,
      instruction: cap?.instruction || null,
      area: cap?.area || item.area,
      severity: String(item.severity || 'Moderate').toLowerCase(),
      onset: item.onset,
      expires: item.expires,
      source: cap?.senderName || 'MeteoAlarm',
      sourceUrl: cap?.sourceUrl || item.publicUrl || 'https://meteoalarm.org/'
    };
  }));
  const severity = {extreme: 3, severe: 2, moderate: 1, minor: 0};
  return details.sort((left, right) => (severity[right.severity] || 0) - (severity[left.severity] || 0));
}
