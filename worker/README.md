# Goodreads RSS proxy (Cloudflare Worker)

The webapp can read your Goodreads list two ways:

- **CSV upload** — works with no proxy. (Recommended; no 100-book limit.)
- **Paste an RSS link** — needs this tiny proxy, because Goodreads blocks direct
  browser requests (no CORS header). OverDrive does **not** need a proxy.

This Worker fetches a Goodreads RSS feed server-side and re-serves it with CORS
enabled. It only proxies `goodreads.com`, so it isn't an open relay.

## Deploy (dashboard, ~5 minutes, free)

1. Sign in at <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → **Create Worker**.
2. Name it e.g. `ezlibby-proxy`, click **Deploy**, then **Edit code**.
3. Replace the sample with the contents of [`goodreads-proxy.js`](./goodreads-proxy.js) and **Deploy**.
4. Copy your Worker URL (e.g. `https://ezlibby-proxy.<you>.workers.dev`).
5. In the webapp → **Settings** → paste it into **RSS proxy URL**.

Now pasting your Goodreads shelf RSS link works (still capped at Goodreads'
most-recent-100; use CSV for the full list).

## Deploy (CLI alternative)

```bash
npm i -g wrangler
wrangler login
wrangler deploy worker/goodreads-proxy.js --name ezlibby-proxy
```

## Test it

```
https://<your-worker-url>/?url=https%3A%2F%2Fwww.goodreads.com%2Freview%2Flist_rss%2F12345678%3Fshelf%3Dto-read
```

You should get XML back. Only `goodreads.com` URLs are accepted; anything else returns 403.
