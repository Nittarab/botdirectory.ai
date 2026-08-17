// Copies counter: rendered count = seed copies + a local per-slug delta
// kept in localStorage. Optionally also POSTs to the copies API (config
// flag, ships off) so counts can aggregate globally later.
import { COPIES_API } from '../config';
import { fmt } from '../lib/constants';

const KEY = 'openbots-copies';

function local(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

export function deltaFor(slug: string): number {
  return local()[slug] || 0;
}

export function trackCopy(slug: string): void {
  const m = local();
  m[slug] = (m[slug] || 0) + 1;
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* private mode */
  }
  if (COPIES_API.enabled) {
    try {
      fetch(COPIES_API.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* fire and forget */
    }
  }
}

/**
 * Refresh every element carrying data-copies-slug/data-copies-seed
 * to `fmt(seed + delta) + ' copies'`.
 */
export function refreshCopyLabels(root: ParentNode = document): void {
  const deltas = local();
  root.querySelectorAll<HTMLElement>('[data-copies-slug]').forEach((el) => {
    const slug = el.dataset.copiesSlug || '';
    const seed = Number(el.dataset.copiesSeed || '0');
    el.textContent = fmt(seed + (deltas[slug] || 0)) + ' copies';
  });
}

export { fmt };
