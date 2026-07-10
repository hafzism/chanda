import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { StructuredLogger } from '@suppline/observability';
import type { NextFunction, Request, Response } from 'express';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new StructuredLogger({ service: 'api' });
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger,
    rawBody: true,
  });
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.enableShutdownHooks();
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader(
      'Permissions-Policy',
      'camera=(), geolocation=(), microphone=()',
    );
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
