import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtGuard } from '../common/guards/jwt.guard';
import { EmailModule } from '../notifications/email.module';
import { SmsModule } from '../sms/sms.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ProviderAuthService } from './provider-auth.service';

@Global()
@Module({
  imports: [JwtModule.register({}), SmsModule, EmailModule],
  controllers: [AuthController],
  providers: [AuthService, ProviderAuthService, JwtGuard],
  exports: [JwtModule, JwtGuard],
})
export class AuthModule {}
