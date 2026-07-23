import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { RtcModule } from '../rtc/rtc.module';
import { ModerationModule } from '../moderation/moderation.module';
import { EngagementModule } from '../engagement/engagement.module';
import { LiveController } from './live.controller';
import { LiveService } from './live.service';
import { LiveTranslateService } from './live-translate.service';

@Module({
  imports: [RealtimeModule, RtcModule, ModerationModule, EngagementModule],
  controllers: [LiveController],
  providers: [LiveService, LiveTranslateService],
  exports: [LiveService],
})
export class LiveModule {}
