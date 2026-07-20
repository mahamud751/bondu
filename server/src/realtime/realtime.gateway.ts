import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

type SocketIdentity = { sub: string; role: string; deviceId: string };
@WebSocketGateway({ namespace: '/realtime', cors: { origin: true, credentials: true }, transports: ['websocket', 'polling'] })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);
  constructor(private readonly jwt: JwtService, private readonly config: ConfigService, private readonly db: PrismaService) {}

  async handleConnection(socket: Socket) {
    try {
      const raw = socket.handshake.auth?.token ?? socket.handshake.headers.authorization;
      const token = String(raw ?? '').replace(/^Bearer\s+/i, '');
      const identity = await this.jwt.verifyAsync<SocketIdentity>(token, { secret: this.config.getOrThrow('JWT_ACCESS_SECRET') });
      const user = await this.db.user.findUnique({ where: { id: identity.sub }, select: { status: true } });
      if (!user || user.status !== 'ACTIVE') throw new Error('Inactive account');
      socket.data.identity = identity;
      await socket.join(`user:${identity.sub}`);
      await this.db.profile.updateMany({ where: { userId: identity.sub, hideOnline: false }, data: { online: true, lastSeenAt: new Date() } });
      this.server.emit('user:status-changed', { userId: identity.sub, status: 'online' });
    } catch { socket.disconnect(true); }
  }

  async handleDisconnect(socket: Socket) {
    const identity = socket.data.identity as SocketIdentity | undefined;
    if (!identity) return;
    const remaining = await this.server.in(`user:${identity.sub}`).fetchSockets();
    if (remaining.length === 0) {
      await this.db.profile.updateMany({ where: { userId: identity.sub }, data: { online: false, lastSeenAt: new Date() } });
      this.server.emit('user:status-changed', { userId: identity.sub, status: 'offline' });
    }
  }

  @SubscribeMessage('typing:set')
  async typing(@ConnectedSocket() socket: Socket, @MessageBody() body: { conversationId?: string; typing?: boolean }) {
    const identity = socket.data.identity as SocketIdentity | undefined;
    if (!identity || !body?.conversationId) return;
    const conversation = await this.db.conversation.findFirst({ where: { id: body.conversationId, active: true, OR: [{ userOneId: identity.sub }, { userTwoId: identity.sub }] }, select: { userOneId: true, userTwoId: true } });
    if (!conversation) return;
    const recipientId = conversation.userOneId === identity.sub ? conversation.userTwoId : conversation.userOneId;
    this.user(recipientId, body.typing ? 'typing:start' : 'typing:stop', { conversationId: body.conversationId, userId: identity.sub });
  }

  @SubscribeMessage('live:watch')
  async watchLive(@ConnectedSocket() socket: Socket, @MessageBody() body: { liveId?: string }) {
    if (!socket.data.identity || !body?.liveId) return;
    await socket.join(`live:${body.liveId}`);
  }
  @SubscribeMessage('live:unwatch')
  async unwatchLive(@ConnectedSocket() socket: Socket, @MessageBody() body: { liveId?: string }) {
    if (!body?.liveId) return;
    await socket.leave(`live:${body.liveId}`);
  }

  user(userId: string, event: string, payload: unknown) { this.server?.to(`user:${userId}`).emit(event, payload); }
  users(userIds: string[], event: string, payload: unknown) { for (const id of new Set(userIds)) this.user(id, event, payload); }
  room(room: string, event: string, payload: unknown) { this.server?.to(room).emit(event, payload); }
}
