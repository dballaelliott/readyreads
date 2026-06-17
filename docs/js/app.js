// readyreads web — orchestration: load list, stream availability, refresh.
// Drives three UI states (empty / loading / populated) from the search lifecycle.

import { parseCsv, parseRss, goodreadsToRss } from './goodreads.js';
import { searchBook } from './overdrive.js';
import { Cache, ageStr } from './store.js';
import { safeLibrary } from './sort.js';
import {
  renderResults, buildMasthead, buildSummary, buildProgress, buildFooter,
} from './render.js';

const CONCURRENCY = 5;
const SESSION_KEY = 'readyreads:session';
const SETTINGS_KEY = 'readyreads:settings';

// Goodreads sends no CORS header, so a browser can't read its RSS directly — a
// server-side hop is required. These public CORS proxies are the zero-setup
// fallback (tried in order); a user's own Worker, if configured, is preferred.
const DEFAULT_PROXIES = [
  url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

const app = document.getElementById('app');
const csvInput = document.getElementById('csv');

const state = {
  library: 'chipublib',
  proxyUrl: '',
  books: [],
  results: new Map(), // srcKey -> result
  cache: null,
  archiveOpen: false,
  running: false,
  checked: 0,
  pending: 0,
  importOpen: false,
  importBusy: false,
  importError: '',
};

const srcKey = (title, author) => `${title.toLowerCase().trim()}|${author.toLowerCase().trim()}`;
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

// ---- persistence ----------------------------------------------------------

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    if (s.library) state.library = safeLibrary(s.library);
    if (s.proxyUrl) state.proxyUrl = s.proxyUrl;
  } catch { /* ignore */ }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ library: state.library, proxyUrl: state.proxyUrl }));
}

function saveSession() {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ library: state.library, books: state.books }));
}

function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
    if (s.library === state.library && Array.isArray(s.books)) return s.books;
  } catch { /* ignore */ }
  return [];
}

// ---- derived state --------------------------------------------------------

function phase() {
  if (state.running) return 'loading';
  if (state.results.size) return 'populated';
  return 'empty';
}

function availableCount() {
  let n = 0;
  for (const r of state.results.values()) {
    if ((r.ebook && r.ebook.status === 'available') || (r.audiobook && r.audiobook.status === 'available')) n++;
  }
  return n;
}

// ---- shared control builders ----------------------------------------------

function libraryField(extraClass = '') {
  const input = el('input', `field ${extraClass}`.trim());
  input.type = 'text';
  input.spellcheck = false;
  input.placeholder = 'Library identifier (e.g. chipublib)';
  input.value = state.library;
  input.addEventListener('change', () => {
    state.library = safeLibrary(input.value.trim());
    input.value = state.library;
    saveSettings();
    render();
  });
  return input;
}

function refreshButton(spinning) {
  const btn = el('button', 'btn-refresh');
  const glyph = el('span', 'glyph', '↻');
  if (spinning) glyph.style.animation = 'rr-spin .7s linear infinite';
  btn.appendChild(glyph);
  btn.appendChild(document.createTextNode(' Refresh'));
  btn.addEventListener('click', () => { if (state.books.length) runSearch(state.books, { force: true }); });
  return btn;
}

function compactControls(spinning) {
  const wrap = el('div', 'controls');
  wrap.appendChild(libraryField());
  wrap.appendChild(refreshButton(spinning));
  return wrap;
}

function importPanel() {
  const panel = el('div', 'import-panel');

  // Primary path: paste a Goodreads link or user id — no setup needed.
  panel.appendChild(el('div', 'panel-label', 'Paste your Goodreads profile link or user ID:'));

  const urlRow = el('div', 'import-row');
  const url = el('input', 'field');
  url.type = 'text'; url.spellcheck = false; url.inputMode = 'url';
  url.autocapitalize = 'off'; url.autocomplete = 'off';
  url.placeholder = 'goodreads.com/user/show/… or your numeric ID';
  const load = el('button', 'btn-load', state.importBusy ? 'Loading…' : 'Load');
  load.disabled = state.importBusy;
  const go = () => onRss(url.value.trim());
  load.addEventListener('click', go);
  url.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  urlRow.appendChild(url);
  urlRow.appendChild(load);
  panel.appendChild(urlRow);

  if (state.importError) {
    panel.appendChild(el('div', 'import-error', state.importError));
  } else {
    panel.appendChild(el('div', 'note', 'Works with a public profile — no setup needed. (Profile must be set to "anyone".)'));
  }

  // Secondary path: CSV for the full list (RSS is capped at 100 books).
  panel.appendChild(el('div', 'panel-label', 'Have a long list? Upload a Goodreads CSV export instead:'));
  const pickRow = el('div', 'import-row');
  const pick = el('button', 'btn-load btn-secondary', 'Choose CSV…');
  pick.style.flex = '1';
  pick.addEventListener('click', () => csvInput.click());
  pickRow.appendChild(pick);
  panel.appendChild(pickRow);

  return panel;
}

function settingsDisclosure() {
  const d = el('details', 'settings');
  if (state.proxyUrl) d.open = true;
  d.appendChild(el('summary', null, 'Settings'));
  const proxy = el('input', 'field');
  proxy.type = 'url'; proxy.spellcheck = false;
  proxy.placeholder = 'Your own RSS proxy URL (Cloudflare Worker)';
  proxy.value = state.proxyUrl;
  proxy.addEventListener('change', () => { state.proxyUrl = proxy.value.trim(); saveSettings(); });
  d.appendChild(proxy);
  d.appendChild(el('div', 'note',
    'Optional. Link import already works through a built-in proxy. Goodreads blocks direct browser '
    + 'requests, so for the most reliable, private fetching you can deploy your own — see worker/README.md.'));
  return d;
}

// ---- state views ----------------------------------------------------------

function viewEmpty(card) {
  const controls = el('div', 'empty-controls');
  controls.appendChild(libraryField());

  const importBtn = el('button', 'btn-import', '＋ Add your Goodreads list');
  controls.appendChild(importBtn);
  card.appendChild(controls);

  let panel = null;
  importBtn.addEventListener('click', () => {
    state.importOpen = !state.importOpen;
    if (state.importOpen && !panel) { panel = importPanel(); controls.appendChild(panel); }
    else if (panel) { panel.remove(); panel = null; state.importError = ''; }
  });
  if (state.importOpen) { panel = importPanel(); controls.appendChild(panel); }

  const prompt = el('div', 'empty-prompt');
  prompt.appendChild(el('div', 'h', "Let's find your next read."));
  prompt.appendChild(el('div', 'sub', "Add your want-to-read list and we'll show you what's borrowable right now."));
  card.appendChild(prompt);

  const cta = el('button', 'btn-primary', '↻ Check availability');
  cta.disabled = !state.books.length;
  cta.addEventListener('click', () => {
    if (state.books.length) runSearch(state.books, { force: true });
    else { state.importOpen = true; render(); }
  });
  card.appendChild(cta);

  card.appendChild(el('div', 'hint',
    state.books.length ? 'tap to check your list' : 'paste your Goodreads link above to get started'));
}

function viewLoading(card, body) {
  card.appendChild(compactControls(true));
  card.appendChild(buildProgress(state.checked, state.pending, availableCount()));

  renderResults(body, [...state.results.values()], {
    library: state.library, onRefreshBook, archiveOpen: state.archiveOpen, loading: true,
  });
}

function viewPopulated(card, body) {
  card.appendChild(compactControls(false));
  card.appendChild(buildSummary(availableCount(), state.results.size));
  card.appendChild(settingsDisclosure());

  renderResults(body, [...state.results.values()], {
    library: state.library, onRefreshBook, archiveOpen: state.archiveOpen, loading: false,
  });
}

// ---- top-level render -----------------------------------------------------

function render() {
  const wide = window.matchMedia('(min-width:720px)').matches;
  const frag = document.createDocumentFragment();

  // masthead + controls live in a card on wide viewports.
  const card = el('div', wide ? 'masthead-card' : 'mast');
  card.appendChild(buildMasthead());

  const body = el('div', 'body');

  const p = phase();
  if (p === 'empty') viewEmpty(card);
  else if (p === 'loading') viewLoading(card, body);
  else viewPopulated(card, body);

  frag.appendChild(card);
  frag.appendChild(body);

  if (p === 'populated') frag.appendChild(buildFooter());

  app.replaceChildren(frag);

  // track failed details toggle
  body.querySelectorAll('details.failed').forEach(d => {
    d.addEventListener('toggle', () => { state.archiveOpen = d.open; });
  });
}

// ---- result assembly ------------------------------------------------------

function resultFromCache(book, cached) {
  return {
    ...cached,
    source: { title: book.title, author: book.author },
    goodreadsRating: book.goodreadsRating ?? cached.goodreadsRating ?? null,
    age: ageStr(cached.updatedAt),
  };
}

function attach(book, result) {
  result.source = { title: book.title, author: book.author };
  result.goodreadsRating = book.goodreadsRating ?? null;
  result.age = 'just now';
  state.results.set(srcKey(book.title, book.author), result);
}

// ---- concurrency pool -----------------------------------------------------

async function pool(items, worker) {
  let i = 0;
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx]);
    }
  });
  await Promise.all(runners);
}

// ---- search orchestration -------------------------------------------------

async function runSearch(books, { force = false } = {}) {
  state.books = books;
  state.results.clear();
  saveSession();
  state.cache = new Cache(state.library);

  // Seed instantly from cache.
  const pending = [];
  for (const book of books) {
    const cached = state.cache.get(book.title, book.author);
    if (cached && !force) state.results.set(srcKey(book.title, book.author), resultFromCache(book, cached));
    else pending.push(book);
  }

  if (!pending.length) {
    state.running = false;
    render();
    return;
  }

  state.running = true;
  state.checked = 0;
  state.pending = pending.length;
  render();

  await pool(pending, async (book) => {
    try {
      const result = await searchBook(state.library, book.title, book.author);
      attach(book, result);
      state.cache.set(book.title, book.author, result);
    } catch { /* leave unsearched */ }
    state.checked++;
    render();
  });

  state.running = false;
  render();
}

async function onRefreshBook(result, btn) {
  const src = result.source || { title: result.title, author: result.author };
  btn.classList.add('spin');
  try {
    const fresh = await searchBook(state.library, src.title, src.author);
    attach({ ...src, goodreadsRating: result.goodreadsRating }, fresh);
    state.cache.set(src.title, src.author, fresh);
  } catch { /* ignore */ }
  render();
}

// ---- input handlers -------------------------------------------------------

function readFile(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsText(file);
  });
}

async function onCsv(file) {
  try {
    const books = parseCsv(await readFile(file));
    if (!books.length) return;
    state.importOpen = false;
    await runSearch(books);
  } catch { /* ignore parse errors */ }
}

// Try each proxy in turn; return books from the first that yields a parseable
// feed. A user's own Worker (state.proxyUrl) is preferred, then public proxies.
async function fetchGoodreadsRss(rssUrl) {
  const builders = [];
  if (state.proxyUrl) {
    const base = state.proxyUrl;
    builders.push(url => `${base}${base.includes('?') ? '&' : '?'}url=${encodeURIComponent(url)}`);
  }
  builders.push(...DEFAULT_PROXIES);

  let lastErr;
  for (const build of builders) {
    try {
      const resp = await fetch(build(rssUrl));
      if (!resp.ok) { lastErr = new Error(`proxy returned ${resp.status}`); continue; }
      const books = parseRss(await resp.text());
      if (books.length) return books;
      lastErr = new Error('no books in feed');
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('all proxies failed');
}

async function onRss(input) {
  if (!input || state.importBusy) return;

  let rssUrl;
  try {
    rssUrl = goodreadsToRss(input);
  } catch (e) {
    state.importError = e.message;
    state.importOpen = true;
    render();
    return;
  }

  state.importBusy = true;
  state.importError = '';
  render();

  try {
    const books = await fetchGoodreadsRss(rssUrl);
    state.importBusy = false;
    state.importOpen = false;
    await runSearch(books);
  } catch {
    state.importBusy = false;
    state.importError = "Couldn't load that list. If your Goodreads profile is private, "
      + 'make it public (Settings → Profile → "anyone"), paste your full RSS link, or upload a CSV.';
    state.importOpen = true;
    render();
  }
}

// ---- wire up --------------------------------------------------------------

function init() {
  loadSettings();
  csvInput.addEventListener('change', e => { if (e.target.files[0]) onCsv(e.target.files[0]); });

  // Re-render on breakpoint changes so the card wrap follows the viewport.
  window.matchMedia('(min-width:720px)').addEventListener('change', render);

  const books = loadSession();
  if (books.length) runSearch(books);
  else render();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
}

init();
