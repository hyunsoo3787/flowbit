import { z } from 'zod';
import { displayNameSchema, passwordSchema } from './auth.js';

// Instance administration (D-021): accounts and server settings, never content.

export const adminUserSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  emailVerified: z.boolean(),
  isAdmin: z.boolean(),
  /** Admin through the ADMIN_EMAILS setting; can't be revoked in the UI. */
  adminFromConfig: z.boolean(),
  suspendedAt: z.iso.datetime().nullable(),
  /** Sign-in methods: "credential" (password), "github", "google", … */
  signInMethods: z.array(z.string()),
  organizations: z.int(),
  workspaces: z.int(),
  lastActiveAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export const adminUserPageSchema = z.object({
  items: z.array(adminUserSchema),
  nextCursor: z.uuid().nullable(),
});
export type AdminUserPage = z.infer<typeof adminUserPageSchema>;

export const instanceStatsSchema = z.object({
  users: z.int(),
  suspendedUsers: z.int(),
  admins: z.int(),
  organizations: z.int(),
  workspaces: z.int(),
  boards: z.int(),
  cards: z.int(),
});
export type InstanceStats = z.infer<typeof instanceStatsSchema>;

export const instanceSettingsSchema = z.object({
  signUpEnabled: z.boolean(),
  /** Whether email can be sent; reset links are then also announced by email. */
  mailConfigured: z.boolean(),
});
export type InstanceSettings = z.infer<typeof instanceSettingsSchema>;

export const updateInstanceSettingsSchema = z.object({ signUpEnabled: z.boolean() }).partial();
export type UpdateInstanceSettingsInput = z.infer<typeof updateInstanceSettingsSchema>;

export const passwordResetLinkSchema = z.object({
  url: z.url(),
  expiresAt: z.iso.datetime(),
});
export type PasswordResetLink = z.infer<typeof passwordResetLinkSchema>;

export const ADMIN_ACTION_TYPES = [
  'admin.granted',
  'admin.revoked',
  'user.suspended',
  'user.reactivated',
  'user.deleted',
  'user.password_reset_link',
  'settings.updated',
] as const;
export type AdminActionType = (typeof ADMIN_ACTION_TYPES)[number];

export const adminActionSchema = z.object({
  id: z.uuid(),
  type: z.enum(ADMIN_ACTION_TYPES),
  /** Null for the command line and the setup page. */
  actor: z.object({ id: z.uuid(), name: z.string(), email: z.email() }).nullable(),
  target: z.object({ id: z.uuid(), name: z.string(), email: z.email() }).nullable(),
  /** Kept when the target account was deleted. */
  targetEmail: z.string().nullable(),
  details: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
});
export type AdminAction = z.infer<typeof adminActionSchema>;

export const adminActionPageSchema = z.object({
  items: z.array(adminActionSchema),
  nextCursor: z.uuid().nullable(),
});
export type AdminActionPage = z.infer<typeof adminActionPageSchema>;

/** Creates the first administrator with the one-time setup token. */
export const completeSetupSchema = z.object({
  token: z.string().min(1),
  /** Required unless the caller is signed in, who then becomes the administrator. */
  account: z
    .object({
      name: displayNameSchema,
      email: z.email(),
      password: passwordSchema,
    })
    .optional(),
});
export type CompleteSetupInput = z.infer<typeof completeSetupSchema>;

export const setupStatusSchema = z.object({ required: z.boolean() });
export type SetupStatus = z.infer<typeof setupStatusSchema>;
