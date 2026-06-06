// Cloudflare Worker: a CORS shim for Goodreads RSS feeds.
//
// Goodreads sends no Access-Control-Allow-Origin header, so a browser app can't
// fetch its RSS directly. This Worker fetches the feed server-side and re-serves
// it with CORS enabled. It only proxies goodreads.com — not an open proxy.
//
// Usage from the app:  https://<your-worker-url>/?url=<encoded goodreads rss url>

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const target = new URL(request.url).searchParams.get('url');
    if (!target) return text('missing ?url= parameter', 400);

    let t;
    try { t = new URL(target); } catch { return text('invalid url', 400); }
    if (t.protocol !== 'https:') return text('only https is allowed', 403);
    if (t.hostname !== 'www.goodreads.com' && t.hostname !== 'goodreads.com') {
      return text('only goodreads.com is allowed', 403);
    }
    // Only the RSS shelf endpoint — not arbitrary goodreads paths.
    if (!t.pathname.startsWith('/review/list_rss/')) {
      return text('only /review/list_rss/ is allowed', 403);
    }

    try {
      // redirect: 'manual' so a goodreads open-redirect can't bounce us off-allowlist.
      const upstream = await fetch(t.toString(), {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        redirect: 'manual',
      });
      if (upstream.status >= 300 && upstream.status < 400) {
        return text('upstream redirect refused', 502);
      }
      const body = (await upstream.text()).slice(0, 5_000_000); // cap response size
      return new Response(body, {
        status: upstream.status,
        headers: { ...CORS, 'Content-Type': 'application/rss+xml; charset=utf-8' },
      });
    } catch (e) {
      return text(`upstream fetch failed: ${e.message}`, 502);
    }
  },
};

function text(msg, status) {
  return new Response(msg, { status, headers: { ...CORS, 'Content-Type': 'text/plain' } });
}
