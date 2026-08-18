import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { CATEGORIES } from './lib/constants';

const bots = defineCollection({
  loader: glob({ pattern: '*.md', base: './bots' }),
  schema: z.object({
    name: z.string().min(1),
    category: z.enum(CATEGORIES),
    /** UTC date when the listing was added to the directory. */
    added_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** Whose setup this is. Optional — some sources are anonymous. */
    contributor: z.string().min(1).optional(),
    /** Where the contributor handle links. Defaults to github.com/<contributor>. */
    contributor_url: z.string().url().optional(),
    /** X handle of whoever tagged/submitted someone else's setup. */
    scouted_by: z.string().min(1).optional(),
    integrations: z.array(z.string().min(1)).min(1),
    /** Optional canonical homepage/GitHub of the bot (dedupe key). */
    url: z.string().url().optional(),
    /** Optional source tweet URL when added by the X mention bot. */
    added_via: z.string().url().optional(),
  }),
});

export const collections = { bots };
