import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'node:path';

import { AuthModule } from './auth/auth.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { KnowledgeModule } from './knowledge/knowledge.module';
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
    }),
    DatabaseModule,
    StorageModule,
    AuthModule,
    AnalyticsModule,
    WorkspaceModule,
    KnowledgeModule,
    SupportModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
