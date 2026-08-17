/** Shared, framework-free constants (also used by scripts/validate-bots.ts). */

export const CATEGORIES = ['Productivity', 'Sales', 'Marketing', 'Ops', 'Success', 'Personal'] as const;
export type Category = (typeof CATEGORIES)[number];

/** Category → color family (from the design). */
export const CAT_COLOR: Record<string, string> = {
  Productivity: 'blue',
  Sales: 'green',
  Marketing: 'orange',
  Ops: 'indigo',
  Success: 'pink',
  Personal: 'yellow',
};

/** Ink shade per family — pink and yellow top out at 500. */
export const CAT_INK: Record<string, string> = {
  blue: '600',
  purple: '600',
  green: '600',
  orange: '600',
  indigo: '600',
  pink: '500',
  yellow: '500',
};

export interface CatStyle {
  catBg: string;
  catFg: string;
  catBorder: string;
}

/** Same output as the design's catStyle() helper. */
export function catStyle(c: string): CatStyle {
  const f = CAT_COLOR[c] ?? 'blue';
  return {
    catBg: `var(--iz-${f}-50)`,
    catFg: `var(--iz-${f}-${CAT_INK[f] ?? '600'})`,
    catBorder: `var(--iz-${f}-150, var(--iz-${f}-200))`,
  };
}

/** Sponsor-family → logo tile colors (design's decorate() helper). */
export function familyStyle(family: string) {
  return {
    bg: `var(--iz-${family}-50)`,
    fg: `var(--iz-${family}-600)`,
    border: `var(--iz-${family}-150, var(--iz-${family}-200))`,
  };
}

/** Same as the design's slug() helper. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** 4820 → "4.8k", 2000 → "2k", 640 → "640" (design's fmt()). */
export function fmt(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : String(n);
}
