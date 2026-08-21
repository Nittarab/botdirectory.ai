import { BOT_LIMITS } from '../../../src/lib/bot-file';

export function corsHeaders(_method?: string, _pathname?: string): HeadersInit {
  // Copies stays open (keyless POST) to match today's site client; write routes
  // advertise POST in CORS but still require the API key in the handler.
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key',
    'Access-Control-Max-Age': '86400',
  };
}

export function json(
  body: unknown,
  init: ResponseInit & { cacheSeconds?: number } = {},
): Response {
  const { cacheSeconds, headers: extra, ...rest } = init;
  const headers = new Headers(extra);
  headers.set('Content-Type', 'application/json');
  if (!headers.has('Access-Control-Allow-Origin')) {
    headers.set('Access-Control-Allow-Origin', '*');
  }
  if (cacheSeconds !== undefined) {
    headers.set('Cache-Control', `public, max-age=${cacheSeconds}`);
  } else if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'no-store');
  }
  return new Response(JSON.stringify(body), { ...rest, headers });
}

export function methodNotAllowed(allow: string): Response {
  return json(
    { error: 'method not allowed' },
    { status: 405, headers: { Allow: allow, 'Access-Control-Allow-Methods': allow } },
  );
}

export function requireWriteAuth(request: Request, expected: string | undefined): Response | null {
  if (!expected) {
    return json({ error: 'write API is not configured (missing API_WRITE_KEY)' }, { status: 503 });
  }
  const bearer = request.headers.get('Authorization');
  const headerKey = request.headers.get('X-Api-Key');
  const token =
    (bearer && /^Bearer\s+(.+)$/i.exec(bearer)?.[1]?.trim()) ||
    headerKey?.trim() ||
    '';
  if (!token || token !== expected) {
    return json({ error: 'unauthorized' }, { status: 401 });
  }
  return null;
}

export async function readJsonBody(
  request: Request,
  maxBytes = BOT_LIMITS.bodyBytes,
): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  const length = Number(request.headers.get('Content-Length') || '0');
  if (length > maxBytes) {
    return { ok: false, response: json({ error: 'body too large' }, { status: 413 }) };
  }
  const buf = await request.arrayBuffer();
  if (buf.byteLength > maxBytes) {
    return { ok: false, response: json({ error: 'body too large' }, { status: 413 }) };
  }
  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(buf)) as unknown };
  } catch {
    return { ok: false, response: json({ error: 'invalid json' }, { status: 400 }) };
  }
}
