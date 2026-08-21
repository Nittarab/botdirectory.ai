import { json, methodNotAllowed } from './http';
import type { Env } from './types';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Copy counters. When the COPIES KV binding is present, behavior matches the
 * live keyless endpoint. When unbound (fresh deploy before KV is wired), GET
 * returns an empty map and POST acknowledges without persisting — so taking
 * over api.botdirectory.ai does not 500 the site's trackCopy() calls.
 */
export async function handleCopies(
  request: Request,
  env: Env,
  url: URL,
  _ctx: ExecutionContext,
): Promise<Response> {
  if (request.method === 'GET') return getCopies(env, url);
  if (request.method === 'POST') return postCopy(request, env);
  return methodNotAllowed('GET, POST, OPTIONS');
}

async function getCopies(env: Env, url: URL): Promise<Response> {
  const slug = url.searchParams.get('slug')?.trim();
  if (slug) {
    if (!SLUG_RE.test(slug)) return json({ error: 'invalid slug' }, { status: 400 });
    const copies = env.COPIES ? Number((await env.COPIES.get(`copies:${slug}`)) || '0') : 0;
    return json({ slug, copies }, { cacheSeconds: 60 });
  }

  if (!env.COPIES) return json({ counts: {} }, { cacheSeconds: 60 });

  const listed = await env.COPIES.list({ prefix: 'copies:' });
  const counts: Record<string, number> = {};
  for (const key of listed.keys) {
    const slugKey = key.name.slice('copies:'.length);
    const raw = await env.COPIES.get(key.name);
    const n = Number(raw || '0');
    if (n > 0) counts[slugKey] = n;
  }
  return json({ counts }, { cacheSeconds: 60 });
}

async function postCopy(request: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid json' }, { status: 400 });
  }
  const slug =
    body && typeof body === 'object' && 'slug' in body
      ? String((body as { slug: unknown }).slug || '').trim()
      : '';
  if (!slug || !SLUG_RE.test(slug)) {
    return json({ error: 'invalid slug' }, { status: 400 });
  }

  if (!env.COPIES) {
    return json({ slug, copies: 0, counted: false });
  }

  const key = `copies:${slug}`;
  const current = Number((await env.COPIES.get(key)) || '0');
  const next = current + 1;
  await env.COPIES.put(key, String(next));
  return json({ slug, copies: next, counted: true });
}
