# Security

Report privately through [GitHub private vulnerability reporting](https://github.com/h3cz/tag/security/advisories/new) if available. Otherwise contact **info@hecz.dev** with reproduction steps and affected versions. Never post real keys, private conversations, or personal data in public issues.

The maintained code is the default branch; no other release line is supported.

## Trust model

- Keys stay in memory and go only to the selected fixed provider endpoint. Never store them in localStorage, logs, backups, or client environment variables.
- History is local and unencrypted. Providers receive request content. Enter keys only into trusted builds on origins you trust.
- Model output is untrusted. Markdown HTML is sanitized; links open separately without an opener. Keep rendering dependencies patched.
- Imports are bounded, validated, and reconstructed from allowed fields. Invalid roles and duplicate IDs are rejected.
- This app has no authentication, server proxy, billing, or shared database. Hosting it doesn't grant access to Hecz's managed service.

Review dependencies and headers when deploying. A malicious extension or script on the app's origin can access in-memory credentials; Tag cannot protect a compromised browser or host.
