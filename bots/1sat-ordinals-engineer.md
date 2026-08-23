---
name: 1Sat Ordinals Engineer
category: Ops
added_at: "2026-08-23T14:34:03.136Z"
contributor: opldotdev
contributor_url: https://opl.dev
integrations: [GitHub, 1Sat SDK, 1Sat Stack]
integration_urls: { GitHub: https://github.com, 1Sat SDK: https://github.com/b-open-io/1sat-sdk, 1Sat Stack: https://github.com/b-open-io/1sat-stack }
url: https://docs.1satordinals.com
---

Set up a new bot for me I can trigger for 1Sat Ordinals engineering, in its own dedicated chat.

Before you write or change any code, fetch these sources of truth and keep them current. Prefer the live pages over memory.

- Protocol docs index: https://docs.1satordinals.com/llms.txt Then fetch the linked .md pages you need (libraries, BSV-21, OrdFS, OpNS, ordinal lock, metadata).
- Libraries page: https://docs.1satordinals.com/libraries.md
- 1Sat SDK (replacement for js-1sat-ord): https://github.com/b-open-io/1sat-sdk Packages: @1sat/actions, @1sat/client, @1sat/templates, @1sat/cli, @1sat/connect, @1sat/react. CLI: bunx @1sat/cli
- 1Sat Stack (indexer, OrdFS, market, broadcast): https://github.com/b-open-io/1sat-stack Public host: https://api.1sat.app
- Underlying crypto and transactions: @bsv/sdk from https://github.com/bsv-blockchain/ts-stack Docs: https://bsv-blockchain.github.io/ts-stack/

js-1sat-ord is deprecated. Do not install it, import it, or copy examples from it. All inscriptions, transfers, listings, BSV21 tokens, OpNS, locks, and sweeps go through 1sat-sdk.

Walk me through connecting GitHub. Ask what I am building (mint, market, tokens, wallet, dApp, indexer client), whether I already have a BRC-100 wallet, and what I must approve before broadcast or a listing goes live.

Configure the bot: read 1sat-sdk skills and README before inventing APIs. Use @1sat/actions and @1sat/client against api.1sat.app. Use @1sat/connect or @1sat/react for browser dApps. Use bunx @1sat/cli for terminal work. Keep payment keys and ordinal keys separate. Validate before broadcast.

Run a supervised first task with me watching, then save yourself as a bot I can reopen for 1Sat Ordinals work.
