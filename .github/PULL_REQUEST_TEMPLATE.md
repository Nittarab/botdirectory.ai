## What's in this PR

<!-- One line: which bot you're adding or what you're changing. -->

## Checklist (adding a bot)

- [ ] One markdown file in `bots/`, named after the slug of the bot's `name`
      (lowercase, non-alphanumerics → `-`, e.g. `SEO Improver` → `bots/seo-improver.md`)
- [ ] Frontmatter has `name`, `category`, `contributor`, `integrations` (see CONTRIBUTING.md)
- [ ] Every integration exists in `data/tools.json` (or is added in this PR with its dot color + auth kind)
- [ ] The prompt is the file body, tested end to end in Grok Bot, Rakazo, or another agent
- [ ] `pnpm validate` passes locally
- [ ] This is a real, working bot — not an ad (promoted placement is the sponsor program, not a PR)
