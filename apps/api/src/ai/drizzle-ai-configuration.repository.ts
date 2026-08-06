import { Injectable } from '@nestjs/common';
import {
  eq,
  outboxEvents,
  sql,
  workspaceAiConfigurations,
} from '@suppline/database';
import { KNOWLEDGE_VERSION_INDEX_REQUESTED } from '@suppline/contracts';

import { DatabaseService } from '../database/database.service';
import type {
  AiConfigurationRepository,
  StoredAiConfiguration,
} from './ai-configuration.types';

interface ReindexVersionRow extends Record<string, unknown> {
  documentId: string;
  objectKey: string;
  versionId: string;
}

@Injectable()
export class DrizzleAiConfigurationRepository implements AiConfigurationRepository {
  constructor(private readonly database: DatabaseService) {}

  async find(workspaceId: string): Promise<StoredAiConfiguration | null> {
    const records = await this.database.db
      .select()
      .from(workspaceAiConfigurations)
      .where(eq(workspaceAiConfigurations.workspaceId, workspaceId))
      .limit(1);
    return records[0] ?? null;
  }

  async save(
    input: Parameters<AiConfigurationRepository['save']>[0],
  ): Promise<StoredAiConfiguration> {
    return this.database.db.transaction(async (transaction) => {
      const previous = await transaction
        .select({
          embeddingDimensions: workspaceAiConfigurations.embeddingDimensions,
          embeddingModel: workspaceAiConfigurations.embeddingModel,
          embeddingRevision: workspaceAiConfigurations.embeddingRevision,
          provider: workspaceAiConfigurations.provider,
        })
        .from(workspaceAiConfigurations)
        .where(eq(workspaceAiConfigurations.workspaceId, input.workspaceId))
        .limit(1);
      const prior = previous[0];
      const embeddingChanged =
        !prior ||
        prior.provider !== input.provider ||
        prior.embeddingModel !== input.embeddingModel ||
        prior.embeddingDimensions !== input.embeddingDimensions;
      const embeddingRevision = prior
        ? prior.embeddingRevision + (embeddingChanged ? 1 : 0)
        : 1;

      const records = await transaction
        .insert(workspaceAiConfigurations)
        .values({ ...input, embeddingRevision })
        .onConflictDoUpdate({
          target: workspaceAiConfigurations.workspaceId,
          set: {
            apiKeyFingerprint: input.apiKeyFingerprint,
            configuredByUserId: input.configuredByUserId,
            embeddingDimensions: input.embeddingDimensions,
            embeddingModel: input.embeddingModel,
            embeddingRevision,
            encryptedApiKey: input.encryptedApiKey,
            encryptionKeyVersion: input.encryptionKeyVersion,
            generationModel: input.generationModel,
            provider: input.provider,
            updatedAt: new Date(),
            validatedAt: input.validatedAt,
          },
        })
        .returning();
      const saved = records[0];
      if (!saved) throw new Error('AI configuration was not persisted.');

      if (embeddingChanged) {
        const versions = await transaction.execute<ReindexVersionRow>(sql`
          update knowledge_document_versions
          set
            status = 'queued',
            error_code = null,
            error_message = null
          where workspace_id = ${input.workspaceId}
          returning
            document_id as "documentId",
            coalesce(extracted_object_key, object_key) as "objectKey",
            id as "versionId"
        `);
        if (versions.rows.length > 0) {
          await transaction.insert(outboxEvents).values(
            versions.rows.map((version) => ({
              aggregateId: version.versionId,
              payload: {
                documentId: version.documentId,
                objectKey: version.objectKey,
                versionId: version.versionId,
                workspaceId: input.workspaceId,
              },
              topic: KNOWLEDGE_VERSION_INDEX_REQUESTED,
              workspaceId: input.workspaceId,
            })),
          );
        }
      }

      return saved;
    });
  }

  async delete(workspaceId: string): Promise<boolean> {
    const deleted = await this.database.db
      .delete(workspaceAiConfigurations)
      .where(eq(workspaceAiConfigurations.workspaceId, workspaceId))
      .returning({ workspaceId: workspaceAiConfigurations.workspaceId });
    return deleted.length === 1;
  }
}
