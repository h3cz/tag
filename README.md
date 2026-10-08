# Tag

**Your models. Your key. Your own little thinking space.**

Tag is an open-source, browser-based AI chat app. Run it locally or deploy it as a static site. No account, database, Supabase project, or Hecz backend is required.

The separately operated [hosted Tag](https://hecz.dev/chat) offers managed models and account features. This repository is the standalone BYOK edition, not a deployment of that service.

## Start here

Requires **Node 22.12+** and npm.

```sh
git clone https://github.com/h3cz/tag.git
cd tag
npm ci
npm run dev
```

Open the URL Vite prints, select **Connect a provider**, enter a model ID and API key, and start a conversation. No `.env` file is needed. Model availability and charges depend on your provider; the suggested IDs are editable defaults.

## What works

- Direct streaming chat with OpenRouter, OpenAI, Google AI, Synthetic, or local Ollama using their OpenAI-compatible chat endpoints.
- Local conversation history, full-text search, stop/retry, Markdown with highlighted code, and copy controls.
- Create / Build / Learn starters that draft a prompt for review before sending.
- JSON backup/restore and Markdown exports. Backups contain conversations only.
- An optional system instruction, mobile navigation, keyboard shortcuts, and reduced-motion support.

`Ctrl/Cmd + K` focuses the composer; `Ctrl/Cmd + Shift + F` searches history. Enter sends; Shift + Enter adds a line. Input-method composition is respected.

## Privacy and storage

Your API key stays in tab memory. Reloading clears it. It is never written to browser storage, included in exports, sent to Hecz, or embedded in the build. Requests go directly to the selected provider, which receives your messages and system instruction. Only enter a key on an instance you trust; extensions and injected scripts can read in-memory data.

Conversations and non-secret settings are stored in this browser's localStorage, unencrypted. Clearing site data removes them. Keep backups, especially in private browsing. History is limited to 100 conversations, 500 messages per conversation, and 4 MB total. Storage failures appear in the UI. Tag has no analytics, external font requests, or account system. Linked provider/GitHub/Hecz pages are separate services.

## Local models

Install [Ollama](https://docs.ollama.com), pull a model, and allow Tag's exact origin. With Tag at `http://localhost:5173`:

```sh
ollama pull llama3.2
OLLAMA_ORIGINS=http://localhost:5173 ollama serve
```

PowerShell:

```powershell
$env:OLLAMA_ORIGINS = 'http://localhost:5173'
ollama serve
```

Quit an already-running Ollama before restarting with this setting. Select **Ollama (local)** and the model you pulled; no key is required. Match `OLLAMA_ORIGINS` to the actual URL, including the port (`localhost` and `127.0.0.1` differ). Run Tag locally for Ollama: public HTTPS sites may be blocked from local HTTP by browser mixed-content or local-network restrictions.

## Build and deploy

```sh
npm run check
npm run preview
```

`check` runs strict TypeScript, stream/backup tests, and the production build. Deploy `dist/` to a static host. No server secrets are needed. See [SELFHOSTING.md](SELFHOSTING.md).

## Scope

This edition focuses on local text chat. Hecz subscriptions, shared workspaces, server memory, images, integrations, and agents belong to the hosted service. Provider CORS policies must allow browser requests; Tag does not run a relay to bypass them. Live calls need your key and credits; automated tests use fixtures, not billable requests.

This repo is maintained independently. The partial monorepo mirror has been replaced with a complete standalone application. There is no automatic overwrite from the private repo. Welcome component changes are shared deliberately; see [CONTRIBUTING.md](CONTRIBUTING.md).

See [SECURITY.md](SECURITY.md) and [CHANGELOG.md](CHANGELOG.md). MIT licensed; see [LICENSE](LICENSE). Tag artwork identifies this project; don't imply affiliation when publishing a modified service.
