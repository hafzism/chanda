import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockedFunction } from 'vitest';

import { WorkspaceService } from '../src/workspaces/workspace.service';
import type { WorkspaceRepository } from '../src/workspaces/workspace.types';

describe('WorkspaceService', () => {
  let createMock: MockedFunction<WorkspaceRepository['create']>;
  let listMock: MockedFunction<WorkspaceRepository['listForUser']>;
  let service: WorkspaceService;

  beforeEach(() => {
    createMock = vi.fn<WorkspaceRepository['create']>();
    listMock = vi.fn<WorkspaceRepository['listForUser']>();
    service = new WorkspaceService({
      create: createMock,
      listForUser: listMock,
    });
  });

  it('creates a normalized workspace owned by the authenticated user', async () => {
    createMock.mockResolvedValue({
      id: 'workspace-1',
      name: 'Acme Support',
      role: 'owner',
      slug: 'acme-support',
    });

    await expect(
      service.create('user-1', {
        name: '  Acme Support  ',
        slug: 'acme-support',
      }),
    ).resolves.toMatchObject({ role: 'owner' });
    expect(createMock).toHaveBeenCalledWith({
      name: 'Acme Support',
      ownerUserId: 'user-1',
      slug: 'acme-support',
    });
  });

  it('turns a unique slug violation into a useful conflict response', async () => {
    createMock.mockRejectedValue(
      Object.assign(new Error('duplicate'), { code: '23505' }),
    );

    await expect(
      service.create('user-1', { name: 'Acme', slug: 'acme' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lists only workspaces returned for the authenticated user', async () => {
    listMock.mockResolvedValue([]);

    await expect(service.listForUser('user-1')).resolves.toEqual([]);
    expect(listMock).toHaveBeenCalledWith('user-1');
  });
});
