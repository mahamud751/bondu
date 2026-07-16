import { Module } from "@nestjs/common";
import { SupportModule } from "../support/support.module";
import { WalletModule } from "../wallet/wallet.module";
import { CallsModule } from "../calls/calls.module";
import { AdminController } from "./admin.controller";
import { ExportsController } from "./exports.controller";
import { StaffPermissionsController } from "./staff-permissions.controller";

@Module({
  imports: [WalletModule, SupportModule, CallsModule],
  controllers: [AdminController, ExportsController, StaffPermissionsController],
})
export class AdminModule {}
