import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { RtcRole, RtcTokenBuilder } from 'agora-token';

export type RtcAccess = { provider: 'AGORA' | 'DEVELOPMENT'; appId: string | null; channelName: string; token: string; userAccount: string; expiresAt: string };
@Injectable()
export class RtcTokenService {
  constructor(private readonly config: ConfigService) {}
  issue(callId: string, userId: string, ttlSeconds = 600): RtcAccess {
    const channelName = `call_${callId}`;
    const expiresAtSeconds = Math.floor(Date.now() / 1000) + ttlSeconds;
    const appId = this.config.get<string>('AGORA_APP_ID');
    const certificate = this.config.get<string>('AGORA_APP_CERTIFICATE');
    if (appId && certificate) {
      const token = RtcTokenBuilder.buildTokenWithUserAccount(appId, certificate, channelName, userId, RtcRole.PUBLISHER, expiresAtSeconds, expiresAtSeconds);
      return { provider: 'AGORA', appId, channelName, token, userAccount: userId, expiresAt: new Date(expiresAtSeconds * 1000).toISOString() };
    }
    const secret = this.config.get<string>('RTC_DEVELOPMENT_SECRET') ?? 'local-rtc-only';
    const token = createHmac('sha256', secret).update(`${channelName}:${userId}:${expiresAtSeconds}`).digest('hex');
    return { provider: 'DEVELOPMENT', appId: null, channelName, token, userAccount: userId, expiresAt: new Date(expiresAtSeconds * 1000).toISOString() };
  }
}
