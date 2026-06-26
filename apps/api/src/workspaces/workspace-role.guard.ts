import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { readAuthenticatedSession } from '../auth/session.guard';
import { WorkspaceService } from './workspace.service';
import type { WorkspaceRole } from './workspace.types';

const WORKSPACE_ROLES = 'workspace_roles';

export const WorkspaceRoles = (...roles: WorkspaceRole[]) =>
  SetMetadata(WORKSPACE_ROLES, roles);

@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly workspaceService: WorkspaceService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowedRoles = this.reflector.getAllAndOverride<WorkspaceRole[]>(
      WORKSPACE_ROLES,
      [context.getHandler(), context.getClass()],
    );
    if (!allowedRoles || allowedRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const workspaceId = request.params.workspaceId;
    if (typeof workspaceId !== 'string' || !workspaceId) {
      throw new ForbiddenException('A workspace boundary is required.');
    }

    const session = readAuthenticatedSession(request);
    const membership = await this.workspaceService.findMembership(
      session.user.id,
      workspaceId,
    );

    if (!membership || !allowedRoles.includes(membership.role)) {
      throw new ForbiddenException(
        'Your workspace role does not allow this action.',
      );
    }

    return true;
  }
}
