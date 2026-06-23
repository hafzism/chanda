import { describe, expect, it } from 'vitest';

import { WIDGET_PACKAGE_NAME } from '../src';

describe('widget package', () => {
  it('exposes its stable package identity', () => {
    expect(WIDGET_PACKAGE_NAME).toBe('@suppline/widget');
  });
});
