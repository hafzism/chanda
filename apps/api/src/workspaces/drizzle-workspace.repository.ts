import { Injectable } from '@nestjs/common';
import {
  and,
  channelConnections,
  eq,
  workspaceMembers,
  workspaces,
} from '@suppline/database';

import { DatabaseService } from '../database/database.service';
import type {
  WorkspaceMembership,
  WorkspaceRepository,
  WorkspaceSummary,
} from './workspace.types';

@Injectable()
export class DrizzleWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly database: DatabaseService) {}

  async create(input: {
    name: string;
    ownerUserId: string;
    slug: string;
    webPublicKey: string;
  }): Promise<WorkspaceSummary> {
    return this.database.db.transaction(async (transaction) => {
      const [workspace] = await transaction
        .insert(workspaces)
        .values({
          createdByUserId: input.ownerUserId,
          name: input.name,
          slug: input.slug,
        })
        .returning({
          id: workspaces.id,
          name: workspaces.name,
          slug: workspaces.slug,
        });

      if (!workspace) {
        throw new Error('Unable to create the workspace.');
      }

      await transaction.insert(workspaceMembers).values({
        role: 'owner',
        userId: input.ownerUserId,
        workspaceId: workspace.id,
      });
      await transaction.insert(channelConnections).values({
        kind: 'web',
        name: 'Website chat',
        publicKey: input.webPublicKey,
        status: 'active',
        workspaceId: workspace.id,
      });

      return { ...workspace, role: 'owner' };
    });
  }

  async listForUser(userId: string): Promise<WorkspaceSummary[]> {
    return this.database.db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        role: workspaceMembers.role,
        slug: workspaces.slug,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, userId))
      .orderBy(workspaces.name);
  }

  async findMembership(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceMembership | null> {
    const [membership] = await this.database.db
      .select({
        role: workspaceMembers.role,
        userId: workspaceMembers.userId,
        workspaceId: workspaceMembers.workspaceId,
      })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.workspaceId, workspaceId),
        ),
      )
      .limit(1);

    return membership ?? null;
  }
}
