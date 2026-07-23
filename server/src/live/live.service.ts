import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RtcTokenService } from '../rtc/rtc-token.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { publicProfile } from '../common/utilities/public-profile';

@Injectable()
export class LiveService {
  constructor(private readonly db: PrismaService, private readonly rtc: RtcTokenService, private readonly gateway: RealtimeGateway) {}

  async start(userId: string, title?: string) {
    const existing = await this.db.liveSession.findFirst({ where: { hostId: userId, status: 'LIVE' } });
    if (existing) throw new ConflictException('You are already live');
    const session = await this.db.liveSession.create({ data: { hostId: userId, title: title?.trim() || null } });
    const access = this.rtc.issueLive(session.id, userId, 'HOST');
    return { id: session.id, title: session.title, ...access };
  }

  async end(id: string, userId: string) {
    const session = await this.db.liveSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Live session not found');
    if (session.hostId !== userId) throw new ForbiddenException('Only the host can end this stream');
    if (session.status !== 'LIVE') return session;
    await this.db.$transaction([
      this.db.liveSession.update({ where: { id }, data: { status: 'ENDED', endedAt: new Date() } }),
      this.db.liveViewerEvent.updateMany({ where: { liveId: id, leftAt: null }, data: { leftAt: new Date() } }),
    ]);
    this.gateway.room(`live:${id}`, 'live:ended', { liveId: id });
    return { ended: true };
  }

  async list() {
    const sessions = await this.db.liveSession.findMany({
      where: { status: 'LIVE' },
      orderBy: [{ viewerCount: 'desc' }, { startedAt: 'desc' }],
      take: 30,
      select: { id: true, title: true, viewerCount: true, startedAt: true, host: { select: { profile: true } } },
    });
    return sessions.map(session => ({ ...session, host: publicProfile(session.host.profile) }));
  }

  async join(id: string, userId: string) {
    const session = await this.db.liveSession.findUnique({ where: { id } });
    if (!session || session.status !== 'LIVE') throw new NotFoundException('This stream has ended');
    if (session.hostId === userId) throw new ConflictException('Hosts cannot join their own stream as viewers');
    let viewerCount = session.viewerCount;
    const open = await this.db.liveViewerEvent.findFirst({ where: { liveId: id, userId, leftAt: null } });
    if (!open) {
      const updated = await this.db.$transaction(async tx => {
        await tx.liveViewerEvent.create({ data: { liveId: id, userId } });
        return tx.liveSession.update({ where: { id }, data: { viewerCount: { increment: 1 } } });
      });
      viewerCount = updated.viewerCount;
      const peak = Math.max(updated.peakViewers, updated.viewerCount);
      if (peak !== updated.peakViewers) await this.db.liveSession.update({ where: { id }, data: { peakViewers: peak } });
      this.gateway.room(`live:${id}`, 'live:viewer-count', { liveId: id, viewerCount: updated.viewerCount });
    }
    const access = this.rtc.issueLive(id, userId, 'VIEWER');
    const host = await this.db.user.findUnique({ where: { id: session.hostId }, select: { profile: true } });
    const hostProfile = publicProfile(host?.profile);
    return {
      id: session.id,
      title: session.title,
      viewerCount,
      host: hostProfile ? { ...hostProfile, userId: session.hostId } : { userId: session.hostId },
      ...access,
    };
  }

  async leave(id: string, userId: string) {
    const open = await this.db.liveViewerEvent.findFirst({ where: { liveId: id, userId, leftAt: null }, orderBy: { joinedAt: 'desc' } });
    if (!open) return { left: true };
    const viewerCount = await this.db.$transaction(async tx => {
      await tx.liveViewerEvent.update({ where: { id: open.id }, data: { leftAt: new Date() } });
      const session = await tx.liveSession.findUniqueOrThrow({ where: { id } });
      if (session.viewerCount <= 0) return 0;
      const updated = await tx.liveSession.update({ where: { id }, data: { viewerCount: { decrement: 1 } } });
      return updated.viewerCount;
    });
    this.gateway.room(`live:${id}`, 'live:viewer-count', { liveId: id, viewerCount });
    return { left: true };
  }
}
