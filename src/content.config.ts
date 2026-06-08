import { defineCollection, z } from 'astro:content';
import { file } from 'astro/loaders';

const timeline = defineCollection({
  loader: file('src/content/timeline/items.json'),
  schema: z.object({
    date: z.string(),
    title: z.string(),
    description: z.string(),
    tags: z.array(z.string()).optional()
  })
});

export const collections = { timeline };
