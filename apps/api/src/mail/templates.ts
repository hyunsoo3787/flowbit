import type { Locale } from '@flowbit/shared';

export interface MailContent {
  subject: string;
  text: string;
  html: string;
}

interface ActionMail {
  subject: string;
  greeting: (name: string) => string;
  body: string;
  action: string;
  footer: string;
}

const verifyEmail: Record<Locale, ActionMail> = {
  en: {
    subject: 'Verify your email address',
    greeting: (name) => `Hi ${name},`,
    body: 'Please confirm your email address to finish setting up your Flowbit account.',
    action: 'Verify email',
    footer: "If you didn't create a Flowbit account, you can ignore this email.",
  },
  ko: {
    subject: '이메일 주소를 인증해 주세요',
    greeting: (name) => `${name}님, 안녕하세요.`,
    body: 'Flowbit 계정 설정을 마치려면 이메일 주소를 인증해 주세요.',
    action: '이메일 인증하기',
    footer: 'Flowbit 계정을 만든 적이 없다면 이 메일을 무시하셔도 됩니다.',
  },
};

const resetPassword: Record<Locale, ActionMail> = {
  en: {
    subject: 'Reset your password',
    greeting: (name) => `Hi ${name},`,
    body: 'We received a request to reset your Flowbit password. This link expires in one hour.',
    action: 'Reset password',
    footer: "If you didn't request a password reset, you can ignore this email.",
  },
  ko: {
    subject: '비밀번호 재설정',
    greeting: (name) => `${name}님, 안녕하세요.`,
    body: 'Flowbit 비밀번호 재설정 요청을 받았습니다. 이 링크는 1시간 후 만료됩니다.',
    action: '비밀번호 재설정하기',
    footer: '비밀번호 재설정을 요청하지 않았다면 이 메일을 무시하셔도 됩니다.',
  },
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function render(mail: ActionMail, name: string, url: string): MailContent {
  const greeting = mail.greeting(name);
  return {
    subject: mail.subject,
    text: [greeting, '', mail.body, '', `${mail.action}: ${url}`, '', mail.footer].join('\n'),
    html: `<!doctype html>
<html>
  <body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1f2328;">
    <p>${escapeHtml(greeting)}</p>
    <p>${escapeHtml(mail.body)}</p>
    <p>
      <a href="${escapeHtml(url)}"
         style="display: inline-block; padding: 10px 16px; background: #2563eb; color: #fff; border-radius: 6px; text-decoration: none;">
        ${escapeHtml(mail.action)}
      </a>
    </p>
    <p style="color: #59636e; font-size: 13px;">${escapeHtml(mail.footer)}</p>
  </body>
</html>`,
  };
}

export const mailTemplates = {
  verifyEmail: (locale: Locale, name: string, url: string) =>
    render(verifyEmail[locale], name, url),
  resetPassword: (locale: Locale, name: string, url: string) =>
    render(resetPassword[locale], name, url),
};
