import { describe, expect, it } from 'vitest';
import { mailTemplates } from './templates.js';

describe('mailTemplates', () => {
  it('localizes the content', () => {
    expect(mailTemplates.verifyEmail('ko', '현수', 'https://x').subject).toBe(
      '이메일 주소를 인증해 주세요',
    );
    expect(mailTemplates.resetPassword('en', 'Ann', 'https://x').subject).toBe(
      'Reset your password',
    );
  });

  it('escapes user-controlled values in HTML', () => {
    const mail = mailTemplates.verifyEmail('en', '<script>alert(1)</script>', 'https://x?a=1&b=2');
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
    expect(mail.html).toContain('https://x?a=1&amp;b=2');
    expect(mail.text).toContain('https://x?a=1&b=2');
  });
});
