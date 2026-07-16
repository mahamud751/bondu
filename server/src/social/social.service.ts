import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SearchUsersDto } from './social.dto';
import { publicProfile } from '../common/utilities/public-profile';

@Injectable()
export class SocialService {
  constructor(private readonly db: PrismaService) {}
  async search(userId: string, query: SearchUsersDto) {
    const blocked = await this.blockedIds(userId);
    const vendorFilters:Prisma.VendorProfileWhereInput={status:'APPROVED',...(query.maxRate?{voiceRatePerMinute:{lte:query.maxRate}}:{}),...(query.minRating!==undefined?{averageRating:{gte:query.minRating}}:{}),...(query.voice?{voiceCallEnabled:query.voice==='true'}:{}),...(query.video?{videoCallEnabled:query.video==='true'}:{})};
    const needsVendor=query.vendor==='true'||query.maxRate!==undefined||query.minRating!==undefined||query.voice!==undefined||query.video!==undefined;
    const where: Prisma.UserWhereInput = {
      id:{notIn:[userId,...blocked]},status:'ACTIVE',
      profile:{is:{discoverable:true,...(query.query?{OR:[{displayName:{contains:query.query,mode:'insensitive'}},{username:{contains:query.query,mode:'insensitive'}}]}:{}),...(query.country?{country:{equals:query.country,mode:'insensitive'}}:{}),...(query.city?{city:{equals:query.city,mode:'insensitive'}}:{}),...(query.language?{languages:{has:query.language}}:{}),...(query.interest?{interests:{has:query.interest}}:{}),...(query.online?{online:query.online==='true',hideOnline:false}:{})}},
      ...(needsVendor?{vendor:{is:vendorFilters}}:query.vendor==='false'?{vendor:null}:{})
    };
    const users=await this.db.user.findMany({ where, select: this.publicSelect(userId), orderBy: [{ profile: { online: 'desc' } }, { createdAt: 'desc' }], take: query.limit??30,skip:query.offset??0 });return users.map(user=>({...user,profile:publicProfile(user.profile)}));
  }
  async follow(userId: string, followingId: string) {
    await this.assertTarget(userId, followingId);
    await this.assertNotBlocked(userId, followingId);
    const follow = await this.db.follow.upsert({ where: { followerId_followingId: { followerId: userId, followingId } }, create: { followerId: userId, followingId }, update: {} });
    await this.db.notification.create({ data: { userId: followingId, type: 'FOLLOW', title: 'New follower', body: 'Someone followed you.', data: { followerId: userId } } });
    return follow;
  }
  unfollow(userId: string, followingId: string) { return this.db.follow.deleteMany({ where: { followerId: userId, followingId } }); }
  async followers(userId: string) { const rows=await this.db.follow.findMany({ where: { followingId: userId }, include: { follower: { select: { id: true, profile: true, vendor:{select:{id:true,status:true,averageRating:true,voiceRatePerMinute:true,availableForCall:true}} } } }, orderBy: { createdAt: 'desc' } });return rows.map(row=>({...row,follower:{...row.follower,profile:publicProfile(row.follower.profile)}})); }
  async following(userId: string) { const rows=await this.db.follow.findMany({ where: { followerId: userId }, include: { following: { select: { id: true, profile: true, vendor:{select:{id:true,status:true,averageRating:true,voiceRatePerMinute:true,availableForCall:true}} } } }, orderBy: { createdAt: 'desc' } });return rows.map(row=>({...row,following:{...row.following,profile:publicProfile(row.following.profile)}})); }
  async request(userId: string, recipientId: string) {
    await this.assertTarget(userId, recipientId); await this.assertNotBlocked(userId, recipientId);
    const reverse = await this.db.connection.findUnique({ where: { requesterId_recipientId: { requesterId: recipientId, recipientId: userId } } });
    if (reverse?.status === 'PENDING') return this.respond(reverse.id, userId, true);
    const connection = await this.db.connection.upsert({ where: { requesterId_recipientId: { requesterId: userId, recipientId } }, create: { requesterId: userId, recipientId }, update: { status: 'PENDING', respondedAt: null } });
    await this.db.notification.create({ data: { userId: recipientId, type: 'CONNECTION_REQUEST', title: 'Connection request', body: 'You received a connection request.', data: { connectionId: connection.id } } });
    return connection;
  }
  requests(userId: string) { return this.db.connection.findMany({ where: { recipientId: userId, status: 'PENDING' }, include: { requester: { select: { id: true, profile: true } } }, orderBy: { createdAt: 'desc' } }); }
  connections(userId: string) { return this.db.connection.findMany({ where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { recipientId: userId }] }, include: { requester: { select: { id: true, profile: true } }, recipient: { select: { id: true, profile: true } } }, orderBy: { updatedAt: 'desc' } }); }
  async respond(id: string, userId: string, accept: boolean) {
    const connection = await this.db.connection.findUnique({ where: { id } });
    if (!connection || connection.recipientId !== userId || connection.status !== 'PENDING') throw new ForbiddenException('Connection request is unavailable');
    return this.db.connection.update({ where: { id }, data: { status: accept ? 'ACCEPTED' : 'REJECTED', respondedAt: new Date() } });
  }
  async remove(id: string, userId: string) { const connection = await this.db.connection.findUnique({ where: { id } }); if (!connection || ![connection.requesterId, connection.recipientId].includes(userId)) throw new ForbiddenException(); return this.db.connection.delete({ where: { id } }); }
  private async assertTarget(userId: string, targetId: string) { if (userId === targetId) throw new ConflictException('Cannot perform this action on yourself'); const target = await this.db.user.findUnique({ where: { id: targetId } }); if (!target || target.status !== 'ACTIVE') throw new NotFoundException('User not found'); }
  private async assertNotBlocked(one: string, two: string) { const block = await this.db.block.findFirst({ where: { OR: [{ blockerId: one, blockedUserId: two }, { blockerId: two, blockedUserId: one }] } }); if (block) throw new ForbiddenException('This action is blocked'); }
  private async blockedIds(userId: string) { const rows = await this.db.block.findMany({ where: { OR: [{ blockerId: userId }, { blockedUserId: userId }] } }); return rows.map(row => row.blockerId === userId ? row.blockedUserId : row.blockerId); }
  private publicSelect(viewerId: string) { return { id: true, role: true, profile: true, vendor: { select: { id: true, status: true, averageRating: true, voiceRatePerMinute: true, paidChatRate: true, availableForCall: true } }, _count: { select: { followers: true, following: true } }, followers: { where: { followerId: viewerId }, select: { id: true } } } satisfies Prisma.UserSelect; }
}
