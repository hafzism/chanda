import { describe, expect, it } from 'vitest';

import type { HealthResponse } from '../src';

describe('HealthResponse', () => {
  it('represents a healthy API boundary', () => {
    const response: HealthResponse = { service: 'api', status: 'ok' };
    expect(response.status).toBe('ok');
  });
});
