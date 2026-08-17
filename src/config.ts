/**
 * Every branded string, URL and knob for the site lives here — nowhere else.
 * Change the repo URL / handles / sponsor numbers in this one file.
 */

export type SponsorMode = 'rail' | 'both' | 'inline';

export const SITE = {
  /** Wordmark shown in the header, footer and `<title>` suffix. */
  wordmark: 'botdirectory.ai',
  /** Canonical origin (no trailing slash). */
  url: 'https://botdirectory.ai',
  /** Default meta description / footer blurb. */
  tagline: 'Open source prompts for Grok Bot and Rakazo. Copy one, connect your tools, done.',
  /** X handle the mention bot listens on. */
  xHandle: '@botdirectoryai',
  xUrl: 'https://x.com/botdirectoryai',

  /** Public GitHub repo (placeholder org until the real one exists). */
  repoUrl: 'https://github.com/elie222/botdirectory',
  contributingUrl: 'https://github.com/elie222/botdirectory/blob/main/CONTRIBUTING.md',

  /** Products linked from the header / footer / copy. */
  rakazoUrl: 'https://rakazo.com',
  grokBotUrl: 'https://x.ai/bot',
  grokUrl: 'https://grok.com',
  inboxZeroUrl: 'https://getinboxzero.com',

  copyrightHolder: 'Inbox Zero Inc.',
  copyrightYear: 2026,

  /** Where "Book a slot" points until a real booking flow exists. */
  sponsorContactUrl: 'mailto:elie@getinboxzero.com',
} as const;

export const SPONSORING = {
  /**
   * Slot layout. 'rail' (default): right rail next to the list.
   * 'both': sticky page-edge columns ≥1440px. 'inline': promos spliced
   * into the list at fixed indexes (data/promos.json).
   */
  mode: 'both' as SponsorMode,
  /**
   * Edge-card look (design prop `sponsorCardStyle`). 'plain': white card,
   * colored logo tile. 'tinted': full-card color wash per sponsor family
   * (TrustMRR-style).
   */
  cardStyle: 'tinted' as 'plain' | 'tinted',
  /** "3 of 6 taken" line next to the rail. */
  slotsTaken: 3,
  slotsTotal: 6,
  /** "N of M taken" when mode === 'both'. */
  slotsTakenBoth: 10,
  slotsTotalBoth: 15,
  /** Stripe payment link for booking a slot. */
  paymentUrl: 'https://buy.stripe.com/fZu7sM3DLezU8pD4u64ko02',
  /** Current monthly price in USD — rises as slots fill. */
  priceMonthly: 800,
  /** Copy inside the "Your tool here" empty slot. */
  railPitch: 'Reach people setting up bots right now. $800/mo.',
} as const;

export const COPIES_API = {
  /**
   * When true, every prompt copy also fires a fire-and-forget
   * POST { slug } to `endpoint` so counts aggregate globally.
   * The endpoint is the Cloudflare Worker in ../botdirectory-automation/api —
   * flip on once it's deployed and `endpoint` points at it.
   */
  enabled: true,
  endpoint: 'https://api.botdirectory.ai/api/copies',
} as const;

export const FEATURES = {
  /**
   * Show copy counts (table column, card meta, bot-page badge) and the
   * "Most copied" sort. OFF at launch — real counts start at zero and
   * seed numbers would be fake. Copies are still *tracked* while hidden
   * (localStorage + API when enabled), so there's data by the time this
   * flips on.
   */
  showCopies: false,
} as const;
