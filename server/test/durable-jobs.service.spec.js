const { ConfigService } = require('@nestjs/config');
const { DurableJobsService } = require('../dist/src/jobs/durable-jobs.service');

describe('DurableJobsService', () => {
  const service = new DurableJobsService(new ConfigService({ BACKGROUND_QUEUE_MODE: 'inline' }), {}, {}, {}, {});

  it('reports the dependency-light inline mode when BullMQ is disabled', async () => {
    await expect(service.status()).resolves.toEqual({ mode: 'inline' });
  });

  it('parses authenticated TLS Redis URLs without leaking credentials', () => {
    const connection = service.connection('rediss://worker:secret@redis.example.com:6380/2');
    expect(connection).toMatchObject({ host: 'redis.example.com', port: 6380, username: 'worker', password: 'secret', db: 2, tls: {} });
  });
});
