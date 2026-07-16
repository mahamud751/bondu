import { Module } from '@nestjs/common';
import { RtcTokenService } from './rtc-token.service';
@Module({ providers: [RtcTokenService], exports: [RtcTokenService] })
export class RtcModule {}
