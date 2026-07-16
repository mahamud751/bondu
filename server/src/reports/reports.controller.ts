import { Body, ConflictException, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString, IsUrl, IsUUID, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtGuard } from '../common/guards/jwt.guard';
import { PrismaService } from '../prisma/prisma.service';

const categories = ['HARASSMENT', 'FAKE_PROFILE', 'FRAUD', 'SPAM', 'ABUSIVE_CONTENT', 'INAPPROPRIATE_BEHAVIOUR', 'UNDERAGE_CONCERN', 'PAYMENT_OUTSIDE_PLATFORM', 'THREAT', 'STOLEN_IDENTITY', 'OTHER'];
class ReportDto {
  @IsUUID() reportedUserId!: string;
  @IsIn(categories) category!: string;
  @IsString() @MaxLength(2000) description!: string;
  @IsOptional() @IsArray() @IsUrl({}, { each: true }) evidenceUrls?: string[];
}
@ApiTags('Reports') @ApiBearerAuth() @UseGuards(JwtGuard) @Controller('reports')
export class ReportsController {
  constructor(private readonly db: PrismaService) {}
  @Post() create(@CurrentUser() user: { sub: string }, @Body() dto: ReportDto) {
    if (user.sub === dto.reportedUserId) throw new ConflictException('You cannot report yourself');
    const priority = ['UNDERAGE_CONCERN', 'THREAT'].includes(dto.category) ? 'URGENT' : ['FRAUD', 'STOLEN_IDENTITY', 'PAYMENT_OUTSIDE_PLATFORM'].includes(dto.category) ? 'HIGH' : 'NORMAL';
    return this.db.report.create({ data: { reporterId: user.sub, ...dto, description: dto.description.trim(), priority } });
  }
  @Get('mine') mine(@CurrentUser() user: { sub: string }) { return this.db.report.findMany({ where: { reporterId: user.sub }, orderBy: { createdAt: 'desc' } }); }
}
