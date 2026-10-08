# Self-hosting Tag

## Local

Use Node 22.12+; clone and run `npm ci`, then `npm run dev`. Connect a provider in the app. No environment variables, migrations, Stripe, or Hecz account are required.

## Static hosting

1. Import your fork into Vercel, Netlify, Cloudflare Pages, or another static host.
2. Install: `npm ci`. Build: `npm run build`. Output directory: `dist`.
3. Use Node 22.12+; set no provider key environment variables.
4. Open the app and enter your key in Connection settings.

`vercel.json` supplies security headers for Vercel. Other hosts should set comparable headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and a Content Security Policy restricting scripts to your origin and connections to supported providers. The app has no client-side routes, so SPA rewrites aren't needed. Deploy at the domain root; subpath hosting isn't configured.

Providers use a fixed endpoint allowlist. When adding one, update `src/lib/provider.ts`, deployment CSP, tests, and README. Never put keys in Vite environment variables: they become public browser assets.

## Troubleshooting

- **Can't reach provider:** Check browser/CORS support, your network, and local-network restrictions. There is no proxy server. Don't publish a key in the bundle to work around this.
- **401/403:** Re-enter the key. Reloading intentionally forgets it.
- **400/404:** Check the model ID and support for OpenAI-compatible text chat.
- **429:** Check credits and rate limits; wait before retrying.
- **Ollama:** Allow Tag's exact origin with `OLLAMA_ORIGINS`, restart Ollama, and run Tag on localhost. See README commands.
- **History won't save:** Export a backup, delete older conversations, and check storage settings. Clearing browser data deletes history.
- **Answer cut short:** The partial reply remains visible. Retry replaces the latest response and may incur another provider charge.

Tests verify fixture streams and HTTP failures, not current model availability or account permissions.
