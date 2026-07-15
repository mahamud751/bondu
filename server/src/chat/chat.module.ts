import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
@Module({ imports: [WalletModule], controllers: [ChatController], providers: [ChatService] })
export class ChatModule {}
