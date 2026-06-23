import { Test } from '@nestjs/testing';
import request from 'supertest';
import { describe, it } from 'vitest';

import { AppModule } from '../src/app.module';

describe('health endpoint', () => {
  it('reports that the API process is healthy', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const server = app.getHttpServer() as Parameters<typeof request>[0];

    await request(server)
      .get('/v1/health')
      .expect(200)
      .expect({ service: 'api', status: 'ok' });

    await app.close();
  });
});
