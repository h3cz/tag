# Tag Product Brief

Tag is a self-hostable multi-model AI chat for builders.

The product goal is simple: one chat surface where a user can switch between models, bring their own provider keys, use a hosted starter model when available, and optionally keep useful memory across sessions.

## Core Ideas

- **Multi-model chat:** one interface for models from providers such as OpenAI, Anthropic, Google, OpenRouter-compatible APIs, synthetic.new-compatible APIs, and local providers.
- **BYOK-first:** users can bring their own API keys instead of relying only on the hosted service.
- **Self-hostable:** Supabase migrations and Edge Functions are included so developers can run their own instance.
- **Memory-aware:** optional pgvector-backed memory can recall useful context across conversations.
- **Product-ready:** the hosted version can support free and paid tiers, quotas, and Stripe billing.

## Architecture

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind, Radix UI |
| Backend | Supabase Edge Functions |
| Database | Supabase Postgres |
| Memory | pgvector-backed semantic search |
| Auth | Supabase Auth |
| Payments | Stripe-compatible subscription flow |

## Public Repo Boundary

This public repo should contain code and docs needed to understand, run, and self-host Tag. It should not contain:

- real API keys
- service-role keys
- production webhook secrets
- private customer/user data
- private business notes
- internal-only deployment assumptions

Use `.env.example` for placeholders and configure real secrets in the hosting provider or Supabase dashboard.

## Security Model

- Provider keys must be treated as secrets.
- Supabase service-role keys belong only in Edge Function/server environments.
- Database access should be protected by Row Level Security.
- BYOK keys should be stored client-side or in the self-hoster's own trusted infrastructure.
- Public examples should use placeholder project refs and placeholder environment values.

## Roadmap

- Improve self-hosting docs.
- Add screenshots and demo GIFs.
- Add a minimal local demo path.
- Add CI checks for lint/build when the standalone package setup is finalized.
- Keep public docs sanitized and easy to understand.
