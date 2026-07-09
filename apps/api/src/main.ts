import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.enableCors({ origin: true, credentials: true });
  app.setGlobalPrefix('api');

  const port = Number(process.env.APP_PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
