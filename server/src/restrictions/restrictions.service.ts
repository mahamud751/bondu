import { ForbiddenException, Injectable } from "@nestjs/common";
import { RestrictionType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
@Injectable()
export class RestrictionsService {
  constructor(private readonly db: PrismaService) {}
  async assertAllowed(userId: string, type: RestrictionType) {
    const restriction = await this.db.userRestriction.findFirst({
      where: {
        userId,
        type,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
    });
    if (restriction)
      throw new ForbiddenException(
        `${type.toLowerCase()} access is restricted: ${restriction.reason}`,
      );
  }
  list(userId: string) {
    return this.db.userRestriction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
}
