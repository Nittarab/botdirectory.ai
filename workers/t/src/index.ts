/**
 * Reverse proxy for PostHog (US Cloud).
 * @see https://posthog.com/docs/advanced/proxy/cloudflare
 *
 * `/static/*` and `/array/*` go to the asset CDN (cached). Everything else
 * goes to the ingestion API. Cookies are stripped; the visitor IP is forwarded
 * so geolocation is not Cloudflare's edge.
 */

const API_HOST = "us.i.posthog.com";
const ASSET_HOST = "us-assets.i.posthog.com";

export default {
  async fetch(request, _env, ctx): Promise<Response> {
    const url = new URL(request.url);
    const pathWithParams = url.pathname + url.search;

    if (url.pathname.startsWith("/static/") || url.pathname.startsWith("/array/")) {
      return retrieveAsset(request, pathWithParams, ctx);
    }
    return forwardRequest(request, pathWithParams);
  },
} satisfies ExportedHandler;

async function retrieveAsset(
  request: Request,
  pathWithParams: string,
  ctx: ExecutionContext,
): Promise<Response> {
  const cached = await caches.default.match(request);
  if (cached) return cached;

  const response = await fetch(`https://${ASSET_HOST}${pathWithParams}`);
  if (request.method === "GET" && response.ok) {
    ctx.waitUntil(caches.default.put(request, response.clone()));
  }
  return response;
}

async function forwardRequest(request: Request, pathWithParams: string): Promise<Response> {
  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  const headers = new Headers(request.headers);
  headers.delete("cookie");
  headers.set("X-Forwarded-For", ip);

  // Buffer the body: forwarding the ReadableStream directly can drop encoded
  // PostHog payloads (custom events / recordings). See PostHog's CF guide.
  const body =
    request.method !== "GET" && request.method !== "HEAD"
      ? await request.arrayBuffer()
      : null;

  return fetch(`https://${API_HOST}${pathWithParams}`, {
    method: request.method,
    headers,
    body,
    redirect: request.redirect,
  });
}
