import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AVAILABLE, WAITLIST, NOT_FOUND,
  availabilityTier, sortResults, libbyUrl, searchUrl,
} from '../../docs/js/sort.js';

const fmt = (status, waitDays = null) => ({ status, waitDays });
const res = (title, { ebook = null, audio = null, rating = null } = {}) => ({
  title, author: 'A', ebook, audiobook: audio, goodreadsRating: rating, overdriveId: '1',
});

test('tier: ebook-available=0, audio-only=1, waitlist=2, unmatched=3', () => {
  assert.equal(availabilityTier(res('x', { ebook: fmt(AVAILABLE) })), 0);
  assert.equal(availabilityTier(res('x', { ebook: fmt(NOT_FOUND), audio: fmt(AVAILABLE) })), 1);
  assert.equal(availabilityTier(res('x', { ebook: fmt(WAITLIST, 10) })), 2);
  assert.equal(availabilityTier(res('x', { ebook: fmt(NOT_FOUND), audio: fmt(NOT_FOUND) })), 3);
});

test('lexicographic order: tier, then ebook wait, then rating desc', () => {
  const ebookAvail = res('EbookAvail', { ebook: fmt(AVAILABLE), rating: 3.0 });
  const audioOnly = res('AudioOnly', { ebook: fmt(NOT_FOUND), audio: fmt(AVAILABLE), rating: 5.0 });
  const shortWait = res('ShortWait', { ebook: fmt(WAITLIST, 7), rating: 2.0 });
  const longWait = res('LongWait', { ebook: fmt(WAITLIST, 60), rating: 5.0 });
  const unmatched = res('Unmatched', { ebook: fmt(NOT_FOUND), audio: fmt(NOT_FOUND), rating: 5.0 });

  const ordered = sortResults([longWait, unmatched, audioOnly, shortWait, ebookAvail]);
  assert.deepEqual(ordered.map(r => r.title),
    ['EbookAvail', 'AudioOnly', 'ShortWait', 'LongWait', 'Unmatched']);
});

test('within tier, higher rating first when wait ties', () => {
  const low = res('Low', { ebook: fmt(AVAILABLE), rating: 3.5 });
  const high = res('High', { ebook: fmt(AVAILABLE), rating: 4.8 });
  assert.deepEqual(sortResults([low, high]).map(r => r.title), ['High', 'Low']);
});

test('missing rating sorts last within tier', () => {
  const rated = res('Rated', { ebook: fmt(AVAILABLE), rating: 3.0 });
  const unrated = res('Unrated', { ebook: fmt(AVAILABLE), rating: null });
  assert.deepEqual(sortResults([unrated, rated]).map(r => r.title), ['Rated', 'Unrated']);
});

test('libbyUrl built from id, null without id', () => {
  assert.equal(libbyUrl('chipublib', { overdriveId: '123' }),
    'https://chipublib.overdrive.com/media/123');
  assert.equal(libbyUrl('chipublib', { overdriveId: null }), null);
});

test('searchUrl encodes the query', () => {
  assert.equal(searchUrl('chipublib', 'Cats & Dogs'),
    'https://chipublib.overdrive.com/search?query=Cats%20%26%20Dogs');
});
