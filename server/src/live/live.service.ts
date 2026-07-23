import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RtcTokenService } from '../rtc/rtc-token.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ModerationService } from '../moderation/moderation.service';
import { EngagementService } from '../engagement/engagement.service';
import { publicProfile } from '../common/utilities/public-profile';
import { LIVE_CATEGORIES, type LiveCategory } from './live.dto';
import { LiveTranslateService } from './live-translate.service';

const CHAT_COOLDOWN_MS = 1200;
const MAX_CHAT_HISTORY = 50;
const DEFAULT_MAX_GUESTS = 8;
const DRAW_WORDS = [
  'cat',
  'fish',
  'house',
  'sun',
  'car',
  'tree',
  'phone',
  'flower',
  'boat',
  'bird',
  'cake',
  'star',
  'moon',
  'book',
  'heart',
];

@Injectable()
export class LiveService {
  constructor(
    private readonly db: PrismaService,
    private readonly rtc: RtcTokenService,
    private readonly gateway: RealtimeGateway,
    private readonly moderation: ModerationService,
    private readonly engagement: EngagementService,
    private readonly translate: LiveTranslateService,
  ) {}

  async start(
    userId: string,
    input: {
      title?: string;
      category?: LiveCategory;
      coverUrl?: string;
      tags?: string[];
      mode?: 'VIDEO' | 'AUDIO';
      maxGuests?: number;
      seatsOpen?: boolean;
      queueEnabled?: boolean;
      virtualMode?: boolean;
      virtualAvatar?: string;
    },
  ) {
    const existing = await this.db.liveSession.findFirst({
      where: { hostId: userId, status: 'LIVE' },
    });
    if (existing) throw new ConflictException('You are already live');

    const tags = (input.tags ?? [])
      .map((tag) => tag.trim().slice(0, 24))
      .filter(Boolean)
      .slice(0, 5);
    const category =
      input.category && LIVE_CATEGORIES.includes(input.category)
        ? input.category
        : 'CHAT';
    const maxGuests = Math.min(
      11,
      Math.max(1, input.maxGuests ?? DEFAULT_MAX_GUESTS),
    );

    const session = await this.db.$transaction(async (tx) => {
      const created = await tx.liveSession.create({
        data: {
          hostId: userId,
          title: input.title?.trim() || null,
          category,
          coverUrl: input.coverUrl?.trim() || null,
          tags,
          mode: input.mode === 'AUDIO' ? 'AUDIO' : 'VIDEO',
          maxGuests,
          seatsOpen: input.seatsOpen !== false,
          queueEnabled: input.queueEnabled !== false,
          virtualMode: input.virtualMode === true,
          virtualAvatar: (input.virtualAvatar || 'fox').slice(0, 24),
        },
      });
      await tx.liveSeat.create({
        data: {
          liveId: created.id,
          userId,
          seatIndex: 0,
          role: 'HOST',
        },
      });
      return created;
    });

    const access = this.rtc.issueLive(session.id, userId, 'HOST');
    void this.engagement.progressTask(userId, 'GO_LIVE');
    void this.engagement.addXp(userId, 'host', 20);
    void this.notifyFollowersLive(userId, session.id, session.title);
    await this.postSystemMessage(
      session.id,
      userId,
      session.mode === 'AUDIO'
        ? 'Audio room started. Raise your hand to join a seat!'
        : 'Stream started. Welcome everyone!',
    );
    return {
      id: session.id,
      title: session.title,
      category: session.category,
      tags: session.tags,
      coverUrl: session.coverUrl,
      mode: session.mode,
      maxGuests: session.maxGuests,
      seatsOpen: session.seatsOpen,
      virtualMode: session.virtualMode,
      virtualAvatar: session.virtualAvatar,
      seats: await this.listSeats(session.id),
      ...access,
    };
  }

  async end(id: string, userId: string) {
    const session = await this.db.liveSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Live session not found');
    if (session.hostId !== userId) {
      throw new ForbiddenException('Only the host can end this stream');
    }
    if (session.status !== 'LIVE') return this.stats(session);

    if (session.activePkId) {
      await this.forceEndPk(session.activePkId, 'Stream ended');
    }

    await this.db.$transaction([
      this.db.liveSession.update({
        where: { id },
        data: { status: 'ENDED', endedAt: new Date(), activePkId: null },
      }),
      this.db.liveViewerEvent.updateMany({
        where: { liveId: id, leftAt: null },
        data: { leftAt: new Date() },
      }),
      this.db.liveSeat.updateMany({
        where: { liveId: id, leftAt: null },
        data: { leftAt: new Date() },
      }),
      this.db.liveMicRequest.updateMany({
        where: { liveId: id, status: 'PENDING' },
        data: { status: 'EXPIRED', decidedAt: new Date() },
      }),
    ]);

    const ended = await this.db.liveSession.findUniqueOrThrow({ where: { id } });
    const stats = this.stats(ended);
    this.gateway.room(`live:${id}`, 'live:ended', { liveId: id, stats });
    return stats;
  }

  async list(category?: string, mode?: string, nearbyCountry?: string) {
    const where: Prisma.LiveSessionWhereInput = { status: 'LIVE' };
    if (
      category &&
      category !== 'ALL' &&
      LIVE_CATEGORIES.includes(category as LiveCategory)
    ) {
      where.category = category;
    }
    if (mode === 'VIDEO' || mode === 'AUDIO') where.mode = mode;
    if (nearbyCountry?.trim()) {
      where.host = {
        profile: {
          is: {
            country: { equals: nearbyCountry.trim(), mode: 'insensitive' },
            hideLocation: false,
          },
        },
      };
    }

    const sessions = await this.db.liveSession.findMany({
      where,
      orderBy: [
        { totalGiftPoints: 'desc' },
        { viewerCount: 'desc' },
        { startedAt: 'desc' },
      ],
      take: 40,
      select: {
        id: true,
        title: true,
        category: true,
        coverUrl: true,
        tags: true,
        mode: true,
        maxGuests: true,
        seatsOpen: true,
        viewerCount: true,
        likeCount: true,
        totalGiftPoints: true,
        startedAt: true,
        host: { select: { profile: true } },
        seats: {
          where: { leftAt: null },
          select: { seatIndex: true, role: true },
        },
      },
    });

    return sessions.map((session) => ({
      ...session,
      guestCount: session.seats.filter((s) => s.role === 'GUEST').length,
      host: publicProfile(session.host.profile),
      seats: undefined,
    }));
  }

  async join(id: string, userId: string) {
    const session = await this.db.liveSession.findUnique({ where: { id } });
    if (!session || session.status !== 'LIVE') {
      throw new NotFoundException('This stream has ended');
    }
    if (session.hostId === userId) {
      throw new ConflictException(
        'Hosts cannot join their own stream as viewers',
      );
    }

    await this.assertNotBanned(id, userId);

    let viewerCount = session.viewerCount;
    const open = await this.db.liveViewerEvent.findFirst({
      where: { liveId: id, userId, leftAt: null },
    });
    if (!open) {
      const updated = await this.db.$transaction(async (tx) => {
        await tx.liveViewerEvent.create({ data: { liveId: id, userId } });
        return tx.liveSession.update({
          where: { id },
          data: { viewerCount: { increment: 1 } },
        });
      });
      viewerCount = updated.viewerCount;
      const peak = Math.max(updated.peakViewers, updated.viewerCount);
      if (peak !== updated.peakViewers) {
        await this.db.liveSession.update({
          where: { id },
          data: { peakViewers: peak },
        });
      }
      this.gateway.room(`live:${id}`, 'live:viewer-count', {
        liveId: id,
        viewerCount: updated.viewerCount,
      });

      const profile = await this.db.profile.findUnique({
        where: { userId },
        select: { displayName: true },
      });
      await this.postSystemMessage(
        id,
        userId,
        `${profile?.displayName ?? 'Someone'} joined`,
      );
      void this.engagement.progressTask(userId, 'WATCH_LIVE');
    }

    const activeSeat = await this.db.liveSeat.findFirst({
      where: { liveId: id, userId, leftAt: null },
    });
    const rtcRole = activeSeat
      ? activeSeat.role === 'HOST'
        ? 'HOST'
        : 'GUEST'
      : 'VIEWER';
    const access = this.rtc.issueLive(id, userId, rtcRole);
    const host = await this.db.user.findUnique({
      where: { id: session.hostId },
      select: { profile: true, vendor: { select: { id: true, status: true } } },
    });
    const hostProfile = publicProfile(host?.profile);
    const messages = await this.recentMessages(id);
    const ranking = await this.giftRanking(id, 5);
    const seats = await this.listSeats(id);
    const liked = Boolean(
      await this.db.liveLike.findUnique({
        where: { liveId_userId: { liveId: id, userId } },
      }),
    );
    const pendingRequest = await this.db.liveMicRequest.findFirst({
      where: { liveId: id, userId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    const pk = session.activePkId
      ? await this.getPkPayload(session.activePkId)
      : null;
    const packages = await this.db.package.findMany({
      where: { active: true },
      orderBy: { price: 'asc' },
      take: 6,
    });
    const superFan = await this.engagement.superFanStatus(
      session.hostId,
      userId,
    );
    if (superFan.active) {
      this.gateway.room(`live:${id}`, 'live:entry-fx', {
        liveId: id,
        userId,
        displayName:
          (
            await this.db.profile.findUnique({
              where: { userId },
              select: { displayName: true },
            })
          )?.displayName ?? 'Super fan',
        entryFx: superFan.entryFx ?? 'GOLD_WAVE',
      });
    }

    return {
      id: session.id,
      title: session.title,
      category: session.category,
      tags: session.tags,
      coverUrl: session.coverUrl,
      mode: session.mode,
      maxGuests: session.maxGuests,
      seatsOpen: session.seatsOpen,
      queueEnabled: session.queueEnabled,
      virtualMode: session.virtualMode,
      virtualAvatar: session.virtualAvatar,
      viewerCount,
      likeCount: session.likeCount,
      totalGiftPoints: session.totalGiftPoints,
      chatMuted: session.chatMuted,
      liked,
      mySeat: activeSeat
        ? {
            seatIndex: activeSeat.seatIndex,
            role: activeSeat.role,
            muted: activeSeat.muted,
            cameraOff: activeSeat.cameraOff,
          }
        : null,
      pendingRequestId: pendingRequest?.id ?? null,
      seats,
      pk,
      packages,
      superFan,
      host: hostProfile
        ? {
            ...hostProfile,
            userId: session.hostId,
            vendorId: host?.vendor?.status === 'APPROVED' ? host.vendor.id : null,
            canBookCall: host?.vendor?.status === 'APPROVED',
          }
        : { userId: session.hostId, canBookCall: false },
      messages,
      ranking,
      ...access,
      rtcRole,
    };
  }

  async leave(id: string, userId: string) {
    await this.leaveSeat(id, userId, false);
    const open = await this.db.liveViewerEvent.findFirst({
      where: { liveId: id, userId, leftAt: null },
      orderBy: { joinedAt: 'desc' },
    });
    if (!open) return { left: true };
    const viewerCount = await this.db.$transaction(async (tx) => {
      await tx.liveViewerEvent.update({
        where: { id: open.id },
        data: { leftAt: new Date() },
      });
      const session = await tx.liveSession.findUniqueOrThrow({ where: { id } });
      if (session.viewerCount <= 0) return 0;
      const updated = await tx.liveSession.update({
        where: { id },
        data: { viewerCount: { decrement: 1 } },
      });
      return updated.viewerCount;
    });
    this.gateway.room(`live:${id}`, 'live:viewer-count', {
      liveId: id,
      viewerCount,
    });
    return { left: true };
  }

  async messages(id: string) {
    const session = await this.db.liveSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Live session not found');
    return this.recentMessages(id);
  }

  async chat(
    id: string,
    userId: string,
    body: string,
    translateTo?: 'bn' | 'en',
  ) {
    const text = body.trim();
    if (!text) throw new BadRequestException('Message cannot be empty');
    if (text.length > 200) throw new BadRequestException('Message is too long');

    const session = await this.db.liveSession.findUnique({ where: { id } });
    if (!session || session.status !== 'LIVE') {
      throw new NotFoundException('This stream has ended');
    }
    if (session.chatMuted && session.hostId !== userId) {
      throw new ForbiddenException('Chat is muted by the host');
    }
    await this.assertNotBanned(id, userId);

    if (session.hostId !== userId) {
      const open = await this.db.liveViewerEvent.findFirst({
        where: { liveId: id, userId, leftAt: null },
      });
      const onSeat = await this.db.liveSeat.findFirst({
        where: { liveId: id, userId, leftAt: null },
      });
      if (!open && !onSeat) {
        throw new ForbiddenException('Join the stream before chatting');
      }
    }

    const recent = await this.db.liveChatMessage.findFirst({
      where: { liveId: id, userId, kind: 'USER' },
      orderBy: { createdAt: 'desc' },
    });
    if (recent && Date.now() - recent.createdAt.getTime() < CHAT_COOLDOWN_MS) {
      throw new ConflictException(
        'Slow down — you are sending messages too quickly',
      );
    }

    const message = await this.db.$transaction(async (tx) => {
      await this.moderation.assertMessageAllowed(tx, userId, text);
      return tx.liveChatMessage.create({
        data: { liveId: id, userId, body: text, kind: 'USER' },
        include: {
          user: {
            select: {
              profile: {
                select: {
                  displayName: true,
                  avatarUrl: true,
                  isVerified: true,
                },
              },
            },
          },
        },
      });
    });

    let payload: Record<string, unknown> = this.serializeMessage(message);
    if (translateTo) {
      const tr = await this.translate.translate(text, translateTo);
      payload = {
        ...payload,
        translated: tr.translated,
        translateTo,
        translateProvider: tr.provider,
      };
    }
    // Always attach EN→BN hint for bilingual rooms (best-effort)
    if (!payload.translated) {
      const tr = await this.translate.translate(text, 'bn');
      if (tr.provider !== 'passthrough') {
        payload = {
          ...payload,
          translated: tr.translated,
          translateTo: 'bn',
          translateProvider: tr.provider,
        };
      }
    }
    this.gateway.room(`live:${id}`, 'live:chat', payload);
    void this.engagement.progressTask(userId, 'SEND_CHAT');
    return payload;
  }

  translateText(text: string, target: 'bn' | 'en' = 'bn') {
    return this.translate.translate(text, target);
  }

  async setVirtualMode(
    id: string,
    hostId: string,
    enabled: boolean,
    avatar?: string,
  ) {
    await this.requireHost(id, hostId);
    const updated = await this.db.liveSession.update({
      where: { id },
      data: {
        virtualMode: enabled,
        virtualAvatar: (avatar || 'fox').slice(0, 24),
      },
    });
    this.gateway.room(`live:${id}`, 'live:virtual-mode', {
      liveId: id,
      virtualMode: updated.virtualMode,
      virtualAvatar: updated.virtualAvatar,
    });
    return {
      virtualMode: updated.virtualMode,
      virtualAvatar: updated.virtualAvatar,
    };
  }

  // ── Draw & Guess mini-game ──────────────────────────────────────────

  async startGame(liveId: string, hostId: string, maxRounds = 3) {
    const session = await this.requireHost(liveId, hostId);
    if (session.status !== 'LIVE') throw new ConflictException('Stream ended');
    if (session.activeGameId) {
      throw new ConflictException('A game is already running');
    }
    const word = DRAW_WORDS[Math.floor(Math.random() * DRAW_WORDS.length)];
    const game = await this.db.liveGame.create({
      data: {
        liveId,
        hostId,
        drawerId: hostId,
        type: 'DRAW_GUESS',
        status: 'ACTIVE',
        word,
        wordHint: '_ '.repeat(word.length).trim(),
        round: 1,
        maxRounds: Math.min(5, Math.max(1, maxRounds)),
        scores: { [hostId]: 0 },
        strokes: [],
      },
    });
    await this.db.liveSession.update({
      where: { id: liveId },
      data: { activeGameId: game.id },
    });
    const publicGame = this.publicGame(game, hostId);
    this.gateway.room(`live:${liveId}`, 'live:game', publicGame);
    await this.postSystemMessage(
      liveId,
      hostId,
      'Draw & Guess started! Guess the word in chat.',
    );
    return publicGame;
  }

  async gameStroke(liveId: string, userId: string, strokes: unknown[]) {
    const session = await this.db.liveSession.findUnique({ where: { id: liveId } });
    if (!session?.activeGameId) throw new NotFoundException('No active game');
    const game = await this.db.liveGame.findUnique({
      where: { id: session.activeGameId },
    });
    if (!game || game.status !== 'ACTIVE') {
      throw new ConflictException('Game is not active');
    }
    if (game.drawerId !== userId) {
      throw new ForbiddenException('Only the drawer can draw');
    }
    const limited = Array.isArray(strokes) ? strokes.slice(-200) : [];
    const updated = await this.db.liveGame.update({
      where: { id: game.id },
      data: { strokes: limited as Prisma.InputJsonValue },
    });
    this.gateway.room(`live:${liveId}`, 'live:game-stroke', {
      liveId,
      gameId: game.id,
      strokes: limited,
    });
    return { ok: true, count: limited.length, updatedAt: updated.updatedAt };
  }

  async gameGuess(liveId: string, userId: string, guess: string) {
    const session = await this.db.liveSession.findUnique({ where: { id: liveId } });
    if (!session?.activeGameId) throw new NotFoundException('No active game');
    const game = await this.db.liveGame.findUnique({
      where: { id: session.activeGameId },
    });
    if (!game || game.status !== 'ACTIVE' || !game.word) {
      throw new ConflictException('Game is not active');
    }
    if (game.drawerId === userId) {
      throw new ForbiddenException('Drawer cannot guess');
    }
    const ok = guess.trim().toLowerCase() === game.word.toLowerCase();
    if (!ok) {
      return { correct: false };
    }

    const scores = (game.scores as Record<string, number>) ?? {};
    scores[userId] = (scores[userId] ?? 0) + 10;
    if (game.drawerId) scores[game.drawerId] = (scores[game.drawerId] ?? 0) + 5;

    if (game.round >= game.maxRounds) {
      const ended = await this.db.liveGame.update({
        where: { id: game.id },
        data: {
          status: 'ENDED',
          scores,
          endedAt: new Date(),
          strokes: [],
        },
      });
      await this.db.liveSession.update({
        where: { id: liveId },
        data: { activeGameId: null },
      });
      const payload = this.publicGame(ended, userId, true);
      this.gateway.room(`live:${liveId}`, 'live:game', payload);
      await this.postSystemMessage(
        liveId,
        userId,
        `Draw & Guess finished! Winner round word was “${game.word}”.`,
      );
      return { correct: true, finished: true, game: payload };
    }

    const nextWord = DRAW_WORDS[Math.floor(Math.random() * DRAW_WORDS.length)];
    const next = await this.db.liveGame.update({
      where: { id: game.id },
      data: {
        round: game.round + 1,
        word: nextWord,
        wordHint: '_ '.repeat(nextWord.length).trim(),
        scores,
        strokes: [],
        drawerId: userId,
      },
    });
    const payload = this.publicGame(next, userId, true);
    this.gateway.room(`live:${liveId}`, 'live:game', {
      ...payload,
      lastCorrectUserId: userId,
      lastWord: game.word,
    });
    return { correct: true, finished: false, game: payload };
  }

  async endGame(liveId: string, hostId: string) {
    await this.requireHost(liveId, hostId);
    const session = await this.db.liveSession.findUnique({ where: { id: liveId } });
    if (!session?.activeGameId) return { ended: true };
    await this.db.liveGame.update({
      where: { id: session.activeGameId },
      data: { status: 'ENDED', endedAt: new Date() },
    });
    await this.db.liveSession.update({
      where: { id: liveId },
      data: { activeGameId: null },
    });
    this.gateway.room(`live:${liveId}`, 'live:game', {
      liveId,
      status: 'ENDED',
    });
    return { ended: true };
  }

  async getGame(liveId: string, userId: string) {
    const session = await this.db.liveSession.findUnique({ where: { id: liveId } });
    if (!session?.activeGameId) return null;
    const game = await this.db.liveGame.findUnique({
      where: { id: session.activeGameId },
    });
    if (!game) return null;
    return this.publicGame(game, userId);
  }

  private publicGame(
    game: {
      id: string;
      liveId: string;
      type: string;
      status: string;
      hostId: string;
      drawerId: string | null;
      word: string | null;
      wordHint: string | null;
      round: number;
      maxRounds: number;
      scores: unknown;
      strokes: unknown;
    },
    viewerId: string,
    revealLast = false,
  ) {
    const isDrawer = game.drawerId === viewerId;
    return {
      id: game.id,
      liveId: game.liveId,
      type: game.type,
      status: game.status,
      hostId: game.hostId,
      drawerId: game.drawerId,
      word: isDrawer || revealLast ? game.word : null,
      wordHint: game.wordHint,
      round: game.round,
      maxRounds: game.maxRounds,
      scores: game.scores,
      strokes: game.strokes,
      isDrawer,
    };
  }

  async like(id: string, userId: string) {
    const session = await this.db.liveSession.findUnique({ where: { id } });
    if (!session || session.status !== 'LIVE') {
      throw new NotFoundException('This stream has ended');
    }
    if (session.hostId === userId) {
      throw new ConflictException('Hosts cannot like their own stream');
    }
    await this.assertNotBanned(id, userId);

    let likeCount = session.likeCount;
    let created = false;
    try {
      const result = await this.db.$transaction(async (tx) => {
        await tx.liveLike.create({ data: { liveId: id, userId } });
        return tx.liveSession.update({
          where: { id },
          data: { likeCount: { increment: 1 } },
        });
      });
      likeCount = result.likeCount;
      created = true;
    } catch (error) {
      if (
        !(
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        )
      ) {
        throw error;
      }
    }

    const profile = await this.db.profile.findUnique({
      where: { userId },
      select: { displayName: true },
    });
    const payload = {
      liveId: id,
      likeCount,
      userId,
      displayName: profile?.displayName ?? 'Someone',
      firstLike: created,
    };
    this.gateway.room(`live:${id}`, 'live:like', payload);
    if (created) void this.engagement.progressTask(userId, 'LIKE_LIVE');
    return payload;
  }

  async ranking(id: string) {
    const session = await this.db.liveSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Live session not found');
    return this.giftRanking(id, 20);
  }

  async setChatMuted(id: string, hostId: string, muted: boolean) {
    const session = await this.requireHost(id, hostId);
    if (session.status !== 'LIVE') throw new ConflictException('Stream has ended');
    const updated = await this.db.liveSession.update({
      where: { id },
      data: { chatMuted: muted },
    });
    this.gateway.room(`live:${id}`, 'live:chat-muted', { liveId: id, muted });
    await this.postSystemMessage(
      id,
      hostId,
      muted ? 'Host muted the chat' : 'Host unmuted the chat',
    );
    return { chatMuted: updated.chatMuted };
  }

  async setSeatsOpen(id: string, hostId: string, open: boolean) {
    await this.requireHost(id, hostId);
    const updated = await this.db.liveSession.update({
      where: { id },
      data: { seatsOpen: open },
    });
    this.gateway.room(`live:${id}`, 'live:seats-open', { liveId: id, open });
    await this.postSystemMessage(
      id,
      hostId,
      open ? 'Guest seats are open' : 'Guest seats are closed',
    );
    return { seatsOpen: updated.seatsOpen };
  }

  async banViewer(
    id: string,
    hostId: string,
    targetUserId: string,
    reason?: string,
  ) {
    const session = await this.requireHost(id, hostId);
    if (session.status !== 'LIVE') throw new ConflictException('Stream has ended');
    if (targetUserId === hostId) {
      throw new BadRequestException('Cannot ban yourself');
    }

    await this.leaveSeat(id, targetUserId, true);
    await this.db.liveBan.upsert({
      where: { liveId_userId: { liveId: id, userId: targetUserId } },
      create: {
        liveId: id,
        userId: targetUserId,
        createdBy: hostId,
        reason: reason?.trim() || null,
      },
      update: { reason: reason?.trim() || null, createdBy: hostId },
    });

    await this.db.liveViewerEvent.updateMany({
      where: { liveId: id, userId: targetUserId, leftAt: null },
      data: { leftAt: new Date() },
    });
    const openViewers = await this.db.liveViewerEvent.count({
      where: { liveId: id, leftAt: null },
    });
    await this.db.liveSession.update({
      where: { id },
      data: { viewerCount: openViewers },
    });

    this.gateway.room(`live:${id}`, 'live:viewer-count', {
      liveId: id,
      viewerCount: openViewers,
    });
    this.gateway.user(targetUserId, 'live:banned', {
      liveId: id,
      reason: reason ?? null,
    });
    this.gateway.room(`live:${id}`, 'live:user-banned', {
      liveId: id,
      userId: targetUserId,
    });
    await this.postSystemMessage(id, hostId, 'A viewer was removed by the host');
    return { banned: true };
  }

  // ── Multi-guest / mic queue ─────────────────────────────────────────

  async requestMic(id: string, userId: string, note?: string) {
    const session = await this.db.liveSession.findUnique({ where: { id } });
    if (!session || session.status !== 'LIVE') {
      throw new NotFoundException('This stream has ended');
    }
    if (session.hostId === userId) {
      throw new ConflictException('Host is already on stage');
    }
    if (!session.queueEnabled || !session.seatsOpen) {
      throw new ForbiddenException('Guest seats are not open right now');
    }
    await this.assertNotBanned(id, userId);

    const onSeat = await this.db.liveSeat.findFirst({
      where: { liveId: id, userId, leftAt: null },
    });
    if (onSeat) throw new ConflictException('You are already on a seat');

    const pending = await this.db.liveMicRequest.findFirst({
      where: { liveId: id, userId, status: 'PENDING' },
    });
    if (pending) return this.serializeMicRequest(pending);

    const guestCount = await this.db.liveSeat.count({
      where: { liveId: id, role: 'GUEST', leftAt: null },
    });
    if (guestCount >= session.maxGuests) {
      throw new ConflictException('All guest seats are full');
    }

    // Fan club / super fan get priority note for host queue sorting
    const fan = await this.db.fanClubMember.findFirst({
      where: { userId, club: { ownerId: session.hostId } },
      select: { level: true },
    });
    const superFan = await this.engagement.superFanStatus(session.hostId, userId);
    const priorityNote = [
      superFan.active ? 'SUPER_FAN' : null,
      fan ? `FAN_LV${fan.level}` : null,
      note?.trim() || null,
    ]
      .filter(Boolean)
      .join(' · ');

    const request = await this.db.liveMicRequest.create({
      data: {
        liveId: id,
        userId,
        note: priorityNote || null,
      },
    });
    const payload = await this.serializeMicRequest(request);
    // Priority users are marked so hosts see them first
    const enriched = {
      ...payload,
      priority: superFan.active ? 2 : fan ? 1 : 0,
    };
    this.gateway.room(`live:${id}`, 'live:mic-request', enriched);
    this.gateway.user(session.hostId, 'live:mic-request', enriched);
    return enriched;
  }

  async cancelMic(id: string, userId: string) {
    const request = await this.db.liveMicRequest.findFirst({
      where: { liveId: id, userId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    if (!request) return { cancelled: true };
    await this.db.liveMicRequest.update({
      where: { id: request.id },
      data: { status: 'CANCELLED', decidedAt: new Date() },
    });
    this.gateway.room(`live:${id}`, 'live:mic-cancelled', {
      liveId: id,
      requestId: request.id,
      userId,
    });
    return { cancelled: true };
  }

  async listMicRequests(id: string, hostId: string) {
    await this.requireHost(id, hostId);
    const rows = await this.db.liveMicRequest.findMany({
      where: { liveId: id, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    const serialized = await Promise.all(
      rows.map(async (row) => {
        const base = await this.serializeMicRequest(row);
        const priority = String(row.note ?? '').includes('SUPER_FAN')
          ? 2
          : String(row.note ?? '').includes('FAN_LV')
            ? 1
            : 0;
        return { ...base, priority };
      }),
    );
    return serialized.sort(
      (a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt),
    );
  }

  async pkHistory(hostId: string) {
    const lives = await this.db.liveSession.findMany({
      where: { hostId },
      select: { id: true },
      take: 100,
      orderBy: { startedAt: 'desc' },
    });
    const ids = lives.map((l) => l.id);
    if (!ids.length) return [];
    const rows = await this.db.livePk.findMany({
      where: {
        status: 'ENDED',
        OR: [
          { challengerLiveId: { in: ids } },
          { opponentLiveId: { in: ids } },
        ],
      },
      orderBy: { endedAt: 'desc' },
      take: 30,
    });
    return Promise.all(rows.map((row) => this.getPkPayload(row.id)));
  }

  async openHostChat(liveId: string, userId: string) {
    const session = await this.db.liveSession.findUnique({ where: { id: liveId } });
    if (!session || session.status !== 'LIVE') {
      throw new NotFoundException('This stream has ended');
    }
    if (session.hostId === userId) {
      throw new ConflictException('You are the host');
    }
    await this.assertNotBanned(liveId, userId);
    const [userOneId, userTwoId] = [userId, session.hostId].sort();
    const conversation = await this.db.conversation.upsert({
      where: { userOneId_userTwoId: { userOneId, userTwoId } },
      create: { userOneId, userTwoId },
      update: { active: true },
    });
    return {
      conversationId: conversation.id,
      hostId: session.hostId,
    };
  }

  async coachTip(liveId: string, hostId: string) {
    const session = await this.requireHost(liveId, hostId);
    const localeUser = await this.db.user.findUnique({
      where: { id: hostId },
      select: { localePreference: true },
    });
    return this.engagement.coachTip(
      session.viewerCount,
      localeUser?.localePreference === 'bn' ? 'bn' : 'en',
    );
  }

  async adminForceEnd(liveId: string, actorId: string, reason?: string) {
    const session = await this.db.liveSession.findUnique({ where: { id: liveId } });
    if (!session) throw new NotFoundException('Live session not found');
    if (session.status !== 'LIVE') return this.stats(session);
    if (session.activePkId) await this.forceEndPk(session.activePkId, 'Admin end');
    await this.db.$transaction([
      this.db.liveSession.update({
        where: { id: liveId },
        data: { status: 'ENDED', endedAt: new Date(), activePkId: null },
      }),
      this.db.liveViewerEvent.updateMany({
        where: { liveId, leftAt: null },
        data: { leftAt: new Date() },
      }),
      this.db.liveSeat.updateMany({
        where: { liveId, leftAt: null },
        data: { leftAt: new Date() },
      }),
      this.db.auditLog.create({
        data: {
          actorId,
          actorRole: 'ADMIN',
          action: 'LIVE_FORCE_END',
          entityType: 'LIVE_SESSION',
          entityId: liveId,
          newValue: { reason: reason ?? 'Force ended by staff' },
        },
      }),
    ]);
    const ended = await this.db.liveSession.findUniqueOrThrow({
      where: { id: liveId },
    });
    const stats = this.stats(ended);
    this.gateway.room(`live:${liveId}`, 'live:ended', {
      liveId,
      stats,
      forced: true,
      reason: reason ?? null,
    });
    return stats;
  }

  private async notifyFollowersLive(
    hostId: string,
    liveId: string,
    title: string | null,
  ) {
    const host = await this.db.profile.findUnique({
      where: { userId: hostId },
      select: { displayName: true },
    });
    const followers = await this.db.follow.findMany({
      where: { followingId: hostId },
      select: { followerId: true },
      take: 500,
    });
    if (!followers.length) return;
    const name = host?.displayName ?? 'A creator';
    await this.db.notification.createMany({
      data: followers.map((f) => ({
        userId: f.followerId,
        type: 'LIVE_STARTED',
        title: `${name} is live`,
        body: title?.trim() || 'Tap to join the stream',
        data: { liveId, hostId },
      })),
    });
  }

  async decideMic(
    id: string,
    hostId: string,
    requestId: string,
    decision: 'ACCEPTED' | 'REJECTED',
    seatIndex?: number,
  ) {
    await this.requireHost(id, hostId);
    const request = await this.db.liveMicRequest.findUnique({
      where: { id: requestId },
    });
    if (!request || request.liveId !== id || request.status !== 'PENDING') {
      throw new NotFoundException('Mic request not found');
    }

    if (decision === 'REJECTED') {
      await this.db.liveMicRequest.update({
        where: { id: requestId },
        data: { status: 'REJECTED', decidedAt: new Date() },
      });
      this.gateway.user(request.userId, 'live:mic-rejected', {
        liveId: id,
        requestId,
      });
      this.gateway.room(`live:${id}`, 'live:mic-rejected', {
        liveId: id,
        requestId,
        userId: request.userId,
      });
      return { decision: 'REJECTED' };
    }

    const seat = await this.promoteToSeat(id, request.userId, seatIndex);
    await this.db.liveMicRequest.update({
      where: { id: requestId },
      data: { status: 'ACCEPTED', decidedAt: new Date() },
    });
    const access = this.rtc.issueLive(id, request.userId, 'GUEST');
    this.gateway.user(request.userId, 'live:mic-accepted', {
      liveId: id,
      requestId,
      seat,
      ...access,
      rtcRole: 'GUEST',
    });
    await this.broadcastSeats(id);
    await this.postSystemMessage(id, request.userId, 'A guest joined the stage');
    return { decision: 'ACCEPTED', seat, ...access, rtcRole: 'GUEST' as const };
  }

  async inviteGuest(id: string, hostId: string, userId: string, seatIndex?: number) {
    await this.requireHost(id, hostId);
    if (userId === hostId) throw new BadRequestException('Cannot invite yourself');
    await this.assertNotBanned(id, userId);
    const seat = await this.promoteToSeat(id, userId, seatIndex);
    const access = this.rtc.issueLive(id, userId, 'GUEST');
    this.gateway.user(userId, 'live:mic-accepted', {
      liveId: id,
      seat,
      ...access,
      rtcRole: 'GUEST',
      invited: true,
    });
    await this.broadcastSeats(id);
    return { seat, ...access, rtcRole: 'GUEST' as const };
  }

  async leaveSeat(id: string, userId: string, silent = false) {
    const seat = await this.db.liveSeat.findFirst({
      where: { liveId: id, userId, leftAt: null },
    });
    if (!seat) return { left: true };
    if (seat.role === 'HOST') {
      if (!silent) throw new ConflictException('Host cannot leave the host seat');
      return { left: false };
    }
    await this.db.liveSeat.update({
      where: { id: seat.id },
      data: { leftAt: new Date() },
    });
    if (!silent) {
      await this.broadcastSeats(id);
      this.gateway.user(userId, 'live:seat-left', {
        liveId: id,
        userId,
        seatIndex: seat.seatIndex,
      });
      const access = this.rtc.issueLive(id, userId, 'VIEWER');
      this.gateway.user(userId, 'live:role-changed', {
        liveId: id,
        rtcRole: 'VIEWER',
        ...access,
      });
    }
    return { left: true };
  }

  async kickGuest(id: string, hostId: string, userId: string) {
    await this.requireHost(id, hostId);
    if (userId === hostId) throw new BadRequestException('Cannot kick the host');
    await this.leaveSeat(id, userId, false);
    this.gateway.user(userId, 'live:seat-kicked', { liveId: id });
    await this.postSystemMessage(id, hostId, 'A guest was removed from the stage');
    return { kicked: true };
  }

  async controlSeat(
    id: string,
    hostId: string,
    userId: string,
    controls: { muted?: boolean; cameraOff?: boolean },
  ) {
    await this.requireHost(id, hostId);
    const seat = await this.db.liveSeat.findFirst({
      where: { liveId: id, userId, leftAt: null },
    });
    if (!seat || seat.role === 'HOST') {
      throw new NotFoundException('Guest seat not found');
    }
    const updated = await this.db.liveSeat.update({
      where: { id: seat.id },
      data: {
        muted: controls.muted ?? seat.muted,
        cameraOff: controls.cameraOff ?? seat.cameraOff,
      },
    });
    await this.broadcastSeats(id);
    this.gateway.user(userId, 'live:seat-control', {
      liveId: id,
      muted: updated.muted,
      cameraOff: updated.cameraOff,
    });
    return {
      userId,
      muted: updated.muted,
      cameraOff: updated.cameraOff,
    };
  }

  async seats(id: string) {
    return this.listSeats(id);
  }

  // ── PK battles ──────────────────────────────────────────────────────

  async challengePk(
    challengerLiveId: string,
    hostId: string,
    opponentLiveId: string,
    durationSeconds = 180,
    mode: string = 'SOLO',
    maxRounds = 1,
  ) {
    const challenger = await this.requireHost(challengerLiveId, hostId);
    if (challenger.status !== 'LIVE') {
      throw new ConflictException('Your stream has ended');
    }
    if (challenger.activePkId) {
      throw new ConflictException('You already have an active PK');
    }
    if (challengerLiveId === opponentLiveId) {
      throw new BadRequestException('Cannot PK yourself');
    }

    const opponent = await this.db.liveSession.findUnique({
      where: { id: opponentLiveId },
    });
    if (!opponent || opponent.status !== 'LIVE') {
      throw new NotFoundException('Opponent stream not found');
    }
    if (opponent.activePkId) {
      throw new ConflictException('Opponent is already in a PK');
    }

    const duration = Math.min(600, Math.max(60, durationSeconds));
    const pkMode = ['SOLO', 'BEST_OF_3', 'BEST_OF_5', 'TEAM'].includes(mode)
      ? mode
      : 'SOLO';
    const rounds =
      pkMode === 'BEST_OF_5' ? 5 : pkMode === 'BEST_OF_3' ? 3 : Math.min(5, Math.max(1, maxRounds));
    const pk = await this.db.livePk.create({
      data: {
        challengerLiveId,
        opponentLiveId,
        status: 'PENDING',
        durationSeconds: duration,
        mode: pkMode,
        maxRounds: rounds,
        currentRound: 1,
      },
    });

    const payload = await this.getPkPayload(pk.id);
    this.gateway.user(opponent.hostId, 'live:pk-challenge', payload);
    this.gateway.room(`live:${challengerLiveId}`, 'live:pk-challenge', payload);
    this.gateway.room(`live:${opponentLiveId}`, 'live:pk-challenge', payload);
    return payload;
  }

  async respondPk(
    pkId: string,
    hostId: string,
    decision: 'ACCEPT' | 'DECLINE',
  ) {
    const pk = await this.db.livePk.findUnique({ where: { id: pkId } });
    if (!pk || pk.status !== 'PENDING') {
      throw new NotFoundException('PK challenge not found');
    }
    const opponent = await this.db.liveSession.findUnique({
      where: { id: pk.opponentLiveId },
    });
    if (!opponent || opponent.hostId !== hostId) {
      throw new ForbiddenException('Only the challenged host can respond');
    }

    if (decision === 'DECLINE') {
      await this.db.livePk.update({
        where: { id: pkId },
        data: { status: 'CANCELLED', endedAt: new Date() },
      });
      const payload = { pkId, status: 'CANCELLED' as const };
      this.broadcastPkRooms(pk, 'live:pk-update', payload);
      return payload;
    }

    const starts = new Date();
    const endsAt = new Date(starts.getTime() + pk.durationSeconds * 1000);
    await this.db.$transaction([
      this.db.livePk.update({
        where: { id: pkId },
        data: { status: 'ACTIVE', startedAt: starts, endsAt },
      }),
      this.db.liveSession.update({
        where: { id: pk.challengerLiveId },
        data: { activePkId: pkId },
      }),
      this.db.liveSession.update({
        where: { id: pk.opponentLiveId },
        data: { activePkId: pkId },
      }),
    ]);

    const payload = await this.getPkPayload(pkId);
    this.broadcastPkRooms(pk, 'live:pk-started', payload);
    return payload;
  }

  async getPk(pkId: string) {
    return this.getPkPayload(pkId);
  }

  async recordGiftPoints(
    liveId: string,
    points: number,
    senderId: string,
    giftName: string,
  ) {
    if (points <= 0) return;
    const session = await this.db.liveSession.findUnique({ where: { id: liveId } });
    if (!session) return;

    const updated = await this.db.liveSession.update({
      where: { id: liveId },
      data: { totalGiftPoints: { increment: points } },
    });

    const ranking = await this.giftRanking(liveId, 5);
    this.gateway.room(`live:${liveId}`, 'live:ranking', {
      liveId,
      totalGiftPoints: updated.totalGiftPoints,
      ranking,
    });

    if (session.activePkId) {
      await this.addPkScore(session.activePkId, liveId, points);
    }

    const profile = await this.db.profile.findUnique({
      where: { userId: senderId },
      select: { displayName: true },
    });
    await this.postSystemMessage(
      liveId,
      senderId,
      `${profile?.displayName ?? 'Someone'} sent ${giftName}`,
      'GIFT',
    );
  }

  // ── helpers ─────────────────────────────────────────────────────────

  private async addPkScore(pkId: string, liveId: string, points: number) {
    const pk = await this.db.livePk.findUnique({ where: { id: pkId } });
    if (!pk || pk.status !== 'ACTIVE') return;

    if (pk.endsAt && pk.endsAt.getTime() <= Date.now()) {
      await this.forceEndPk(pkId, 'Time up');
      return;
    }

    const data =
      liveId === pk.challengerLiveId
        ? { challengerScore: { increment: points } }
        : liveId === pk.opponentLiveId
          ? { opponentScore: { increment: points } }
          : null;
    if (!data) return;

    const updated = await this.db.livePk.update({
      where: { id: pkId },
      data,
    });
    const payload = await this.getPkPayload(updated.id);
    this.broadcastPkRooms(updated, 'live:pk-score', payload);

    if (updated.endsAt && updated.endsAt.getTime() <= Date.now()) {
      await this.forceEndPk(pkId, 'Time up');
    }
  }

  private async forceEndPk(pkId: string, _reason: string) {
    const pk = await this.db.livePk.findUnique({ where: { id: pkId } });
    if (!pk || pk.status === 'ENDED' || pk.status === 'CANCELLED') return;

    let challengerWins = pk.challengerWins;
    let opponentWins = pk.opponentWins;
    if (pk.challengerScore > pk.opponentScore) challengerWins += 1;
    else if (pk.opponentScore > pk.challengerScore) opponentWins += 1;

    const need = Math.ceil(pk.maxRounds / 2);
    const seriesOver =
      pk.maxRounds <= 1 ||
      challengerWins >= need ||
      opponentWins >= need ||
      pk.currentRound >= pk.maxRounds;

    if (!seriesOver) {
      // Next round in best-of series
      const starts = new Date();
      const endsAt = new Date(starts.getTime() + pk.durationSeconds * 1000);
      await this.db.livePk.update({
        where: { id: pkId },
        data: {
          status: 'ACTIVE',
          currentRound: pk.currentRound + 1,
          challengerWins,
          opponentWins,
          challengerScore: 0,
          opponentScore: 0,
          startedAt: starts,
          endsAt,
        },
      });
      const payload = await this.getPkPayload(pkId);
      this.broadcastPkRooms(pk, 'live:pk-round', payload);
      return;
    }

    let winnerLiveId: string | null = null;
    if (challengerWins > opponentWins) winnerLiveId = pk.challengerLiveId;
    else if (opponentWins > challengerWins) winnerLiveId = pk.opponentLiveId;
    else if (pk.challengerScore > pk.opponentScore) winnerLiveId = pk.challengerLiveId;
    else if (pk.opponentScore > pk.challengerScore) winnerLiveId = pk.opponentLiveId;

    await this.db.$transaction([
      this.db.livePk.update({
        where: { id: pkId },
        data: {
          status: 'ENDED',
          endedAt: new Date(),
          winnerLiveId,
          challengerWins,
          opponentWins,
        },
      }),
      this.db.liveSession.updateMany({
        where: { id: { in: [pk.challengerLiveId, pk.opponentLiveId] } },
        data: { activePkId: null },
      }),
    ]);

    const payload = await this.getPkPayload(pkId);
    this.broadcastPkRooms(pk, 'live:pk-ended', payload);
  }

  private broadcastPkRooms(
    pk: { challengerLiveId: string; opponentLiveId: string },
    event: string,
    payload: unknown,
  ) {
    this.gateway.room(`live:${pk.challengerLiveId}`, event, payload);
    this.gateway.room(`live:${pk.opponentLiveId}`, event, payload);
  }

  private async getPkPayload(pkId: string) {
    const pk = await this.db.livePk.findUnique({
      where: { id: pkId },
      include: {
        challengerLive: {
          select: {
            id: true,
            title: true,
            hostId: true,
            host: { select: { profile: true } },
          },
        },
        opponentLive: {
          select: {
            id: true,
            title: true,
            hostId: true,
            host: { select: { profile: true } },
          },
        },
      },
    });
    if (!pk) throw new NotFoundException('PK not found');
    return {
      id: pk.id,
      status: pk.status,
      mode: (pk as { mode?: string }).mode ?? 'SOLO',
      maxRounds: (pk as { maxRounds?: number }).maxRounds ?? 1,
      currentRound: (pk as { currentRound?: number }).currentRound ?? 1,
      challengerWins: (pk as { challengerWins?: number }).challengerWins ?? 0,
      opponentWins: (pk as { opponentWins?: number }).opponentWins ?? 0,
      durationSeconds: pk.durationSeconds,
      challengerScore: pk.challengerScore,
      opponentScore: pk.opponentScore,
      winnerLiveId: pk.winnerLiveId,
      startedAt: pk.startedAt?.toISOString() ?? null,
      endsAt: pk.endsAt?.toISOString() ?? null,
      endedAt: pk.endedAt?.toISOString() ?? null,
      challenger: {
        liveId: pk.challengerLive.id,
        hostId: pk.challengerLive.hostId,
        title: pk.challengerLive.title,
        host: publicProfile(pk.challengerLive.host.profile),
      },
      opponent: {
        liveId: pk.opponentLive.id,
        hostId: pk.opponentLive.hostId,
        title: pk.opponentLive.title,
        host: publicProfile(pk.opponentLive.host.profile),
      },
    };
  }

  private async promoteToSeat(
    liveId: string,
    userId: string,
    preferredIndex?: number,
  ) {
    const session = await this.db.liveSession.findUnique({ where: { id: liveId } });
    if (!session || session.status !== 'LIVE') {
      throw new NotFoundException('This stream has ended');
    }
    if (!session.seatsOpen) {
      throw new ForbiddenException('Guest seats are closed');
    }

    const existing = await this.db.liveSeat.findFirst({
      where: { liveId, userId, leftAt: null },
    });
    if (existing) {
      return {
        seatIndex: existing.seatIndex,
        role: existing.role,
        muted: existing.muted,
        cameraOff: existing.cameraOff,
        userId,
      };
    }

    const occupied = await this.db.liveSeat.findMany({
      where: { liveId, leftAt: null },
      select: { seatIndex: true },
    });
    const taken = new Set(occupied.map((s) => s.seatIndex));
    const guestCount = occupied.filter((s) => s.seatIndex !== 0).length;
    if (guestCount >= session.maxGuests) {
      throw new ConflictException('All guest seats are full');
    }

    let seatIndex =
      preferredIndex && preferredIndex >= 1 && preferredIndex <= session.maxGuests
        ? preferredIndex
        : 0;
    if (!seatIndex || taken.has(seatIndex)) {
      seatIndex = 0;
      for (let i = 1; i <= session.maxGuests; i++) {
        if (!taken.has(i)) {
          seatIndex = i;
          break;
        }
      }
    }
    if (!seatIndex || taken.has(seatIndex)) {
      throw new ConflictException('No free seat available');
    }

    const seat = await this.db.liveSeat.create({
      data: {
        liveId,
        userId,
        seatIndex,
        role: 'GUEST',
        cameraOff: session.mode === 'AUDIO',
      },
    });

    return {
      seatIndex: seat.seatIndex,
      role: seat.role,
      muted: seat.muted,
      cameraOff: seat.cameraOff,
      userId,
    };
  }

  private async listSeats(liveId: string) {
    const seats = await this.db.liveSeat.findMany({
      where: { liveId, leftAt: null },
      orderBy: { seatIndex: 'asc' },
      include: {
        user: {
          select: {
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
                isVerified: true,
              },
            },
          },
        },
      },
    });
    return seats.map((seat) => ({
      seatIndex: seat.seatIndex,
      role: seat.role,
      muted: seat.muted,
      cameraOff: seat.cameraOff,
      userId: seat.userId,
      displayName: seat.user.profile?.displayName ?? 'User',
      avatarUrl: seat.user.profile?.avatarUrl ?? null,
      isVerified: seat.user.profile?.isVerified ?? false,
    }));
  }

  private async broadcastSeats(liveId: string) {
    const seats = await this.listSeats(liveId);
    this.gateway.room(`live:${liveId}`, 'live:seats', { liveId, seats });
    return seats;
  }

  private async serializeMicRequest(request: {
    id: string;
    liveId: string;
    userId: string;
    status: string;
    note: string | null;
    createdAt: Date;
  }) {
    const profile = await this.db.profile.findUnique({
      where: { userId: request.userId },
      select: { displayName: true, avatarUrl: true, isVerified: true },
    });
    return {
      id: request.id,
      liveId: request.liveId,
      userId: request.userId,
      status: request.status,
      note: request.note,
      createdAt: request.createdAt.toISOString(),
      displayName: profile?.displayName ?? 'User',
      avatarUrl: profile?.avatarUrl ?? null,
      isVerified: profile?.isVerified ?? false,
    };
  }

  private stats(session: {
    id: string;
    peakViewers: number;
    likeCount: number;
    totalGiftPoints: number;
    startedAt: Date;
    endedAt: Date | null;
    viewerCount: number;
  }) {
    const endedAt = session.endedAt ?? new Date();
    const durationSeconds = Math.max(
      0,
      Math.floor((endedAt.getTime() - session.startedAt.getTime()) / 1000),
    );
    return {
      ended: true as const,
      liveId: session.id,
      peakViewers: session.peakViewers,
      likeCount: session.likeCount,
      totalGiftPoints: session.totalGiftPoints,
      durationSeconds,
      finalViewers: session.viewerCount,
    };
  }

  private async requireHost(id: string, hostId: string) {
    const session = await this.db.liveSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Live session not found');
    if (session.hostId !== hostId) {
      throw new ForbiddenException('Only the host can do this');
    }
    return session;
  }

  private async assertNotBanned(liveId: string, userId: string) {
    const banned = await this.db.liveBan.findUnique({
      where: { liveId_userId: { liveId, userId } },
    });
    if (banned) throw new ForbiddenException('You are banned from this stream');
  }

  private async recentMessages(liveId: string) {
    const rows = await this.db.liveChatMessage.findMany({
      where: { liveId },
      orderBy: { createdAt: 'desc' },
      take: MAX_CHAT_HISTORY,
      include: {
        user: {
          select: {
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
                isVerified: true,
              },
            },
          },
        },
      },
    });
    return rows.reverse().map((row) => this.serializeMessage(row));
  }

  private serializeMessage(message: {
    id: string;
    liveId: string;
    userId: string;
    body: string;
    kind: string;
    createdAt: Date;
    user: {
      profile: {
        displayName: string;
        avatarUrl: string | null;
        isVerified: boolean;
      } | null;
    };
  }) {
    return {
      id: message.id,
      liveId: message.liveId,
      userId: message.userId,
      body: message.body,
      kind: message.kind,
      createdAt: message.createdAt.toISOString(),
      displayName: message.user.profile?.displayName ?? 'User',
      avatarUrl: message.user.profile?.avatarUrl ?? null,
      isVerified: message.user.profile?.isVerified ?? false,
    };
  }

  private async giftRanking(liveId: string, take: number) {
    const groups = await this.db.giftTransaction.groupBy({
      by: ['senderId'],
      where: { liveId },
      _sum: { grossAmount: true },
      orderBy: { _sum: { grossAmount: 'desc' } },
      take,
    });
    if (!groups.length) return [];

    const profiles = await this.db.profile.findMany({
      where: { userId: { in: groups.map((g) => g.senderId) } },
      select: {
        userId: true,
        displayName: true,
        avatarUrl: true,
        isVerified: true,
      },
    });
    const byUser = new Map(profiles.map((p) => [p.userId, p]));

    return groups.map((row, index) => ({
      rank: index + 1,
      userId: row.senderId,
      points: row._sum.grossAmount ?? 0,
      displayName: byUser.get(row.senderId)?.displayName ?? 'Supporter',
      avatarUrl: byUser.get(row.senderId)?.avatarUrl ?? null,
      isVerified: byUser.get(row.senderId)?.isVerified ?? false,
    }));
  }

  private async postSystemMessage(
    liveId: string,
    userId: string,
    body: string,
    kind: 'SYSTEM' | 'GIFT' = 'SYSTEM',
  ) {
    const message = await this.db.liveChatMessage.create({
      data: { liveId, userId, body, kind },
      include: {
        user: {
          select: {
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
                isVerified: true,
              },
            },
          },
        },
      },
    });
    const payload = this.serializeMessage(message);
    this.gateway.room(`live:${liveId}`, 'live:chat', payload);
    return payload;
  }
}
