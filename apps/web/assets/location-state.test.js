import assert from 'node:assert/strict';
import test from 'node:test';

import {replacingLocation, withLocation} from './location-state.js';

const warsaw = {id: 'warsaw', name: 'Warsaw'};
const berlin = {id: 'berlin', name: 'Berlin'};
const device = {id: 'device', name: 'Current location'};

test('withLocation adds a new location without changing existing locations', () => {
  assert.deepEqual(withLocation([warsaw], berlin), [warsaw, berlin]);
});

test('replacingLocation replaces the active location instead of adding one', () => {
  assert.deepEqual(replacingLocation([warsaw, berlin], warsaw, device), [device, berlin]);
});

test('replacingLocation removes an existing duplicate after replacement', () => {
  assert.deepEqual(replacingLocation([device, warsaw, berlin], warsaw, device), [device, berlin]);
});
