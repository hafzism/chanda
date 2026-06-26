import { randomBytes } from 'node:crypto';

import { ConflictException, Inject, Injectable } from '@nestjs/common';

import type { CreateWorkspaceDto } from './dto/create-workspace.dto';
import type {
  WorkspaceMembership,
  WorkspaceRepository,
  WorkspaceSummary,
} from './workspace.types';

export const WORKSPACE_REPOSITORY = Symbol('WORKSPACE_REPOSITORY');

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}

@Injectable()
export class WorkspaceService {
  constructor(
    @Inject(WORKSPACE_REPOSITORY)
    private readonly repository: WorkspaceRepository,
  ) {}

  async create(
    ownerUserId: string,
    input: CreateWorkspaceDto,
  ): Promise<WorkspaceSummary> {
    try {
      return await this.repository.create({
        name: input.name.trim(),
        ownerUserId,
        slug: input.slug,
        webPublicKey: `pub_${randomBytes(18).toString('base64url')}`,
      });
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'That workspace URL is already in use. Choose another one.',
        );
      }

      throw error;
    }
  }

  listForUser(userId: string): Promise<WorkspaceSummary[]> {
    return this.repository.listForUser(userId);
  }

  findMembership(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceMembership | null> {
    return this.repository.findMembership(userId, workspaceId);
  }
}
