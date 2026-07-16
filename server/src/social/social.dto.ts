import { IsEnum, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
export class SearchUsersDto {
  @IsOptional() @IsString() query?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() interest?: string;
  @IsOptional() @IsEnum(['true','false']) online?: 'true'|'false';
  @IsOptional() @IsEnum(['true','false']) vendor?: 'true'|'false';
  @IsOptional() @Type(() => Number) @Min(1) @Max(1000) maxRate?: number;
  @IsOptional() @Type(() => Number) @Min(0) @Max(5) minRating?: number;
  @IsOptional() @IsEnum(['true','false']) voice?: 'true'|'false';
  @IsOptional() @IsEnum(['true','false']) video?: 'true'|'false';
  @IsOptional() @Type(() => Number) @Min(1) @Max(50) limit?: number;
  @IsOptional() @Type(() => Number) @Min(0) @Max(5000) offset?: number;
}
export class UserTargetDto { @IsUUID() userId!: string; }
