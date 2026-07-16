import { Module } from '@nestjs/common';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { AppealsController, AdminAppealsController } from './appeals.controller';
@Module({ controllers: [ModerationController,AppealsController,AdminAppealsController], providers: [ModerationService], exports: [ModerationService] })
export class ModerationModule {}
