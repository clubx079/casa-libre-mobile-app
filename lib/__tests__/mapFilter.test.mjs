import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyFilters, inBounds, filterInBounds, splitNoCoords, sortByDistance, parseBoundsMsg, typeKey } from '../mapFilter.js';

const L = (id, lat, lng, extra = {}) => ({ id, lat, lng, usd: 150000, type: 'Casa', beds: 3, ...extra });
const B = { n: -25.2, s: -25.4, e: -57.5, w: -57.7 };

test('inBounds: inside, exact edges, outside, no coords', () => {
  assert.equal(inBounds(L('a', -25.3, -57.6), B), true);
  assert.equal(inBounds(L('n', -25.2, -57.6), B), true);
  assert.equal(inBounds(L('w', -25.3, -57.7), B), true);
  assert.equal(inBounds(L('o', -25.1, -57.6), B), false);
  assert.equal(inBounds(L('x', -25.3, -57.8), B), false);
  assert.equal(inBounds({ id: 'nc' }, B), false);
});

test('inBounds: antimeridian wrap (e < w)', () => {
  const W = { n: 10, s: -10, e: -170, w: 170 };
  assert.equal(inBounds(L('a', 0, 175), W), true);
  assert.equal(inBounds(L('b', 0, -175), W), true);
  assert.equal(inBounds(L('c', 0, 0), W), false);
});

test('filterInBounds: null bounds keeps only listings with coords', () => {
  const list = [L('a', -25.3, -57.6), { id: 'nc' }, L('far', -20, -50)];
  assert.deepEqual(filterInBounds(list, null).map((l) => l.id), ['a', 'far']);
  assert.deepEqual(filterInBounds(list, B).map((l) => l.id), ['a']);
});

test('splitNoCoords', () => {
  const r = splitNoCoords([L('a', 1, 1), { id: 'b', lat: null, lng: 2 }, { id: 'c' }]);
  assert.deepEqual(r.withCoords.map((l) => l.id), ['a']);
  assert.deepEqual(r.noCoords.map((l) => l.id), ['b', 'c']);
});

test('applyFilters: search is accent-insensitive; type/beds/rent price bands combine', () => {
  const list = [
    L('1', 0, 0, { neighborhood: 'Villa Morra', type: 'Departamento', beds: 2, usd: 700 }),
    L('2', 0, 0, { neighborhood: 'Asunción', type: 'Casa', beds: 3, usd: 900 }),
    L('3', 0, 0, { neighborhood: 'Asuncion', type: 'Casa', beds: 1, usd: 400 }),
  ];
  assert.deepEqual(applyFilters(list, { q: 'asuncion' }).map((l) => l.id), ['2', '3']);
  assert.deepEqual(applyFilters(list, { mode: 'alquiler', priceF: 'mid', typeF: 'casa', bedF: '2' }).map((l) => l.id), ['2']);
  assert.equal(typeKey('Dúplex'), 'duplex');
});

test('applyFilters: sale price bands + sort', () => {
  const list = [L('a', 0, 0, { usd: 250000 }), L('b', 0, 0, { usd: 90000 }), L('c', 0, 0, { usd: 150000 })];
  assert.deepEqual(applyFilters(list, { priceF: 'hi' }).map((l) => l.id), ['a']);
  assert.deepEqual(applyFilters(list, { sort: 'precio_asc' }).map((l) => l.id), ['b', 'c', 'a']);
});

test('applyFilters: near-me radius keeps nearest first and drops no-coords', () => {
  const me = { latitude: -25.3, longitude: -57.6 };
  const list = [L('far', -25.5, -57.6), L('mid', -25.33, -57.6), L('near', -25.301, -57.6), { id: 'nc' }];
  assert.deepEqual(applyFilters(list, { nearMe: true, userLoc: me, radiusKm: 10 }).map((l) => l.id), ['near', 'mid']);
});

test('sortByDistance', () => {
  const list = [L('c', 3, 0), L('a', 1, 0), L('b', 2, 0), { id: 'nc' }];
  assert.deepEqual(sortByDistance(list, 0, 0).map((l) => l.id), ['a', 'b', 'c']);
});

test('parseBoundsMsg', () => {
  assert.deepEqual(parseBoundsMsg('__bounds__:-25.2,-25.4,-57.5,-57.7,13.5'), { n: -25.2, s: -25.4, e: -57.5, w: -57.7, zoom: 13.5 });
  assert.equal(parseBoundsMsg('__bounds__:1,2,x,4,5'), null);
  assert.equal(parseBoundsMsg('abc'), null);
  assert.equal(parseBoundsMsg(null), null);
});
