import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';
import { ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;
  private pub?: RedisClientType;
  private sub?: RedisClientType;

  constructor(app: INestApplicationContext, private readonly url?: string) { super(app); }

  async connect() {
    if (!this.url) { this.logger.warn('REDIS_URL is not configured; Socket.IO is running in single-instance mode'); return false; }
    try {
      this.pub = createClient({ url: this.url }); this.sub = this.pub.duplicate();
      this.pub.on('error', error => this.logger.error(`Redis pub error: ${error.message}`));
      this.sub.on('error', error => this.logger.error(`Redis sub error: ${error.message}`));
      await Promise.all([this.pub.connect(), this.sub.connect()]);
      this.adapterConstructor = createAdapter(this.pub, this.sub);
      this.logger.log('Socket.IO Redis adapter connected');
      return true;
    } catch (error) {
      await this.close();
      if (process.env.NODE_ENV === 'production') throw error;
      this.logger.warn(`Redis unavailable; using single-instance Socket.IO: ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }

  createIOServer(port: number, options?: ServerOptions) { const server=super.createIOServer(port,options);if(this.adapterConstructor)server.adapter(this.adapterConstructor);return server; }
  async close() { await Promise.allSettled([this.pub?.isOpen ? this.pub.quit() : Promise.resolve(),this.sub?.isOpen ? this.sub.quit() : Promise.resolve()]); }
}
