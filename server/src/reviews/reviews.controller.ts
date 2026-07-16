import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Role, StaffPermissionKey } from "@prisma/client";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtGuard } from "../common/guards/jwt.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ReviewsService } from "./reviews.service";
export class CreateReviewDto {
  @IsUUID() callId!: string;
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsInt() @Min(1) @Max(5) behaviourRating!: number;
  @IsInt() @Min(1) @Max(5) qualityRating!: number;
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}
export class ReportReviewDto {
  @IsIn(["ABUSE", "HARASSMENT", "PERSONAL_INFO", "SPAM", "FAKE", "OTHER"])
  reason!: string;
  @IsOptional() @IsString() @MaxLength(1000) details?: string;
}
export class ModerateReviewReportDto {
  @IsIn(["RESOLVED", "REJECTED"]) status!: string;
  @IsIn(["HIDE", "KEEP"]) reviewAction!: string;
  @IsString() @MaxLength(1000) resolution!: string;
}
export class ReviewVisibilityDto {
  @IsIn(["VISIBLE", "HIDDEN"]) status!: string;
  @IsString() @MaxLength(1000) reason!: string;
}
@ApiTags("Reviews")
@Controller("reviews")
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}
  @Get("vendor/:vendorId") list(
    @Param("vendorId") id: string,
    @Query("cursor") cursor?: string,
  ) {
    return this.service.list(id, cursor);
  }
  @ApiBearerAuth() @UseGuards(JwtGuard) @Post() create(
    @CurrentUser() u: { sub: string },
    @Body() d: CreateReviewDto,
  ) {
    return this.service.create(u.sub, d);
  }
  @ApiBearerAuth() @UseGuards(JwtGuard) @Post(":id/report") report(
    @CurrentUser() u: { sub: string },
    @Param("id") id: string,
    @Body() d: ReportReviewDto,
  ) {
    return this.service.report(u.sub, id, d);
  }
}
@ApiTags("Admin reviews")
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.MODERATOR)
@RequirePermissions(StaffPermissionKey.MODERATE_CONTENT)
@Controller("admin/reviews")
export class AdminReviewsController {
  constructor(private readonly service: ReviewsService) {}
  @Get("reports") reports() {
    return this.service.reportQueue();
  }
  @Patch("reports/:id") moderate(
    @CurrentUser() u: { sub: string; role: string },
    @Param("id") id: string,
    @Body() d: ModerateReviewReportDto,
  ) {
    return this.service.moderateReport(u, id, d);
  }
  @Patch(":id/visibility") visibility(
    @CurrentUser() u: { sub: string; role: string },
    @Param("id") id: string,
    @Body() d: ReviewVisibilityDto,
  ) {
    return this.service.visibility(u, id, d);
  }
}
