import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { StructuredLogger } from '@suppline/observability';
import { join } from 'node:path';

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
    DatabaseModule,
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
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
  ],
})
export class AppModule {}
