/**
 * Downloads the integration icons listed in data/tool-icons.json into
 * public/icons/. Run with: pnpm icons
 *
 * Entry shapes:
 *   "Slack":  "https://svgl.app/library/slack.svg"            — a direct image URL
 *   "GitHub": { "light": "…light.svg", "dark": "…dark.svg" }  — mono logo, one per theme
 *   "Gong":   { "site": "https://www.gong.io" }               — pull the site's own favicon
 *
 * Preferred sources are svgl.app (full-color brand marks) and Simple Icons
 * (brand-colored via cdn.simpleicons.org). For tools neither covers, `site`
 * fetches the homepage and picks its best icon: apple-touch-icon, else the
 * largest <link rel="icon">, else /favicon.ico.
 *
 * Files are committed, so the site build never hits the network; re-run this
 * only when adding or changing an entry.
 *
 * Output: public/icons/<slugify(name)>.<ext>, plus <slug>-dark.<ext> for the
 * light/dark form. The extension follows the bytes (svg/png/jpg/ico);
 * src/lib/data.ts finds files by slug, so it never needs to know which.
 */
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugify } from '../src/lib/constants';
import manifest from '../data/tool-icons.json';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'icons');
mkdirSync(OUT, { recursive: true });

type Entry = string | { light: string; dark: string } | { site: string };

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const TIMEOUT_MS = 15_000;

const EXT_BY_TYPE: Record<string, string> = {
  'image/svg+xml': 'svg',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
};

/** Servers mislabel favicons often enough that we trust magic bytes over Content-Type. */
function sniff(bytes: Uint8Array, contentType: string): string | null {
  const head = Buffer.from(bytes.subarray(0, 64)).toString('latin1');
  if (head.startsWith('\x89PNG')) return 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpg';
  if (bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0) return 'ico';
  if (/^\s*(<\?xml|<svg)/.test(head)) return 'svg';
  return EXT_BY_TYPE[contentType.split(';')[0].trim()] ?? null;
}

async function get(url: string, accept: string): Promise<Response> {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res;
}

async function fetchImage(url: string): Promise<{ ext: string; bytes: Uint8Array }> {
  const res = await get(url, 'image/*,*/*;q=0.8');
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length === 0) throw new Error('empty response');
  const ext = sniff(bytes, res.headers.get('content-type') ?? '');
  if (!ext) throw new Error('not an image we handle (svg/png/jpg/ico)');
  return { ext, bytes };
}

/** Icon candidates from a page's <link> tags, best first. */
function iconLinks(html: string, base: string): string[] {
  const out: Array<{ href: string; score: number }> = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const attr = (n: string) => tag.match(new RegExp(`\\b${n}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
    const rel = (attr('rel')?.[2] ?? attr('rel')?.[3] ?? attr('rel')?.[4] ?? '').toLowerCase();
    const href = attr('href')?.[2] ?? attr('href')?.[3] ?? attr('href')?.[4];
    if (!href || !/\bicon\b/.test(rel) || /mask-icon/.test(rel)) continue;
    const sizes = attr('sizes')?.[2] ?? attr('sizes')?.[3] ?? attr('sizes')?.[4] ?? '';
    const px = Math.max(0, ...sizes.split(/\s+/).map((s) => parseInt(s, 10) || 0));
    // apple-touch-icons are the reliably large, square, opaque ones.
    const score = (rel.includes('apple-touch-icon') ? 10_000 : 0) + (px || (/\.svg(\?|$)/i.test(href) ? 512 : 32));
    try {
      out.push({ href: new URL(href, base).href, score });
    } catch {
      /* ignore malformed hrefs */
    }
  }
  return out.sort((a, b) => b.score - a.score).map((c) => c.href);
}

async function fetchSiteIcon(site: string): Promise<{ ext: string; bytes: Uint8Array; url: string }> {
  const candidates: string[] = [];
  let pageUrl = site;
  try {
    const res = await get(site, 'text/html,*/*;q=0.8');
    pageUrl = res.url || site;
    candidates.push(...iconLinks(await res.text(), pageUrl));
  } catch (err) {
    console.warn(`  (page fetch failed for ${site}: ${(err as Error).message}; trying /favicon.ico)`);
  }
  candidates.push(new URL('/apple-touch-icon.png', pageUrl).href, new URL('/favicon.ico', pageUrl).href);
  const errors: string[] = [];
  for (const url of [...new Set(candidates)]) {
    try {
      return { ...(await fetchImage(url)), url };
    } catch (err) {
      errors.push(`${url}: ${(err as Error).message}`);
    }
  }
  throw new Error(`no usable icon\n    ${errors.join('\n    ')}`);
}

/** Drop any earlier download for this base name so an extension change leaves no stale file. */
function removeExisting(base: string) {
  for (const f of readdirSync(OUT)) {
    if (f.startsWith(base + '.')) unlinkSync(join(OUT, f));
  }
}

async function save(base: string, job: () => Promise<{ ext: string; bytes: Uint8Array; url?: string }>, label: string) {
  try {
    const { ext, bytes, url } = await job();
    removeExisting(base);
    writeFileSync(join(OUT, `${base}.${ext}`), bytes);
    console.log(`✓ ${base}.${ext}  ←  ${url ?? label}`);
    return true;
  } catch (err) {
    console.error(`✗ ${base}  ←  ${label}: ${(err as Error).message}`);
    return false;
  }
}

const only = new Set(process.argv.slice(2)); // optional: pnpm icons Gong "Comp AI"
let failed = 0;
for (const [name, entry] of Object.entries(manifest as Record<string, Entry>)) {
  if (only.size && !only.has(name)) continue;
  const slug = slugify(name);
  const jobs: Array<Promise<boolean>> = [];
  if (typeof entry === 'string') {
    jobs.push(save(slug, () => fetchImage(entry), entry));
  } else if ('site' in entry) {
    jobs.push(save(slug, () => fetchSiteIcon(entry.site), entry.site));
  } else {
    jobs.push(save(slug, () => fetchImage(entry.light), entry.light));
    jobs.push(save(`${slug}-dark`, () => fetchImage(entry.dark), entry.dark));
  }
  for (const ok of await Promise.all(jobs)) if (!ok) failed++;
}

if (failed) {
  console.error(`\n${failed} icon(s) failed to download.`);
  process.exit(1);
}
