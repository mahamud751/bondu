import { IsInt, IsString, IsUUID, Max, Min } from 'class-validator';
export class RequestCallDto { @IsUUID() vendorId!:string; @IsInt() @Min(60) @Max(3600) maximumSeconds!:number; @IsString() idempotencyKey!:string; }
export class HeartbeatDto { @IsInt() @Min(0) connectedSeconds!:number; }
