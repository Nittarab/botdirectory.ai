/**
 * Public API worker for api.botdirectory.ai.
 *
 * GET  /api/bots       — keyless catalog (unchanged contract; sourced from the site feed)
 * POST /api/bots       — open a GitHub PR adding bots/<slug>.md (API key)
 * POST /api/feedback   — persist listing feedback as a labeled GitHub issue (API key)
 * GET  /api/feedback   — list recent feedback issues (API key)
 * GET  /api/copies     — copy counts (optional KV; empty object when unbound)
 * POST /api/copies     — increment a slug counter (optional KV; no-op when unbound)
 */

import { handleBots } from './bots';
import { handleCopies } from './copies';
import { handleFeedback } from './feedback';
import { corsHeaders, json, methodNotAllowed } from './http';
import type { Env } from './types';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request.method, url.pathname),
      });
    }

    try {
      if (url.pathname === '/api/bots' || url.pathname === '/api/bots/') {
        return await handleBots(request, env, url);
      }
      if (url.pathname === '/api/feedback' || url.pathname === '/api/feedback/') {
        return await handleFeedback(request, env, url);
      }
      if (url.pathname === '/api/copies' || url.pathname === '/api/copies/') {
        return await handleCopies(request, env, url, ctx);
      }
      return json({ error: 'not found' }, { status: 404 });
    } catch (err) {
      console.error(err);
      return json({ error: 'internal error' }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;

export type { Env };
