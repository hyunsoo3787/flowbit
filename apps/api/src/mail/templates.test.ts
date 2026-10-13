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

describe('notification emails', () => {
  it('names who did what, in the recipient’s language', () => {
    const input = {
      type: 'MENTIONED' as const,
      actor: 'Ann',
      card: 'Write docs',
      board: 'Roadmap',
      excerpt: 'Can you <b>check</b> this?',
      url: 'https://x/b/1/c/2',
      settingsUrl: 'https://x',
    };
    expect(mailTemplates.notification('en', input).subject).toBe(
      'Ann mentioned you on “Write docs”',
    );
    expect(mailTemplates.notification('ko', input).subject).toBe(
      'Ann님이 “Write docs”에서 회원님을 언급했습니다',
    );
    const mail = mailTemplates.notification('en', input);
    expect(mail.text).toContain('Can you <b>check</b> this?');
    expect(mail.html).not.toContain('<b>check</b>');
  });
});
