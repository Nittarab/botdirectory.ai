import { API_URL, SITE_URL } from '../src/config';
import {
  API_CATALOG_PROFILE,
  API_OPERATIONS,
  DISCOVERY_LINKS,
  OPENAPI_MEDIA_TYPE,
} from '../src/lib/api-discovery';

interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

const apiCatalog = {
  linkset: [
    {
      anchor: API_URL,
      item: API_OPERATIONS.map(({ catalogUrl }) => ({ href: catalogUrl })),
      'service-desc': [
        {
          href: `${SITE_URL}/openapi.json`,
          type: OPENAPI_MEDIA_TYPE,
        },
      ],
      'service-doc': [
        { href: `${SITE_URL}/api/`, type: 'text/html' },
        { href: `${SITE_URL}/developers/`, type: 'text/html' },
        { href: `${SITE_URL}/llms.txt`, type: 'text/markdown' },
      ],
      status: [{ href: `${API_URL}/health`, type: 'application/json' }],
    },
  ],
};

function accepts(request: Request, mediaType: string): boolean {
  const target = mediaType.toLowerCase();
  return (request.headers.get('Accept') ?? '')
    .toLowerCase()
    .split(',')
    .some((entry) => {
      const [type, ...parameters] = entry.trim().split(';');
      const quality = parameters
        .map((parameter) => parameter.trim().match(/^q=([0-9.]+)$/)?.[1])
        .find(Boolean);
      return type === target && (quality === undefined || Number(quality) > 0);
    });
}

function appendVary(headers: Headers, value: string): void {
  const values = new Set(
    (headers.get('Vary') ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
  values.add(value);
  headers.set('Vary', [...values].join(', '));
}

function withDiscovery(response: Response, varyOnAccept = false): Response {
  const headers = new Headers(response.headers);
  headers.append('Link', DISCOVERY_LINKS);
  if (varyOnAccept) appendVary(headers, 'Accept');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function problem(
  request: Request,
  status: number,
  code: string,
  title: string,
  detail: string,
  resolution: string,
): Response {
  const body = JSON.stringify({
    type: `${SITE_URL}/developers/#errors`,
    title,
    status,
    detail,
    instance: new URL(request.url).pathname,
    code,
    resolution,
  });
  const headers = new Headers({
    'Content-Type': 'application/problem+json; charset=utf-8',
    'Cache-Control': 'no-store',
    Link: DISCOVERY_LINKS,
  });
  appendVary(headers, 'Accept');
  if (status === 405) headers.set('Allow', 'GET, HEAD');
  return new Response(request.method === 'HEAD' ? null : body, { status, headers });
}

function markdownNotFound(request: Request): Response {
  const url = new URL(request.url);
  const body = `# 404 — Page not found

The path \`${url.pathname}\` is not part of botdirectory.ai.

## Recover

- [Agent instructions](${SITE_URL}/llms.txt)
- [Sitemap](${SITE_URL}/sitemap-index.xml)
- [Developer hub](${SITE_URL}/developers/)
- [Complete JSON bot feed](${SITE_URL}/api/bots.json)
- [OpenAPI 3.1 specification](${SITE_URL}/openapi.json)
`;
  const headers = new Headers({
    'Content-Type': 'text/markdown; charset=utf-8',
    'Cache-Control': 'no-store',
    Link: DISCOVERY_LINKS,
  });
  appendVary(headers, 'Accept');
  return new Response(request.method === 'HEAD' ? null : body, { status: 404, headers });
}

async function htmlNotFound(request: Request, env: Env): Promise<Response> {
  const source = await env.ASSETS.fetch(
    new Request(new URL('/404.html', request.url), { method: request.method }),
  );
  const headers = new Headers(source.headers);
  headers.append('Link', DISCOVERY_LINKS);
  appendVary(headers, 'Accept');
  return new Response(request.method === 'HEAD' ? null : source.body, {
    status: 404,
    headers,
  });
}

async function rootResponse(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return problem(
      request,
      405,
      'method_not_allowed',
      'Method not allowed',
      'The public site root is read-only.',
      'Use GET or HEAD. See /developers/ for documented API operations.',
    );
  }

  if (!accepts(request, 'text/markdown')) {
    return withDiscovery(await env.ASSETS.fetch(request), true);
  }

  const url = new URL('/llms.txt', request.url);
  const source = await env.ASSETS.fetch(new Request(url, { method: request.method }));
  const headers = new Headers(source.headers);
  headers.set('Content-Type', 'text/markdown; charset=utf-8');
  headers.set('Content-Location', `${SITE_URL}/`);
  headers.append('Link', `<${SITE_URL}/>; rel="canonical", ${DISCOVERY_LINKS}`);
  appendVary(headers, 'Accept');
  return new Response(request.method === 'HEAD' ? null : source.body, {
    status: source.status,
    statusText: source.statusText,
    headers,
  });
}

function apiCatalogResponse(request: Request): Response {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return problem(
      request,
      405,
      'method_not_allowed',
      'Method not allowed',
      'The API catalog is a read-only discovery document.',
      'Use GET or HEAD to retrieve the RFC 9727 Linkset.',
    );
  }

  const body = JSON.stringify(apiCatalog);
  const headers = new Headers({
    'Content-Type': `application/linkset+json; profile="${API_CATALOG_PROFILE}"`,
    'Cache-Control': 'public, max-age=300',
    Link: `<${SITE_URL}/.well-known/api-catalog>; rel="api-catalog", <${SITE_URL}/openapi.json>; rel="service-desc"; type="${OPENAPI_MEDIA_TYPE}"`,
  });
  return new Response(request.method === 'HEAD' ? null : body, { headers });
}

async function typedAssetResponse(
  request: Request,
  env: Env,
  contentType: string,
  links: string,
): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return problem(
      request,
      405,
      'method_not_allowed',
      'Method not allowed',
      'This discovery document is read-only.',
      'Use GET or HEAD to retrieve it.',
    );
  }

  const source = await env.ASSETS.fetch(request);
  const headers = new Headers(source.headers);
  headers.set('Content-Type', contentType);
  headers.append('Link', links);
  return new Response(request.method === 'HEAD' ? null : source.body, {
    status: source.status,
    statusText: source.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/') return rootResponse(request, env);
    if (url.pathname === '/.well-known/api-catalog') return apiCatalogResponse(request);
    if (url.pathname === '/openapi.json') {
      return typedAssetResponse(
        request,
        env,
        OPENAPI_MEDIA_TYPE,
        `<${SITE_URL}/api/>; rel="service-doc", <${SITE_URL}/.well-known/api-catalog>; rel="api-catalog"`,
      );
    }
    if (url.pathname === '/llms.txt') {
      return typedAssetResponse(
        request,
        env,
        'text/markdown; charset=utf-8',
        `<${SITE_URL}/llms.txt>; rel="canonical", <${SITE_URL}/openapi.json>; rel="service-desc"; type="${OPENAPI_MEDIA_TYPE}"`,
      );
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return problem(
        request,
        405,
        'method_not_allowed',
        'Method not allowed',
        'botdirectory.ai pages and discovery documents are read-only.',
        'Use GET or HEAD here. Use the operations in /openapi.json for API writes.',
      );
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) {
      return response.headers.get('Content-Type')?.startsWith('text/html')
        ? withDiscovery(response)
        : response;
    }

    if (accepts(request, 'text/markdown')) return markdownNotFound(request);
    if (
      url.pathname.startsWith('/api/') ||
      accepts(request, 'application/json') ||
      accepts(request, 'application/problem+json')
    ) {
      return problem(
        request,
        404,
        'route_not_found',
        'Route not found',
        `No resource exists at ${url.pathname}.`,
        'Use /openapi.json for API operations, /llms.txt for agent instructions, or /sitemap-index.xml for pages.',
      );
    }

    return htmlNotFound(request, env);
  },
};
