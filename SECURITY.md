# Security Policy

Tag is intended for authorized, educational, self-hosted, and production web-app use. It handles AI provider keys, chat data, auth sessions, and optional payment flows, so deployments should be configured carefully.

## Intended Use

- Self-hosted AI chat
- BYOK model experimentation
- Supabase Edge Function learning
- Secure web-app architecture practice

## Sensitive Data

Do not commit:

- provider API keys
- Supabase service-role keys
- Stripe secrets
- webhook secrets
- `.env` files
- user chat exports
- production database dumps

## Deployment Guidance

- Store secrets in Supabase/Vercel/provider dashboards, not in Git.
- Keep RLS enabled for user-owned data.
- Treat BYOK keys as sensitive.
- Use placeholder values in public docs.
- Rotate any secret that is accidentally committed.

## Reporting Issues

If you find a vulnerability or sensitive data in this repository, open a private security advisory or contact the maintainer directly.
