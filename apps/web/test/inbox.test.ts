import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  addInboxNote,
  generateAiDraft,
  sendInboxReply,
  updateTicket,
} from '../lib/inbox';

describe('inbox operations', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends ticket changes to the scoped mutation endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'resolved' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await updateTicket('workspace-1', 'conversation-1', {
      status: 'resolved',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/workspaces/workspace-1/inbox/conversation-1/ticket',
      expect.objectContaining({
        body: JSON.stringify({ status: 'resolved' }),
        method: 'PATCH',
      }),
    );
  });

  it('uses separate endpoints for customer replies and private notes', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response('{}', {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await sendInboxReply(
      'workspace-1',
      'conversation-1',
      'Customer reply',
      'draft-1',
    );
    await addInboxNote('workspace-1', 'conversation-1', 'Private context');

    expect(fetchMock.mock.calls[0]?.[0]).toContain('/replies');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      body: JSON.stringify({ body: 'Customer reply', draftId: 'draft-1' }),
    });
    expect(fetchMock.mock.calls[1]?.[0]).toContain('/notes');
  });

  it('requests a grounded draft without auto-sending a reply', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{}', {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await generateAiDraft('workspace-1', 'conversation-1');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/workspaces/workspace-1/inbox/conversation-1/ai-draft',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty('body');
  });
});
