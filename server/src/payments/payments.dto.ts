import { PaymentGateway } from '@prisma/client'; import { IsEnum, IsInt, IsString, Matches, MaxLength, Min } from 'class-validator';
export class SubmitPaymentDto { @IsEnum(PaymentGateway) gateway!:PaymentGateway; @Matches(/^01\d{9}$/) senderNumber!:string; @IsInt() @Min(10) amount!:number; @IsString() @MaxLength(64) transactionId!:string; }
export class RejectPaymentDto { @IsString() @MaxLength(300) reason!:string; }
