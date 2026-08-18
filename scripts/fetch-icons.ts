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
 * Curated files are committed. `pnpm icons:sync` additionally fills gaps at
 * deploy time: it discovers exact Simple Icons matches and uses Google's
 * favicon proxy for official `integration_urls` stored in bot frontmatter.
 * Unknown/generic integrations still receive the UI's monogram fallback.
 *
 * Output: public/icons/<slugify(name)>.<ext>, plus <slug>-dark.<ext> for the
 * light/dark form. The extension follows the bytes (svg/png/jpg); .ico is
 * converted to .png. src/lib/data.ts finds files by slug, so it never needs
 * to know which.
 *
 * Rasters are shrunk to MAX_PX (we render icons at 14–18px, so 64px covers
 * 3× screens) with macOS `sips`; on other platforms they're kept as-is with
 * a note. Run ImageOptim (or `svgo`) over public/icons/ afterwards to
 * squeeze the bytes.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { slugify } from '../src/lib/constants';
import manifest from '../data/tool-icons.json';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'icons');
mkdirSync(OUT, { recursive: true });

type Entry = string | { light: string; dark: string } | { site: string };

const MAX_PX = 64;
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

/**
 * Fetch through Google's favicon proxy for URLs contributed in bot markdown.
 * This keeps the deploy runner from requesting an untrusted host directly.
 */
async function fetchProxiedFavicon(site: string): Promise<{ ext: string; bytes: Uint8Array; url: string }> {
  const url = new URL('https://www.google.com/s2/favicons');
  url.searchParams.set('domain_url', site);
  url.searchParams.set('sz', String(MAX_PX));
  return { ...(await fetchImage(url.href)), url: url.href };
}

/** Exact brand matches from Simple Icons; broad/fuzzy matches are rejected. */
async function simpleIconUrl(name: string): Promise<string | null> {
  const candidates = [
    name,
    name.replace(/\s+(?:CLI|Background Agents|Cloud Agents)$/i, ''),
  ].filter((value, index, all) => value && all.indexOf(value) === index);

  for (const candidate of candidates) {
    const url = new URL('https://api.iconify.design/search');
    url.searchParams.set('query', candidate);
    url.searchParams.set('prefixes', 'simple-icons');
    url.searchParams.set('limit', '10');
    const result = (await (await get(url.href, 'application/json')).json()) as { icons?: string[] };
    const expected = slugify(candidate).replace(/-/g, '');
    const exact = result.icons?.find((icon) => {
      const id = icon.slice(icon.indexOf(':') + 1);
      return slugify(id).replace(/-/g, '') === expected;
    });
    if (exact) return `https://cdn.simpleicons.org/${exact.slice(exact.indexOf(':') + 1)}`;
  }
  return null;
}

/** Every integration in bot markdown, plus an optional official homepage. */
function botIntegrations(): Map<string, string | undefined> {
  const result = new Map<string, string | undefined>();
  const botsDir = join(ROOT, 'bots');
  for (const file of readdirSync(botsDir).filter((name) => name.endsWith('.md'))) {
    const raw = readFileSync(join(botsDir, file), 'utf8');
    const frontmatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!frontmatter) continue;
    const data = parseYaml(frontmatter[1]!) as {
      integrations?: unknown;
      integration_urls?: unknown;
    };
    const integrations = Array.isArray(data.integrations)
      ? data.integrations.filter((name): name is string => typeof name === 'string')
      : [];
    const sites = data.integration_urls && typeof data.integration_urls === 'object'
      ? data.integration_urls as Record<string, unknown>
      : {};
    for (const name of integrations) {
      const site = typeof sites[name] === 'string' ? sites[name] : undefined;
      if (!result.has(name) || (!result.get(name) && site)) result.set(name, site);
    }
  }
  return result;
}

/** Drop any earlier download for this base name so an extension change leaves no stale file. */
function removeExisting(base: string) {
  for (const f of readdirSync(OUT)) {
    if (f.startsWith(base + '.')) unlinkSync(join(OUT, f));
  }
}

function hasIcon(base: string): boolean {
  return readdirSync(OUT).some((file) => file.slice(0, file.lastIndexOf('.')) === base);
}

let sipsMissing = false;
/** Shrink a raster to MAX_PX and normalise .ico → .png. Returns the final filename. */
function shrink(base: string, ext: string): string {
  if (ext === 'svg') return `${base}.${ext}`;
  const src = join(OUT, `${base}.${ext}`);
  const outExt = ext === 'ico' ? 'png' : ext;
  const dest = join(OUT, `${base}.${outExt}`);
  try {
    const px = Math.max(...execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', src], { encoding: 'utf8' })
      .split('\n').map((l) => parseInt(l.split(':').pop() ?? '', 10) || 0));
    if (px <= MAX_PX && outExt === ext) return `${base}.${ext}`;
    // -Z fits within MAX_PX; never upscale — sips would happily blur a 16px favicon up to 64.
    const size = px > MAX_PX ? ['-Z', String(MAX_PX)] : [];
    execFileSync('sips', ['-s', 'format', outExt === 'jpg' ? 'jpeg' : outExt, ...size, src, '--out', dest], { stdio: 'ignore' });
    if (dest !== src) unlinkSync(src);
    return `${base}.${outExt}`;
  } catch {
    if (!sipsMissing) console.warn('  (sips not available — rasters kept at original size; resize them by hand)');
    sipsMissing = true;
    return `${base}.${ext}`;
  }
}

async function save(base: string, job: () => Promise<{ ext: string; bytes: Uint8Array; url?: string }>, label: string) {
  try {
    const { ext, bytes, url } = await job();
    removeExisting(base);
    writeFileSync(join(OUT, `${base}.${ext}`), bytes);
    const file = shrink(base, ext);
    console.log(`✓ ${file}  ←  ${url ?? label}`);
    return true;
  } catch (err) {
    console.error(`✗ ${base}  ←  ${label}: ${(err as Error).message}`);
    return false;
  }
}

const args = process.argv.slice(2);
const sync = args.includes('--sync');
const only = new Set(args.filter((arg) => !arg.startsWith('--'))); // optional: pnpm icons Gong "Comp AI"
let failed = 0;
for (const [name, entry] of Object.entries(manifest as Record<string, Entry>)) {
  if (only.size && !only.has(name)) continue;
  const slug = slugify(name);
  if (sync) {
    const complete = typeof entry === 'object' && 'light' in entry
      ? hasIcon(slug) && hasIcon(`${slug}-dark`)
      : hasIcon(slug);
    if (complete) continue;
  }
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

if (sync) {
  console.log('\nSyncing icons for integrations used by bot files…');
  for (const [name, site] of botIntegrations()) {
    const slug = slugify(name);
    if (hasIcon(slug)) continue;

    try {
      if (site) {
        const ok = await save(slug, () => fetchProxiedFavicon(site), site);
        if (!ok) console.warn(`  ${name}: favicon unavailable; using monogram fallback`);
        continue;
      }
      const iconUrl = await simpleIconUrl(name);
      if (iconUrl) {
        const ok = await save(slug, () => fetchImage(iconUrl), iconUrl);
        if (!ok) console.warn(`  ${name}: brand icon unavailable; using monogram fallback`);
      } else {
        console.log(`· ${name}: no exact brand match; using monogram fallback`);
      }
    } catch (err) {
      console.warn(`  ${name}: discovery failed (${(err as Error).message}); using monogram fallback`);
    }
  }
}

if (failed) {
  console.error(`\n${failed} icon(s) failed to download.`);
  process.exit(1);
}
