# Photo → tree proxy

Lets students turn a photo of a hand-drawn tree into a bracketing without needing their own API key.
The Worker holds the key, only answers requests from the site, rate-limits per visitor, and stores nothing.

## Deploy (about five minutes)

1. Install Wrangler and log in to a free Cloudflare account: `npm i -g wrangler && wrangler login`
2. From this folder: `wrangler secret put ANTHROPIC_API_KEY` (paste the key when asked; it is never in the repo)
3. `wrangler deploy` — it prints a URL like `https://trees-photo.<you>.workers.dev`
4. Paste that URL into `PHOTO_ENDPOINT` near the top of `trees.js` and push. Until it is set, the photo button stays hidden.

## Cost and safety

- Set a monthly spend limit on the API key in the Anthropic console; that is the real backstop.
- `ALLOWED_ORIGINS` (wrangler.toml) is the list of sites allowed to call it. Add a localhost origin while testing.
- Photos pass through Cloudflare and the model provider and are not kept by this code. The app says so before sending.
