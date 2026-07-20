import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { ALLOW_SUSPENDED_KEY } from '../decorators/account-state.decorator';
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly db: PrismaService,
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const request = ctx.switchToHttp().getRequest();
    const value = request.headers.authorization;
    if (!value?.startsWith('Bearer ')) throw new UnauthorizedException();

    let payload: { sub: string; [key: string]: unknown };
    try {
      payload = await this.jwt.verifyAsync(value.slice(7), {
        secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const account = await this.db.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, status: true },
    });
    if (!account) throw new UnauthorizedException('Account no longer exists');

    const allowSuspended = this.reflector.getAllAndOverride<boolean>(
      ALLOW_SUSPENDED_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (
      account.status !== 'ACTIVE' &&
      !(allowSuspended && account.status === 'SUSPENDED')
    ) {
      throw new ForbiddenException(`Account is ${account.status.toLowerCase()}`);
    }

    request.user = { ...payload, role: account.role, status: account.status };
    return true;
  }
}
