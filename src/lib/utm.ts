/**
 * Outbound-link tagging. Sponsors get placement-level campaigns so
 * analytics can say which slot drove the click; product links get a
 * plain referral tag. Existing query params on the target are preserved.
 */
const SOURCE = 'botdirectory.ai';

function withParams(url: string, params: Record<string, string>): string {
  try {
    const u = new URL(url);
    for (const [k, v] of Object.entries(params)) {
      if (!u.searchParams.has(k)) u.searchParams.set(k, v);
    }
    return u.toString();
  } catch {
    return url;
  }
}

export type SponsorPlacement = 'edge' | 'rail' | 'marquee' | 'bot-page' | 'connect' | 'promo' | 'sponsor-page';

export function sponsorUrl(url: string, placement: SponsorPlacement): string {
  return withParams(url, { utm_source: SOURCE, utm_medium: 'sponsor', utm_campaign: placement });
}

export function outboundUrl(url: string): string {
  return withParams(url, { utm_source: SOURCE, utm_medium: 'referral' });
}
