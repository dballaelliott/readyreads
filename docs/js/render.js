// readyreads — Direction D presentation. Vanilla DOM-builder (browser-only).
// Two accents: green = available, blue = action. Rhythm is whitespace only.

import { AVAILABLE, WAITLIST, availabilityTier, sortResults, libbyUrl, searchUrl } from './sort.js';

const GROUPS = [
  'Ready to read',   // tier 0
  'Listen instead',  // tier 1
  'Worth the wait',  // tier 2
];
const FAILED_TIER = 3;

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

// ---- availability labels --------------------------------------------------

function waitLabel(a) {
  // a is a known waitlist availability object.
  const d = a.waitDays;
  if (d == null) return '(waitlist)';
  if (d <= 7) return `(${d}d)`;
  if (d <= 30) return `(${Math.floor(d / 7)}w)`;
  return `(${Math.floor(d / 30)}mo)`;
}

function availSpan(avail, fmt) {
  if (avail && avail.status === AVAILABLE) {
    return el('span', 'avail now', fmt);
  }
  if (avail && avail.status === WAITLIST) {
    return el('span', 'avail wait', `${fmt} ${waitLabel(avail)}`);
  }
  // not_found or missing
  return el('span', 'avail wait', `${fmt} (none)`);
}

// ---- rating ---------------------------------------------------------------

function ratingBlock(rating) {
  const wrap = el('div', 'rating');
  if (rating == null) {
    wrap.appendChild(el('span', 'none', '—'));
  } else {
    wrap.appendChild(el('span', 'num', rating.toFixed(1)));
    // No review-count line: we have no source for review counts.
  }
  return wrap;
}

// ---- book row -------------------------------------------------------------

function bookRow(result, { library, onRefreshBook }) {
  const row = el('div', 'row');
  const displayTitle = result.source?.title || result.title;
  const displayAuthor = result.source?.author || result.author || '';

  const main = el('div', 'row-main');
  const url = libbyUrl(library, result);
  if (url) {
    const a = el('a', 'title');
    a.textContent = displayTitle;
    a.href = url; a.target = '_blank'; a.rel = 'noopener';
    main.appendChild(a);
  } else {
    main.appendChild(el('span', 'title nolink', displayTitle));
  }
  main.appendChild(el('div', 'byline', displayAuthor ? `by ${displayAuthor}` : ''));

  const av = el('div', 'avail-row');
  av.appendChild(availSpan(result.ebook, 'ebook'));
  av.appendChild(availSpan(result.audiobook, 'audio'));
  main.appendChild(av);
  row.appendChild(main);

  row.appendChild(ratingBlock(result.goodreadsRating));

  if (onRefreshBook) {
    const btn = el('button', 'row-refresh', '↻');
    btn.title = 'Re-check this book';
    btn.addEventListener('click', () => onRefreshBook(result, btn));
    row.appendChild(btn);
  }
  return row;
}

function skeletonRow(widthPct) {
  const row = el('div', 'skeleton');
  const main = el('div', 'sk-main');
  const title = el('div', 'sk-bar sk-title');
  title.style.width = widthPct;
  main.appendChild(title);
  main.appendChild(el('div', 'sk-bar sk-byline'));
  row.appendChild(main);
  row.appendChild(el('span', 'sk-label', 'checking…'));
  return row;
}

// ---- group ----------------------------------------------------------------

function group(label, items, opts, { skeletons = 0 } = {}) {
  const sec = el('div', 'group');
  const head = el('div', 'group-head');
  head.appendChild(el('h2', null, label));
  if (items.length) head.appendChild(el('span', 'count-pill', String(items.length)));
  sec.appendChild(head);

  const rows = el('div', 'group-rows');
  for (const r of items) rows.appendChild(bookRow(r, opts));
  for (let i = 0; i < skeletons; i++) rows.appendChild(skeletonRow(i === 0 ? '64%' : '48%'));
  sec.appendChild(rows);
  return sec;
}

// ---- failed details -------------------------------------------------------

function failedDetails(items, { library, archiveOpen }) {
  const d = el('details', 'failed');
  if (archiveOpen) d.open = true;
  const summary = el('summary', null, `Failed to match (${items.length})`);
  d.appendChild(summary);
  const list = el('div', 'failed-list');
  for (const r of items) {
    const item = el('div', 'failed-item');
    const title = r.source?.title || r.title;
    const url = searchUrl(library, title);
    const a = el('a');
    a.textContent = title;
    a.href = url; a.target = '_blank'; a.rel = 'noopener';
    item.appendChild(a);
    list.appendChild(item);
  }
  d.appendChild(list);
  return d;
}

// ---- public: render the results body --------------------------------------
//
// Renders the three tier groups + failed details into `container`.
// When `loading` is true, appends 2 skeleton rows under "Ready to read" and
// keeps empty groups hidden (titles stream in as they resolve).

export function renderResults(container, results, opts) {
  const { library, onRefreshBook, archiveOpen = false, loading = false } = opts;
  const ordered = sortResults(results);
  const buckets = [[], [], [], []];
  for (const r of ordered) buckets[availabilityTier(r)].push(r);

  const frag = document.createDocumentFragment();

  GROUPS.forEach((label, tier) => {
    const items = buckets[tier];
    const skeletons = loading && tier === 0 ? 2 : 0;
    if (!items.length && !skeletons) return;
    frag.appendChild(group(label, items, { library, onRefreshBook }, { skeletons }));
  });

  if (!loading && buckets[FAILED_TIER].length) {
    frag.appendChild(failedDetails(buckets[FAILED_TIER], { library, archiveOpen }));
  }

  container.replaceChildren(frag);
}

// ---- public: small DOM builders the shell (app.js) composes ---------------

export function buildMasthead() {
  const head = el('header', 'masthead');
  const brand = el('div', 'brand');
  brand.appendChild(el('div', 'eyebrow', 'Public Library Companion'));
  brand.appendChild(el('div', 'wordmark', 'readyreads'));
  brand.appendChild(el('div', 'tagline', 'your want-to-read list, sorted by what you can borrow now'));
  head.appendChild(brand);

  const synced = el('span', 'synced');
  synced.appendChild(el('span', 'dot'));
  synced.appendChild(document.createTextNode('synced'));
  head.appendChild(synced);
  return head;
}

export function buildSummary(available, total) {
  const wrap = el('div', 'summary');
  const text = el('span', 'text');
  text.appendChild(el('span', 'avail', `${available} available now`));
  text.appendChild(document.createTextNode(' '));
  text.appendChild(el('span', 'rest', `· ${total} titles`));
  wrap.appendChild(text);
  return wrap;
}

export function buildProgress(checked, total, found) {
  const block = el('div', 'status-block');
  const row = el('div', 'status-row');

  const left = el('span', 'status-left');
  left.appendChild(el('span', 'spinner'));
  left.appendChild(document.createTextNode(`Checking ${checked} / ${total}…`));
  row.appendChild(left);

  row.appendChild(el('span', 'status-found', `${found} found`));
  block.appendChild(row);

  const bar = el('div', 'progress');
  const fill = el('span');
  const pct = total ? Math.min(100, (checked / total) * 100) : 0;
  fill.style.width = `${pct}%`;
  bar.appendChild(fill);
  block.appendChild(bar);
  return block;
}

export function buildFooter() {
  const f = el('footer', 'foot');
  f.appendChild(document.createTextNode('Everything runs in your browser.'));
  f.appendChild(el('br'));
  f.appendChild(document.createTextNode('Nothing leaves this page.'));
  return f;
}
