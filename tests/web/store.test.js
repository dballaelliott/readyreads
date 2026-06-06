import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Cache, ageStr } from '../../docs/js/store.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

test('cache round-trips a result keyed by title|author', () => {
  const c = new Cache('chipublib', fakeStorage());
  const result = { title: 'Dune', author: 'Frank Herbert', overdriveId: '9',
    ebook: { status: 'available' }, audiobook: { status: 'not_found' }, goodreadsRating: 4.2 };
  c.set('Dune', 'Frank Herbert', result);

  const got = c.get('dune', 'FRANK HERBERT'); // case-insensitive key
  assert.equal(got.overdriveId, '9');
  assert.equal(got.ebook.status, 'available');
  assert.ok(got.updatedAt);
});

test('cache miss returns null', () => {
  const c = new Cache('chipublib', fakeStorage());
  assert.equal(c.get('nope', 'nobody'), null);
});

test('separate libraries do not collide', () => {
  const storage = fakeStorage();
  const a = new Cache('liba', storage);
  const b = new Cache('libb', storage);
  a.set('T', 'A', { title: 'T', author: 'A', overdriveId: '1' });
  assert.equal(b.get('T', 'A'), null);
});

test('ageStr renders human deltas', () => {
  const now = Date.parse('2026-06-01T12:00:00Z');
  assert.equal(ageStr(new Date(now - 30 * 1000).toISOString(), now), 'just now');
  assert.equal(ageStr(new Date(now - 5 * 60 * 1000).toISOString(), now), '5m ago');
  assert.equal(ageStr(new Date(now - 3 * 3600 * 1000).toISOString(), now), '3h ago');
  assert.equal(ageStr(new Date(now - 2 * 86400 * 1000).toISOString(), now), '2d ago');
});
