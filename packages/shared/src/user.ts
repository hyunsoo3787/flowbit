import { z } from 'zod';
import { displayNameSchema } from './auth.js';
import { localeSchema } from './locales.js';

export const userProfileSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  emailVerified: z.boolean(),
  image: z.string().nullable(),
  locale: localeSchema,
  createdAt: z.iso.datetime(),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

export const updateProfileSchema = z
  .object({
    name: displayNameSchema,
    locale: localeSchema,
  })
  .partial();
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
