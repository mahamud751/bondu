import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
export class PurchaseGiftCardDto {
  @IsUUID() recipientId!: string;
  @IsOptional() @IsUUID() vendorId?: string;
  @IsString() @MaxLength(100) idempotencyKey!: string;
}
