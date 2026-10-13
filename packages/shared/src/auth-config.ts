import { z } from 'zod';

export const SOCIAL_PROVIDERS = ['github', 'google'] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

/** Public sign-in options, so the web app only offers what the server supports. */
export const authConfigSchema = z.object({
  socialProviders: z.array(z.enum(SOCIAL_PROVIDERS)),
  signUpEnabled: z.boolean(),
  emailVerificationRequired: z.boolean(),
});
export type AuthConfig = z.infer<typeof authConfigSchema>;
