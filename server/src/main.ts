import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './realtime/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const realtimeAdapter = new RedisIoAdapter(app, process.env.REDIS_URL);
  await realtimeAdapter.connect();
  app.useWebSocketAdapter(realtimeAdapter);
  app.enableShutdownHooks();
  process.once('SIGTERM', () => { void realtimeAdapter.close(); });
  process.once('SIGINT', () => { void realtimeAdapter.close(); });
  app.use(helmet());
  const origins = process.env.CORS_ORIGINS?.split(',').map(value => value.trim()).filter(Boolean);
  app.enableCors({ origin: origins?.length ? origins : true, credentials: true });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const config = new DocumentBuilder().setTitle('SocialConnect API').setDescription('Paid social calling, chat, gifts, wallet and manual payment API').setVersion('1.0').addBearerAuth().build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  await app.listen(Number(process.env.PORT ?? 3000));
}
bootstrap();
