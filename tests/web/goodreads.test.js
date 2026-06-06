import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, parseRss, parseRating, cleanTitle } from '../../docs/js/goodreads.js';

const CSV = [
  'Book Id,Title,Author,ISBN,ISBN13,Average Rating,Exclusive Shelf',
  '111,"Wolf Hall (Thomas Cromwell, #1)",Hilary Mantel,="0007230206",="9780007230204",3.91,to-read',
  '222,No Rating Book,John Doe,="","",,to-read',
  '333,Already Read,Jane Roe,="","",4.5,read',
].join('\n');

test('parseCsv keeps only to-read and extracts fields', () => {
  const books = parseCsv(CSV);
  assert.equal(books.length, 2);
  const titles = books.map(b => b.title);
  assert.ok(titles.includes('Wolf Hall'));        // series suffix stripped
  assert.ok(!titles.includes('Already Read'));     // filtered out (read shelf)
});

test('parseCsv reads rating and isbn, handles missing rating', () => {
  const books = parseCsv(CSV);
  const wolf = books.find(b => b.title === 'Wolf Hall');
  assert.equal(wolf.author, 'Hilary Mantel');
  assert.equal(wolf.goodreadsRating, 3.91);
  assert.equal(wolf.isbn, '0007230206');
  const none = books.find(b => b.title === 'No Rating Book');
  assert.equal(none.goodreadsRating, null);
});

const RSS = `<?xml version="1.0"?><rss><channel>
<item><title>The Rated Book</title><author_name>Jane Author</author_name>
<average_rating>4.27</average_rating><link>https://www.goodreads.com/book/show/111</link></item>
<item><title>Unrated (Series, #2)</title><author_name>John Author</author_name>
<average_rating>0</average_rating><link>https://www.goodreads.com/book/show/222</link></item>
</channel></rss>`;

test('parseRss extracts title, author, rating', () => {
  const books = parseRss(RSS);
  assert.equal(books.length, 2);
  const rated = books.find(b => b.title === 'The Rated Book');
  assert.equal(rated.author, 'Jane Author');
  assert.equal(rated.goodreadsRating, 4.27);
});

test('parseRss treats 0 rating as null and strips series suffix', () => {
  const books = parseRss(RSS);
  const unrated = books.find(b => b.title === 'Unrated');
  assert.equal(unrated.goodreadsRating, null);
});

test('parseRating: blank and zero become null', () => {
  assert.equal(parseRating('4.27'), 4.27);
  assert.equal(parseRating('0'), null);
  assert.equal(parseRating(''), null);
  assert.equal(parseRating(null), null);
});

test('cleanTitle strips series parenthetical', () => {
  assert.equal(cleanTitle('Dune (Dune, #1)'), 'Dune');
  assert.equal(cleanTitle('Plain Title'), 'Plain Title');
});
