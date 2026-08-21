/**
 * Shared bot contribution helpers — used by `pnpm validate`, the public write
 * API worker, and tests. Keep this aligned with CONTRIBUTING.md / content.config.
 */
import { CATEGORIES, slugify, type Category } from './constants';

export { CATEGORIES, slugify };
export type { Category };

const HTTPS_URL = /^https:\/\/.+/i;

export const FEEDBACK_KINDS = ['works', 'broken', 'spam', 'other'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

/** Soft size caps for the write API (validate-bots still only checks non-empty). */
export const BOT_LIMITS = {
  name: 120,
  prompt: 50_000,
  contributor: 80,
  scouted_by: 80,
  integration: 80,
  integrations: 30,
  bodyBytes: 100_000,
} as const;

export interface BotInput {
  name: string;
  category: Category;
  prompt: string;
  integrations: string[];
  added_at?: string;
  contributor?: string;
  contributor_url?: string;
  scouted_by?: string;
  integration_urls?: Record<string, string>;
  url?: string;
  added_via?: string;
}

export interface BotFile {
  slug: string;
  path: string;
  markdown: string;
  data: Required<Pick<BotInput, 'name' | 'category' | 'prompt' | 'integrations' | 'added_at'>> &
    Omit<BotInput, 'name' | 'category' | 'prompt' | 'integrations' | 'added_at'>;
}

export type BotValidationError = { field: string; message: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

function isIsoDatetime(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

/** Validate a JSON/API payload against the contribution contract. */
export function validateBotInput(
  raw: unknown,
  opts: { now?: string } = {},
): { ok: true; value: BotFile } | { ok: false; errors: BotValidationError[] } {
  const errors: BotValidationError[] = [];
  if (!isPlainObject(raw)) {
    return { ok: false, errors: [{ field: 'body', message: 'Expected a JSON object' }] };
  }

  const name = asTrimmedString(raw.name);
  if (!name) errors.push({ field: 'name', message: 'Required' });
  else if (name.length > BOT_LIMITS.name) {
    errors.push({ field: 'name', message: `Must be ≤ ${BOT_LIMITS.name} characters` });
  }

  const categoryRaw = asTrimmedString(raw.category);
  if (!categoryRaw) errors.push({ field: 'category', message: 'Required' });
  else if (!isCategory(categoryRaw)) {
    errors.push({
      field: 'category',
      message: `Must be one of: ${CATEGORIES.join(', ')}`,
    });
  }

  const prompt = typeof raw.prompt === 'string' ? raw.prompt.trim() : undefined;
  if (!prompt) errors.push({ field: 'prompt', message: 'Required (non-empty prompt body)' });
  else if (prompt.length > BOT_LIMITS.prompt) {
    errors.push({ field: 'prompt', message: `Must be ≤ ${BOT_LIMITS.prompt} characters` });
  }

  let integrations: string[] | undefined;
  if (!Array.isArray(raw.integrations)) {
    errors.push({ field: 'integrations', message: 'Required array of tool names' });
  } else if (raw.integrations.length === 0) {
    errors.push({ field: 'integrations', message: 'At least one integration is required' });
  } else if (raw.integrations.length > BOT_LIMITS.integrations) {
    errors.push({
      field: 'integrations',
      message: `At most ${BOT_LIMITS.integrations} integrations`,
    });
  } else {
    integrations = [];
    for (let i = 0; i < raw.integrations.length; i++) {
      const item = asTrimmedString(raw.integrations[i]);
      if (!item) {
        errors.push({ field: `integrations.${i}`, message: 'Must be a non-empty string' });
      } else if (item.length > BOT_LIMITS.integration) {
        errors.push({
          field: `integrations.${i}`,
          message: `Must be ≤ ${BOT_LIMITS.integration} characters`,
        });
      } else {
        integrations.push(item);
      }
    }
  }

  let added_at = asTrimmedString(raw.added_at) ?? opts.now ?? new Date().toISOString();
  // Normalize to millisecond UTC if the client omitted fractional seconds.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(added_at)) {
    added_at = added_at.replace(/Z$/, '.000Z');
  }
  if (!isIsoDatetime(added_at)) {
    errors.push({ field: 'added_at', message: 'Must be an ISO 8601 UTC datetime' });
  }

  const contributor = asTrimmedString(raw.contributor);
  if (contributor && contributor.length > BOT_LIMITS.contributor) {
    errors.push({
      field: 'contributor',
      message: `Must be ≤ ${BOT_LIMITS.contributor} characters`,
    });
  }

  const scouted_by = asTrimmedString(raw.scouted_by);
  if (scouted_by && scouted_by.length > BOT_LIMITS.scouted_by) {
    errors.push({
      field: 'scouted_by',
      message: `Must be ≤ ${BOT_LIMITS.scouted_by} characters`,
    });
  }

  const contributor_url = asTrimmedString(raw.contributor_url);
  if (contributor_url && !HTTPS_URL.test(contributor_url)) {
    errors.push({ field: 'contributor_url', message: 'Must be an https:// URL' });
  }

  const url = asTrimmedString(raw.url);
  if (url && !HTTPS_URL.test(url) && !/^https?:\/\/.+/i.test(url)) {
    errors.push({ field: 'url', message: 'Must be a valid URL' });
  }

  const added_via = asTrimmedString(raw.added_via);
  if (added_via && !/^https?:\/\/.+/i.test(added_via)) {
    errors.push({ field: 'added_via', message: 'Must be a valid URL' });
  }

  let integration_urls: Record<string, string> | undefined;
  if (raw.integration_urls !== undefined) {
    if (!isPlainObject(raw.integration_urls)) {
      errors.push({ field: 'integration_urls', message: 'Must be an object of name → https URL' });
    } else {
      integration_urls = {};
      for (const [key, value] of Object.entries(raw.integration_urls)) {
        if (!integrations?.includes(key)) {
          errors.push({
            field: `integration_urls.${key}`,
            message: 'Must match a name in integrations',
          });
          continue;
        }
        const href = asTrimmedString(value);
        if (!href || !HTTPS_URL.test(href)) {
          errors.push({ field: `integration_urls.${key}`, message: 'Must use HTTPS' });
        } else {
          integration_urls[key] = href;
        }
      }
    }
  }

  // Reject unknown keys so the API cannot drift from the file contract.
  const allowed = new Set([
    'name',
    'category',
    'prompt',
    'integrations',
    'added_at',
    'contributor',
    'contributor_url',
    'scouted_by',
    'integration_urls',
    'url',
    'added_via',
  ]);
  for (const key of Object.keys(raw)) {
    if (!allowed.has(key)) {
      errors.push({ field: key, message: 'Unknown field' });
    }
  }

  if (errors.length || !name || !categoryRaw || !isCategory(categoryRaw) || !prompt || !integrations) {
    return { ok: false, errors };
  }

  const slug = slugify(name);
  if (!slug) {
    return {
      ok: false,
      errors: [{ field: 'name', message: 'Must contain at least one letter or digit for the slug' }],
    };
  }

  const data: BotFile['data'] = {
    name,
    category: categoryRaw,
    prompt,
    integrations,
    added_at,
    ...(contributor ? { contributor } : {}),
    ...(contributor_url ? { contributor_url } : {}),
    ...(scouted_by ? { scouted_by } : {}),
    ...(integration_urls && Object.keys(integration_urls).length
      ? { integration_urls }
      : {}),
    ...(url ? { url } : {}),
    ...(added_via ? { added_via } : {}),
  };

  return {
    ok: true,
    value: {
      slug,
      path: `bots/${slug}.md`,
      markdown: buildBotMarkdown(data),
      data,
    },
  };
}

function yamlString(value: string): string {
  // Prefer double quotes for timestamps and anything with reserved YAML chars.
  if (/^[\w.+@/-]+$/.test(value) && !/^\d/.test(value) && value !== 'true' && value !== 'false') {
    return value;
  }
  return JSON.stringify(value);
}

function yamlIntegrations(items: string[]): string {
  return `[${items.join(', ')}]`;
}

function yamlIntegrationUrls(urls: Record<string, string>): string {
  const parts = Object.entries(urls).map(([k, v]) => `${k}: ${v}`);
  return `{ ${parts.join(', ')} }`;
}

/** Render `bots/<slug>.md` contents matching the contribution examples. */
export function buildBotMarkdown(data: BotFile['data']): string {
  const lines = [
    '---',
    `name: ${data.name}`,
    `category: ${data.category}`,
    `added_at: ${JSON.stringify(data.added_at)}`,
  ];
  if (data.contributor) lines.push(`contributor: ${yamlString(data.contributor)}`);
  if (data.contributor_url) lines.push(`contributor_url: ${data.contributor_url}`);
  if (data.scouted_by) lines.push(`scouted_by: ${yamlString(data.scouted_by)}`);
  lines.push(`integrations: ${yamlIntegrations(data.integrations)}`);
  if (data.integration_urls && Object.keys(data.integration_urls).length) {
    lines.push(`integration_urls: ${yamlIntegrationUrls(data.integration_urls)}`);
  }
  if (data.url) lines.push(`url: ${data.url}`);
  if (data.added_via) lines.push(`added_via: ${data.added_via}`);
  lines.push('---', '', data.prompt.trimEnd(), '');
  return lines.join('\n');
}

export interface FeedbackInput {
  slug: string;
  message: string;
  kind?: FeedbackKind;
  rating?: number;
}

/** Validate a feedback payload for the write API. */
export function validateFeedbackInput(
  raw: unknown,
): { ok: true; value: FeedbackInput } | { ok: false; errors: BotValidationError[] } {
  const errors: BotValidationError[] = [];
  if (!isPlainObject(raw)) {
    return { ok: false, errors: [{ field: 'body', message: 'Expected a JSON object' }] };
  }

  const slug = asTrimmedString(raw.slug);
  if (!slug) errors.push({ field: 'slug', message: 'Required' });
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) {
    errors.push({ field: 'slug', message: 'Must be a directory slug (lowercase kebab-case)' });
  }

  const message = typeof raw.message === 'string' ? raw.message.trim() : undefined;
  if (!message) errors.push({ field: 'message', message: 'Required' });
  else if (message.length > 4000) {
    errors.push({ field: 'message', message: 'Must be ≤ 4000 characters' });
  }

  let kind: FeedbackKind | undefined;
  if (raw.kind !== undefined) {
    const k = asTrimmedString(raw.kind);
    if (!k || !(FEEDBACK_KINDS as readonly string[]).includes(k)) {
      errors.push({
        field: 'kind',
        message: `Must be one of: ${FEEDBACK_KINDS.join(', ')}`,
      });
    } else {
      kind = k as FeedbackKind;
    }
  }

  let rating: number | undefined;
  if (raw.rating !== undefined) {
    if (typeof raw.rating !== 'number' || !Number.isInteger(raw.rating) || raw.rating < 1 || raw.rating > 5) {
      errors.push({ field: 'rating', message: 'Must be an integer from 1 to 5' });
    } else {
      rating = raw.rating;
    }
  }

  const allowed = new Set(['slug', 'message', 'kind', 'rating']);
  for (const key of Object.keys(raw)) {
    if (!allowed.has(key)) errors.push({ field: key, message: 'Unknown field' });
  }

  if (errors.length || !slug || !message) return { ok: false, errors };
  return {
    ok: true,
    value: {
      slug,
      message,
      ...(kind ? { kind } : {}),
      ...(rating !== undefined ? { rating } : {}),
    },
  };
}
