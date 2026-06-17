// Goodreads parsing — CSV export and RSS feed — ported from goodreads.py.
// RSS uses regex (not DOMParser) so the same code runs in Node tests and the browser.

export function parseRating(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const n = Number.parseFloat(s);
  if (Number.isNaN(n)) return null;
  return n > 0 ? n : null; // Goodreads reports 0 for unrated
}

export function cleanTitle(title) {
  // Drop a trailing series parenthetical like "(The Expanse, #1)".
  return title.replace(/\s*\([^)]*#\d+[^)]*\)\s*$/, '').trim();
}

// Normalize whatever a user pastes into a Goodreads shelf RSS URL.
// Accepts: a bare numeric user id, a profile/shelf URL (/user/show/ID or
// /review/list/ID), or a full list_rss URL. A pasted list_rss URL is returned
// untouched so its `key=` (needed for private profiles) survives. Throws if no
// user id can be found. Pure/network-free — safe for Node tests.
export function goodreadsToRss(input) {
  const raw = (input || '').trim();
  if (!raw) throw new Error('Enter a Goodreads link or user ID.');

  // Already an RSS feed URL — keep as-is (preserves key= and shelf=).
  if (/\/review\/list_rss\//.test(raw)) return raw;

  // Bare numeric user id.
  if (/^\d+$/.test(raw)) {
    return `https://www.goodreads.com/review/list_rss/${raw}?shelf=to-read`;
  }

  // Profile or shelf URL: /review/list/<id> or /user/show/<id>.
  const idMatch = raw.match(/\/(?:review\/list|user\/show)\/(\d+)/);
  if (!idMatch) {
    throw new Error("That doesn't look like a Goodreads profile link or user ID.");
  }
  const shelfMatch = raw.match(/[?&]shelf=([^&#]+)/);
  const shelf = shelfMatch ? shelfMatch[1] : 'to-read';
  return `https://www.goodreads.com/review/list_rss/${idMatch[1]}?shelf=${shelf}`;
}

function cleanIsbn(value) {
  // Goodreads wraps ISBNs as ="0060590297" to stop Excel mangling them; after
  // CSV quote-stripping that leaves a leading '='. Strip it and any stray quotes.
  let v = (value || '').trim();
  if (v.startsWith('=')) v = v.slice(1);
  return v.replace(/"/g, '');
}

// Minimal RFC-4180-ish CSV parser: handles quoted fields, embedded commas,
// escaped quotes (""), and newlines inside quotes.
function parseCsvRows(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\r') {
      // ignore; handled by \n
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function parseCsv(text) {
  const rows = parseCsvRows(text).filter(r => r.length > 1);
  if (!rows.length) return [];
  const header = rows[0].map(h => h.trim());
  const col = name => header.indexOf(name);
  const iTitle = col('Title'), iAuthor = col('Author'), iShelf = col('Exclusive Shelf');
  const iRating = col('Average Rating'), iIsbn = col('ISBN'), iIsbn13 = col('ISBN13');
  const iId = col('Book Id');

  const books = [];
  for (const r of rows.slice(1)) {
    if (iShelf >= 0 && (r[iShelf] || '').trim() !== 'to-read') continue;
    const title = (r[iTitle] || '').trim();
    const author = (r[iAuthor] || '').trim();
    if (!title || !author) continue;
    books.push({
      title: cleanTitle(title),
      author,
      isbn: iIsbn >= 0 ? cleanIsbn(r[iIsbn]) || null : null,
      isbn13: iIsbn13 >= 0 ? cleanIsbn(r[iIsbn13]) || null : null,
      goodreadsId: iId >= 0 ? (r[iId] || '').trim() || null : null,
      goodreadsRating: iRating >= 0 ? parseRating(r[iRating]) : null,
    });
  }
  return books;
}

function decodeEntities(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decodeEntities(m[1]) : '';
}

export function parseRss(xml) {
  const books = [];
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  for (const item of items) {
    const title = tag(item, 'title');
    const author = tag(item, 'author_name');
    if (!title || !author) continue;
    const link = tag(item, 'link');
    const idMatch = link.match(/\/book\/show\/(\d+)/);
    const desc = tag(item, 'description');
    const isbnMatch = desc.match(/isbn:\s*(\d{10})/i);
    const isbn13Match = desc.match(/isbn13:\s*(\d{13})/i);
    books.push({
      title: cleanTitle(title),
      author,
      isbn: isbnMatch ? isbnMatch[1] : null,
      isbn13: isbn13Match ? isbn13Match[1] : null,
      goodreadsId: idMatch ? idMatch[1] : null,
      goodreadsRating: parseRating(tag(item, 'average_rating')),
    });
  }
  return books;
}
