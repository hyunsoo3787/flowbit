import { Inject, Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { ENV, type Env } from '../config/env.js';
import type { MailContent } from './templates.js';

export interface SentMail extends MailContent {
  to: string;
}

/**
 * Sends email over SMTP. Without `SMTP_URL`, emails are written to the log
 * instead, which is enough for local development and evaluation installs.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter | null;
  /** The most recent emails, kept only when SMTP is not configured (for dev and tests). */
  readonly outbox: SentMail[] = [];

  constructor(@Inject(ENV) private readonly env: Env) {
    this.transport = env.SMTP_URL ? createTransport(env.SMTP_URL) : null;
  }

  /** Whether email really leaves the server (SMTP is configured). */
  get configured(): boolean {
    return this.transport !== null;
  }

  async send(to: string, content: MailContent): Promise<void> {
    if (!this.transport) {
      this.outbox.push({ to, ...content });
      if (this.outbox.length > 50) this.outbox.shift();
      this.logger.log(`SMTP not configured; email to ${to}:\n${content.subject}\n${content.text}`);
      return;
    }
    await this.transport.sendMail({ from: this.env.MAIL_FROM, to, ...content });
  }
}
