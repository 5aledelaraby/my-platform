# ADR 0006: Secrets live only in Cloudflare and GitHub Actions

Status: accepted

## Decision
- The Meta Conversions API token is the Cloudflare Worker secret `META_TOKEN`. It never appears in code, config, docs, chat, or logs.
- Public identifiers (GA4 Measurement ID, Meta Pixel/Dataset ID) are not secrets and may live in config.
- `tools/architecture/check-secrets.mjs` runs in CI and blocks known token shapes (Meta `EAA...`, GitHub, Anthropic, OpenAI-style, AWS, private keys).
- Deploy credentials, if needed, are GitHub Actions secrets with least privilege.
- AI assistants must never be given tokens or passwords (see AGENTS.md).

## Consequences
- If a secret is ever committed, it is considered leaked: rotate it first, then clean history.
