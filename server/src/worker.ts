import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'warn', 'error'] });
  app.enableShutdownHooks();
  const close = async () => { await app.close(); process.exit(0); };
  process.once('SIGTERM', () => void close());
  process.once('SIGINT', () => void close());
}

void bootstrap();
