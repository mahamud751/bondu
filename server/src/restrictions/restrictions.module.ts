import { Global, Module } from "@nestjs/common";
import {
  AdminRestrictionsController,
  RestrictionsController,
} from "./restrictions.controller";
import { RestrictionsService } from "./restrictions.service";
@Global()
@Module({
  controllers: [RestrictionsController, AdminRestrictionsController],
  providers: [RestrictionsService],
  exports: [RestrictionsService],
})
export class RestrictionsModule {}
