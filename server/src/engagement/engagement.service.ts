import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

const LEVEL_THRESHOLDS = [0, 50, 150, 400, 900, 1800, 3500, 6000, 10000, 16000];

function levelFromXp(xp: number) {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  return level;
}

function periodKey(period: string) {
  const now = new Date();
  if (period === 'WEEKLY') {
    const day = now.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + mondayOffset),
    );
    return `W-${monday.toISOString().slice(0, 10)}`;
  }
  return `D-${now.toISOString().slice(0, 10)}`;
}

const DEFAULT_TASKS = [
  {
    code: 'WATCH_LIVE',
    title: 'Watch a live stream',
    description: 'Join any live room today',
    rewardPoints: 15,
    period: 'DAILY',
    targetCount: 1,
  },
  {
    code: 'SEND_GIFT',
    title: 'Send a gift',
    description: 'Support a creator with any gift',
    rewardPoints: 25,
    period: 'DAILY',
    targetCount: 1,
  },
  {
    code: 'SEND_CHAT',
    title: 'Chat in live',
    description: 'Send 3 live chat messages',
    rewardPoints: 10,
    period: 'DAILY',
    targetCount: 3,
  },
  {
    code: 'LIKE_LIVE',
    title: 'Like a stream',
    description: 'Send a free like in live',
    rewardPoints: 5,
    period: 'DAILY',
    targetCount: 1,
  },
  {
    code: 'GO_LIVE',
    title: 'Go live',
    description: 'Start a live session this week',
    rewardPoints: 50,
    period: 'WEEKLY',
    targetCount: 1,
  },
];

@Injectable()
export class EngagementService {
  constructor(
    private readonly db: PrismaService,
    private readonly wallets: WalletService,
  ) {}

  async ensureTasks() {
    for (const task of DEFAULT_TASKS) {
      await this.db.taskDefinition.upsert({
        where: { code: task.code },
        create: task,
        update: {
          title: task.title,
          description: task.description,
          rewardPoints: task.rewardPoints,
          period: task.period,
          targetCount: task.targetCount,
          active: true,
        },
      });
    }
  }

  async getLevels(userId: string) {
    return this.ensureLevel(userId);
  }

  async addXp(
    userId: string,
    kind: 'wealth' | 'charm' | 'host',
    amount: number,
  ) {
    if (amount <= 0) return this.ensureLevel(userId);
    const current = await this.ensureLevel(userId);
    const data =
      kind === 'wealth'
        ? { wealthXp: current.wealthXp + amount }
        : kind === 'charm'
          ? { charmXp: current.charmXp + amount }
          : { hostXp: current.hostXp + amount };
    const wealthXp = kind === 'wealth' ? data.wealthXp! : current.wealthXp;
    const charmXp = kind === 'charm' ? data.charmXp! : current.charmXp;
    const hostXp = kind === 'host' ? data.hostXp! : current.hostXp;
    return this.db.userLevel.update({
      where: { userId },
      data: {
        ...data,
        wealthLevel: levelFromXp(wealthXp),
        charmLevel: levelFromXp(charmXp),
        hostLevel: levelFromXp(hostXp),
      },
    });
  }

  async listTasks(userId: string) {
    await this.ensureTasks();
    const tasks = await this.db.taskDefinition.findMany({
      where: { active: true },
      orderBy: { code: 'asc' },
    });
    const result = [];
    for (const task of tasks) {
      const key = periodKey(task.period);
      let claim = await this.db.taskClaim.findUnique({
        where: {
          taskId_userId_periodKey: {
            taskId: task.id,
            userId,
            periodKey: key,
          },
        },
      });
      if (!claim) {
        claim = await this.db.taskClaim.create({
          data: {
            taskId: task.id,
            userId,
            periodKey: key,
            progress: 0,
          },
        });
      }
      result.push({
        code: task.code,
        title: task.title,
        description: task.description,
        rewardPoints: task.rewardPoints,
        period: task.period,
        targetCount: task.targetCount,
        progress: claim.progress,
        completed: claim.completed,
        claimed: claim.claimed,
        periodKey: key,
        claimId: claim.id,
      });
    }
    return result;
  }

  async progressTask(userId: string, code: string, increment = 1) {
    await this.ensureTasks();
    const task = await this.db.taskDefinition.findUnique({ where: { code } });
    if (!task || !task.active) return null;
    const key = periodKey(task.period);
    let claim = await this.db.taskClaim.findUnique({
      where: {
        taskId_userId_periodKey: { taskId: task.id, userId, periodKey: key },
      },
    });
    if (!claim) {
      const progress = Math.min(task.targetCount, increment);
      return this.db.taskClaim.create({
        data: {
          taskId: task.id,
          userId,
          periodKey: key,
          progress,
          completed: progress >= task.targetCount,
        },
      });
    }
    if (claim.claimed || claim.completed) return claim;
    const progress = Math.min(task.targetCount, claim.progress + increment);
    return this.db.taskClaim.update({
      where: { id: claim.id },
      data: {
        progress,
        completed: progress >= task.targetCount,
      },
    });
  }

  async claimTask(userId: string, code: string) {
    await this.ensureTasks();
    const task = await this.db.taskDefinition.findUnique({ where: { code } });
    if (!task) throw new NotFoundException('Task not found');
    const key = periodKey(task.period);
    const claim = await this.db.taskClaim.findUnique({
      where: {
        taskId_userId_periodKey: { taskId: task.id, userId, periodKey: key },
      },
    });
    if (!claim || !claim.completed) {
      throw new ConflictException('Task is not complete yet');
    }
    if (claim.claimed) throw new ConflictException('Reward already claimed');

    await this.wallets.transaction(async (tx) => {
      await tx.taskClaim.update({
        where: { id: claim.id },
        data: { claimed: true },
      });
      await this.wallets.creditPromotional(tx, {
        userId,
        type: 'PROMOTIONAL_BONUS',
        direction: 'CREDIT',
        amount: task.rewardPoints,
        referenceType: 'TASK_REWARD',
        referenceId: claim.id,
        description: `Task reward: ${task.title}`,
        idempotencyKey: `task-reward:${claim.id}`,
      });
    });

    return { claimed: true, amount: task.rewardPoints, code: task.code };
  }

  async getOrCreateFanClub(ownerId: string, name?: string) {
    const existing = await this.db.fanClub.findUnique({ where: { ownerId } });
    if (existing) return this.serializeClub(existing.id, ownerId);
    const profile = await this.db.profile.findUnique({
      where: { userId: ownerId },
      select: { displayName: true },
    });
    const club = await this.db.fanClub.create({
      data: {
        ownerId,
        name: name?.trim() || `${profile?.displayName ?? 'Creator'} Fan Club`,
        joinCost: 10,
      },
    });
    return this.serializeClub(club.id, ownerId);
  }

  async fanClubForOwner(ownerId: string, viewerId?: string) {
    const club = await this.db.fanClub.findUnique({ where: { ownerId } });
    if (!club) {
      return {
        exists: false,
        ownerId,
        joinCost: 10,
        memberCount: 0,
        name: null,
        membership: null,
      };
    }
    return this.serializeClub(club.id, viewerId);
  }

  async joinFanClub(ownerId: string, userId: string) {
    if (ownerId === userId) {
      throw new ConflictException('You already own this fan club');
    }
    const club = await this.getOrCreateFanClub(ownerId);
    const existing = await this.db.fanClubMember.findUnique({
      where: { clubId_userId: { clubId: club.id, userId } },
    });
    if (existing) {
      return {
        joined: true,
        alreadyMember: true,
        membership: existing,
        club,
      };
    }

    const cost = club.joinCost;
    await this.wallets.transaction(async (tx) => {
      await this.wallets.debitPurchased(tx, {
        userId,
        type: 'GIFT_PURCHASE',
        direction: 'DEBIT',
        amount: cost,
        referenceType: 'FAN_CLUB',
        referenceId: club.id,
        description: `Joined fan club ${club.name}`,
        idempotencyKey: `fan-club-join:${club.id}:${userId}`,
      });
      // credit owner promotional charm / pending earning as host
      const vendor = await tx.vendorProfile.findUnique({
        where: { userId: ownerId },
      });
      if (vendor) {
        await this.wallets.creditPendingEarning(
          tx,
          ownerId,
          Math.floor(cost * 0.7),
          `fan-club:${club.id}:${userId}`,
          'GIFT',
        );
      }
      await tx.fanClubMember.create({
        data: { clubId: club.id, userId, intimacyPoints: 10, level: 1 },
      });
      await tx.fanClub.update({
        where: { id: club.id },
        data: { memberCount: { increment: 1 } },
      });
    });

    await this.addXp(userId, 'wealth', cost);
    await this.addXp(ownerId, 'charm', cost);

    return {
      joined: true,
      alreadyMember: false,
      club: await this.serializeClub(club.id, userId),
    };
  }

  async addIntimacy(ownerId: string, userId: string, points: number) {
    const club = await this.db.fanClub.findUnique({ where: { ownerId } });
    if (!club) return null;
    const member = await this.db.fanClubMember.findUnique({
      where: { clubId_userId: { clubId: club.id, userId } },
    });
    if (!member) return null;
    const intimacyPoints = member.intimacyPoints + points;
    const level = Math.min(50, 1 + Math.floor(intimacyPoints / 100));
    return this.db.fanClubMember.update({
      where: { id: member.id },
      data: { intimacyPoints, level, lastActiveAt: new Date() },
    });
  }

  private async ensureLevel(userId: string) {
    const existing = await this.db.userLevel.findUnique({ where: { userId } });
    if (existing) return existing;
    return this.db.userLevel.create({ data: { userId } });
  }

  private async serializeClub(clubId: string, viewerId?: string) {
    const club = await this.db.fanClub.findUniqueOrThrow({
      where: { id: clubId },
      include: {
        owner: { select: { profile: { select: { displayName: true, avatarUrl: true } } } },
      },
    });
    let membership = null;
    if (viewerId) {
      membership = await this.db.fanClubMember.findUnique({
        where: { clubId_userId: { clubId, userId: viewerId } },
      });
    }
    return {
      exists: true,
      id: club.id,
      ownerId: club.ownerId,
      name: club.name,
      badge: club.badge,
      joinCost: club.joinCost,
      memberCount: club.memberCount,
      ownerName: club.owner.profile?.displayName ?? 'Creator',
      membership: membership
        ? {
            level: membership.level,
            intimacyPoints: membership.intimacyPoints,
            joinedAt: membership.joinedAt.toISOString(),
          }
        : null,
    };
  }

  async leaderboards(scope: 'wealth' | 'charm' | 'host' | 'gifts' = 'wealth', limit = 20) {
    if (scope === 'gifts') {
      const since = new Date(Date.now() - 7 * 86400000);
      const groups = await this.db.giftTransaction.groupBy({
        by: ['senderId'],
        where: { createdAt: { gte: since } },
        _sum: { grossAmount: true },
        orderBy: { _sum: { grossAmount: 'desc' } },
        take: limit,
      });
      const profiles = await this.db.profile.findMany({
        where: { userId: { in: groups.map((g) => g.senderId) } },
        select: { userId: true, displayName: true, avatarUrl: true, isVerified: true },
      });
      const map = new Map(profiles.map((p) => [p.userId, p]));
      return groups.map((g, i) => ({
        rank: i + 1,
        userId: g.senderId,
        score: g._sum.grossAmount ?? 0,
        displayName: map.get(g.senderId)?.displayName ?? 'User',
        avatarUrl: map.get(g.senderId)?.avatarUrl ?? null,
        isVerified: map.get(g.senderId)?.isVerified ?? false,
        scope: 'gifts',
      }));
    }
    const order =
      scope === 'charm'
        ? { charmXp: 'desc' as const }
        : scope === 'host'
          ? { hostXp: 'desc' as const }
          : { wealthXp: 'desc' as const };
    const rows = await this.db.userLevel.findMany({
      orderBy: order,
      take: limit,
      include: {
        user: {
          select: {
            profile: {
              select: { displayName: true, avatarUrl: true, isVerified: true },
            },
          },
        },
      },
    });
    return rows.map((row, i) => ({
      rank: i + 1,
      userId: row.userId,
      score:
        scope === 'charm'
          ? row.charmXp
          : scope === 'host'
            ? row.hostXp
            : row.wealthXp,
      level:
        scope === 'charm'
          ? row.charmLevel
          : scope === 'host'
            ? row.hostLevel
            : row.wealthLevel,
      displayName: row.user.profile?.displayName ?? 'User',
      avatarUrl: row.user.profile?.avatarUrl ?? null,
      isVerified: row.user.profile?.isVerified ?? false,
      scope,
    }));
  }

  async activeEvents() {
    const now = new Date();
    await this.ensureDefaultEvent();
    return this.db.platformEvent.findMany({
      where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } },
      orderBy: { startsAt: 'asc' },
    });
  }

  async ensureDefaultEvent() {
    const year = new Date().getUTCFullYear();
    const code = `season-${year}`;
    const existing = await this.db.platformEvent.findUnique({ where: { code } });
    if (existing) return existing;
    const startsAt = new Date(Date.UTC(year, 0, 1));
    const endsAt = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
    return this.db.platformEvent.create({
      data: {
        code,
        title: `${year} Creator Season`,
        description: 'Season leaderboard and gift bonus window for SocialConnect creators.',
        startsAt,
        endsAt,
        giftBonusPct: 5,
        active: true,
      },
    });
  }

  async joinSuperFan(hostId: string, userId: string) {
    if (hostId === userId) throw new ConflictException('Cannot become your own super fan');
    const cost = 200;
    const existing = await this.db.superFan.findUnique({
      where: { hostId_userId: { hostId, userId } },
    });
    if (existing) return { joined: true, alreadyMember: true, superFan: existing };
    const expiresAt = new Date(Date.now() + 30 * 86400000);
    await this.wallets.transaction(async (tx) => {
      await this.wallets.debitPurchased(tx, {
        userId,
        type: 'GIFT_PURCHASE',
        direction: 'DEBIT',
        amount: cost,
        referenceType: 'SUPER_FAN',
        referenceId: `${hostId}:${userId}`,
        description: 'Super fan membership (30 days)',
        idempotencyKey: `super-fan:${hostId}:${userId}:${expiresAt.toISOString().slice(0, 10)}`,
      });
      const vendor = await tx.vendorProfile.findUnique({ where: { userId: hostId } });
      if (vendor) {
        await this.wallets.creditPendingEarning(
          tx,
          hostId,
          Math.floor(cost * 0.75),
          `super-fan:${hostId}:${userId}`,
          'GIFT',
        );
      }
      await tx.superFan.upsert({
        where: { hostId_userId: { hostId, userId } },
        create: {
          hostId,
          userId,
          tier: 'SUPER',
          entryFx: 'GOLD_WAVE',
          expiresAt,
        },
        update: { expiresAt, entryFx: 'GOLD_WAVE' },
      });
    });
    await this.addXp(userId, 'wealth', cost);
    await this.addXp(hostId, 'charm', cost);
    const superFan = await this.db.superFan.findUniqueOrThrow({
      where: { hostId_userId: { hostId, userId } },
    });
    return { joined: true, alreadyMember: false, superFan, cost };
  }

  async superFanStatus(hostId: string, userId: string) {
    const row = await this.db.superFan.findUnique({
      where: { hostId_userId: { hostId, userId } },
    });
    if (!row) return { active: false, cost: 200 };
    if (row.expiresAt && row.expiresAt < new Date()) {
      return { active: false, expired: true, cost: 200 };
    }
    return {
      active: true,
      tier: row.tier,
      entryFx: row.entryFx,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      cost: 200,
    };
  }

  async getBeauty(userId: string) {
    return this.db.beautyPreset.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async saveBeauty(
    userId: string,
    data: {
      smooth?: number;
      whiten?: number;
      slim?: number;
      bigEye?: number;
      filterId?: string;
    },
  ) {
    const clamp = (n: number | undefined, fallback: number) =>
      typeof n === 'number' ? Math.min(100, Math.max(0, Math.floor(n))) : fallback;
    const current = await this.getBeauty(userId);
    return this.db.beautyPreset.update({
      where: { userId },
      data: {
        smooth: clamp(data.smooth, current.smooth),
        whiten: clamp(data.whiten, current.whiten),
        slim: clamp(data.slim, current.slim),
        bigEye: clamp(data.bigEye, current.bigEye),
        filterId: data.filterId?.slice(0, 40) || current.filterId,
      },
    });
  }

  async coachTip(viewerCount: number, locale = 'en') {
    await this.ensureCoachTips();
    const tips = await this.db.liveCoachTip.findMany({
      where: {
        active: true,
        locale: locale === 'bn' ? 'bn' : 'en',
        minViewers: { lte: viewerCount },
      },
      orderBy: { minViewers: 'desc' },
      take: 20,
    });
    const eligible = tips.filter(
      (t) => t.maxViewers == null || viewerCount <= t.maxViewers,
    );
    if (!eligible.length) {
      return {
        message:
          locale === 'bn'
            ? 'দর্শকদের সাথে কথা বলুন এবং উপহারের জন্য ধন্যবাদ জানান।'
            : 'Talk to viewers and thank gift senders by name.',
      };
    }
    const pick = eligible[Math.floor(Math.random() * eligible.length)];
    return { code: pick.code, message: pick.message };
  }

  async ensureCoachTips() {
    const tips = [
      { code: 'greet-en', locale: 'en', message: 'Greet new joiners by name to boost chat.', minViewers: 0, maxViewers: 5 },
      { code: 'topic-en', locale: 'en', message: 'Chat is quiet — start a fun topic or poll.', minViewers: 0, maxViewers: 20 },
      { code: 'guest-en', locale: 'en', message: 'Invite a guest on stage for more energy.', minViewers: 3, maxViewers: 50 },
      { code: 'gift-en', locale: 'en', message: 'Thank top gifters and pin their names.', minViewers: 5, maxViewers: null },
      { code: 'pk-en', locale: 'en', message: 'Challenge another room to a PK for discovery.', minViewers: 8, maxViewers: null },
      { code: 'greet-bn', locale: 'bn', message: 'নতুন দর্শকদের নাম ধরে স্বাগতম জানান।', minViewers: 0, maxViewers: 5 },
      { code: 'topic-bn', locale: 'bn', message: 'চ্যাট শান্ত — একটি মজার বিষয় শুরু করুন।', minViewers: 0, maxViewers: 20 },
      { code: 'guest-bn', locale: 'bn', message: 'মঞ্চে অতিথি ডাকুন বেশি এনার্জির জন্য।', minViewers: 3, maxViewers: 50 },
    ];
    for (const tip of tips) {
      await this.db.liveCoachTip.upsert({
        where: { code: tip.code },
        create: tip,
        update: { message: tip.message, active: true },
      });
    }
  }

  async setLocale(userId: string, locale: 'en' | 'bn') {
    return this.db.user.update({
      where: { id: userId },
      data: { localePreference: locale },
      select: { id: true, localePreference: true },
    });
  }

  async getLocale(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { localePreference: true },
    });
    return { locale: user?.localePreference === 'bn' ? 'bn' : 'en' };
  }
}
