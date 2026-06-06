// Availability tiers and the lexicographic sort — ported from display.py.

export const AVAILABLE = 'available';
export const WAITLIST = 'waitlist';
export const NOT_FOUND = 'not_found';

export function availabilityTier(r) {
  // 0 = ebook available, 1 = audio-only, 2 = on a waitlist, 3 = not found anywhere.
  if (r.ebook && r.ebook.status === AVAILABLE) return 0;
  if (r.audiobook && r.audiobook.status === AVAILABLE) return 1;
  const onWaitlist =
    (r.ebook && r.ebook.status === WAITLIST) ||
    (r.audiobook && r.audiobook.status === WAITLIST);
  return onWaitlist ? 2 : 3;
}

export function ebookWait(r) {
  // Days until the ebook is available (0 = now, Infinity = unknown/not found).
  const e = r.ebook;
  if (!e) return Infinity;
  if (e.status === AVAILABLE) return 0;
  if (e.status === WAITLIST) return e.waitDays == null ? Infinity : e.waitDays;
  return Infinity;
}

export function sortResults(results) {
  return [...results].sort((a, b) => {
    const ta = availabilityTier(a), tb = availabilityTier(b);
    if (ta !== tb) return ta - tb;
    const wa = ebookWait(a), wb = ebookWait(b);
    if (wa !== wb) return wa - wb;
    return (b.goodreadsRating || 0) - (a.goodreadsRating || 0);
  });
}

// OverDrive library identifiers are short slugs; reject anything else so a
// crafted value can't retarget a link href or the API request host.
export function safeLibrary(library) {
  return /^[a-z0-9-]{1,40}$/.test(library || '') ? library : 'chipublib';
}

export function libbyUrl(library, result) {
  if (!result.overdriveId) return null;
  return `https://${safeLibrary(library)}.overdrive.com/media/${encodeURIComponent(result.overdriveId)}`;
}

export function searchUrl(library, title) {
  return `https://${safeLibrary(library)}.overdrive.com/search?query=${encodeURIComponent(title)}`;
}
