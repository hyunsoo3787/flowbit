import { beforeAll, describe, expect, it } from 'vitest';
import { ApiError } from '@/api/client';
import i18n from '@/i18n';
import { errorMessage } from './errors';

beforeAll(async () => {
  await i18n.changeLanguage('ko');
});

describe('errorMessage', () => {
  const t = i18n.t.bind(i18n);

  it('localizes API error codes', () => {
    expect(errorMessage(t, new ApiError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found'))).toBe(
      '워크스페이스가 없거나 접근 권한이 없습니다.',
    );
  });

  it('localizes Better Auth error codes', () => {
    expect(errorMessage(t, { code: 'INVALID_EMAIL_OR_PASSWORD', status: 401 })).toBe(
      '이메일 또는 비밀번호가 올바르지 않습니다.',
    );
  });

  it('treats HTTP 429 as rate limiting even without a code', () => {
    expect(errorMessage(t, { status: 429 })).toBe(
      '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    );
  });

  it('falls back to a generic message and never shows server text', () => {
    expect(errorMessage(t, { code: 'SOMETHING_NEW', message: 'raw server text' })).toBe(
      '문제가 발생했습니다. 다시 시도해 주세요.',
    );
    expect(errorMessage(t, new TypeError('Failed to fetch'))).toBe(
      '서버에 연결할 수 없습니다. 네트워크를 확인하고 다시 시도해 주세요.',
    );
  });
});
