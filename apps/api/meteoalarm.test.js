import assert from 'node:assert/strict';
import test from 'node:test';
import {meteoAlarmFeedUrl, meteoAlarmWarnings, parseMeteoAlarmCap, parseMeteoAlarmFeed, warningMatchesLocation} from './meteoalarm.js';

const feed = `<?xml version="1.0"?><feed><entry>
  <cap:areaDesc>Śląskie Province Mysłowice County</cap:areaDesc><cap:event>Yellow Freezing rain warning</cap:event>
  <cap:onset>2026-09-18T10:00:00Z</cap:onset><cap:expires>2026-09-19T10:00:00Z</cap:expires>
  <cap:severity>Moderate</cap:severity><cap:status>Actual</cap:status><cap:scope>Public</cap:scope>
  <cap:identifier>alert-1</cap:identifier><link type="application/cap+xml" href="https://feeds.meteoalarm.org/api/v1/warnings/alert-1"/>
</entry></feed>`;

const cap = `<alert><info><language>pl-PL</language><event>Żółty alert na marznące opady</event>
  <headline>Uwaga na marznący deszcz</headline><description>Drogi mogą być śliskie.</description>
  <instruction>Zachowaj ostrożność.</instruction><senderName>IMGW-PIB</senderName><web>https://meteo.imgw.pl/</web>
  <area><areaDesc>województwo śląskie powiat Mysłowice</areaDesc></area></info>
  <info><language>en-GB</language><event>Freezing rain</event><headline>Freezing rain warning</headline></info></alert>`;

test('maps supported countries to maintained Atom feeds', () => {
  assert.equal(meteoAlarmFeedUrl('PL'), 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-poland');
  assert.equal(meteoAlarmFeedUrl('US'), null);
});

test('parses Atom entries and matches a specific administrative area', () => {
  const warning = parseMeteoAlarmFeed(feed)[0];
  assert.equal(warning.id, 'alert-1');
  assert.equal(warningMatchesLocation(warning, {name: 'Mysłowice', admin2: 'Mysłowice', admin1: 'Śląskie'}), true);
  assert.equal(warningMatchesLocation({...warning, area: 'Śląskie Province Myszkowski County'}, {name: 'Jastrząb', admin2: 'powiat myszkowski', admin1: 'województwo śląskie'}), true);
  assert.equal(warningMatchesLocation(warning, {name: 'Katowice', admin2: 'Katowice', admin1: 'Śląskie'}), false);
  assert.equal(warningMatchesLocation(warning, {name: 'Poznań', admin2: 'Poznań', admin1: 'Wielkopolskie'}), false);
});

test('selects localized CAP details and returns current warnings', async () => {
  assert.equal(parseMeteoAlarmCap(cap, 'pl-PL').headline, 'Uwaga na marznący deszcz');
  const fetchText = async url => url.includes('legacy-atom') ? feed : cap;
  const warnings = await meteoAlarmWarnings(
    {countryCode: 'PL', name: 'Mysłowice', admin2: 'Mysłowice', admin1: 'Śląskie'},
    'pl-PL',
    fetchText,
    new Date('2026-09-18T12:00:00Z')
  );
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].headline, 'Uwaga na marznący deszcz');
  assert.equal(warnings[0].source, 'IMGW-PIB');
});
