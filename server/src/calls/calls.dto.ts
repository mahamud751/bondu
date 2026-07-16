import { CallType } from '@prisma/client';
import { IsEnum, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
export class RequestCallDto { @IsUUID() vendorId!:string; @IsEnum(CallType) callType:CallType='VOICE'; @IsInt() @Min(60) @Max(3600) maximumSeconds!:number; @IsString() idempotencyKey!:string; }
export class HeartbeatDto { @IsInt() @Min(0) connectedSeconds!:number; }
export class EndCallDto { @IsOptional() @IsInt() @Min(0) connectedSeconds?:number; }
export class CallParticipantEventDto { @IsIn(['MUTED','UNMUTED','SPEAKER_ENABLED','SPEAKER_DISABLED','CAMERA_ENABLED','CAMERA_DISABLED','NETWORK_LOST','RECONNECTED']) eventType!:string;@IsOptional()@IsObject()metadata?:Record<string,unknown> }
