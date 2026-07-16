import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

@Injectable()
export class PayoutCryptoService {
  private readonly key: Buffer;
  private readonly keyId: string;

  constructor(config: ConfigService) {
    const configured = config.get<string>('PAYOUT_ENCRYPTION_KEY');
    const fallback = config.get<string>('JWT_REFRESH_SECRET') ?? 'development-only';
    this.key = configured ? this.decodeKey(configured) : createHash('sha256').update(fallback).digest();
    this.keyId = config.get<string>('PAYOUT_ENCRYPTION_KEY_ID') ?? 'v1';
  }

  encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${this.keyId}.${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
  }

  decrypt(payload: string) {
    const parts = payload.split('.');
    if (parts.length !== 4) throw new InternalServerErrorException('Legacy payout details require secure migration');
    const [, iv, tag, ciphertext] = parts;
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
    } catch { throw new InternalServerErrorException('Payout details could not be decrypted'); }
  }

  mask(last4?: string | null) { return last4 ? `•••••••${last4}` : '•••••••••••'; }

  private decodeKey(value: string) {
    const key = /^[a-f\d]{64}$/i.test(value) ? Buffer.from(value, 'hex') : Buffer.from(value, 'base64');
    if (key.length !== 32) throw new Error('PAYOUT_ENCRYPTION_KEY must be 32 bytes encoded as base64 or 64 hex characters');
    return key;
  }
}
