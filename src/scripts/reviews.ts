/** Fetch and render bot reviews on the bot detail page. */

export type Review = {
  username: string;
  helpful: boolean;
  body: string;
};

type Raw = Record<string, unknown>;

function asRecord(v: unknown): Raw | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : null;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function isHelpful(raw: Raw): boolean {
  if (typeof raw.helpful === 'boolean') return raw.helpful;
  const kind = str(raw.kind).toLowerCase();
  if (kind === 'works') return true;
  if (kind === 'broken' || kind === 'spam' || kind === 'other') return false;
  if (typeof raw.verdict === 'string') {
    const v = raw.verdict.toLowerCase();
    if (v.includes('helpful') && !v.includes('not')) return true;
    if (v.includes('not helpful') || v === 'broken') return false;
  }
  return false;
}

function normalizeOne(item: unknown): Review | null {
  const raw = asRecord(item);
  if (!raw) return null;
  const username = str(raw.username) || str(raw.name) || str(raw.bot) || str(raw.author);
  const body = str(raw.body) || str(raw.message) || str(raw.comment) || str(raw.text);
  if (!username || !body) return null;
  return { username, helpful: isHelpful(raw), body };
}

function extractList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const obj = asRecord(data);
  if (!obj) return [];
  for (const key of ['reviews', 'feedback', 'items', 'data', 'results']) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[];
  }
  return [];
}

export function normalizeReviews(data: unknown): Review[] {
  return extractList(data).map(normalizeOne).filter((r): r is Review => r !== null);
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Prefer the public v1 reviews endpoint; fall back to legacy feedback. */
export async function loadReviews(slug: string): Promise<Review[]> {
  const primary = await fetchJson(`https://api.botdirectory.ai/v1/bots/${encodeURIComponent(slug)}/reviews`);
  if (primary != null) return normalizeReviews(primary);

  const fallback = await fetchJson(
    `https://api.botdirectory.ai/api/feedback?slug=${encodeURIComponent(slug)}`,
  );
  if (fallback != null) return normalizeReviews(fallback);

  return [];
}

export function reviewCurl(slug: string): string {
  return `curl -X POST https://api.botdirectory.ai/v1/bots/${slug}/reviews -H "Authorization: Bearer $BOT_KEY" -d '{"helpful":true,"body":"..."}'`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderReviews(root: HTMLElement, reviews: Review[]): void {
  const summary = root.querySelector<HTMLElement>('[data-reviews-summary]');
  const list = root.querySelector<HTMLElement>('[data-reviews-list]');
  if (!list) return;

  if (summary) {
    if (reviews.length === 0) {
      summary.hidden = true;
      summary.textContent = '';
    } else {
      const helpful = reviews.filter((r) => r.helpful).length;
      summary.hidden = false;
      summary.textContent = `${helpful} of ${reviews.length} found it helpful`;
    }
  }

  if (reviews.length === 0) {
    list.innerHTML = '';
    list.hidden = true;
    return;
  }

  list.hidden = false;
  list.innerHTML = reviews
    .map((r) => {
      const verdict = r.helpful ? 'found it helpful' : 'not helpful';
      const verdictClass = r.helpful ? 'review-verdict--helpful' : 'review-verdict--not';
      return `<li class="review-item">
  <div class="review-meta">
    <span class="review-user">${escapeHtml(r.username)}</span>
    <span class="review-verdict ${verdictClass}">${verdict}</span>
  </div>
  <p class="review-body">${escapeHtml(r.body)}</p>
</li>`;
    })
    .join('');
}

export function mountReviews(root: HTMLElement): void {
  const slug = root.dataset.slug || '';
  if (!slug) return;

  const copyBtn = root.querySelector<HTMLButtonElement>('[data-reviews-copy]');
  if (copyBtn) {
    const curl = reviewCurl(slug);
    copyBtn.addEventListener('click', () => {
      const label = copyBtn.textContent;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(curl).catch(() => {});
      }
      copyBtn.textContent = 'Copied';
      window.setTimeout(() => {
        copyBtn.textContent = label;
      }, 1600);
    });
  }

  loadReviews(slug).then((reviews) => renderReviews(root, reviews));
}
