import { IsIn } from 'class-validator';

import type { WorkspaceRole } from '../workspace.types';

export class UpdateMemberRoleDto {
  @IsIn(['admin', 'agent', 'viewer'] satisfies WorkspaceRole[])
  role!: 'admin' | 'agent' | 'viewer';
}
