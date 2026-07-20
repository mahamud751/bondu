import { BadRequestException, Body, Controller, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtGuard } from '../common/guards/jwt.guard';
import { PrismaService } from '../prisma/prisma.service';
import { PayoutCryptoService } from '../security/payout-crypto.service';
import { publicProfile } from '../common/utilities/public-profile';

class ApplyDto {
  @IsString() @Length(2, 120) legalName!: string;
  @IsString() @Length(6, 40) nidNumber!: string;
  @IsUUID() nidFrontAssetId!: string;
  @IsUUID() nidBackAssetId!: string;
  @IsUUID() selfieAssetId!: string;
  @IsString() @Length(10,500) address!:string;
  @IsEmail() contactEmail!:string;
  @IsString() @Length(20,500) profileDescription!:string;
  @IsArray() @IsString({each:true}) supportedLanguages!:string[];
  @IsString() @MaxLength(120) preferredWorkingHours!:string;
  @IsIn(['BKASH','NAGAD','BANK']) payoutMethod!:'BKASH'|'NAGAD'|'BANK';
  @IsString() @Length(6,80) payoutAccount!:string;
  @IsBoolean() voiceCallEnabled!:boolean;
  @IsBoolean() videoCallEnabled!:boolean;
}
class AvailabilityDto { @IsBoolean() available!: boolean; }
class OperationalSettingsDto {
  @IsBoolean() breakActive!: boolean;
  @IsBoolean() autoAcceptCalls!: boolean;
  @IsInt() @Min(0) @Max(1000) maximumDailyCalls!: number;
  @IsInt() @Min(0) @Max(100000000) minimumCallerBalance!: number;
}
class ScheduleEntryDto{@IsInt()@Min(0)@Max(6)dayOfWeek!:number;@IsInt()@Min(0)@Max(1439)startMinute!:number;@IsInt()@Min(0)@Max(1439)endMinute!:number;@IsString()@MaxLength(80)timezone!:string;@IsBoolean()enabled!:boolean}
class ScheduleDto{@IsArray()@ValidateNested({each:true})@Type(()=>ScheduleEntryDto)entries!:ScheduleEntryDto[]}
class DiscoverQueryDto {
  @IsOptional() @IsString() interest?: string;
  @IsOptional() @IsIn(['popular','nearby','new']) sort?: 'popular'|'nearby'|'new';
  @IsOptional() @IsString() country?: string;
}

@ApiTags('Vendors') @Controller('vendors')
export class VendorsController {
  constructor(private readonly db: PrismaService, private readonly crypto: PayoutCryptoService) {}
  @Get('discover') async discover(@Query('sort') sort?: string, @Query('country') country?: string, @Query('interest') interest?: string) {
    const profileIs: Prisma.ProfileWhereInput = { discoverable: true, ...(interest ? { interests: { has: interest } } : {}), ...(country ? { country: { equals: country, mode: 'insensitive' } } : {}) };
    const vendors = await this.db.vendorProfile.findMany({
      where: { status: 'APPROVED', user: { status: 'ACTIVE', profile: { is: profileIs } } },
      select: { id: true, userId: true, status: true, commissionPercent: true, voiceRatePerMinute: true, videoRatePerMinute: true, voiceCallEnabled: true, videoCallEnabled: true, paidChatRate: true, availableForCall: true, averageRating: true, approvedAt: true, user: { select: { profile: true } } },
      orderBy: sort === 'new' ? [{ approvedAt: 'desc' }, { averageRating: 'desc' }] : sort === 'popular' ? [{ calls: { _count: 'desc' } }, { averageRating: 'desc' }] : [{ availableForCall: 'desc' }, { averageRating: 'desc' }],
      take: 50,
    });
    return vendors.map(vendor => ({ ...vendor, user: { profile: publicProfile(vendor.user.profile) } }));
  }
  @ApiBearerAuth() @UseGuards(JwtGuard) @Post('apply')
  async apply(@CurrentUser() user: { sub: string }, @Body() dto: ApplyDto) {
    const ids = [dto.nidFrontAssetId, dto.nidBackAssetId, dto.selfieAssetId];
    if (new Set(ids).size !== 3) throw new BadRequestException('Three distinct verification files are required');
    const assets = await this.db.fileAsset.findMany({ where: { id: { in: ids }, ownerId: user.sub, category: 'KYC', visibility: 'PRIVATE', status: 'READY' }, select: { id: true } });
    if (assets.length !== 3) throw new BadRequestException('Verification files must be private, completed KYC uploads owned by you');
    const data = { legalName: dto.legalName.trim(),address:dto.address.trim(),contactEmail:dto.contactEmail.trim().toLowerCase(),profileDescription:dto.profileDescription.trim(),supportedLanguages:[...new Set(dto.supportedLanguages.map(value=>value.trim()).filter(Boolean))].slice(0,20),preferredWorkingHours:dto.preferredWorkingHours.trim(),payoutMethod:dto.payoutMethod,payoutAccountEncrypted:this.crypto.encrypt(dto.payoutAccount.trim()),payoutAccountLast4:dto.payoutAccount.trim().slice(-4),voiceCallEnabled:dto.voiceCallEnabled,videoCallEnabled:dto.videoCallEnabled, nidNumber: this.crypto.encrypt(dto.nidNumber.trim()), nidFrontUrl: dto.nidFrontAssetId, nidBackUrl: dto.nidBackAssetId, selfieUrl: dto.selfieAssetId };
    const setting=await this.db.setting.findUnique({where:{key:'DEFAULT_VENDOR_COMMISSION'},select:{value:true}}),value=setting?.value as Record<string,unknown>|undefined,configured=value?.percent,commissionPercent=typeof configured==='number'&&Number.isInteger(configured)&&configured>=0&&configured<=100?configured:60;
    const vendor=await this.db.vendorProfile.upsert({ where: { userId: user.sub }, create: { userId: user.sub, status: 'SUBMITTED', commissionPercent, ...data }, update: { status: 'SUBMITTED', approvedAt: null, ...data } });const{nidNumber:_nid,payoutAccountEncrypted:_payout,...safe}=vendor;return{...safe,nidNumber:'••••••••',payoutAccount:this.crypto.mask(vendor.payoutAccountLast4)};
  }
  @ApiBearerAuth() @UseGuards(JwtGuard) @Patch('availability') availability(@CurrentUser() user: { sub: string }, @Body() dto: AvailabilityDto) { return this.db.vendorProfile.update({ where: { userId: user.sub }, data: { availableForCall: dto.available, ...(dto.available ? { breakActive: false } : {}) } }); }
  @ApiBearerAuth() @UseGuards(JwtGuard) @Patch('operational-settings') operationalSettings(@CurrentUser() user: { sub: string }, @Body() dto: OperationalSettingsDto) { return this.db.vendorProfile.update({ where: { userId: user.sub }, data: { breakActive: dto.breakActive, autoAcceptCalls: dto.autoAcceptCalls, maximumDailyCalls: dto.maximumDailyCalls || null, minimumCallerBalance: dto.minimumCallerBalance, ...(dto.breakActive ? { availableForCall: false } : {}) }, select: { breakActive:true,autoAcceptCalls:true,maximumDailyCalls:true,minimumCallerBalance:true,availableForCall:true } }); }
  @ApiBearerAuth() @UseGuards(JwtGuard) @Get('schedule') async schedule(@CurrentUser()user:{sub:string}){const vendor=await this.db.vendorProfile.findUniqueOrThrow({where:{userId:user.sub}});return this.db.vendorSchedule.findMany({where:{vendorId:vendor.id},orderBy:{dayOfWeek:'asc'}})}
  @ApiBearerAuth() @UseGuards(JwtGuard) @Patch('schedule') async updateSchedule(@CurrentUser()user:{sub:string},@Body()dto:ScheduleDto){if(dto.entries.length>7||new Set(dto.entries.map(item=>item.dayOfWeek)).size!==dto.entries.length)throw new BadRequestException('Provide at most one schedule per day');for(const item of dto.entries){if(item.startMinute===item.endMinute)throw new BadRequestException('Schedule start and end must differ');try{new Intl.DateTimeFormat('en-US',{timeZone:item.timezone}).format()}catch{throw new BadRequestException('Invalid IANA timezone')}}const vendor=await this.db.vendorProfile.findUniqueOrThrow({where:{userId:user.sub}});return this.db.$transaction(async tx=>{await tx.vendorSchedule.deleteMany({where:{vendorId:vendor.id}});if(dto.entries.length)await tx.vendorSchedule.createMany({data:dto.entries.map(item=>({...item,vendorId:vendor.id}))});return tx.vendorSchedule.findMany({where:{vendorId:vendor.id},orderBy:{dayOfWeek:'asc'}})})}
}
