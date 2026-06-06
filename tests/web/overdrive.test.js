import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchItem, parseAvailability, searchBook } from '../../docs/js/overdrive.js';
import { AVAILABLE, WAITLIST, NOT_FOUND } from '../../docs/js/sort.js';

test('matchItem finds a title+author match', () => {
  const items = [
    { id: '1', title: 'Some Other Book', firstCreatorName: 'Nobody' },
    { id: '2', title: 'Dune', firstCreatorName: 'Frank Herbert' },
  ];
  assert.equal(matchItem(items, 'Dune', 'Frank Herbert').id, '2');
});

test('matchItem falls back to first result, null when empty', () => {
  const items = [{ id: '9', title: 'Zzz', firstCreatorName: 'Qqq' }];
  assert.equal(matchItem(items, 'Totally Different', 'Other Person').id, '9');
  assert.equal(matchItem([], 'x', 'y'), null);
});

test('parseAvailability maps available/waitlist/not-found', () => {
  assert.equal(parseAvailability(null).status, NOT_FOUND);
  assert.equal(
    parseAvailability({ isAvailable: true, availableCopies: 3, ownedCopies: 5 }).status,
    AVAILABLE);
  const w = parseAvailability({ isAvailable: false, ownedCopies: 5, holdsCount: 10, estimatedWaitDays: 21 });
  assert.equal(w.status, WAITLIST);
  assert.equal(w.waitDays, 21);
  assert.equal(parseAvailability({ ownedCopies: 0 }).status, NOT_FOUND);
});

// Live integration test against the real OverDrive API (CORS-open, no key needed).
test('searchBook hits the real API and returns availability shape', async () => {
  const r = await searchBook('chipublib', 'Dune', 'Frank Herbert');
  assert.ok(r.overdriveId, 'should find a match id');
  assert.ok([AVAILABLE, WAITLIST, NOT_FOUND].includes(r.ebook.status));
  assert.ok([AVAILABLE, WAITLIST, NOT_FOUND].includes(r.audiobook.status));
  assert.equal(typeof r.title, 'string');
});
