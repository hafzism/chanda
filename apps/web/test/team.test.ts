import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  acceptInvitation,
  createInvitation,
  removeMember,
  updateMemberRole,
} from '../lib/team';

describe('team operations', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('creates scoped invitations without claiming an email was sent', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ token: 'token' }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await createInvitation('workspace-1', {
      email: 'agent@example.com',
      role: 'agent',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/workspaces/workspace-1/team/invitations',
      expect.objectContaining({
        body: JSON.stringify({ email: 'agent@example.com', role: 'agent' }),
        method: 'POST',
      }),
    );
  });

  it('uses separate role and removal mutations', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response('{}', { status: 200 })),
      );
    vi.stubGlobal('fetch', fetchMock);

    await updateMemberRole('workspace-1', 'user-1', 'viewer');
    await removeMember('workspace-1', 'user-1');

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'PATCH' });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'DELETE' });
  });

  it('accepts an invitation explicitly rather than on preview', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{"id":"workspace-1"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await acceptInvitation('safe-token');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/invitations/safe-token/accept',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
