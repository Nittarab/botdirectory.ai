import { API_URL, SITE_URL } from '../config';

export const OPENAPI_MEDIA_TYPE = 'application/vnd.oai.openapi+json;version=3.1';
export const API_CATALOG_PROFILE = 'https://www.rfc-editor.org/info/rfc9727';

export const API_OPERATIONS = [
  { path: '/api/bots', catalogUrl: `${API_URL}/api/bots` },
  { path: '/api/signup', catalogUrl: `${API_URL}/api/signup` },
  { path: '/api/me', catalogUrl: `${API_URL}/api/me` },
  { path: '/api/newsletter', catalogUrl: `${API_URL}/api/newsletter` },
  { path: '/api/copies', catalogUrl: `${API_URL}/api/copies` },
  { path: '/api/feedback', catalogUrl: `${API_URL}/api/feedback` },
  {
    path: '/v1/bots/{slug}/reviews',
    catalogUrl: `${API_URL}/v1/bots/inbox-triage/reviews`,
  },
  { path: '/health', catalogUrl: `${API_URL}/health` },
] as const;

export const DISCOVERY_LINKS = [
  `<${SITE_URL}/.well-known/api-catalog>; rel="api-catalog"`,
  `<${SITE_URL}/openapi.json>; rel="service-desc"; type="${OPENAPI_MEDIA_TYPE}"`,
  `<${SITE_URL}/developers/>; rel="service-doc"`,
  `<${SITE_URL}/llms.txt>; rel="alternate"; type="text/markdown"`,
].join(', ');
