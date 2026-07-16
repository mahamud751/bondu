import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID } from 'crypto';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  configured() {
    return (this.config.get<string>('EMAIL_PROVIDER') ?? 'disabled') !== 'disabled';
  }

  async send(to: string, subject: string, text: string) {
    const provider = (this.config.get<string>('EMAIL_PROVIDER') ?? 'disabled').toLowerCase();
    if (provider === 'resend') return this.resend(to, subject, text);
    if (provider === 'webhook') return this.webhook(to, subject, text);
    throw new BadGatewayException('Email provider is not configured');
  }

  private async resend(to: string, subject: string, text: string) {
    const apiKey = this.config.getOrThrow<string>('RESEND_API_KEY');
    const from = this.config.getOrThrow<string>('EMAIL_FROM');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!response.ok) {
      this.logger.error(`Resend rejected email with status ${response.status}`);
      throw new BadGatewayException('Email delivery failed');
    }
    const result = (await response.json()) as { id?: string };
    return { provider: 'resend', providerId: result.id };
  }

  private async webhook(to: string, subject: string, text: string) {
    const url = this.config.getOrThrow<string>('EMAIL_WEBHOOK_URL');
    const secret = this.config.getOrThrow<string>('EMAIL_WEBHOOK_SECRET');
    const id = randomUUID();
    const timestamp = Date.now().toString();
    const payload = JSON.stringify({ id, to, subject, text, timestamp });
    const signature = createHmac('sha256', secret).update(payload).digest('hex');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SocialConnect-Signature': signature,
        'X-SocialConnect-Timestamp': timestamp,
      },
      body: payload,
    });
    if (!response.ok) {
      this.logger.error(`Email webhook rejected request with status ${response.status}`);
      throw new BadGatewayException('Email delivery failed');
    }
    return { provider: 'webhook', providerId: id };
  }
}
