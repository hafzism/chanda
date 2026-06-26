import { describe, expect, it } from 'vitest';

import { isKnowledgeIndexJob, type HealthResponse } from '../src';

describe('HealthResponse', () => {
  it('represents a healthy API boundary', () => {
    const response: HealthResponse = { service: 'api', status: 'ok' };
    expect(response.status).toBe('ok');
  });
});

describe('knowledge indexing job contract', () => {
  it('rejects incomplete queue payloads at runtime', () => {
    expect(
      isKnowledgeIndexJob({
        documentId: 'document-1',
        objectKey: 'workspaces/workspace-1/source.md',
        versionId: 'version-1',
        workspaceId: 'workspace-1',
      }),
    ).toBe(true);
    expect(isKnowledgeIndexJob({ workspaceId: 'workspace-1' })).toBe(false);
  });
});
