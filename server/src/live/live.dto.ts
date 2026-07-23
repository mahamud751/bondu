import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const LIVE_CATEGORIES = [
  'CHAT',
  'MUSIC',
  'DANCE',
  'GAMING',
  'TALENT',
  'EDU',
  'LIFESTYLE',
  'OTHER',
] as const;

export type LiveCategory = (typeof LIVE_CATEGORIES)[number];

export class StartLiveDto {
  @IsOptional() @IsString() @MaxLength(80) title?: string;
  @IsOptional() @IsIn([...LIVE_CATEGORIES]) category?: LiveCategory;
  @IsOptional() @IsString() @MaxLength(500) coverUrl?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsIn(['VIDEO', 'AUDIO']) mode?: 'VIDEO' | 'AUDIO';
  @IsOptional() @IsInt() @Min(1) @Max(11) maxGuests?: number;
  @IsOptional() @IsBoolean() seatsOpen?: boolean;
  @IsOptional() @IsBoolean() queueEnabled?: boolean;
  @IsOptional() @IsBoolean() virtualMode?: boolean;
  @IsOptional() @IsString() @MaxLength(24) virtualAvatar?: string;
}

export class LiveChatDto {
  @IsString() @MaxLength(200) body!: string;
  @IsOptional() @IsIn(['bn', 'en']) translateTo?: 'bn' | 'en';
}

export class LiveBanDto {
  @IsString() userId!: string;
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
}

export class LiveChatMuteDto {
  @IsBoolean() muted!: boolean;
}

export class MicRequestDto {
  @IsOptional() @IsString() @MaxLength(80) note?: string;
}

export class MicDecideDto {
  @IsUUID() requestId!: string;
  @IsIn(['ACCEPTED', 'REJECTED']) decision!: 'ACCEPTED' | 'REJECTED';
  @IsOptional() @IsInt() @Min(1) @Max(11) seatIndex?: number;
}

export class SeatControlDto {
  @IsUUID() userId!: string;
  @IsOptional() @IsBoolean() muted?: boolean;
  @IsOptional() @IsBoolean() cameraOff?: boolean;
}

export class SeatsOpenDto {
  @IsBoolean() open!: boolean;
}

export class InviteGuestDto {
  @IsUUID() userId!: string;
  @IsOptional() @IsInt() @Min(1) @Max(11) seatIndex?: number;
}

export class PkChallengeDto {
  @IsUUID() opponentLiveId!: string;
  @IsOptional() @IsInt() @Min(60) @Max(600) durationSeconds?: number;
  @IsOptional() @IsIn(['SOLO', 'BEST_OF_3', 'BEST_OF_5', 'TEAM']) mode?: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) maxRounds?: number;
}

export class PkRespondDto {
  @IsIn(['ACCEPT', 'DECLINE']) decision!: 'ACCEPT' | 'DECLINE';
}

export class TranslateDto {
  @IsString() @MaxLength(400) text!: string;
  @IsOptional() @IsIn(['bn', 'en']) target?: 'bn' | 'en';
}

export class VirtualModeDto {
  @IsBoolean() enabled!: boolean;
  @IsOptional() @IsString() @MaxLength(24) avatar?: string;
}

export class GameStartDto {
  @IsOptional() @IsInt() @Min(1) @Max(5) maxRounds?: number;
}

export class GameStrokeDto {
  @IsArray() strokes!: unknown[];
}

export class GameGuessDto {
  @IsString() @MaxLength(40) guess!: string;
}
