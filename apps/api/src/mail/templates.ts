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

interface InvitationMail {
  subject: (inviter: string, target: string) => string;
  body: (inviter: string, target: string, days: number) => string;
  action: string;
  footer: string;
}

const invitation: Record<Locale, InvitationMail> = {
  en: {
    subject: (inviter, target) => `${inviter} invited you to ${target} on Flowbit`,
    body: (inviter, target, days) =>
      `${inviter} invited you to collaborate on ${target} in Flowbit. The invitation expires in ${days} days.`,
    action: 'Accept invitation',
    footer: "If you weren't expecting this invitation, you can ignore this email.",
  },
  ko: {
    subject: (inviter, target) => `${inviter}님이 Flowbit의 ${target}에 초대했습니다`,
    body: (inviter, target, days) =>
      `${inviter}님이 Flowbit에서 ${target}에 함께하자고 초대했습니다. 초대는 ${days}일 후 만료됩니다.`,
    action: '초대 수락하기',
    footer: '예상하지 못한 초대라면 이 메일을 무시하셔도 됩니다.',
  },
};

interface NoticeMail {
  subject: string;
  greeting: (name: string) => string;
  body: string;
  footer: string;
}

const passwordResetIssued: Record<Locale, NoticeMail> = {
  en: {
    subject: 'A password reset link was created for your account',
    greeting: (name) => `Hi ${name},`,
    body: 'An administrator of this Flowbit server created a one-time link to reset your password. They will give it to you directly. The link expires in one hour.',
    footer: "If you didn't ask for help with your password, contact your Flowbit administrator.",
  },
  ko: {
    subject: '계정의 비밀번호 재설정 링크가 생성되었습니다',
    greeting: (name) => `${name}님, 안녕하세요.`,
    body: '이 Flowbit 서버의 관리자가 비밀번호를 재설정할 수 있는 일회용 링크를 만들었습니다. 관리자가 직접 전달해 드릴 예정이며, 링크는 1시간 후 만료됩니다.',
    footer: '비밀번호 관련 도움을 요청한 적이 없다면 Flowbit 관리자에게 문의해 주세요.',
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
  return renderAction(mail.subject, mail.greeting(name), mail.body, mail.action, url, mail.footer);
}

function renderNotice(mail: NoticeMail, name: string): MailContent {
  const greeting = mail.greeting(name);
  return {
    subject: mail.subject,
    text: [greeting, '', mail.body, '', mail.footer].join('\n'),
    html: `<!doctype html>
<html>
  <body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1f2328;">
    <p>${escapeHtml(greeting)}</p>
    <p>${escapeHtml(mail.body)}</p>
    <p style="color: #59636e; font-size: 13px;">${escapeHtml(mail.footer)}</p>
  </body>
</html>`,
  };
}

function renderAction(
  subject: string,
  greeting: string | null,
  body: string,
  action: string,
  url: string,
  footer: string,
): MailContent {
  const mail = { subject, body, action, footer };
  return {
    subject: mail.subject,
    text: [
      ...(greeting ? [greeting, ''] : []),
      mail.body,
      '',
      `${mail.action}: ${url}`,
      '',
      mail.footer,
    ].join('\n'),
    html: `<!doctype html>
<html>
  <body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1f2328;">
    ${greeting ? `<p>${escapeHtml(greeting)}</p>` : ''}
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
  invitation: (locale: Locale, inviter: string, target: string, days: number, url: string) => {
    const mail = invitation[locale];
    return renderAction(
      mail.subject(inviter, target),
      null,
      mail.body(inviter, target, days),
      mail.action,
      url,
      mail.footer,
    );
  },
  passwordResetIssued: (locale: Locale, name: string) =>
    renderNotice(passwordResetIssued[locale], name),
};
