# Goodreads RSS proxy (Cloudflare Worker)

The webapp can read your Goodreads list two ways, **both working with no setup**:

- **Paste your profile link or user ID** — the app derives your shelf's RSS feed
  and fetches it through a built-in public proxy. Works for any **public** profile
  (Goodreads → Settings → Profile → "Who can view my profile" = *anyone*).
- **CSV upload** — best for lists over 100 books (RSS is capped at the most-recent 100).

Deploying this Worker is **optional**. Browsers can't fetch Goodreads directly
(it sends no CORS header), so the app relies on a proxy. The built-in public
proxies work out of the box, but they fetch from shared datacenter IPs that
Goodreads occasionally rate-limits or blocks. Running your own Worker gives you
the **most reliable and private** path: requests go through your Cloudflare edge,
and it only proxies `goodreads.com/review/list_rss/`, so it isn't an open relay.

## Deploy (dashboard, ~5 minutes, free)

1. Sign in at <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → **Create Worker**.
2. Name it e.g. `ezlibby-proxy`, click **Deploy**, then **Edit code**.
3. Replace the sample with the contents of [`goodreads-proxy.js`](./goodreads-proxy.js) and **Deploy**.
4. Copy your Worker URL (e.g. `https://ezlibby-proxy.<you>.workers.dev`).
5. In the webapp → **Settings** → paste it into the proxy URL field. The app will
   then prefer your Worker over the built-in public proxies.

Link import still uses Goodreads' most-recent-100 RSS cap; use CSV for the full list.

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
