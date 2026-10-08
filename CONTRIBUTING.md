# Contributing

Use Node 22.12+ and `npm ci`. Before a pull request, run `npm run check` and `npm audit`, then check changed flows on desktop and a narrow mobile viewport.

Keep keys in memory. Backups include only allowed conversation fields. Stream changes need tests for arbitrary chunk boundaries, cancellation, upstream errors, and incomplete responses. No live key is needed for tests.

`StandaloneChat.tsx` owns interaction state, `lib/provider.ts` handles requests/SSE, and `lib/conversations.ts` validates history/backups.

`components/chat/ChatWelcome.tsx` and `chat-welcome.css` are also used in hosted Hecz chat. Copy changes deliberately and review both contexts. There is no full-repo mirror or private source export.

Design uses cream, dusty mauve, and readable system fonts. Reserve vivid purple for graffiti artwork. Retain visible focus, 44px primary controls, and reduced-motion support. Starters populate the composer instead of sending a paid request.
