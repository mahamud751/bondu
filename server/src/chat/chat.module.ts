import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ModerationModule } from '../moderation/moderation.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
@Module({ imports: [WalletModule, RealtimeModule, ModerationModule], controllers: [ChatController], providers: [ChatService] })
export class ChatModule {}
