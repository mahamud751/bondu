import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
@SkipThrottle() @Controller('health')
export class HealthController {
  constructor(private readonly db: PrismaService) {}
  @Get('live') live() { return { status: 'ok', uptimeSeconds: Math.floor(process.uptime()), timestamp: new Date().toISOString() }; }
  @Get('ready') async ready() { const started=Date.now();await this.db.$queryRaw`SELECT 1`;return {status:'ready',checks:{database:{status:'up',latencyMs:Date.now()-started}},timestamp:new Date().toISOString()}; }
  @Get() check() { return this.ready(); }
}
