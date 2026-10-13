import { describe, expect, it } from 'vitest';
import { signUpFormSchema, workspaceFormSchema } from './form-schemas';

function messages(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.success ? [] : result.error!.issues.map((issue) => issue.message);
}

describe('form schemas', () => {
  it('reports i18n keys for invalid sign-up input', () => {
    const result = signUpFormSchema.safeParse({ name: ' ', email: 'nope', password: 'short' });
    expect(messages(result)).toEqual([
      'validation.required',
      'validation.email',
      'validation.passwordMin',
    ]);
  });

  it('accepts a valid workspace', () => {
    expect(workspaceFormSchema.parse({ name: ' Team ', description: '' })).toEqual({
      name: 'Team',
      description: '',
    });
  });
});
