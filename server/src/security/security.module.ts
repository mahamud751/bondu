import { Global, Module } from '@nestjs/common';
import { PayoutCryptoService } from './payout-crypto.service';

@Global()
@Module({ providers: [PayoutCryptoService], exports: [PayoutCryptoService] })
export class SecurityModule {}
