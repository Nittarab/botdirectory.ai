# Contributing

A bot is one markdown file in `bots/`. Add the file, open a pull request, and it
shows up on [botdirectory.ai](https://botdirectory.ai). No plugin API, no review
board.

Prefer not to touch git? Tag **@botdirectoryai** on X with your prompt and the
mention bot will open the PR for you.

## The bot file contract

`bots/<slug>.md` — the slug is the `name` lowercased with every run of
non-alphanumerics replaced by `-` (e.g. `SEO Improver` → `seo-improver`).

```markdown
---
name: SEO Improver
category: Marketing
contributor: elie2222                    # optional — whose setup this is
contributor_url: https://x.com/elie2222  # optional — where the handle links (default: GitHub)
scouted_by: someoneelse                # optional — X handle of whoever found/submitted it
integrations: [GitHub, DataForSEO, Search Console]
url: https://example.com/my-bot        # optional — canonical homepage (dedupe key)
added_via: https://x.com/.../status/…  # optional — set by the X mention bot
---

<the prompt, verbatim, as the file body>
```

- **name** — what the bot is called on the shelf.
- **category** — one of: `Productivity`, `Sales`, `Marketing`, `Ops`, `Success`,
  `Personal`. Pick the closest fit — this list is deliberately short and curated.
- **contributor** — whose setup/prompt this is (optional; omit for anonymous
  sources). Links to `contributor_url` if set, else `github.com/<contributor>`.
- **scouted_by** — if you're submitting someone *else's* setup (say, from a
  tweet), put the author in `contributor` and your own X handle here — you get
  a "scouted by" credit on the page.
- **integrations** — the tools the prompt connects, as plain names
  (`[Gmail, Notion, Stripe]`). Any tool name is welcome — there's no fixed list.
  If the tool has an entry in [`data/tools.json`](data/tools.json) it gets its
  brand-colored dot; unknown tools get a neutral one. Adding a `tools.json`
  entry for a new tool is appreciated but optional:

  ```json
  "Stripe": "#6410FF"
  ```

- Copy counts are **not** part of the file — they're tracked server-side and
  start at zero for every bot.
- The **body is the prompt itself** — exactly what someone pastes into Grok Bot
  or Rakazo. No extra prose around it.

The value is the chip's dot color — pick the closest family color already in use.

## Quality bar

- **Real bot, working prompt.** You ran it end to end in Grok Bot, Rakazo, or
  another agent before opening the PR.
- **Self-contained.** The prompt should ask for what it needs (connections,
  schedules, context) and end by saving itself as a bot.
- **No pure ads.** A bot that exists to funnel people to your product will be
  closed — promoted placement is the [sponsor program](https://botdirectory.ai/#sponsor),
  not a PR.

## Checks

Every PR runs `pnpm validate` (schema, filename = slug, unique slug, known
category, non-empty prompt, unique `url`) plus `astro check` and a full
build. Run them locally:

```sh
pnpm install
pnpm validate
pnpm build
```

## Local dev

```sh
pnpm install
pnpm dev        # http://localhost:4321
```
