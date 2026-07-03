import { IsEmail, IsIn, MaxLength } from 'class-validator';

import type { WorkspaceRole } from '../workspace.types';

export class CreateInvitationDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsIn(['admin', 'agent', 'viewer'] satisfies WorkspaceRole[])
  role!: 'admin' | 'agent' | 'viewer';
}
