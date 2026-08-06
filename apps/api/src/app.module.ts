import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { StructuredLogger } from '@suppline/observability';
import { join } from 'node:path';

import { AiConfigurationModule } from './ai/ai-configuration.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { validateApiEnvironment } from './config/environment';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { RequestLoggingInterceptor } from './observability/request-logging.interceptor';
import { StorageModule } from './storage/storage.module';
import { SupportModule } from './support/support.module';
import { WorkspaceModule } from './workspaces/workspace.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [
        join(__dirname, '..', '.env.local'),
        join(__dirname, '..', '..', '..', '.env'),
        '.env.local',
      ],
      isGlobal: true,
      validate: validateApiEnvironment,
    }),
    ThrottlerModule.forRoot([
      {
        limit: 300,
        name: 'default',
        ttl: 60_000,
      },
    ]),
    DatabaseModule,
    AiConfigurationModule,
    StorageModule,
    AuthModule,
    BillingModule,
    AnalyticsModule,
    WorkspaceModule,
    KnowledgeModule,
    SupportModule,
  ],
  controllers: [HealthController],
  providers: [
    HealthService,
    {
      provide: StructuredLogger,
      useValue: new StructuredLogger({ service: 'api' }),
    },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
  ],
})
export class AppModule {}
