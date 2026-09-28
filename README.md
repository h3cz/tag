# Tag — Open Source Multi-Model AI Chat

**Tag** is the chat product inside [Hecz](https://hecz.dev) — a free + Pro multi-model AI chat with persistent memory, BYOK support, and streaming responses.

Hosted version: **[hecz.dev/chat](https://hecz.dev/chat)**

---

## Features

- **Multi-model routing** — Claude, GPT-4o, Gemini, and more via a single interface
- **Persistent memory** — conversations remembered across sessions via pgvector + mem0
- **Free + Pro tiers** — generous free limits, Pro unlocks higher rate limits and priority routing
- **BYOK (Bring Your Own Key)** — use your own API keys for any provider
- **Streaming responses** — real-time token streaming via Supabase Edge Functions
- **Graffiti aesthetic** — Tag's signature animated logo and Editorial Street design

---

## Security And Privacy

- BYOK keys should stay client-side or in the self-hoster's own infrastructure.
- Do not commit `.env` files, provider keys, Supabase service-role keys, Stripe secrets, or webhook secrets.
- Public examples should use placeholder project refs and placeholder environment variables.
- Self-hosters are responsible for configuring Supabase RLS, auth providers, and deployment secrets correctly.

---

## Architecture

| Layer | Technology |
|---|---|
| Frontend | Vite + React 18 + Tailwind 4 |
| Backend | Supabase Edge Functions (Deno) |
| Database | Supabase PostgreSQL with pgvector |
| Memory | mem0 + pgvector for semantic recall |
| Auth | Supabase Auth |
| AI routing | `synthetic-public-proxy` Edge Function |

---

## Self-Hosting

> Requires: Supabase project, a [synthetic.new](https://synthetic.new) API key (or BYOK provider keys), and Node 22.12+ with npm.

1. Clone this repo.
2. Create a Supabase project and run the migrations in `supabase/migrations/` in order.
3. Deploy the Edge Functions in `supabase/functions/` via `supabase functions deploy`.
4. Copy `.env.example` to `.env` and set your public Supabase URL and anon key. Optionally set the public Turnstile site key. Never put backend secrets in `VITE_*` variables; those values are included in the browser bundle.
5. Install dependencies with `npm ci`, then run `npm run dev`. The existing Chat page is mounted at `/` and `/chat`.

Frontend checks (also run by `.github/workflows/ci.yml` on pushes and pull requests):

**Bootstrap status:** this scaffold was prepared in an environment without npm registry access or cached frontend packages. `package-lock.json` could not be generated, so CI and `npm ci` are not ready yet. In a network-enabled checkout, run `npm install` to generate the lockfile, retain it in the repository, then run all three checks below. Type checking and the production build have not yet been verified.

```sh
npm ci
npx tsc --noEmit
npm run build
```

`npm run preview` serves the production build from `dist/`. Configure production hosting to serve `index.html` for browser routes. Building does not require real credentials; running the app requires the two Supabase variables above.

This mirror does not contain the backend `supabase/functions/_shared/` helpers imported by the edge functions, all endpoints used by the UI, or the parent product's account pages. Restore those backend resources before deploying the functions. The frontend TypeScript configuration deliberately covers `src/` and `vite.config.ts`; Deno functions are deployed and checked separately. No backend stubs are supplied.

The standalone stylesheet supplies the semantic color tokens and animation names used by the components. The original monorepo stylesheet and font assets were not included in this mirror.

`src/components/icons/brand.ts` contains six visual stubs for missing brand artwork, using the existing Lucide dependency: `GmailIcon` → `Mail`, `SlackIcon` → `Hash`, `GitHubIcon` → `Github`, `LinearIcon` → `ListTodo`, `NotionIcon` → `NotebookText`, and `GoogleCalendarIcon` → `CalendarDays`. These preserve the integration controls and icon props but do not reproduce the original brand designs. The Supabase client and `cn` helper are functional implementations, not stubs.

The `synthetic-public-proxy` function handles model routing — you'll need either a `synthetic.new` key or configure direct provider keys in Supabase Vault.

Before publishing a fork, copy `docs/templates/SECURITY.md` from the source monorepo into the public repo root as `SECURITY.md`.

---

## License

MIT — see [LICENSE](./LICENSE).

Copyright 2026 JR Lopez. The hosted service at [hecz.dev/chat](https://hecz.dev/chat) is operated separately and not included in this license.

---

*This repository is auto-synced from the private Hecz monorepo on every push to `main`.*
