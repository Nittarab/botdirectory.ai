// Edge-column sponsor layout shared by the home page and bot pages.
import { SPONSORING } from '../config';
import { familyStyle } from './constants';
import { SPONSORS, type Sponsor } from './data';

/** Balanced split that degrades gracefully below the design's 5-per-side. */
const edgePool = SPONSORS;
const half = Math.ceil(edgePool.length / 2);
export const edgeRight = edgePool.slice(0, half);
export const edgeLeft = edgePool.slice(half);
export const slotsLineBoth = `${SPONSORING.slotsTakenBoth} of ${SPONSORING.slotsTotalBoth} spots taken`;

export const tinted = SPONSORING.cardStyle === 'tinted';
export const edgeCardStyle = (s: Sponsor): string | undefined => {
  if (!tinted) return undefined;
  const f = familyStyle(s.family);
  return `background: ${f.bg}; border-color: ${f.border};`;
};
