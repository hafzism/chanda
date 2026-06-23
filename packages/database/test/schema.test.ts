import { describe, expect, it } from 'vitest';

import { workspaceRole } from '../src/schema';

describe('workspace roles', () => {
  it('exposes only the supported authorization roles', () => {
    expect(workspaceRole.enumValues).toEqual([
      'owner',
      'admin',
      'agent',
      'viewer',
    ]);
  });
});
