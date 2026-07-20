import { IsOptional, IsString, MaxLength } from 'class-validator';
export class StartLiveDto {
  @IsOptional() @IsString() @MaxLength(80) title?: string;
}
