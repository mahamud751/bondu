import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { RtcModule } from '../rtc/rtc.module';
import { LiveController } from './live.controller';
import { LiveService } from './live.service';

@Module({
  imports: [RealtimeModule, RtcModule],
  controllers: [LiveController],
  providers: [LiveService],
  exports: [LiveService],
})
export class LiveModule {}
