import { MessageType } from "@prisma/client";
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from "class-validator";

export class StartConversationDto {
  @IsUUID() userId!: string;
}
export class SendMessageDto {
  @IsOptional() @IsString() @Length(1, 2000) content?: string;
  @IsOptional() @IsUUID() attachmentId?: string;
  @IsOptional() @IsUUID() replyToId?: string;
  @IsIn(["TEXT", "IMAGE", "VOICE", "VIDEO"]) type!: MessageType;
  @IsString() @MaxLength(100) idempotencyKey!: string;
}
export class ReactMessageDto {
  @IsIn(["❤️", "👍", "😂", "😮", "😢", "🔥"]) emoji!: string;
}
export class DeleteMessageDto {
  @IsIn(["SELF", "EVERYONE"]) mode!: "SELF" | "EVERYONE";
}
