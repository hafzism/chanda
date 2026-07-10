import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { StructuredLogger } from '@suppline/observability';

import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  const logger = new StructuredLogger({ service: 'worker' });
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger,
  });
  app.enableShutdownHooks();
  logger.log('Worker context initialized', 'Bootstrap');
}

void bootstrap();
