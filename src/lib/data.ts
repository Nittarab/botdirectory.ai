import { getCollection } from 'astro:content';
import type { Category } from './constants';
import toolsJson from '../../data/tools.json';
import sponsorsJson from '../../data/sponsors.json';
import promosJson from '../../data/promos.json';


export interface Sponsor {
  name: string;
  initial: string;
  family: string;
  tagline: string;
  cta: string;
  url: string;
  /** Path under public/ to a real logo; falls back to the initial tile. */
  logo?: string;
}

export interface Promo {
  at: number;
  name: string;
  category: string;
  family: string;
  integrations: string[];
  contributor: string;
  href: string;
  note: string;
}

export interface Bot {
  slug: string;
  name: string;
  category: Category;
  /** Whose setup/prompt this is. Absent for anonymous/deleted sources. */
  contributor?: string;
  /** Where the contributor handle links (X profile, blog…). Defaults to GitHub. */
  contributorUrl?: string;
  /** X handle of whoever tagged/submitted someone else's setup. */
  scoutedBy?: string;
  copies: number;
  integrations: string[];
  prompt: string;
  url?: string;
  addedVia?: string;
}

/** Tool name → dot color. Purely cosmetic; unknown tools get a neutral dot. */
export const TOOLS = toolsJson as Record<string, string>;
export const SPONSORS = sponsorsJson as Sponsor[];
export const PROMOS = promosJson as Promo[];

export function toolDot(name: string): string {
  return TOOLS[name] ?? '#8E8E8E';
}

/** All bots, sorted by seed copies desc (the default view order). */
export async function getBots(): Promise<Bot[]> {
  const entries = await getCollection('bots');
  const bots = entries.map((e) => ({
    slug: e.id,
    name: e.data.name,
    category: e.data.category,
    contributor: e.data.contributor,
    contributorUrl: e.data.contributor_url,
    scoutedBy: e.data.scouted_by,
    // Counts live server-side (copies API), never in the repo markdown.
    copies: 0,
    integrations: e.data.integrations,
    prompt: (e.body ?? '').trim(),
    url: e.data.url,
    addedVia: e.data.added_via,
  }));
  return bots.sort((a, b) => a.name.localeCompare(b.name));
}
