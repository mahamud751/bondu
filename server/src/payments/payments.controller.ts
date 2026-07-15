import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtGuard } from '../common/guards/jwt.guard';
import { RejectPaymentDto, SubmitPaymentDto } from './payments.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}
  private assertFinance(role: string) { if (!['ADMIN', 'FINANCE'].includes(role)) throw new ForbiddenException(); }
  @Get('instructions') instructions() { return this.service.instructions(); }
  @ApiBearerAuth() @UseGuards(JwtGuard) @Post('manual')
  submit(@CurrentUser() user: { sub: string }, @Body() dto: SubmitPaymentDto) { return this.service.submit(user.sub, dto); }
  @ApiBearerAuth() @UseGuards(JwtGuard) @Get('mine')
  mine(@CurrentUser() user: { sub: string }) { return this.service.listMine(user.sub); }
  @ApiBearerAuth() @UseGuards(JwtGuard) @Get('admin/pending')
  pending(@CurrentUser() user: { role: string }) { this.assertFinance(user.role); return this.service.listPending(); }
  @ApiBearerAuth() @UseGuards(JwtGuard) @Post('admin/:id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: { sub: string; role: string }) { this.assertFinance(user.role); return this.service.approve(id, user.sub); }
  @ApiBearerAuth() @UseGuards(JwtGuard) @Post('admin/:id/reject')
  reject(@Param('id') id: string, @CurrentUser() user: { sub: string; role: string }, @Body() dto: RejectPaymentDto) { this.assertFinance(user.role); return this.service.reject(id, user.sub, dto.reason); }
}
