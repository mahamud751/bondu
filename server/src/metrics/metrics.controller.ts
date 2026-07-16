import { Controller, ForbiddenException, Get, Header, Headers } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { MetricsService } from './metrics.service';

@SkipThrottle() @Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics:MetricsService,private readonly config:ConfigService){}
  @Get() @Header('Content-Type','text/plain; version=0.0.4; charset=utf-8')
  scrape(@Headers('x-metrics-token')token?:string){const required=this.config.get<string>('METRICS_TOKEN');if(required&&token!==required)throw new ForbiddenException();return this.metrics.render()}
}
