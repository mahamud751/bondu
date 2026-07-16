import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest(); const response = context.switchToHttp().getResponse();
    const route = request.route?.path ? `${request.baseUrl ?? ''}${request.route.path}` : 'unmatched'; const started = process.hrtime.bigint();
    return next.handle().pipe(tap({ finalize: () => { const labels={method:request.method,route,status:String(response.statusCode)};this.metrics.requests.inc(labels);this.metrics.duration.observe(labels,Number(process.hrtime.bigint()-started)/1e9); } }));
  }
}
