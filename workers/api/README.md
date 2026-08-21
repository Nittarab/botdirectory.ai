# Public API worker (`api.botdirectory.ai`)

Cloudflare Worker that serves the public JSON API:

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/bots` | none | List / search / sync (unchanged contract) |
| `POST` | `/api/bots` | write key | Open a GitHub PR adding `bots/<slug>.md` |
| `POST` | `/api/feedback` | write key | Store feedback as a labeled GitHub issue |
| `GET` | `/api/feedback` | write key | List recent feedback |
| `GET`/`POST` | `/api/copies` | none | Copy counters (optional KV) |

## Verified vs hunches

- The X mention intake that opens `via-x` PRs lives **outside** this repo (sibling `botdirectory-automation`). `workers/t` here is only the PostHog proxy. This worker reuses the same *PR shape* (branch `bot/<slug>-…`, single `bots/*.md` add) rather than inventing a write-to-main path.
- There was no feedback store in this repo; feedback is persisted as GitHub issues labeled `feedback` (no new database).

## Secrets & deploy

```sh
# once per account (from repo root)
pnpm exec wrangler secret put API_WRITE_KEY -c workers/api/wrangler.jsonc
pnpm exec wrangler secret put GITHUB_TOKEN -c workers/api/wrangler.jsonc
# optional overrides
pnpm exec wrangler secret put GITHUB_REPO -c workers/api/wrangler.jsonc   # default elie222/botdirectory.ai
pnpm exec wrangler secret put SITE_ORIGIN -c workers/api/wrangler.jsonc   # default https://botdirectory.ai

pnpm deploy:api
```

`GITHUB_TOKEN` needs permission to create branches, contents, pull requests, and issues on the directory repo.

CI deploy is **opt-in**: set the GitHub Actions variable `DEPLOY_API_WORKER=true` after secrets are configured. Until then, deploy manually with `pnpm deploy:api`. Taking over the `api.botdirectory.ai` custom domain replaces the prior automation worker — bind the existing `COPIES` KV namespace first if you need to keep copy counts.

Optional copy-count KV (preserve the existing namespace ID when migrating off `botdirectory-automation`):

```sh
pnpm exec wrangler kv namespace create COPIES
# then add to workers/api/wrangler.jsonc:
# "kv_namespaces": [{ "binding": "COPIES", "id": "<id>" }]
```

Without that binding, `/api/copies` stays up but does not persist (so the site's fire-and-forget `trackCopy` calls do not 500).

## Auth

Write routes require one of:

```http
Authorization: Bearer <API_WRITE_KEY>
X-Api-Key: <API_WRITE_KEY>
```

Create a `via-api` label in the GitHub repo (optional; the worker still opens the PR if labeling fails). Create `feedback` / `feedback:*` labels for feedback issues (also optional).
