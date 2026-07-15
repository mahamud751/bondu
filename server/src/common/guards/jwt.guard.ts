import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  async canActivate(ctx: ExecutionContext) {
    const value = ctx.switchToHttp().getRequest().headers.authorization;
    if (!value?.startsWith('Bearer ')) throw new UnauthorizedException();
    try { ctx.switchToHttp().getRequest().user = await this.jwt.verifyAsync(value.slice(7)); return true; }
    catch { throw new UnauthorizedException('Invalid or expired access token'); }
  }
}
