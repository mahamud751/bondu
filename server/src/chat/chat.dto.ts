import { IsString, IsUUID, Length, MaxLength } from 'class-validator';

export class StartConversationDto { @IsUUID() userId!: string; }
export class SendMessageDto {
  @IsString() @Length(1, 2000) content!: string;
  @IsString() @MaxLength(100) idempotencyKey!: string;
}
