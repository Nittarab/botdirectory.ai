import { validateFeedbackInput } from '../../../src/lib/bot-file';
import { createFeedbackIssue, listFeedbackIssues } from './github';
import { json, methodNotAllowed, readJsonBody, requireWriteAuth } from './http';
import type { Env } from './types';

export async function handleFeedback(request: Request, env: Env, url: URL): Promise<Response> {
  const denied = requireWriteAuth(request, env.API_WRITE_KEY);
  if (denied) return withCors(denied);

  if (request.method === 'POST') return submitFeedback(request, env);
  if (request.method === 'GET') return listFeedback(env, url);
  return withCors(methodNotAllowed('GET, POST, OPTIONS'));
}

async function submitFeedback(request: Request, env: Env): Promise<Response> {
  const body = await readJsonBody(request, 20_000);
  if (!body.ok) return withCors(body.response);

  const parsed = validateFeedbackInput(body.value);
  if (!parsed.ok) {
    return withCors(json({ error: 'validation failed', errors: parsed.errors }, { status: 400 }));
  }

  const created = await createFeedbackIssue(env, parsed.value);
  if (!created.ok) {
    return withCors(json({ error: created.error }, { status: created.status === 401 ? 502 : 502 }));
  }

  return withCors(
    json(
      {
        ok: true,
        id: created.id,
        number: created.number,
        url: created.url,
        slug: parsed.value.slug,
        kind: parsed.value.kind ?? null,
        rating: parsed.value.rating ?? null,
      },
      { status: 201 },
    ),
  );
}

async function listFeedback(env: Env, url: URL): Promise<Response> {
  const limitRaw = url.searchParams.get('limit');
  let limit = 25;
  if (limitRaw !== null && limitRaw !== '') {
    if (!/^\d+$/.test(limitRaw)) {
      return withCors(json({ error: 'limit must be a positive integer' }, { status: 400 }));
    }
    limit = Math.min(100, Math.max(1, Number(limitRaw)));
  }

  const listed = await listFeedbackIssues(env, limit);
  if (!listed.ok) {
    return withCors(json({ error: listed.error }, { status: 502 }));
  }

  return withCors(json({ version: 1, feedback: listed.items }));
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Key');
  return new Response(response.body, { status: response.status, headers });
}
