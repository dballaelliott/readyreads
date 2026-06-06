// OverDrive/Libby search — ported from overdrive.py. Runs directly in the
// browser because thunder.api.overdrive.com sends Access-Control-Allow-Origin: *.

import { AVAILABLE, WAITLIST, NOT_FOUND, safeLibrary } from './sort.js';

const THUNDER = 'https://thunder.api.overdrive.com/v2';
const EBOOK_FORMATS =
  'ebook-overdrive,ebook-epub-adobe,ebook-epub-open,ebook-pdf-adobe,ebook-pdf-open,ebook-kindle';
const AUDIO_FORMATS = 'audiobook-overdrive,audiobook-mp3';

async function searchFormat(library, query, formatFilter, fetchImpl) {
  const url = new URL(`${THUNDER}/libraries/${library}/media`);
  url.searchParams.set('query', query);
  url.searchParams.set('perPage', '5');
  url.searchParams.set('page', '1');
  if (formatFilter) url.searchParams.set('format', formatFilter);
  try {
    const resp = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.items || [];
  } catch {
    return [];
  }
}

async function getAvailability(library, id, fetchImpl) {
  try {
    const resp = await fetchImpl(`${THUNDER}/libraries/${library}/media/${id}/availability`);
    if (resp.status === 200) return await resp.json();
  } catch {
    /* ignore */
  }
  return null;
}

export function matchItem(items, title, author) {
  if (!items || !items.length) return null;
  const t = title.toLowerCase();
  const a = author.toLowerCase();
  for (const item of items) {
    const it = (item.title || '').toLowerCase();
    const ia = (item.firstCreatorName || '').toLowerCase();
    if (t.includes(it) || it.includes(t)) {
      const ap = a.split(/\s+/).filter(Boolean);
      const ip = ia.split(/\s+/).filter(Boolean);
      if (ap.length && ip.length && (ia.includes(ap[0]) || a.includes(ip[0]))) return item;
    }
  }
  return items[0];
}

export function parseAvailability(data) {
  if (!data) return { status: NOT_FOUND, waitDays: null, copiesAvailable: null, copiesOwned: null, holdsCount: null };
  const isAvailable = data.isAvailable || false;
  const copiesAvailable = data.availableCopies || 0;
  const copiesOwned = data.ownedCopies || 0;
  const holdsCount = data.holdsCount || 0;
  const waitDays = data.estimatedWaitDays ?? null;
  if (isAvailable && copiesAvailable > 0) {
    return { status: AVAILABLE, waitDays: null, copiesAvailable, copiesOwned, holdsCount: null };
  }
  if (copiesOwned > 0) {
    return { status: WAITLIST, waitDays, copiesAvailable: null, copiesOwned, holdsCount };
  }
  return { status: NOT_FOUND, waitDays: null, copiesAvailable: null, copiesOwned: null, holdsCount: null };
}

const NF = () => ({ status: NOT_FOUND, waitDays: null, copiesAvailable: null, copiesOwned: null, holdsCount: null });

export async function searchBook(library, title, author, { fetchImpl = globalThis.fetch } = {}) {
  library = safeLibrary(library); // never build an API path from an unvalidated identifier
  const query = `${title} ${author}`;
  const [ebookItems, audioItems] = await Promise.all([
    searchFormat(library, query, EBOOK_FORMATS, fetchImpl),
    searchFormat(library, query, AUDIO_FORMATS, fetchImpl),
  ]);
  const ebookMatch = matchItem(ebookItems, title, author);
  const audioMatch = matchItem(audioItems, title, author);

  const [ebookAvail, audioAvail] = await Promise.all([
    ebookMatch ? getAvailability(library, ebookMatch.id, fetchImpl).then(parseAvailability) : NF(),
    audioMatch ? getAvailability(library, audioMatch.id, fetchImpl).then(parseAvailability) : NF(),
  ]);

  const best = ebookMatch || audioMatch;
  return {
    title: best?.title || title,
    author: best?.firstCreatorName || author,
    overdriveId: best?.id || null,
    ebook: ebookAvail,
    audiobook: audioAvail,
  };
}
