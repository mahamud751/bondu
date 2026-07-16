import { Body, Controller, ForbiddenException, Get, Headers, Param, Post, Redirect, Req, Res, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { StaffPermissionKey } from '@prisma/client';
import { IsIn, IsInt, IsString, MaxLength, Min } from 'class-validator';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtGuard } from '../common/guards/jwt.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { FilesService } from './files.service';
class UploadRequestDto { @IsIn(['PROFILE', 'CHAT', 'KYC', 'REPORT', 'GIFT']) category!: string; @IsString() @MaxLength(255) fileName!: string; @IsString() @MaxLength(100) mimeType!: string; @IsInt() @Min(1) sizeBytes!: number; }
class LocalUploadDto { @IsIn(['PROFILE', 'CHAT', 'KYC', 'REPORT', 'GIFT']) category!: string; }
@ApiTags('Files') @ApiBearerAuth() @UseGuards(JwtGuard) @Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}
  @Post('upload-request') request(@CurrentUser() user: { sub: string }, @Body() dto: UploadRequestDto) { return this.files.requestUpload(user.sub, dto); }
  @Post(':id/complete') complete(@CurrentUser() user: { sub: string }, @Param('id') id: string) { return this.files.complete(user.sub, id); }
  @ApiConsumes('multipart/form-data') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25_000_000, files: 1 } })) @Post('local') local(@CurrentUser() user: { sub: string }, @Body() dto: LocalUploadDto, @UploadedFile() file: Express.Multer.File) { return this.files.localUpload(user.sub, dto.category, file); }
  @Get(':id/content') async content(@CurrentUser() user: { sub: string; role: string }, @Param('id') id: string, @Res({ passthrough: true }) response: Response) { const result = await this.files.access(id, user.sub, user.role); if (result.redirect) { response.redirect(result.redirect); return; } response.setHeader('Content-Type', result.asset.mimeType); response.setHeader('Content-Disposition', `inline; filename="${result.asset.originalName.replaceAll('"', '')}"`); return new StreamableFile(result.buffer!); }
  @Get('admin/scan-queue') @UseGuards(PermissionsGuard) @RequirePermissions(StaffPermissionKey.MODERATE_CONTENT) scanQueue(@CurrentUser()user:{role:string}){if(!['ADMIN','MODERATOR'].includes(user.role))throw new ForbiddenException();return this.files.scanQueue()}
  @Post('admin/:id/rescan') @UseGuards(PermissionsGuard) @RequirePermissions(StaffPermissionKey.MODERATE_CONTENT) rescan(@CurrentUser()user:{role:string},@Param('id')id:string){if(!['ADMIN','MODERATOR'].includes(user.role))throw new ForbiddenException();return this.files.rescan(id)}
}
