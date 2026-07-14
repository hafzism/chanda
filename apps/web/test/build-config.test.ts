import { describe, expect, it } from 'vitest';

import turbo from '../../../turbo.json';

describe('production web build configuration', () => {
  it('treats the internal API origin as a cached build input', () => {
    expect(turbo.tasks.build.env).toContain('API_INTERNAL_URL');
  });
});
