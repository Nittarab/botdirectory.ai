import { validateBotInput } from '../../../src/lib/bot-file';
import { openBotPullRequest } from './github';
import { corsHeaders, json, methodNotAllowed, readJsonBody, requireWriteAuth } from './http';
import type { Env } from './types';

interface FeedBot {
  slug: string;
  name: string;
  category: string;
  addedAt: string;
  integrations: string[];
  prompt: string;
  contributor: string | null;
  sourceUrl: string | null;
  detailUrl: string;
}

interface Feed {
  version: number;
  bots: FeedBot[];
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export async function handleBots(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method === 'GET') return listBots(env, url);
  if (request.method === 'POST') return createBot(request, env);
  return methodNotAllowed('GET, POST, OPTIONS');
}

async function createBot(request: Request, env: Env): Promise<Response> {
  const denied = requireWriteAuth(request, env.API_WRITE_KEY);
  if (denied) return withCors(denied, 'POST');

  const body = await readJsonBody(request);
  if (!body.ok) return withCors(body.response, 'POST');

  const parsed = validateBotInput(body.value, { now: new Date().toISOString() });
  if (!parsed.ok) {
    return withCors(json({ error: 'validation failed', errors: parsed.errors }, { status: 400 }), 'POST');
  }

  // Soft dedupe against the live feed (PR CI still enforces uniqueness).
  const feed = await loadFeed(env);
  if (feed && feed.bots.some((b) => b.slug === parsed.value.slug)) {
    return withCors(
      json(
        {
          error: 'slug already exists',
          slug: parsed.value.slug,
          detailUrl: `https://botdirectory.ai/bots/${parsed.value.slug}/`,
        },
        { status: 409 },
      ),
      'POST',
    );
  }
  if (feed && parsed.value.data.url) {
    const urlDupe = feed.bots.find((b) => b.sourceUrl === parsed.value.data.url);
    if (urlDupe) {
      return withCors(
        json(
          {
            error: 'url already used by another bot',
            slug: urlDupe.slug,
            detailUrl: urlDupe.detailUrl,
          },
          { status: 409 },
        ),
        'POST',
      );
    }
  }

  const pr = await openBotPullRequest(env, {
    slug: parsed.value.slug,
    name: parsed.value.data.name,
    markdown: parsed.value.markdown,
    path: parsed.value.path,
  });
  if (!pr.ok) {
    const status = pr.status === 401 || pr.status === 403 ? 502 : pr.status >= 400 && pr.status < 600 ? pr.status : 502;
    return withCors(json({ error: pr.error }, { status }), 'POST');
  }

  return withCors(
    json(
      {
        ok: true,
        slug: parsed.value.slug,
        path: parsed.value.path,
        branch: pr.branch,
        prUrl: pr.prUrl,
        prNumber: pr.number,
      },
      { status: 201 },
    ),
    'POST',
  );
}

async function listBots(env: Env, url: URL): Promise<Response> {
  const feed = await loadFeed(env);
  if (!feed) return json({ error: 'catalog unavailable' }, { status: 502 });

  const q = (url.searchParams.get('q') || '').trim().toLowerCase() || null;
  const category = (url.searchParams.get('category') || '').trim() || null;
  const integration = (url.searchParams.get('integration') || '').trim() || null;
  const cursorParam = url.searchParams.get('cursor');

  let filtered = feed.bots.slice();
  if (q) {
    filtered = filtered.filter((b) => {
      const hay = [
        b.name,
        b.prompt,
        b.contributor ?? '',
        b.category,
        b.integrations.join(' '),
        b.slug,
      ]
        .join('\n')
        .toLowerCase();
      return hay.includes(q);
    });
  }
  if (category) {
    const needle = category.toLowerCase();
    filtered = filtered.filter((b) => b.category.toLowerCase() === needle);
  }
  if (integration) {
    const needle = integration.toLowerCase();
    filtered = filtered.filter((b) => b.integrations.some((i) => i.toLowerCase() === needle));
  }

  if (cursorParam !== null) {
    return syncList(url, filtered, q, category, integration, cursorParam);
  }

  const sortRaw = (url.searchParams.get('sort') || 'newest').toLowerCase();
  const sort = sortRaw === 'name' ? 'name' : 'newest';
  const page = parsePositiveInt(url.searchParams.get('page'), 1);
  const limit = parsePositiveInt(url.searchParams.get('limit'), DEFAULT_LIMIT);
  if (page === null || limit === null) {
    return json({ error: 'page and limit must be positive integers' }, { status: 400 });
  }
  const safeLimit = Math.min(limit, MAX_LIMIT);

  filtered.sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug);
    return b.addedAt.localeCompare(a.addedAt) || a.slug.localeCompare(b.slug);
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const start = (page - 1) * safeLimit;
  const pageBots = filtered.slice(start, start + safeLimit);
  const hasNext = page < totalPages && start + safeLimit < total;
  const hasPrevious = page > 1 && total > 0;

  const self = buildLink(url, { page, limit: safeLimit, q, category, integration, sort });
  return json(
    {
      version: 1,
      bots: pageBots,
      pagination: {
        page,
        limit: safeLimit,
        total,
        totalPages,
        hasNext,
        hasPrevious,
      },
      filters: { q, category, integration, sort },
      links: {
        self,
        next: hasNext
          ? buildLink(url, { page: page + 1, limit: safeLimit, q, category, integration, sort })
          : null,
        previous: hasPrevious
          ? buildLink(url, { page: page - 1, limit: safeLimit, q, category, integration, sort })
          : null,
      },
    },
    { cacheSeconds: 60, headers: corsHeaders('GET', url.pathname) },
  );
}

function syncList(
  url: URL,
  bots: FeedBot[],
  q: string | null,
  category: string | null,
  integration: string | null,
  cursorParam: string,
): Response {
  const limit = parsePositiveInt(url.searchParams.get('limit'), DEFAULT_LIMIT);
  if (limit === null) {
    return json({ error: 'page and limit must be positive integers' }, { status: 400 });
  }
  const safeLimit = Math.min(limit, MAX_LIMIT);

  // Append-safe: oldest → newest, then slug.
  const ordered = bots.slice().sort((a, b) => a.addedAt.localeCompare(b.addedAt) || a.slug.localeCompare(b.slug));

  let startIdx = 0;
  if (cursorParam !== 'start') {
    const decoded = decodeCursor(cursorParam);
    if (!decoded) return json({ error: 'invalid cursor' }, { status: 400 });
    const idx = ordered.findIndex(
      (b) => b.addedAt === decoded.addedAt && b.slug === decoded.slug,
    );
    startIdx = idx === -1 ? ordered.length : idx + 1;
  }

  const pageBots = ordered.slice(startIdx, startIdx + safeLimit);
  const hasMore = startIdx + safeLimit < ordered.length;
  const nextCursor =
    pageBots.length > 0
      ? encodeCursor(pageBots[pageBots.length - 1]!.addedAt, pageBots[pageBots.length - 1]!.slug)
      : null;

  return json(
    {
      version: 1,
      bots: pageBots,
      sync: {
        limit: safeLimit,
        returned: pageBots.length,
        hasMore,
        nextCursor: hasMore ? nextCursor : null,
      },
      filters: { q, category, integration, sort: 'oldest' },
      links: {
        next:
          hasMore && nextCursor
            ? buildSyncLink(url, { cursor: nextCursor, limit: safeLimit, q, category, integration })
            : null,
      },
    },
    { cacheSeconds: 60, headers: corsHeaders('GET', url.pathname) },
  );
}

async function loadFeed(env: Env): Promise<Feed | null> {
  const origin = (env.SITE_ORIGIN || 'https://botdirectory.ai').replace(/\/$/, '');
  const res = await fetch(`${origin}/api/bots.json`, {
    headers: { Accept: 'application/json', 'User-Agent': 'botdirectory-api' },
    cf: { cacheTtl: 60, cacheEverything: true },
  } as RequestInit);
  if (!res.ok) return null;
  try {
    return (await res.json()) as Feed;
  } catch {
    return null;
  }
}

function parsePositiveInt(raw: string | null, fallback: number): number | null {
  if (raw === null || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

function encodeCursor(addedAt: string, slug: string): string {
  const json = JSON.stringify([addedAt, slug]);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replace(/=+$/, '');
}

function decodeCursor(raw: string): { addedAt: string; slug: string } | null {
  try {
    const pad = '='.repeat((4 - (raw.length % 4)) % 4);
    const binary = atob(raw + pad);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 2) return null;
    const [addedAt, slug] = parsed;
    if (typeof addedAt !== 'string' || typeof slug !== 'string') return null;
    return { addedAt, slug };
  } catch {
    return null;
  }
}

function buildLink(
  url: URL,
  opts: {
    page: number;
    limit: number;
    q: string | null;
    category: string | null;
    integration: string | null;
    sort: string;
  },
): string {
  const u = new URL(url.origin + url.pathname);
  if (opts.q) u.searchParams.set('q', opts.q);
  if (opts.category) u.searchParams.set('category', opts.category);
  if (opts.integration) u.searchParams.set('integration', opts.integration);
  u.searchParams.set('limit', String(opts.limit));
  u.searchParams.set('page', String(opts.page));
  if (opts.sort !== 'newest') u.searchParams.set('sort', opts.sort);
  // Match live API query order loosely: limit before page when both set.
  return u.toString();
}

function buildSyncLink(
  url: URL,
  opts: {
    cursor: string;
    limit: number;
    q: string | null;
    category: string | null;
    integration: string | null;
  },
): string {
  const u = new URL(url.origin + url.pathname);
  u.searchParams.set('cursor', opts.cursor);
  u.searchParams.set('limit', String(opts.limit));
  if (opts.q) u.searchParams.set('q', opts.q);
  if (opts.category) u.searchParams.set('category', opts.category);
  if (opts.integration) u.searchParams.set('integration', opts.integration);
  return u.toString();
}

function withCors(response: Response, _method: string): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Key');
  return new Response(response.body, { status: response.status, headers });
}
