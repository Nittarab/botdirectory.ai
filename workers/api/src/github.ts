import type { Env } from './types';

const API = 'https://api.github.com';

export function repo(env: Env): string {
  return env.GITHUB_REPO?.trim() || 'elie222/botdirectory.ai';
}

function headers(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'botdirectory-api',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function gh<T>(
  env: Env,
  path: string,
  init: RequestInit = {},
): Promise<{ ok: true; data: T; status: number } | { ok: false; status: number; error: string }> {
  if (!env.GITHUB_TOKEN) {
    return { ok: false, status: 503, error: 'write API is not configured (missing GITHUB_TOKEN)' };
  }
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...headers(env.GITHUB_TOKEN), ...(init.headers || {}) },
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'message' in data
        ? String((data as { message: unknown }).message)
        : `GitHub HTTP ${res.status}`;
    return { ok: false, status: res.status, error: message };
  }
  return { ok: true, data: data as T, status: res.status };
}

interface RefResponse {
  object: { sha: string };
}

interface PullResponse {
  html_url: string;
  number: number;
  url: string;
}

interface IssueResponse {
  html_url: string;
  number: number;
  title: string;
  created_at: string;
  body: string | null;
  state: string;
  labels: Array<{ name: string }>;
}

/** Open a PR that only adds `bots/<slug>.md`, mirroring the X mention bot. */
export async function openBotPullRequest(
  env: Env,
  opts: {
    slug: string;
    name: string;
    markdown: string;
    path: string;
  },
): Promise<
  | { ok: true; prUrl: string; number: number; branch: string }
  | { ok: false; status: number; error: string }
> {
  const r = repo(env);
  const main = await gh<RefResponse>(env, `/repos/${r}/git/ref/heads/main`);
  if (!main.ok) return main;
  const baseSha = main.data.object.sha;

  const suffix = Date.now().toString(36);
  const branch = `bot/${opts.slug}-${suffix}`;

  const createdRef = await gh(env, `/repos/${r}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
  });
  if (!createdRef.ok) return createdRef;

  const content = uint8ToBase64(new TextEncoder().encode(opts.markdown));
  const put = await gh(env, `/repos/${r}/contents/${opts.path}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `Add bot: ${opts.slug} (via API)`,
      content,
      branch,
    }),
  });
  if (!put.ok) return put;

  const pr = await gh<PullResponse>(env, `/repos/${r}/pulls`, {
    method: 'POST',
    body: JSON.stringify({
      title: `Add bot: ${opts.name}`,
      head: branch,
      base: 'main',
      body: [
        `Adds \`${opts.path}\` submitted via the public write API.`,
        '',
        'Opened automatically by the botdirectory.ai API.',
      ].join('\n'),
    }),
  });
  if (!pr.ok) return pr;

  // Best-effort label (issues endpoint). Missing label or triage rights must not fail the submit.
  await gh(env, `/repos/${r}/issues/${pr.data.number}/labels`, {
    method: 'POST',
    body: JSON.stringify({ labels: ['via-api'] }),
  });

  return { ok: true, prUrl: pr.data.html_url, number: pr.data.number, branch };
}

export async function createFeedbackIssue(
  env: Env,
  opts: {
    slug: string;
    message: string;
    kind?: string;
    rating?: number;
  },
): Promise<
  | { ok: true; url: string; number: number; id: string }
  | { ok: false; status: number; error: string }
> {
  const r = repo(env);
  const kind = opts.kind ?? 'other';
  const title = `Feedback (${kind}): ${opts.slug}`;
  const body = [
    `**Slug:** \`${opts.slug}\``,
    `**Kind:** ${kind}`,
    opts.rating !== undefined ? `**Rating:** ${opts.rating}/5` : null,
    '',
    opts.message,
  ]
    .filter(Boolean)
    .join('\n');

  const issue = await gh<IssueResponse>(env, `/repos/${r}/issues`, {
    method: 'POST',
    body: JSON.stringify({
      title,
      body,
      labels: ['feedback', `feedback:${kind}`],
    }),
  });
  if (!issue.ok) {
    // Label may not exist yet — create without labels, then tag.
    const retry = await gh<IssueResponse>(env, `/repos/${r}/issues`, {
      method: 'POST',
      body: JSON.stringify({ title, body }),
    });
    if (!retry.ok) return retry;
    await gh(env, `/repos/${r}/issues/${retry.data.number}/labels`, {
      method: 'POST',
      body: JSON.stringify({ labels: ['feedback', `feedback:${kind}`] }),
    });
    return {
      ok: true,
      url: retry.data.html_url,
      number: retry.data.number,
      id: String(retry.data.number),
    };
  }
  return {
    ok: true,
    url: issue.data.html_url,
    number: issue.data.number,
    id: String(issue.data.number),
  };
}

export async function listFeedbackIssues(
  env: Env,
  limit: number,
): Promise<
  | {
      ok: true;
      items: Array<{
        id: string;
        number: number;
        url: string;
        title: string;
        createdAt: string;
        state: string;
        slug: string | null;
        kind: string | null;
        rating: number | null;
        message: string;
      }>;
    }
  | { ok: false; status: number; error: string }
> {
  const r = repo(env);
  const q = encodeURIComponent(`repo:${r} is:issue label:feedback`);
  const res = await gh<{
    items: IssueResponse[];
  }>(env, `/search/issues?q=${q}&sort=created&order=desc&per_page=${limit}`);
  if (!res.ok) return res;

  return {
    ok: true,
    items: res.data.items.map((issue) => {
      const body = issue.body || '';
      const slug = /^\*\*Slug:\*\* `([^`]+)`/m.exec(body)?.[1] ?? null;
      const kind =
        /^\*\*Kind:\*\* (\w+)/m.exec(body)?.[1] ??
        issue.labels.map((l) => l.name).find((n) => n.startsWith('feedback:'))?.slice('feedback:'.length) ??
        null;
      const ratingRaw = /^\*\*Rating:\*\* (\d)\/5/m.exec(body)?.[1];
      const rating = ratingRaw ? Number(ratingRaw) : null;
      const message = body.split(/\n\n/).slice(1).join('\n\n').trim() || body;
      return {
        id: String(issue.number),
        number: issue.number,
        url: issue.html_url,
        title: issue.title,
        createdAt: issue.created_at,
        state: issue.state,
        slug,
        kind,
        rating,
        message,
      };
    }),
  };
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}
