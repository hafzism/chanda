import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { WorkerModule } from '../src/worker.module';

describe('WorkerModule', () => {
  it('creates the worker application boundary', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [WorkerModule],
    }).compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
