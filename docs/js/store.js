// localStorage availability cache — the browser equivalent of cache.py.

function cacheKey(title, author) {
  return `${title.toLowerCase().trim()}|${author.toLowerCase().trim()}`;
}

export function ageStr(iso, now = Date.now()) {
  const age = now - Date.parse(iso);
  const sec = Math.floor(age / 1000);
  const days = Math.floor(sec / 86400);
  if (days > 30) return `${Math.floor(days / 30)}mo ago`;
  if (days > 0) return `${days}d ago`;
  if (sec > 3600) return `${Math.floor(sec / 3600)}h ago`;
  if (sec > 60) return `${Math.floor(sec / 60)}m ago`;
  return 'just now';
}

export class Cache {
  constructor(library, storage = globalThis.localStorage) {
    this.storage = storage;
    this.storeKey = `readyreads:cache:${library}`;
    try {
      this.data = JSON.parse(this.storage.getItem(this.storeKey) || '{}');
    } catch {
      this.data = {};
    }
  }

  get(title, author) {
    return this.data[cacheKey(title, author)] || null;
  }

  set(searchTitle, searchAuthor, result) {
    this.data[cacheKey(searchTitle, searchAuthor)] = {
      title: result.title,
      author: result.author,
      overdriveId: result.overdriveId ?? null,
      ebook: result.ebook,
      audiobook: result.audiobook,
      goodreadsRating: result.goodreadsRating ?? null,
      updatedAt: new Date().toISOString(),
    };
    this._save();
  }

  _save() {
    try {
      this.storage.setItem(this.storeKey, JSON.stringify(this.data));
    } catch {
      /* quota or unavailable — fail silently */
    }
  }
}
