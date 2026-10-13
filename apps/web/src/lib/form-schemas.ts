import {
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  WORKSPACE_DESCRIPTION_MAX_LENGTH,
  WORKSPACE_NAME_MAX_LENGTH,
} from '@flowbit/shared';
import { z } from 'zod';

// Client-side form schemas. They mirror the shared API schemas but carry
// i18n keys as messages, which <FormField> translates. The server validates again.

const required = (max: number) =>
  z.string().trim().min(1, 'validation.required').max(max, 'validation.tooLong');

const email = z.string().trim().min(1, 'validation.required').pipe(z.email('validation.email'));

const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, 'validation.passwordMin')
  .max(PASSWORD_MAX_LENGTH, 'validation.tooLong');

export const signInFormSchema = z.object({
  email,
  password: z.string().min(1, 'validation.required'),
});

export const signUpFormSchema = z.object({
  name: required(NAME_MAX_LENGTH),
  email,
  password: newPassword,
});

export const forgotPasswordFormSchema = z.object({ email });

export const resetPasswordFormSchema = z.object({ password: newPassword });

export const workspaceFormSchema = z.object({
  name: required(WORKSPACE_NAME_MAX_LENGTH),
  description: z.string().trim().max(WORKSPACE_DESCRIPTION_MAX_LENGTH, 'validation.tooLong'),
});
