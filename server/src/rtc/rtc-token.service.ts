import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { RtcRole, RtcTokenBuilder } from 'agora-token';

export type RtcAccess = { provider: 'AGORA' | 'DEVELOPMENT'; appId: string | null; channelName: string; token: string; userAccount: string; expiresAt: string };
@Injectable()
export class RtcTokenService {
  constructor(private readonly config: ConfigService) {}
  issue(callId: string, userId: string, ttlSeconds = 600): RtcAccess {
    return this.build(`call_${callId}`, userId, RtcRole.PUBLISHER, ttlSeconds);
  }
  issueLive(
    liveId: string,
    userId: string,
    role: 'HOST' | 'GUEST' | 'VIEWER',
    ttlSeconds = 14400,
  ): RtcAccess {
    const publisher = role === 'HOST' || role === 'GUEST';
    return this.build(
      `live_${liveId}`,
      userId,
      publisher ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER,
      ttlSeconds,
    );
  }
  private build(channelName: string, userId: string, role: number, ttlSeconds: number): RtcAccess {
    const expiresAtSeconds = Math.floor(Date.now() / 1000) + ttlSeconds;
    const appId = this.config.get<string>('AGORA_APP_ID');
    const certificate = this.config.get<string>('AGORA_APP_CERTIFICATE');
    if (appId && certificate) {
      const token = RtcTokenBuilder.buildTokenWithUserAccount(appId, certificate, channelName, userId, role, expiresAtSeconds, expiresAtSeconds);
      return { provider: 'AGORA', appId, channelName, token, userAccount: userId, expiresAt: new Date(expiresAtSeconds * 1000).toISOString() };
    }
    const secret = this.config.get<string>('RTC_DEVELOPMENT_SECRET') ?? 'local-rtc-only';
    const token = createHmac('sha256', secret).update(`${channelName}:${userId}:${role}:${expiresAtSeconds}`).digest('hex');
    return { provider: 'DEVELOPMENT', appId: null, channelName, token, userAccount: userId, expiresAt: new Date(expiresAtSeconds * 1000).toISOString() };
  }
}
