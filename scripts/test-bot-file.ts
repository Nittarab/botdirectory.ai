/**
 * Unit tests for src/lib/bot-file.ts (write-API contribution contract).
 * Run with: pnpm test:api
 */
import { buildBotMarkdown, validateBotInput, validateFeedbackInput } from '../src/lib/bot-file';

let failed = 0;

function assert(cond: unknown, msg: string) {
  if (!cond) {
    failed++;
    console.error(`✖ ${msg}`);
  } else {
    console.log(`✓ ${msg}`);
  }
}

const valid = validateBotInput({
  name: 'API Test Bot',
  category: 'Ops',
  prompt: 'Set up a new bot for me. Connect Slack, then save it.',
  integrations: ['Slack'],
  contributor: 'elie222',
  added_at: '2026-08-21T12:00:00.000Z',
});
assert(valid.ok, 'accepts a valid bot payload');
if (valid.ok) {
  assert(valid.value.slug === 'api-test-bot', 'slugifies the name');
  assert(valid.value.path === 'bots/api-test-bot.md', 'path is bots/<slug>.md');
  assert(valid.value.markdown.includes('category: Ops'), 'markdown includes category');
  assert(valid.value.markdown.includes('integrations: [Slack]'), 'markdown includes integrations');
  assert(valid.value.markdown.trimEnd().endsWith('save it.'), 'markdown body is the prompt');
}

const badCategory = validateBotInput({
  name: 'X',
  category: 'Growth',
  prompt: 'hello',
  integrations: ['Gmail'],
});
assert(!badCategory.ok, 'rejects unknown category');

const emptyPrompt = validateBotInput({
  name: 'X',
  category: 'Sales',
  prompt: '   ',
  integrations: ['Gmail'],
});
assert(!emptyPrompt.ok, 'rejects empty prompt');

const badUrl = validateBotInput({
  name: 'X',
  category: 'Sales',
  prompt: 'hello world',
  integrations: ['Gmail'],
  integration_urls: { Gmail: 'http://gmail.com' },
});
assert(!badUrl.ok, 'rejects non-HTTPS integration_urls');

const mismatch = validateBotInput({
  name: 'X',
  category: 'Sales',
  prompt: 'hello world',
  integrations: ['Gmail'],
  integration_urls: { Notion: 'https://notion.so' },
});
assert(!mismatch.ok, 'rejects integration_urls keys not in integrations');

const md = buildBotMarkdown({
  name: 'SEO Improver',
  category: 'Marketing',
  added_at: '2026-08-18T12:00:00.000Z',
  contributor: 'rakazo',
  integrations: ['GitHub', 'DataForSEO', 'Search Console'],
  integration_urls: { DataForSEO: 'https://dataforseo.com' },
  prompt: 'Set up a new bot for me.',
});
assert(
  md.startsWith('---\nname: SEO Improver\ncategory: Marketing\n'),
  'buildBotMarkdown matches contribution frontmatter shape',
);

const fb = validateFeedbackInput({
  slug: 'seo-improver',
  message: 'Works great with Grok Bot.',
  kind: 'works',
  rating: 5,
});
assert(fb.ok, 'accepts valid feedback');

const badFb = validateFeedbackInput({ slug: 'Nope', message: 'x' });
assert(!badFb.ok, 'rejects non-slug feedback slug');

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll api bot-file tests passed');
